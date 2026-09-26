# Client Area Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the client area (dashboard, company profile, compliance vault)
into the public site's press look, with the dashboard reorganised as "Needs
you" first and every other bid as a one-line row opened one at a time.

**Architecture:**
- **Theme:** `app/dashboard/layout.tsx` wraps the client area in
  `pressThemeClass`, the same token remap and fonts the sign-up path uses.
  That recolours every token-based component.
- **Shell:** `AppShell` gets a client-only top-bar shell.
- **Tasks:** the "Needs you" tasks and plain-words standings come from a pure
  `lib/dashboard/client-tasks.ts`.
- **Dashboard:** a new client component, `BidLedger`, renders "Needs you"
  plus the filterable one-line rows and owns which row is open.
  `SubmissionCard` loses its own header and collapse, becoming the row's
  detail body.

**Tech Stack:** Next.js 15 App Router, React client components, Tailwind with
the app's token classes, `components/marketing/press.module.css`, and
`node --experimental-strip-types --test` for `lib/`.

**Spec:** `docs/superpowers/specs/2026-09-26-client-area-redesign-design.md`

## Global Constraints

- **Unchanged:** behaviour, data, emails, and copy apart from the new headings and section labels.
- **"Needs you" signals are only the existing ones:**
  - a draft without its bid file;
  - checklist items not done or waived;
  - stage `deliverables_ready` or `client_review`.
- Messages are not a "needs you" signal.
- **One task per bid,** most urgent first: the bid file, then open items, then the package review.
- **Empty "Needs you":** "Nothing needs you right now. We'll email you when something does."
- **Page head:** title "Your bids", lede "Here's what needs you, and where everything else stands.", and a **Start a new bid** button to `/intake`.
- **"Your file" line:** "Company profile N% complete · Credentials N of M verified", with the same numbers as today, plus the SAM status message when there is one.
- **Phone:** dashboard under 3,000 px tall at 390 px with the 13-bid test client; no horizontal scroll; tap targets at least 44 px tall.
- **Accessibility:** axe clean on all three pages at desktop and phone (the logo's contrast exemption stays); one h1 per page; headings in order.
- **Styling rules:**
  - status colours: green only for done/verified, red only for problems;
  - mono only for dates, solicitation numbers and money;
  - no kickers or eyebrows above headings (craft floor);
  - no shadows on in-page sections.
- **Admin untouched.**
- **Tests and checks:** `npm test` green; `npx tsc --noEmit -p .` clean.
- **Commit trailer:**
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VxaQ43PbCfwewBqBw5t8Dd
  ```

## Review Focus

1. **Warnings on collapsed rows:** a bid below the wage-law floor, or with a mandatory site visit concern, must stay visible when its row is collapsed. Today both are "always visible" by design (Task 3: the row summary shows a flag; browser check).
2. **The Retainer placeholder** (agency `RETAINER_PLACEHOLDER_AGENCY`) isn't a real bid. It must not produce "Add your bid file". It shows as its own "Retainer: watching for a good fit" row, and asks "Complete your profile" only while the profile is under 100% (Task 1 test).
3. **A client with no bids** still gets the "Start your first bid" page, restyled (Task 3 browser check).
4. **A "Needs you" button** opens its row, scrolls it into view and moves keyboard focus into it, even when the current filter would hide that row (Task 3: switch the filter to "All" first; browser check).
5. **Test bids** (`is_test`) keep their "Test" marker in the row (Task 3).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/dashboard/client-tasks.ts` (+ test, new) | `clientTasks()`, `standingLabel()` |
| `app/dashboard/layout.tsx` | Wrap in `pressThemeClass` |
| `components/ui/AppShell.tsx` | Client-only top-bar shell (desktop links, restyled phone tabs) |
| `app/dashboard/BidLedger.tsx` (new) | "Needs you" plus filterable one-line rows, one open at a time |
| `app/dashboard/SubmissionCard.tsx` | Becomes the row's detail body (no own header or collapse) |
| `app/dashboard/page.tsx` | New structure: page head, BidLedger, "Your file", notices |
| `app/dashboard/profile/page.tsx`, `app/dashboard/compliance/page.tsx` (+ their section components) | Cards become hairline sections; 44px phone taps |
| `DESIGN.md` | The press theme now covers the client area |

---

### Task 1: The dashboard's task and standing rules (pure)

**Files:**
- Create: `lib/dashboard/client-tasks.ts`, `lib/dashboard/client-tasks.test.ts`

**Interfaces:**
- Produces:
```ts
export type BidForTasks = { id: string; draft: boolean; stage: string; isRetainerPlaceholder: boolean; pendingCount: number };
export type ClientTask = { bidId: string; kind: "bid_file" | "items" | "review" | "profile"; label: string };
export function clientTasks(bids: BidForTasks[], profilePercent: number): ClientTask[];
export function standingLabel(b: { draft: boolean; stage: string; isRetainerPlaceholder: boolean }): string;
export function needsAction(b: BidForTasks): boolean; // today's rule, unchanged
```

- [ ] **Step 1: Failing tests** (`lib/dashboard/client-tasks.test.ts`):
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientTasks, standingLabel, needsAction } from "./client-tasks.ts";

const bid = (o = {}) => ({ id: "b", draft: false, stage: "in_review", isRetainerPlaceholder: false, pendingCount: 0, ...o });

test("each kind of task, with the count in the label", () => {
  assert.deepEqual(clientTasks([bid({ id: "d", draft: true, stage: "submitted" })], 100), [{ bidId: "d", kind: "bid_file", label: "Add your bid file" }]);
  assert.deepEqual(clientTasks([bid({ id: "c", pendingCount: 2 })], 100), [{ bidId: "c", kind: "items", label: "Answer 2 items" }]);
  assert.deepEqual(clientTasks([bid({ id: "c", pendingCount: 1 })], 100)[0].label, "Answer 1 item");
  assert.deepEqual(clientTasks([bid({ id: "r", stage: "deliverables_ready" })], 100), [{ bidId: "r", kind: "review", label: "Review your package" }]);
  assert.deepEqual(clientTasks([bid({ id: "r", stage: "client_review" })], 100)[0].kind, "review");
});

test("one task per bid, most urgent first: bid file, then items, then review", () => {
  assert.deepEqual(clientTasks([bid({ id: "x", stage: "deliverables_ready", pendingCount: 3 })], 100).map((t) => t.kind), ["items"]);
  assert.deepEqual(clientTasks([bid({ id: "x", draft: true, pendingCount: 3 })], 100).map((t) => t.kind), ["bid_file"]);
});

test("nothing waiting: no tasks", () => {
  assert.deepEqual(clientTasks([bid(), bid({ id: "z", stage: "closed" })], 100), []);
});

test("the Retainer placeholder never asks for a bid file; it asks for the profile only while incomplete", () => {
  const r = bid({ id: "ret", draft: true, isRetainerPlaceholder: true });
  assert.deepEqual(clientTasks([r], 80), [{ bidId: "ret", kind: "profile", label: "Complete your profile" }]);
  assert.deepEqual(clientTasks([r], 100), []);
});

test("tasks follow today's needs-action rule exactly for which bids appear", () => {
  const bids = [bid({ id: "1", draft: true }), bid({ id: "2", pendingCount: 1 }), bid({ id: "3", stage: "deliverables_ready" }), bid({ id: "4" }), bid({ id: "5", stage: "closed" })];
  assert.deepEqual(clientTasks(bids, 100).map((t) => t.bidId), bids.filter((b) => needsAction(b)).map((b) => b.id));
});

test("where a bid stands, in plain words", () => {
  assert.equal(standingLabel({ draft: true, stage: "submitted", isRetainerPlaceholder: false }), "Waiting for your bid file");
  assert.equal(standingLabel({ draft: true, stage: "submitted", isRetainerPlaceholder: true }), "Watching for a good fit");
  assert.equal(standingLabel({ draft: false, stage: "submitted", isRetainerPlaceholder: false }), "Received");
  assert.equal(standingLabel({ draft: false, stage: "in_review", isRetainerPlaceholder: false }), "In review with us");
  assert.equal(standingLabel({ draft: false, stage: "deliverables_ready", isRetainerPlaceholder: false }), "Ready for your review");
  assert.equal(standingLabel({ draft: false, stage: "client_review", isRetainerPlaceholder: false }), "With you for review");
  assert.equal(standingLabel({ draft: false, stage: "closed", isRetainerPlaceholder: false }), "Closed");
});
```

- [ ] **Step 2:** Run `node --experimental-strip-types --test lib/dashboard/client-tasks.test.ts`. Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement** `lib/dashboard/client-tasks.ts`:
```ts
// The client dashboard's "Needs you" list and plain-words standings
// (docs/superpowers/specs/2026-09-26-client-area-redesign-design.md). Only
// signals the app already has: a draft without its bid file, open
// checklist items, a package ready to review. One task per bid, most
// urgent first. Messages aren't tracked read/unread, so they aren't a task.

export type BidForTasks = { id: string; draft: boolean; stage: string; isRetainerPlaceholder: boolean; pendingCount: number };
export type ClientTask = { bidId: string; kind: "bid_file" | "items" | "review" | "profile"; label: string };

const REVIEW_STAGES = new Set(["deliverables_ready", "client_review"]);

// Today's rule (unchanged from app/dashboard/page.tsx): drafts, open
// checklist items, or a package waiting on the client.
export function needsAction(b: BidForTasks): boolean {
  if (b.stage === "closed" && !b.draft) return false;
  return b.draft || b.pendingCount > 0 || REVIEW_STAGES.has(b.stage);
}

export function clientTasks(bids: BidForTasks[], profilePercent: number): ClientTask[] {
  const out: ClientTask[] = [];
  for (const b of bids) {
    if (b.isRetainerPlaceholder) {
      if (profilePercent < 100) out.push({ bidId: b.id, kind: "profile", label: "Complete your profile" });
      continue;
    }
    if (!needsAction(b)) continue;
    if (b.draft) out.push({ bidId: b.id, kind: "bid_file", label: "Add your bid file" });
    else if (b.pendingCount > 0) out.push({ bidId: b.id, kind: "items", label: `Answer ${b.pendingCount} item${b.pendingCount === 1 ? "" : "s"}` });
    else out.push({ bidId: b.id, kind: "review", label: "Review your package" });
  }
  return out;
}

const STANDING: Record<string, string> = {
  submitted: "Received",
  in_review: "In review with us",
  deliverables_ready: "Ready for your review",
  client_review: "With you for review",
  closed: "Closed",
};

export function standingLabel(b: { draft: boolean; stage: string; isRetainerPlaceholder: boolean }): string {
  if (b.isRetainerPlaceholder) return "Watching for a good fit";
  if (b.draft) return "Waiting for your bid file";
  return STANDING[b.stage] ?? "In progress";
}
```

**Ruling** (recorded in the ledger): the Retainer placeholder counted as `needsAction` today, because it's a draft. In the new list it asks only "Complete your profile", and only while the profile is under 100%, because it has no bid file to add. The rule-match test excludes placeholders for that reason. The cost if wrong: a complete-profile Retainer client sees no task, which is correct.

- [ ] **Step 4:** Run the tests. Expected: PASS (6).
- [ ] **Step 5: Commit** "Client dashboard: Needs you tasks and plain-words standings (pure)".

---

### Task 2: The press theme and the client shell

**Files:**
- Modify: `app/dashboard/layout.tsx`, `components/ui/AppShell.tsx`

**Interfaces:**
- Consumes: `pressThemeClass` from `app/press-theme.ts`.

- [ ] **Step 1: Layout.** In `app/dashboard/layout.tsx`:
  - import `pressThemeClass`;
  - wrap the returned `<ToastProvider>…</ToastProvider>` in `<div className={pressThemeClass}>…</div>`;
  - add a comment: the client area uses the same look as the public site and sign-up path (DESIGN.md, press theme).
- [ ] **Step 2: Client shell in `AppShell`.** Keep the admin branch exactly as is. For `role === "client"`, render:
  - **Header:** fixed, `bg-surface/95 backdrop-blur border-b border-outline-variant`. Inside it:
    - the logo, linking to `/dashboard`;
    - on `md+`, `<nav aria-label="Main">` with text links "Your bids" (`/dashboard`), "Company profile" (`/dashboard/profile`) and "Compliance vault" (`/dashboard/compliance`). Classes: `text-label-md py-3 px-2 underline-offset-8 decoration-2`; the active link gets `text-primary underline`, the others `text-on-surface-variant hover:text-on-surface`;
    - then `SignOutButton`.
  - **No sidebar.** `<main>` uses `pt-[80px] pb-[88px] md:pb-10 px-margin-mobile md:px-margin-desktop`, with inner `max-w-container mx-auto w-full flex flex-col gap-10`.
  - **Phone:** `<nav aria-label="Main" className="md:hidden fixed bottom-0 …">` with the same three destinations. Each link is `min-h-[48px] flex flex-col items-center justify-center`; the label text uses the full labels ("Your bids", "Profile", "Compliance") in `text-label-sm`. The active link gets `text-primary font-bold` with a 2px top border in primary (`border-t-2 border-primary`), not a filled pill. Keep the icons.
  - Change the client entries of `NAV_LINKS`: labels "Your bids", "Compliance vault" (mobile "Compliance"), "Company profile" (mobile "Profile").
- [ ] **Step 3: Verify.** Run `npx tsc --noEmit -p .` (clean). In the browser, as the test client, `/dashboard` renders in bone paper with Newsreader headings, and the top bar shows the three links.
- [ ] **Step 4: Commit** "Client area: the site's press look and a top-bar menu".

---

### Task 3: The dashboard: Needs you, one-line rows, Your file

**Files:**
- Create: `app/dashboard/BidLedger.tsx`
- Modify: `app/dashboard/SubmissionCard.tsx`, `app/dashboard/page.tsx`, `components/ui/BidListFilter.tsx` (removed if unused after this task, keeping `BidListItem`'s type only if still imported elsewhere; grep first)

**Interfaces:**
- Consumes: `clientTasks`, `standingLabel`, `needsAction` and `ClientTask` (Task 1).
- Produces:
```tsx
export type BidRow = {
  id: string; agency: string; solicitation: string | null; due: string | null; standing: string;
  needsAction: boolean; completed: boolean; isTest: boolean; flags: string[]; detail: React.ReactNode;
};
export function BidLedger({ rows, tasks }: { rows: BidRow[]; tasks: ClientTask[] }): JSX.Element;
```

- [ ] **Step 1: `SubmissionCard` becomes the detail body.**
  - Remove its outer card (`bg-surface-container-low rounded-xl shadow-md`), the header block (solicitation, company name, agency h3, package and test badges) and the open/close button with its `open` state.
  - Render everything that was inside (the lifecycle stepper, site-visit warning, deadline/value, wage check, trade note, scope, checklist, deliverables, messages) always, in a `div className="flex flex-col gap-space-base pt-2"`.
  - Keep its props and name so nothing else breaks.
  - Change its h4s to h3s, so the headings stay in order under the row's h2.
- [ ] **Step 2: `BidLedger`** (a client component, in `app/dashboard/BidLedger.tsx`):
  - **State:** `openId: string | null`; `filter: "all" | "needs_action" | "completed"`.
  - **"Needs you"** (`<section aria-labelledby="needs-you">`): an `<h2 id="needs-you" className="text-headline-md">Needs you</h2>`. If there are no tasks, `<p className="text-body-md text-on-surface-variant">Nothing needs you right now. We'll email you when something does.</p>`. Otherwise a `s.ledger` list, one `<article>` per task:
    - the agency (`displayAgency`) as `text-title-lg`, the solicitation number (mono) and the due date (mono);
    - one navy button (`s.btn s.btnPrimary`) with `task.label`. It calls `openBid(task.bidId)`.
    - When `task.kind === "profile"`, the button is a `Link` to `/dashboard/profile`.
  - **`openBid(id)`:**
    ```ts
    function openBid(id: string) {
      setFilter("all");
      setOpenId(id);
      requestAnimationFrame(() => {
        const el = document.getElementById(`bid-${id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        (el?.querySelector("[data-bid-toggle]") as HTMLElement | null)?.focus();
      });
    }
    ```
  - **"Everything else"** (`<section aria-labelledby="all-bids">`): the h2 "All your bids", then the filter as three quiet text buttons ("All (N)", "Needs you (N)", "Done (N)") with `aria-pressed`, then a `s.ledger` of rows. Each row is `<article id={`bid-${row.id}`}>` containing:
    - a `<button data-bid-toggle aria-expanded={open} aria-controls={`bid-${row.id}-detail`}>` spanning the row, with:
      - line 1: the agency (`text-title-lg`), plus a "Test" mark if `isTest`;
      - line 2: the solicitation number (mono) · `row.standing` · "Due" plus the date (mono);
      - a chevron turning 180° when open;
      - `row.flags` shown as red text chips when present, e.g. "Below the wage-law floor" and "Mandatory site visit", so the warnings stay visible when collapsed;
    - `{open && <div id={`bid-${row.id}-detail`} role="region" aria-label={`Details: ${row.agency}`}>{row.detail}</div>}`.
    - Only one row is open: clicking an open row closes it, clicking another opens that one.
    - The row button has `min-h-[56px] w-full text-left` and a focus-visible outline.
  - **Empty filter:** `<p>` "Nothing in this view yet."
- [ ] **Step 3: `page.tsx`.**
  - Build `BidRow[]` from `draftSubmissions`, `activeSubmissions` and `closedSubmissions`:
    - **draft `detail`:** `CompleteBidFile` plus scope;
    - **Retainer placeholder `detail`:** today's text, "We're watching for opportunities that fit and will reach out when we find one.", plus the profile link;
    - **active/closed `detail`:** `SubmissionCard` with today's props.
    - **`flags`:** add `"Below the wage-law floor"` when `sub.wage_check && sub.wage_check.bidPrice < sub.wage_check.floor`, and `"Mandatory site visit"` when `sub.mandatory_site_visit_concern`.
    - **`needsAction` and `completed`:** from Task 1's `needsAction` and `stage === "closed"`.
  - Compute `tasks = clientTasks(...)`, with `pendingCount` from `checklistBySubmission` and `isRetainerPlaceholder = sub.agency === RETAINER_PLACEHOLDER_AGENCY`.
  - **Render:**
    1. **Header:** `<header className={s.pageHead}>` with the h1 "Your bids" (`className="text-headline-lg"`) and the lede. Wrap it in a flex row with `<Link href="/intake" className={`${s.btn} ${s.btnPrimary}`}>Start a new bid</Link>` (it stacks on phone).
    2. `<BidLedger rows={rows} tasks={tasks} />`.
    3. **"Your file"**: a `<section aria-labelledby="your-file">` with the h2 "Your file" and one line: `Company profile {completeness.percent}% complete` (link to `/dashboard/profile`) · `Credentials {verified} of {total} verified` (link to `/dashboard/compliance`), or "No credentials on file yet" with an "Add one" link. Then `samStatusMessage` in `text-error` when present.
    4. **"Bid process reminders":** an h2 and the existing `<BidProcessNotices />`.
  - **Remove:** the two stat tiles, the old "Start a new bid" card, the sidebar panels and the "Active workstream" heading.
  - **The no-bids branch:** the same page head ("Your bids"), a lede "You haven't started a bid yet.", and the navy button "Start your first bid" to `/intake`.
  - `import s from "@/components/marketing/press.module.css"` for `pageHead`, `ledger`, `btn`, `btnPrimary` and `btnQuiet`.
- [ ] **Step 4: Verify.** Run `npx tsc --noEmit -p .` and `npm test`.
- [ ] **Step 5: Commit** "Client dashboard: Needs you first, one-line rows opened one at a time".

---

### Task 4: Company profile and Compliance vault

**Files:**
- Modify: `app/dashboard/profile/page.tsx`, `app/dashboard/profile/*Section.tsx`, `app/dashboard/profile/CompanyProfileClient.tsx`, `app/dashboard/compliance/page.tsx`

- [ ] **Step 1:**
  - **Page heads:** use `s.pageHead` (h1 plus lede), with the same titles as today: "Company Profile" becomes "Company profile" and "Compliance Vault" becomes "Compliance vault", in sentence case like the rest of the press site.
  - **Sections:** replace each card container (`bg-surface-container-low rounded-xl shadow…` / `bg-surface-container-lowest border rounded-xl p-6`) with `<section className="border-t-2 border-on-surface pt-6">` and an h2 (`text-headline-md`). Forms inside sit on `s.formSheet`.
  - **Headings:** h3/h4 section titles become h2 where they're top-level sections; keep them in order.
  - **Buttons:** "Remove", "Check federal records" and similar small text buttons get `min-h-[44px] px-3 inline-flex items-center` on phone (`sm:min-h-0`).
  - **Unchanged:** all behaviour, and the label links added 2026-09-26.
- [ ] **Step 2: Verify.** Run `npx tsc --noEmit -p .`; axe on both pages, desktop and phone, gives no violations.
- [ ] **Step 3: Commit** "Company profile and Compliance vault in the site's look".

---

### Task 5: DESIGN.md, and the full browser check

- [ ] **Step 1: `DESIGN.md`.** In the "Marketing theme" section, change the scope sentence to include the client area (`/dashboard`, `/dashboard/profile`, `/dashboard/compliance`, via `app/dashboard/layout.tsx`). Replace "The client dashboard and admin still use the Compliance Ledger system… until they get their own design pass" with "The admin still uses the Compliance Ledger system." Add a "Client area" bullet: "Your bids" page head; "Needs you" ledger; one-line bid rows opened one at a time; the "Your file" line; the top-bar menu.
- [ ] **Step 2: Browser check on dev** (test client Sunrise Janitorial, 13 bids; desktop 1280 and phone 390; Playwright):
  1. **Look:** all three pages render in the press look. Take screenshots.
  2. **Length:** the dashboard at phone width measures under 3,000 px.
  3. **Needs you:** it lists one task per waiting bid, with the right labels. Each kind of button (bid file, items, review) opens the right row, scrolls to it and focuses its toggle.
  4. **Rows:** they open one at a time, and the warning flags show on collapsed rows (use a bid with a `wage_check` below the floor, or a site-visit concern; set one on a test bid if none exists, printing the row count first).
  5. **Real actions still work** (test data only):
     - add a bid file to a draft;
     - change a checklist item;
     - open a package preview;
     - send a message;
     - save the profile;
     - add and remove a certification.
  6. **No bids:** a client with no bids sees "Start your first bid" (use a test client with none, or check the branch by reading the code if none exists; say which).
  7. **Quality:** axe clean on all three pages at both sizes; no horizontal scroll; no console errors.
- [ ] **Step 3:** Run `npm test` and `npx tsc --noEmit -p .`. Commit "Client area redesign: DESIGN.md".
- [ ] **Step 4:** Final review of the whole branch by a fresh reviewer, then the fix pass.
