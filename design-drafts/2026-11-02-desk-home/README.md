# Desk homepage brief: First Coast Bids website

(Arrived as a loose `CLAUDE (1).md` next to the reference `index.html`;
moved here with it on 2026-11-02 when the page was ported, branch
`bold-19-desk-home`. The design rules below are summarised in `DESIGN.md`'s
"Homepage theme" section.)

Owner: Mike Coleman, Jacksonville, FL
Brand name: "First Coast Bids" (always three words, no punctuation between Coast and Bids)

## What this site is

A marketing site for First Coast Bids, a done-for-you government bid paperwork service for
small trade contractors (janitorial, HVAC, landscaping and similar) in Northeast Florida.
We prepare the bid packet; the contractor sets the price and signs. We never do the trade
work or go on site. Mike reviews every packet by hand.

Traffic comes from Mike's own outreach (calls, texts, emails). Visitors have already heard
the pitch. The page has to:
1. Show in seconds what we do (the paperwork) and the result (ready to sign).
2. Earn trust from a stranger: honest, plain language, a real person.
3. Make one next step easy: "Send me your next bid" / "Talk to Mike".

## The reference build

`index.html` in this folder is the approved design, built as a single self-contained page.
It is ported into the app as `app/(home)/page.tsx` and `components/marketing/desk/`
(`desk.module.css` carries the Hallmark stamp and tokens; the canvases are in `draw.ts`).
Keep the look, the copy and the behavior.

Page order:
1. Floating pill nav: mark + wordmark, links, "Talk to Mike".
2. Hero: night scene, lamp-lit wooden desk with five bid pages and an open manila folder.
   - Click a page: it lifts toward the viewer and shows who handles it.
   - "Hand it to us": pages slide into the folder, it closes and is stamped "Ready to sign".
   - Headline "Your bid, complete and in on time." + one line + "Send me your next bid".
2b. A big line of the packet's paperwork drifting left (added 2026-11-03; pauses on hover
   and focus, stands still and wraps with reduced motion).
3. Who does what: a two-tab switch ("We do" / "You do"), four rows each.
4. Where we work: a generated survey-style map of the First Coast (canvas, not a map tile)
   with five public buyers pinned: Nassau County, City of Jacksonville, Duval County Public
   Schools, Clay County, St. Johns County.
5. The price: orange band with ruled lines.
6. Talk to Mike: contact details.
7. Footer mast: large wordmark over links.

## Design rules (keep these on every change)

- Built with the Hallmark design skill (Nutlope/hallmark, theme "Furrow"). The CSS stamp at
  the top of `components/marketing/desk/desk.module.css` records the theme, shape and every waiver; keep it and update it.
- Every color and font comes from a token in the token block (`.home` in the ported module,
  since CSS modules can't use `:root`). No literal colors past the token block.
- No eyebrows (small all-caps labels above headings), no tracked capitals, no dot-joined
  text ("A · B · C"), no "01 02 03" step markers, no em dashes in copy.
- About 80 words max on any one screen. Hero = headline, one sentence, actions.
- One filled primary button style per page (the orange one).
- Motion: transform and opacity only, every animation has a `prefers-reduced-motion`
  fallback, and the page is complete without JavaScript.
- Reading level around 8th grade. Short, plain sentences.

## Hard rules

- Never invent numbers, testimonials, client names, logos or results. There are no clients
  yet. Anything shown as an example must be labeled as a sample.
- Two placeholders are still open and shown as dashed boxes: the **price** and the
  **phone or email**. Ask Mike for the real values; do not make them up.
- Do not change prices, guarantees or terms without asking Mike.
- Work on a branch, keep commits small, and summarize what changed.
- Check every change at phone width (about 375px) and desktop (1440px).

## Open items

1. ~~Port `index.html` into this repo's framework.~~ Done 2026-11-02.
2. Fill the two placeholders once Mike provides them.
3. ~~Phone layout of the desk scene: the open folder's right edge clips.~~ Done 2026-11-02:
   the scene now fits its full drawn width (desk plus open flap) and is nudged left to centre.
   Recomposed 2026-11-03: at 40rem and below the desk is a portrait 620 x 900 with the
   pile above the folder, bigger pages, and a picked-up page about 70% of the screen wide.
4. Optional: replace the code-drawn desk with a real or generated photo of a desk behind the
   same interactive pages, for more depth.
5. Optional: the logo mark is shown in ink and orange. Mike's chosen logo (Direction A,
   Benchmark mark + serif wordmark) uses navy and bronze; confirm which colors to keep.

## Hallmark in this repo

Install once in the project: `npx skills add nutlope/hallmark`
- `/hallmark audit <file>`: report what looks AI-generated, without editing.
- Run its checker before shipping: `node <skill-dir>/scripts/sloplint.mjs <file> --render`
  (it reads a single HTML file, so run it on the reference build or on the rendered page)
  and fix every FAIL.
