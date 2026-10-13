/**
 * Demo backend: the full business logic running in the browser on localStorage,
 * so the platform can be tried on GitHub Pages without a server.
 * The production backend (supabase/migrations) implements the same rules in SQL.
 */
import { ApiError } from './api'
import type { PayMethod, SammhaApi, SignUpInput } from './api'
import { RULES } from './config'
import { namesCount } from './format'
import { findMatches, normalizeName, validateName } from './names'
import type { MatchSource } from './names'
import type {
  Auction, AuctionPhase, Bid, Candidate, Invoice, LogoRequest, NameCheck, NameType, ReservedName,
  User, WalletTx,
} from './types'

interface DemoUser extends User { password: string }
interface DB {
  v: number
  seq: number
  users: DemoUser[]
  requests: LogoRequest[]
  auctions: Auction[]
  bids: Bid[]
  reserved: ReservedName[]
  txs: WalletTx[]
  invoices: Invoice[]
}

const KEY = 'sammha-demo-db'
const SESSION = 'sammha-demo-session'
const VERSION = 3

const now = () => Date.now()
const iso = (t: number) => new Date(t).toISOString()
const H = 3600_000
const D = 24 * H
const round2 = (n: number) => Math.round(n * 100) / 100

function uid(db: DB, prefix: string) {
  db.seq += 1
  return `${prefix}${db.seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function phaseOf(a: Pick<Auction, 'startsAt' | 'endsAt'>, t = now()): AuctionPhase {
  if (t < Date.parse(a.startsAt)) return 'scheduled'
  if (t < Date.parse(a.endsAt)) return 'live'
  return 'ended'
}

// ───────────────────────── seed ─────────────────────────
function seed(): DB {
  const t = now()
  const db: DB = { v: VERSION, seq: 100, users: [], requests: [], auctions: [], bids: [], reserved: [], txs: [], invoices: [] }
  const mkUser = (id: string, fullName: string, phone: string, role: User['role'], email: string): DemoUser =>
    ({ id, fullName, phone, email, role, password: '123456', createdAt: iso(t - 90 * D) })

  db.users.push(
    mkUser('u-owner', 'سعد بن ناصر العتيبي', '0500000001', 'owner', 'owner@demo.sa'),
    mkUser('u-staff', 'لجنة الاعتماد', '0500000002', 'committee', 'committee@demo.sa'),
    mkUser('u-b1', 'مزرعة الوسم للإبل', '0500000003', 'owner', 'b1@demo.sa'),
    mkUser('u-b2', 'فهد عبدالله الدوسري', '0500000004', 'owner', 'b2@demo.sa'),
    mkUser('u-b3', 'نايف سالم المري', '0500000005', 'owner', 'b3@demo.sa'),
  )

  const legacy: [string, NameType, string, number, number][] = [
    ['الفاخر', 'qaadan', 'مزرعة الوسم للإبل', 4200, 300],
    ['سلطان', 'qaadan', 'فهد عبدالله الدوسري', 12500, 260],
    ['مرهوب', 'qaadan', 'نايف سالم المري', 3100, 240],
    ['شامخ', 'qaadan', 'مزرعة الوسم للإبل', 2750, 200],
    ['البيرق', 'qaadan', 'فهد عبدالله الدوسري', 8800, 180],
    ['الأدهم', 'qaadan', 'نايف سالم المري', 1900, 150],
    ['راعد', 'qaadan', 'مزرعة الوسم للإبل', 650, 120],
    ['الشعلة', 'bakkar', 'فهد عبدالله الدوسري', 9600, 280],
    ['الغيمة', 'bakkar', 'مزرعة الوسم للإبل', 5400, 250],
    ['مزنة', 'bakkar', 'نايف سالم المري', 2300, 210],
    ['الهدباء', 'bakkar', 'مزرعة الوسم للإبل', 7100, 190],
    ['شقحاء', 'bakkar', 'فهد عبدالله الدوسري', 3900, 160],
    ['الوضحى', 'bakkar', 'نايف سالم المري', 1250, 110],
    ['غزلان', 'bakkar', 'مزرعة الوسم للإبل', 980, 90],
  ]
  for (const [name, type, ownerName, price, daysAgo] of legacy) {
    const owner = db.users.find((u) => u.fullName === ownerName)
    db.reserved.push({ id: uid(db, 'r'), name, normalized: normalizeName(name), type, ownerId: owner?.id, ownerName, price, acquiredAt: iso(t - daysAgo * D), source: 'legacy' })
  }

  let reqNo = 1000
  const mkRequest = (userId: string, type: NameType, names: string[], status: LogoRequest['status'], daysAgo: number): LogoRequest => {
    const u = db.users.find((x) => x.id === userId)!
    const r: LogoRequest = {
      id: uid(db, 'q'), number: `SM-${++reqNo}`, userId, ownerName: u.fullName, type,
      candidates: names.map((n) => ({ id: uid(db, 'c'), name: n, normalized: normalizeName(n), status: 'pending', similar: [] })),
      status, depositAmount: RULES.depositAmount, depositPaid: status !== 'pending_payment',
      depositState: status === 'pending_payment' ? 'none' : 'held', createdAt: iso(t - daysAgo * D),
      submittedAt: status === 'pending_payment' ? undefined : iso(t - daysAgo * D + 600_000),
    }
    db.requests.push(r)
    if (r.depositPaid) db.txs.push({ id: uid(db, 't'), userId, amount: -RULES.depositAmount, kind: 'deposit', note: `ضمان مزاد الطلب ${r.number}`, createdAt: r.submittedAt! })
    return r
  }
  const mkAuction = (r: LogoRequest, c: Candidate, startOff: number, endOff: number, bids: [string, number][]) => {
    c.status = 'accepted'
    const a: Auction = {
      id: uid(db, 'a'), requestId: r.id, candidateId: c.id, name: c.name, type: r.type, requesterId: r.userId,
      openingPrice: RULES.openingPrice, minIncrement: RULES.minIncrement, startsAt: iso(t + startOff), endsAt: iso(t + endOff),
      currentPrice: RULES.openingPrice, bidCount: 0, settled: false,
    }
    c.auctionId = a.id
    db.auctions.push(a)
    let bt = Date.parse(a.startsAt) + 20 * 60_000
    for (const [userId, amount] of bids) {
      const u = db.users.find((x) => x.id === userId)!
      db.bids.push({ id: uid(db, 'b'), auctionId: a.id, userId, bidderLabel: maskName(u.fullName), amount, createdAt: iso(Math.min(bt, t - 60_000)) })
      bt += 47 * 60_000
      a.currentPrice = amount
      a.bidCount += 1
      a.leaderId = userId
      a.leaderLabel = maskName(u.fullName)
    }
    return a
  }
  const accept = (r: LogoRequest, rejectIdx: number[] = []) => {
    r.status = 'accepted'
    r.reviewedAt = iso(Date.parse(r.submittedAt!) + D)
    r.reviewerName = 'لجنة الاعتماد'
    rejectIdx.forEach((i) => { r.candidates[i].status = 'rejected'; r.candidates[i].rejectReason = 'مشابه لاسم مسجل مسبقًا' })
  }

  // Demo owner's requests
  const r1 = mkRequest('u-owner', 'qaadan', ['الصارم', 'المهيب', 'الشامخ'], 'under_review', 5)
  accept(r1, [2])
  r1.candidates[2].similar = [{ name: 'شامخ', type: 'qaadan', source: 'reserved', score: 1 }]
  mkAuction(r1, r1.candidates[0], -2 * D, 3 * H + 14 * 60_000, [['u-b2', 120], ['u-b1', 200], ['u-b2', 260]])
  mkAuction(r1, r1.candidates[1], -2 * D, 26 * H, [])

  const r2 = mkRequest('u-owner', 'bakkar', ['المزون', 'العنود', 'غزلانه'], 'under_review', 1)
  void r2

  const r3 = mkRequest('u-owner', 'bakkar', ['شقحا', 'الشعله', 'هدبا'], 'under_review', 20)
  r3.status = 'rejected'
  r3.reviewedAt = iso(t - 19 * D)
  r3.reviewerName = 'لجنة الاعتماد'
  r3.reviewNote = 'الأسماء الثلاثة مطابقة أو شبه مطابقة لأسماء مسجلة'
  r3.candidates.forEach((c) => { c.status = 'rejected'; c.rejectReason = 'مشابه لاسم مسجل' })
  r3.depositState = 'refunded'
  db.txs.push({ id: uid(db, 't'), userId: 'u-owner', amount: RULES.depositAmount, kind: 'refund', note: `استرداد ضمان الطلب ${r3.number} (مرفوض)`, createdAt: r3.reviewedAt })
  db.txs.push({ id: uid(db, 't'), userId: 'u-owner', amount: 500, kind: 'topup', note: 'شحن المحفظة', createdAt: iso(t - 30 * D) })

  // Other owners' auctions
  const r4 = mkRequest('u-b1', 'bakkar', ['الريم', 'الوجناء', 'سحابة'], 'under_review', 4)
  accept(r4)
  mkAuction(r4, r4.candidates[0], -3 * D, 55 * 60_000, [['u-b2', 300], ['u-b3', 450], ['u-b2', 700], ['u-b3', 1150]])
  mkAuction(r4, r4.candidates[1], -3 * D, 2 * D + 5 * H, [['u-owner', 80]])
  mkAuction(r4, r4.candidates[2], D + 4 * H, 4 * D, [])

  const r5 = mkRequest('u-b3', 'qaadan', ['النمر', 'الصقر', 'هزاع'], 'under_review', 6)
  accept(r5, [1])
  r5.candidates[1].rejectReason = 'اسم شائع محجوز لفعاليات المنظمة'
  mkAuction(r5, r5.candidates[0], -4 * D, 9 * H, [['u-b1', 500], ['u-b2', 900]])
  mkAuction(r5, r5.candidates[2], -5 * D, -2 * H, []) // ended, no bids → requester wins at deposit price

  const r6 = mkRequest('u-b2', 'qaadan', ['مدعث', 'عذاب', 'الحايل'], 'under_review', 8)
  accept(r6)
  mkAuction(r6, r6.candidates[0], -6 * D, -5 * H, [['u-b3', 150], ['u-owner', 400]]) // ended, demo owner wins
  mkAuction(r6, r6.candidates[1], 2 * D, 5 * D, [])
  mkAuction(r6, r6.candidates[2], -2 * D, 2 * D, [['u-b1', 60]])

  // Waiting for the committee
  const r7 = mkRequest('u-b2', 'bakkar', ['شعلة', 'الهدبا', 'نجلاء'], 'under_review', 0.3)
  const r8 = mkRequest('u-b1', 'qaadan', ['الفاخر', 'سلطانه', 'فهاد'], 'under_review', 0.1)
  // r8 deliberately includes an exact match (seeded legacy data); real submissions block exact matches.
  void r7; void r8

  db.txs.push({ id: uid(db, 't'), userId: 'u-b2', amount: 2000, kind: 'topup', note: 'شحن المحفظة', createdAt: iso(t - 40 * D) })
  // compute similar hits for pending requests
  for (const r of db.requests) for (const c of r.candidates) if (!c.similar.length) c.similar = similarFor(db, c.normalized, r.id)
  return db
}

export function maskName(full: string) {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return `${parts[0].slice(0, 2)}…`
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 2)}…`
}

// ───────────────────────── persistence ─────────────────────────
function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      if (db.v === VERSION) return db
    }
  } catch { /* storage unavailable */ }
  const db = seed()
  save(db)
  return db
}
function save(db: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ }
}
let memSession: string | null = null
function getSession(): string | null {
  try { return localStorage.getItem(SESSION) } catch { return memSession }
}
function setSession(id: string | null) {
  memSession = id
  try { if (id) localStorage.setItem(SESSION, id); else localStorage.removeItem(SESSION) } catch { /* ignore */ }
}
export function resetDemo() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(SESSION) } catch { /* ignore */ }
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120))

// ───────────────────────── rules ─────────────────────────
function matchPool(db: DB, excludeRequestId?: string): MatchSource[] {
  const pool: MatchSource[] = db.reserved.map((r) => ({ name: r.name, normalized: r.normalized, type: r.type, source: 'reserved' }))
  for (const r of db.requests) {
    if (r.id === excludeRequestId) continue
    if (r.status !== 'under_review' && r.status !== 'accepted' && r.status !== 'pending_payment') continue
    for (const c of r.candidates) {
      if (c.status === 'rejected') continue
      const a = c.auctionId ? db.auctions.find((x) => x.id === c.auctionId) : undefined
      if (a?.settled) continue // already in reserved
      pool.push({ name: c.name, normalized: c.normalized, type: r.type, source: a ? 'auction' : 'request' })
    }
  }
  return pool
}

function similarFor(db: DB, normalized: string, excludeRequestId?: string) {
  return findMatches(normalized, matchPool(db, excludeRequestId))
}

function checkNamesIn(db: DB, names: string[], excludeRequestId?: string): NameCheck[] {
  const seen = new Map<string, number>()
  return names.map((name, i) => {
    const normalized = normalizeName(name)
    const invalid = validateName(name)
    if (invalid) return { name, normalized, verdict: 'invalid', message: invalid, hits: [] }
    const dupAt = seen.get(normalized)
    seen.set(normalized, i)
    if (dupAt !== undefined) return { name, normalized, verdict: 'duplicate', message: 'مكرر داخل نفس الطلب', hits: [] }
    const hits = similarFor(db, normalized, excludeRequestId)
    const exact = hits.find((h) => h.score === 1)
    if (exact) return { name, normalized, verdict: 'exact', message: `مطابق تمامًا لاسم ${exact.source === 'reserved' ? 'مسجل' : 'تحت الطلب أو المزاد'}: «${exact.name}»`, hits }
    if (hits.length) return { name, normalized, verdict: 'similar', message: `متاح، وستراجع اللجنة تشابهه مع ${namesCount(hits.length)}`, hits }
    return { name, normalized, verdict: 'available', message: 'متاح', hits: [] }
  })
}

function balanceOf(db: DB, userId: string) {
  return round2(db.txs.filter((t) => t.userId === userId).reduce((s, t) => s + t.amount, 0))
}

function refundDeposit(db: DB, r: LogoRequest, why: string) {
  if (r.depositState !== 'held') return
  r.depositState = 'refunded'
  db.txs.push({ id: uid(db, 't'), userId: r.userId, amount: r.depositAmount, kind: 'refund', note: `استرداد ضمان الطلب ${r.number} (${why})`, createdAt: iso(now()) })
}

let invSeq = 0
function issueInvoice(db: DB, a: Auction, buyer: User, price: number, depositApplied: number) {
  invSeq = Math.max(invSeq, db.invoices.length)
  const vat = round2((price * RULES.vatRate) / (1 + RULES.vatRate))
  const inv: Invoice = {
    id: uid(db, 'i'), number: `INV-${new Date().getFullYear()}-${String(++invSeq).padStart(5, '0')}`,
    userId: buyer.id, buyerName: buyer.fullName, buyerPhone: buyer.phone, auctionId: a.id, name: a.name, type: a.type,
    total: price, vat, subtotal: round2(price - vat), depositApplied, amountDue: round2(price - depositApplied),
    status: price - depositApplied <= 0 ? 'paid' : 'unpaid', issuedAt: iso(now()),
  }
  if (inv.status === 'paid') inv.paidAt = inv.issuedAt
  db.invoices.push(inv)
  return inv
}

/** Settle every auction whose end time has passed. Mirrors public.settle_due_auctions() in SQL. */
function sweep(db: DB) {
  let changed = false
  for (const a of db.auctions) {
    if (a.settled || phaseOf(a) !== 'ended') continue
    const r = db.requests.find((x) => x.id === a.requestId)!
    const noBids = a.bidCount === 0
    const winnerId = noBids ? a.requesterId : a.leaderId!
    const winner = db.users.find((u) => u.id === winnerId)!
    const price = noBids ? a.openingPrice : a.currentPrice
    let depositApplied = 0
    if (winnerId === r.userId && r.depositState === 'held') {
      depositApplied = Math.min(r.depositAmount, price)
      r.depositState = 'applied'
    }
    issueInvoice(db, a, winner, price, depositApplied)
    db.reserved.push({ id: uid(db, 'r'), name: a.name, normalized: normalizeName(a.name), type: a.type, ownerId: winner.id, ownerName: winner.fullName, price, acquiredAt: a.endsAt, source: 'auction' })
    Object.assign(a, { settled: true, winnerId, winnerName: winner.fullName, finalPrice: price, wonByRequester: winnerId === r.userId })
    changed = true
    // all of the request's auctions settled and the requester won none → refund the guarantee
    const reqAuctions = db.auctions.filter((x) => x.requestId === r.id)
    const pendingNames = r.candidates.some((c) => c.status === 'accepted' && !c.auctionId)
    if (!pendingNames && reqAuctions.every((x) => x.settled) && r.depositState === 'held') refundDeposit(db, r, 'لم يُرسَ عليك أي اسم')
  }
  return changed
}

function tx<T>(fn: (db: DB) => T): Promise<T> {
  const db = load()
  if (sweep(db)) save(db)
  try {
    const out = fn(db)
    save(db)
    return delay(out)
  } catch (e) {
    return Promise.reject(e)
  }
}

function me(db: DB): DemoUser {
  const id = getSession()
  const u = db.users.find((x) => x.id === id)
  if (!u) throw new ApiError('سجّل الدخول أولًا')
  return u
}
function staff(db: DB): DemoUser {
  const u = me(db)
  if (u.role === 'owner') throw new ApiError('هذه الصفحة للجنة الاعتماد فقط')
  return u
}
const publicUser = ({ password: _p, ...u }: DemoUser): User => u

// ───────────────────────── API ─────────────────────────
export const demoApi: SammhaApi = {
  currentUser: () => tx((db) => {
    const u = db.users.find((x) => x.id === getSession())
    return u ? publicUser(u) : null
  }),

  signUp: (input: SignUpInput) => tx((db) => {
    const phone = input.phone.replace(/\s/g, '')
    if (!/^05\d{8}$/.test(phone)) throw new ApiError('رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام')
    if (db.users.some((u) => u.phone === phone)) throw new ApiError('رقم الجوال مسجل مسبقًا، سجّل الدخول')
    if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new ApiError('البريد الإلكتروني مسجل مسبقًا')
    if (input.password.length < 6) throw new ApiError('كلمة المرور 6 أحرف على الأقل')
    const u: DemoUser = { id: uid(db, 'u'), fullName: input.fullName.trim(), phone, email: input.email.trim(), nationalId: input.nationalId, role: 'owner', password: input.password, createdAt: iso(now()) }
    db.users.push(u)
    setSession(u.id)
    return publicUser(u)
  }),

  signIn: (login, password) => tx((db) => {
    const l = login.trim().toLowerCase()
    const u = db.users.find((x) => x.phone === l || x.email.toLowerCase() === l)
    if (!u || u.password !== password) throw new ApiError('رقم الجوال أو كلمة المرور غير صحيحة')
    setSession(u.id)
    return publicUser(u)
  }),

  signOut: async () => { setSession(null) },

  stats: () => tx((db) => ({
    live: db.auctions.filter((a) => phaseOf(a) === 'live').length,
    upcoming: db.auctions.filter((a) => phaseOf(a) === 'scheduled').length,
    reserved: db.reserved.length,
    owners: new Set(db.reserved.map((r) => r.ownerName)).size,
  })),

  listAuctions: (f = {}) => tx((db) => {
    const q = f.q ? normalizeName(f.q) : ''
    return db.auctions
      .filter((a) => (f.phase && f.phase !== 'all' ? phaseOf(a) === f.phase : true))
      .filter((a) => (f.type && f.type !== 'all' ? a.type === f.type : true))
      .filter((a) => (q ? normalizeName(a.name).includes(q) : true))
      .sort((x, y) => {
        const px = phaseOf(x), py = phaseOf(y)
        const order = { live: 0, scheduled: 1, ended: 2 }
        if (px !== py) return order[px] - order[py]
        if (px === 'ended') return Date.parse(y.endsAt) - Date.parse(x.endsAt)
        if (px === 'scheduled') return Date.parse(x.startsAt) - Date.parse(y.startsAt)
        return Date.parse(x.endsAt) - Date.parse(y.endsAt)
      })
  }),

  getAuction: (id) => tx((db) => {
    const auction = db.auctions.find((a) => a.id === id)
    if (!auction) throw new ApiError('المزاد غير موجود')
    const bids = db.bids.filter((b) => b.auctionId === id).sort((a, b) => b.amount - a.amount)
    return { auction, bids }
  }),

  listReservedNames: (q, type) => tx((db) => {
    const n = q ? normalizeName(q) : ''
    return db.reserved
      .filter((r) => (type && type !== 'all' ? r.type === type : true))
      .filter((r) => (n ? r.normalized.includes(n) || r.ownerName.includes(q!) : true))
      .sort((a, b) => Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt))
  }),

  checkNames: (names, _type) => tx((db) => checkNamesIn(db, names)),

  myRequests: () => tx((db) => {
    const u = me(db)
    return db.requests.filter((r) => r.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }),

  createRequest: (type, names) => tx((db) => {
    const u = me(db)
    if (names.length !== RULES.namesPerRequest) throw new ApiError(`أدخل ${RULES.namesPerRequest} أسماء`)
    const checks = checkNamesIn(db, names)
    const blocked = checks.filter((c) => c.verdict === 'exact' || c.verdict === 'invalid' || c.verdict === 'duplicate')
    if (blocked.length) throw new ApiError(`غيّر الأسماء المرفوضة: ${blocked.map((b) => b.name || '—').join('، ')}`)
    const r: LogoRequest = {
      id: uid(db, 'q'), number: `SM-${1000 + db.requests.length + 1}`, userId: u.id, ownerName: u.fullName, type,
      candidates: checks.map((c) => ({ id: uid(db, 'c'), name: c.name.trim(), normalized: c.normalized, status: 'pending', similar: c.hits })),
      status: 'pending_payment', depositAmount: RULES.depositAmount, depositPaid: false, depositState: 'none', createdAt: iso(now()),
    }
    db.requests.push(r)
    return r
  }),

  payDeposit: (requestId, method: PayMethod) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === requestId && x.userId === u.id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status !== 'pending_payment') throw new ApiError('تم سداد ضمان هذا الطلب')
    // re-check: a name may have been taken since the request was drafted
    const checks = checkNamesIn(db, r.candidates.map((c) => c.name), r.id)
    const taken = checks.filter((c) => c.verdict === 'exact')
    if (taken.length) throw new ApiError(`أصبح الاسم «${taken[0].name}» محجوزًا، ألغِ الطلب وأنشئ طلبًا جديدًا`)
    if (method === 'wallet') {
      if (balanceOf(db, u.id) < r.depositAmount) throw new ApiError('رصيد المحفظة لا يكفي، اشحن المحفظة أو ادفع بالبطاقة')
    } else {
      // card: demo simulates a successful Moyasar payment that tops up then debits
      db.txs.push({ id: uid(db, 't'), userId: u.id, amount: r.depositAmount, kind: 'topup', note: `دفع بالبطاقة للطلب ${r.number}`, createdAt: iso(now()) })
    }
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: -r.depositAmount, kind: 'deposit', note: `ضمان مزاد الطلب ${r.number}`, createdAt: iso(now()) })
    r.candidates.forEach((c, i) => { c.similar = checks[i].hits })
    Object.assign(r, { status: 'under_review', depositPaid: true, depositState: 'held', submittedAt: iso(now()) })
    return r
  }),

  cancelMyRequest: (requestId) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === requestId && x.userId === u.id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status !== 'pending_payment' && r.status !== 'under_review') throw new ApiError('لا يمكن إلغاء الطلب بعد مراجعته')
    r.status = 'cancelled'
    refundDeposit(db, r, 'ألغاه المالك')
  }),

  myWallet: () => tx((db) => {
    const u = me(db)
    return { balance: balanceOf(db, u.id), txs: db.txs.filter((t) => t.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) }
  }),

  topUp: (amount) => tx((db) => {
    const u = me(db)
    if (!(amount >= 10)) throw new ApiError('أقل مبلغ للشحن 10 ريال')
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount, kind: 'topup', note: 'شحن المحفظة بالبطاقة', createdAt: iso(now()) })
    return { balance: balanceOf(db, u.id), txs: db.txs.filter((t) => t.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) }
  }),

  myInvoices: () => tx((db) => {
    const u = me(db)
    return db.invoices.filter((i) => i.userId === u.id).sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
  }),

  payInvoice: (id, method) => tx((db) => {
    const u = me(db)
    const inv = db.invoices.find((i) => i.id === id && (i.userId === u.id || u.role !== 'owner'))
    if (!inv) throw new ApiError('الفاتورة غير موجودة')
    if (inv.status === 'paid') return inv
    if (method === 'wallet' && balanceOf(db, inv.userId) < inv.amountDue) throw new ApiError('رصيد المحفظة لا يكفي')
    if (method === 'card') db.txs.push({ id: uid(db, 't'), userId: inv.userId, amount: inv.amountDue, kind: 'topup', note: `دفع بالبطاقة للفاتورة ${inv.number}`, createdAt: iso(now()) })
    db.txs.push({ id: uid(db, 't'), userId: inv.userId, amount: -inv.amountDue, kind: 'invoice_payment', note: `سداد الفاتورة ${inv.number} — ${inv.name}`, createdAt: iso(now()) })
    inv.status = 'paid'
    inv.paidAt = iso(now())
    return inv
  }),

  myBids: () => tx((db) => {
    const u = me(db)
    const latest = new Map<string, Bid>()
    for (const b of db.bids.filter((x) => x.userId === u.id)) {
      const cur = latest.get(b.auctionId)
      if (!cur || b.amount > cur.amount) latest.set(b.auctionId, b)
    }
    return [...latest.values()].map((b) => ({ ...b, auction: db.auctions.find((a) => a.id === b.auctionId)! }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }),

  myNames: () => tx((db) => {
    const u = me(db)
    return db.reserved.filter((r) => r.ownerId === u.id).sort((a, b) => Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt))
  }),

  placeBid: (auctionId, amount) => tx((db) => {
    const u = me(db)
    const a = db.auctions.find((x) => x.id === auctionId)
    if (!a) throw new ApiError('المزاد غير موجود')
    const phase = phaseOf(a)
    if (phase === 'scheduled') throw new ApiError('المزاد لم يبدأ بعد')
    if (phase === 'ended') throw new ApiError('انتهى المزاد')
    const min = a.currentPrice + a.minIncrement
    if (!Number.isFinite(amount) || amount < min) throw new ApiError(`أقل مزايدة ${min} ريال`)
    if (a.leaderId === u.id) throw new ApiError('أنت صاحب أعلى مزايدة حاليًا')
    const t = now()
    db.bids.push({ id: uid(db, 'b'), auctionId, userId: u.id, bidderLabel: maskName(u.fullName), amount, createdAt: iso(t) })
    a.currentPrice = amount
    a.bidCount += 1
    a.leaderId = u.id
    a.leaderLabel = maskName(u.fullName)
    const win = RULES.extendMinutes * 60_000
    if (Date.parse(a.endsAt) - t < win) a.endsAt = iso(t + win)
    return { auction: a, bids: db.bids.filter((b) => b.auctionId === auctionId).sort((x, y) => y.amount - x.amount) }
  }),

  overview: () => tx((db) => {
    staff(db)
    return {
      underReview: db.requests.filter((r) => r.status === 'under_review').length,
      awaitingSchedule: db.requests.flatMap((r) => r.candidates).filter((c) => c.status === 'accepted' && !c.auctionId).length,
      live: db.auctions.filter((a) => phaseOf(a) === 'live').length,
      scheduled: db.auctions.filter((a) => phaseOf(a) === 'scheduled').length,
      unpaidInvoices: db.invoices.filter((i) => i.status === 'unpaid').length,
      revenue: round2(db.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)),
    }
  }),

  listRequests: (status = 'all') => tx((db) => {
    staff(db)
    return db.requests.filter((r) => (status === 'all' ? r.status !== 'pending_payment' : r.status === status))
      .sort((a, b) => Date.parse(b.submittedAt || b.createdAt) - Date.parse(a.submittedAt || a.createdAt))
  }),

  getRequest: (id) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r || (u.role === 'owner' && r.userId !== u.id)) throw new ApiError('الطلب غير موجود')
    if (u.role !== 'owner' && r.status === 'under_review') r.candidates.forEach((c) => { c.similar = similarFor(db, c.normalized, r.id) })
    return r
  }),

  reviewRequest: (id, decisions, note) => tx((db) => {
    const u = staff(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status !== 'under_review') throw new ApiError('تمت مراجعة هذا الطلب')
    for (const d of decisions) {
      const c = r.candidates.find((x) => x.id === d.candidateId)
      if (!c) continue
      if (d.status === 'accepted') {
        const exact = similarFor(db, c.normalized, r.id).find((h) => h.score === 1)
        if (exact) throw new ApiError(`لا يمكن قبول «${c.name}»: مطابق لـ«${exact.name}»`)
      }
      c.status = d.status
      c.rejectReason = d.status === 'rejected' ? d.reason || 'مشابه لاسم مسجل' : undefined
    }
    if (r.candidates.some((c) => c.status === 'pending')) throw new ApiError('حدد قرارًا لكل اسم')
    const anyAccepted = r.candidates.some((c) => c.status === 'accepted')
    Object.assign(r, { status: anyAccepted ? 'accepted' : 'rejected', reviewedAt: iso(now()), reviewerName: u.fullName, reviewNote: note })
    if (!anyAccepted) refundDeposit(db, r, 'مرفوض')
    return r
  }),

  rejectRequest: (id, reason) => tx((db) => {
    const u = staff(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r || r.status !== 'under_review') throw new ApiError('لا يمكن رفض هذا الطلب')
    r.candidates.forEach((c) => { c.status = 'rejected'; c.rejectReason = reason })
    Object.assign(r, { status: 'rejected', reviewedAt: iso(now()), reviewerName: u.fullName, reviewNote: reason })
    refundDeposit(db, r, 'مرفوض')
    return r
  }),

  cancelRequest: (id, reason) => tx((db) => {
    const u = staff(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r || !['under_review', 'accepted'].includes(r.status)) throw new ApiError('لا يمكن إلغاء هذا الطلب')
    if (r.candidates.some((c) => c.auctionId)) throw new ApiError('لا يمكن إلغاء طلب فُتح له مزاد')
    Object.assign(r, { status: 'cancelled', reviewedAt: iso(now()), reviewerName: u.fullName, reviewNote: reason })
    refundDeposit(db, r, 'ألغته اللجنة')
    return r
  }),

  awaitingSchedule: () => tx((db) => {
    staff(db)
    return db.requests.filter((r) => r.status === 'accepted')
      .flatMap((r) => r.candidates.filter((c) => c.status === 'accepted' && !c.auctionId).map((c) => ({ ...c, request: r })))
  }),

  scheduleAuctions: (candidateIds, startsAt, endsAt) => tx((db) => {
    staff(db)
    const s = Date.parse(startsAt), e = Date.parse(endsAt)
    if (!s || !e) throw new ApiError('حدد موعد البداية والنهاية')
    if (e <= s) throw new ApiError('موعد النهاية يجب أن يكون بعد البداية')
    if (e <= now()) throw new ApiError('موعد النهاية في الماضي')
    if (!candidateIds.length) throw new ApiError('اختر اسمًا واحدًا على الأقل')
    const out: Auction[] = []
    for (const cid of candidateIds) {
      const r = db.requests.find((x) => x.candidates.some((c) => c.id === cid))
      const c = r?.candidates.find((x) => x.id === cid)
      if (!r || !c || c.status !== 'accepted' || c.auctionId) continue
      const a: Auction = {
        id: uid(db, 'a'), requestId: r.id, candidateId: c.id, name: c.name, type: r.type, requesterId: r.userId,
        openingPrice: RULES.openingPrice, minIncrement: RULES.minIncrement, startsAt: iso(s), endsAt: iso(e),
        currentPrice: RULES.openingPrice, bidCount: 0, settled: false,
      }
      c.auctionId = a.id
      db.auctions.push(a)
      out.push(a)
    }
    return out
  }),

  allInvoices: () => tx((db) => {
    staff(db)
    return [...db.invoices].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
  }),

  markInvoicePaid: (id) => tx((db) => {
    staff(db)
    const inv = db.invoices.find((i) => i.id === id)
    if (!inv || inv.status === 'paid') throw new ApiError('الفاتورة غير موجودة أو مدفوعة')
    inv.status = 'paid'
    inv.paidAt = iso(now())
    return inv
  }),

  listUsers: () => tx((db) => {
    staff(db)
    return db.users.map(publicUser)
  }),
}
