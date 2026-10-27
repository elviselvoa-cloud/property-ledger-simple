export type GeneratedUnit = { unit_number: string; floor: string | null };

export type RuleOptions = { suffix?: string; pad?: number };

/**
 * Expand a naming rule like prefix "A", 1–12 into A1…A12.
 * `pad` zero-pads the number (pad=2 → A01, A02, …). `suffix` is appended.
 */
export function generateFromRule(
  prefix: string,
  start: number,
  end: number,
  opts: RuleOptions = {}
): GeneratedUnit[] {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return [];
  if (start > end) return [];
  const pad = opts.pad ?? 0;
  const suffix = opts.suffix ?? "";
  const out: GeneratedUnit[] = [];
  for (let n = start; n <= end; n++) {
    const num = pad > 0 ? String(n).padStart(pad, "0") : String(n);
    out.push({ unit_number: `${prefix}${num}${suffix}`, floor: null });
    if (out.length >= 500) break; // hard cap for safety
  }
  return out;
}

/**
 * Guess a floor label from a unit name: G/GF/G1-style names map to "Ground",
 * names starting with digits use that number as the floor, others stay null.
 */
export function autoDetectFloor(unitNumber: string): string | null {
  const name = unitNumber.trim();
  if (/^g(?:f)?(?:\D|$)/i.test(name)) return "Ground";
  const m = name.match(/^(\d+)/);
  return m ? m[1] : null;
}

/**
 * Parse a freeform list of unit names separated by newlines, commas or
 * semicolons. Blanks are dropped and duplicates (case-insensitive) removed.
 */
export function parseUnitList(text: string): GeneratedUnit[] {
  const seen = new Set<string>();
  const out: GeneratedUnit[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ unit_number: name, floor: autoDetectFloor(name) });
    if (out.length >= 500) break;
  }
  return out;
}
