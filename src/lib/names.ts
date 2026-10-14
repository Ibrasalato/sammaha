import { tr } from './i18n'
import type { MatchRelation, NameType, SimilarHit } from './types'

/**
 * Arabic normalisation used for matching. The same rules live in SQL
 * (public.normalize_name) so client and server agree.
 *  - strip tashkeel / tatweel
 *  - unify alef forms (أ إ آ ٱ → ا), ى → ي, ة → ه, ؤ → و, ئ → ي, drop standalone ء
 *  - drop a leading definite article "ال"
 *  - remove spaces and punctuation
 */
export function normalizeName(input: string): string {
  let s = (input || '').trim()
  s = s.replace(/[ً-ٰٟۖ-ۭـ]/g, '')
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
  s = s.replace(/[^ء-يa-zA-Z0-9]/g, '')
  if (s.length > 4 && s.startsWith('ال')) s = s.slice(2)
  return s.toLowerCase()
}

export function validateName(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return tr('اكتب الاسم', 'Enter the name')
  if (raw.length < 2) return tr('الاسم قصير جدًا', 'The name is too short')
  if (raw.length > 30) return tr('الاسم أطول من 30 حرفًا', 'The name is longer than 30 characters')
  if (!/^[؀-ۿ\s]+$/.test(raw)) return tr('استخدم الحروف العربية فقط', 'Use Arabic letters only')
  return null
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/** 0..1 similarity on normalised names */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const d = levenshtein(a, b)
  let score = 1 - d / Math.max(a.length, b.length)
  // one name contained in the other (e.g. "شاهين" / "شاهينه")
  if (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a))) score = Math.max(score, 0.8)
  return score
}

/** Threshold above which a name is flagged to the committee as "similar" */
export const SIMILAR_THRESHOLD = 0.7

export interface MatchSource {
  name: string
  normalized: string
  type: NameType
  source: SimilarHit['source']
}

/**
 * Root-letter forms of a normalised name: long vowels (ا و ي) removed, with and without a sound-plural ending
 * (ات ون ين ان) or a final ه, so singular and plural meet: صقر/صقور، غزال/غزلان، شاهين/شواهين، سلطان/سلاطين.
 * Same rules as NameMatcher.Skeletons in the API.
 */
export function skeletons(normalized: string): Set<string> {
  const core = (x: string) => [...x].filter((c, i) => i === 0 || (c !== 'ا' && c !== 'و' && c !== 'ي')).join('')
  const forms = [normalized]
  for (const end of ['ات', 'ون', 'ين', 'ان']) if (normalized.length >= 5 && normalized.endsWith(end)) forms.push(normalized.slice(0, -2))
  if (normalized.length >= 4 && normalized.endsWith('ه')) forms.push(normalized.slice(0, -1))
  return new Set(forms.map(core).filter((c) => c.length >= 3))
}

/** a likely singular/plural pair of normalised names */
export function sameForms(a: string, b: string): boolean {
  if (a === b || a.length < 3 || b.length < 3) return false
  const sa = skeletons(a)
  for (const x of skeletons(b)) if (sa.has(x)) return true
  return false
}

/** how a requested name relates to an existing one */
export function relation(candidate: string, other: string): MatchRelation {
  const na = normalizeName(candidate), nb = normalizeName(other)
  if (na === nb) {
    const bare = (x: string) => x.replace(/[ً-ٰٟۖ-ۭـ\s]/g, '').startsWith('ال')
    return bare(candidate) !== bare(other) ? 'article' : 'exact'
  }
  if (na + 'ه' === nb || nb + 'ه' === na) return 'gender'
  if (sameForms(na, nb)) return na.length > nb.length ? 'plural' : 'singular'
  return 'similar'
}

export const RELATION_LABEL: Record<MatchRelation, string> = {
  get exact() { return tr('مطابق تمامًا', 'Exact match') },
  get article() { return tr('مطابق بـ«ال» أو بدونها', 'Match with or without "Al"') },
  get gender() { return tr('مذكر / مؤنث', 'Masculine / feminine') },
  get plural() { return tr('جمع للاسم', 'Plural of the name') },
  get singular() { return tr('مفرد للاسم', 'Singular of the name') },
  get similar() { return tr('مشابه', 'Similar') },
}

export function findMatches(normalized: string, pool: MatchSource[]): SimilarHit[] {
  const hits: SimilarHit[] = []
  for (const p of pool) {
    let score = similarity(normalized, p.normalized)
    // a singular or plural of an existing name is always shown to the committee
    if (score < SIMILAR_THRESHOLD && sameForms(normalized, p.normalized)) score = 0.9
    if (score >= SIMILAR_THRESHOLD) hits.push({ name: p.name, type: p.type, source: p.source, score: Math.round(score * 100) / 100 })
  }
  return hits.sort((x, y) => y.score - x.score).slice(0, 8)
}
