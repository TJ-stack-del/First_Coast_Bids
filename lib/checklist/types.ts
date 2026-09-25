// Shared shapes for the submission checklist
// (docs/superpowers/specs/2026-09-25-submission-checklist-design.md).

export const KINDS = [
  "form",
  "amendment",
  "bond",
  "sworn_statement",
  "license_insurance",
  "submission_rule",
  "wage_determination",
  "far_provision",
  "sam_registration",
  "evaluation_method",
  "other",
] as const;
export type Kind = (typeof KINDS)[number];

export type Owner = "client" | "admin";
export type QuoteStatus = "verified" | "not_found" | "unreadable";

// One item found in a solicitation, before it's saved as a suggestion.
// `key` identifies the same requirement across detectors, AI chunks and
// re-scans (e.g. "form:sf-1449", "wd:2015-4523"); null means "derive it
// from kind + label".
export type Candidate = {
  kind: Kind;
  federal: boolean;
  label: string;
  detail: string | null;
  quote: string;
  page: number | null;
  source_file: string | null;
  found_by: "ai" | "detector";
  key: string | null;
  suggested_owner: Owner;
};

const ADMIN_KINDS: readonly Kind[] = ["submission_rule", "evaluation_method", "wage_determination", "sam_registration"];

// Who normally handles each kind: the client signs, attaches and certifies;
// the admin checks rules, pricing inputs and registration. The admin can
// change any owner before approving.
export function defaultOwner(kind: Kind): Owner {
  return ADMIN_KINDS.includes(kind) ? "admin" : "client";
}
