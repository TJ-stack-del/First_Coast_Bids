# Client area redesign: the dashboard, profile and compliance vault in the site's look, "What needs you" first

Date: 2026-09-26. Status: design approved in chat; this spec is awaiting review.

## Why

The 2026-09-26 whole-site audit found two looks in one product.
- **The public site and sign-up path** (since 2026-09-22/23) use the
  "Braun + Press" theme: bone paper, Newsreader headings, Archivo text,
  hairline ledgers and navy actions (DESIGN.md, "Marketing theme").
- **The client area** (`/dashboard`, `/dashboard/profile`,
  `/dashboard/compliance`) still uses the older "Compliance Ledger" look:
  cool white, heavy Chivo headings, mono labels and rounded cards.

A client who signs up on warm paper logs into what feels like a different
product.

**The dashboard is also too long on a phone.** With 13 bids it is about
11,000 px tall at 390 px wide, because every bid renders as a full card.

**Constraints:**
- The client is a busy trade business owner checking in between jobs
  (PRODUCT.md). The dashboard's job is to show what needs them, then
  where everything stands.
- Operate mode: scanability and consistency come before expression.
- Nothing is invented. Every "needs you" signal must come from data the app
  already has.
- No behaviour, data, email or copy changes beyond headings and the new
  section labels.

## Decisions made with the user

1. **Dashboard order: "What needs you" first**, then everything else as
   short rows, opened one at a time.
2. **Scope:** the client area (dashboard, profile, compliance vault) gets
   the full restyle. The admin gets a separate, light pass later (matching
   fonts and colours only), not in this spec.

## Out of scope

- The admin area, and `AppShell`'s admin mode.
- New features: unread-message tracking, notifications, a per-bid page.
- Any change to what clients can do, what data is shown, or the emails they
  get.
- Changes to the public site.

## The look

The client area adopts the existing press theme:
- the `.theme-press` wrapper from `app/press-theme.ts`, as the intake, login
  and reset layouts use it;
- the shared styles in `components/marketing/press.module.css`, extended
  only where the client area needs something new.

What that means on screen:
- **Page heads:** left-aligned Newsreader page titles, with an Archivo lede.
- **Lists:** hairline ledgers (`s.ledger`, 2px top rule) instead of
  rounded, shadowed cards.
- **Forms:** sit on one raised sheet (`s.formSheet`), as intake does.
- **Actions:** navy primary buttons (`s.btn s.btnPrimary`), quiet
  secondary buttons (`s.btnQuiet`).
- **Status colours:** green only for done or verified, red only for
  problems (DESIGN.md's rules still hold).
- **Mono:** JetBrains Mono only for real figures: dates, solicitation
  numbers, money.

## Navigation (client role)

The client's shell becomes a slim top bar in the site's style.
- **Desktop:** the logo, then the text links **Your bids**, **Company
  profile** and **Compliance vault** (active link underlined in navy), then
  **Sign out**.
- **Phone:** the logo and **Sign out** in the top bar, plus a bottom tab
  bar with the same three destinations, restyled in the press palette with
  a 44px minimum tap height.
- **Code:** `AppShell` renders this for `role="client"` only. The admin
  shell is unchanged.

## The dashboard (`/dashboard`)

In order:

1. **Page head:**
   - title **Your bids**;
   - lede "Here's what needs you, and where everything else stands.";
   - a **Start a new bid** button to `/intake`, beside the title on
     desktop and under the lede on phone.
2. **Needs you:** a ledger of rows, one per task. It's derived from the
   dashboard's existing needs-action rule. Each row has the bid's agency
   (via `displayAgency`), the solicitation number, the due date and one
   button:

   | Condition (already computed today) | Button | Where it goes |
   |---|---|---|
   | Draft without its bid file (`draft`) | Add your bid file | Opens that bid's row with the existing `CompleteBidFile` form |
   | Checklist items not done or waived (`pendingCount > 0`) | Answer N items | Opens that bid's row at its checklist |
   | Stage `deliverables_ready` or `client_review` | Review your package | Opens that bid's row at its deliverables |

   - A bid with more than one task shows its most urgent one: the bid file,
     then open items, then the package review.
   - **Empty state:** "Nothing needs you right now. We'll email you when
     something does."
   - Messages are not a "needs you" signal: the app doesn't track
     read/unread messages, and inventing it is out of scope.
3. **Everything else:** a ledger of one-line rows for the remaining bids,
   including those in progress with us and closed ones. Each row has:
   - the agency;
   - the solicitation number;
   - where it stands in plain words (from the existing stage labels, e.g.
     "In review with us");
   - the due date;
   - an open/close control.

   **Opening a row** shows that bid's existing details beneath it: the
   progress steps, the checklist, the deliverables (preview and download),
   the wage law check, messages and the site visit warning. Only one row is
   open at a time. The existing All / Needs action / Completed filter is
   kept, restyled.
4. **Your file:** one line: "Company profile N% complete · Credentials N of
   M verified", linking to the profile and the compliance vault. It
   replaces today's two side panels, with the same numbers as today.
5. **Bid process notices:** the existing reminders ledger, restyled, at the
   bottom.

**Phone length target:** with the 13-bid test client, the dashboard is
under 3,000 px tall at 390 px (today about 11,000).

**Rows:** open/close uses a real `<button aria-expanded>` controlling the
region, with keyboard support. The "Needs you" buttons open the matching
row and move focus to it.

## Company profile (`/dashboard/profile`) and Compliance vault (`/dashboard/compliance`)

- **Profile:** the same page head pattern. Each section (Company info,
  past performance, documents) is a hairline-separated section with an h2,
  and the form fields sit on raised sheets. The fields and behaviour are
  unchanged, including the label links added on 2026-09-26.
- **Compliance vault:** the same treatment. Certifications, insurance and
  bonding rows become ledger rows. The "Verified" badge stays green;
  "Remove" and "Check federal records" become quiet buttons with 44px tap
  height on phone.

## Accessibility and quality floor

- axe on all three pages, desktop and phone: no violations. The logo's
  contrast exemption stays.
- Phone: no horizontal scroll, and tap targets at least 44px tall.
- Headings in order: one h1 per page.
- Focus rings visible on every control, in the press palette.

## Testing

**Unit** (`node --test`): a pure `clientTasks(submissions, checklistBySubmission)`
that returns the "Needs you" rows. Tests cover:
- a draft;
- pending checklist items, with the count in the label;
- deliverables ready;
- a bid with several tasks, where only the most urgent shows;
- none, giving the empty state.

It must match today's `needsAction` rule exactly for which bids appear.

**Browser check on dev**, test client Sunrise Janitorial (13 bids), desktop
1280 and phone 390:
- the three pages render in the press look, with screenshots;
- the dashboard's phone height is under 3,000 px, measured;
- **Needs you:** each kind of task appears, and its button opens the right
  row;
- **Everything else:** rows open one at a time;
- **The real actions still work:** add a bid file to a draft, update a
  checklist item, open a package preview, send a message, save the
  profile, and remove and add a certification (on test data only);
- axe clean; no horizontal scroll; no console errors.

## Rollout

- Code only: no database changes. It goes live with a normal merge and push.
- DESIGN.md's "Marketing theme" section is updated to say the client area
  uses it too, and the "until they get their own design pass" line is
  removed.
