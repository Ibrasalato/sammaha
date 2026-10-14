/**
 * Arabic camel names → Latin letters, for the English site, search and certificates.
 * Names are written without vowel marks, so this follows the common patterns of camel names
 * (فاعل → Sarim, فعيل → Kabir, فيعل → Hayla') plus a short list of well-known spellings.
 * Registry staff can override any spelling; the API keeps the same rules (Transliterator.cs).
 */
const KNOWN: Record<string, string> = {
  'ريم': 'Reem', 'نوره': 'Noura', 'نورة': 'Noura', 'سهيل': 'Suhail', 'مزنه': 'Muznah', 'مزنة': 'Muznah', 'مزن': 'Muzn', 'فهد': 'Fahd',
  'محمد': 'Mohammed', 'عبدالله': 'Abdullah', 'عبدالرحمن': 'Abdulrahman', 'سعد': 'Saad', 'ناصر': 'Nasser', 'فيصل': 'Faisal', 'سلطان': 'Sultan',
  'خالد': 'Khalid', 'سالم': 'Salem', 'نايف': 'Nayef', 'عمر': 'Omar', 'علي': 'Ali', 'حمد': 'Hamad', 'ماجد': 'Majed', 'سعيد': 'Saeed',
  'العتيبي': 'Al-Otaibi', 'القحطاني': 'Al-Qahtani', 'الدوسري': 'Al-Dosari', 'المري': 'Al-Marri', 'الشهري': 'Al-Shehri', 'الهاجري': 'Al-Hajri',
  'شعلان': "Sha'lan", 'مجاهيم': 'Majaheem', 'مغاتير': 'Maghateer', 'وضح': 'Wadh', 'صفر': 'Sufr', 'شعل': "Sha'l", 'حمر': 'Humr', 'زرق': 'Zurq',
  'بن': 'bin', 'بنت': 'bint', 'ابو': 'Abu', 'أبو': 'Abu', 'ام': 'Umm', 'أم': 'Umm',
}
const CONS: Record<string, string> = {
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd',
  'ط': 't', 'ظ': 'dh', 'ع': "'", 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ء': "'", 'ئ': "'", 'ؤ': "'", 'ة': 'h',
}
const clean = (s: string) => s.replace(/[ً-ْٰـ]/g, '').replace(/\s+/g, ' ').trim()
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

type Tok = { v: string; kind: 'c' | 'long' | 'end' }

function word(w: string): string {
  if (KNOWN[w]) return KNOWN[w]
  if (w.startsWith('ال') && w.length > 3) {
    const rest = w.slice(2)
    return `Al-${cap(KNOWN[rest] ?? stem(rest))}`
  }
  return cap(stem(w))
}

function stem(w: string): string {
  const ch = [...w]
  const toks: Tok[] = []
  ch.forEach((c, i) => {
    const first = i === 0, last = i === ch.length - 1
    const prev = toks[toks.length - 1]
    const afterCons = !!prev && prev.kind === 'c'
    if (c === 'ا' || c === 'أ' || c === 'إ' || c === 'آ' || c === 'ى') {
      if (first) toks.push({ v: c === 'إ' ? 'i' : c === 'آ' ? 'aa' : 'a', kind: 'long' })
      else if (c === 'أ' || c === 'إ') { toks.push({ v: "'", kind: 'c' }) }
      else toks.push({ v: 'a', kind: 'long' })
      return
    }
    if (c === 'و') {
      if (first || !afterCons || (ch[i + 1] && 'اوي'.includes(ch[i + 1]))) toks.push({ v: 'w', kind: 'c' })
      else toks.push({ v: 'u', kind: 'long' })
      return
    }
    if (c === 'ي') {
      if (first || !afterCons || (ch[i + 1] && 'اوي'.includes(ch[i + 1]))) toks.push({ v: 'y', kind: 'c' })
      else if (i === ch.length - 2 && 'ةه'.includes(ch[i + 1])) toks.push({ v: 'iy', kind: 'long' }) // هدية → Hadiyah
      else if (toks.length === 1 && !last) toks.push({ v: 'ay', kind: 'long' }) // فيعل: هيلع → Hayla'
      else toks.push({ v: 'i', kind: 'long' })
      return
    }
    if ((c === 'ة' || c === 'ه') && last && toks.length > 1 && (afterCons || prev.v === 'iy')) { toks.push({ v: 'ah', kind: 'end' }); return }
    if (c === 'ع' && first) { toks.push({ v: 'a', kind: 'long' }); return }
    toks.push({ v: CONS[c] ?? '', kind: 'c' })
  })
  const consOnly = toks.every((t) => t.kind === 'c')
  let out = ''
  toks.forEach((t, i) => {
    const prev = toks[i - 1]
    if (prev && prev.kind === 'c' && t.kind === 'c') {
      // CCC words (فهد، مزن): one vowel after the first letter only
      if (consOnly && toks.length === 3 && i === 2) { /* no vowel */ }
      else {
        const longBefore = toks[i - 2]?.kind === 'long' && toks[i - 2].v === 'a'
        out += longBefore && i === toks.length - 1 ? 'i' : 'a' // فاعل → Sarim
      }
    }
    out += t.v
  })
  return out.replace(/^'/, '').replace(/aa+/g, 'aa').replace(/''+/g, "'")
}

/** "الهيلع" → "Al-Hayla'", "بنت الشمال" → "Bint Al-Shamal" */
export function toLatin(name: string): string {
  const s = clean(name)
  if (!s) return ''
  if (!/[؀-ۿ]/.test(s)) return s
  const out = s.split(' ').map(word).join(' ')
  return cap(out)
}

/** true when the query is written in Latin letters */
export const isLatinQuery = (q: string) => /[a-z]/i.test(q) && !/[؀-ۿ]/.test(q)
/** loose matching for Latin search: case, hyphens, apostrophes and doubled vowels are ignored */
export const latinKey = (s: string) => s.toLowerCase().replace(/^al[-\s]?/, '').replace(/[-'’`\s]/g, '').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/(.)\1+/g, '$1')
