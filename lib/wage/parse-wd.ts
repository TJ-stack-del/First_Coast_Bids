// Reads a Service Contract Act wage determination (the fixed Department of
// Labor text layout) with plain code -- never AI -- because every value here
// becomes money. Verified against two real WDs (2015-4539 Rev. 32,
// Jacksonville area; 2015-4523 Rev. 36, Georgia). If anything required is
// missing, nothing is returned: the worksheet never shows half-read numbers.

export type WdPosition = { code: string; title: string; rate: number; footnote: string | null };

export type ParsedWd = {
  number: string;
  revision: number;
  revisedOn: string | null;
  state: string | null;
  area: string | null;
  positions: WdPosition[];
  hwPerHour: number;
  hwEo13706PerHour: number | null;
  vacationWeeks: number | null;
  holidays: number | null;
  eo13658Min: number | null;
  paidSickLeave: boolean;
};

const WORD_NUMBERS: Record<string, number> = Object.fromEntries(
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty"
    .split(" ")
    .map((w, i) => [w, i])
);

function toNumber(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word);
  return WORD_NUMBERS[word.toLowerCase()] ?? null;
}

// "11150 - Janitor                     17.04"
// "11150 - Janitor              1      17.04*"   (footnote column, asterisk)
const POSITION_LINE = /^(\d{5}) - (.+?)\s{2,}(?:(\d+)\s+)?(\d+\.\d{2})\*?\s*$/gm;

// Some titles wrap: "15010 - Aircrew Training Devices Instructor" then
// "(Non-Rated)      33.88" on the next line. Join such pairs first.
const WRAPPED_TITLE = /^(\d{5} - [^\n]*?)[ \t]*\n(?!\s*\d{5} - )([^\n]*\d+\.\d{2}\*?[ \t]*)$/gm;

export function parseWd(text: string): { ok: boolean; wd: ParsedWd | null; missing: string[] } {
  const flat = text.replace(/\s+/g, " ");
  const number = text.match(/Wage Determination No\.:\s*(\d{4}-\d{4})/)?.[1] ?? null;
  const revision = text.match(/Revision No\.:\s*(\d+)/)?.[1];
  const revisedOn = text.match(/Date Of Last Revision:\s*([\d/]+)/)?.[1] ?? null;
  const state = text.match(/^State:\s*(.+?)\s*$/m)?.[1] ?? null;
  const areaRaw = text.match(/^Area:\s*([\s\S]+?)\n\s*\n/m)?.[1];
  const area = areaRaw ? areaRaw.replace(/\s+/g, " ").trim() : null;

  const positions: WdPosition[] = [];
  const joined = text.replace(WRAPPED_TITLE, "$1 $2");
  POSITION_LINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = POSITION_LINE.exec(joined)) !== null) {
    positions.push({ code: m[1], title: m[2].replace(/\s+/g, " ").trim(), rate: Number(m[4]), footnote: m[3] ?? null });
  }

  const hw = flat.match(/HEALTH & WELFARE:\s*\$(\d+\.\d{2}) per hour/);
  const hw13706 = flat.match(/HEALTH & WELFARE EO 13706:\s*\$(\d+\.\d{2}) per hour/);
  const vac = flat.match(/VACATION:\s*(\w+) weeks? paid vacation after (\w+) years?/i);
  const hol = flat.match(/HOLIDAYS:\s*A minimum of (\w+) paid holidays/i);
  const eo = flat.match(/Executive Order 13658[\s\S]{0,600}?at least \$(\d+\.\d{2}) per hour/);
  const paidSickLeave = /1 hour of paid sick leave for every 30 hours/i.test(flat);

  const missing: string[] = [];
  if (!number) missing.push("wage determination number");
  if (!revision) missing.push("revision number");
  if (positions.length === 0) missing.push("position rates");
  if (!hw) missing.push("health & welfare rate");
  if (missing.length > 0) return { ok: false, wd: null, missing };

  return {
    ok: true,
    missing: [],
    wd: {
      number: number!,
      revision: Number(revision),
      revisedOn,
      state,
      area,
      positions,
      hwPerHour: Number(hw![1]),
      hwEo13706PerHour: hw13706 ? Number(hw13706[1]) : null,
      vacationWeeks: vac ? toNumber(vac[1]) : null,
      holidays: hol ? toNumber(hol[1]) : null,
      eo13658Min: eo ? Number(eo[1]) : null,
      paidSickLeave,
    },
  };
}
