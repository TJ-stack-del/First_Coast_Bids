// "Which plan fits you?" on the pricing page: the published starting prices
// (One-off from $399 a bid, Retainer from $649 a month for up to 2 bids and
// bids found for you, Pilot on us while the free cohort is open), turned into
// a recommendation from how often the visitor expects to bid. Plain
// arithmetic on numbers already on the page; it compares starting prices and
// says so, since the exact price is confirmed with each client.

export const ONE_OFF = 399;
export const RETAINER = 649;
export const RETAINER_BIDS = 2;

export type Plan = "pilot" | "one_off" | "retainer" | "talk";

export type Fit = {
  plan: Plan;
  title: string;
  why: string;
  // Starting-price math for a typical month, shown so the pick is checkable.
  oneOffMonthly: number;
  retainerMonthly: number | null; // null when the retainer doesn't cover it
};

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function findPlan(input: {
  bidsPerMonth: number; // 0.25 = one every few months
  wantsBidsFound: boolean;
  firstBid: boolean; // hasn't used us before
  pilotOpen: boolean;
}): Fit {
  const { bidsPerMonth, wantsBidsFound, firstBid, pilotOpen } = input;
  const oneOffMonthly = Math.round(bidsPerMonth * ONE_OFF);
  const retainerMonthly = bidsPerMonth <= RETAINER_BIDS ? RETAINER : null;

  if (firstBid && pilotOpen) {
    return {
      plan: "pilot",
      title: "Start with a Pilot bid",
      why: "Your first bid is on us while our free spots last. See the whole process on a real bid, then pick a plan, or don't.",
      oneOffMonthly,
      retainerMonthly,
    };
  }
  if (bidsPerMonth > RETAINER_BIDS) {
    return {
      plan: "talk",
      title: "Talk to us about a bigger retainer",
      why: `The Retainer covers up to ${RETAINER_BIDS} full bids a month. At ${bidsPerMonth} a month we'll set a price with you before anything starts.`,
      oneOffMonthly,
      retainerMonthly: null,
    };
  }
  if (oneOffMonthly > RETAINER) {
    return {
      plan: "retainer",
      title: "Retainer",
      why: `${bidsPerMonth} One-off bids would start at ${money(oneOffMonthly)} a month; the Retainer starts at ${money(RETAINER)} and we find bids that fit your trade.`,
      oneOffMonthly,
      retainerMonthly,
    };
  }
  if (wantsBidsFound) {
    return {
      plan: "retainer",
      title: "Retainer",
      why: `One-off would cost less at this pace (${money(oneOffMonthly)} a month), but only the Retainer includes us finding bids that fit your trade.`,
      oneOffMonthly,
      retainerMonthly,
    };
  }
  return {
    plan: "one_off",
    title: "One-off, bid by bid",
    why: `At this pace One-off starts at ${money(oneOffMonthly)} a month against ${money(RETAINER)} for the Retainer. Pay for each bid when you have one.`,
    oneOffMonthly,
    retainerMonthly,
  };
}

// What doing the paperwork yourself costs in a month, from the visitor's own
// hours and rate. Null until they've given both; never a default figure.
export function yourTime(bidsPerMonth: number, hoursPerBid: number | null, hourlyValue: number | null): number | null {
  if (!hoursPerBid || !hourlyValue || hoursPerBid <= 0 || hourlyValue <= 0) return null;
  return Math.round(bidsPerMonth * hoursPerBid * hourlyValue);
}
