# Working notes for Claude Code on this repo

Read `PROJECT-STATUS.md` for project history and what's queued next, and
`PRODUCT.md`/`DESIGN.md` for current product positioning and brand/visual
identity (the project was renamed from "BidPulse" to "First Coast Bids" on
2026-09-19 — see `PROJECT-STATUS.md`'s intro for what that does and doesn't
cover yet). `BUILD-ORDER-BIDPULSE.md` was archived 2026-09-22 (moved to
`archive/`, unique content folded into `PROJECT-STATUS.md`) — don't read it
as current. This file is durable process/convention notes only — things
learned the hard way that should never need re-learning.

## PostgREST embeds break silently when a table gains a second FK

**What happened (2026-09-04):** the attestation-tracking migration added
`submissions.info_attested_by uuid references clients(id)` — a second
foreign key from `submissions` to `clients`, alongside the existing
`client_id`. That silently broke every `.select(...)` in the app that did
a bare `clients(...)` embed from a `submissions` query — PostgREST can no
longer infer which relationship to use, and returns a `PGRST201`
"more than one relationship was found" error at request time, not build
time. **9 files were affected**: the admin inbox list, the admin
submission detail page, fit-check generation, draft generation,
request-info, stage-change notifications, message notifications, the
deliverables-ready auto-trigger, and the client/admin packet
preview-download component. TypeScript catches none of this — the
`.select()` string is untyped. No test suite in this repo would catch it
either. It was found by a real user report of an empty admin inbox, not
by anything automated.

**The rule going forward:** any time a migration adds a new foreign key
from table A to table B, and table A already has *any* other FK to B (or
gains one later), **every existing `.select()` that embeds `B(...)` from
a query on A must be updated to `B!fk_constraint_name(...)`** to
disambiguate. Concretely, right after writing a migration with a new
`references`:

```bash
# find every bare embed of the table you just added an FK to
grep -rn 'clients(' app components lib --include="*.ts" --include="*.tsx"
```

Check each hit — if the query is `.from("submissions")` (or whatever
table now has 2+ FKs to the referenced table), disambiguate it:
`clients!submissions_client_id_fkey(...)`. The FK constraint name is
whatever the migration named it explicitly, or Postgres's auto-generated
`<table>_<column>_fkey` if declared inline (`column_name uuid references
other_table(id)` — this style doesn't show up in a grep for `ADD
CONSTRAINT`, so check for it separately; it still creates a real,
auto-named FK).

**Better yet — disambiguate proactively.** If a table might plausibly
gain a second relationship to something it already embeds (anything
tracking "who did this" alongside an existing ownership column is a
prime candidate — attestation/audit/approval-style columns almost always
end up pointing at the same table an existing owner column already
does), write the embed with an explicit `!fk_name` from the start rather
than waiting for it to break.

## `.env.local` may not point at the same Supabase project as production — verify, don't assume

**What happened (2026-09-11):** a session set out to verify the handoff
claim "migrations are applied to production." It read
`NEXT_PUBLIC_SUPABASE_URL` out of this checkout's `.env.local`
(`hvrwxcyqgjobrgpcequj`) and confirmed migrations against that project —
then reported "production confirmed." That project is actually
**`bidpulse-dev`**. The real production project Vercel serves
`bidpulse.co` from is a different one, **`bidpulse-production`**
(`rixsgnbivayeaxbdseij`), whose env vars live only in Vercel's dashboard,
not in this checkout's `.env.local`. The mix-up was only caught because
a later step tried to log in through a real browser session against the
live site and the network request revealed the actual project host.

Once checked against the real project, it turned out one migration
(`client_past_performance`) genuinely was missing from
`bidpulse-production` — `PROJECT-STATUS.md` had already logged, on
2026-09-05, that this exact migration was "applied directly against the
live production database via the Supabase dashboard SQL editor," which
was almost certainly done against the wrong project too, given the same
underlying confusion. Applying it for real also surfaced a second,
compounding bug: the table *did* eventually turn out to already exist in
`bidpulse-production` (a stale local migration-history record, not a
missing table) — but PostgREST's schema cache didn't know about it
(`PGRST205: Could not find the table ... in the schema cache`), meaning
every real request touching Past Performance had been silently failing
in production. A manual `NOTIFY pgrst, 'reload schema';` in the SQL
editor fixed the live bug; `supabase migration repair --status applied
<version> --linked` fixed the bookkeeping so `db push` stopped erroring
on "relation already exists."

**The rule going forward:** never trust `.env.local`'s
`NEXT_PUBLIC_SUPABASE_URL` as "production" without checking. Before
claiming anything is verified "on production," confirm the actual
project ref two ways:
1. `npx vercel env ls production | grep -i supabase` to see what's
   *configured* for the live deployment (values are masked, but this at
   least confirms Vercel has its own separate set, distinct from
   `.env.local`).
2. A real network request against the live site (a real login attempt
   is enough) — the request host (`<ref>.supabase.co`) is the actual
   answer, not inference from any local file.

Then run `npx supabase login --token <PAT>` (browser-based `supabase
login` doesn't work in this non-TTY environment; a token from
https://supabase.com/dashboard/account/tokens is required) and `npx
supabase link --project-ref <the-real-ref>` before treating any
`migration list` output as authoritative. `supabase db push` also
refuses to insert a migration that's timestamped earlier than migrations
already applied after it, without `--include-all` — expect that error
if a gap gets found and closed out of order.

Separately: after any DDL applied by hand (dashboard SQL editor, direct
psql) rather than through `supabase db push`, don't assume PostgREST
picked it up automatically. Verify with a real REST call
(`GET /rest/v1/<table>?select=id&limit=1` with the project's public
anon/publishable key) — `PGRST205` means the schema cache is stale
(run `NOTIFY pgrst, 'reload schema';`), not necessarily that the table
is missing.

## A Supabase project's Site URL/Redirect URLs can silently route auth emails to the wrong deployment entirely

**What happened (2026-09-12):** a real user report — "the password reset
email takes me back to bidpulse, no option to reset the password," and
separately the magic-link ("sign in without a password") flow doing the
same thing. First hypothesis was an app-code bug (a cross-device PKCE
code_verifier mismatch, or the callback route not handling every URL
shape Supabase can send) — real gaps, and both got fixed
(`app/auth/callback/route.ts` now handles both the `?code=` PKCE shape
and the `?token_hash=&type=` OTP shape, and logs the real error instead
of silently swallowing it), but neither was the actual root cause here.
~25 minutes were spent watching live production logs
(`npx vercel logs bidpulse.co --follow`) for a request that was never
going to arrive, because the failure happened before any meaningful
request ever reached the app.

The real cause: the user was testing against **`bidpulse-dev`** from a
Codespace's forwarded URL (`https://<id>-3000.app.github.dev`, a URL
that's different every Codespace session). That origin was never on
`bidpulse-dev`'s Redirect URLs allow-list, so Supabase fell back to the
project's configured **Site URL** — which was set to
`https://bidpulse-nine.vercel.app`. That URL isn't a dev/test URL at
all — it's one of the **production** Vercel deployment's own aliases
(confirmed via `npx vercel inspect`, listed right alongside
`bidpulse.co`), wired to the **production** Supabase project. So every
auth email issued by the dev project was redirecting straight into a
live, working, completely unrelated production app instance, which
naturally had no idea what to do with a token issued by a different
Supabase project and just showed its own normal (logged-out) login
page — reading exactly like "the link doesn't work," not like "wrong
project entirely."

**The rule going forward:** when an auth email (password reset, magic
link, invite) redirects somewhere unexpected, check the *Supabase
project's own Auth → URL Configuration* (Site URL + Redirect URLs)
*before* assuming it's an app-code bug — this failure mode produces no
error, no failed request, nothing in the app's own logs at all, because
the request never reaches the app in a usable form. Confirm which
Supabase project is actually in play first (this repo has confused dev
vs. production before — see the rule below this one), then check that
project's own dashboard settings, not just the code. For a Codespace
dev environment specifically, whose forwarded URL changes per session,
`bidpulse-dev`'s Site URL should point at a stable local fallback
(`http://localhost:3000`) and its Redirect URLs should include a
wildcard pattern (`https://*.app.github.dev/**`) rather than one
exact, temporary URL that breaks the next time the Codespace restarts.

**Same incident, continued — `bidpulse-production` turned out to have
its own, separate version of this bug**, not fixed by anything above:
its Site URL had never been changed from Supabase's own out-of-the-box
default (`http://localhost:3000`) since the project was created, and
its one Redirect URLs entry was `https://bidpulse.co.` — a trailing
period after `.co` that very likely meant it never matched a single
real request from the actual `https://bidpulse.co` (no dot), and even
without the typo, a bare domain with no `/**` wildcard wouldn't match a
path like `/auth/callback` anyway. Net effect: production's
password-reset/magic-link emails had probably never worked for any
real user. Fixed the same way, directly in `bidpulse-production`'s own
dashboard: Site URL → `https://bidpulse.co`, Redirect URLs →
`https://bidpulse.co/**`.

Also found and fixed a real app-code bug on the way, specific to
running behind a reverse proxy (GitHub Codespaces' own port-forwarding
in dev, and equally possible in front of Vercel in some configs):
`app/auth/callback/route.ts`'s `new URL(request.url).origin` came back
as `https://<name>-3000.app.github.dev:3000` — a literal, invalid
`:3000` appended after a hostname that already encodes its port in its
own `-3000` prefix. Fixed by preferring the `x-forwarded-host`/
`x-forwarded-proto` headers a well-behaved proxy sets, falling back to
the request's own derived origin only when neither header is present.

**Do not run `supabase config push` against either hosted project.**
While looking into branding auth emails via Resend (this app's own
already-verified sending domain), `supabase/config.toml` turned out to
have a real, dangerous `[auth]` section: `site_url =
"http://127.0.0.1:3000"` and `additional_redirect_urls =
["https://127.0.0.1:3000"]` — the Supabase CLI's own local-dev
defaults. `config push` pushes this file wholesale to whichever project
is currently linked, with no flag to scope it to one section (confirmed
via `supabase config push --help`) — running it against
`bidpulse-production` right now would silently undo the Site URL fix
above and re-break production auth emails immediately. This file has
never been audited section-by-section against either hosted project's
real settings (rate limits, JWT expiry, other providers, all
potentially just as stale); don't trust it as a source of truth for
either project without diffing it first.

## Never write a script that deletes more than one row without printing and confirming the count first — and never improvise a "cleanup" script when something unexpected happens

**What happened (2026-09-16):** an agent doing routine QA testing (creating a
throwaway test signup, retrying it) hit "User already registered" on a
retry — account creation happens at intake step 1, not at final submit, so
a second attempt with the same email fails this way by design, not by bug.
Rather than using a fresh email for the retry or stopping to ask, the agent
decided to delete the one stale test account first, and wrote a Node script
against Supabase's GoTrue Admin API to do it: look the user up by
`GET /auth/v1/admin/users?email=<address>`, then delete the id it got back.

**The `email=` query param is not a supported filter on that endpoint.**
GoTrue silently ignores unrecognized query params instead of erroring —
the request returned the *entire* user list, unfiltered, with a `200 OK`
that looked like a normal successful response. The script then looped a
`DELETE` over every user in that list, because it never checked how many
results came back before proceeding — it assumed "the response to my
by-email lookup" meant "one user, the one I asked for." It didn't.

**Result: 46 of 50 real accounts in `bidpulse-dev`'s `auth.users` were
deleted** (4 more got a `500`, left in an unknown state) before anyone
caught it — including several real dev/test client records that predated
that session entirely, not just that session's own throwaway data. Caught
only because a second, unrelated agent working in parallel happened to go
looking for some of the now-missing records and found nothing. This was
`bidpulse-dev`, not production — but nothing about the script itself
would have behaved any differently against a production service-role key,
and this class of destructive-loop bug is exactly as capable of running
there. It happened to be dev only because that's the key sitting in
`.env.local`, easily reachable for routine work — not because anything
about the incident was dev-specific.

**The rules going forward, both non-negotiable:**

1. **Never write or run any script that deletes, or otherwise
   bulk-modifies, more than one row without first printing what it's
   about to act on and getting explicit human confirmation that the count
   and identity of the affected rows match what's actually intended.** A
   "look up by X, then act on the result" script must print the *count*
   of what it got back before doing anything destructive with it — not
   assume the filter worked, verify it. If a lookup that should return
   one row can plausibly return more, treat that as the normal case to
   defend against, not an edge case to ignore.
2. **When something unexpected happens mid-task — an error, a conflict, a
   duplicate, anything — stop and report it or ask, rather than
   improvising a fix that touches data beyond the one thing that's
   actually broken.** A stale test account from a failed retry is solved
   by using a different email for the next attempt, or asking a human to
   clean it up — never by an agent reaching for `DELETE` against
   production-shaped auth infrastructure on its own initiative. This
   applies even (especially) when the fix "should" be narrowly scoped;
   the scope of what a script *actually* does is only as narrow as its
   least-tested assumption, exactly as it wasn't here.
3. Anyone (agent or human) needing to look up a Supabase auth user by
   email via the Admin API should use the SDK's own `listUsers()` (which
   supports real pagination/filter parameters) rather than hand-rolling a
   query string against the REST endpoint, and should always check the
   result count before treating it as "the one match" — this specific
   endpoint's silent-ignore-unknown-params behavior is a real platform
   footgun, not something that will error loudly if gotten wrong.

## When verifying a fix, test the exact query the real code runs — not a simplified proxy

Directly related to the same incident: partway through debugging the
empty-inbox report, a test query was written by hand to check the RLS
policy directly against a real authenticated session — and it returned
data correctly. That test *omitted* the `clients(company_name)` embed
(only selected `id, agency, stage, draft`), so it didn't exercise the
actual broken code path at all — a false "this works" that sent the
investigation toward RLS, hydration, browser extensions, and tunnel
caching before the real bug (a plain PostgREST error, visible in one
line of server-side logging) was found. The lesson: when a "let me
verify this independently" test doesn't reproduce a report, check
whether the test actually used the *same* query/shape as the real code
path before trusting the negative result. A quick `console.log` of the
real server component's actual query result (temporary, server-side
only, removed after) settled this in one request — faster and more
certain than reconstructing a session to run a hand-written proxy query.

## Renaming the GitHub repo silently breaks anything that hardcodes its old slug — GitHub OIDC token claims included

**What happened (2026-09-22):** the repo was renamed on GitHub from
`TJ-stack-del/Bidpulse` to `TJ-stack-del/First_Coast_Bids` (GitHub keeps
the old URL as a redirect, so `git push`/`git fetch` against the old URL
kept working, masking the rename for a while). `lib/auth/github-actions-
oidc.ts`, which verifies the scheduled stage-email-outbox cron's GitHub
OIDC token, hardcoded `REPOSITORY = "TJ-stack-del/Bidpulse"` and a
matching `WORKFLOW_REF` string. GitHub's own OIDC token claims
(`repository`, `workflow_ref`) reflect the *current* repo name at the
moment the token is issued, not whatever name existed when the workflow
was written — so the moment the rename took effect, this equality check
started failing on every run, with no error surfaced anywhere except a
Vercel function returning 401 to a GitHub Actions log nobody was
watching. Caught only incidentally, while doing unrelated domain-
decommissioning work, not because anything alerted on it.

**The rule going forward:** a GitHub repo rename is not just a cosmetic
URL change. Grep the whole codebase for the old `owner/repo` slug
(`grep -rn "TJ-stack-del/<old-name>"`) in the same session as any repo
rename, not as a followup — anywhere it's used for git-push URLs it'll
silently redirect and never surface as broken; anywhere it's compared
against a live value (OIDC claims, webhook payloads, API responses) it
breaks with no visible error until someone happens to check that
specific code path.
