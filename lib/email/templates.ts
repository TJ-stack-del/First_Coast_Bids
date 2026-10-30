// Keep every client-facing template short and plain — same 8th-grade
// reading level standard as the rest of First Coast Bids' client-facing copy.

import { STEPS, progressStep } from "../dashboard/bid-progress.ts";

// Round 18 (2026-10-30): every client email shares one layout -- the brand
// name, a headline, the bid it's about, the same five-step track the
// dashboard shows, one button back to the bid, and a one-line footer. All
// table-based with inline styles, which is what email clients render.
// Every value that came from a person (company and agency names, admin
// messages, checklist items) is escaped: before this, a name containing
// markup would have been rendered as HTML in the inbox.

export const SITE = "https://www.firstcoastbids.com";
const DASHBOARD = `${SITE}/dashboard`;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const C = { ink: "#0E1622", navy: "#0C2D52", gold: "#C19349", green: "#006C4A", muted: "#5F5A50", line: "#DED6C7", paper: "#F7F3EA" };
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

// The dashboard's five steps as a row of table cells: done in green, the
// current one in navy and named, the rest grey.
function track(step: number): string {
  const bars = STEPS.map(
    (_, i) =>
      `<td style="padding:0 2px"><div style="height:6px;border-radius:3px;background:${i < step ? C.green : i === step ? C.navy : C.line}"></div></td>`
  ).join("");
  const labels = STEPS.map(
    (label, i) =>
      `<td style="padding:6px 2px 0;font:${i === step ? "700" : "400"} 11px/1.3 ${FONT};color:${i === step ? C.ink : C.muted};vertical-align:top">${label}</td>`
  ).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;margin:18px 0 4px"><tr>${bars}</tr><tr>${labels}</tr></table>`;
}

export function emailLayout(o: {
  preheader: string;
  headline: string;
  greeting: string; // already escaped
  bodyHtml: string; // already escaped
  bid?: { agency: string; number?: string | null; step?: number | null };
  button?: { label: string; url: string };
}): string {
  const bid = o.bid
    ? `<tr><td style="padding:20px 28px 0">
        <div style="border:1px solid ${C.line};border-radius:12px;padding:16px 18px;background:#fff">
          <div style="font:600 12px/1.4 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${C.muted}">Your bid</div>
          <div style="font:600 18px/1.3 ${SERIF};color:${C.ink};margin-top:4px">${escapeHtml(o.bid.agency)}</div>
          ${o.bid.number ? `<div style="font:400 13px/1.4 ${FONT};color:${C.muted};margin-top:2px">${escapeHtml(o.bid.number)}</div>` : ""}
          ${typeof o.bid.step === "number" ? track(o.bid.step) : ""}
        </div></td></tr>`
    : "";
  const button = o.button
    ? `<tr><td style="padding:24px 28px 4px"><a href="${escapeHtml(o.button.url)}" style="display:inline-block;background:${C.ink};color:#fff;text-decoration:none;font:700 16px/1 ${FONT};padding:16px 26px;border-radius:999px">${escapeHtml(o.button.label)}</a></td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.paper}">
<tr><td style="padding:0 28px 18px;font:800 15px/1.2 ${FONT};letter-spacing:.06em;color:${C.navy}">FIRST COAST <span style="color:${C.gold}">BIDS</span></td></tr>
<tr><td style="background:#fff;border-radius:18px;border:1px solid ${C.line}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 28px 0;font:600 26px/1.2 ${SERIF};color:${C.ink}">${escapeHtml(o.headline)}</td></tr>
<tr><td style="padding:14px 28px 0;font:400 16px/1.6 ${FONT};color:${C.ink}">${o.greeting}<br>${o.bodyHtml}</td></tr>
${bid}
${button}
<tr><td style="padding:22px 28px 28px;font:400 14px/1.6 ${FONT};color:${C.muted}">Questions? Reply on your dashboard and the person working on your bid will see it.<br>— First Coast Bids</td></tr>
</table></td></tr>
<tr><td style="padding:16px 28px 0;font:400 12px/1.6 ${FONT};color:${C.muted}">Government bid paperwork for small trade businesses in Northeast Florida. We never submit for you or ask for your portal login.</td></tr>
</table></td></tr></table></body></html>`;
}

const hi = (companyName: string) => `Hi ${escapeHtml(companyName)},`;

const STAGE_MESSAGES: Record<string, { subject: string; headline: string; body: (agency: string) => string; button: string }> = {
  submitted: {
    subject: "We've got your bid",
    headline: "We've got your bid.",
    body: (agency) => `We received your bid info for ${agency}. We're getting started on it now.`,
    button: "See where it stands",
  },
  in_review: {
    subject: "We're reviewing your bid",
    headline: "We're working on your bid.",
    body: (agency) => `We're going through the details of your ${agency} bid now. We'll let you know when your paperwork is ready.`,
    button: "See where it stands",
  },
  deliverables_ready: {
    subject: "Your bid paperwork is ready",
    headline: "Your package is ready to preview.",
    body: (agency) => `Your paperwork for the ${agency} bid is ready to look over.`,
    button: "Preview your package",
  },
  client_review: {
    subject: "Please review your bid paperwork",
    headline: "Your package is waiting for you.",
    body: (agency) => `We'd like you to take a look at the paperwork we prepared for your ${agency} bid, whenever you get a chance.`,
    button: "Review your package",
  },
  closed: {
    subject: "Your bid is closed out",
    headline: "Your bid is closed out.",
    body: (agency) => `Your ${agency} bid has been closed out. Thanks for working with us.`,
    button: "Open your dashboard",
  },
};

export function getStageChangeEmail(stage: string, agency: string, companyName: string) {
  const template = STAGE_MESSAGES[stage];
  if (!template) return null;
  return {
    subject: template.subject,
    html: emailLayout({
      preheader: template.body(agency),
      headline: template.headline,
      greeting: hi(companyName),
      bodyHtml: escapeHtml(template.body(agency)),
      bid: { agency, step: progressStep({ draft: false, stage }) },
      button: { label: template.button, url: DASHBOARD },
    }),
  };
}

export function getInfoRequestEmail(message: string, agency: string, companyName: string) {
  return {
    subject: `We need some info for your ${agency} bid`,
    html: emailLayout({
      preheader: `A question about your ${agency} bid.`,
      headline: "We need a bit more from you.",
      greeting: hi(companyName),
      bodyHtml: `To keep working on your ${escapeHtml(agency)} bid, we need:<div style="margin:12px 0 0;padding:14px 16px;border-left:3px solid ${C.gold};background:${C.paper};border-radius:6px">${escapeHtml(message).replace(/\n/g, "<br>")}</div>`,
      bid: { agency },
      button: { label: "Answer on your dashboard", url: DASHBOARD },
    }),
  };
}

// Admin-reply notification on a submission's message thread -- deliberately
// one-directional (client->admin never emails, per the "admin already has
// the daily digest and checks the inbox regularly" call). Points the
// client back to the dashboard rather than embedding the message text.
export function getNewMessageEmail(agency: string, companyName: string) {
  return {
    subject: `New message about your ${agency} bid`,
    html: emailLayout({
      preheader: `We sent you a message about your ${agency} bid.`,
      headline: "You have a new message.",
      greeting: hi(companyName),
      bodyHtml: `We sent you a new message about your ${escapeHtml(agency)} bid.`,
      bid: { agency },
      button: { label: "Read and reply", url: DASHBOARD },
    }),
  };
}

// Fires when an admin assigns a matched opportunity to a client
// (MatchesPanel.tsx's handleAssign), which creates a real draft submission.
// Doubles as the win-back touch for a quiet client: a real, specific reason
// to reach out ("we found a bid that fits your trade"), not a generic drip.
export function getMatchedOpportunityEmail(agency: string, companyName: string) {
  return {
    subject: `We found a ${agency} bid that fits your trade`,
    html: emailLayout({
      preheader: `A ${agency} bid that looks like a fit for your trade.`,
      headline: "We found a bid that fits your trade.",
      greeting: hi(companyName),
      bodyHtml: `We came across a ${escapeHtml(agency)} bid that looks like a fit for your trade and started a draft for it. Take a look and let us know if you want to move forward.`,
      bid: { agency, step: 0 },
      button: { label: "Take a look", url: DASHBOARD },
    }),
  };
}

// Sent when an admin withdraws a bid they assigned from Matches -- the
// agency closed or cancelled it, or it turned out not to be biddable
// (2026-09-23: a Jacksonville Beach RFP was assigned a week after its
// deadline). Says plainly that nothing is needed from the client.
export function getMatchWithdrawnEmail(agency: string, companyName: string, solicitationNumber: string | null) {
  return {
    subject: `Update on the ${agency} bid`,
    html: emailLayout({
      preheader: "Nothing to do on your end.",
      headline: "That bid is no longer open.",
      greeting: hi(companyName),
      bodyHtml:
        "The agency closed or withdrew it, so we've taken it off your dashboard. You don't need to do anything. Sorry for the mix-up. We'll let you know when we find the next one that fits.",
      bid: { agency, number: solicitationNumber },
    }),
  };
}

// "Send the client their list" on the admin bid page: the items from the
// solicitation that are the client's to do (sign, attach, certify).
export function getChecklistItemsEmail(
  agency: string,
  companyName: string,
  items: { label: string; detail: string | null }[]
) {
  const list = items
    .map(
      (i) =>
        `<li style="margin:0 0 8px">${escapeHtml(i.label)}${i.detail ? `<br><span style="color:${C.muted};font-size:14px">${escapeHtml(i.detail)}</span>` : ""}</li>`
    )
    .join("");
  return {
    subject: `What we need from you for the ${agency} bid`,
    html: emailLayout({
      preheader: `${items.length} thing${items.length === 1 ? "" : "s"} only you can do for the ${agency} bid.`,
      headline: items.length === 1 ? "One thing only you can do." : `${items.length} things only you can do.`,
      greeting: hi(companyName),
      bodyHtml: `We read through the ${escapeHtml(agency)} solicitation. To complete your bid, we need you to take care of these:<ul style="margin:12px 0 0;padding-left:20px">${list}</ul>`,
      bid: { agency },
      button: { label: "See the list on your dashboard", url: DASHBOARD },
    }),
  };
}

export function getContactMessageEmail(name: string, email: string, message: string) {
  return {
    subject: `New contact form message from ${name.replace(/[\r\n]+/g, " ").slice(0, 80)}`,
    html: `
      <p>New message from the /contact form:</p>
      <p><strong>${escapeHtml(name)}</strong> — ${escapeHtml(email)}</p>
      <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    `,
  };
}

export function getDailyDigestEmail(
  staleItems: {
    companyName: string;
    agency: string;
    stage: string;
    daysSinceUpdate: number;
    daysUntilDue: number | null;
    breachedTurnaround: boolean;
  }[],
  // Accounts created via intake's "About you" step that never reached
  // "About the bid" -- see app/api/daily-digest/route.ts's own comment on
  // why this can't be derived from `submissions` at all. Optional/defaulted
  // so this stays a no-op for any other caller of this template.
  ghostSignups: {
    companyName: string;
    contactName: string;
    email: string | null;
    phone: string | null;
    // Set at signup itself via the ?package= pricing-tier link, if any --
    // null for a direct/organic signup with no pricing-page referral.
    requestedPackage: string | null;
    daysSinceSignup: number;
  }[] = []
) {
  // Sort the most deadline-critical items to the top — a submission due
  // in 2 days matters far more than one due in 6 weeks, even if both
  // have gone equally untouched. A turnaround-promise breach is always
  // the most urgent, since that's a promise already broken, not just at risk.
  const sorted = [...staleItems].sort((a, b) => {
    if (a.breachedTurnaround !== b.breachedTurnaround) return a.breachedTurnaround ? -1 : 1;
    const aRisk = a.daysUntilDue ?? 9999;
    const bRisk = b.daysUntilDue ?? 9999;
    return aRisk - bRisk;
  });

  const rows = sorted
    .map((item) => {
      const turnaroundFlag = item.breachedTurnaround
        ? `<strong style="color:#ba1a1a">PAST OUR 48-HOUR PROMISE</strong> — `
        : "";
      const urgency =
        item.daysUntilDue !== null && item.daysUntilDue <= 5
          ? `<strong style="color:#ba1a1a">DUE SOON — ${item.daysUntilDue} day${item.daysUntilDue === 1 ? "" : "s"} left</strong> — `
          : "";
      return `<li>${turnaroundFlag}${urgency}${escapeHtml(item.companyName)} — ${escapeHtml(item.agency)} (${item.stage.replace(/_/g, " ")}, ${item.daysSinceUpdate} days with no update)</li>`;
    })
    .join("");

  const breachCount = sorted.filter((i) => i.breachedTurnaround).length;
  const urgentCount = sorted.filter((i) => i.daysUntilDue !== null && i.daysUntilDue <= 5).length;

  // Oldest-first -- a signup from a week ago is more likely a genuine
  // abandonment worth a follow-up call than one from this morning who may
  // still come back and finish the bid themselves.
  const PACKAGE_LABELS: Record<string, string> = { pilot: "Pilot", one_off: "One-off", retainer: "Retainer" };
  const sortedGhosts = [...ghostSignups].sort((a, b) => b.daysSinceSignup - a.daysSinceSignup);
  const ghostRows = sortedGhosts
    .map((g) => {
      const contact = escapeHtml(g.email ?? g.phone ?? "no contact on file");
      const wanted = g.requestedPackage
        ? ` — wanted: <strong>${PACKAGE_LABELS[g.requestedPackage] ?? g.requestedPackage}</strong>`
        : "";
      return `<li>${escapeHtml(g.companyName)} (${escapeHtml(g.contactName)}) — signed up ${g.daysSinceSignup} day${
        g.daysSinceSignup === 1 ? "" : "s"
      } ago, never started a bid${wanted}. Contact: ${contact}</li>`;
    })
    .join("");
  const ghostSection =
    sortedGhosts.length > 0
      ? `<p>These accounts signed up but never started a bid -- worth a follow-up:</p><ul>${ghostRows}</ul>`
      : "";

  const staleSubjectPart =
    breachCount > 0
      ? `${breachCount} submission${breachCount === 1 ? "" : "s"} PAST our 48-hour promise`
      : urgentCount > 0
      ? `${urgentCount} submission${urgentCount === 1 ? "" : "s"} due soon and stalled`
      : staleItems.length > 0
      ? `${staleItems.length} submission${staleItems.length === 1 ? "" : "s"} need attention`
      : null;
  const ghostSubjectPart =
    sortedGhosts.length > 0 ? `${sortedGhosts.length} signup${sortedGhosts.length === 1 ? "" : "s"} with no bid yet` : null;

  return {
    subject: `First Coast Bids: ${[staleSubjectPart, ghostSubjectPart].filter(Boolean).join(" · ")}`,
    html: `
      ${staleItems.length > 0 ? `<p>These submissions haven't been updated in a few days, sorted by urgency:</p><ul>${rows}</ul>` : ""}
      ${ghostSection}
    `,
  };
}
