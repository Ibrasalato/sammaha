import type { NameType, SimilarHit } from './types'

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
  if (!raw) return 'اكتب الاسم'
  if (raw.length < 2) return 'الاسم قصير جدًا'
  if (raw.length > 30) return 'الاسم أطول من 30 حرفًا'
  if (!/^[؀-ۿ\s]+$/.test(raw)) return 'استخدم الحروف العربية فقط'
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

export function findMatches(normalized: string, pool: MatchSource[]): SimilarHit[] {
  const hits: SimilarHit[] = []
  for (const p of pool) {
    const score = similarity(normalized, p.normalized)
    if (score >= SIMILAR_THRESHOLD) hits.push({ name: p.name, type: p.type, source: p.source, score: Math.round(score * 100) / 100 })
  }
  return hits.sort((x, y) => y.score - x.score).slice(0, 8)
}
