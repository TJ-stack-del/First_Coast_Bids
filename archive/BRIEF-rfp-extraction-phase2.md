# Brief: RFP Extraction Pipeline — Phase 2 (Section Segmentation + Synonym Map)

## Context

Phase 1 (ingest + layout extraction + admin-field regex) is closed —
see `NOTES.md` from that phase for real evidence, including two real
bugs found and fixed against an actual production RFP fixture. Full
design reference: `rfp-extraction-pipeline-design.md`, §3 and §9 step 3.

This phase builds **Stage 3** of the pipeline: mapping detected headings
to a canonical section taxonomy (the Uniform Contract Format's A–M
structure, or the closest local-agency equivalent) via a synonym map.
This is explicitly *not* the phase that extracts actual requirements or
obligation language — that's Phase 3. This phase only organizes the
document into sections so Phase 3 has something structured to work with.

**Do not build Phase 3 (obligation harvesting), Phase 4 (table
extraction), or any wiring into the Next.js app in this phase.** Stay
standalone, same as Phase 1 — this remains a Python module, not
integrated into the product yet.

## Real constraint driving this brief's scope

**Only mock/synthetic RFP fixtures are available right now** — no real
downloaded JAA/JEA/City of Jacksonville solicitations exist yet. The
design doc's own §9 guidance says to build this synonym map
"empirically against 8–10 real solicitations... before generalizing" —
that's not possible yet. **Decided approach (Mike, 2026-09-09): build
for adaptability now, refine against real documents as they arrive,**
rather than blocking this phase on gathering a real-document corpus
first. This is only a sound decision if the two requirements below are
actually built in — they are not optional extras, they're what makes
"adapt as we go" a real, working mechanism instead of a hope.

## Scope

1. **Heading detection**, per design doc §2 Stage 2 — using Phase 1's
   layout metadata (font size, bold, position) plus the numbering
   patterns already defined there (`SECTION L`, `3.2.1`, `Article IV`,
   etc.). This may already be partially covered by Phase 1's output —
   check before rebuilding; only add what's missing for heading
   *detection* specifically (Phase 1 focused on admin-field regex, not
   necessarily full heading cataloguing).

2. **Canonical section taxonomy + synonym map**, per design doc §3 —
   build `SECTION_SYNONYMS` (or equivalent) as a **plain, data-driven
   lookup table** — not embedded logic, not hardcoded conditionals. This
   is a real, explicit requirement: the map needs to be trivially
   editable later (add one list entry) when a real gap is found, not a
   structural code change. Cover at minimum the section types the design
   doc names: instructions to offerors, evaluation factors, scope of
   work, plus "definitions" (needed later for Phase 3's obligation
   filtering, per design doc §8's definitional-sentence edge case — fine
   to add the taxonomy entry now even though the filtering logic itself
   is Phase 3).

3. **The `unresolved.unclassified_headings` mechanism — build this for
   real, it's not optional.** Every detected heading that doesn't match
   any synonym-map entry must be captured and surfaced in the output,
   exactly per the design doc's §6 output schema
   (`unresolved.unclassified_headings: [{text, page}]`). This is the
   actual feedback loop that makes the "adapt as we go" decision work —
   without it, gaps in the synonym map just silently produce
   unclassified content forever with no way to notice or fix it.
   **Decide and document where this actually surfaces for Mike to see**
   — even something simple (a summary count + list printed at the end
   of a real run, or written to a small report file) is fine for this
   phase; it just has to be something Mike will actually look at, not
   buried in a JSON blob nobody opens.

4. **Multi-column layout handling**, per design doc §8's relevant row —
   if the test fixtures include or can be made to include a multi-column
   layout, verify blocks get reordered column-by-column before heading/
   section assignment. If no fixture currently exercises this, note it
   as untested rather than claiming it works.

## Test fixtures

Same constraint as Phase 1: only the mock/synthetic fixtures currently
available (`RFP-2026-0847-JANI` and whatever else exists in
`test-fixtures/`). **No real agency solicitation is available for this
phase either** — this needs to be stated plainly in the evidence, not
glossed over.

## Evidence required (per BidPulse's evidence standard — no self-certification)

- [ ] Real output showing every detected heading in the test fixture(s)
      mapped to its canonical section (or correctly landing in
      `unresolved.unclassified_headings` if no match exists) — shown
      alongside the actual source heading text and page, not just a
      final summary count.
- [ ] At least one deliberately unmappable heading tested — confirm it
      correctly lands in `unclassified_headings` rather than being
      force-matched to the nearest-sounding canonical section. If the
      current fixtures don't naturally contain one, add a synthetic
      example specifically to prove this path works, and say so plainly
      in the evidence (this is a deliberately constructed test, not a
      naturally occurring one).
- [ ] A real demonstration of where `unclassified_headings` actually
      surfaces after a run — show the actual output/report a real person
      would see, not just confirm the field exists in the JSON.
- [ ] **Explicit, stated limitation:** this phase's synonym map is
      validated against synthetic fixtures only. No real agency
      solicitation was available to test against. This is a known gap,
      not a hidden one — the map should be treated as a first draft
      requiring a second real-document verification pass once real
      solicitations become available, not a finished result.
- [ ] A short written note on any heading, from the available fixtures,
      that was genuinely ambiguous or hard to classify, and how it was
      handled — same "show your work" standard as Phase 1's regex
      adjustment notes.

## Explicitly out of scope for this phase

- Obligation-language harvesting for the Compliance Matrix (Phase 3)
- Table extraction — CLINs, evaluation factors, deliverables (Phase 4)
- Any integration into the Next.js app, Supabase, or the intake wizard
- Sourcing real agency RFP documents (a separate, non-code task for
  Mike — worth doing soon, but not blocking this phase)
- Any change to Phase 1's existing code, or the existing LLM-based
  intake extraction routes

## Deliverable

Extends the Phase 1 Python module with section-segmentation + synonym-
map capability, plus the evidence outputs above. Still no deployment, no
app integration — this phase is proving the segmentation approach is
sound and the adaptability mechanism (`unclassified_headings`) genuinely
works, before Phase 3 builds obligation harvesting on top of it.
