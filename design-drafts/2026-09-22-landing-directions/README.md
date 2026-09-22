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
  - the packet object under the hero: navy cloth cover, gold foil title, caption "Three documents, bound as one packet, ready for your signature."
- **Type:** Newsreader (headings, call-outs), Archivo 400/500 (UI, tables), JetBrains Mono (numbers).
- **Colour:** navy `#0C2D52` is the one strong colour. Gold `#C19349` appears as the packet foil and the Pilot signal dot. Green and red are for status only.

## Open decisions

- The plan buttons say "Start a pilot bid", "Start a one-off bid" and "Ask about a retainer" instead of three identical "Get started" buttons. This copy change hasn't been approved yet.
- Gold appears twice (foil and the Pilot dot). Drop the dot if gold should appear once.
- The packet cover is drawn. It needs a real photo of a printed sample packet.
- Not drafted yet: the "Now accepting founding clients" row, trade descriptions, FAQ teaser, footer.
- Next step: build into the real site on a branch (tokens in `app/globals.css` / `tailwind.config.ts`, then DESIGN.md).

## The other directions, for reference

- `a-braun.html`: A, pure Braun / Dieter Rams (paper-grey, all sans).
  https://claude.ai/artifact/25PiapixQrBvbkgSZJXxdH
- `b-vignelli.html`: B, Vignelli / Swiss grid (white, Public Sans, navy signage bars).
  https://claude.ai/artifact/U1sgpjqi8a4FaRafcK342e
- `c-stripe-press.html`: C, Stripe Press (bone paper, serif throughout, packet as hero).
  https://claude.ai/artifact/94WdsYLAas6C2vaG7fT84c
