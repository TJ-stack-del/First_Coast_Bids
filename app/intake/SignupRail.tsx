import { PILOT_FREE_COHORT_OPEN, PILOT_COHORT_SIZE } from "@/lib/pilot-offer";

// The sign-up page's side panel: what they're getting, what it costs and
// what happens next, kept in view while they fill in the form -- the
// questions people leave a form to go and check. Every line restates
// something the homepage and pricing page already promise; nothing new is
// claimed here.

const GET = ["Capability statement", "Compliance matrix", "Technical narrative"];

const NEXT = [
  { when: "Today", what: "You send the bid file. We start reading every page." },
  { when: "In about 48 hours", what: "Your package is ready to preview, free." },
  { when: "Before the deadline", what: "You review, sign and send it in yourself." },
];

// Price lines match the pricing page and homepage (One-off from $399,
// Retainer from $649/mo, Pilot from lib/pilot-offer.ts).
const PLAN = {
  pilot: {
    name: "Your pilot bid",
    price: PILOT_FREE_COHORT_OPEN ? "On us" : "Priced with you",
    terms: PILOT_FREE_COHORT_OPEN
      ? `Free for our first ${PILOT_COHORT_SIZE} clients. No card, no commitment after.`
      : "We confirm the price with you before any work starts. No card to begin.",
  },
  one_off: {
    name: "Your bid",
    price: "From $399",
    terms: "Starting price, confirmed with you before any work starts. No card to begin.",
  },
  retainer: {
    name: "Your retainer",
    price: "From $649/mo",
    terms: "Up to 2 full bids a month, and we send you bids that fit your trade. Confirmed with you first.",
  },
} as const;

export function SignupRail({ pkg }: { pkg: keyof typeof PLAN }) {
  const plan = PLAN[pkg];
  return (
    <aside className="lg:sticky lg:top-24 flex flex-col gap-5 rounded-2xl bg-[#0E1622] text-white p-6 md:p-8" aria-label={plan.name}>
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#C19349]">{plan.name}</p>
        <p className="mt-2 text-[34px] leading-none font-semibold" style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}>
          {plan.price}
        </p>
        <p className="mt-2 text-[15px] text-white/70">{plan.terms}</p>
      </div>

      <div className="border-t border-white/15 pt-5">
        <p className="text-[14px] font-semibold text-white/85">What you get back</p>
        <ul className="mt-3 flex flex-col gap-2 text-[15px]">
          {GET.map((doc) => (
            <li key={doc} className="flex gap-2">
              <span className="text-[#C19349] font-bold" aria-hidden="true">
                ✓
              </span>
              {doc}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-white/15 pt-5">
        <p className="text-[14px] font-semibold text-white/85">What happens next</p>
        <ol className="mt-3 flex flex-col gap-4">
          {NEXT.map((n, i) => (
            <li key={n.when} className="grid grid-cols-[24px_1fr] gap-3">
              <span className="w-6 h-6 rounded-full border border-white/40 text-[12px] font-bold flex items-center justify-center" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{n.when}</span>
                <span className="block text-[14px] text-white/70">{n.what}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <ul className="border-t border-white/15 pt-5 flex flex-col gap-2 text-[14px] text-white/75">
        <li>We never submit for you or ask for your portal login.</li>
        <li>Nothing made up: anything we don&apos;t know stays a visible blank.</li>
      </ul>
    </aside>
  );
}
