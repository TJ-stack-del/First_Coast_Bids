// Keep every client-facing template short and plain — same 8th-grade
// reading level standard as the rest of First Coast Bids' client-facing copy.

const STAGE_MESSAGES: Record<string, { subject: string; body: (agency: string) => string }> = {
  submitted: {
    subject: "We've got your bid",
    body: (agency) =>
      `We received your bid info for ${agency}. We're getting started on it now.`,
  },
  in_review: {
    subject: "We're reviewing your bid",
    body: (agency) =>
      `We're going through the details of your ${agency} bid now. We'll let you know when your paperwork is ready.`,
  },
  deliverables_ready: {
    subject: "Your bid paperwork is ready",
    body: (agency) =>
      `Your paperwork for the ${agency} bid is ready to look over. Log in to your dashboard to see it.`,
  },
  client_review: {
    subject: "Please review your bid paperwork",
    body: (agency) =>
      `We'd like you to take a look at the paperwork we prepared for your ${agency} bid, whenever you get a chance.`,
  },
  closed: {
    subject: "Your bid is closed out",
    body: (agency) => `Your ${agency} bid has been closed out. Thanks for working with us.`,
  },
};

export function getStageChangeEmail(stage: string, agency: string, companyName: string) {
  const template = STAGE_MESSAGES[stage];
  if (!template) return null;

  return {
    subject: template.subject,
    html: `
      <p>Hi ${companyName},</p>
      <p>${template.body(agency)}</p>
      <p>— First Coast Bids</p>
    `,
  };
}

export function getInfoRequestEmail(message: string, agency: string, companyName: string) {
  return {
    subject: `We need some info for your ${agency} bid`,
    html: `
      <p>Hi ${companyName},</p>
      <p>We need a bit more information to keep working on your ${agency} bid:</p>
      <p>${message.replace(/\n/g, "<br>")}</p>
      <p>Log in to your dashboard any time to check on this.</p>
      <p>— First Coast Bids</p>
    `,
  };
}

// Admin-reply notification on a submission's message thread — deliberately
// one-directional (client→admin never emails, per the "admin already has
// the daily digest and checks the inbox regularly" call). Points the
// client back to the dashboard rather than embedding the message text
// itself, matching every other stage-change template's convention.
export function getNewMessageEmail(agency: string, companyName: string) {
  return {
    subject: `New message about your ${agency} bid`,
    html: `
      <p>Hi ${companyName},</p>
      <p>We sent you a new message about your ${agency} bid. Log in to your dashboard to view it and reply.</p>
      <p>— First Coast Bids</p>
    `,
  };
}

// Fires when an admin assigns a matched opportunity to a client
// (MatchesPanel.tsx's handleAssign), which already creates a real draft
// submission -- no email went out for that at all before this, for any
// client, active or lapsed. Doubling as the win-back touch for a client
// who hasn't had a submission in a while is deliberate: it's a real,
// specific reason to reach out ("we found a bid that fits your trade"),
// not a generic "we miss you" -- matches the product's own "a real person
// found this for you" positioning instead of an automated drip sequence.
export function getMatchedOpportunityEmail(agency: string, companyName: string) {
  return {
    subject: `We found a ${agency} bid that fits your trade`,
    html: `
      <p>Hi ${companyName},</p>
      <p>We came across a ${agency} bid that looks like a fit for your trade and started a draft for it. Log in to your dashboard to take a look and let us know if you want to move forward.</p>
      <p>— First Coast Bids</p>
    `,
  };
}

export function getContactMessageEmail(name: string, email: string, message: string) {
  return {
    subject: `New contact form message from ${name}`,
    html: `
      <p>New message from the /contact form:</p>
      <p><strong>${name}</strong> — ${email}</p>
      <p>${message.replace(/\n/g, "<br>")}</p>
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
      return `<li>${turnaroundFlag}${urgency}${item.companyName} — ${item.agency} (${item.stage.replace(/_/g, " ")}, ${item.daysSinceUpdate} days with no update)</li>`;
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
      const contact = g.email ?? g.phone ?? "no contact on file";
      const wanted = g.requestedPackage
        ? ` — wanted: <strong>${PACKAGE_LABELS[g.requestedPackage] ?? g.requestedPackage}</strong>`
        : "";
      return `<li>${g.companyName} (${g.contactName}) — signed up ${g.daysSinceSignup} day${
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
