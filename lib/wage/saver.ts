// Autosave for the wage worksheet (final review, 2026-09-25): edits are
// debounced; only one save is in flight at a time and the newest values
// always win (an older save can't land after a newer one); a failed save
// shows as failed and can be retried; flush() sends a pending edit right
// away, for when the admin leaves the page.

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function createSaver<T>(opts: {
  send: (payload: T) => Promise<boolean>;
  onStatus: (s: SaveStatus) => void;
  delay?: number;
}) {
  let pending: T | null = null;
  let hasPending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  async function run(): Promise<void> {
    timer = null;
    if (inFlight) return inFlight;
    if (!hasPending) return;
    const payload = pending as T;
    hasPending = false;
    opts.onStatus("saving");
    inFlight = (async () => {
      let ok = false;
      try {
        ok = await opts.send(payload);
      } catch {
        ok = false;
      }
      inFlight = null;
      if (hasPending) {
        // Newer edits arrived while saving: send them now.
        await run();
        return;
      }
      if (!ok) {
        pending = payload;
        hasPending = true;
      }
      opts.onStatus(ok ? "saved" : "error");
    })();
    return inFlight;
  }

  return {
    schedule(payload: T) {
      pending = payload;
      hasPending = true;
      opts.onStatus("saving");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), opts.delay ?? 800);
    },
    flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return run();
    },
    retry(): Promise<void> {
      return run();
    },
  };
}
