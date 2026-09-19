import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Closes a real visibility blind spot found 2026-09-19: IntakeWizard.tsx's
// handleAboutYouNext only inserts the `clients` row once a CONFIRMED
// session exists, because that insert runs through the browser's own
// RLS-scoped client (auth.uid() must resolve). Production's Auth config
// requires email confirmation (mailer_autoconfirm: false, confirmed
// directly against bidpulse-production's Management API), so anyone who
// signs up and never clicks the confirmation email never gets a `clients`
// row at all -- not just "incomplete," genuinely nonexistent. That means
// the daily-digest ghost-signup detector (which queries `clients`) can
// never see them, on top of the admin inbox (which queries `submissions`)
// already not seeing them either. This route is called immediately after
// signUp() succeeds, before the confirmation-required early return, using
// the service role specifically because there is no session yet for a
// normal RLS-scoped insert to authenticate as.
//
// Deliberately best-effort / non-blocking from the caller's side: a
// failure here must never block or error out the visitor's own signup —
// see the fire-and-forget call site in IntakeWizard.tsx.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const authUserId = typeof body?.authUserId === "string" ? body.authUserId : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
  const contactName = typeof body?.contactName === "string" ? body.contactName.trim() : "";
  const requestedPackage = typeof body?.requestedPackage === "string" ? body.requestedPackage : null;

  if (!authUserId || !email || !companyName || !contactName) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // This route runs with the service role (bypasses RLS entirely), so
  // without this check anyone could POST an arbitrary authUserId + fake
  // company info and create clients rows for accounts they don't own.
  // Confirming the id is a real, just-created auth user whose own email
  // matches what's claimed is what makes this safe to expose publicly.
  const { data: authLookup, error: authLookupError } = await supabase.auth.admin.getUserById(authUserId);
  if (authLookupError || !authLookup?.user || authLookup.user.email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Could not verify this account." }, { status: 403 });
  }

  // Idempotent: IntakeWizard.tsx's own confirmed-session path checks for
  // an existing row before inserting, so once this route has created one,
  // that later code naturally finds it and never double-inserts. This
  // same check here also means a retried call to this route (e.g. a
  // dropped response on the client side) converges on the one real row.
  const { data: existing } = await supabase.from("clients").select().eq("auth_user_id", authUserId).maybeSingle();
  if (existing) {
    return NextResponse.json({ client: existing });
  }

  // Same "first org in the system" single-tenant assumption as every
  // other service-role route that needs one (app/api/contact/route.ts,
  // IntakeWizard.tsx's own org lookup).
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgError || !org) {
    console.error("[create-pending-client] org lookup failed", { message: orgError?.message });
    return NextResponse.json({ error: "No admin organization set up yet." }, { status: 502 });
  }

  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert({
      org_id: org.id,
      auth_user_id: authUserId,
      company_name: companyName,
      contact_name: contactName,
      email,
      phone: null,
      requested_package: requestedPackage,
    })
    .select()
    .single();

  if (insertError || !client) {
    console.error("[create-pending-client] insert failed", {
      message: insertError?.message,
      code: insertError?.code,
    });
    return NextResponse.json({ error: "Couldn't save your company info." }, { status: 502 });
  }

  return NextResponse.json({ client });
}
