# BidPulse — Codespace Rebuild Brief

Run this in a fresh Codespace to fully restore the dev environment: deps,
Vercel link, Supabase link, env vars, and a verification pass. Follow in
order — later steps assume earlier ones succeeded.

---

## 1. Install Node dependencies

```bash
npm install
```

Confirms package.json resolves cleanly. If this fails, stop and report the
error before continuing — nothing downstream will work on a broken install.

---

## 2. Reconnect Vercel CLI and pull env vars

```bash
npm install -g vercel
vercel login
vercel link
```

When `vercel link` prompts for a project, select the existing `bidpulse-nine`
project — do NOT create a new one.

```bash
vercel env pull .env.local
```

This overwrites `.env.local` with whatever Vercel has stored. If `.env.local`
already exists locally with values not in Vercel, back it up first:

```bash
cp .env.local .env.local.backup 2>/dev/null || true
vercel env pull .env.local
diff .env.local.backup .env.local
```

Report any keys present in the backup but missing from the pulled version —
those need to be re-added to Vercel's dashboard manually (Settings →
Environment Variables), not just kept locally, or they won't survive the
next deploy either.

---

## 3. Reconnect Supabase CLI and pull schema baseline

```bash
npm install supabase --save-dev
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

Replace `<PROJECT_REF>` with the actual Supabase project ref (found in the
Supabase dashboard URL or project settings).

Since schema changes have historically been applied freehand in the SQL
editor with no migration history, use this rebuild as the point to
establish a real baseline:

```bash
npx supabase db pull
```

This generates a migration file representing the live schema as it
currently stands. Commit this file — it becomes migration zero. Do NOT
run `supabase db push` afterward; the goal here is just to capture what
already exists, not to change anything live.

---

## 4. Verify required environment variables are present

Check `.env.local` contains all of the following (do not print values,
just confirm presence):

```bash
for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY ANTHROPIC_API_KEY RESEND_API_KEY \
  ADMIN_DIGEST_EMAIL CRON_SECRET SAM_GOV_API_KEY; do
  if grep -q "^${key}=" .env.local; then
    echo "OK: $key present"
  else
    echo "MISSING: $key"
  fi
done
```

Report any MISSING lines — these need to be added in the Vercel dashboard
and re-pulled, not typed directly into `.env.local` (so they stay in sync
for future rebuilds).

---

## 5. Confirm GitHub auth

```bash
gh auth status
```

If not authenticated:

```bash
gh auth login
```

---

## 6. Start dev server and smoke-test

```bash
npm run dev
```

Then, in a second terminal, hit a couple of real endpoints to confirm
live connections (adjust port if not 3000):

```bash
# Confirms Supabase connection + admin client
curl -s http://localhost:3000/api/health 2>/dev/null || echo "No /api/health route — manually check admin dashboard loads real client data instead"

# Confirms CRON_SECRET wiring (expect 401 without the header — that's correct)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/daily-digest
```

Expected: the digest route returns `401` with no auth header (proves
CRON_SECRET check is active, not that it's broken). A `500` or connection
refused means something's actually wrong.

Then manually:
- Load `/admin` in the browser — confirm real client/submission rows appear
  (not an empty or errored state)
- Trigger one AI route (e.g. fit-check on an existing submission) to
  confirm `ANTHROPIC_API_KEY` is live and returning real JSON, not an
  auth error

---

## 7. Report back

Summarize for Mike:
- Any MISSING env vars from step 4
- Whether `supabase db pull` succeeded and what the generated migration
  file is named
- Whether the admin dashboard loaded real data
- Whether the fit-check test call succeeded
- Current Resend domain verification status if checkable (SPF/DKIM in
  IONOS for bidpulse.co) — not required for this rebuild, but worth
  surfacing since it's already an open item

Do not mark this brief "done" without pasting the actual terminal output
for steps 4 and 6 — consistent with the evidence standard, no
self-certification.
