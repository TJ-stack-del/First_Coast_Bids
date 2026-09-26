// Real ask: a lot of admin review time is likely spent re-confirming
// things the software already knows (mandatory fields present,
// certification verified status) rather than the genuinely judgment-
// requiring parts. This computes a small set of mechanical checks —
// never an LLM judgment call, same reasoning as every other compliance
// detector in this codebase — so attention goes straight to what's
// actually ambiguous. See the admin how-to's review checklists (components/ui/AdminHowToContent.tsx): the
// bracketed-placeholder check here is a direct, mechanical version of
// that rubric's first line item.

// Duplicated from PacketButtons.tsx/deliverables-packet.ts rather than
// extracted to a shared constant -- those two already independently
// define the same lists; adding a third copy here follows the existing
// pattern rather than refactoring unrelated, already-working files.
const FULL_ORDER = ["capability_statement", "compliance_matrix", "technical_narrative"];
const LEAN_ORDER = ["rate_sheet", "executive_cover", "certificate_of_insurance"];

// Matches a bracketed placeholder like [ADD: ...] or [Client name] --
// deliberately requires at least one character inside the brackets so it
// doesn't false-positive on stray "[]" text, and only looks inside actual
// deliverable content, never scope/agency text a client wrote themselves.
//
// No "g" flag: this same pattern object is reused across every deliverable
// via .test() below, and a global regex's .test() is stateful (it advances
// lastIndex on a match and resumes from there on the next call instead of
// starting at 0) -- across several different strings in a row that silently
// makes real matches come back false. Cost a real submission's admin badge
// an accurate count (2 shown, 3 actually had placeholders) before this fix.
const PLACEHOLDER_PATTERN = /\[[^\[\]]+\]/;

export type PreflightCheck = {
  key: string;
  label: string;
  ok: boolean;
};

export function computePreflightSummary(input: {
  deliverables: { deliverable_type: string; content: string | null; file_url: string | null }[];
  certifications: { verified: boolean }[];
}): PreflightCheck[] {
  const isLean = input.deliverables.some((d) => LEAN_ORDER.includes(d.deliverable_type));
  const requiredTypes = isLean ? LEAN_ORDER : FULL_ORDER;

  const missingTypes = requiredTypes.filter((type) => {
    const d = input.deliverables.find((x) => x.deliverable_type === type);
    return !d || (!d.content?.trim() && !d.file_url);
  });

  const verifiedCount = input.certifications.filter((c) => c.verified).length;
  const unverifiedCount = input.certifications.length - verifiedCount;

  const deliverablesWithPlaceholders = input.deliverables.filter(
    (d) => d.content && PLACEHOLDER_PATTERN.test(d.content)
  ).length;

  const checks: PreflightCheck[] = [
    {
      key: "deliverables_present",
      label:
        missingTypes.length === 0
          ? `All ${requiredTypes.length} deliverables have content`
          : `${requiredTypes.length - missingTypes.length}/${requiredTypes.length} deliverables have content`,
      ok: missingTypes.length === 0,
    },
    {
      key: "certifications_verified",
      label:
        input.certifications.length === 0
          ? "No certifications on file"
          : unverifiedCount === 0
            ? `${verifiedCount} certification${verifiedCount === 1 ? "" : "s"} verified`
            : `${verifiedCount} verified, ${unverifiedCount} not yet reviewed`,
      ok: unverifiedCount === 0,
    },
    {
      key: "no_placeholders",
      label:
        deliverablesWithPlaceholders === 0
          ? "No bracketed placeholders remaining"
          : `${deliverablesWithPlaceholders} deliverable${deliverablesWithPlaceholders === 1 ? "" : "s"} still ha${deliverablesWithPlaceholders === 1 ? "s" : "ve"} bracketed placeholders`,
      ok: deliverablesWithPlaceholders === 0,
    },
  ];

  return checks;
}
