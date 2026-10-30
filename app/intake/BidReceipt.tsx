"use client";

import Link from "next/link";
import { BidProcessNotices } from "@/components/ui/BidProcessNotices";
import type { BidReceipt as Receipt } from "@/lib/dashboard/bid-receipt";

// The screen a client lands on after "Send it to us" (lib/dashboard/bid-receipt.ts):
// a receipt for the bid, what happens next, and the list of things only
// they can do while we write. Replaces "We've got it." plus a profile
// percentage, which told a client nothing about when or what next.

const dateTime = (d: Date) =>
  d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" });
};

export function BidReceipt({
  receipt,
  agency,
  solicitationNumber,
  dueDate,
  siteVisitWarning,
}: {
  receipt: Receipt;
  agency: string;
  solicitationNumber: string;
  dueDate: string;
  siteVisitWarning: string | null;
}) {
  const { daysLeft, tight, pastDue, tasks } = receipt;

  const steps = [
    { title: "We have your bid", when: dateTime(receipt.receivedAt), done: true },
    { title: "Our team reads every page", when: "Starting now", done: false },
    { title: "Your package is ready to preview, free", when: `We aim for ${dateTime(receipt.aimAt)}`, done: false },
    {
      title: "You review, sign and send it",
      when: dueDate && !pastDue ? `Before ${longDate(dueDate)}` : "Before the agency's deadline, once it's confirmed",
      done: false,
    },
  ];

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex w-2 h-2 rounded-full bg-secondary" />
          <span className="text-label-sm text-secondary uppercase tracking-wider font-semibold">Sent</span>
        </div>
        <h1 className="font-headline text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">
          Your bid is with us.
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Here&apos;s your receipt, what happens next, and what only you can do while we write.
        </p>
      </div>

      {/* The receipt: a slip, not a card -- heavy rule on top, mono figures. */}
      <section
        aria-label="Receipt"
        className="bg-surface-container-lowest border border-outline-variant border-t-2 border-t-on-surface p-space-base"
      >
        <dl className="flex flex-col divide-y divide-outline-variant">
          <Row label="Bid">
            <span className="font-semibold">{agency}</span>
            {solicitationNumber && <span className="font-mono text-on-surface-variant"> · {solicitationNumber}</span>}
          </Row>
          <Row label="Received">
            <span className="font-mono">{dateTime(receipt.receivedAt)}</span>
          </Row>
          <Row label="Ready to preview">
            <span className="font-mono">{dateTime(receipt.aimAt)}</span>
            <span className="text-on-surface-variant"> (our aim: 48 hours)</span>
          </Row>
          <Row label="Due to the agency">
            {dueDate ? (
              <>
                <span className="font-mono">{longDate(dueDate)}</span>
                {daysLeft !== null && !pastDue && (
                  <span className={tight ? "text-error font-semibold" : "text-on-surface-variant"}>
                    {" "}
                    · {daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `${daysLeft} days`}
                  </span>
                )}
              </>
            ) : (
              <span className="text-on-surface-variant">Not given yet. Add it from your bids page so we can plan around it.</span>
            )}
          </Row>
        </dl>
        {(tight || pastDue) && (
          <p className="mt-space-sm text-body-sm text-on-error-container bg-error-container/50 border border-error/30 rounded-sm px-3 py-2">
            {pastDue
              ? "The due date you gave has already passed. If that's a typo, fix it from your bids page; if the agency extended it, tell us the new date."
              : "That's tight: the bid is due before our usual 48 hours are up. We'll look at it first and tell you quickly if it can't be ready in time."}
          </p>
        )}
      </section>

      {siteVisitWarning && (
        <section className="border border-error/40 rounded p-space-base flex flex-col gap-1">
          <p className="text-label-md text-error font-bold uppercase tracking-wide">Mandatory site visit: read this</p>
          <p className="text-body-md text-on-surface">{siteVisitWarning}</p>
        </section>
      )}

      {/* What happens next: four steps, the first already done. */}
      <section aria-labelledby="next-heading" className="flex flex-col gap-space-sm">
        <h2 id="next-heading" className="font-headline text-[22px] text-on-surface">
          What happens next
        </h2>
        <ol className="flex flex-col border-t-2 border-on-surface">
          {steps.map((step, i) => (
            <li key={step.title} className="grid grid-cols-[28px_1fr] gap-x-3 py-3 border-b border-outline-variant">
              <span
                aria-hidden="true"
                className={`mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[12px] ${
                  step.done ? "bg-secondary border-secondary text-on-secondary" : "border-primary text-primary"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <div className="flex flex-col">
                <span className="text-body-md text-on-surface font-semibold">
                  {step.title}
                  {step.done && <span className="sr-only"> (done)</span>}
                </span>
                <span className="text-body-sm text-on-surface-variant font-mono">{step.when}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* While we write: what only the client can do, each with where to do it. */}
      <section aria-labelledby="yours-heading" className="flex flex-col gap-space-sm">
        <h2 id="yours-heading" className="font-headline text-[22px] text-on-surface">
          {tasks.length > 0 ? (
            <>
              While we write: <em className="text-primary">{tasks.length === 1 ? "one thing" : `${tasks.length} things`} only you can do</em>
            </>
          ) : (
            "While we write: nothing needed from you yet"
          )}
        </h2>
        {tasks.length > 0 ? (
          <ul className="flex flex-col border-t-2 border-on-surface">
            {tasks.map((task) => (
              <li key={task.key} className="flex items-start justify-between gap-space-sm py-3 border-b border-outline-variant">
                <div className="flex gap-3 min-w-0">
                  <span aria-hidden="true" className="mt-1 w-4 h-4 shrink-0 border border-on-surface-variant rounded-sm" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-body-md text-on-surface">{task.text}</span>
                    {task.detail && <span className="text-body-sm text-on-surface-variant break-words">{task.detail}</span>}
                  </div>
                </div>
                {task.href && (
                  <Link
                    href={task.href}
                    className="shrink-0 text-body-sm text-primary font-semibold underline underline-offset-2 hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Do it now
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-md text-on-surface-variant">
            Your profile has what we need. We&apos;ll message you if the bid asks for anything else.
          </p>
        )}
        {tasks.length > 0 && (
          <p className="text-body-sm text-on-surface-variant">
            None of these hold us up from starting. Doing them now means less back-and-forth before it goes out.
          </p>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="flex-1 min-h-[48px] px-6 bg-primary text-on-primary rounded font-semibold flex items-center justify-center hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Go to your bids
        </Link>
        <Link
          href="/dashboard/profile"
          className="flex-1 min-h-[48px] px-6 border border-outline-variant text-primary rounded font-semibold flex items-center justify-center hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Open your company profile
        </Link>
      </div>

      <details className="border-t border-outline-variant pt-space-sm">
        <summary className="cursor-pointer text-body-md text-on-surface font-semibold py-2">
          A few things to know about public bids
        </summary>
        <div className="pt-space-sm">
          <BidProcessNotices />
        </div>
      </details>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">{label}</dt>
      <dd className="text-body-md text-on-surface break-words">{children}</dd>
    </div>
  );
}
