// Language support: English is the language the pages are written in. For Arabic every visible text is looked up
// in the dictionary (lib/i18n/ar/index.ts, keys are the exact English texts). A text with no entry stays in English.
export type Lang = "en" | "ar";
export const LANG_COOKIE = "lang";
export const isLang = (v: unknown): v is Lang => v === "en" || v === "ar";

export type Dictionary = Record<string, string>;

const SPACE = /\s+/g;
const REGEX_CHARS = /[.*+?^${}()|[\]\\]/g;

const MONTHS: Record<string, string> = {
  Jan: "يناير", Feb: "فبراير", Mar: "مارس", Apr: "أبريل", May: "مايو", Jun: "يونيو",
  Jul: "يوليو", Aug: "أغسطس", Sep: "سبتمبر", Oct: "أكتوبر", Nov: "نوفمبر", Dec: "ديسمبر",
};
const DATE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (\d{1,2}), (\d{4})/g;
/** "Oct 31, 2026" -> "31 أكتوبر 2026" */
export const arabicDates = (t: string) => t.replace(DATE, (_m, mon: string, d: string, y: string) => `${d} ${MONTHS[mon]} ${y}`);

export interface Translator {
  /** Translates one text, keeping the spaces around it. Returns null when there is nothing to change. */
  (text: string): string | null;
}

/** Builds a translator: exact texts first, then patterns such as "{} applications" (each {} matches any text). */
export function buildTranslator(dict: Dictionary): Translator {
  const exact = new Map<string, string>();
  const patterns: { re: RegExp; to: string }[] = [];
  for (const [en, ar] of Object.entries(dict)) {
    if (en.includes("{}")) {
      const re = new RegExp("^" + en.split("{}").map((p) => p.replace(REGEX_CHARS, "\\$&")).join("(.{0,60}?)") + "$");
      patterns.push({ re, to: ar });
    } else exact.set(en, ar);
  }

  /** The Arabic for an already trimmed text, or null. Pieces matched by {} are translated too ("Delivery in {}" + "2 days"). */
  const find = (trimmed: string, depth: number): string | null => {
    const hit = exact.get(trimmed);
    if (hit !== undefined) return hit;
    for (const { re, to } of patterns) {
      const m = re.exec(trimmed);
      if (m) {
        let i = 0;
        return to.replace(/\{\}/g, () => {
          const piece = m[++i] ?? "";
          return (depth < 2 && /[A-Za-z]/.test(piece) ? find(piece.trim(), depth + 1) : null) ?? piece;
        });
      }
    }
    return null;
  };

  return (text) => {
    const trimmed = text.replace(SPACE, " ").trim();
    if (!trimmed || !/[A-Za-z]/.test(trimmed)) return null;
    const ar = find(trimmed, 0);
    if (ar === null) {
      const dated = arabicDates(text);
      return dated === text ? null : dated;
    }
    const lead = /^\s*/.exec(text)![0];
    const trail = /\s*$/.exec(text)![0];
    return lead + arabicDates(ar) + trail;
  };
}
