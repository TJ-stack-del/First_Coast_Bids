import type { Answers } from "./types.ts";

// "Where do I start?" as a road rather than a list (round 13): the six
// stations between a trade business and its first submitted government bid,
// each marked done / next / later from the four yes-or-no answers. Plain
// code; the stations follow the guide's own order (licensed and insured,
// registered, a bid in hand, understood, prepared, submitted).

export type StationStatus = "done" | "next" | "later";
export type Station = {
  id: "licensed" | "registered" | "found" | "understood" | "prepared" | "submitted";
  title: string;
  status: StationStatus;
  why: string;
  action: { label: string; href: string } | null;
};

export function roadmap(a: Answers): { headline: string; stations: Station[] } {
  const done: Record<Station["id"], boolean> = {
    licensed: a.licensed,
    registered: a.registered,
    found: a.bidInHand,
    understood: false,
    prepared: false,
    submitted: false,
  };

  const base: Omit<Station, "status">[] = [
    {
      id: "licensed",
      title: "Business license and insurance",
      why: a.licensed
        ? "You have them. Agencies ask for both with nearly every bid."
        : "Agencies ask for a business license and proof of insurance with nearly every bid. Get these in order first.",
      action: { label: "What you need, and where to get it", href: "/guide/getting-registered" },
    },
    {
      id: "registered",
      title: "Registered as a vendor",
      why: a.registered
        ? "You're registered, so you can see and submit bids."
        : a.bidInHand
          ? "Do this before anything else on your bid: you can't submit without it, and some registrations take days."
          : "Many local bids can only be seen, and every bid can only be submitted, once you're registered.",
      action: { label: "How to register (SAM.gov and local portals)", href: "/guide/getting-registered" },
    },
    {
      id: "found",
      title: "A bid you can do",
      why: a.bidInHand ? "You have one in hand." : "Find a bid for the work you already do, close to home.",
      action: { label: "Where agencies around Jacksonville post bids", href: "/guide/where-bids-are-posted" },
    },
    {
      id: "understood",
      title: "Know what it asks for",
      why: "The deadline, any mandatory site visit, bonds, insurance and forms, each with its page. Takes seconds, free.",
      action: { label: "Read my bid free", href: "/#read" },
    },
    {
      id: "prepared",
      title: "Your package prepared",
      why: "Capability statement, compliance matrix and technical narrative, written for this agency. That's our part.",
      action: { label: "Start a pilot bid", href: "/intake?package=pilot" },
    },
    {
      id: "submitted",
      title: "You submit it",
      why: a.bidBefore
        ? "Through your own portal account, before the deadline, as you've done before."
        : "Through your own portal account, before the deadline. What happens after, step by step.",
      action: a.bidBefore ? null : { label: "Your first bid, start to finish", href: "/guide/your-first-bid" },
    },
  ];

  let nextFound = false;
  const stations: Station[] = base.map((st) => {
    if (done[st.id]) return { ...st, status: "done" as const };
    if (!nextFound) {
      nextFound = true;
      return { ...st, status: "next" as const };
    }
    return { ...st, status: "later" as const };
  });

  const doneCount = stations.filter((s) => s.status === "done").length;
  const headline =
    doneCount === 0
      ? "Here's your road to a first bid."
      : `You're ${doneCount} of ${stations.length} steps along.`;
  return { headline, stations };
}
