# Archive

Superseded docs, moved here 2026-09-22 during a documentation
consolidation pass rather than deleted — each file below is unchanged
from its last version, just relocated. `PROJECT-STATUS.md` at the repo
root is the current status/handoff doc; every genuinely new fact these
files contained that wasn't already in `PROJECT-STATUS.md` was folded
into it (see that file's own "Related docs" section for exactly where).

- **`BUILD-ORDER-BIDPULSE.md`** — a build-order/queue doc that tracked
  the same "what's next" ground as `PROJECT-STATUS.md`'s own "Currently
  Open" list, but stopped being updated around 2026-09-09 while
  `PROJECT-STATUS.md` kept going. By the time it was archived it was
  ~90% duplicate of `PROJECT-STATUS.md` with a couple of genuinely
  missing items (a CI-secrets action item, a "RequestInfoForm picker"
  confirmed-working entry) — both now folded into `PROJECT-STATUS.md`.
- **`CODESPACE-REBUILD-HANDOFF.md`** — a single dated session snapshot
  from 2026-09-05. Superseded by `PROJECT-STATUS.md`'s own ongoing
  narrative; its one genuinely new fact (codespace idle-timeout being a
  recurring nuisance) is now in `PROJECT-STATUS.md`'s Working Style
  Notes.
- **`MIGRATION-TO-BIDPULSE.md`** — the original plan for migrating this
  project from a self-serve tool to the done-for-you service it is
  today. Fully executed; purely historical now.
- **`BRIEF-rfp-extraction-phase1.md`** / **`BRIEF-rfp-extraction-
  phase2.md`** — specs for the original RFP-extraction Phase 1+2 build,
  which lived under a `rfp-extraction/` directory that no longer exists
  in this repo (rebuilt independently, later, under `rfp-extractor/` via
  a separate PR). The current module has its own, more accurate docs
  (`rfp-extractor/README.md` and its `evidence/` folder) — read those
  instead of these briefs for how the current implementation actually
  works. Kept here since they may still be useful context for anyone
  building the still-unbuilt Phase 3/4 against the current module.
