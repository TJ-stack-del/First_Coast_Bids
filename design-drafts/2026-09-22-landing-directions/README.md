# Landing page visual directions (2026-09-22)

Standalone HTML drafts from a web-design-engineer direction pass. Open any
file directly in a browser. None of this is wired into the Next.js app yet.

## Chosen: Braun structure + Stripe Press warmth

`chosen-braun-structure-press-warmth.html`
Live copy: https://claude.ai/artifact/XxN25pUWJUFHNyRQ5KasWA (pinned in the claude.ai sidebar)

- **Structure (from A, Dieter Rams / Braun):**
  - centred hero, then a left-aligned grid
  - the sample compliance sheet on a workbench grid with numbered call-outs (hovering a number highlights its match)
  - "How it works" and pricing as spec tables
  - quick, mechanical motion
- **Warmth (from C, Stripe Press):**
  - bone paper `#F0EBDD`
  - Newsreader serif headings with the second half in italic navy
  - a soft real shadow under the document sheet only
  - the packet object: navy cloth cover with a gold foil title, the three documents fanned behind it, caption "Three documents, bound as one packet, ready for your signature." Since v0.4 it heads the right-hand column, above the numbered notes and beside the sample sheet.
- **Type:** Newsreader (headings, call-out titles, plan names, packet caption only), Archivo 400/500 (all running text, UI, tables), JetBrains Mono (real figures only: page numbers, prices, solicitation numbers).
- **Colour:** navy `#0C2D52` is the one strong colour. Gold `#C19349` appears once, as the packet foil (plus the logo). Pilot is marked by a navy top rule and a light navy tint. Green and red are for status only.

v0.3 (2026-09-22) applied a 7-point critique (scored 7.0/10 before the fixes): smaller flat packet showing three documents, one body typeface, monospace only for figures, gold used once, unbreakable placeholders, phone call-outs in a left margin, one-line sheet caption.

v0.4 applied a second, 5-point critique (scored 7.7/10 before the fixes): packet moved above the numbered notes to remove a dead block, "How it works" stacks on phones, table headers out of monospace, Pilot column on the lighter panel colour, "On us" matched to the other prices.

v0.5 applied a third, 4-point critique (7.9/10 before the fixes): on phones the packet comes before the sheet so the sheet and its notes stay together, the sheet stays in view beside the notes on desktop, plan names aligned, the 48-hour line out of monospace. Further critique rounds were judged to be past the point of useful returns; next is building it into the site.

## Decided

- **Plan buttons** (2026-09-22): "Start a pilot bid", "Start a one-off bid", "Ask about a retainer".
- **Gold**: only the packet foil (plus the logo).

v0.6 completed the page using the live site's own copy: a hero proof line, the founding-clients row, trades, a six-question FAQ, a final call to action, the real footer, and the real top navigation (the v0 nav had invented links).

## Open decisions

- Section headings such as "Every line traced to the RFP" and "Plain prices, confirmed with you before work starts" are new draft copy, not from the live site. They need approving or swapping before the build.
- The live pricing heading ("No subscriptions. We invoice after the work's done.") conflicts with the $649/mo Retainer. Flagged, not changed.
- The packet cover is drawn. It needs a real photo of a printed sample packet.
- Next step: build into the real site on a branch (tokens in `app/globals.css` / `tailwind.config.ts`, then DESIGN.md).

## The other directions, for reference

- `a-braun.html`: A, pure Braun / Dieter Rams (paper-grey, all sans).
  https://claude.ai/artifact/25PiapixQrBvbkgSZJXxdH
- `b-vignelli.html`: B, Vignelli / Swiss grid (white, Public Sans, navy signage bars).
  https://claude.ai/artifact/U1sgpjqi8a4FaRafcK342e
- `c-stripe-press.html`: C, Stripe Press (bone paper, serif throughout, packet as hero).
  https://claude.ai/artifact/94WdsYLAas6C2vaG7fT84c
