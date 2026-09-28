import { NextResponse } from "next/server";
// archiver 8.x is a pure-ESM rewrite with no default factory export (the
// classic `require("archiver")("zip", opts)` from its older docs no longer
// exists) -- it exports format classes directly instead.
import { ZipArchive } from "archiver";
import { createClient } from "@/lib/supabase/server";
import { signRfpDocumentUrl } from "@/lib/storage";
import { certificationLabel, policyLabel, bondingLabel } from "@/lib/compliance/labels";

export const runtime = "nodejs";
// archiver streams through Node's zlib -- needs the Node runtime, not edge.
// Same reasoning as extract-company-profile/route.ts's identical comment:
// Vercel's default 10s serverless timeout is too short once this is
// fetching and re-zipping several real files, not just calling an API.
export const maxDuration = 60;

// Hard cap, not a soft warning -- this route fetches every file serially
// and holds the whole zip in memory before responding (no large-payload-
// streaming pattern exists yet in this repo to extend instead). A client
// with more documents than this needs a real streaming rewrite, not a
// silent timeout.
const MAX_FILES = 40;

// Row count alone doesn't bound memory -- none of the three real upload
// flows that feed this route (CertificationsSection, InsuranceBondingSection,
// DocumentLibrarySection, all via uploadAndInsertRecord/lib/storage.ts) enforce
// a per-file size limit, and the rfp-documents bucket itself has no
// file_size_limit set. A running byte budget across the whole export is the
// real backstop MAX_FILES alone doesn't provide.
const MAX_TOTAL_BYTES = 150 * 1024 * 1024; // 150MB

type ExportRow = { folder: string; file_url: string | null; file_name: string | null; fallbackName: string };

// Only real, client-uploaded documents -- never the deliverable content
// itself (that already has its own packet at lib/pdf/deliverables-packet.ts)
// and never an unverified certification/policy/bond, since an unverified
// record hasn't been confirmed real by our team yet. The document library
// has no verification workflow by design (see Phase 3 of the Compliance
// Vault plan), so every row there is included as-is.
async function collectExportRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string
): Promise<ExportRow[]> {
  const [{ data: certs }, { data: policies }, { data: bonds }, { data: docs }] = await Promise.all([
    supabase
      .from("client_certifications")
      .select("cert_type, other_label, record_type, file_url, file_name")
      .eq("client_id", clientId)
      .eq("verified", true),
    supabase
      .from("client_insurance_policies")
      .select("policy_type, file_url, file_name")
      .eq("client_id", clientId)
      .eq("verified", true),
    supabase
      .from("client_bonding_capacity")
      .select("surety_name, file_url, file_name")
      .eq("client_id", clientId)
      .eq("verified", true),
    supabase.from("client_documents").select("doc_type, label, file_url, file_name").eq("client_id", clientId),
  ]);

  return [
    ...(certs ?? []).map((c) => ({
      folder: "Certifications",
      file_url: c.file_url,
      file_name: c.file_name,
      fallbackName: certificationLabel(c),
    })),
    ...(policies ?? []).map((p) => ({
      folder: "Insurance",
      file_url: p.file_url,
      file_name: p.file_name,
      fallbackName: policyLabel(p),
    })),
    ...(bonds ?? []).map((b) => ({
      folder: "Bonding",
      file_url: b.file_url,
      file_name: b.file_name,
      fallbackName: bondingLabel(b),
    })),
    ...(docs ?? []).map((d) => ({
      folder: "Documents",
      file_url: d.file_url,
      file_name: d.file_name,
      fallbackName: (d.label || d.doc_type) ?? "Document",
    })),
  ].filter((r): r is ExportRow => !!r.file_url);
}

// Every entry needs a distinct name inside its folder -- two "General
// Liability" policies (a renewal replacing an expired one, say) would
// otherwise silently collide and overwrite each other in the zip. Also
// strips path separators out of free-text fields (other_label, surety_name,
// a document library label) before they reach the zip -- archiver's own
// sanitizePath already prevents any real path-traversal risk, but an
// unescaped "/" in a label would still create an unintended nested folder.
function uniqueZipPath(folder: string, rawName: string, used: Set<string>): string {
  const name = rawName.replace(/[/\\]+/g, "-");
  let path = `${folder}/${name}`;
  let n = 2;
  while (used.has(path)) {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    path = `${folder}/${base} (${n})${ext}`;
    n++;
  }
  used.add(path);
  return path;
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Always the requesting user's own client row -- there is no client_id
  // param to trust or reject here in the first place.
  const { data: client } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await collectExportRows(supabase, client.id);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No reviewed documents yet. Add a certification, insurance policy, or bond, and our team will review the document first." },
      { status: 404 }
    );
  }
  if (rows.length > MAX_FILES) {
    return NextResponse.json(
      { error: "You have more documents than we can bundle in one export right now. Contact us and we'll put together a manual export for you." },
      { status: 413 }
    );
  }

  // Rows a file couldn't actually be included for (failed to sign, failed
  // to fetch, or pushed the export past the size budget) -- a compliance
  // export that's silently missing a document is a real trust problem, not
  // just a logging nicety, so this ships inside the zip itself as a
  // manifest rather than only server-side.
  const skipped: { name: string; reason: string }[] = [];

  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    (async () => {
      const used = new Set<string>();
      let totalBytes = 0;
      for (const row of rows) {
        const label = row.file_name || row.fallbackName;
        const signedUrl = await signRfpDocumentUrl(supabase, row.file_url);
        if (!signedUrl) {
          skipped.push({ name: `${row.folder}/${label}`, reason: "couldn't generate a download link" });
          continue;
        }
        const res = await fetch(signedUrl);
        if (!res.ok) {
          skipped.push({ name: `${row.folder}/${label}`, reason: "couldn't be downloaded from storage" });
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (totalBytes + buf.length > MAX_TOTAL_BYTES) {
          skipped.push({ name: `${row.folder}/${label}`, reason: "skipped -- export size limit reached" });
          continue;
        }
        totalBytes += buf.length;
        archive.append(buf, { name: uniqueZipPath(row.folder, label, used) });
      }

      if (skipped.length > 0) {
        console.error(
          `[compliance/export] client ${client.id}: ${skipped.length} of ${rows.length} file(s) skipped`,
          skipped
        );
        const manifest = [
          "The following documents could NOT be included in this export:",
          "",
          ...skipped.map((s) => `- ${s.name} (${s.reason})`),
          "",
          "Contact us if you need these included.",
        ].join("\n");
        archive.append(Buffer.from(manifest, "utf-8"), { name: "MISSING_FILES.txt" });
      }

      archive.finalize();
    })().catch(reject);
  });

  const safeCompanyName = client.company_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "vault";

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeCompanyName}-compliance-vault.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
