import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { getContactMessageEmail } from "@/lib/email/templates";

// Public route — the /contact form has no logged-in session to authorize
// an insert against, so this uses the service_role key (same pattern as
// app/api/scrape/route.ts) rather than lib/supabase/server.ts's cookie-based
// client. That key must never be exposed to the browser — this file only
// ever runs server-side.
function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are all required." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  const supabase = serviceClient();

  // support_messages.org_id is not-null — this form has no session (so no
  // client/submission to derive an org from), and First Coast Bids is single-org
  // today, so the oldest organization row is the only sane target. Picked
  // fresh per request rather than hardcoded so this doesn't silently break
  // if the org is ever recreated with a new id.
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgError || !org) {
    console.error("[contact] org lookup failed", {
      message: orgError?.message,
      details: orgError?.details,
      hint: orgError?.hint,
      code: orgError?.code,
    });
    return NextResponse.json({ error: "Couldn't send your message. Please try again." }, { status: 502 });
  }

  const { error } = await supabase.from("support_messages").insert({ name, email, message, org_id: org.id });

  if (error) {
    console.error("[contact] insert failed", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return NextResponse.json({ error: "Couldn't send your message. Please try again." }, { status: 502 });
  }

  // The message is already saved and visible in /admin/messages regardless
  // of what happens below — a failed notification email is never reported
  // back to the (anonymous, unauthenticated) submitter as a failure.
  const { data: admins } = await supabase.from("team_members").select("email").eq("org_id", org.id).eq("role", "admin");

  if (admins && admins.length > 0) {
    const notification = getContactMessageEmail(name, email, message);
    const results = await Promise.allSettled(
      admins.map((a) => sendEmail({ to: a.email, subject: notification.subject, html: notification.html }))
    );
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error("[contact] admin notification failed", { to: admins[i].email, error: String(r.reason) });
      }
    });
  } else {
    console.error("[contact] no admins to notify for org", { orgId: org.id });
  }

  return NextResponse.json({ sent: true });
}
