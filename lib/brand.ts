// Plain words for what the business does (2026-10-30); the old "Integrated
// proposal engine for public work..." line read as machine-written.
export const TAGLINE = "Government bid paperwork for small trade businesses in Northeast Florida";

// Shared verbatim so the client badge (CertificationsSection.tsx) and the
// admin badge/toggle (ClientCertifications.tsx) can't drift from each
// other — same wording everywhere "Document Reviewed" appears, softened
// deliberately from "Verified" so neither a client nor an agency reviewer
// reads it as First Coast Bids confirming current standing with the issuing
// agency, which admin review never actually does (it's a document check).
export const CERT_REVIEWED_TOOLTIP =
  "First Coast Bids staff reviewed the uploaded document for this credential. This does not confirm current standing with the issuing agency.";
