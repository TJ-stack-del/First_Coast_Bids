// SAM.gov records federal agencies as capitalised, dot-separated paths
// ("DEPT OF DEFENSE.DEPT OF THE AIR FORCE"). For display, show the first two
// distinct levels as normal words. Names that already contain lowercase
// letters (local agencies, anything typed by a person) are left untouched.

const SMALL = new Set(["of", "the", "and", "for", "on", "in", "at", "to", "a"]);
const WORDS: Record<string, string> = { DEPT: "Department", ADMIN: "Administration" };

function word(w: string, first: boolean): string {
  if (WORDS[w]) return WORDS[w];
  const letters = w.replace(/[^A-Z]/g, "");
  // Short tokens with no vowels, or 2-4 letter all-caps tokens that aren't
  // small words, are acronyms (FAS, NASA, VA, DHS).
  if (letters && (!/[AEIOUY]/.test(letters) || (letters.length <= 4 && !SMALL.has(w.toLowerCase()) && !/^(DEPT|WEST|EAST|FORT|ARMY|AIR|NAVY|LAND|PARK|CITY|SEA|MAIN)$/.test(letters)))) return w;
  const lower = w.toLowerCase();
  if (!first && SMALL.has(lower)) return lower;
  return lower.replace(/(^|[-(/])([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

function titleCase(segment: string): string {
  return segment
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const comma = w.endsWith(",");
      const core = comma ? w.slice(0, -1) : w;
      return word(core, i === 0) + (comma ? "," : "");
    })
    .join(" ");
}

export function displayAgency(agency: string): string {
  if (!agency || /[a-z]/.test(agency)) return agency;
  const parts = [...new Set(agency.split(".").map((p) => p.trim()).filter(Boolean))].slice(0, 2);
  return parts.map(titleCase).join(" · ");
}
