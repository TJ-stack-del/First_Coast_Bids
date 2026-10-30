import type { ReadItem } from "./read.ts";

// Who handles each line of a bid read if the visitor hands the bid to us:
// the same split as the team's checklist (lib/checklist/types.ts
// defaultOwner): the client signs, attends, arranges and sends proof of
// what only they can; we track, check and prepare the rest. Stated as the
// service's real division of work, never as a promise about the outcome.

export type Owner = "you" | "we";
// short: the task as a phrase for a summary line ("We: track the deadline,
// fill in 4 forms for you to sign").
export type Ownership = { who: Owner; task: string; short: string };

export function ownerFor(item: Pick<ReadItem, "key">): Ownership {
  const k = item.key;
  if (k === "deal:deadline") return { who: "we", task: "Track it and plan the work back from it", short: "track the deadline" };
  if (k === "deal:site-visit") return { who: "you", task: "Attend and sign in", short: "attend the site visit" };
  if (k === "ref:bid-bond" || k === "ref:performance-payment-bond") return { who: "you", task: "Arrange it with your surety", short: "get the bonds" };
  if (k === "ref:cui-nist-800-171-cmmc") return { who: "we", task: "Flag what it takes before you spend time bidding", short: "flag the security rules" };
  if (k === "ref:background-check") return { who: "you", task: "Screen the staff who'll be on site", short: "screen your staff" };
  if (k === "ref:va-section-508-checklist") return { who: "we", task: "Prepare the checklist with you", short: "prepare the accessibility checklist" };
  if (k.startsWith("ins:")) return { who: "you", task: "Send us your certificate", short: "send insurance certificates" };
  if (k.startsWith("wd:") || k === "money:wage") return { who: "we", task: "Check your labor rates against it", short: "check your wage rates" };
  if (k === "sam:registration") return { who: "we", task: "Check your registration is active", short: "check your SAM registration" };
  if (k.startsWith("amendment:") || k.startsWith("addendum:")) return { who: "we", task: "Fill it in for you to sign", short: "fill in the forms for you to sign" };
  if (k.startsWith("sworn:") || k.startsWith("form:") || k.startsWith("far:")) return { who: "we", task: "Fill it in for you to sign", short: "fill in the forms for you to sign" };
  return { who: "we", task: "Prepare it in the package", short: "prepare it in the package" };
}

// "track the deadline, fill in the forms for you to sign and check your
// wage rates": each phrase once, in the order the items appear.
export function summarise(items: Pick<ReadItem, "key">[], who: Owner): string {
  const phrases = [...new Set(items.map(ownerFor).filter((o) => o.who === who).map((o) => o.short))];
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(phrases);
}
