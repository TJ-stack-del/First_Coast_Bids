import type { Answers, NextStep } from "./types.ts";

// "Where do I start?" (docs/superpowers/specs/2026-09-26-newcomer-guide-design.md):
// one to three next steps from four yes/no answers. A bid in hand always
// comes first -- that's the moment we can help most.
export function nextSteps(a: Answers): NextStep[] {
  const out: NextStep[] = [];
  const add = (target: string, why: string) => {
    if (!out.some((s) => s.target === target) && out.length < 3) out.push({ target, why });
  };
  if (a.bidInHand) add("pilot", "You have a bid in hand: send it to us and we'll prepare it with you.");
  if (!a.licensed) add("getting-registered", "Have your business license and insurance in order first: agencies ask for both.");
  if (!a.registered) add("getting-registered", "Many local bids can only be seen, and every bid can only be submitted, once you're registered as a vendor.");
  if (!a.bidBefore) {
    add("your-first-bid", "What happens from finding a bid to hearing back, step by step.");
    if (!a.bidInHand) add("what-is-an-rfp", "The words you'll meet in every bid, in plain English.");
  }
  if (a.registered && a.licensed && !a.bidInHand) {
    add("where-bids-are-posted", "Where agencies around Jacksonville post the work you do.");
    add("pilot", "When you find one, start your first bid with us.");
  }
  if (out.length === 0) add("where-bids-are-posted", "Where agencies around Jacksonville post the work you do.");
  return out;
}
