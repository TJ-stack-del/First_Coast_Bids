import { ownerFor } from "../bid-read/owners.ts";
import type { CompletenessField } from "../compliance/profile-completeness.ts";

// The "it's with us" screen after a client sends a bid (app/intake): when
// we got it, when we aim to have it ready, how long until the agency's
// deadline, and what only the client can do while we write. Plain code
// from what the client already gave us; the 48 hours is the site's stated
// aim ("We aim to have your bid ready within 48 hours"), shown as an aim.

export const AIM_HOURS = 48;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReceiptTask = { key: string; text: string; detail: string | null; href: string | null };

export type BidReceipt = {
  receivedAt: Date;
  aimAt: Date;
  // Calendar days from the day we got it to the due date; null when no due date was given.
  daysLeft: number | null;
  // The due date falls before (or on the same day as) our aim: still possible, but say so.
  tight: boolean;
  // Already past the due date the client typed.
  pastDue: boolean;
  tasks: ReceiptTask[];
};

// Where each missing Company Profile field gets filled in, worded as the task.
const PROFILE_TASKS: Record<string, { text: string; href: string }> = {
  license_number: { text: "Add your trade license number", href: "/dashboard/profile" },
  business_registration_number: { text: "Add your Sunbiz document number", href: "/dashboard/profile" },
  insurance: { text: "Add your insurance details", href: "/dashboard/profile" },
  workers_comp: { text: "Add your workers' comp coverage", href: "/dashboard/profile" },
  business_address: { text: "Add your business address", href: "/dashboard/profile" },
  business_phone: { text: "Add your business phone", href: "/dashboard/profile" },
  naics_codes: { text: "Pick your trade codes (NAICS)", href: "/dashboard/profile" },
  certification: { text: "Upload a certification, if you have one", href: "/dashboard/compliance" },
};

// "2026-11-18" as a local calendar day (the form's date input has no time).
function localDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function buildBidReceipt(input: {
  receivedAt: Date;
  dueDate: string | null;
  // The bid read carried from the homepage, when there was one.
  readItems: { key: string; label: string; page: number }[];
  missingProfile: CompletenessField[];
}): BidReceipt {
  const { receivedAt } = input;
  const aimAt = new Date(receivedAt.getTime() + AIM_HOURS * 60 * 60 * 1000);

  let daysLeft: number | null = null;
  let tight = false;
  let pastDue = false;
  if (input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    const due = localDay(input.dueDate);
    daysLeft = Math.round((due.getTime() - startOfDay(receivedAt).getTime()) / DAY_MS);
    pastDue = daysLeft < 0;
    tight = !pastDue && due.getTime() <= startOfDay(aimAt).getTime();
  }

  const yours = input.readItems.filter((item) => ownerFor(item).who === "you");
  // Every insurance minimum is the same job (send the certificates), so it's
  // one task listing each, not a row per policy.
  const insurance = yours.filter((item) => item.key.startsWith("ins:"));
  const tasks: ReceiptTask[] = [];
  for (const item of yours) {
    if (item.key.startsWith("ins:")) {
      if (item !== insurance[0]) continue;
      tasks.push({
        key: "read:insurance",
        text: insurance.length === 1 ? "Send us your insurance certificate" : "Send us your insurance certificates",
        detail: insurance.map((i) => `${i.label} · p. ${i.page}`).join("; "),
        href: null,
      });
      continue;
    }
    tasks.push({ key: `read:${item.key}`, text: ownerFor(item).task, detail: `${item.label} · p. ${item.page}`, href: null });
  }

  // A bid that asks for insurance certificates already puts that on the list.
  const asksForInsurance = insurance.length > 0;
  for (const field of input.missingProfile) {
    if (asksForInsurance && (field.key === "insurance" || field.key === "workers_comp")) continue;
    const task = PROFILE_TASKS[field.key];
    if (task) tasks.push({ key: `profile:${field.key}`, text: task.text, detail: null, href: task.href });
  }

  return { receivedAt, aimAt, daysLeft, tight, pastDue, tasks };
}
