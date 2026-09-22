// Relative import with an explicit .ts extension, not the "@/" alias --
// that alias is resolved by Next.js's own bundler via tsconfig `paths`,
// which plain `node --experimental-strip-types` (this project's test
// runner, since this file is imported from a .test.ts file) knows nothing
// about and fails to resolve. Node's ESM loader also requires the
// extension on a relative import; tsconfig.json now has
// allowImportingTsExtensions enabled (needed here for the first time --
// no prior real source file in this repo imported another real source
// file that was also exercised directly by the test runner) so tsc
// accepts it too.
import { parseLocalDate } from "../compliance/expiring-soon.ts";

// A registration that already lapsed is a different, more urgent state
// than "expiring soon" -- this helper only flags the 30-day warning
// window, not an already-expired registration. That state is instead
// handled by a separate, independent conditional in
// app/dashboard/page.tsx that renders whenever a client has a sam_uei
// on file and sam_registration_status is set to anything other than
// "active".
const WARNING_WINDOW_DAYS = 30;

// sam_registration_expires_at is a DATE column ("2026-10-10", no time/
// zone) -- parsing it with plain `new Date(str)` reads it as UTC midnight,
// which silently shifts "today" by a day for any US timezone (this app's
// whole market, all behind UTC). Reuses this codebase's own existing
// timezone-safe parseLocalDate (lib/compliance/expiring-soon.ts) instead
// of reintroducing a bug class that file's own comments already document
// as fixed once.
export function isSamRegistrationExpiringSoon(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const expiry = parseLocalDate(expiresAt);
  const daysUntilExpiry = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry > 0 && daysUntilExpiry <= WARNING_WINDOW_DAYS;
}
