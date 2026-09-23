---
name: First Coast Bids
description: A compliance ledger for small trade contractors bidding on government work.
colors:
  ledger-navy: "#0C2D52"
  ledger-navy-on: "#FFFFFF"
  ledger-navy-container: "#D6E2F0"
  ledger-navy-on-container: "#071B33"
  ledger-navy-inverse: "#9DBFE6"
  verified-green: "#006C4A"
  verified-green-on: "#FFFFFF"
  verified-green-container: "#82F5C1"
  verified-green-on-container: "#00714E"
  muted-brass: "#8A6934"
  muted-brass-on: "#FFFFFF"
  gold-leaf: "#C19349"
  gold-leaf-on: "#2A1D14"
  flag-red: "#BA1A1A"
  flag-red-on: "#FFFFFF"
  flag-red-container: "#FFDAD6"
  flag-red-on-container: "#93000A"
  paper-white: "#F8F9FF"
  ledger-ink: "#0F172A"
  on-paper: "#0B1C30"
  on-ledger-ink: "#DAE2FD"
  manila: "#DBC2B0"
  manila-text: "#554336"
typography:
  display:
    fontFamily: "Chivo, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: "52px"
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Chivo, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Chivo, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "-0.005em"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.04em"
rounded:
  sm: "0.125rem"
  DEFAULT: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  margin-mobile: "16px"
  margin-desktop: "40px"
  gutter: "24px"
  section-gap: "64px"
  sm: "0.5rem"
  base: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.ledger-navy-container}"
    textColor: "{colors.ledger-navy-on-container}"
    rounded: "{rounded.DEFAULT}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.ledger-navy}"
    textColor: "{colors.ledger-navy-on}"
  badge-verified:
    backgroundColor: "{colors.verified-green-container}"
    textColor: "{colors.verified-green-on-container}"
    rounded: "{rounded.full}"
  badge-gold:
    backgroundColor: "{colors.gold-leaf}"
    textColor: "{colors.gold-leaf-on}"
    rounded: "{rounded.DEFAULT}"
---

# Design System: First Coast Bids

## Overview

**Creative North Star: "The Compliance Ledger"**

First Coast Bids turns dense government paperwork into a clean, verifiable record — and the design system looks like the thing it produces. Sections read as ledger rows: fixed label columns, hairline dividers, one continuous index rather than a shelf of floating cards. Navy is the ink, gold is what gets certified, green is what's been verified, red is what's been flagged. The system is confident and plain-spoken, built for a trade-business owner reading it between jobs, not a design-conscious buyer being sold an aesthetic.

Confirmed anti-reference: generic tech-startup SaaS. No glossy gradients, no floating illustration blobs, no "AI product" sheen. The brand voice (per PRODUCT.md) is grounded, plain-spoken, and unglamorous-on-purpose — the visual system holds to the same restraint. Density stays moderate: enough white space to read as calm and trustworthy, not so much that it reads as decorative or precious about it.

**Key Characteristics:**
- Ledger rows (hairline-divided lists), not card grids, for anything that's fundamentally a list
- One accent color family (navy) does almost all the work; gold and green are reserved for specific, narrow meanings
- Flat at rest; real elevation (shadow) is reserved for things that are genuinely floating above the page (modals, dropdowns), never used to decorate an inline section
- Chivo for anything that announces something (headlines, titles); Hanken Grotesk for anything that explains something (body copy); JetBrains Mono for anything that's a number, a status, or a label

## Marketing theme: "Braun + Press" (public site only)

Since 2026-09-22 the public marketing pages (everything under `app/(marketing)/`: home, pricing, FAQ, gallery, blog, quiz, contact, privacy, terms) use a second, scoped theme. The dashboard, intake and admin still use the Compliance Ledger system described in the rest of this file, unchanged, until they get their own design pass.

- **Where it lives:** `.theme-press` in `app/globals.css` remaps the same color tokens inside `app/(marketing)/layout.tsx`'s wrapper, and that layout loads Newsreader and Archivo through `next/font`. Nothing outside the wrapper is affected. The landing page's own layout is `components/landing/landing.module.css`.
- **Direction:** Dieter Rams / Braun structure (spec-sheet call-outs, spec-table pricing, hairline rules, quick mechanical motion) with Stripe Press warmth (bone paper, serif headings, one real shadow under the sample sheet, the navy cloth packet with a gold foil title). The approved drafts, decisions and critique history are in `design-drafts/2026-09-22-landing-directions/README.md`.
- **Color:** bone paper `#F0EBDD`, raised panel `#FBF8F0`, ink `#1B1A17`, secondary text `#5E5848`, hairline `#CDC2A8`. Navy `#0C2D52` is the one strong color, and primary buttons are solid navy. Gold `#C19349` appears only as the packet's foil (and in the logo). Green and red are for status only.
- **Type:** Newsreader for headings, at regular weight, with the second clause in italic navy ("You run the crew. *We handle the paperwork.*"). Archivo for all running text and UI labels. JetBrains Mono only for real figures: prices, page numbers, solicitation numbers. The logo wordmark (`[data-wordmark]`) keeps Chivo in every theme.
- **Motion:** no scroll reveals. Hover and focus color changes of 80–150ms, plus the packet's page edges lifting on hover, all disabled under reduced motion.

## Colors

The palette reads as ink-on-paper with two narrow, specific accents: gold for what's certified/premium, green for what's been verified. It is not a colorful system — restraint is the point.

### Primary
- **Ledger Navy** (#0C2D52): The brand's one real color. Every primary action (the main CTA button), every active nav state, every headline accent. Carries the weight of the whole identity — this is the color a returning user should recognize the product by.
- **Pale Ledger Blue** (#D6E2F0, container role): The tint fill behind a highlighted item (the recommended pricing tier, a primary button's resting fill) — never the CTA's own hover state, which goes to full Ledger Navy instead.
- **Faded Ledger Blue** (#9DBFE6, inverse role): Navy's stand-in on dark surfaces where flat navy itself would disappear into the background — dark-mode primary text/icons and buttons use this instead.

### Secondary
- **Verified Green** (#006C4A light / #4EDEA3 dark): Reserved exclusively for "verified / complete / done" states — a checkmark on a finished deliverable, a "Ready" badge, the Client Portal status dot. **Never used as a decorative or general-purpose accent color**, even though it would otherwise be an obvious second brand color. It survived the entire navy/gold rebrand untouched specifically because 36+ real usages across the admin inbox, matches panel, and deliverables pipeline depend on it meaning one specific thing.

### Tertiary
- **Muted Brass** (#8A6934): The on-surface-safe version of the brand's gold, used wherever gold needs to be actual body-weight text or a small icon. Deliberately darkened from the true brand gold specifically because the true gold fails WCAG's 4.5:1 body-text floor (2.79:1 on white) — this is a contrast-driven color, not an aesthetic choice.
- **Gold Leaf** (#C19349, container role): The true, bright brand gold — used only as a fill (a badge background, the tertiary-container role), never as text color on its own. This is the color from the wordmark itself and the "Bids" half of the logotype.

### Neutral
- **Paper White** (#F8F9FF light) / **Ledger Ink** (#0F172A dark): The base surface. A very faint cool-blue tint, not a stark pure white/black — reads as "paper," not "screen."
- **On Paper** (#0B1C30) / **On Ledger Ink** (#DAE2FD): Primary text color in each theme.
- **Manila** (#DBC2B0 outline-variant / #554336 on-surface-variant, warm brownish-neutral family): The secondary-text and hairline-divider color — deliberately warm rather than a cool gray, evoking a manila folder against the cool navy/gold primary palette. This is the color every ledger-row divider and every piece of secondary/caption text actually is.
- **Flag Red** (#BA1A1A): Errors and explicit warnings only (a flagged compliance issue, a form validation error) — never used for anything else, so its rarity keeps its meaning sharp.

### Named Rules
**The One Accent Rule.** Navy does the work of "brand." Gold and green are never used as a second/third general-purpose accent — each has exactly one meaning (certified/premium; verified/complete) and appears only in that context.

**The No-Green-Drift Rule.** Verified Green is a status color, not a brand color, even though it's used constantly. If a design decision would add a fourth meaning to green, it's the wrong color for that decision.

## Typography

**Display/Headline Font:** Chivo (with sans-serif fallback)
**Body Font:** Hanken Grotesk (with sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** Chivo is heavy and geometric where the system needs to announce something (a headline, a page title); Hanken Grotesk is a plain, humanist body face built for actually being read at length; JetBrains Mono turns anything numeric or state-like (a price, a status badge, a step number) into something that reads as data rather than prose.

### Hierarchy
- **Display** (800, 44px/52px, -0.03em): Hero headlines only, one per page.
- **Headline** (700, 32px/40px, -0.02em): Section headers.
- **Title** (600, 20px/28px, -0.01em): Card/row titles, sub-section headers.
- **Body** (400, 16px/24px, -0.005em): Primary reading copy, max ~65ch line length.
- **Label** (500, 12px/16px, uppercase tracking 0.04em): Badges, step numbers, tags, terms/fine-print. A functional-text readability floor of 11px is enforced sitewide (a 2026-09-16 fix raised a 10px token that was overlapping/truncating on mobile) — nothing renders smaller than that.

### Named Rules
**The Mono-Means-Data Rule.** JetBrains Mono is reserved for anything that behaves like a number or a state (prices, step counters, uppercase labels/badges). Prose never gets the mono treatment, and data/labels never get Hanken Grotesk.

## Layout

Content is contained (`max-w-7xl`-equivalent, ~1440px outer / ~1280px inner), with a fixed page margin (16px mobile, 40px desktop) and a standard content gutter (24px) between siblings. Section-to-section vertical rhythm uses a single large gap value (64px) — sections are clearly separated beats, not a continuous scroll of ambiguous density.

Responsive behavior collapses multi-column ledger rows to a single stacked column below the `sm`/`md` breakpoint; dividers rotate from vertical (`divide-x`, desktop) to horizontal (`divide-y`, mobile) rather than disappearing, so the ledger-row identity survives the breakpoint instead of becoming a generic stacked list.

## Elevation & Depth

Hybrid, and the split is deliberate: **flat by default, shadowed only for things that are genuinely floating.** In-page content sections never use `box-shadow` for hierarchy — hairline borders and dividers (`border-outline-variant`, `divide-outline-variant`) do that work instead. Real elevation (`shadow-sm` through `shadow-2xl`) is reserved for actual overlays: modals, dropdown panels, the login/auth cards sitting on a page background. A hairline-divided ledger row is never given a shadow to make it feel more like a card — that would contradict the entire "ledger, not card grid" identity.

### Shadow Vocabulary
- **Overlay** (`shadow-lg` / `shadow-xl`): Modals, the login/auth panel, any element genuinely lifted above the page surface.
- **Focus ring** (`shadow-[0_0_0_2px_rgb(var(--color-primary))]`): A solid-color ring substitute used at least once (the lifecycle stepper's active step) instead of a soft shadow, keeping the "flat, ruled" character even where something needs to stand out.

### Named Rules
**The Flat-Ledger Rule.** Content sections get hairlines, not shadows. Shadows are reserved for things that are actually stacked above the page (modals, dropdowns) — never used to decorate an inline row or card.

## Shapes

A small, consistent radius scale, mostly on the tighter end: `sm` (2px), default (4px), `md` (6px), `lg` (8px), `xl` (12px, the most common — used for cards, panels, and cards-adjacent containers), and `full` (true pill/circle, used for badges, avatar placeholders, and status pills). There is no large "very rounded" tile radius anywhere in the system — the ledger metaphor calls for crisp rectangles and hairlines, not soft blob shapes.

## Components

### Buttons
- **Shape:** Default radius (4px) on the two primary CTA buttons seen sitewide; `rounded-lg` (8px) on the pricing-tier CTAs.
- **Primary:** `bg-primary-container` / `text-on-primary-container` at rest (Pale Ledger Blue fill, dark navy text) — deliberately a step down from the full-strength brand color at rest.
- **Hover / Focus:** `hover:opacity-90` plus a small physical lift (`hover:-translate-y-0.5`) and a press-down on click (`active:scale-[0.97]`) — tactile, not glowing. Focus state is a solid 2px outline ring in the primary color, not a soft glow.
- **Secondary / Ghost:** An outlined button (`border-outline-variant`) with a plain background-tint hover (`hover:bg-surface-container-low`) — no fill at rest.

### Badges / Pills
- **Style:** `rounded-full`, small uppercase mono label text, background is always a `-container` token (never the full-strength color) with the matching `on-*-container` text.
- **Semantic lock:** A badge's color is never chosen for taste — green means verified/complete, gold means certified/premium, red means flagged, navy-container means neutral/informational. Choosing a badge color is choosing its meaning.

### Ledger Rows (signature component)
The system's actual signature pattern, used for the Trades list, the Pricing tiers, and the homepage's three-item benefits row: a `flex flex-col divide-y divide-outline-variant` (or `divide-x` on desktop for tier comparisons) list with no per-item background, border-radius, or shadow — items are visually one continuous unit, separated only by a 1px hairline. A fixed label column (icon + short title) sits alongside a flexible description column. This replaces what a less disciplined system would build as a 3-card grid — see Do's and Don'ts.

### Cards / Containers
- **Corner Style:** `rounded-xl` (12px) is the standard for anything that IS a genuine card (a modal, an auth panel) — reserved for surfaces that are truly separate from the page, not used for in-page list items (see Ledger Rows above).
- **Background:** `surface-container-lowest` (light) / needs the `dark:bg-surface-container-low` override (a known, documented ramp-ordering quirk in dark mode — see globals.css).
- **Shadow Strategy:** `shadow-xl` for a true modal/overlay card; no shadow for an in-page card.
- **Border:** `border-outline-variant` on cards that sit directly on the page background (not floating), to give them an edge without needing a shadow.

### Inputs / Fields
- Standard Tailwind Forms-plugin base, label positioned above the input, helper/error text below.

### Navigation
- Fixed nav-logo height (48px, one token, `--nav-logo-height`, shared across every nav instance after it was previously drifting to three different sizes per page). Active link state uses the primary color; inactive links use the neutral on-surface-variant (Manila) tone.

## Do's and Don'ts

### Do:
- **Do** use a hairline-divided ledger row (`divide-y`/`divide-x` + `border-outline-variant`) for any list of 3+ comparable items, instead of a card grid.
- **Do** keep Verified Green scoped to verification/completion states only, even when a general-purpose second accent color would be convenient.
- **Do** use Muted Brass (#8A6934), not true Gold Leaf (#C19349), for any gold text or icon smaller than 18px/large-text size — true gold fails body-text contrast.
- **Do** reserve real `box-shadow` elevation for things genuinely floating above the page (modals, dropdowns); use borders/dividers for everything else.

### Don't:
- **Don't** build a 3-equal-column card grid for a short list of comparable items — the Ledger Row pattern already owns that job on this project, and a card grid reads as a second, inconsistent visual language on the same page (this was an actual bug, fixed 2026-09-19, on the homepage's benefits row).
- **Don't** add a fourth meaning to Verified Green, or a second use for Flag Red. Their rarity is what makes them legible as status, not decoration.
- **Don't** use a shadow to make an in-page ledger row or section "pop" — that contradicts the Flat-Ledger Rule and reintroduces the card-grid look the system deliberately avoids.
- **Don't** reach for glossy gradients, floating illustration blobs, or generic "AI product" visual tells — the confirmed anti-reference for this system is generic tech-startup SaaS, not this product's own domain (paperwork, compliance, government contracting).
