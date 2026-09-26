# New-to-Bidding Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale blog with an evergreen "New to bidding?" guide (a
hub plus 7 short articles) and turn the quiz into a "Where do I start?" check
that routes a newcomer to the right article or to the Pilot.

**Architecture:**
- **Content:** all guide text lives in one typed module, `lib/guide/articles.ts`
  (ordered articles, each with structured body blocks and sources). The
  routing of the check is a pure function, `lib/guide/next-steps.ts`.
- **Pages:** `/guide` (the hub) and `/guide/[slug]` (statically generated)
  render from the content module with the existing press styles. `/quiz` is
  rewritten to use `nextSteps`.
- **Shared Pilot wording:** a new `lib/pilot-offer.ts`, so the price line
  can't drift between the pricing page, the homepage and the guide.

**Tech Stack:** Next.js 15 App Router (marketing route group
`app/(marketing)`), TypeScript (`strict: false`), CSS module
`components/marketing/press.module.css`, `motion/react` (already used by the
quiz), and `node --experimental-strip-types --test` with relative `.ts`
imports in `lib/`.

**Spec:** `docs/superpowers/specs/2026-09-26-newcomer-guide-design.md`

## Global Constraints

- **Never fabricate:** no invented statistics, customers, stories or win promises. Every fact about registration, portals or rules is checked against its official source on the day it's written, and that page is listed under the article's Sources.
- **Pilot wording:** always the pricing page's line ("Free for the first 10 clients" while `PILOT_FREE_COHORT_OPEN`, otherwise "Pricing confirmed with you directly"), never a bare "free". The Pilot link is `/intake?package=pilot`, with the label "Start a pilot bid".
- **Voice and style:**
  - confident, warm, plain-spoken peer-to-peer, about an 8th-grade reading level;
  - no "guarantee a win", "cutting-edge" or "revolutionary";
  - no em dashes in user-facing copy (the site's copy uses commas, colons and full stops);
  - articles are roughly 400–900 words and undated.
- **Nothing is stored or sent** by the check.
- **Tests and checks:** `npm test` stays green; `npx tsc --noEmit -p .` is clean.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VxaQ43PbCfwewBqBw5t8Dd
  ```
- **The user reads every article before merge;** nothing unreviewed goes live.

## Review Focus

1. **A visitor with an old `/blog` link or bookmark** lands on `/guide`, not a 404 (Task 2 browser check, plus a `next.config.ts` redirect test via `curl -I`).
2. **Someone who answers "yes" to having a bid in hand** gets the Pilot as the first step, whatever else they answered (Task 1 test: every combination with Q4 yes has "pilot" first).
3. **An unknown slug** (`/guide/nope`) shows the site's 404, not an error page (Task 2: `dynamicParams = false` plus a browser check).
4. **Pilot wording after the cohort closes:** flipping `PILOT_FREE_COHORT_OPEN` changes the guide's wording too, since it reads the shared constant (Task 2 test on `pilotPriceLine`).
5. **A source link that has moved or died** is caught before merge (Task 4 link check).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/guide/types.ts` (new) | `GuideArticle`, `Block`, `Step`, `Answers`, `NextStep` |
| `lib/guide/next-steps.ts` (+ test, new) | `nextSteps(answers)`: the check's routing |
| `lib/guide/articles.ts` (+ test, new) | The 7 articles in path order: content, summaries, sources |
| `lib/pilot-offer.ts` (+ test, new) | `PILOT_FREE_COHORT_OPEN`, `PILOT_COHORT_SIZE`, `pilotPriceLine()`, `PILOT_CTA` |
| `app/(marketing)/guide/page.tsx` (new) | Hub |
| `app/(marketing)/guide/[slug]/page.tsx` (new) | Article page |
| `components/marketing/GuideBlocks.tsx` (new) | Renders `Block[]` with press styles |
| `components/marketing/NextStep.tsx` (new) | The "Next step" block at the end of each article |
| `app/(marketing)/quiz/page.tsx`, `QuizForm.tsx` | "Where do I start?" |
| `components/ui/MarketingShell.tsx` | Menu labels and links |
| `app/(marketing)/page.tsx`, `app/(marketing)/pricing/page.tsx` | Use `lib/pilot-offer.ts`; the homepage gains "New to government bids? Start here" links |
| `app/(marketing)/blog/page.tsx` (delete), `next.config.ts` | `/blog` → `/guide` redirect |

---

### Task 1: Content types and the check's routing (pure)

**Files:**
- Create: `lib/guide/types.ts`, `lib/guide/next-steps.ts`, `lib/guide/next-steps.test.ts`

**Interfaces:**
- Produces:
```ts
export type Step = "learn" | "ready" | "start";
export type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "callout"; title: string; text: string }
  | { kind: "terms"; items: { term: string; meaning: string }[] };
export type GuideArticle = { slug: string; title: string; summary: string; step: Step; description: string; body: Block[]; sources: { label: string; url: string }[] };
export type Answers = { bidBefore: boolean; registered: boolean; licensed: boolean; bidInHand: boolean };
export type NextStep = { target: string /* article slug or "pilot" */; why: string };
export function nextSteps(a: Answers): NextStep[];   // 1–3 items
```

- [ ] **Step 1: Failing tests** in `lib/guide/next-steps.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSteps } from "./next-steps.ts";

const all = [true, false].flatMap((bidBefore) => [true, false].flatMap((registered) => [true, false].flatMap((licensed) => [true, false].map((bidInHand) => ({ bidBefore, registered, licensed, bidInHand })))));

test("every one of the 16 answer combinations gives 1 to 3 distinct steps", () => {
  assert.equal(all.length, 16);
  for (const a of all) {
    const s = nextSteps(a).map((x) => x.target);
    assert.ok(s.length >= 1 && s.length <= 3, JSON.stringify(a));
    assert.equal(new Set(s).size, s.length, "no step twice: " + JSON.stringify(a));
  }
});

test("a bid in hand always puts the Pilot first", () => {
  for (const a of all.filter((x) => x.bidInHand)) assert.equal(nextSteps(a)[0].target, "pilot", JSON.stringify(a));
});

test("not registered, or no license/insurance: Getting registered", () => {
  assert.ok(nextSteps({ bidBefore: true, registered: false, licensed: true, bidInHand: false }).some((s) => s.target === "getting-registered"));
  const noLicense = nextSteps({ bidBefore: true, registered: true, licensed: false, bidInHand: false });
  assert.equal(noLicense[0].target, "getting-registered");
  assert.match(noLicense[0].why, /license|insurance/i);
});

test("a complete newcomer: registered first, then the first bid, then what an RFP is", () => {
  assert.deepEqual(nextSteps({ bidBefore: false, registered: false, licensed: false, bidInHand: false }).map((s) => s.target), ["getting-registered", "your-first-bid", "what-is-an-rfp"]);
});

test("ready but no bid in hand: where bids are posted, then the Pilot", () => {
  assert.deepEqual(nextSteps({ bidBefore: true, registered: true, licensed: true, bidInHand: false }).map((s) => s.target), ["where-bids-are-posted", "pilot"]);
});

test("an experienced bidder with a bid in hand: just the Pilot", () => {
  assert.deepEqual(nextSteps({ bidBefore: true, registered: true, licensed: true, bidInHand: true }).map((s) => s.target), ["pilot"]);
});
```

- [ ] **Step 2:** Run `node --experimental-strip-types --test lib/guide/next-steps.test.ts`. Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement.** Write `lib/guide/types.ts` (the types above, verbatim), then `lib/guide/next-steps.ts`:
```ts
import type { Answers, NextStep } from "./types.ts";

// "Where do I start?" (docs/superpowers/specs/2026-09-26-newcomer-guide-design.md):
// one to three next steps from four yes/no answers. A bid in hand always
// comes first -- that's the moment we can help most.
export function nextSteps(a: Answers): NextStep[] {
  const out: NextStep[] = [];
  const add = (target: string, why: string) => {
    if (!out.some((s) => s.target === target) && out.length < 3) out.push({ target, why });
  };
  if (a.bidInHand) add("pilot", "You have a bid in hand: send it to us and we'll prepare it with you.");
  if (!a.licensed) add("getting-registered", "Have your business license and insurance in order first: agencies ask for both.");
  if (!a.registered) add("getting-registered", "Most bids can only be seen, and all can only be submitted, once you're registered as a vendor.");
  if (!a.bidBefore) {
    add("your-first-bid", "What happens from finding a bid to hearing back, step by step.");
    if (!a.bidInHand) add("what-is-an-rfp", "The words you'll meet in every bid, in plain English.");
  }
  if (a.registered && a.licensed && !a.bidInHand) {
    add("where-bids-are-posted", "Where agencies around Jacksonville post the work you do.");
    add("pilot", "When you find one, start your first bid with us.");
  }
  if (out.length === 0) add("where-bids-are-posted", "Where agencies around Jacksonville post the work you do.");
  return out;
}
```

- [ ] **Step 4:** Run the tests again. Expected: PASS (6 tests). If a case fails, fix the function, not the test: the tests are the spec's rules.

- [ ] **Step 5: Commit** "Guide: content types and the Where do I start? routing".

---

### Task 2: Pages, menu, redirect and the shared Pilot wording

**Files:**
- Create: `lib/pilot-offer.ts`, `lib/pilot-offer.test.ts`, `lib/guide/articles.ts` (the skeleton: 7 entries with title, summary, step, description, one placeholder paragraph each and their source list, filled in fully in Task 4), `lib/guide/articles.test.ts`, `components/marketing/GuideBlocks.tsx`, `components/marketing/NextStep.tsx`, `app/(marketing)/guide/page.tsx`, `app/(marketing)/guide/[slug]/page.tsx`
- Modify: `app/(marketing)/pricing/page.tsx:31-50`, `app/(marketing)/page.tsx` (the `PILOT_FREE_COHORT_OPEN` use; homepage links), `components/ui/MarketingShell.tsx:26-31`, `next.config.ts`
- Delete: `app/(marketing)/blog/page.tsx`

**Interfaces:**
- Consumes: `GuideArticle`, `Block` and `Step` (Task 1).
- Produces:
  - `pilotPriceLine(open?: boolean): string`, `PILOT_CTA = { label: "Start a pilot bid", href: "/intake?package=pilot" }`, and `PILOT_FREE_COHORT_OPEN`, `PILOT_COHORT_SIZE`
  - `ARTICLES: GuideArticle[]`, `getArticle(slug): GuideArticle | undefined`, `STEP_LABELS: Record<Step, string>`

- [ ] **Step 1: Failing tests.**

`lib/pilot-offer.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pilotPriceLine, PILOT_CTA } from "./pilot-offer.ts";

test("the Pilot's price line follows the cohort toggle, never a bare 'free'", () => {
  assert.equal(pilotPriceLine(true), "Free for the first 10 clients");
  assert.equal(pilotPriceLine(false), "Pricing confirmed with you directly");
  assert.deepEqual(PILOT_CTA, { label: "Start a pilot bid", href: "/intake?package=pilot" });
});
```

`lib/guide/articles.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTICLES, getArticle } from "./articles.ts";
import { nextSteps } from "./next-steps.ts";

const SLUGS = ["what-is-an-rfp", "is-government-work-for-me", "where-bids-are-posted", "getting-registered", "your-first-bid", "before-you-submit", "compliance-matrix"];

test("the seven articles, in path order, with the spec's slugs", () => {
  assert.deepEqual(ARTICLES.map((a) => a.slug), SLUGS);
  assert.equal(getArticle("nope"), undefined);
});

test("every article has a title, summary, description, body and at least one https source", () => {
  for (const a of ARTICLES) {
    assert.ok(a.title && a.summary && a.description && a.body.length > 0, a.slug);
    assert.ok(a.sources.length > 0 && a.sources.every((s) => s.url.startsWith("https://")), a.slug);
  }
});

test("every step the check can suggest exists", () => {
  for (const bidBefore of [true, false]) for (const registered of [true, false]) for (const licensed of [true, false]) for (const bidInHand of [true, false]) {
    for (const s of nextSteps({ bidBefore, registered, licensed, bidInHand })) {
      assert.ok(s.target === "pilot" || getArticle(s.target), s.target);
    }
  }
});
```

- [ ] **Step 2:** Run both test files. Expected: FAIL (the modules are missing).

- [ ] **Step 3: Implement `lib/pilot-offer.ts`:**
```ts
// The Pilot offer's wording, in one place: the pricing page, the homepage
// and the guide all read it, so the price line can't drift. Pilot is free
// for only the first 10 clients: flip PILOT_FREE_COHORT_OPEN to false once
// they've gone out, and redeploy (see the pricing page's history comment).
export const PILOT_FREE_COHORT_OPEN = true;
export const PILOT_COHORT_SIZE = 10;
export function pilotPriceLine(open = PILOT_FREE_COHORT_OPEN): string {
  return open ? `Free for the first ${PILOT_COHORT_SIZE} clients` : "Pricing confirmed with you directly";
}
export const PILOT_CTA = { label: "Start a pilot bid", href: "/intake?package=pilot" } as const;
```

In `pricing/page.tsx`:
- replace the local `PILOT_FREE_COHORT_OPEN`, `PILOT_COHORT_SIZE` and `PILOT_PRICE_LINE` definitions with `import { PILOT_FREE_COHORT_OPEN, pilotPriceLine } from "@/lib/pilot-offer";` and `const PILOT_PRICE_LINE = pilotPriceLine();`;
- keep its history comment, moved above the import.

In `app/(marketing)/page.tsx`, replace its local `PILOT_FREE_COHORT_OPEN` with the import. Grep afterwards: `grep -rn "PILOT_FREE_COHORT_OPEN =" app lib` must show only `lib/pilot-offer.ts`.

- [ ] **Step 4: Implement `lib/guide/articles.ts`** with all 7 entries in `SLUGS` order. For now, each has:
  - its final `title`, `summary` (one line), `description` (the meta description, under 160 characters) and `step`;
  - a single `{ kind: "p", text: "…" }` body block holding a one-sentence summary;
  - the sources listed in Task 4 for it.

`step`:
- `learn` for `what-is-an-rfp`, `is-government-work-for-me` and `where-bids-are-posted`;
- `ready` for `getting-registered`;
- `start` for `your-first-bid`, `before-you-submit` and `compliance-matrix`.

Export:
```ts
export const STEP_LABELS: Record<Step, string> = { learn: "Learn the basics", ready: "Get ready", start: "Start bidding" };
export function getArticle(slug: string) { return ARTICLES.find((a) => a.slug === slug); }
```

- [ ] **Step 5: Components.**

`components/marketing/GuideBlocks.tsx` (a server component). It renders each `Block` inside the page's `s.prose` container:
- `h2` becomes `<h2>`;
- `p` becomes `<p>`;
- `list` becomes `<ul>` or `<ol>`;
- `callout` becomes `<div className={s.panel}><p className={s.panelLabel}>{title}</p><p>{text}</p></div>`;
- `terms` becomes `<dl>` with `<dt><strong>` and `<dd>`.

Text is rendered as plain text, never as HTML.

`components/marketing/NextStep.tsx`:
```tsx
import Link from "next/link";
import s from "@/components/marketing/press.module.css";
import { PILOT_CTA, pilotPriceLine } from "@/lib/pilot-offer";

// The end of every guide article: take the check, or start the Pilot.
export function NextStep() {
  return (
    <div className={s.panel}>
      <p className={s.panelLabel}>Next step</p>
      <p>Not sure what to do first? Four yes-or-no questions point you to it.</p>
      <p className="flex flex-wrap gap-3 mt-3">
        <Link href="/quiz" className={`${s.btn} ${s.btnQuiet}`}>Where do I start?</Link>
        <Link href={PILOT_CTA.href} className={`${s.btn} ${s.btnPrimary}`}>{PILOT_CTA.label}</Link>
      </p>
      <p className={s.muted}>Pilot: {pilotPriceLine()}.</p>
    </div>
  );
}
```

- [ ] **Step 6: Pages.**

`app/(marketing)/guide/page.tsx` (the hub):
- `metadata`: title "New to bidding?", description "Government work for trade businesses, in plain English: what an RFP is, where bids are posted around Jacksonville, getting registered, and your first bid.";
- `<header className={s.pageHead}>`: the h1 "New to bidding?", and the lede "Government work for trade businesses, in plain English.";
- then three sections, one per `Step` in the order `learn`, `ready`, `start`. Each has an `h2` from `STEP_LABELS`, and a `s.ledger` list of that step's articles: an `<article>` with a `Link` to `/guide/<slug>` wrapping `s.rowTitle` (the title) and a `s.muted` summary;
- then `<NextStep />`.

`app/(marketing)/guide/[slug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import s from "@/components/marketing/press.module.css";
import { ARTICLES, getArticle } from "@/lib/guide/articles";
import { GuideBlocks } from "@/components/marketing/GuideBlocks";
import { NextStep } from "@/components/marketing/NextStep";

export const dynamicParams = false;
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = getArticle((await params).slug);
  return a ? { title: a.title, description: a.description } : {};
}
export default async function GuideArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const i = ARTICLES.indexOf(a);
  const prev = ARTICLES[i - 1];
  const next = ARTICLES[i + 1];
  return (
    <div className={s.prose}>
      <header className={s.pageHead}>
        <p className={s.meta}><Link href="/guide">New to bidding?</Link></p>
        <h1 className={s.pageTitle}>{a.title}</h1>
        <p className={s.lede}>{a.summary}</p>
      </header>
      <GuideBlocks blocks={a.body} />
      <NextStep />
      <section className={s.proseSection}>
        <h2>Sources</h2>
        <ul>{a.sources.map((src) => <li key={src.url}><a href={src.url} target="_blank" rel="noreferrer">{src.label}</a></li>)}</ul>
      </section>
      <nav aria-label="More in the guide" className="flex flex-wrap justify-between gap-3 mt-6">
        {prev ? <Link href={`/guide/${prev.slug}`}>← {prev.title}</Link> : <span />}
        {next ? <Link href={`/guide/${next.slug}`}>{next.title} →</Link> : <Link href="/guide">All guide articles</Link>}
      </nav>
    </div>
  );
}
```
Check that `params` is a Promise in this Next.js version: other dynamic routes in the repo, e.g. `app/admin/inbox/[id]/page.tsx`, show the form in use. Follow theirs.

- [ ] **Step 7: Menu, redirect and homepage.**
  - **`MarketingShell.tsx`:** `{ href: "/quiz", label: "Fit-Score Quiz" }` becomes `{ href: "/quiz", label: "Where do I start?" }`, and `{ href: "/blog", label: "Blog" }` becomes `{ href: "/guide", label: "New to bidding?" }`.
  - **`next.config.ts`:** add `async redirects() { return [{ source: "/blog", destination: "/guide", permanent: true }]; },`, with a comment saying the blog was replaced by the guide on 2026-09-26.
  - **Delete** `app/(marketing)/blog/page.tsx`.
  - **Homepage:** under the hero's CTAs (the `s.ctas` div near line 231), and after the final section's `<span className={s.risk}>`, add:
    ```tsx
    <Link href="/guide" className={s.inlineLink}>New to government bids? Start here</Link>
    ```

- [ ] **Step 8: Verify.** Run `npm test` and `npx tsc --noEmit -p .`. Both must be clean. With the dev server running:
  - `curl -sI localhost:3000/blog | grep -i "^location"` shows `/guide` (Review Focus #1);
  - `curl -s -o /dev/null -w "%{http_code}" localhost:3000/guide/nope` gives `404` (Review Focus #3).

- [ ] **Step 9: Commit** "Guide: hub and article pages; menu, /blog redirect, shared Pilot wording".

---

### Task 3: "Where do I start?" (the quiz, rewritten)

**Files:**
- Modify: `app/(marketing)/quiz/page.tsx`, `app/(marketing)/quiz/QuizForm.tsx`

**Interfaces:**
- Consumes: `nextSteps` and `Answers` (Task 1); `getArticle` (Task 2); `PILOT_CTA` and `pilotPriceLine` (Task 2).

- [ ] **Step 1: `quiz/page.tsx`:**
  - `metadata` title "Where do I start?", with the description "Four yes-or-no questions that point you to your next step with government bids, whether you're brand new or already bidding.";
  - h1 "Where do I start?";
  - lede "Four yes-or-no questions. New to bids or already bidding, you'll get your next step.".
- [ ] **Step 2: `QuizForm.tsx`.** Keep the existing progress bar, motion and Yes/No buttons, and the component name `QuizForm`.
  - **The questions:**
    ```ts
    const QUESTIONS: { key: keyof Answers; text: string }[] = [
      { key: "bidBefore", text: "Have you bid on a government job before?" },
      { key: "registered", text: "Are you registered in SAM.gov or on a local bid site?" },
      { key: "licensed", text: "Do you have your business license and insurance?" },
      { key: "bidInHand", text: "Do you have a bid (an RFP or ITB) in hand right now?" },
    ];
    ```
    Store the answers as a `Partial<Answers>`.
  - **The result:** `const steps = nextSteps(answers as Answers)`. Render:
    - the heading "Here's where to start.";
    - an ordered list. Each step shows either `PILOT_CTA` as a primary button with its `why` and `Pilot: {pilotPriceLine()}.`, or a `Link` to `/guide/<slug>` with the article's title and its `why`;
    - a quiet "Start over" button that resets the step and answers;
    - a link "Browse the whole guide" to `/guide`.
  - **Remove** the old "You're a strong fit." / "We can still help." copy and update the header comment: it now routes newcomers and bidders alike; nothing is stored.
- [ ] **Step 3: Verify.** `npx tsc --noEmit -p .` is clean and `npm test` is green.
- [ ] **Step 4: Commit** "Where do I start?: the quiz now points each visitor to their next step".

---

### Task 4: Write and fact-check the seven articles

**Files:**
- Modify: `lib/guide/articles.ts` (full bodies and sources)
- Create: `scripts/check-guide-links.mjs`

**Interfaces:**
- Consumes: the `Block` and `GuideArticle` types (Task 1).

**Rules for every article:**
- Global Constraints apply: plain voice, about 8th grade, 400–900 words, undated, no em dashes, no unverified numbers.
- **Fact-check each factual sentence** against a source fetched **today** (WebFetch the official page). Any fact that couldn't be confirmed is removed or softened to what the source supports ("most", "many", "check with the agency").
- Write each article's `body` as `Block[]` (h2, p, list, callout, terms).

**Outlines and required sources:**

1. **`what-is-an-rfp`: "What's an RFP?"**
   - Why agencies publish bids (spending public money means inviting offers in the open).
   - A `terms` block covering: RFP; ITB/IFB; RFQ; solicitation; addendum; pre-bid meeting and site visit (mandatory versus optional); bid bond; "responsive" and "responsible"; scope of work; due date and time.
   - A callout: "Read the whole thing, including every addendum."
   - **Sources:**
     - the Florida statute on competitive solicitation definitions: <https://www.flsenate.gov/Laws/Statutes/2025/287.012> (check the current year's URL);
     - FAR Part 14 (sealed bidding) and Part 15 (proposals): <https://www.acquisition.gov/far/part-14>, <https://www.acquisition.gov/far/part-15>.
2. **`is-government-work-for-me`: "Is government work right for my business?"**
   - What trade work agencies buy (cleaning, grounds, HVAC, electrical, IT support), with local examples only if they're verifiable on a public agency page today.
   - The honest trade-offs:
     - agencies are steady payers (cite Florida's prompt payment law for local governments, and the federal Prompt Payment Act);
     - more paperwork;
     - fixed deadlines;
     - sealed prices;
     - lowest price often wins;
     - federal service work comes with wage rules (the Service Contract Act).
   - "When it's a good fit" / "when to wait" lists.
   - **Sources:**
     - Florida Local Government Prompt Payment Act, s. 218.70–.80: <https://www.flsenate.gov/Laws/Statutes/2025/Chapter218/PART_VII/>;
     - the Service Contract Act at DOL: <https://www.dol.gov/agencies/whd/government-contracts/service-contracts>;
     - the Prompt Payment Act at the Bureau of the Fiscal Service: <https://www.fiscal.treasury.gov/prompt-payment/>.
3. **`where-bids-are-posted`: "Where bids are posted around Jacksonville"**
   - SAM.gov for federal work.
   - Local buyers and the platforms they post on, taken from the 2026-09-26 survey and re-checked today:
     - DCPS: DemandStar and Public Purchase;
     - Clay County: OpenGov;
     - St. Johns County: DemandStar (moving to Workday);
     - St. Johns County schools: VendorLink;
     - Nassau County: PlanetBids;
     - JTA: OpenGov;
     - JEA: its own site plus Zycus;
     - JAXPORT, the City of Jacksonville and the state: MyFloridaMarketPlace / VBS.
   - That most need a free vendor account to see listings; a tip to set up email alerts for your trade's categories.
   - Don't state anything as universal ("every agency…").
   - **Sources:** each buyer's own procurement page (the URLs in the survey's source list in this session: duvalschools.org/page/purchasing, claycountygov.com/government/purchasing, sjcfl.us/active-bids, stjohns.k12.fl.us/purchasing/active, nassaucountyfl.com/1442/Procurement, jtafla.com procurement, jea.com/procurement, jaxport.com/procurement/active-solicitations, dms.myflorida.com VBS), plus sam.gov/content/opportunities.
4. **`getting-registered`: "Getting registered"**
   - **SAM.gov:** entity registration (free; how long it can take; renew every year; the UEI); a warning that SAM.gov is free and that paid "registration" sellers aren't required.
   - **Local:** a vendor account on each platform (free for vendors on the platforms checked; say "check each one").
   - **What to have ready:** legal business name and address matching IRS records, EIN, bank details (for federal), business license (a local business tax receipt and any state trade license), insurance certificate (general liability; workers' comp as Florida law requires for your trade).
   - **Florida specifics** only if verified: the business tax receipt and DBPR contractor licensing for trades that need it (HVAC and electrical do; say where to check).
   - **Sources:**
     - sam.gov/entity-registration;
     - fsd.gov (the SAM help desk);
     - the GSA warning about fraudulent SAM registration offers (find the current page);
     - myfloridalicense.com (DBPR);
     - the City of Jacksonville local business tax receipt page;
     - the Florida workers' compensation requirements (myfloridacfo.com/division/wc).
5. **`your-first-bid`: "Your first bid, step by step"**
   - An ordered list:
     1. find it;
     2. read all of it, including addenda;
     3. note every date: the questions deadline, the site visit, the due date and time;
     4. go to a mandatory site visit (skipping one can disqualify you);
     5. ask questions only through the named contact (the no-lobbying "cone of silence" is common locally);
     6. gather the forms and signatures;
     7. price it;
     8. check it against the requirements;
     9. submit before the deadline, the way they ask;
     10. what happens after (opening, evaluation, the notice of intended award, the protest window).
   - A callout: "Late is a no. Most agencies won't accept a bid even a minute late."
   - **Sources:**
     - Florida s. 120.57(3) (the protest window after a notice of intended decision);
     - the City of Jacksonville cone of silence (Ordinance Code ch. 126, find the current page);
     - one local solicitation example page showing a mandatory pre-bid (from JAXPORT or Clay County, checked today).
6. **`before-you-submit`: "Five things to check before submitting"**
   - Page limits and format; every required form, filled and signed; every addendum acknowledged; the price form complete (units, totals); how and when to submit.
   - This expands the old blog excerpt ("page limits, required forms, and signature pages").
   - **Sources:** the same solicitation examples, and Florida s. 287.057 (on "responsive").
7. **`compliance-matrix`: "Why a compliance matrix matters"**
   - Evaluators score line by line against the requirements; a matrix maps each requirement to where your bid answers it; it makes gaps obvious before you submit; how First Coast Bids builds one with the source page for each line.
   - This expands the old excerpt.
   - **Sources:** FAR 15.305 (proposal evaluation), <https://www.acquisition.gov/far/15.305>, and one local RFP's evaluation criteria page, checked today.

- [ ] **Step 1: Link checker.** `scripts/check-guide-links.mjs`:
  - import `ARTICLES` (run with `node --experimental-strip-types`);
  - `fetch` each source URL with a browser User-Agent, following redirects, with a 20 s timeout;
  - print `OK <status> <url>` or `BAD <status|error> <url>`;
  - exit 1 if any are BAD.

  Some government sites block scripts (403). For those, record a manual check (open in the browser) in the ledger rather than dropping the source.
- [ ] **Step 2: Write the articles one at a time,** fact-checking as you go. After each, run `node --experimental-strip-types --test lib/guide/articles.test.ts`. Expected: PASS.
- [ ] **Step 3: Add a word-count test** to `articles.test.ts`:
```ts
test("each article is 400 to 900 words, with no em dashes", () => {
  for (const a of ARTICLES) {
    const text = a.body.map((b) => ("text" in b ? b.text : "") + ("items" in b ? JSON.stringify(b.items) : "")).join(" ");
    const words = text.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 400 && words <= 900, `${a.slug}: ${words} words`);
    assert.ok(!/—/.test(text + a.title + a.summary + a.description), `${a.slug} has an em dash`);
  }
});
```
  Run it. Expected: PASS once all seven are written.
- [ ] **Step 4:** Run `node --experimental-strip-types scripts/check-guide-links.mjs`. Expected: all OK, or the 403s recorded as manually checked.
- [ ] **Step 5: Commit** "Guide: the seven articles, fact-checked, with sources".

---

### Task 5: Browser check, then your read-through

- [ ] **Step 1: Browser check on dev** (Playwright, not signed in), at 1280×900 and 390×844:
  - the menu shows "Where do I start?" and "New to bidding?";
  - `/blog` lands on `/guide`;
  - the hub lists the 7 articles under the 3 steps;
  - each article opens, with sources and prev/next;
  - `/guide/nope` shows the 404;
  - the check routes a complete newcomer (all No) to Getting registered, Your first bid and What's an RFP?, and someone with a bid in hand (Q4 Yes) to the Pilot first;
  - the homepage "Start here" links go to `/guide`;
  - no horizontal scroll and no page errors.

  Screenshot the hub, one article and the check's result.
- [ ] **Step 2: Final review** (the whole branch, by a fresh reviewer), then a fix pass.
- [ ] **Step 3: Hand the articles to the user to read** before merging. List each article's URL on dev, or publish the text for reading. Apply their edits.
