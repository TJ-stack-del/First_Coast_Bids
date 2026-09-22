# Brief: RFP Extraction Pipeline — Phase 1 (Ingest + Admin Field Extraction)

## Context

BidPulse currently extracts intake pre-fill data from uploaded documents
via an LLM call (`route (2).ts` — Anthropic API, PDF → JSON). This brief
starts a **separate, deterministic (non-LLM) pipeline** for extracting
structured data from full RFP/solicitation PDFs — due date, NAICS, set-
aside, page limits, etc. — to eventually feed the Compliance Matrix,
Technical Narrative, and Capability Statement.

Full design reference: `rfp-extraction-pipeline-design.md` (attached).
This brief covers **only Phase 1** of that design's §9 build order:
ingest + layout extraction + admin field regex. Do not build section
segmentation, obligation harvesting, or table extraction yet — those are
later phases, scoped separately once this phase is verified.

**Do not modify `route (2).ts`, `route (3).ts`, or `route (4).ts`.** This
is new, additive code that runs alongside the existing LLM-based
extraction — nothing about the current pipeline changes or gets removed
in this phase.

## Scope

Build a new, standalone Python module (not wired into the Next.js app
yet — that's a later integration step) that:

1. **Ingests a PDF** using PyMuPDF (`fitz`), returning per-page text
   with layout metadata (font size, bold, bounding box) per the `load_pdf`
   pattern in the design doc, §2 Stage 1.
2. **Detects OCR fallback need**: if a page's extracted text is empty
   or near-empty, run Tesseract OCR (`pytesseract` + `pdf2image`) on
   that page instead, and flag it (`extraction_method: "ocr_regex"`,
   `confidence: "low"` per design doc §7).
3. **Extracts the admin fields** listed in design doc §5:
   `due_date`, `naics_code`, `set_aside`, `contract_type`, `page_limit`,
   `solicitation_number`. Use the regex patterns in §5 as a starting
   point — expect to refine them against real documents (see Evidence
   below).
4. **Emits the output schema** from design doc §6 — just the
   `document` and `admin_fields` sections (the rest of the schema is
   later phases). Every extracted field must include `provenance`
   (page, quote, matched_pattern) exactly as specified — no field
   without a page/quote is acceptable output.
5. **Handles conflicts deterministically**: if a field matches more
   than once with different values (e.g. two different dates), output
   both as `candidates` with `resolved: false` — do not guess which is
   correct (design doc §8, "Conflicting/duplicate values" row).

## Test fixtures

Use the real synthetic test RFP already in the mock data ecosystem:
`RFP-2026-0847-JANI` (City of Jacksonville). If real, non-synthetic RFP
PDFs from JAA/JEA/City of Jacksonville are available (actual scraped or
manually-collected solicitations, not the synthetic persona documents),
run the pipeline against those too — real agency formatting is what the
regex patterns actually need to be tuned against, and the synthetic
document alone won't surface real-world formatting variance.

## Evidence required (per BidPulse evidence standard — no self-certification)

For each of the following, provide the **actual extracted JSON output**,
not a description of what it should contain:

- [ ] Raw JSON output for `RFP-2026-0847-JANI.pdf`, with every
      `admin_fields` value shown alongside the exact source PDF page
      screenshot or page-text excerpt it was pulled from, side by side,
      so the match can be visually verified.
- [ ] If any additional real (non-synthetic) RFP PDF is available: same
      side-by-side output for that document too.
- [ ] At least one deliberately malformed/edge-case input tested and
      shown: (a) a page with no admin fields present at all — confirm
      it returns `null`/empty rather than a false match, and (b) if
      feasible, a scanned/image-only page — confirm OCR fallback fires
      and the result is flagged `low` confidence, not treated as
      equal-confidence to digital extraction.
- [ ] A short written note on which regex patterns from §5 fired
      correctly, which needed adjustment, and why — this is the
      evidence that patterns were validated against real text, not
      assumed correct from the design doc alone.

## Explicitly out of scope for this phase

- Section segmentation / synonym map (Phase 2)
- Obligation-language harvesting for the Compliance Matrix (Phase 3)
- Table extraction — CLINs, evaluation factors, deliverables (Phase 4)
- Any integration into the Next.js app, Supabase, or the intake wizard
- Any change to existing routes or the current LLM-based extraction

## Deliverable

A Python module + a short `README.md` documenting how to run it
locally, plus the evidence outputs above. No deployment, no app
integration — this phase is proving the extraction is accurate against
real documents before anything gets wired into the product.
