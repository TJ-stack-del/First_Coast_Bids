export const TAGLINE =
  "Integrated proposal engine for public work, regional contractors & compliant bids";

// Shared verbatim so the client badge (CertificationsSection.tsx) and the
// admin badge/toggle (ClientCertifications.tsx) can't drift from each
// other — same wording everywhere "Document Reviewed" appears, softened
// deliberately from "Verified" so neither a client nor an agency reviewer
// reads it as First Coast Bids confirming current standing with the issuing
// agency, which admin review never actually does (it's a document check).
export const CERT_REVIEWED_TOOLTIP =
  "First Coast Bids staff reviewed the uploaded document for this credential. This does not confirm current standing with the issuing agency.";
