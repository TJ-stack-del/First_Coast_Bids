import Link from "next/link";
import { PipelineArrow } from "./PipelineArrow";
import { Reveal } from "./Reveal";
import { InViewSequence } from "./InViewSequence";

// Same three deliverable types, same icons DeliverablesSection.tsx already
// uses for them on the client dashboard -- reusing the exact mapping here
// (rather than inventing a second one) is what makes this landing-page
// visual read as "the same product" instead of a disconnected marketing
// mockup. `gloss` is new -- an impeccable critique pass (2026-09-16) found
// "Compliance matrix"/"Technical narrative" sat completely unglossed on
// this page's very first proof section, real jargon for an audience of
// trade contractors who may never have prepared one -- a real irony given
// the same card's own footer says "No jargon." Every row gets a gloss now,
// including "Capability statement," so the list doesn't read unevenly.
const DELIVERABLES = [
  { label: "Capability statement", gloss: "Who you are, what you've done", icon: "badge" },
  { label: "Compliance matrix", gloss: "Proof you meet every requirement", icon: "fact_check" },
  { label: "Technical narrative", gloss: "How the work gets done", icon: "description" },
];

// Landing page "before/after" panel: messy RFP in, clean 3-file package
// out -- same idea as the "before/after" panel in the printed
// deliverable itself (see lib/pdf/deliverables-packet.ts), just rendered
// live. Deliberately illustrative-only text throughout (generic "Sample
// Solicitation," no named agency/client) -- same discipline the Gallery
// page's own "synthetic samples only" notice already applies. The 48h
// figure is the same real internal turnaround target
// app/api/daily-digest/route.ts already tracks.
//
// Third pass. First version was a fixed-dark "console" mockup with a
// perpetually-animating flying-document effect -- replaced because (1) its
// fixed dark palette never matched the rest of the page once this session
// brought everything else onto the site's own warm, theme-reactive tokens,
// and (2) the perpetual "live processing" animation oversold what the
// product actually is (a person on the team prepares each document by
// hand, not a live automated pipeline -- see the FAQ's "our team
// prepares..." copy this section's middle label still echoes). The second
// version fixed both of those but still read as amateurish: unicode
// glyphs (&#9679; &#10003;) standing in for a real icon system, decorative
// 01/02/03 numbering on three parallel (non-sequential) deliverables, and
// -- the biggest one -- abstract gray skeleton bars standing in for the
// "before" document's actual content. Real, specific (if still
// illustrative) text reads as premium; placeholder bars read as a
// wireframe nobody finished. This version keeps the same honest, static,
// theme-reactive comparison and the same real content, but replaces every
// one of those with the site's own real icon system (material-symbols,
// the same font every other page already uses) and real illustrative
// prose with the actual flagged phrases highlighted inline, rather than
// abstracted away.
export function TransformationPipeline() {
  return (
    <div className="relative w-full max-w-5xl px-4 sm:px-6 mt-8">
      {/* No card chrome here on purpose -- background, border, and shadow
          all removed at the founder's direction so this reads as part of
          the page itself (same bg-surface the rest of the hero sits on),
          not a bolted-on widget. Spacing alone separates it from the hero
          content above; no divider rule under the label either, for the
          same reason. */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <span className="flex items-center gap-2.5 text-title-sm font-bold text-primary">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            compare_arrows
          </span>
          One real RFP, turned into a ready-to-send packet
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold bg-secondary-container text-on-secondary-container">
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
            bolt
          </span>
          48-hour turnaround
        </span>
      </div>

      {/* The one authored motion moment on this page: once the comparison
          scrolls into view, a highlighter swipes across each flagged
          requirement on the RFP, then each deliverable's "Ready" stamp
          lands in order -- flagged, prepared, ready, in about 1.5s, once.
          Everything is fully visible without it (see InViewSequence). */}
      <InViewSequence className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-space-lg lg:gap-8 items-center">
        {/* Left: incoming RFP, rendered as an actual sheet of paper (sharp
            corners, a faint stack of pages behind it, a slight lie-on-the-
            desk tilt) rather than a bordered dashboard card -- a stamped
            tag instead of a boxed header row, real illustrative prose
            directly on the page with the flagged phrases highlighted like
            real highlighter marks, not boxed off in its own sub-card.
            Portrait, not landscape -- a narrow max-width column lets real
            content wrap the way an actual printed page does, rather than a
            wide dashboard-card silhouette. min-h + flex column (content
            block grows, the tag row anchors to the bottom) keeps the page
            reading as composed even if the real prose is short, instead of
            a strict aspect-ratio box risking dead space at the bottom. */}
        <Reveal className="relative mt-4 mx-auto w-full max-w-[300px]">
          <div
            className="absolute inset-0 rotate-[4deg] translate-x-2 translate-y-2 rounded-sm bg-surface-container-high border border-outline-variant"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 rotate-[2deg] translate-x-1 translate-y-1 rounded-sm bg-surface-container border border-outline-variant"
            aria-hidden="true"
          />
          <div className="relative flex flex-col aspect-[8.5/11] rotate-[-1.5deg] rounded-sm p-6 shadow-xl shadow-error/10 bg-surface border border-outline-variant">
            <span className="absolute -top-3 -left-3 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold tracking-wide -rotate-3 bg-error text-on-error shadow-md">
              <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                description
              </span>
              Incoming raw RFP
            </span>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-base font-bold text-primary">Sample Solicitation</h3>
              <span className="shrink-0 text-[10px] text-on-surface-variant">Sample PDF</span>
            </div>
            <div className="h-px w-full bg-outline-variant mb-3" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Contractor shall maintain commercial general liability coverage of not less than
              $2,000,000 per occurrence. All work performed under this agreement is subject to{" "}
              <mark className="highlight-swipe rounded-sm px-1 py-0.5 text-error font-semibold" style={{ "--seq": 0 } as React.CSSProperties}>
                prevailing wage determinations
              </mark>{" "}
              issued by the Department of Labor. Contractor shall furnish a{" "}
              <mark className="highlight-swipe rounded-sm px-1 py-0.5 text-primary font-semibold" style={{ "--seq": 1 } as React.CSSProperties}>
                100% performance and payment bond
              </mark>{" "}
              prior to notice to proceed. Bidders shall submit all forms listed in Section 4 no
              later than the closing date stated on the cover page.
            </p>
            <div className="flex items-center flex-wrap gap-2 text-[11px] font-bold mt-auto pt-4">
              <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-surface-container-high text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                  visibility
                </span>
                Needs review
              </span>
              <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-error/10 text-error">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                  flag
                </span>
                Prevailing wage flagged
              </span>
            </div>
          </div>
        </Reveal>

        {/* Middle: the transformation itself -- a plain, calm circle
            rather than a pulsing "live processing" indicator, labeled
            with the same "our team" language the FAQ already uses for
            this step, so the visual doesn't claim more automation than
            the product actually does. */}
        <Reveal variant="scale" delay={0.15} className="flex flex-col items-center justify-center gap-2.5 py-4 lg:py-0">
          <PipelineArrow />
          <span className="text-xs font-bold tracking-wide text-primary text-center">Prepared by our team</span>
        </Reveal>

        {/* Right: the finished package, same sheet-of-paper treatment,
            tilted the opposite way -- reads as "landed," not "in transit."
            Same portrait max-width + min-h + flex-column anchoring as the
            left page. */}
        <Reveal delay={0.3} className="relative mt-4 mx-auto w-full max-w-[300px]">
          <div
            className="absolute inset-0 rotate-[-3deg] translate-x-2 translate-y-2 rounded-sm bg-surface-container-high border border-outline-variant"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 rotate-[-1.5deg] translate-x-1 translate-y-1 rounded-sm bg-surface-container border border-outline-variant"
            aria-hidden="true"
          />
          <div className="relative flex flex-col aspect-[8.5/11] rotate-[1deg] rounded-sm p-6 shadow-xl shadow-secondary/10 bg-surface border border-outline-variant">
            <span className="absolute -top-3 -left-3 z-10 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold tracking-wide rotate-3 bg-secondary text-on-secondary shadow-md">
              <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                check_circle
              </span>
              Ready to submit
            </span>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-base font-bold text-primary">Tailored Bid Submission Package</h3>
              <span className="shrink-0 text-[10px] text-on-surface-variant">3 clean files</span>
            </div>
            <div className="h-px w-full bg-outline-variant mb-3" aria-hidden="true" />
            {/* Hairline-divided rows, not separately boxed ones -- matches
                the same manifest/ledger convention the Trades and Pricing
                sections use elsewhere on this page. */}
            <div className="flex flex-col divide-y divide-outline-variant">
              {DELIVERABLES.map((d, i) => (
                <div key={d.label} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                  <span className="flex items-start gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary text-[16px] mt-0.5" aria-hidden="true">
                      {d.icon}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="font-medium text-on-surface">{d.label}</span>
                      <span className="text-[10px] text-on-surface-variant">{d.gloss}</span>
                    </span>
                  </span>
                  <span
                    className="stamp-land inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-secondary-container text-on-secondary-container"
                    style={{ "--seq": i } as React.CSSProperties}
                  >
                    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                      check
                    </span>
                    Ready
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold mt-auto pt-4">
              <span className="inline-flex items-center gap-1 text-secondary">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  task_alt
                </span>
                You submit it
              </span>
              <span className="text-on-surface-variant">No jargon</span>
            </div>
          </div>
        </Reveal>
      </InViewSequence>

      {/* An impeccable critique pass (2026-09-16) flagged this as the
          homepage's strongest concrete proof point with nowhere for a
          visitor's now-peaked interest to go -- Gallery already exists for
          exactly this (real synthetic sample deliverables), just wasn't
          linked from the one place trust is highest. */}
      <Reveal delay={0.45} className="flex justify-center mt-8">
        <Link
          href="/gallery"
          className="inline-flex items-center gap-1.5 text-label-md text-primary font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
        >
          See a full sample packet
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_forward
          </span>
        </Link>
      </Reveal>
    </div>
  );
}
