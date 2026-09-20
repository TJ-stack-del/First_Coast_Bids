// A registration that already lapsed is a different, more urgent state
// than "expiring soon" -- this helper only flags the 30-day warning
// window, not an already-expired registration (that's what
// sam_registration_status !== "active" already communicates
// separately in the UI).
const WARNING_WINDOW_DAYS = 30;

export function isSamRegistrationExpiringSoon(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry > 0 && daysUntilExpiry <= WARNING_WINDOW_DAYS;
}
