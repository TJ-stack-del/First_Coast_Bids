// The Pilot offer's wording, in one place: the pricing page, the homepage
// and the guide all read it, so the price line can't drift. Pilot is free
// for only the first 10 clients: flip PILOT_FREE_COHORT_OPEN to false once
// they've gone out, and redeploy (see the pricing page's history comment).
export const PILOT_FREE_COHORT_OPEN = true;
export const PILOT_COHORT_SIZE = 10;
export function pilotPriceLine(open = PILOT_FREE_COHORT_OPEN): string {
  return open ? `Free for the first ${PILOT_COHORT_SIZE} clients` : "Pricing confirmed with you directly";
}
export const PILOT_CTA = { label: "Start a pilot bid", href: "/intake?package=pilot" } as const;
