/**
 * Spoken text → Tenner (ALEXA-004). Pure and deterministic. A match is only "clear" when the best candidate scores
 * high and is well ahead of the next one; everything else asks the user. Never guesses.
 */

export interface MatchCandidate {
  readonly tennerId: string;
  readonly title: string;
  /** Due today or overdue (for the speaker): slightly preferred on near-ties. */
  readonly due: boolean;
}

export type MatchResult =
  | { readonly kind: "clear"; readonly tenner: MatchCandidate; readonly score: number }
  | { readonly kind: "ambiguous"; readonly options: readonly MatchCandidate[]; readonly score: number }
  | { readonly kind: "none"; readonly score: number };

/** Thresholds (0–1): clear above CLEAR with a lead of at least LEAD; candidates to ask about from ASK. */
export const MATCH_THRESHOLDS = { clear: 0.8, lead: 0.15, ask: 0.5, dueBonus: 0.05, maxOptions: 3 } as const;

const ARTICLES = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "mein", "meine", "meinen", "unser", "unsere", "unseren"]);
const UMLAUTS: Readonly<Record<string, string>> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** Lowercase, umlauts spelled out, punctuation removed, articles dropped. */
export function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUTS[char] ?? char)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token !== "" && !ARTICLES.has(token));
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** 1 = identical, 0 = nothing in common (relative edit distance). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

/** Tokens count as equal from this similarity on (plural endings, small recognition errors). */
const TOKEN_MATCH = 0.75;

/** Every spoken word found in the title („Altglas“ for „Altglas wegbringen“) scores just above CLEAR. */
const CONTAINED_SCORE = 0.82;

const bestTokenMatch = (token: string, others: readonly string[]): number => {
  const best = Math.max(...others.map((other) => similarity(other, token)));
  return best >= TOKEN_MATCH ? best : 0;
};

/**
 * Score of a spoken text against a title: the best of token overlap (Dice), whole-string similarity and
 * containment (all spoken words appear in the title). A short phrase contained in two titles stays ambiguous
 * because both score the same.
 */
export function matchScore(spoken: string, title: string): number {
  const said = normalizeTokens(spoken);
  const wanted = normalizeTokens(title);
  if (said.length === 0 || wanted.length === 0) return 0;
  const overlap = wanted.reduce((sum, token) => sum + bestTokenMatch(token, said), 0);
  const dice = (2 * overlap) / (said.length + wanted.length);
  const contained = said.every((token) => bestTokenMatch(token, wanted) > 0) ? CONTAINED_SCORE : 0;
  return Math.max(dice, contained, similarity(said.join(" "), wanted.join(" ")));
}

export function matchTenner(spoken: string, candidates: readonly MatchCandidate[]): MatchResult {
  const ranked = candidates
    .map((tenner) => ({ tenner, score: matchScore(spoken, tenner.title) }))
    .map((entry) => ({ ...entry, ranked: entry.score + (entry.tenner.due && entry.score > 0 ? MATCH_THRESHOLDS.dueBonus : 0) }))
    .sort((a, b) => b.ranked - a.ranked || a.tenner.title.localeCompare(b.tenner.title, "de"));
  const best = ranked[0];
  if (best === undefined || best.score < MATCH_THRESHOLDS.ask) return { kind: "none", score: best?.score ?? 0 };
  const second = ranked[1];
  const clearLead = second === undefined || best.ranked - second.ranked >= MATCH_THRESHOLDS.lead;
  if (best.score >= MATCH_THRESHOLDS.clear && clearLead) return { kind: "clear", tenner: best.tenner, score: best.score };
  const options = ranked
    .filter((entry) => entry.score >= MATCH_THRESHOLDS.ask && best.ranked - entry.ranked < MATCH_THRESHOLDS.lead)
    .slice(0, MATCH_THRESHOLDS.maxOptions)
    .map((entry) => entry.tenner);
  return { kind: "ambiguous", options, score: best.score };
}
