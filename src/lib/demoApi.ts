/**
 * Demo backend: the full business logic running in the browser on localStorage,
 * so the platform can be tried on GitHub Pages without a server.
 * The production backend (repo Ibrasalato/sammaha-api, ASP.NET Core + SQL Server) implements the same rules.
 */
import { ApiError } from './api'
import type { OtpChallenge, PayMethod, SammhaApi, SignUpInput } from './api'
import type { ActivityEntry, ActivityFilter, Certificate, CertificateItem, CertificateScope, CertificateStatus, Delegation, DelegationScope, AuctionActionResult, AuctionScope, AuctionView, AuditRow, BankAccount, DepositRow, IbanCheck, MarkRow, NameListing, OwnerCrm, OwnerProfile, Preferences, SimilarHit, StaffBankAccount, StaffRole, TicketRouting, WalletRow, Withdrawal, NameTransfer, LogoRow } from './types'
import { ALL_PERMISSIONS, COMMITTEE_DEFAULT, COMMITTEE_ROLE_ID, permissionLabel } from './permissions'
import type { Permission } from './permissions'
import { demoRules, ensureOpen, ensureWritable, logAction, publicOf, readLog, readRouting, readSettings, writeRouting, writeSettings } from './demoSettings'
import { NAME_TYPES, OTP, RULES, SUPER_ADMIN_EMAIL } from './config'
import { maskEmail, maskPhone, otpDigits } from './otp'
import { namesCount } from './format'
import { SEED_EVENTS } from './events'
import { certNo } from './cert'
import { isLatinQuery, latinKey, toLatin } from './translit'
import { SIMILAR_THRESHOLD, findMatches, normalizeName, relation, sameForms, similarity, validateName } from './names'
import { emailTicketEvent, normalizePhone, publicTicket, validateTicket } from './tickets'
import type { MatchSource } from './names'
import type {
  AppNotification, CamelEvent, Auction, Ticket, AuctionPhase, Bid, Candidate, Invoice, LogoRequest, NameCheck, NameType, ReservedName,
  User, WalletTx,
} from './types'

interface DemoUser extends User {
  password: string
  /** the owner's name in Latin letters, as in their passport */
  fullNameEn?: string
  prefs?: Preferences
  failedLogins?: number
  lockedUntil?: number
  lastLoginAt?: string
  /** bumped by "sign out everyone"; a demo session started before it ends */
  stamp?: number
  /** owner profile (sign-up and the dashboard) */
  p?: Omit<OwnerProfile, 'emailVerified' | 'completion' | 'missing'>
  emailVerifiedAt?: string
}
interface DemoCert {
  id: string; number: string; ownerId: string; scope: CertificateScope; ownerNameAr: string; ownerNameEn: string; nationalId?: string; nationality?: string
  items: Omit<CertificateItem, 'current' | 'typeLabel'>[]; issuedAt: string; signature: string; revokedAt?: string; revokedBy?: string; revokeReason?: string
}
interface AutoBid { auctionId: string; userId: string; max: number; createdAt: string }
interface Watch { auctionId: string; userId: string; notifiedStart?: boolean; notifiedEnd?: boolean }
interface DB {
  v: number
  seq: number
  users: DemoUser[]
  requests: LogoRequest[]
  auctions: Auction[]
  bids: Bid[]
  reserved: ReservedName[]
  certificates?: DemoCert[]
  txs: WalletTx[]
  invoices: Invoice[]
  events: CamelEvent[]
  notes: AppNotification[]
  tickets: Ticket[]
  autobids?: AutoBid[]
  watches?: Watch[]
  listings?: NameListing[]
  bidDeposits?: BidDeposit[]
  /** staff roles (the built-in committee role is added on first use) */
  roles?: StaffRole[]
  auctionSeq?: number
  withdrawals?: Withdrawal[]
  banks?: (Omit<BankAccount, 'ibanMasked'> & { userId: string; docBase64: string })[]
  delegations?: (Omit<Delegation, 'ownerName' | 'status' | 'capacityLabel' | 'linked'> & { delegateUserId?: string; revokedAt?: string })[]
  transfers?: NameTransfer[]
  logos?: (LogoRow & { dataUrl: string })[]
  transferSeq?: number
}
interface BidDeposit { auctionId: string; userId: string; amount: number; state: 'held' | 'refunded' | 'applied' | 'forfeited'; createdAt: string }

const KEY = 'sammha-demo-db'
const SESSION = 'sammha-demo-session'
const VERSION = 11

const now = () => Date.now()
const iso = (t: number) => new Date(t).toISOString()
const H = 3600_000
const D = 24 * H
const round2 = (n: number) => Math.round(n * 100) / 100

function uid(db: DB, prefix: string) {
  db.seq += 1
  return `${prefix}${db.seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function phaseOf(a: Pick<Auction, 'startsAt' | 'endsAt'> & { cancelled?: boolean }, t = now()): AuctionPhase {
  if (a.cancelled) return 'ended'
  if (t < Date.parse(a.startsAt)) return 'scheduled'
  if (t < Date.parse(a.endsAt)) return 'live'
  return 'ended'
}

/** sign-up details of the sample owners (made-up IDs for testing) */
function sampleProfiles(db: DB) {
  const P: Record<string, { id: string; parts: [string, string, string, string]; birth: string; city: string; verified?: boolean; district?: string; postal?: string }> = {
    'u-owner': { id: '1023456781', parts: ['سعد', 'ناصر', 'عبدالله', 'العتيبي'], birth: '1984-03-12', city: 'الرياض', verified: true, district: 'الملقا', postal: '13521' },
    'u-b1': { id: '1034567892', parts: ['عبدالرحمن', 'محمد', 'سعد', 'القحطاني'], birth: '1979-11-02', city: 'خميس مشيط', verified: true, district: 'الدوحة', postal: '62431' },
    'u-b2': { id: '1045678903', parts: ['فهد', 'عبدالله', 'حمد', 'الدوسري'], birth: '1988-06-25', city: 'الدمام', district: 'الفيصلية', postal: '32272' },
    'u-b3': { id: '1056789014', parts: ['نايف', 'سالم', 'راشد', 'المري'], birth: '1991-01-17', city: 'الأحساء' },
  }
  for (const u of db.users) {
    const p = P[u.id]
    if (!p || u.role !== 'owner') continue
    u.nationalId ??= p.id
    u.p = {
      firstName: p.parts[0], fatherName: p.parts[1], grandfatherName: p.parts[2], familyName: p.parts[3], birthDate: p.birth, gender: 'male',
      nationality: 'SA', residenceCountry: 'SA', residenceCity: p.city,
      ...(p.postal ? { addressCountry: 'SA', addressCity: p.city, district: p.district, postalCode: p.postal } : {}),
      ...u.p,
    }
    if (p.verified) u.emailVerifiedAt ??= iso(now() - 60 * D)
    // like the API's sample data: every sample owner starts with a ⃁ 2,000 test balance
    if (!db.txs.some((x) => x.userId === u.id && x.kind === 'topup' && x.amount >= 2000))
      db.txs.push({ id: `t-seed-${u.id}`, userId: u.id, amount: 2000, kind: 'topup', note: 'رصيد تجريبي', createdAt: iso(now() - 60 * D) })
  }
}

// ───────────────────────── seed ─────────────────────────
function seed(): DB {
  const t = now()
  const db: DB = { v: VERSION, seq: 100, users: [], requests: [], auctions: [], bids: [], reserved: [], txs: [], invoices: [], events: structuredClone(SEED_EVENTS), notes: [], tickets: [] }
  const mkUser = (id: string, fullName: string, phone: string, role: User['role'], email: string): DemoUser =>
    ({ id, fullName, phone, email, role, password: '123456', createdAt: iso(t - 90 * D) })

  db.users.push(
    mkUser('u-owner', 'سعد بن ناصر العتيبي', '0500000001', 'owner', 'owner@demo.sa'),
    mkUser('u-staff', 'لجنة الاعتماد', '0500000002', 'committee', 'committee@demo.sa'),
    superAdmin(t),
    mkUser('u-b1', 'عبدالرحمن محمد سعد القحطاني', '0500000003', 'owner', 'b1@demo.sa'),
    mkUser('u-b2', 'فهد عبدالله الدوسري', '0500000004', 'owner', 'b2@demo.sa'),
    mkUser('u-b3', 'نايف سالم المري', '0500000005', 'owner', 'b3@demo.sa'),
  )

  const legacy: [string, NameType, string, number, number][] = [
    ['الفاخر', 'qaadan', 'عبدالرحمن محمد سعد القحطاني', 4200, 300],
    ['سلطان', 'qaadan', 'فهد عبدالله الدوسري', 12500, 260],
    ['مرهوب', 'qaadan', 'نايف سالم المري', 3100, 240],
    ['شامخ', 'qaadan', 'عبدالرحمن محمد سعد القحطاني', 2750, 200],
    ['البيرق', 'qaadan', 'فهد عبدالله الدوسري', 8800, 180],
    ['الأدهم', 'qaadan', 'نايف سالم المري', 1900, 150],
    ['راعد', 'qaadan', 'عبدالرحمن محمد سعد القحطاني', 650, 120],
    ['الشعلة', 'bakkar', 'فهد عبدالله الدوسري', 9600, 280],
    ['الغيمة', 'bakkar', 'عبدالرحمن محمد سعد القحطاني', 5400, 250],
    ['مزنة', 'bakkar', 'نايف سالم المري', 2300, 210],
    ['الهدباء', 'bakkar', 'عبدالرحمن محمد سعد القحطاني', 7100, 190],
    ['شقحاء', 'bakkar', 'فهد عبدالله الدوسري', 3900, 160],
    ['الوضحى', 'bakkar', 'نايف سالم المري', 1250, 110],
    ['غزلان', 'bakkar', 'عبدالرحمن محمد سعد القحطاني', 980, 90],
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
  seedTickets(db, t)
  seedInvestment(db, t)
  seedManqiya(db, t)
  seedListings(db, t)
  // compute similar hits for pending requests
  for (const r of db.requests) for (const c of r.candidates) if (!c.similar.length) c.similar = similarFor(db, c.normalized, r.id)
  sampleProfiles(db)
  return db
}

export function maskName(full: string) {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return `${parts[0].slice(0, 2)}…`
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 2)}…`
}

function notify(db: DB, userId: string, kind: AppNotification['kind'], title: string, body: string, link?: string) {
  db.notes.push({ id: uid(db, 'n'), userId, kind, title, body, link, createdAt: iso(now()), read: false })
}

/** The super admin has no password in the demo: the first sign-in on the staff portal sets it. */
function superAdmin(t: number): DemoUser {
  return { id: 'u-super', fullName: 'إبراهيم صلاح', phone: '0500000010', email: SUPER_ADMIN_EMAIL, role: 'admin', password: '', createdAt: iso(t - 120 * D) }
}
const isSuper = (u: Pick<User, 'email'>) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL

/** Sample «استثمار الاسم» requests: names offered by an owner, now in public auction. */
function seedInvestment(db: DB, t: number) {
  const owner = db.users.find((x) => x.id === 'u-b2')!
  const mkReq = (id: string, name: string, type: NameType, status: LogoRequest['status'], daysAgo: number): LogoRequest => {
    const r: LogoRequest = {
      id, number: `SM-${1000 + db.requests.length + 1}`, userId: owner.id, ownerName: owner.fullName, type, kind: 'investment',
      candidates: [{ id: `c-${id}`, name, normalized: normalizeName(name), status: status === 'accepted' ? 'accepted' : 'pending', similar: [] }],
      status, depositAmount: RULES.investFee, depositPaid: true, depositState: 'fee', createdAt: iso(t - daysAgo * D), submittedAt: iso(t - daysAgo * D),
      reviewedAt: status === 'accepted' ? iso(t - (daysAgo - 1) * D) : undefined, reviewerName: status === 'accepted' ? 'لجنة الاعتماد' : undefined,
    }
    db.requests.push(r)
    db.txs.push({ id: uid(db, 't'), userId: owner.id, amount: -RULES.investFee, kind: 'service_fee', note: `رسوم دراسة طلب استثمار الاسم ${r.number}`, createdAt: iso(t - daysAgo * D) })
    return r
  }
  const mkAuction = (r: LogoRequest, start: number, end: number, bids: [string, number][]) => {
    const c = r.candidates[0]
    const a: Auction = { id: `a-${c.id}`, requestId: r.id, candidateId: c.id, name: c.name, type: r.type, requesterId: r.userId, openingPrice: RULES.openingPrice,
      minIncrement: RULES.minIncrement, startsAt: iso(t + start), endsAt: iso(t + end), currentPrice: RULES.openingPrice, bidCount: 0, settled: false, investment: true }
    bids.forEach(([uidB, amount], k) => {
      const u = db.users.find((x) => x.id === uidB)!
      db.bids.push({ id: `b-${c.id}${k}`, auctionId: a.id, userId: uidB, bidderLabel: maskName(u.fullName), amount, createdAt: iso(t + start + (k + 1) * H) })
      Object.assign(a, { currentPrice: amount, bidCount: k + 1, leaderId: uidB, leaderLabel: maskName(u.fullName) })
    })
    db.auctions.push(a); c.auctionId = a.id
  }
  mkAuction(mkReq('qi1', 'المكسب', 'qaadan', 'accepted', 6), -1 * D, 2 * D, [['u-b1', 150], ['u-b3', 320], ['u-b1', 600]])
  mkAuction(mkReq('qi2', 'الذخر', 'bakkar', 'accepted', 5), -12 * H, 30 * H, [['u-owner', 90]])
  mkReq('qi3', 'نسيم الوادي', 'bakkar', 'under_review', 1)
}

function seedTickets(db: DB, t: number) {
  const mk = (n: number, ago: number, x: Omit<Ticket, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'messages'>, replies: [Ticket['messages'][number]['by'], string, string, boolean?][] = []) => {
    const created = t - ago
    db.tickets.push({
      ...x, id: `tk${n}`, number: `BL-26${String(n).padStart(4, '0')}`, createdAt: iso(created), updatedAt: iso(created + replies.length * H),
      messages: replies.map(([by, author, body, internal], i) => ({ id: `tm${n}${i}`, by, author, body, internal, createdAt: iso(created + (i + 1) * H) })),
    })
  }
  mk(1, 6 * D, { kind: 'inquiry', topic: 'استرداد الضمان', subject: 'متى يرجع ضمان الطلب المرفوض؟', name: 'فهد عبدالله الدوسري', phone: '0500000004', userId: 'u-b2', refNumber: 'SM-1003', message: 'رُفض طلبي ولم أجد مبلغ الضمان في المحفظة، أرجو التوضيح.', status: 'answered', priority: 'normal' },
    [['staff', 'لجنة الاعتماد', 'حياك الله، الضمان أُعيد إلى محفظتك فور رفض الطلب، وتجده في سجل الحركات بعنوان «استرداد ضمان». يمكنك استخدامه في طلب جديد.']])
  mk(2, 2 * D, { kind: 'report', topic: 'استخدام اسم بغير حق', subject: 'اسم مسجل باسمي يُستخدم في مزاين', name: 'سعد بن ناصر العتيبي', phone: '0500000001', userId: 'u-owner', email: 'owner@demo.sa', message: 'لاحظت أن اسم «الهيلع» المسجل باسمي يُستخدم على فردي آخر في مزاين محلية. أرفق اسم المشارك عند الطلب.', status: 'in_progress', priority: 'urgent', assignee: 'لجنة الاعتماد' },
    [['staff', 'لجنة الاعتماد', 'تم التحقق من الشهادة، وجارٍ التواصل مع اللجنة المنظمة.', true]])
  mk(3, 5 * H, { kind: 'complaint', topic: 'الفواتير والدفع', subject: 'الدفع بمدى لم يكتمل', name: 'نايف سالم المري', phone: '0500000005', userId: 'u-b3', message: 'حاولت سداد الفاتورة ببطاقة مدى وظهرت رسالة خطأ، ولم يُخصم المبلغ.', status: 'new', priority: 'normal' })
  db.seq += 3
}

// ───────────────────────── one-time codes ─────────────────────────
// Demo: the code is OTP.fixedCode until an SMS provider is connected.
interface Challenge { userId: string; purpose: 'login' | 'phone' | 'email' | 'verify_email' | 'signup'; phone: string; expires: number; attempts: number }
const challenges = new Map<string, Challenge>()
function issueOtp(userId: string, purpose: Challenge['purpose'], phone: string, id = `otp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`): OtpChallenge {
  const expires = now() + OTP.ttlMinutes * 60_000
  challenges.set(id, { userId, purpose, phone, expires, attempts: 0 })
  return { challenge: id, phoneMasked: purpose === 'email' || purpose === 'verify_email' ? maskEmail(phone) : maskPhone(phone), expiresAt: iso(expires), length: OTP.length }
}
function consumeOtp(id: string, code: string, purpose: Challenge['purpose']): Challenge {
  const c = challenges.get(id)
  if (!c || c.purpose !== purpose || now() > c.expires) { challenges.delete(id); throw new ApiError('انتهت صلاحية الرمز، اطلب رمزًا جديدًا') }
  if (c.attempts >= OTP.maxAttempts) { challenges.delete(id); throw new ApiError('تجاوزت عدد المحاولات، اطلب رمزًا جديدًا') }
  c.attempts += 1
  if (otpDigits(code) !== OTP.fixedCode) throw new ApiError(`الرمز غير صحيح، بقي ${OTP.maxAttempts - c.attempts} محاولات`)
  challenges.delete(id)
  return c
}

/** Sample «منقية» (herd) names: a few registered, one request in auction, one waiting for the committee. */
function seedManqiya(db: DB, t: number) {
  for (const [name, ownerId, price, daysAgo] of [['الوسمية', 'u-b1', 6400, 230], ['الحراير', 'u-b2', 3800, 170], ['الشرهات', 'u-owner', 2100, 95]] as [string, string, number, number][]) {
    const owner = db.users.find((u) => u.id === ownerId)!
    db.reserved.push({ id: uid(db, 'r'), name, normalized: normalizeName(name), type: 'manqiya', ownerId, ownerName: owner.fullName, price, acquiredAt: iso(t - daysAgo * D), source: 'legacy' })
  }
  const mk = (id: string, userId: string, names: string[], status: LogoRequest['status'], daysAgo: number): LogoRequest => {
    const u = db.users.find((x) => x.id === userId)!
    const r: LogoRequest = {
      id, number: `SM-${1000 + db.requests.length + 1}`, userId, ownerName: u.fullName, type: 'manqiya',
      candidates: names.map((n, i) => ({ id: `c-${id}-${i}`, name: n, normalized: normalizeName(n), status: status === 'accepted' ? 'accepted' : 'pending', similar: [] })),
      status, depositAmount: RULES.depositAmount, depositPaid: true, depositState: 'held', createdAt: iso(t - daysAgo * D), submittedAt: iso(t - daysAgo * D + 600_000),
      reviewedAt: status === 'accepted' ? iso(t - (daysAgo - 1) * D) : undefined, reviewerName: status === 'accepted' ? 'لجنة الاعتماد' : undefined,
    }
    db.requests.push(r)
    db.txs.push({ id: uid(db, 't'), userId, amount: -RULES.depositAmount, kind: 'deposit', note: `ضمان مزاد الطلب ${r.number}`, createdAt: r.submittedAt! })
    return r
  }
  const auction = (r: LogoRequest, i: number, start: number, end: number, bids: [string, number][]) => {
    const c = r.candidates[i]
    const a: Auction = { id: `a-${c.id}`, requestId: r.id, candidateId: c.id, name: c.name, type: r.type, requesterId: r.userId, openingPrice: RULES.openingPrice,
      minIncrement: RULES.minIncrement, startsAt: iso(t + start), endsAt: iso(t + end), currentPrice: RULES.openingPrice, bidCount: 0, settled: false }
    bids.forEach(([uidB, amount], k) => {
      const u = db.users.find((x) => x.id === uidB)!
      db.bids.push({ id: `b-${c.id}${k}`, auctionId: a.id, userId: uidB, bidderLabel: maskName(u.fullName), amount, createdAt: iso(t + start + (k + 1) * H) })
      Object.assign(a, { currentPrice: amount, bidCount: k + 1, leaderId: uidB, leaderLabel: maskName(u.fullName) })
    })
    db.auctions.push(a); c.auctionId = a.id
  }
  const r = mk('qm1', 'u-b3', ['الصفوة', 'الأصايل', 'العليا'], 'accepted', 7)
  auction(r, 0, -2 * D, D + 6 * H, [['u-b1', 250], ['u-owner', 480], ['u-b2', 900]])
  auction(r, 1, -D, 2 * D + 3 * H, [['u-b2', 120]])
  auction(r, 2, D + 2 * H, 4 * D, [])
  mk('qm2', 'u-b1', ['ضي القمرا', 'الهوامل', 'المزايين'], 'under_review', 0.5)
}

// ───────────────────────── persistence ─────────────────────────
function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      if (db.v === VERSION) return db
      if (db.v === 4) { db.tickets = []; seedTickets(db, now()); db.v = 5 }
      if (db.v === 5) {
        if (!db.users.some(isSuper)) db.users.push(superAdmin(now()))
        db.v = 6
      }
      if (db.v === 6) db.v = 7
      if (db.v === 7) {
        // «استثمار» was briefly a name category; it is the «استثمار الاسم» service instead
        const gone = (x: { type?: string }) => (x.type as string) === 'istithmar'
        const oldAuctions = new Set(db.auctions.filter(gone).map((a) => a.id))
        db.reserved = db.reserved.filter((x) => !gone(x))
        db.requests = db.requests.filter((x) => !gone(x))
        db.bids = db.bids.filter((b) => !oldAuctions.has(b.auctionId))
        db.auctions = db.auctions.filter((a) => !oldAuctions.has(a.id))
        db.invoices = db.invoices.filter((i) => !gone(i))
        if (!db.requests.some((r) => r.kind === 'investment')) seedInvestment(db, now())
        db.v = 8
      }
      if (db.v === 8) {
        // «منقية» joins قعدان and بكار
        if (!db.requests.some((r) => r.type === 'manqiya')) seedManqiya(db, now())
        db.v = 9
      }
      if (db.v === 9) {
        // «بيع اسم»: owners reselling names they own
        if (!db.listings?.length) seedListings(db, now())
        db.v = 10
      }
      if (db.v === 10) {
        // the sample farm becomes a person, and sample owners get the sign-up details
        const fixed = JSON.parse(JSON.stringify(db).replaceAll('مزرعة الوسم للإبل', 'عبدالرحمن محمد سعد القحطاني')) as DB
        sampleProfiles(fixed)
        fixed.v = VERSION; save(fixed); return fixed
      }
    }
  } catch { /* storage unavailable */ }
  const db = seed()
  save(db)
  return db
}
// other tabs hear about every change at once (the demo's stand-in for realtime)
const live = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sammha-live') : null
function save(db: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ }
  try { live?.postMessage('changed') } catch { /* ignore */ }
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
      if (c.status === 'rejected' || c.status === 'withdrawn') continue
      if (r.kind === 'compound' && r.status === 'accepted') continue // already in the registry
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

/** invoices, purchases and fees go through the payment channels; the wallet pays guarantees only */
const CARD_ONLY = 'تُسدَّد هذه العملية من قنوات الدفع (البطاقة) فقط، ورصيد المحفظة مخصص لسداد الضمانات'

function balanceOf(db: DB, userId: string) {
  return round2(db.txs.filter((t) => t.userId === userId).reduce((s, t) => s + t.amount, 0))
}

/** Owner may cancel before review, or after acceptance as long as none of its auctions has started. */
function cancellable(db: DB, r: LogoRequest, t = now()) {
  if (r.status === 'pending_payment' || r.status === 'under_review') return true
  if (r.status !== 'accepted' || r.kind === 'compound') return false
  return r.candidates.every((c) => {
    const a = c.auctionId ? db.auctions.find((x) => x.id === c.auctionId) : undefined
    return !a || (t < Date.parse(a.startsAt) && a.bidCount === 0)
  })
}
/** A single name can be withdrawn while it is pending or accepted and its auction (if any) has not started. */
function withdrawable(db: DB, r: LogoRequest, c: LogoRequest['candidates'][number], t = now()) {
  if (!['pending_payment', 'under_review', 'accepted'].includes(r.status)) return false
  if (r.kind === 'compound') return false // a single name: cancel the request instead
  if (c.status !== 'pending' && c.status !== 'accepted') return false
  const a = c.auctionId ? db.auctions.find((x) => x.id === c.auctionId) : undefined
  return !a || (t < Date.parse(a.startsAt) && a.bidCount === 0)
}
const withCancel = (db: DB, r: LogoRequest): LogoRequest => ({
  ...r, cancellable: cancellable(db, r), candidates: r.candidates.map((c) => ({ ...c, withdrawable: withdrawable(db, r, c) })),
})

function refundDeposit(db: DB, r: LogoRequest, why: string) {
  if (r.depositState !== 'held') return
  r.depositState = 'refunded'
  db.txs.push({ id: uid(db, 't'), userId: r.userId, amount: r.depositAmount, kind: 'refund', note: `استرداد ضمان الطلب ${r.number} (${why})`, createdAt: iso(now()) })
  notify(db, r.userId, 'refund', 'أُعيد ضمان المزاد إلى محفظتك', `${r.depositAmount} ⃁ من الطلب ${r.number} (${why}).`, '/dashboard/wallet')
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
// ───────────────────────── «استثمار الاسم» ─────────────────────────
/** Sold to a bidder: invoice to the winner, 30% of the net price earmarked for the name owner.
 *  No bids: the name goes to its owner at no price and without the 30%. */
function settleInvestment(db: DB, a: Auction, r: LogoRequest) {
  const owner = db.users.find((u) => u.id === r.userId)!
  if (a.bidCount === 0 || !a.leaderId) {
    db.reserved.push({ id: uid(db, 'r'), name: a.name, normalized: normalizeName(a.name), type: a.type, ownerId: owner.id, ownerName: owner.fullName, price: 0, acquiredAt: a.endsAt, source: 'investment' })
    Object.assign(a, { settled: true, winnerId: owner.id, winnerName: owner.fullName, finalPrice: 0, wonByRequester: true })
    notify(db, owner.id, 'won', `انتهى مزاد «${a.name}» دون مزايدات`, 'رسا الاسم عليك بلا مقابل، ولا تُستحق نسبة الـ30% لعدم وجود مزايدة.', '/dashboard/names')
    return
  }
  const winner = db.users.find((u) => u.id === a.leaderId)!
  const price = a.currentPrice
  const inv = issueInvoice(db, a, winner, price, 0)
  inv.ownerShare = round2((price - inv.vat) * RULES.investOwnerShare)
  inv.ownerShareTo = owner.id
  db.reserved.push({ id: uid(db, 'r'), name: a.name, normalized: normalizeName(a.name), type: a.type, ownerId: winner.id, ownerName: winner.fullName, price, acquiredAt: a.endsAt, source: 'investment' })
  Object.assign(a, { settled: true, winnerId: winner.id, winnerName: winner.fullName, finalPrice: price, wonByRequester: false })
  notify(db, winner.id, 'won', `مبارك عليك الفوز بمزاد شعار «${a.name}»`, `بسعر ${price} ⃁. فاتورتك الإلكترونية جاهزة، سدّدها لإصدار شهادة التسجيل.`, '/dashboard/invoices')
  notify(db, owner.id, 'won', `بيع اسمك «${a.name}» في المزاد`, `بسعر ${price} ⃁. نصيبك ${inv.ownerShare} ⃁ (30%) يُضاف إلى محفظتك فور سداد الفائز.`, '/dashboard/invest')
  for (const u of new Set(db.bids.filter((b) => b.auctionId === a.id && b.userId !== winner.id).map((b) => b.userId))) {
    notify(db, u, 'lost', `انتهى مزاد «${a.name}»`, `رسا الاسم بسعر ${price} ⃁.`, `/auctions/${a.id}`)
  }
}
/** Pays the name owner's 30% once the winner's invoice is paid. */
function payOwnerShare(db: DB, inv: Invoice) {
  if (!inv.ownerShare || !inv.ownerShareTo || inv.ownerSharePaid) return
  inv.ownerSharePaid = true
  const sale = !!inv.listingId
  db.txs.push({ id: uid(db, 't'), userId: inv.ownerShareTo, amount: inv.ownerShare, kind: sale ? 'sale_payout' : 'investment_payout',
    note: sale ? `ثمن بيع الاسم «${inv.name}» بعد عمولة سمّها (${inv.number})` : `نصيبك 30% من بيع الاسم «${inv.name}» (${inv.number})`, createdAt: iso(now()) })
  notify(db, inv.ownerShareTo, 'refund', `أُضيف ${inv.ownerShare} ⃁ إلى محفظتك`, sale ? `ثمن بيع اسمك «${inv.name}» بعد خصم عمولة سمّها.` : `نصيبك من بيع الاسم «${inv.name}» في المزاد.`, '/dashboard/wallet')
  if (sale) { const l = db.listings?.find((x) => x.id === inv.listingId); if (l) l.payoutPaid = true }
}
const isInvestment = (db: DB, a: Auction) => db.requests.find((r) => r.id === a.requestId)?.kind === 'investment'

// ───────────────────────── «بيع اسم» ─────────────────────────
const hasBidDeposit = (db: DB, auctionId: string, userId: string) => !!db.bidDeposits?.some((d) => d.auctionId === auctionId && d.userId === userId && d.state === 'held')
/** The seller of a resale cannot bid; every bidder pays the entry guarantee first (on a request's auction the requester's request guarantee covers them). */
function resaleGuard(db: DB, a: Auction, userId: string) {
  if (a.listingId && a.requesterId === userId) throw new ApiError('لا يمكنك المزايدة على اسم تبيعه')
  const needs = !!a.listingId || ((a.bidDeposit ?? 0) > 0 && a.requesterId !== userId)
  if (!needs) return
  if (!hasBidDeposit(db, a.id, userId)) throw new ApiError(`ادفع ضمان دخول المزاد ${a.bidDeposit ?? RULES.resaleBidDeposit} ⃁ أولًا`)
}
const pct = (r: number) => Math.round(r * 100)
function listingOut(db: DB, l: NameListing): NameListing {
  const a = l.auctionId ? db.auctions.find((x) => x.id === l.auctionId) : undefined
  return { ...l, currentPrice: a?.currentPrice ?? l.price, bidCount: a?.bidCount }
}
function transferName(db: DB, l: NameListing, buyer: DemoUser, price: number) {
  const r = db.reserved.find((x) => x.id === l.reservedId)
  if (!r) return
  Object.assign(r, { ownerId: buyer.id, ownerName: buyer.fullName, price, acquiredAt: iso(now()), source: 'resale' as const, listingId: undefined, ownerAvatar: undefined })
}
function sellerInvoice(db: DB, l: NameListing, buyer: DemoUser, price: number, depositApplied: number, auction?: Auction) {
  const inv = issueInvoice(db, auction ?? ({ id: l.id, name: l.name, type: l.type } as Auction), buyer, price, depositApplied)
  inv.listingId = l.id
  inv.ownerShare = round2(price * (1 - l.commissionRate))
  inv.ownerShareTo = l.sellerId
  l.payout = inv.ownerShare
  return inv
}
/** Instant listings close after their window; resale auctions follow their auction's phase. */
function sweepListings(db: DB) {
  let changed = false
  const t = now()
  for (const l of db.listings ?? []) {
    if (l.mode === 'instant' && l.status === 'live' && t >= Date.parse(l.endsAt)) {
      l.status = 'expired'; changed = true
      const r = db.reserved.find((x) => x.id === l.reservedId); if (r) r.listingId = undefined
      notify(db, l.sellerId, 'lost', `انتهت مدة عرض «${l.name}» للبيع`, 'لم يُشترَ الاسم خلال 72 ساعة وبقي باسمك. تقدر تعرضه من جديد.', '/dashboard/sell')
    }
    if (l.mode === 'auction' && l.status === 'scheduled' && t >= Date.parse(l.startsAt)) { l.status = 'live'; changed = true }
  }
  return changed
}
function settleResale(db: DB, a: Auction) {
  const l = db.listings?.find((x) => x.id === a.listingId)
  const seller = db.users.find((u) => u.id === a.requesterId)!
  const refundOthers = (except?: string) => {
    for (const d of db.bidDeposits ?? []) if (d.auctionId === a.id && d.state === 'held' && d.userId !== except) {
      d.state = 'refunded'
      db.txs.push({ id: uid(db, 't'), userId: d.userId, amount: d.amount, kind: 'refund', note: `استرداد ضمان دخول مزاد «${a.name}»`, createdAt: iso(now()) })
      notify(db, d.userId, 'refund', 'أُعيد ضمان دخول المزاد إلى محفظتك', `${d.amount} ⃁ من مزاد «${a.name}».`, '/dashboard/wallet')
    }
  }
  if (a.bidCount === 0 || !a.leaderId) {
    Object.assign(a, { settled: true, winnerId: seller.id, winnerName: seller.fullName, finalPrice: 0, wonByRequester: true })
    if (l) { l.status = 'unsold'; const r = db.reserved.find((x) => x.id === l.reservedId); if (r) r.listingId = undefined }
    refundOthers()
    notify(db, seller.id, 'lost', `انتهى مزاد «${a.name}» دون مزايدات`, 'بقي الاسم باسمك. تقدر تعرضه من جديد بسعر آخر.', '/dashboard/sell')
    return
  }
  const winner = db.users.find((u) => u.id === a.leaderId)!
  const price = a.currentPrice
  const dep = db.bidDeposits?.find((d) => d.auctionId === a.id && d.userId === winner.id && d.state === 'held')
  if (dep) dep.state = 'applied'
  refundOthers(winner.id)
  Object.assign(a, { settled: true, winnerId: winner.id, winnerName: winner.fullName, finalPrice: price, wonByRequester: false })
  if (!l) return
  const inv = sellerInvoice(db, l, winner, price, Math.min(dep?.amount ?? 0, price), a)
  transferName(db, l, winner, price)
  Object.assign(l, { status: 'sold', soldPrice: price, soldAt: iso(now()) })
  notify(db, winner.id, 'won', `مبارك عليك الفوز بمزاد شعار «${a.name}»`, `بسعر ${price} ⃁، وخُصم منه ضمان الدخول. سدّد الفاتورة خلال 3 أيام لنقل الاسم وإصدار شهادته.`, '/dashboard/invoices')
  notify(db, seller.id, 'won', `بيع اسمك «${a.name}» في المزاد`, `بسعر ${price} ⃁. يصلك ${inv.ownerShare} ⃁ (بعد عمولة ${pct(l.commissionRate)}%) فور سداد المشتري.`, '/dashboard/sell')
  for (const u of new Set(db.bids.filter((b) => b.auctionId === a.id && b.userId !== winner.id).map((b) => b.userId))) {
    notify(db, u, 'lost', `انتهى مزاد «${a.name}»`, `رسا الاسم بسعر ${price} ⃁.`, `/auctions/${a.id}`)
  }
}
/** Sample listings: a live resale auction, one opening soon, and fixed-price names on the market. */
function seedListings(db: DB, t: number) {
  db.listings ??= []
  const mk = (name: string, mode: 'auction' | 'instant', price: number, start: number, end: number, extra: Partial<NameListing> = {}) => {
    const r = db.reserved.find((x) => x.name === name && x.ownerId)
    if (!r) return undefined
    const l: NameListing = {
      id: `l-${r.id}`, number: `SL-${1001 + db.listings!.length}`, reservedId: r.id, name: r.name, type: r.type, sellerId: r.ownerId!, mode, price,
      commissionRate: mode === 'auction' ? RULES.resaleCommission : RULES.instantCommission, status: mode === 'auction' ? (start <= 0 ? 'live' : 'scheduled') : 'live',
      createdAt: iso(t + (mode === 'auction' ? start - RULES.resaleNoticeHours * H : start)), startsAt: iso(t + start), endsAt: iso(t + end), ...extra,
    }
    db.listings!.push(l); r.listingId = l.status === 'live' || l.status === 'scheduled' ? l.id : undefined
    if (mode === 'auction') {
      const a: Auction = { id: `a-${l.id}`, requestId: l.id, candidateId: l.id, name: l.name, type: l.type, requesterId: l.sellerId, openingPrice: price, minIncrement: RULES.minIncrement,
        startsAt: l.startsAt, endsAt: l.endsAt, currentPrice: price, bidCount: 0, settled: false, listingId: l.id, bidDeposit: RULES.resaleBidDeposit }
      db.auctions.push(a); l.auctionId = a.id
    }
    return l
  }
  const live = mk('البيرق', 'auction', 3000, -D, 2 * D)
  if (live?.auctionId) {
    const a = db.auctions.find((x) => x.id === live.auctionId)!
    ;([['u-b3', 3200], ['u-b1', 3600]] as [string, number][]).forEach(([u, amount], k) => {
      const user = db.users.find((x) => x.id === u)!
      ;(db.bidDeposits ??= []).push({ auctionId: a.id, userId: u, amount: RULES.resaleBidDeposit, state: 'held', createdAt: iso(t - D + k * H) })
      db.txs.push({ id: uid(db, 't'), userId: u, amount: RULES.resaleBidDeposit, kind: 'topup', note: 'دفع بالبطاقة لضمان مزاد', createdAt: iso(t - D + k * H) })
      db.txs.push({ id: uid(db, 't'), userId: u, amount: -RULES.resaleBidDeposit, kind: 'bid_deposit', note: `ضمان دخول مزاد «${a.name}»`, createdAt: iso(t - D + k * H) })
      db.bids.push({ id: `b-${a.id}${k}`, auctionId: a.id, userId: u, bidderLabel: maskName(user.fullName), amount, createdAt: iso(t - D + (k + 1) * 2 * H) })
      Object.assign(a, { currentPrice: amount, bidCount: k + 1, leaderId: u, leaderLabel: maskName(user.fullName) })
    })
  }
  mk('الهدباء', 'auction', 5000, 30 * H, 30 * H + RULES.resaleAuctionDays * D)
  mk('الغيمة', 'instant', 6500, -20 * H, (RULES.instantSaleHours - 20) * H)
  mk('مرهوب', 'instant', 2800, -50 * H, (RULES.instantSaleHours - 50) * H)
  mk('الأدهم', 'instant', 1500, -4 * D, -D, { status: 'expired' })
}

// ───────────────────────── bidding engine ─────────────────────────
/** Record one bid: price, leader, anti-sniping extension and the outbid notice. */
function recordBid(db: DB, a: Auction, userId: string, amount: number, auto = false) {
  const u = db.users.find((x) => x.id === userId)!
  if (a.leaderId && a.leaderId !== userId) notify(db, a.leaderId, 'outbid', `تجاوز مزايد آخر مزايدتك على «${a.name}»`, `أعلى مزايدة الآن ${amount} ⃁. زايد قبل انتهاء الوقت.`, `/auctions/${a.id}`)
  const t = now()
  db.bids.push({ id: uid(db, 'b'), auctionId: a.id, userId, bidderLabel: maskName(u.fullName), amount, createdAt: iso(t), auto: auto || undefined })
  Object.assign(a, { currentPrice: amount, bidCount: a.bidCount + 1, leaderId: userId, leaderLabel: maskName(u.fullName) })
  const win = RULES.extendMinutes * 60_000
  if (Date.parse(a.endsAt) - t < win) { a.endsAt = iso(t + win); a.extensions = (a.extensions ?? 0) + 1 }
}

/** Proxy bidding: each auto-bidder is raised by the minimum step up to their ceiling (earlier ceiling wins ties). */
function resolveAuto(db: DB, a: Auction) {
  const list = db.autobids ?? []
  for (let guard = 0; guard < 20; guard++) {
    if (phaseOf(a) !== 'live') return
    const inc = a.minIncrement
    const challenger = list.filter((x) => x.auctionId === a.id && x.userId !== a.leaderId && x.max >= a.currentPrice + inc)
      .sort((x, y) => y.max - x.max || Date.parse(x.createdAt) - Date.parse(y.createdAt))[0]
    if (!challenger) return
    const leaderAuto = a.leaderId ? list.find((x) => x.auctionId === a.id && x.userId === a.leaderId) : undefined
    const leaderMax = Math.max(leaderAuto?.max ?? 0, a.currentPrice)
    if (challenger.max > leaderMax) {
      if (leaderAuto && leaderAuto.max > a.currentPrice) recordBid(db, a, a.leaderId!, leaderAuto.max, true)
      recordBid(db, a, challenger.userId, Math.min(challenger.max, leaderMax + inc), true)
    } else {
      const leader = a.leaderId!
      recordBid(db, a, challenger.userId, challenger.max, true)
      recordBid(db, a, leader, Math.min(leaderMax, challenger.max + inc), true)
    }
  }
}

function mineFor(db: DB, auctionId: string) {
  const id = getSession()
  if (!id) return undefined
  return { watching: !!db.watches?.some((w) => w.auctionId === auctionId && w.userId === id), autoMax: db.autobids?.find((x) => x.auctionId === auctionId && x.userId === id)?.max,
    depositPaid: hasBidDeposit(db, auctionId, id) || undefined }
}
function view(db: DB, a: Auction): AuctionView {
  return { auction: a, bids: db.bids.filter((b) => b.auctionId === a.id).sort((x, y) => y.amount - x.amount || Date.parse(y.createdAt) - Date.parse(x.createdAt)), mine: mineFor(db, a.id) }
}

/** Watchlist reminders: an hour before the start, and an hour before the end. */
function remind(db: DB) {
  let changed = false
  const t = now()
  for (const w of db.watches ?? []) {
    const a = db.auctions.find((x) => x.id === w.auctionId)
    if (!a) continue
    const start = Date.parse(a.startsAt), end = Date.parse(a.endsAt)
    if (!w.notifiedStart && t < start && start - t <= H) {
      notify(db, w.userId, 'reminder', `مزاد «${a.name}» يبدأ خلال ساعة`, 'جهّز مزايدتك، أو فعّل المزايدة التلقائية.', `/auctions/${a.id}`); w.notifiedStart = true; changed = true
    }
    if (!w.notifiedEnd && t >= start && t < end && end - t <= H) {
      notify(db, w.userId, 'reminder', `مزاد «${a.name}» ينتهي خلال ساعة`, `أعلى مزايدة الآن ${a.currentPrice} ⃁.`, `/auctions/${a.id}`); w.notifiedEnd = true; changed = true
    }
  }
  return changed
}

function sweep(db: DB) {
  let changed = remind(db) || sweepListings(db)
  for (const a of db.auctions) if (!a.settled && !a.paused && phaseOf(a) === 'live' && db.autobids?.some((x) => x.auctionId === a.id)) {
    const before = a.bidCount; resolveAuto(db, a); if (a.bidCount !== before) changed = true
  }
  for (const a of db.auctions) {
    if (a.settled || a.paused || a.cancelled || phaseOf(a) !== 'ended') continue
    if (a.listingId) { settleResale(db, a); changed = true; continue }
    if (a.icoReservedId) { settleIco(db, a); changed = true; continue }
    const r = db.requests.find((x) => x.id === a.requestId)!
    if (r.kind === 'investment') { settleInvestment(db, a, r); changed = true; continue }
    const noBids = a.bidCount === 0
    const winnerId = noBids ? a.requesterId : a.leaderId!
    const winner = db.users.find((u) => u.id === winnerId)!
    const price = noBids ? a.openingPrice : a.currentPrice
    // the guarantee is never deducted: the winner pays the full price within the deadline; their guarantee returns once they pay
    const inv = issueInvoice(db, a, winner, price, 0)
    const hours = readSettings().paymentDeadlineHours
    inv.dueAt = iso(now() + hours * 3600_000)
    db.reserved.push({ id: uid(db, 'r'), name: a.name, normalized: normalizeName(a.name), type: a.type, ownerId: winner.id, ownerName: winner.fullName, price, acquiredAt: a.endsAt, source: 'auction', auctionId: a.id })
    Object.assign(a, { settled: true, winnerId, winnerName: winner.fullName, finalPrice: price, wonByRequester: winnerId === r.userId })
    notify(db, winnerId, 'won', `مبارك عليك الفوز بمزاد شعار «${a.name}»`, wonBody(price, hours), '/dashboard/invoices')
    refundEntry(db, a, winnerId)
    for (const uidLost of new Set(db.bids.filter((b) => b.auctionId === a.id && b.userId !== winnerId).map((b) => b.userId))) {
      notify(db, uidLost, 'lost', `انتهى مزاد «${a.name}»`, `رسا الاسم بسعر ${price} ⃁.`, `/auctions/${a.id}`)
    }
    changed = true
    // the requester did not win: every auction of the request settled → their guarantee returns now
    const reqAuctions = db.auctions.filter((x) => x.requestId === r.id)
    const pendingNames = r.candidates.some((c) => c.status === 'accepted' && !c.auctionId)
    if (winnerId !== r.userId && !pendingNames && reqAuctions.every((x) => x.settled) && r.depositState === 'held') refundDeposit(db, r, 'لم يُرسَ عليك أي اسم')
  }
  if (forfeitOverdue(db)) changed = true
  return changed
}

const wonBody = (price: number, hours: number) =>
  `بسعر ${price} ⃁. سدّد الفاتورة خلال ${hours} ساعة من محفظتك أو بوسائل الدفع، ويُعاد ضمانك إلى محفظتك بعد السداد. إن لم تُسدَّد في المهلة يُلغى فوزك ويُخصم الضمان ويصبح الاسم ملكًا للمنظمة الدولية للإبل.`
export const ICO_OWNER = 'المنظمة الدولية للإبل'

/** the entry guarantees of an auction's losers return to their wallets */
function refundEntry(db: DB, a: Auction, except?: string) {
  for (const d of db.bidDeposits ?? []) if (d.auctionId === a.id && d.state === 'held' && d.userId !== except) {
    d.state = 'refunded'
    db.txs.push({ id: uid(db, 't'), userId: d.userId, amount: d.amount, kind: 'refund', note: `استرداد ضمان دخول مزاد «${a.name}»`, createdAt: iso(now()) })
    notify(db, d.userId, 'refund', 'أُعيد ضمان دخول المزاد إلى محفظتك', `${d.amount} ⃁ من مزاد «${a.name}».`, '/dashboard/wallet')
  }
}

/** a name of the organization re-auctioned: the winner gets it on the same terms; no bids → it stays with the organization */
function settleIco(db: DB, a: Auction) {
  const rn = db.reserved.find((x) => x.id === a.icoReservedId)
  if (!a.leaderId || a.bidCount === 0 || !rn) { a.settled = true; refundEntry(db, a); return }
  const winner = db.users.find((u) => u.id === a.leaderId)!
  const price = a.currentPrice
  const inv = issueInvoice(db, a, winner, price, 0)
  const hours = readSettings().paymentDeadlineHours
  inv.dueAt = iso(now() + hours * 3600_000)
  Object.assign(rn, { ownerId: winner.id, ownerName: winner.fullName, price, acquiredAt: iso(now()), source: 'auction', auctionId: a.id })
  Object.assign(a, { settled: true, winnerId: winner.id, winnerName: winner.fullName, finalPrice: price, wonByRequester: false })
  refundEntry(db, a, winner.id)
  notify(db, winner.id, 'won', `مبارك عليك الفوز بمزاد شعار «${a.name}»`, wonBody(price, hours), '/dashboard/invoices')
  for (const u of new Set(db.bids.filter((b) => b.auctionId === a.id && b.userId !== winner.id).map((b) => b.userId))) notify(db, u, 'lost', `انتهى مزاد «${a.name}»`, `رسا الاسم بسعر ${price} ⃁.`, `/auctions/${a.id}`)
}

/** «اسم مستثنى»: a win not paid by its deadline is cancelled, the guarantee forfeited, and the name passes to the organization */
function forfeitOverdue(db: DB) {
  let changed = false
  for (const inv of db.invoices) {
    if (inv.status !== 'unpaid' || !inv.dueAt || Date.parse(inv.dueAt) > now() || !inv.auctionId || inv.listingId) continue
    const a = db.auctions.find((x) => x.id === inv.auctionId)
    if (!a) continue
    inv.status = 'cancelled'; inv.cancelledAt = iso(now())
    let forfeited = 0
    if (a.requestId && !a.icoReservedId) {
      const r = db.requests.find((x) => x.id === a.requestId)
      if (r && r.userId === inv.userId && r.depositState === 'held') { r.depositState = 'forfeited'; forfeited += r.depositAmount }
    }
    const dep = db.bidDeposits?.find((d) => d.auctionId === a.id && d.userId === inv.userId && d.state === 'held')
    if (dep) { dep.state = 'forfeited'; forfeited += dep.amount }
    const rn = a.icoReservedId ? db.reserved.find((x) => x.id === a.icoReservedId) : db.reserved.find((x) => x.auctionId === a.id) ?? db.reserved.find((x) => x.name === a.name && x.ownerId === inv.userId)
    if (rn) Object.assign(rn, { forfeitedFromId: inv.userId, forfeitedFromName: rn.ownerName, forfeitedAt: iso(now()), forfeitedPrice: inv.total, forfeitedDeposit: forfeited, ownerId: undefined, ownerName: ICO_OWNER, source: 'exception', acquiredAt: iso(now()) })
    notify(db, inv.userId, 'auction_update', `أُلغي فوزك بشعار «${inv.name}»`, `لم تُسدَّد الفاتورة ${inv.number} خلال المهلة، فخُصم الضمان (${forfeited} ⃁) وأصبح الاسم ملكًا للمنظمة الدولية للإبل.`, '/dashboard/invoices')
    changed = true
  }
  return changed
}

/** a paid win returns the winner's guarantee: the request guarantee (the requester won) or the entry guarantee */
function releaseWinnerGuarantee(db: DB, inv: Invoice) {
  if (!inv.auctionId || inv.listingId) return
  const a = db.auctions.find((x) => x.id === inv.auctionId)
  if (!a) return
  if (a.requestId && !a.icoReservedId) {
    const r = db.requests.find((x) => x.id === a.requestId)
    if (r && r.userId === inv.userId && r.depositState === 'held') refundDeposit(db, r, 'سُدّدت فاتورة الفوز')
  }
  const dep = db.bidDeposits?.find((d) => d.auctionId === a.id && d.userId === inv.userId && d.state === 'held')
  if (dep) {
    dep.state = 'refunded'
    db.txs.push({ id: uid(db, 't'), userId: dep.userId, amount: dep.amount, kind: 'refund', note: `استرداد ضمان دخول مزاد «${a.name}» بعد سداد الفاتورة ${inv.number}`, createdAt: iso(now()) })
    notify(db, dep.userId, 'refund', 'أُعيد ضمان دخول المزاد إلى محفظتك', `${dep.amount} ⃁ بعد سداد فاتورة «${a.name}».`, '/dashboard/wallet')
  }
}

/** serial auction numbers AU-1001…, older demo auctions numbered by start time */
function numberAuctions(db: DB) {
  const missing = db.auctions.filter((a) => !a.number)
  if (!missing.length) return
  db.auctionSeq ??= 1000 + db.auctions.filter((a) => a.number).length
  for (const a of missing.sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt))) a.number = `AU-${++db.auctionSeq}`
}

function tx<T>(fn: (db: DB) => T): Promise<T> {
  const db = load()
  currentDb = db
  numberAuctions(db)
  if (sweep(db)) save(db)
  try {
    const out = fn(db)
    numberAuctions(db)
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
  if (u.active === false) { setSession(null); throw new ApiError('هذا الحساب موقوف') }
  let mine = '0'
  try { mine = localStorage.getItem('sammha-demo-stamp') ?? '0' } catch { /* ignore */ }
  if (String(u.stamp ?? 0) !== mine) { setSession(null); throw new ApiError('انتهت الجلسة، سجّل الدخول من جديد') }
  return u
}
function routingView(db: DB): TicketRouting {
  const r = readRouting()
  return {
    ...r, handlers: r.handlers as TicketRouting['handlers'], emails: r.emails as TicketRouting['emails'],
    staff: db.users.filter((x) => x.role !== 'owner').map((x) => ({ id: x.id, fullName: x.fullName, role: x.role, staffRoleName: x.role === 'admin' ? 'مدير النظام' : roleOf(db, x)?.name, canReply: permsOf(db, x).includes('tickets.reply'), active: x.active !== false })),
  }
}


// ───────────────────────── audit, customers, finance (demo) ─────────────────────────
const maskMid = (v?: string) => (!v ? v : v.length <= 5 ? '•'.repeat(v.length) : v.slice(0, 2) + '•'.repeat(v.length - 5) + v.slice(-3))
const maskIban = (v: string) => (v.length < 8 ? v : `${v.slice(0, 4)} •••• •••• ${v.slice(-4)}`)
const sarText = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ⃁`

const SAUDI_BANKS: Record<string, string> = {
  '05': 'مصرف الإنماء', '10': 'البنك الأهلي السعودي', '15': 'بنك البلاد', '20': 'بنك الرياض', '30': 'البنك العربي الوطني', '45': 'البنك السعودي الأول (ساب)',
  '55': 'البنك السعودي الفرنسي', '60': 'بنك الجزيرة', '65': 'البنك السعودي للاستثمار', '80': 'مصرف الراجحي', '90': 'بنك الخليج الدولي', '95': 'بنك الإمارات دبي الوطني',
}
const IBAN_LEN: Record<string, number> = { SA: 24, AE: 23, KW: 30, QA: 29, BH: 22, OM: 23, JO: 30, EG: 29, LB: 28, IQ: 23, PS: 29, TN: 24, DZ: 26, MA: 28, MR: 27, LY: 25, SD: 18, YE: 30, TR: 26, PK: 24, GB: 22, FR: 27, DE: 22 }
/** same rules as Domain/Iban.cs: length per country, mod-97 check digits, Saudi bank from its code */
export function checkIbanLocal(raw: string): IbanCheck {
  const iban = raw.replace(/[\s-]/g, '').toUpperCase().replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
  if (iban.length < 4) return { valid: false, iban, message: 'اكتب رقم الآيبان' }
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return { valid: false, iban, message: 'الآيبان يبدأ بحرفي الدولة ثم رقمين، مثل SA03…' }
  const country = iban.slice(0, 2), len = IBAN_LEN[country]
  if (len ? iban.length !== len : iban.length < 15 || iban.length > 34) return { valid: false, iban, country, message: len ? `آيبان ${country} يتكون من ${len} خانة، المُدخل ${iban.length}` : 'طول الآيبان غير صحيح' }
  if (country === 'SA' && !/^\d+$/.test(iban.slice(4))) return { valid: false, iban, country, message: 'الآيبان السعودي أرقام بعد SA' }
  const digits = [...(iban.slice(4) + iban.slice(0, 4))].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('')
  let rem = 0
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97
  if (rem !== 1) return { valid: false, iban, country, message: 'رقم الآيبان غير صحيح (خانات التحقق لا تطابق)، راجعه من شهادة الآيبان' }
  const bankCode = country === 'SA' ? iban.slice(4, 6) : undefined
  const bankName = bankCode ? SAUDI_BANKS[bankCode] : undefined
  return { valid: true, iban, country, bankCode, bankName, message: bankName ? `آيبان صحيح · ${bankName}` : 'آيبان صحيح' }
}
function sniff(b64: string): string | null {
  const head = atob(b64.slice(0, 16))
  if (head.startsWith('%PDF')) return 'application/pdf'
  if (head.charCodeAt(0) === 0x89 && head.slice(1, 4) === 'PNG') return 'image/png'
  if (head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8) return 'image/jpeg'
  return null
}
function walletRow(db: DB, u: DemoUser, full: boolean): WalletRow {
  const t = db.txs.filter((x) => x.userId === u.id)
  const b = db.banks?.find((x) => x.userId === u.id)
  return {
    userId: u.id, ownerName: u.fullName, phone: full ? u.phone : maskMid(u.phone), balance: balanceOf(db, u.id),
    totalIn: round2(t.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0)), totalOut: round2(-t.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0)),
    pendingWithdrawals: round2((db.withdrawals ?? []).filter((w) => w.userId === u.id && (w.status === 'pending' || w.status === 'processing')).reduce((s, w) => s + w.amount, 0)),
    txCount: t.length, lastTxAt: t.map((x) => x.createdAt).sort().at(-1), bankStatus: b?.status, bankName: b?.bankName,
  }
}
const bankDto = (b: NonNullable<DB['banks']>[number], full: boolean): BankAccount => {
  const { userId: _u, docBase64: _d, ...rest } = b
  return { ...rest, iban: full ? b.iban : maskIban(b.iban), ibanMasked: maskIban(b.iban) }
}
const wDto = (w: Withdrawal, full: boolean): Withdrawal => ({ ...w, iban: full ? w.iban : maskIban(w.iban) })
const wNumber = (db: DB) => `WD-${1001 + (db.withdrawals?.length ?? 0)}`
const can_ = (db: DB, u: DemoUser, p: Permission) => permsOf(db, u).includes(p)

function bankReview(db: DB, userId: string, approve: boolean, reason?: string): StaffBankAccount {
  const u = need(db, 'banks.verify')
  const b = db.banks?.find((x) => x.userId === userId)
  if (!b) throw new ApiError('لا يوجد حساب بنكي')
  const why = (reason ?? '').trim()
  if (!approve && why.length < 3) throw new ApiError('اكتب سبب الرفض، يصل للمالك')
  Object.assign(b, { status: approve ? 'verified' : 'rejected', rejectReason: approve ? undefined : why, reviewedAt: iso(now()), reviewedBy: u.fullName })
  const o = db.users.find((x) => x.id === userId)!
  logAction(approve ? 'BankVerified' : 'BankRejected', u.fullName, `${o.fullName} · ${b.bankName} ${maskIban(b.iban)}${approve ? '' : ` · ${why}`}`)
  notify(db, userId, 'refund', approve ? 'اعتُمد حسابك البنكي' : 'لم يُعتمد حسابك البنكي', approve ? 'يمكنك الآن طلب استرداد رصيد محفظتك إلى حسابك.' : `السبب: ${why}. حدّث البيانات أو الشهادة من «المحفظة».`, '/dashboard/wallet')
  return { userId, ownerName: o.fullName, phone: o.phone, account: bankDto(b, true) }
}

/** every sign-up check, as the API does them */
function checkSignUp(db: DB, input: SignUpInput) {
    const policy = readSettings()
    if (!policy.signupOpen) throw new ApiError('التسجيل في المنصة متوقف مؤقتًا')
    const part = (v: string, label: string) => { const t = v.trim().replace(/\s+/g, ' '); if (t.length < 2 || t.length > 30 || /\d/.test(t)) throw new ApiError(`اكتب ${label} بالحروف (2 إلى 30 حرفًا)`); return t }
    const first = part(input.firstName, 'الاسم الأول'), father = part(input.fatherName, 'اسم الأب'), grand = part(input.grandfatherName, 'اسم الجد'), family = part(input.familyName, 'اسم العائلة')
    const birth = Date.parse(input.birthDate)
    if (!input.birthDate || Number.isNaN(birth)) throw new ApiError('أدخل تاريخ الميلاد')
    const age = (now() - birth) / (365.25 * D)
    if (age < 18) throw new ApiError('التسجيل لمن أتم 18 سنة')
    if (age > 110) throw new ApiError('تاريخ الميلاد غير صحيح')
    if (input.gender !== 'male' && input.gender !== 'female') throw new ApiError('اختر الجنس')
    if (!input.nationality) throw new ApiError('اختر الجنسية')
    if (!input.residenceCountry) throw new ApiError('اختر بلد الإقامة')
    if (input.residenceCity.trim().length < 2) throw new ApiError('اختر مدينة الإقامة')
    const nid = input.nationalId.trim().toUpperCase()
    const idError = identityError(nid, input.nationality, input.residenceCountry)
    if (idError) throw new ApiError(idError)
    const phone = normalizeIntl(input.phoneCountry, input.phone)
    if (!phone) throw new ApiError(input.phoneCountry === '966' || !input.phoneCountry ? 'رقم الجوال يبدأ بـ 5 ويتكون من 9 أرقام' : 'رقم الجوال غير صحيح لهذا البلد')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new ApiError('البريد الإلكتروني غير صحيح')
    if (input.password.length < policy.passwordMinLength) throw new ApiError(`كلمة المرور ${policy.passwordMinLength} أحرف على الأقل`)
    if (db.users.some((u) => u.nationalId === nid)) throw new ApiError('رقم الهوية مسجل مسبقًا، سجّل الدخول')
    if (db.users.some((u) => u.phone === phone)) throw new ApiError('رقم الجوال مسجل مسبقًا، سجّل الدخول')
    if (db.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())) throw new ApiError('البريد الإلكتروني مسجل مسبقًا')
  return { first, father, grand, family, nid, phone }
}

/** runs an auction action on the chosen auctions (or all running and upcoming ones); returns what was done and skipped */
function control(db: DB, scope: AuctionScope, perm: Permission, field: string, note: string | undefined, change: (a: Auction) => string | null): AuctionActionResult {
  const u = need(db, perm)
  const list = scope.all
    ? db.auctions.filter((a) => !a.settled && !a.cancelled && (!scope.type || a.type === scope.type))
    : (scope.ids ?? []).map((id) => db.auctions.find((a) => a.id === id)).filter((a): a is Auction => !!a)
  if (!scope.all && !list.length) throw new ApiError('اختر مزادًا واحدًا على الأقل')
  const done: string[] = [], skipped: AuctionActionResult['skipped'] = []
  for (const a of list) {
    const why = change(a)
    if (why) skipped.push({ id: a.id, name: a.name, reason: why })
    else done.push(a.name)
  }
  if (done.length) logAction(field, u.fullName, `${scope.all ? 'كل المزادات' : done.slice(0, 8).join('، ')}${note ? ` · ${note}` : ''}`)
  return { affected: done.length, skipped }
}
const closedWhy = (a: Auction) => (a.cancelled ? 'ملغى' : a.settled ? 'انتهى وتمت الترسية' : !a.paused && now() >= Date.parse(a.endsAt) ? 'انتهى وجارٍ الترسية' : null)
function followers(db: DB, a: Auction, title: string, body: string) {
  const users = new Set([...db.bids.filter((b) => b.auctionId === a.id).map((b) => b.userId), ...(db.watches ?? []).filter((w) => w.auctionId === a.id).map((w) => w.userId)])
  for (const u of users) notify(db, u, 'auction_update', title, body, `/auctions/${a.id}`)
}
/** owner write actions: closed during maintenance */
/** moving or decorating a name is the account holder's decision: delegates cannot */
function transferOwner(db: DB, msg = 'نقل الملكية لصاحب الحساب فقط'): DemoUser {
  const u = me(db)
  if (readActing()) throw new ApiError(msg)
  if (u.role !== 'owner') throw new ApiError('نقل الملكية لحسابات ملاك الإبل')
  return u
}
function recipientOf(db: DB, phone: string, me_: string): DemoUser {
  const p = normalizePhone(phone)
  if (!/^05\d{8}$/.test(p) && !/^\+\d{8,15}$/.test(p)) throw new ApiError('رقم الجوال غير صحيح')
  const u = db.users.find((x) => x.phone === p && x.role === 'owner')
  if (!u || u.active === false) throw new ApiError('لا يوجد مالك مسجل بهذا الرقم')
  if (u.id === me_) throw new ApiError('لا يمكن نقل الاسم إلى حسابك نفسه')
  return u
}
/** a name on sale, being auctioned or not yet paid for cannot change hands */
function nameFree(db: DB, r: ReservedName, ownerId: string) {
  if (db.listings?.some((l) => l.reservedId === r.id && (l.status === 'live' || l.status === 'scheduled'))) throw new ApiError('الاسم معروض للبيع حاليًا، ألغِ العرض أولًا')
  if (db.auctions.some((a) => !a.settled && !a.cancelled && a.name === r.name)) throw new ApiError('للاسم مزاد قائم حاليًا')
  if (db.invoices.some((i) => i.status === 'unpaid' && i.userId === ownerId && i.name === r.name)) throw new ApiError('سدّد فاتورة الاسم أولًا')
}
function sendTransfer(db: DB, t: NameTransfer) {
  t.status = 'awaiting_recipient'
  notify(db, t.toId, 'transfer', `طلب نقل ملكية «${t.name}» إليك`, `يرغب ${t.fromName} في نقل ملكية الاسم إلى حسابك. وافق على الطلب أو ارفضه من صفحة نقل الملكية.`, '/dashboard/transfers')
}
function refundTransferFee(db: DB, t: NameTransfer, why: string) {
  if (t.fee > 0 && t.feePaidAt) db.txs.push({ id: uid(db, 't'), userId: t.fromId, amount: t.fee, kind: 'refund', note: `استرداد رسوم نقل ملكية «${t.name}» (${t.number}) — ${why}`, createdAt: iso(now()) })
}
/** PNG, JPEG or WebP from base64 (no SVG) */
function sniffImage(b64: string): string | null {
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (b64.startsWith('/9j/')) return 'image/jpeg'
  try { const h = atob(b64.slice(0, 24)); if (h.startsWith('RIFF') && h.slice(8, 12) === 'WEBP') return 'image/webp' } catch { /* not base64 */ }
  return null
}

function writer(db: DB): DemoUser {
  const u = me(db)
  ensureWritable(u.role)
  return u
}
function staff(db: DB): DemoUser {
  const u = me(db)
  if (u.role === 'owner') throw new ApiError('هذه الصفحة للجنة الاعتماد فقط')
  return u
}
function targetUser(db: DB, id: string, actor: DemoUser) {
  const t = db.users.find((x) => x.id === id)
  if (!t) throw new ApiError('المستخدم غير موجود')
  if (isSuper(t)) throw new ApiError('لا يمكن تعديل حساب مدير النظام الرئيسي')
  if (t.id === actor.id) throw new ApiError('لا يمكنك تعديل صلاحيات حسابك')
  if (t.role === 'admin' && actor.role !== 'admin') throw new ApiError('حسابات مديري النظام يعدّلها مدير النظام فقط')
  return t
}
function rolesOf(db: DB): StaffRole[] {
  db.roles ??= []
  if (!db.roles.some((r) => r.id === COMMITTEE_ROLE_ID))
    db.roles.unshift({ id: COMMITTEE_ROLE_ID, name: 'لجنة الاعتماد', description: 'مراجعة الطلبات وفتح المزادات والرد على الشكاوى', permissions: [...COMMITTEE_DEFAULT], isSystem: true, members: 0 })
  return db.roles
}
function roleOf(db: DB, u: DemoUser): StaffRole | undefined {
  if (u.role !== 'committee') return undefined
  const roles = rolesOf(db)
  return roles.find((r) => r.id === (u.staffRoleId ?? COMMITTEE_ROLE_ID)) ?? roles.find((r) => r.id === COMMITTEE_ROLE_ID)
}
function permsOf(db: DB, u: DemoUser): string[] {
  return u.role === 'admin' ? [...ALL_PERMISSIONS] : u.role === 'committee' ? [...(roleOf(db, u)?.permissions ?? COMMITTEE_DEFAULT)] : []
}
function profileOf(u: DemoUser): OwnerProfile {
  const p = u.p ?? {}
  const missing: OwnerProfile['missing'] = []
  if (!p.firstName || !p.familyName || !u.nationalId || !p.birthDate || !p.gender || !p.nationality || !p.residenceCountry) missing.push('personal')
  if (!u.emailVerifiedAt) missing.push('email')
  if (!p.addressCountry || !p.addressCity || !p.district || !p.postalCode) missing.push('address')
  return { ...p, emailVerified: !!u.emailVerifiedAt, completion: Math.round(((3 - missing.length) * 100) / 3), missing }
}
/** Saudi numbers keep 05xxxxxxxx; others become +{code}{number} (same rule as the API) */
function normalizeIntl(dial: string, raw: string): string | null {
  const d = (dial || '').replace(/\D/g, '')
  let n = otpDigits(raw)
  const t = raw.trim()
  if (!d) {
    if (t.startsWith('+') || n.startsWith('00')) { n = n.replace(/^0+/, ''); return n.startsWith('966') ? normalizeIntl('966', n.slice(3)) : n.length >= 8 && n.length <= 15 ? `+${n}` : null }
    if (n.length === 9 && n.startsWith('5')) n = '0' + n
    return /^05\d{8}$/.test(n) ? n : null
  }
  if (d === '966') {
    if (n.startsWith('966')) n = n.slice(3)
    if (n.length === 9 && n.startsWith('5')) n = '0' + n
    return /^05\d{8}$/.test(n) ? n : null
  }
  if (n.startsWith(d) && n.length > d.length + 6) n = n.slice(d.length)
  n = n.replace(/^0+/, '')
  return n.length >= 6 && n.length <= 12 ? `+${d}${n}` : null
}
function identityError(id: string, nationality: string, residence: string): string | null {
  if (!id) return 'أدخل رقم الهوية'
  if (residence === 'SA' || nationality === 'SA') {
    if (!/^\d{10}$/.test(id)) return 'رقم الهوية أو الإقامة 10 أرقام'
    if (nationality === 'SA' && id[0] !== '1') return 'رقم الهوية الوطنية يبدأ بـ 1'
    if (nationality !== 'SA' && id[0] !== '2') return 'رقم الإقامة يبدأ بـ 2'
    return null
  }
  return /^[A-Z0-9]{5,20}$/.test(id) ? null : 'رقم الهوية أو الجواز من 5 إلى 20 حرفًا ورقمًا'
}
let currentDb: DB | null = null
const publicUser = (full: DemoUser): User => {
  const { password: _p, prefs: _q, failedLogins: _f, lockedUntil: _l, lastLoginAt: _a, stamp: _s, p: _pr, emailVerifiedAt: _e, ...u } = full
  if (u.role === 'owner') {
    const act = readActing()
    const d = act && currentDb?.delegations?.find((x) => x.id === act.delegationId && x.ownerId === u.id)
    const actor = d && currentDb?.users.find((x) => x.id === act!.actorId)
    return { ...u, profile: profileOf(full), ...(d && actor ? { acting: { delegationId: d.id, actorId: actor.id, actorName: actor.fullName, capacity: d.capacity, scopes: d.scopes, endsAt: d.permanent ? undefined : d.endsAt } } : {}) }
  }
  const db = currentDb
  return db ? { ...u, permissions: permsOf(db, full), staffRoleName: u.role === 'admin' ? 'مدير النظام' : roleOf(db, full)?.name } : u
}
const teamInboxes = (kind: string) => (readRouting().emails[kind] ?? '').split(',').map((e) => e.trim()).filter(Boolean)
/** with «الرد يقتصر على المسؤولين» on, only that kind's handlers, the assignee and admins may act on a ticket */
function ensureHandler(u: DemoUser, k: Ticket) {
  if (u.role === 'admin' || k.assigneeId === u.id) return
  const routing = readRouting()
  const list = routing.handlers[k.kind] ?? []
  if (routing.restrictToHandlers && list.length && !list.includes(u.id)) throw new ApiError('هذا النوع يعالجه الموظفون المسؤولون عنه فقط')
}
/** the signed-in staff member, if they hold this permission */
function need(db: DB, perm: Permission): DemoUser {
  const u = staff(db)
  if (!permsOf(db, u).includes(perm)) throw new ApiError(`ليست لديك صلاحية «${permissionLabel(perm)}»، تواصل مع مدير النظام`)
  return u
}
const DEFAULT_PREFS: Preferences = { notifyOutbid: true, notifyReminders: true, notifyResults: true, notifyRequests: true }

// ───────────────────────── API ─────────────────────────
const rawApi: SammhaApi = {
  currentUser: () => tx((db) => {
    const u = db.users.find((x) => x.id === getSession())
    return u ? publicUser(u) : null
  }),

  startSignUp: (input: SignUpInput) => tx((db) => {
    const n = checkSignUp(db, input)
    return issueOtp('', 'signup', n.phone)
  }),
  signUp: (input: SignUpInput) => tx((db) => {
    const n = checkSignUp(db, input)
    if (!input.challenge || !input.code) throw new ApiError('أدخل رمز التحقق المرسل إلى جوالك')
    const c = consumeOtp(input.challenge, input.code, 'signup')
    if (c.phone !== n.phone) throw new ApiError('تغيّر رقم الجوال بعد إرسال الرمز، اطلب رمزًا جديدًا')
    const { first, father, grand, family, nid, phone } = n
    const u: DemoUser = {
      id: uid(db, 'u'), fullName: `${first} ${father} ${grand} ${family}`, phone, email: input.email.trim(), nationalId: nid, role: 'owner', password: input.password, createdAt: iso(now()),
      p: { firstName: first, fatherName: father, grandfatherName: grand, familyName: family, birthDate: input.birthDate, gender: input.gender as 'male' | 'female', nationality: input.nationality, residenceCountry: input.residenceCountry, residenceCity: input.residenceCity.trim() },
    }
    db.users.push(u)
    // delegations waiting for this person (same national ID and mobile) link to the new account
    for (const d of db.delegations ?? []) if (!d.delegateUserId && !d.revokedAt && d.nationalId === nid && d.phone === phone) d.delegateUserId = u.id
    setSession(u.id)
    try { localStorage.setItem('sammha-demo-stamp', '0') } catch { /* ignore */ }
    return publicUser(u)
  }),
  startSignIn: (login, password, portal) => tx((db) => {
    // the identity number, the mobile (05… or +country…) or the email
    const l = login.trim().toLowerCase()
    const asPhone = normalizeIntl('', l) ?? l
    const u = db.users.find((x) => x.phone === asPhone || x.phone === l || x.email.toLowerCase() === l || (x.nationalId ?? '').toLowerCase() === l)
    const wrong = new ApiError(portal === 'staff' ? 'البيانات غير صحيحة' : 'رقم الجوال أو كلمة المرور غير صحيحة')
    if (!u) throw wrong
    // the same generic error whichever portal is wrong, so the staff portal is not revealed
    if ((portal === 'staff') !== (u.role !== 'owner')) throw wrong
    if (portal === 'staff' && isSuper(u) && !u.password) {
      if (password.length < 8) throw new ApiError('أول دخول لحساب مدير النظام: اختر كلمة مرور من 8 أحرف على الأقل')
      u.password = password
    }
    const policy = readSettings()
    if (u.lockedUntil && u.lockedUntil > now()) throw new ApiError(`تم إيقاف الدخول مؤقتًا بعد محاولات خاطئة متكررة، حاول بعد ${Math.max(1, Math.ceil((u.lockedUntil - now()) / 60000))} دقيقة`)
    if (u.password !== password) {
      // counted and saved even though sign-in fails (tx saves only on success, so save here)
      u.failedLogins = (u.failedLogins ?? 0) + 1
      if (u.failedLogins >= policy.maxLoginAttempts) { u.lockedUntil = now() + policy.lockoutMinutes * 60000; u.failedLogins = 0 }
      save(db)
      throw wrong
    }
    if (u.active === false) throw new ApiError('هذا الحساب موقوف، تواصل مع مدير النظام')
    u.failedLogins = 0
    u.lockedUntil = undefined
    return issueOtp(u.id, 'login', u.phone)
  }),

  completeSignIn: (challenge, code) => tx((db) => {
    const c = consumeOtp(challenge, code, 'login')
    const u = db.users.find((x) => x.id === c.userId)
    if (!u || u.active === false) throw new ApiError('تعذّر الدخول')
    u.lastLoginAt = iso(now())
    setSession(u.id)
    try { sessionStorage.setItem('sammha-demo-signed-in', iso(now())); localStorage.setItem('sammha-demo-stamp', String(u.stamp ?? 0)) } catch { /* ignore */ }
    return publicUser(u)
  }),

  resendOtp: (challenge) => tx(() => {
    const c = challenges.get(challenge)
    if (!c) throw new ApiError('انتهت الجلسة، أعد إدخال بياناتك')
    return issueOtp(c.userId, c.purpose, c.phone, challenge)
  }),

  updateMyAccount: ({ fullName, nationalId }) => tx((db) => {
    const u = me(db)
    const name = fullName.trim().replace(/\s+/g, ' ')
    if (name.length < 6) throw new ApiError('اكتب الاسم الرباعي')
    const nid = nationalId?.trim()
    if (nid && !/^[12]\d{9}$/.test(nid)) throw new ApiError('رقم الهوية أو الإقامة 10 أرقام يبدأ بـ 1 أو 2')
    if (u.nationalId && nid !== u.nationalId) throw new ApiError('رقم الهوية لا يُعدّل بعد التسجيل، تواصل مع الدعم لتصحيحه')
    if (u.p?.firstName && name !== u.fullName) throw new ApiError('الاسم مأخوذ من بيانات التسجيل، تواصل مع الدعم لتصحيحه')
    if (nid && nid !== u.nationalId && db.users.some((x) => x.nationalId === nid && x.id !== u.id)) throw new ApiError('رقم الهوية مسجل لحساب آخر')
    const renamed = name !== u.fullName
    Object.assign(u, { fullName: name, nationalId: nid || undefined })
    // keep the owner's name on registered names and requests in step
    if (renamed) {
      db.reserved.forEach((r) => { if (r.ownerId === u.id) r.ownerName = name })
      db.requests.forEach((r) => { if (r.userId === u.id) r.ownerName = name })
    }
    return publicUser(u)
  }),

  requestEmailChange: (newEmail) => tx((db) => {
    const u = me(db)
    const mail = newEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new ApiError('البريد الإلكتروني غير صحيح')
    if (mail.toLowerCase() === u.email.toLowerCase()) throw new ApiError('هذا بريدك الحالي')
    if (isSuper(u)) throw new ApiError('بريد مدير النظام الرئيسي ثابت')
    if (db.users.some((x) => x.email.toLowerCase() === mail.toLowerCase())) throw new ApiError('البريد الإلكتروني مسجل لحساب آخر')
    return issueOtp(u.id, 'email', mail)
  }),

  confirmEmailChange: (challenge, code) => tx((db) => {
    const u = me(db)
    const c = consumeOtp(challenge, code, 'email')
    if (c.userId !== u.id) throw new ApiError('تعذّر التحقق')
    if (db.users.some((x) => x.id !== u.id && x.email.toLowerCase() === c.phone.toLowerCase())) throw new ApiError('البريد الإلكتروني مسجل لحساب آخر')
    u.email = c.phone
    u.emailVerifiedAt = iso(now()) // the code reached the new address
    return publicUser(u)
  }),

  requestPhoneChange: (newPhone) => tx((db) => {
    const u = me(db)
    const phone = otpDigits(newPhone)
    if (!/^05\d{8}$/.test(phone)) throw new ApiError('رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام')
    if (phone === u.phone) throw new ApiError('هذا رقمك الحالي')
    if (db.users.some((x) => x.phone === phone)) throw new ApiError('رقم الجوال مسجل لحساب آخر')
    return issueOtp(u.id, 'phone', phone)
  }),

  confirmPhoneChange: (challenge, code) => tx((db) => {
    const u = me(db)
    const c = consumeOtp(challenge, code, 'phone')
    if (c.userId !== u.id) throw new ApiError('تعذّر التحقق')
    if (db.users.some((x) => x.id !== u.id && x.phone === c.phone)) throw new ApiError('رقم الجوال مسجل لحساب آخر')
    u.phone = c.phone
    return publicUser(u)
  }),

  changePassword: (current, next) => tx((db) => {
    const u = me(db)
    if (u.password !== current) throw new ApiError('كلمة المرور الحالية غير صحيحة')
    const min = readSettings().passwordMinLength
    if (next.length < min) throw new ApiError(`كلمة المرور ${min} أحرف على الأقل`)
    if (next === current) throw new ApiError('اختر كلمة مرور مختلفة عن الحالية')
    u.password = next
  }),

  signOut: async () => { setSession(null) },
  signOutEverywhere: () => tx((db) => { const u = me(db); u.stamp = (u.stamp ?? 0) + 1; setSession(null) }),

  stats: () => tx((db) => ({
    live: db.auctions.filter((a) => phaseOf(a) === 'live').length,
    upcoming: db.auctions.filter((a) => phaseOf(a) === 'scheduled').length,
    reserved: db.reserved.length,
    owners: new Set(db.reserved.map((r) => r.ownerName)).size,
  })),

  listAuctions: (f = {}) => tx((db) => {
    const q = f.q ? normalizeName(f.q) : ''
    return db.auctions
      .filter((a) => !a.cancelled)
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
    return view(db, auction)
  }),

  subscribeAuction: (_id, onChange) => {
    if (!live) return () => {}
    const h = () => onChange()
    live.addEventListener('message', h)
    return () => live.removeEventListener('message', h)
  },

  listReservedNames: (q, type) => tx((db) => {
    const n = q ? normalizeName(q) : ''
    const avatar = (r: ReservedName) => {
      const u = db.users.find((x) => (r.ownerId ? x.id === r.ownerId : x.fullName === r.ownerName))
      return u?.showAvatar && u.avatarUrl ? u.avatarUrl : undefined
    }
    const latin = q && isLatinQuery(q) ? latinKey(q.trim()) : ''
    return db.reserved.map((r) => ({ ...r, ownerAvatar: avatar(r) }))
      .filter((r) => (type && type !== 'all' ? r.type === type : true))
      .filter((r) => (latin ? latinKey(latinOf(r)).includes(latin) : n ? r.normalized.includes(n) || r.ownerName.includes(q!) : true))
      .sort((a, b) => Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt))
  }),

  checkNames: (names, _type) => tx((db) => checkNamesIn(db, names)),

  listEvents: () => tx((db) => [...db.events].sort((a, b) => a.startsOn.localeCompare(b.startsOn))),

  verifyCertificate: (code) => tx((db) => {
    const c = code.trim().toUpperCase()
    return db.reserved.find((r) => certNo(r) === c) ?? null
  }),

  submitTicket: (input) => tx((db) => {
    const clean = validateTicket(input)
    const id = getSession()
    const u = db.users.find((x) => x.id === id)
    const year = new Date().getFullYear() % 100
    const seq = db.tickets.filter((k) => k.number.startsWith(`BL-${year}`)).length + 1
    const k: Ticket = {
      ...clean, id: uid(db, 'tk'), number: `BL-${year}${String(seq).padStart(4, '0')}`, userId: u?.id,
      status: 'new', priority: clean.kind === 'report' ? 'urgent' : 'normal', messages: [], createdAt: iso(now()), updatedAt: iso(now()),
    }
    db.tickets.push(k)
    // Settings → complaints and enquiries: assign to the handler of this kind with the fewest open tickets, notify them all
    const routing = readRouting()
    const handlers = (routing.handlers[k.kind] ?? []).map((hid) => db.users.find((x) => x.id === hid && x.active !== false)).filter((x): x is DemoUser => !!x)
    if (handlers.length) {
      const open = (hid: string) => db.tickets.filter((x) => x.assigneeId === hid && x.status !== 'closed').length
      const pick = [...handlers].sort((a, b) => open(a.id) - open(b.id))[0]
      k.assigneeId = pick.id; k.assignee = pick.fullName
      const kind = ({ complaint: 'شكوى', report: 'بلاغ', inquiry: 'استفسار', suggestion: 'اقتراح' } as Record<string, string>)[k.kind]
      for (const h of handlers) notify(db, h.id, 'ticket', h.id === pick.id ? `${kind} جديد مُسند إليك: ${k.number}` : `${kind} جديد: ${k.number}`, `${k.subject} · من ${k.name}`, `/admin/tickets/${k.id}`)
    }
    emailTicketEvent('created', k, undefined, teamInboxes(k.kind))
    return publicTicket(k)
  }),

  trackTicket: (number, phone) => tx((db) => {
    const k = db.tickets.find((x) => x.number === number.trim().toUpperCase() && x.phone === normalizePhone(phone))
    return k ? publicTicket(k) : null
  }),

  followUpTicket: (number, phone, body) => tx((db) => {
    const k = db.tickets.find((x) => x.number === number.trim().toUpperCase() && x.phone === normalizePhone(phone))
    if (!k) throw new ApiError('لم نجد طلبًا بهذا الرقم والجوال')
    if (k.status === 'closed') throw new ApiError('هذا الطلب مغلق، افتح طلبًا جديدًا')
    const text = body.trim().slice(0, 3000)
    if (text.length < 2) throw new ApiError('اكتب ردك')
    k.messages.push({ id: uid(db, 'tm'), by: 'customer', author: k.name, body: text, createdAt: iso(now()) })
    if (k.status === 'answered') k.status = 'in_progress'
    k.updatedAt = iso(now())
    return publicTicket(k)
  }),

  myTickets: () => tx((db) => {
    const u = me(db)
    return db.tickets.filter((k) => k.userId === u.id || k.phone === normalizePhone(u.phone)).map(publicTicket)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }),

  listTickets: () => tx((db) => {
    need(db, 'tickets.view')
    return [...db.tickets].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }),

  getTicket: (id) => tx((db) => {
    need(db, 'tickets.view')
    const k = db.tickets.find((x) => x.id === id)
    if (!k) throw new ApiError('الطلب غير موجود')
    return k
  }),

  updateTicket: (id, patch) => tx((db) => {
    const u = need(db, 'tickets.manage')
    const k = db.tickets.find((x) => x.id === id)
    if (!k) throw new ApiError('الطلب غير موجود')
    ensureHandler(u, k)
    if (patch.assignee !== undefined) k.assigneeId = db.users.find((x) => x.fullName === patch.assignee && x.role !== 'owner')?.id
    const statusChanged = patch.status && patch.status !== k.status
    Object.assign(k, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), { updatedAt: iso(now()) })
    if (statusChanged && (k.status === 'closed' || k.status === 'in_progress')) emailTicketEvent('status', k, undefined, teamInboxes(k.kind))
    return k
  }),

  replyTicket: (id, body, internal) => tx((db) => {
    const u = need(db, 'tickets.reply')
    const k = db.tickets.find((x) => x.id === id)
    if (!k) throw new ApiError('الطلب غير موجود')
    ensureHandler(u, k)
    const text = body.trim().slice(0, 3000)
    if (text.length < 2) throw new ApiError('اكتب الرد')
    k.messages.push({ id: uid(db, 'tm'), by: 'staff', author: u.fullName, body: text, internal: internal || undefined, createdAt: iso(now()) })
    if (!internal) {
      k.status = 'answered'
      if (k.userId) notify(db, k.userId, 'ticket', `رد فريق سمّها على طلبك ${k.number}`, text.slice(0, 120), `/dashboard/tickets`)
      emailTicketEvent('reply', k, text, teamInboxes(k.kind))
    } else if (k.status === 'new') k.status = 'in_progress'
    if (!k.assignee) k.assignee = u.fullName
    k.updatedAt = iso(now())
    return k
  }),

  updateMyProfile: ({ avatarUrl, showAvatar }) => tx((db) => {
    const u = me(db)
    if (avatarUrl !== undefined) u.avatarUrl = avatarUrl ?? undefined
    u.showAvatar = showAvatar && !!u.avatarUrl
    return publicUser(u)
  }),

  myNotifications: () => tx((db) => {
    const u = me(db)
    return db.notes.filter((n) => n.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 30)
  }),

  markNotificationsRead: () => tx((db) => {
    const u = me(db)
    db.notes.forEach((n) => { if (n.userId === u.id) n.read = true })
  }),

  myRequests: () => tx((db) => {
    const u = me(db)
    return db.requests.filter((r) => r.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((r) => withCancel(db, r))
  }),

  createRequest: (type, names) => tx((db) => {
    const u = writer(db)
    ensureOpen('requests')
    if (names.length !== RULES.namesPerRequest) throw new ApiError(`أدخل ${RULES.namesPerRequest} أسماء`)
    const checks = checkNamesIn(db, names)
    const blocked = checks.filter((c) => c.verdict === 'exact' || c.verdict === 'invalid' || c.verdict === 'duplicate')
    if (blocked.length) throw new ApiError(`غيّر الأسماء المرفوضة: ${blocked.map((b) => b.name || '—').join('، ')}`)
    const r: LogoRequest = {
      id: uid(db, 'q'), number: `SM-${1000 + db.requests.length + 1}`, userId: u.id, ownerName: u.fullName, type,
      candidates: checks.map((c) => ({ id: uid(db, 'c'), name: c.name.trim(), normalized: c.normalized, status: 'pending', similar: c.hits })),
      status: 'pending_payment', depositAmount: readSettings().depositAmount, depositPaid: false, depositState: 'none', createdAt: iso(now()),
    }
    db.requests.push(r)
    return r
  }),

  createCompoundRequest: (reservedId, fullName) => tx((db) => {
    const u = writer(db)
    ensureOpen('compound')
    const base = db.reserved.find((x) => x.id === reservedId && x.ownerId === u.id)
    if (!base) throw new ApiError('اختر اسمًا من أسمائك المسجلة')
    const unpaid = db.invoices.find((i) => i.userId === u.id && i.name === base.name && i.status === 'unpaid')
    if (unpaid) throw new ApiError(`سدّد فاتورة «${base.name}» أولًا (${unpaid.number})`)
    const name = fullName.trim().replace(/\s+/g, ' ')
    const n = normalizeName(name)
    if (!n.includes(base.normalized) || n === base.normalized) throw new ApiError(`الاسم المركب يتكون من «${base.name}» مع كلمة أخرى`)
    if (name.split(' ').length > 4 || name.length > 40) throw new ApiError('الاسم المركب طويل، اكتفِ بكلمتين أو ثلاث')
    const check = checkNamesIn(db, [name])[0]
    if (check.verdict === 'invalid') throw new ApiError(check.message || 'الاسم غير صالح')
    if (check.verdict === 'exact') throw new ApiError(`«${name}» مسجل أو مطلوب مسبقًا`)
    if (db.requests.some((r) => r.kind === 'compound' && r.baseReservedId === base.id && (r.status === 'under_review' || r.status === 'pending_payment')))
      throw new ApiError(`لديك طلب اسم مركب لـ«${base.name}» تحت المراجعة`)
    const r: LogoRequest = {
      id: uid(db, 'q'), number: `SM-${1000 + db.requests.length + 1}`, userId: u.id, ownerName: u.fullName, type: base.type, kind: 'compound',
      baseName: base.name, baseReservedId: base.id,
      candidates: [{ id: uid(db, 'c'), name, normalized: n, status: 'pending', similar: check.hits.filter((h) => normalizeName(h.name) !== base.normalized) }],
      status: 'under_review', depositAmount: 0, depositPaid: false, depositState: 'none', createdAt: iso(now()), submittedAt: iso(now()),
    }
    // with a registration fee the request waits for the card payment
    const fee = readSettings().compoundFee ?? 0
    if (fee > 0) Object.assign(r, { status: 'pending_payment', depositAmount: fee, submittedAt: undefined })
    db.requests.push(r)
    return withCancel(db, r)
  }),

  createInvestmentRequest: (type, names) => tx((db) => {
    const u = writer(db)
    ensureOpen('investment')
    if (!NAME_TYPES.includes(type)) throw new ApiError('اختر النوع')
    const list = names.map((n) => n.trim()).filter(Boolean)
    if (!list.length) throw new ApiError('اكتب اسمًا واحدًا على الأقل')
    if (list.length > RULES.investMaxNames) throw new ApiError(`الحد الأقصى ${RULES.investMaxNames} أسماء في الطلب`)
    const checks = checkNamesIn(db, list)
    for (const check of checks) {
      if (check.verdict === 'invalid') throw new ApiError(check.message || 'الاسم غير صالح')
      if (check.verdict === 'duplicate') throw new ApiError(`«${check.name.trim()}» مكرر في الطلب`)
      if (check.verdict === 'exact') throw new ApiError(`«${check.name.trim()}» مسجل أو مطلوب مسبقًا، اختر اسمًا جديدًا غير مكرر`)
    }
    const r: LogoRequest = {
      id: uid(db, 'q'), number: `SM-${1000 + db.requests.length + 1}`, userId: u.id, ownerName: u.fullName, type, kind: 'investment',
      candidates: checks.map((check) => ({ id: uid(db, 'c'), name: check.name.trim(), normalized: check.normalized, status: 'pending' as const, similar: check.hits })),
      status: 'pending_payment', depositAmount: RULES.investFee, depositPaid: false, depositState: 'none', createdAt: iso(now()),
    }
    db.requests.push(r)
    return withCancel(db, r)
  }),

  myInvestments: () => tx((db) => {
    const u = me(db)
    return db.requests.filter((r) => r.userId === u.id && r.kind === 'investment')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .flatMap((r) => {
        const request = withCancel(db, r)
        return request.candidates.map((candidate) => {
          const auction = db.auctions.find((a) => a.id === candidate.auctionId)
          const inv = auction ? db.invoices.find((i) => i.auctionId === auction.id) : undefined
          return { request, candidate, auction, share: inv?.ownerShare, sharePaid: inv?.ownerSharePaid, keptByOwner: !!auction?.settled && auction.winnerId === r.userId }
        })
      })
  }),

  payDeposit: (requestId, method: PayMethod) => tx((db) => {
    const u = writer(db)
    const r = db.requests.find((x) => x.id === requestId && x.userId === u.id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status !== 'pending_payment') throw new ApiError('تم سداد ضمان هذا الطلب')
    // re-check: a name may have been taken since the request was drafted
    const checks = checkNamesIn(db, r.candidates.map((c) => c.name), r.id)
    const taken = checks.filter((c) => c.verdict === 'exact')
    if (taken.length) throw new ApiError(`أصبح الاسم «${taken[0].name}» محجوزًا، ألغِ الطلب وأنشئ طلبًا جديدًا`)
    if (method === 'wallet' && (r.kind === 'investment' || r.kind === 'compound')) throw new ApiError(CARD_ONLY)
    if (method === 'wallet') {
      if (balanceOf(db, u.id) < r.depositAmount) throw new ApiError('رصيد المحفظة لا يكفي، اشحن المحفظة أو ادفع بالبطاقة')
    } else {
      // card: demo simulates a successful Moyasar payment that tops up then debits
      db.txs.push({ id: uid(db, 't'), userId: u.id, amount: r.depositAmount, kind: 'topup', note: `دفع بالبطاقة للطلب ${r.number}`, createdAt: iso(now()) })
    }
    const fee = r.kind === 'investment' || r.kind === 'compound'
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: -r.depositAmount, kind: fee ? 'service_fee' : 'deposit', note: r.kind === 'compound' ? `رسوم تسجيل الاسم المركب ${r.number}` : fee ? `رسوم دراسة طلب استثمار الاسم ${r.number}` : `ضمان مزاد الطلب ${r.number}`, createdAt: iso(now()) })
    if (r.kind !== 'compound') r.candidates.forEach((c, i) => { c.similar = checks[i].hits })
    Object.assign(r, { status: 'under_review', depositPaid: true, depositState: fee ? 'fee' : 'held', submittedAt: iso(now()) })
    return r
  }),

  cancelMyRequest: (requestId, reason) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === requestId && x.userId === u.id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status === 'cancelled') throw new ApiError('الطلب ملغى مسبقًا')
    if (!cancellable(db, r)) throw new ApiError(r.status === 'accepted' ? 'بدأ مزاد أحد أسماء هذا الطلب، فلا يمكن إلغاؤه الآن' : 'لا يمكن إلغاء هذا الطلب')
    // remove auctions that were scheduled but have not started
    const ids = new Set(r.candidates.map((c) => c.auctionId).filter(Boolean))
    db.auctions = db.auctions.filter((a) => !ids.has(a.id))
    r.candidates.forEach((c) => { c.auctionId = undefined })
    const held = r.depositState === 'held' ? r.depositAmount : 0
    Object.assign(r, { status: 'cancelled', cancelledAt: iso(now()), cancelledBy: 'owner', cancelReason: reason?.trim().slice(0, 300) || undefined })
    refundDeposit(db, r, 'ألغاه المالك')
    return { refunded: held }
  }),

  withdrawName: (requestId, candidateId) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === requestId && x.userId === u.id)
    const c = r?.candidates.find((x) => x.id === candidateId)
    if (!r || !c) throw new ApiError('الاسم غير موجود')
    if (!withdrawable(db, r, c)) throw new ApiError(c.status === 'withdrawn' ? 'سُحب هذا الاسم مسبقًا' : c.auctionId ? 'بدأ مزاد هذا الاسم، فلا يمكن سحبه' : 'لا يمكن سحب هذا الاسم')
    if (c.auctionId) { db.auctions = db.auctions.filter((a) => a.id !== c.auctionId); c.auctionId = undefined }
    Object.assign(c, { status: 'withdrawn', withdrawnAt: iso(now()) })
    const remaining = r.candidates.filter((x) => x.status === 'pending' || x.status === 'accepted')
    if (remaining.length) return { refunded: 0, requestCancelled: false }
    // nothing left in the request
    const held = r.depositState === 'held' ? r.depositAmount : 0
    const hadAuctions = db.auctions.some((a) => a.requestId === r.id)
    if (!hadAuctions) {
      Object.assign(r, { status: 'cancelled', cancelledAt: iso(now()), cancelledBy: 'owner', cancelReason: 'سحب المالك كل الأسماء' })
      refundDeposit(db, r, 'سحب المالك كل الأسماء')
      return { refunded: held, requestCancelled: true }
    }
    // some names already went to auction: refund only if all of them are settled and none was won by the owner
    if (db.auctions.filter((a) => a.requestId === r.id).every((a) => a.settled)) refundDeposit(db, r, 'لم يُرسَ عليك أي اسم')
    return { refunded: r.depositState === 'refunded' ? held : 0, requestCancelled: false }
  }),

  myWallet: () => tx((db) => {
    const u = me(db)
    return { balance: balanceOf(db, u.id), txs: db.txs.filter((t) => t.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) }
  }),

  topUp: (amount) => tx((db) => {
    const u = writer(db)
    if (!(amount >= 10)) throw new ApiError('أقل مبلغ للشحن 10 ⃁')
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount, kind: 'topup', note: 'شحن المحفظة بالبطاقة', createdAt: iso(now()) })
    return { balance: balanceOf(db, u.id), txs: db.txs.filter((t) => t.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) }
  }),

  myInvoices: () => tx((db) => {
    const u = me(db)
    return db.invoices.filter((i) => i.userId === u.id).sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
  }),

  payInvoice: (id, method) => tx((db) => {
    const u = writer(db)
    const inv = db.invoices.find((i) => i.id === id && (i.userId === u.id || u.role !== 'owner'))
    if (!inv) throw new ApiError('الفاتورة غير موجودة')
    if (inv.status === 'paid') return inv
    if (inv.status === 'cancelled') throw new ApiError('أُلغيت هذه الفاتورة لانتهاء مهلة السداد')
    if (method === 'wallet') throw new ApiError(CARD_ONLY)
    db.txs.push({ id: uid(db, 't'), userId: inv.userId, amount: inv.amountDue, kind: 'topup', note: `دفع بالبطاقة للفاتورة ${inv.number}`, createdAt: iso(now()) })
    db.txs.push({ id: uid(db, 't'), userId: inv.userId, amount: -inv.amountDue, kind: 'invoice_payment', note: `سداد الفاتورة ${inv.number} — ${inv.name}`, createdAt: iso(now()) })
    inv.status = 'paid'
    inv.paidAt = iso(now())
    payOwnerShare(db, inv)
    releaseWinnerGuarantee(db, inv)
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
      .map((r) => ({ ...r, logoStatus: db.logos?.find((l) => l.reservedId === r.id)?.status }))
  }),

  // ───── «نقل ملكية اسم» ─────
  myTransfers: () => tx((db) => {
    const u = me(db)
    const all = (db.transfers ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { outgoing: all.filter((t) => t.fromId === u.id), incoming: all.filter((t) => t.toId === u.id && t.status !== 'pending_payment'), fee: readSettings().transferFee ?? 0 }
  }),
  findRecipient: (phone) => tx((db) => {
    const u = transferOwner(db)
    return { maskedName: maskName(recipientOf(db, phone, u.id).fullName) }
  }),
  createTransfer: ({ reservedId, phone, reason, note }) => tx((db) => {
    const u = transferOwner(db)
    ensureWritable(u.role)
    ensureOpen('transfer')
    if (!['sale', 'gift', 'inheritance', 'other'].includes(reason)) throw new ApiError('اختر سبب النقل')
    const n = (note ?? '').trim()
    if (n.length > 500) throw new ApiError('الملاحظة طويلة (500 حرف كحد أقصى)')
    if (reason === 'other' && !n) throw new ApiError('اكتب سبب النقل')
    const to = recipientOf(db, phone, u.id)
    const r = db.reserved.find((x) => x.id === reservedId && x.ownerId === u.id)
    if (!r) throw new ApiError('الاسم غير مسجل باسمك')
    nameFree(db, r, u.id)
    if ((db.transfers ?? []).some((t) => t.reservedId === r.id && ['pending_payment', 'awaiting_recipient', 'under_review'].includes(t.status))) throw new ApiError('للاسم طلب نقل ملكية قائم')
    const fee = readSettings().transferFee ?? 0
    db.transferSeq = (db.transferSeq ?? 1000) + 1
    const t: NameTransfer = {
      id: uid(db, 'nt'), number: `NT-${db.transferSeq}`, reservedId: r.id, name: r.name, type: r.type, fromId: u.id, fromName: u.fullName, toId: to.id, toName: to.fullName,
      reason, note: n || undefined, fee, status: 'pending_payment', createdAt: iso(now()),
    }
    ;(db.transfers ??= []).push(t)
    if (fee <= 0) sendTransfer(db, t)
    return t
  }),
  payTransferFee: (id) => tx((db) => {
    const u = transferOwner(db)
    const t = db.transfers?.find((x) => x.id === id && x.fromId === u.id)
    if (!t) throw new ApiError('طلب النقل غير موجود')
    if (t.status !== 'pending_payment') return t
    // the demo simulates the card: in through the wallet and straight out
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: t.fee, kind: 'topup', note: `دفع بالبطاقة لرسوم ${t.number}`, createdAt: iso(now()) })
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: -t.fee, kind: 'service_fee', note: `رسوم نقل ملكية «${t.name}» (${t.number})`, createdAt: iso(now()) })
    t.feePaidAt = iso(now())
    sendTransfer(db, t)
    return t
  }),
  cancelTransfer: (id) => tx((db) => {
    const u = transferOwner(db)
    const t = db.transfers?.find((x) => x.id === id && x.fromId === u.id)
    if (!t) throw new ApiError('طلب النقل غير موجود')
    if (!['pending_payment', 'awaiting_recipient', 'under_review'].includes(t.status)) throw new ApiError('لا يمكن إلغاء هذا الطلب')
    const told = !!t.feePaidAt || t.fee <= 0
    Object.assign(t, { status: 'cancelled', cancelledAt: iso(now()) })
    refundTransferFee(db, t, 'ألغاه المالك')
    if (told) notify(db, t.toId, 'transfer', `أُلغي طلب نقل ملكية «${t.name}»`, `ألغى ${t.fromName} طلب نقل الاسم إليك.`, '/dashboard/transfers')
    return t
  }),
  respondTransfer: (id, accept) => tx((db) => {
    const u = transferOwner(db)
    const t = db.transfers?.find((x) => x.id === id && x.toId === u.id)
    if (!t) throw new ApiError('طلب النقل غير موجود')
    if (t.status !== 'awaiting_recipient') throw new ApiError('تم الرد على هذا الطلب')
    t.respondedAt = iso(now())
    if (accept) {
      t.status = 'under_review'
      notify(db, t.fromId, 'transfer', `وافق ${t.toName} على نقل «${t.name}»`, 'الطلب الآن لدى لجنة الاعتماد للمراجعة.', '/dashboard/transfers')
    } else {
      t.status = 'declined'
      refundTransferFee(db, t, 'رفضه المستلم')
      notify(db, t.fromId, 'transfer', `رفض ${t.toName} نقل «${t.name}»`, t.fee > 0 ? 'أُعيدت رسوم النقل إلى محفظتك، ويمكنك استردادها إلى حسابك البنكي.' : 'بقي الاسم مسجلًا باسمك.', '/dashboard/transfers')
    }
    return t
  }),
  adminTransfers: (status = 'all') => tx((db) => {
    need(db, 'names.transfer')
    const phone = (id: string) => db.users.find((x) => x.id === id)?.phone
    return (db.transfers ?? []).filter((t) => status === 'all' || t.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({ ...t, fromPhone: phone(t.fromId), toPhone: phone(t.toId) }))
  }),
  reviewTransfer: (id, approve, note) => tx((db) => {
    const s = need(db, 'names.transfer')
    const n = (note ?? '').trim()
    if (!approve && !n) throw new ApiError('اكتب سبب الرفض')
    const t = db.transfers?.find((x) => x.id === id)
    if (!t) throw new ApiError('طلب النقل غير موجود')
    if (t.status !== 'under_review') throw new ApiError(t.status === 'awaiting_recipient' ? 'الطلب بانتظار موافقة المستلم' : 'تمت مراجعة هذا الطلب')
    Object.assign(t, { reviewedAt: iso(now()), reviewerName: s.fullName, reviewNote: n || undefined })
    if (approve) {
      const r = db.reserved.find((x) => x.id === t.reservedId)
      if (!r || r.ownerId !== t.fromId) throw new ApiError('الاسم لم يعد مسجلًا باسم المالك')
      nameFree(db, r, t.fromId)
      const to = db.users.find((x) => x.id === t.toId)
      if (!to || to.active === false) throw new ApiError('حساب المستلم غير مفعّل')
      Object.assign(r, { ownerId: to.id, ownerName: to.fullName, source: 'transfer', acquiredAt: iso(now()), logo: undefined, listingId: undefined })
      db.logos = (db.logos ?? []).filter((l) => l.reservedId !== r.id)
      Object.assign(t, { status: 'completed', completedAt: iso(now()) })
      notify(db, t.toId, 'transfer', `أصبح «${t.name}» مسجلًا باسمك`, 'اعتمدت لجنة الاعتماد نقل الملكية، ويمكنك إصدار شهادة تسجيل الاسم الآن.', '/dashboard/names')
      notify(db, t.fromId, 'transfer', `تم نقل ملكية «${t.name}»`, `أصبح الاسم مسجلًا باسم ${t.toName}، وأي شهادة سابقة تشمله لم تعد سارية له.`, '/dashboard/transfers')
    } else {
      t.status = 'rejected'
      refundTransferFee(db, t, 'رفضته لجنة الاعتماد')
      notify(db, t.fromId, 'transfer', `رُفض طلب نقل ملكية «${t.name}»`, `السبب: ${n}` + (t.fee > 0 && t.feePaidAt ? ' — أُعيدت رسوم النقل إلى محفظتك.' : ''), '/dashboard/transfers')
      notify(db, t.toId, 'transfer', `رُفض طلب نقل ملكية «${t.name}»`, `السبب: ${n}`, '/dashboard/transfers')
    }
    return t
  }),

  // ───── mark logos ─────
  uploadLogo: (reservedId, fileName, base64) => tx((db) => {
    const u = transferOwner(db, 'لوجو الشعار لصاحب الحساب فقط')
    ensureWritable(u.role)
    const type = sniffImage(base64)
    if (!base64) throw new ApiError('اختر صورة اللوجو')
    if (base64.length * 0.75 > 2 * 1024 * 1024) throw new ApiError('حجم الصورة أكبر من 2 ميجابايت')
    if (!type) throw new ApiError('اللوجو بصيغة PNG أو JPG أو WebP')
    const r = db.reserved.find((x) => x.id === reservedId && x.ownerId === u.id)
    if (!r) throw new ApiError('الاسم غير مسجل باسمك')
    db.logos = (db.logos ?? []).filter((l) => l.reservedId !== r.id)
    db.logos.push({ id: uid(db, 'lg'), reservedId: r.id, name: r.name, type: r.type, ownerId: u.id, ownerName: u.fullName, fileName: fileName.slice(0, 120), status: 'pending', uploadedAt: iso(now()), dataUrl: `data:${type};base64,${base64}` })
    r.logo = undefined
    return { ...r, logoStatus: 'pending' as const }
  }),
  deleteLogo: (reservedId) => tx((db) => {
    const u = transferOwner(db, 'لوجو الشعار لصاحب الحساب فقط')
    const r = db.reserved.find((x) => x.id === reservedId && x.ownerId === u.id)
    if (!r) throw new ApiError('الاسم غير مسجل باسمك')
    db.logos = (db.logos ?? []).filter((l) => l.reservedId !== r.id)
    r.logo = undefined
    return r
  }),
  logoSrc: (r) => r.logo,
  myLogo: (reservedId) => tx((db) => { const u = me(db); return db.logos?.find((l) => l.reservedId === reservedId && l.ownerId === u.id)?.dataUrl ?? null }),
  adminLogos: (status = 'all') => tx((db) => {
    need(db, 'names.logos')
    return (db.logos ?? []).filter((l) => status === 'all' || l.status === status).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map(({ dataUrl: _d, ...l }) => l)
  }),
  adminLogoImage: (id) => tx((db) => { need(db, 'names.logos'); return db.logos?.find((l) => l.id === id)?.dataUrl ?? null }),
  reviewLogo: (id, approve, reason) => tx((db) => {
    const s = need(db, 'names.logos')
    const why = (reason ?? '').trim().slice(0, 300)
    if (!approve && !why) throw new ApiError('اكتب سبب الرفض، يصل للمالك')
    const l = db.logos?.find((x) => x.id === id)
    if (!l) throw new ApiError('اللوجو غير موجود')
    const r = db.reserved.find((x) => x.id === l.reservedId)
    if (!r || r.ownerId !== l.ownerId) throw new ApiError('لم يعد الاسم مملوكًا لصاحب اللوجو')
    Object.assign(l, { status: approve ? 'approved' : 'rejected', rejectReason: approve ? undefined : why, reviewedAt: iso(now()), reviewedBy: s.fullName })
    r.logo = approve ? l.dataUrl : undefined
    notify(db, l.ownerId, 'reviewed', approve ? `اعتُمد لوجو «${l.name}»` : `لم يُعتمد لوجو «${l.name}»`, approve ? 'يظهر اللوجو الآن مع الاسم في سجل الأسماء.' : `السبب: ${why}. يمكنك رفع لوجو آخر.`, '/dashboard/names')
    const { dataUrl: _d, ...row } = l
    return row
  }),

  createListing: (reservedId, mode, price) => tx((db) => {
    const u = writer(db)
    ensureOpen(mode === 'auction' ? 'resale' : 'instant')
    const r = db.reserved.find((x) => x.id === reservedId && x.ownerId === u.id)
    if (!r) throw new ApiError('الاسم غير مسجل باسمك')
    if (r.listingId && db.listings?.some((l) => l.id === r.listingId && (l.status === 'live' || l.status === 'scheduled'))) throw new ApiError('الاسم معروض للبيع حاليًا')
    if (db.invoices.some((i) => i.status === 'unpaid' && i.userId === u.id && i.name === r.name)) throw new ApiError('سدّد فاتورة الاسم أولًا قبل عرضه للبيع')
    if (db.auctions.some((a) => !a.settled && a.name === r.name)) throw new ApiError('للاسم مزاد قائم حاليًا')
    const p = Math.floor(Number(price))
    if (!Number.isFinite(p) || p < RULES.openingPrice) throw new ApiError(`أقل قيمة ${RULES.openingPrice} ⃁`)
    if (p > 10_000_000) throw new ApiError('القيمة كبيرة جدًا')
    const t = now()
    const auction = mode === 'auction'
    const startsAt = auction ? t + RULES.resaleNoticeHours * H : t
    const endsAt = auction ? startsAt + RULES.resaleAuctionDays * D : t + RULES.instantSaleHours * H
    db.listings ??= []
    const l: NameListing = {
      id: uid(db, 'l'), number: `SL-${1001 + db.listings.length}`, reservedId: r.id, name: r.name, type: r.type, sellerId: u.id, mode, price: p,
      commissionRate: auction ? RULES.resaleCommission : RULES.instantCommission, status: auction ? 'scheduled' : 'live',
      createdAt: iso(t), startsAt: iso(startsAt), endsAt: iso(endsAt),
    }
    if (auction) {
      const a: Auction = { id: uid(db, 'a'), requestId: l.id, candidateId: l.id, name: l.name, type: l.type, requesterId: u.id, openingPrice: p, minIncrement: RULES.minIncrement,
        startsAt: l.startsAt, endsAt: l.endsAt, currentPrice: p, bidCount: 0, settled: false, listingId: l.id, bidDeposit: RULES.resaleBidDeposit }
      db.auctions.push(a); l.auctionId = a.id
    }
    db.listings.push(l)
    r.listingId = l.id
    // announced to every registered user (sent on by SMS through the notification webhook)
    for (const x of db.users) if (x.id !== u.id && x.role === 'owner' && x.active !== false) {
      notify(db, x.id, 'auction_opened', auction ? `مزاد إعادة بيع: «${l.name}»` : `اسم معروض للبيع الفوري: «${l.name}»`,
        auction ? `يبدأ بعد ${RULES.resaleNoticeHours} ساعة بسعر افتتاحي ${p} ⃁، ويستمر ${RULES.resaleAuctionDays} أيام.` : `بسعر ${p} ⃁، متاح للشراء ${RULES.instantSaleHours} ساعة.`,
        auction ? `/auctions/${l.auctionId}` : '/market')
    }
    return listingOut(db, l)
  }),

  cancelListing: (id) => tx((db) => {
    const u = me(db)
    const l = db.listings?.find((x) => x.id === id && x.sellerId === u.id)
    if (!l) throw new ApiError('العرض غير موجود')
    if (l.mode === 'auction') {
      const a = db.auctions.find((x) => x.id === l.auctionId)
      if (l.status !== 'scheduled' || !a || phaseOf(a) !== 'scheduled') throw new ApiError('بدأ المزاد، فلا يمكن إلغاء العرض')
      db.auctions = db.auctions.filter((x) => x.id !== a.id)
    } else if (l.status !== 'live') throw new ApiError('العرض منتهٍ')
    l.status = 'cancelled'
    const r = db.reserved.find((x) => x.id === l.reservedId); if (r) r.listingId = undefined
    return listingOut(db, l)
  }),

  myListings: () => tx((db) => {
    const u = me(db)
    return (db.listings ?? []).filter((l) => l.sellerId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((l) => listingOut(db, l))
  }),

  marketListings: () => tx((db) => {
    const t = now()
    // on sale now, plus the ones that closed in the last 3 days (shown locked)
    return (db.listings ?? []).filter((l) => l.mode === 'instant' && (l.status === 'live' || ((l.status === 'sold' || l.status === 'expired') && t - Date.parse(l.soldAt ?? l.endsAt) < 3 * D)))
      .sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1) || Date.parse(a.endsAt) - Date.parse(b.endsAt))
      .map((l) => ({ ...listingOut(db, l), sellerId: '' }))
  }),

  buyListing: (id, method) => tx((db) => {
    const u = writer(db)
    const l = db.listings?.find((x) => x.id === id)
    if (!l || l.mode !== 'instant') throw new ApiError('العرض غير موجود')
    if (l.status !== 'live' || now() >= Date.parse(l.endsAt)) throw new ApiError('انتهى عرض هذا الاسم')
    if (l.sellerId === u.id) throw new ApiError('لا يمكنك شراء اسم تبيعه')
    if (method === 'wallet') throw new ApiError(CARD_ONLY)
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: l.price, kind: 'topup', note: `دفع بالبطاقة لشراء «${l.name}»`, createdAt: iso(now()) })
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: -l.price, kind: 'purchase', note: `شراء فوري للاسم «${l.name}» (${l.number})`, createdAt: iso(now()) })
    const inv = sellerInvoice(db, l, u, l.price, 0)
    inv.status = 'paid'; inv.paidAt = iso(now())
    transferName(db, l, u, l.price)
    Object.assign(l, { status: 'sold', soldPrice: l.price, soldAt: iso(now()) })
    payOwnerShare(db, inv)
    notify(db, u.id, 'won', `مبارك، أصبح «${l.name}» باسمك`, `اشتريته بـ ${l.price} ⃁. فاتورتك وشهادة التسجيل في «أسمائي».`, '/dashboard/names')
    notify(db, l.sellerId, 'won', `بيع اسمك «${l.name}»`, `بـ ${l.price} ⃁، وأُضيف ${inv.ownerShare} ⃁ إلى محفظتك بعد عمولة ${pct(l.commissionRate)}%.`, '/dashboard/sell')
    return listingOut(db, l)
  }),

  payBidDeposit: (auctionId, method) => tx((db) => {
    const u = writer(db)
    const a = db.auctions.find((x) => x.id === auctionId)
    if (!a) throw new ApiError('المزاد غير موجود')
    if (!a.listingId && !((a.bidDeposit ?? 0) > 0)) throw new ApiError('هذا المزاد لا يحتاج ضمان دخول')
    if (a.settled || phaseOf(a) === 'ended') throw new ApiError('انتهى المزاد')
    if (a.listingId && a.requesterId === u.id) throw new ApiError('لا يمكنك المزايدة على اسم تبيعه')
    if (!a.listingId && a.requesterId === u.id) throw new ApiError('ضمان طلبك يغطي دخولك هذا المزاد')
    if (hasBidDeposit(db, a.id, u.id)) return view(db, a)
    const amount = a.bidDeposit ?? RULES.resaleBidDeposit
    if (method === 'wallet' && balanceOf(db, u.id) < amount) throw new ApiError('رصيد المحفظة لا يكفي، اشحن المحفظة أو ادفع بالبطاقة')
    if (method !== 'wallet') db.txs.push({ id: uid(db, 't'), userId: u.id, amount, kind: 'topup', note: `دفع بالبطاقة لضمان مزاد «${a.name}»`, createdAt: iso(now()) })
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: -amount, kind: 'bid_deposit', note: `ضمان دخول مزاد «${a.name}»`, createdAt: iso(now()) })
    ;(db.bidDeposits ??= []).push({ auctionId: a.id, userId: u.id, amount, state: 'held', createdAt: iso(now()) })
    return view(db, a)
  }),

  placeBid: (auctionId, amount) => tx((db) => {
    const u = writer(db)
    const a = db.auctions.find((x) => x.id === auctionId)
    if (!a) throw new ApiError('المزاد غير موجود')
    const phase = phaseOf(a)
    if (phase === 'scheduled') throw new ApiError('المزاد لم يبدأ بعد')
    if (a.cancelled) throw new ApiError('أُلغي هذا المزاد')
    if (a.paused) throw new ApiError('المزاد متوقف مؤقتًا، تابع الصفحة لمعرفة موعد الاستئناف')
    if (phase === 'ended') throw new ApiError('انتهى المزاد')
    const min = a.currentPrice + a.minIncrement
    if (!Number.isFinite(amount) || amount < min) throw new ApiError(`أقل مزايدة ${min} ⃁`)
    if (a.leaderId === u.id) throw new ApiError('أنت صاحب أعلى مزايدة حاليًا')
    if (isInvestment(db, a) && a.requesterId === u.id) throw new ApiError('لا يمكنك المزايدة على اسم قدّمته في «استثمار الاسم»')
    resaleGuard(db, a, u.id)
    recordBid(db, a, u.id, amount)
    resolveAuto(db, a)
    return view(db, a)
  }),

  setAutoBid: (auctionId, max) => tx((db) => {
    const u = writer(db)
    const a = db.auctions.find((x) => x.id === auctionId)
    if (!a) throw new ApiError('المزاد غير موجود')
    if (phaseOf(a) === 'ended') throw new ApiError('انتهى المزاد')
    if (a.paused) throw new ApiError('المزاد متوقف مؤقتًا، تابع الصفحة لمعرفة موعد الاستئناف')
    if (isInvestment(db, a) && a.requesterId === u.id) throw new ApiError('لا يمكنك المزايدة على اسم قدّمته في «استثمار الاسم»')
    resaleGuard(db, a, u.id)
    const floor = a.leaderId === u.id ? a.currentPrice + a.minIncrement : a.currentPrice + a.minIncrement
    if (!Number.isFinite(max) || max < floor) throw new ApiError(`الحد الأقصى ${floor} ⃁ على الأقل`)
    if (max > 1_000_000) throw new ApiError('الحد الأقصى كبير جدًا')
    db.autobids = (db.autobids ?? []).filter((x) => !(x.auctionId === a.id && x.userId === u.id))
    db.autobids.push({ auctionId: a.id, userId: u.id, max: Math.floor(max), createdAt: iso(now()) })
    if (!db.watches?.some((w) => w.auctionId === a.id && w.userId === u.id)) (db.watches ??= []).push({ auctionId: a.id, userId: u.id })
    resolveAuto(db, a)
    return view(db, a)
  }),

  cancelAutoBid: (auctionId) => tx((db) => {
    const u = me(db)
    const a = db.auctions.find((x) => x.id === auctionId)
    if (!a) throw new ApiError('المزاد غير موجود')
    db.autobids = (db.autobids ?? []).filter((x) => !(x.auctionId === a.id && x.userId === u.id))
    return view(db, a)
  }),

  toggleWatch: (auctionId) => tx((db) => {
    const u = me(db)
    if (!db.auctions.some((x) => x.id === auctionId)) throw new ApiError('المزاد غير موجود')
    const list = (db.watches ??= [])
    const i = list.findIndex((w) => w.auctionId === auctionId && w.userId === u.id)
    if (i >= 0) { list.splice(i, 1); return false }
    list.push({ auctionId, userId: u.id })
    return true
  }),

  myWatchlist: () => tx((db) => {
    const u = me(db)
    const ids = new Set((db.watches ?? []).filter((w) => w.userId === u.id).map((w) => w.auctionId))
    return db.auctions.filter((a) => ids.has(a.id)).sort((x, y) => Date.parse(x.endsAt) - Date.parse(y.endsAt))
  }),


  overview: () => tx((db) => {
    need(db, 'overview.view')
    return {
      underReview: db.requests.filter((r) => r.status === 'under_review').length,
      awaitingSchedule: db.requests.filter((r) => r.kind !== 'compound' && r.status === 'accepted').flatMap((r) => r.candidates).filter((c) => c.status === 'accepted' && !c.auctionId).length,
      live: db.auctions.filter((a) => phaseOf(a) === 'live').length,
      scheduled: db.auctions.filter((a) => phaseOf(a) === 'scheduled').length,
      unpaidInvoices: db.invoices.filter((i) => i.status === 'unpaid').length,
      revenue: round2(db.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)),
      openTickets: db.tickets.filter((k) => k.status === 'new' || k.status === 'in_progress').length,
    }
  }),

  listRequests: (status = 'all') => tx((db) => {
    need(db, 'requests.view')
    return db.requests.filter((r) => (status === 'all' ? r.status !== 'pending_payment' : r.status === status))
      .sort((a, b) => Date.parse(b.submittedAt || b.createdAt) - Date.parse(a.submittedAt || a.createdAt))
  }),

  getRequest: (id) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r || (u.role === 'owner' && r.userId !== u.id)) throw new ApiError('الطلب غير موجود')
    if (u.role !== 'owner' && r.status === 'under_review') r.candidates.forEach((c) => { c.similar = similarFor(db, c.normalized, r.id) })
    return withCancel(db, r)
  }),

  reviewRequest: (id, decisions, note) => tx((db) => {
    const u = need(db, 'requests.review')
    const r = db.requests.find((x) => x.id === id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status !== 'under_review') throw new ApiError('تمت مراجعة هذا الطلب')
    // policy: a logo request has one name accepted at most
    if ((r.kind ?? 'standard') === 'standard') {
      const ok = new Set(decisions.filter((d) => d.status === 'accepted' && r.candidates.some((c) => c.id === d.candidateId && c.status !== 'withdrawn')).map((d) => d.candidateId))
      if (ok.size > 1) throw new ApiError('يُقبل شعار واحد فقط في الطلب الواحد؛ اختر اسمًا واحدًا وارفض البقية')
    }
    for (const d of decisions) {
      const c = r.candidates.find((x) => x.id === d.candidateId)
      if (!c || c.status === 'withdrawn') continue
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
    const acc = r.candidates.filter((c) => c.status === 'accepted').map((c) => c.name)
    if (r.kind === 'investment') {
      const rej = r.candidates.filter((c) => c.status === 'rejected')
      if (anyAccepted) notify(db, r.userId, 'reviewed', `قُبل ${acc.length > 1 ? 'اسماك' : 'اسمك'} «${acc.join('»، «')}» في «استثمار الاسم»`,
        `سيُطرح في مزاد عام قريبًا، ولك ${Math.round(RULES.investOwnerShare * 100)}% من قيمة بيعه.${rej.length ? ` ولم يُقبل: ${rej.map((c) => c.name).join('، ')}.` : ''}`, '/dashboard/invest')
      // the rejection notice also goes out by SMS through the notification webhook
      else notify(db, r.userId, 'reviewed', 'لم تُقبل الأسماء المقدّمة في «استثمار الاسم»', `${rej[0]?.rejectReason || 'وفق معايير اللجنة'}. رسوم الدراسة غير مستردة.`, '/dashboard/invest')
      return r
    }
    if (r.kind === 'compound') {
      if (anyAccepted) {
        const c = r.candidates[0]
        db.reserved.push({ id: uid(db, 'r'), name: c.name, normalized: c.normalized, type: r.type, ownerId: r.userId, ownerName: r.ownerName, price: 0, acquiredAt: iso(now()), source: 'compound', baseName: r.baseName })
      }
    notify(db, r.userId, 'reviewed', anyAccepted ? `اعتُمد الاسم المركب «${acc[0]}»` : `لم يُعتمد الاسم المركب لـ«${r.baseName}»`,
        anyAccepted ? 'سُجّل باسمك مباشرة دون مزاد، وشهادته في «أسمائي».' : (r.candidates[0].rejectReason || 'راجع ملاحظة اللجنة في الطلب.'), anyAccepted ? '/dashboard/names' : `/dashboard/requests/${r.id}`)
      return r
    }
    notify(db, r.userId, 'reviewed', anyAccepted ? `قُبل طلبك ${r.number}` : `لم يُقبل طلبك ${r.number}`,
      anyAccepted ? `الأسماء المقبولة: ${acc.join('، ')}. سيُحدَّد موعد المزاد قريبًا.` : 'أُعيد ضمان المزاد إلى محفظتك.', `/dashboard/requests/${r.id}`)
    if (!anyAccepted) refundDeposit(db, r, 'مرفوض')
    return r
  }),

  rejectRequest: (id, reason) => tx((db) => {
    const u = need(db, 'requests.review')
    const r = db.requests.find((x) => x.id === id)
    if (!r || r.status !== 'under_review') throw new ApiError('لا يمكن رفض هذا الطلب')
    r.candidates.forEach((c) => { if (c.status !== 'withdrawn') { c.status = 'rejected'; c.rejectReason = reason } })
    Object.assign(r, { status: 'rejected', reviewedAt: iso(now()), reviewerName: u.fullName, reviewNote: reason })
    if (r.kind === 'investment') notify(db, r.userId, 'reviewed', 'لم يُقبل الاسم المقدّم في «استثمار الاسم»', `${reason || 'وفق معايير اللجنة'}. رسوم الدراسة غير مستردة.`, '/dashboard/invest')
    else notify(db, r.userId, 'reviewed', `لم يُقبل طلبك ${r.number}`, reason, `/dashboard/requests/${r.id}`)
    refundDeposit(db, r, 'مرفوض')
    return r
  }),

  cancelRequest: (id, reason) => tx((db) => {
    const u = need(db, 'requests.cancel')
    const r = db.requests.find((x) => x.id === id)
    if (!r || !['under_review', 'accepted'].includes(r.status)) throw new ApiError('لا يمكن إلغاء هذا الطلب')
    if (r.candidates.some((c) => c.auctionId)) throw new ApiError('لا يمكن إلغاء طلب فُتح له مزاد')
    Object.assign(r, { status: 'cancelled', reviewedAt: iso(now()), reviewerName: u.fullName, reviewNote: reason })
    refundDeposit(db, r, 'ألغته اللجنة')
    return r
  }),

  awaitingSchedule: () => tx((db) => {
    need(db, 'auctions.schedule')
    return db.requests.filter((r) => r.status === 'accepted' && r.kind !== 'compound')
      .flatMap((r) => r.candidates.filter((c) => c.status === 'accepted' && !c.auctionId).map((c) => ({ ...c, request: r })))
  }),

  scheduleAuctions: (candidateIds, startsAt, endsAt, stagger = 0) => tx((db) => {
    need(db, 'auctions.schedule')
    const s = Date.parse(startsAt), e = Date.parse(endsAt)
    if (!s || !e) throw new ApiError('حدد موعد البداية والنهاية')
    if (e <= s) throw new ApiError('موعد النهاية يجب أن يكون بعد البداية')
    if (e <= now()) throw new ApiError('موعد النهاية في الماضي')
    if (!candidateIds.length) throw new ApiError('اختر اسمًا واحدًا على الأقل')
    if (!(stagger >= 0 && stagger <= 1440)) throw new ApiError('الفاصل بين الشعارات من 0 إلى 1440 دقيقة')
    const out: Auction[] = []
    const base = { s, e }
    for (const cid of candidateIds) {
      const r = db.requests.find((x) => x.candidates.some((c) => c.id === cid))
      const c = r?.candidates.find((x) => x.id === cid)
      if (!r || !c || c.status !== 'accepted' || c.auctionId) continue
      const s = base.s + out.length * stagger * 60_000, e = base.e + out.length * stagger * 60_000
      const a: Auction = {
        id: uid(db, 'a'), requestId: r.id, candidateId: c.id, name: c.name, type: r.type, requesterId: r.userId,
        openingPrice: RULES.openingPrice, minIncrement: RULES.minIncrement, startsAt: iso(s), endsAt: iso(e),
        currentPrice: RULES.openingPrice, bidCount: 0, settled: false, investment: r.kind === 'investment' || undefined,
        bidDeposit: (!r.kind || r.kind === 'standard') && readSettings().depositAmount > 0 ? readSettings().depositAmount : undefined,
      }
      c.auctionId = a.id
      db.auctions.push(a)
      out.push(a)
      notify(db, r.userId, 'auction_opened', `حُدّد موعد مزاد «${c.name}»`, `يبدأ ${new Date(s).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { timeZone: RULES.timeZone, dateStyle: 'medium', timeStyle: 'short' })}.`, `/auctions/${a.id}`)
    }
    return out
  }),

  allInvoices: () => tx((db) => {
    need(db, 'invoices.view')
    return [...db.invoices].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
  }),

  markInvoicePaid: (id) => tx((db) => {
    need(db, 'invoices.mark_paid')
    const inv = db.invoices.find((i) => i.id === id)
    if (!inv || inv.status === 'paid') throw new ApiError('الفاتورة غير موجودة أو مدفوعة')
    if (inv.status === 'cancelled') throw new ApiError('أُلغيت هذه الفاتورة لانتهاء مهلة السداد')
    inv.status = 'paid'
    inv.paidAt = iso(now())
    payOwnerShare(db, inv)
    releaseWinnerGuarantee(db, inv)
    return inv
  }),

  listUsers: () => tx((db) => {
    need(db, 'users.view')
    return [...db.users].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(publicUser)
  }),

  createStaff: (input) => tx((db) => {
    const actor = need(db, 'users.create')
    if (input.role === 'admin' && actor.role !== 'admin') throw new ApiError('إنشاء حساب مدير نظام لمدير النظام فقط')
    const phone = input.phone.replace(/\s/g, '')
    const email = input.email.trim()
    if (input.fullName.trim().length < 3) throw new ApiError('اكتب اسم الموظف')
    if (!/^05\d{8}$/.test(phone)) throw new ApiError('رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('البريد الإلكتروني غير صحيح')
    if (db.users.some((u) => u.phone === phone)) throw new ApiError('رقم الجوال مسجل لحساب آخر')
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new ApiError('البريد الإلكتروني مسجل لحساب آخر')
    if (input.password.length < 8) throw new ApiError('كلمة المرور المؤقتة 8 أحرف على الأقل')
    if (input.role !== 'committee' && input.role !== 'admin') throw new ApiError('اختر الصلاحية')
    const u: DemoUser = { id: uid(db, 'u'), fullName: input.fullName.trim(), phone, email, role: input.role, password: input.password, active: true, createdAt: iso(now()) }
    if (input.role === 'committee' && input.staffRoleId) {
      if (!rolesOf(db).some((x) => x.id === input.staffRoleId)) throw new ApiError('الدور غير موجود')
      u.staffRoleId = input.staffRoleId
    }
    db.users.push(u)
    return publicUser(u)
  }),

  setUserRole: (id, role) => tx((db) => {
    const t = targetUser(db, id, need(db, 'users.roles'))
    if (role === 'admin' && me(db).role !== 'admin') throw new ApiError('ترقية حساب إلى مدير نظام لمدير النظام فقط')
    if (!['owner', 'committee', 'admin'].includes(role)) throw new ApiError('صلاحية غير معروفة')
    t.role = role
    return publicUser(t)
  }),

  setUserActive: (id, active) => tx((db) => {
    const t = targetUser(db, id, need(db, 'users.suspend'))
    t.active = active
    if (!active && getSession() === t.id) setSession(null)
    return publicUser(t)
  }),

  saveEvent: (e) => tx((db) => {
    need(db, 'events.manage')
    if (!e.title.trim() || !e.startsOn || !e.endsOn) throw new ApiError('أكمل اسم الفعالية والتواريخ')
    if (e.endsOn < e.startsOn) throw new ApiError('تاريخ النهاية قبل البداية')
    const ev = { ...e, id: e.id || uid(db, 'ev') }
    const i = db.events.findIndex((x) => x.id === ev.id)
    if (i >= 0) db.events[i] = ev; else db.events.push(ev)
    return ev
  }),

  deleteEvent: (id) => tx((db) => {
    need(db, 'events.manage')
    db.events = db.events.filter((e) => e.id !== id)
  }),

  // ───── settings ─────
  publicSettings: async () => structuredClone(publicOf(readSettings())),
  adminSettings: () => tx((db) => {
    const u = staff(db)
    if (!permsOf(db, u).some((p) => p === 'settings.manage' || p === 'security.manage')) throw new ApiError('ليست لديك صلاحية «إعدادات المنصة»')
    return { ...readSettings(), rules: demoRules() }
  }),
  updateSettings: (patch) => tx((db) => {
    const security = ['passwordMinLength', 'maxLoginAttempts', 'lockoutMinutes', 'staffIdleMinutes'] as const
    const touchesSecurity = security.some((k) => patch[k] !== undefined)
    const touchesGeneral = Object.keys(patch).some((k) => !(security as readonly string[]).includes(k) && patch[k as keyof typeof patch] !== undefined)
    const u = touchesSecurity ? need(db, 'security.manage') : need(db, 'settings.manage')
    if (touchesSecurity && touchesGeneral) need(db, 'settings.manage')
    return { ...writeSettings(patch, u.fullName), rules: demoRules() }
  }),
  settingsHistory: () => tx((db) => { need(db, 'audit.view'); return readLog() }),
  signOutEveryone: () => tx((db) => {
    const u = need(db, 'security.manage')
    let n = 0
    for (const x of db.users) if (x.id !== u.id) { x.stamp = (x.stamp ?? 0) + 1; n++ }
    // the caller's own stamp stays as is, so this browser keeps its session
    logAction('SignOutEveryone', u.fullName, String(n))
    return n
  }),
  myPreferences: () => tx((db) => ({ ...DEFAULT_PREFS, ...me(db).prefs })),
  saveMyPreferences: (p) => tx((db) => { const u = me(db); u.prefs = { ...p }; return u.prefs }),
  mySessions: () => tx((db) => {
    me(db)
    let at = iso(now())
    try { at = sessionStorage.getItem('sammha-demo-signed-in') || at } catch { /* ignore */ }
    const ua = navigator.userAgent
    const device = `${/Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'متصفح'} · ${/iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : 'جهاز'}`
    // the demo knows only this browser; the real API lists every signed-in device
    return [{ id: 'this-device', signedInAt: at, lastActiveAt: iso(now()), expiresAt: iso(now() + 30 * D), device, current: true }]
  }),
  revokeMySession: () => tx(() => { throw new ApiError('هذا جهازك الحالي، استخدم «تسجيل الخروج»') }),
  mySecurity: () => tx((db) => ({ lastLoginAt: me(db).lastLoginAt, activeSessions: 1, passwordMinLength: readSettings().passwordMinLength })),

  // ───── owner profile completion ─────
  updateMyAddress: (i) => tx((db) => {
    const u = me(db)
    if (!i.addressCountry) throw new ApiError('اختر البلد')
    if (i.addressCity.trim().length < 2) throw new ApiError('أدخل المدينة')
    if (i.district.trim().length < 2) throw new ApiError('أدخل الحي')
    const postal = otpDigits(i.postalCode)
    if (postal.length < 3 || postal.length > 10) throw new ApiError('الرمز البريدي أرقام فقط، مثل 12345')
    let alt: string | undefined
    if (i.altPhone?.trim()) {
      alt = normalizeIntl(i.altPhoneCountry ?? '966', i.altPhone) ?? undefined
      if (!alt) throw new ApiError('رقم التواصل الآخر غير صحيح')
      if (alt === u.phone) throw new ApiError('رقم التواصل الآخر هو رقمك الأساسي نفسه')
    }
    u.p = { ...u.p, addressCountry: i.addressCountry, addressCity: i.addressCity.trim(), district: i.district.trim(), postalCode: postal, street: i.street?.trim() || undefined, altPhone: alt }
    return publicUser(u)
  }),
  updateMyPersonal: (i) => tx((db) => {
    const u = me(db)
    const part = (v: string, label: string) => { const t = v.trim().replace(/\s+/g, ' '); if (t.length < 2 || t.length > 30 || /\d/.test(t)) throw new ApiError(`اكتب ${label} بالحروف (2 إلى 30 حرفًا)`); return t }
    const first = part(i.firstName, 'الاسم الأول'), father = part(i.fatherName, 'اسم الأب'), grand = part(i.grandfatherName, 'اسم الجد'), family = part(i.familyName, 'اسم العائلة')
    if (!i.birthDate || (now() - Date.parse(i.birthDate)) / (365.25 * D) < 18) throw new ApiError('التسجيل لمن أتم 18 سنة')
    if (i.gender !== 'male' && i.gender !== 'female') throw new ApiError('اختر الجنس')
    if (!i.nationality || !i.residenceCountry || i.residenceCity.trim().length < 2) throw new ApiError('أكمل الجنسية وبلد ومدينة الإقامة')
    if (!u.nationalId) {
      const nid = (i.nationalId ?? '').trim().toUpperCase()
      const e = identityError(nid, i.nationality, i.residenceCountry)
      if (e) throw new ApiError(e)
      if (db.users.some((x) => x.nationalId === nid && x.id !== u.id)) throw new ApiError('رقم الهوية مسجل لحساب آخر')
      u.nationalId = nid
    }
    u.fullName = `${first} ${father} ${grand} ${family}`
    for (const r of db.reserved) if (r.ownerId === u.id) r.ownerName = u.fullName
    u.p = { ...u.p, firstName: first, fatherName: father, grandfatherName: grand, familyName: family, birthDate: i.birthDate, gender: i.gender, nationality: i.nationality, residenceCountry: i.residenceCountry, residenceCity: i.residenceCity.trim() }
    return publicUser(u)
  }),
  requestEmailVerification: () => tx((db) => {
    const u = me(db)
    if (u.emailVerifiedAt) throw new ApiError('بريدك موثّق مسبقًا')
    return issueOtp(u.id, 'verify_email', u.email)
  }),
  confirmEmailVerification: (challenge, code) => tx((db) => {
    const u = me(db)
    const c = consumeOtp(challenge, code, 'verify_email')
    if (c.userId !== u.id || c.phone !== u.email) throw new ApiError('تعذّر التحقق، اطلب رمزًا جديدًا')
    u.emailVerifiedAt = iso(now())
    return publicUser(u)
  }),

  // ───── staff roles ─────
  listRoles: () => tx((db) => {
    const u = staff(db)
    if (!permsOf(db, u).some((p) => p === 'roles.manage' || p === 'users.view')) throw new ApiError('ليست لديك صلاحية «الأدوار والصلاحيات»')
    return rolesOf(db).map((r) => ({ ...r, members: db.users.filter((x) => x.role === 'committee' && (x.staffRoleId ?? COMMITTEE_ROLE_ID) === r.id).length }))
  }),
  saveRole: (id, input) => tx((db) => {
    const u = need(db, 'roles.manage')
    const name = input.name.trim()
    if (name.length < 2 || name.length > 60) throw new ApiError('اكتب اسم الدور (2 إلى 60 حرفًا)')
    const perms = ALL_PERMISSIONS.filter((p) => input.permissions.includes(p))
    if (!perms.length) throw new ApiError('اختر صلاحية واحدة على الأقل')
    const mine = permsOf(db, u)
    const beyond = perms.filter((p) => !mine.includes(p))
    if (beyond.length) throw new ApiError(`لا يمكنك منح صلاحية لا تملكها: ${beyond.map(permissionLabel).join('، ')}`)
    const roles = rolesOf(db)
    if (roles.some((r) => r.name === name && r.id !== id)) throw new ApiError('يوجد دور بهذا الاسم')
    let role = id ? roles.find((r) => r.id === id) : undefined
    if (id && !role) throw new ApiError('الدور غير موجود')
    if (!role) { role = { id: uid(db, 'role'), name, permissions: [], isSystem: false, members: 0 }; roles.push(role); logAction('StaffRoleCreated', u.fullName, `${name}: ${perms.map(permissionLabel).join('، ')}`) }
    else logAction('StaffRole', u.fullName, `${name}: ${perms.map(permissionLabel).join('، ')}`)
    Object.assign(role, { name, description: input.description?.trim() || undefined, permissions: perms })
    return { ...role, members: db.users.filter((x) => x.role === 'committee' && (x.staffRoleId ?? COMMITTEE_ROLE_ID) === role!.id).length }
  }),
  deleteRole: (id) => tx((db) => {
    const u = need(db, 'roles.manage')
    const roles = rolesOf(db)
    const role = roles.find((r) => r.id === id)
    if (!role) throw new ApiError('الدور غير موجود')
    if (role.isSystem) throw new ApiError('الدور الأساسي «لجنة الاعتماد» لا يُحذف، عدّل صلاحياته بدلًا من ذلك')
    const n = db.users.filter((x) => x.staffRoleId === id).length
    if (n) throw new ApiError(`انقل الموظفين (${n}) إلى دور آخر قبل حذف هذا الدور`)
    db.roles = roles.filter((r) => r.id !== id)
    logAction('StaffRoleDeleted', u.fullName, role.name)
  }),
  setUserStaffRole: (userId, roleId) => tx((db) => {
    const u = need(db, 'users.roles')
    const t = db.users.find((x) => x.id === userId)
    if (!t) throw new ApiError('المستخدم غير موجود')
    if (t.role !== 'committee') throw new ApiError('الأدوار للموظفين فقط؛ مدير النظام يملك كل الصلاحيات')
    if (t.id === u.id) throw new ApiError('لا يمكنك تعديل صلاحيات حسابك')
    const role = rolesOf(db).find((r) => r.id === roleId)
    if (!role) throw new ApiError('الدور غير موجود')
    const mine = permsOf(db, u)
    if (role.permissions.some((p) => !mine.includes(p as Permission))) throw new ApiError('لا يمكنك إسناد دور فيه صلاحيات لا تملكها')
    t.staffRoleId = role.id
    logAction('UserStaffRole', u.fullName, `${t.fullName} ← ${role.name}`)
    return publicUser(t)
  }),
  ticketRouting: () => tx((db) => {
    const u = staff(db)
    if (!permsOf(db, u).some((p) => p === 'settings.manage' || p === 'tickets.manage')) throw new ApiError('ليست لديك صلاحية «إعدادات المنصة»')
    return routingView(db)
  }),
  saveTicketRouting: (input) => tx((db) => {
    const u = need(db, 'settings.manage')
    const emails: Record<string, string> = {}
    for (const [k, raw] of Object.entries(input.emails ?? {})) {
      const list = [...new Set((raw ?? '').split(/[,،;\s]+/).map((e) => e.trim()).filter(Boolean))]
      const bad = list.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      if (bad) throw new ApiError(`البريد غير صحيح: ${bad}`)
      emails[k] = list.join(', ')
    }
    for (const ids of Object.values(input.handlers)) for (const id of ids) {
      const x = db.users.find((y) => y.id === id)
      if (!x || !permsOf(db, x).includes('tickets.reply')) throw new ApiError('اختر موظفين لديهم صلاحية «الرد على التذاكر»')
    }
    writeRouting({ restrictToHandlers: input.restrictToHandlers, handlers: input.handlers, emails })
    logAction('TicketRouting', u.fullName, Object.entries(input.handlers).map(([k, v]) => `${k}: ${v.length}`).join(' | '))
    return routingView(db)
  }),

  // ───── auction controls ─────
  adminAuctions: (state = 'active', type = 'all') => tx((db) => {
    const u = staff(db)
    if (!permsOf(db, u).some((p) => p === 'auctions.manage' || p === 'auctions.cancel' || p === 'auctions.schedule')) throw new ApiError('ليست لديك صلاحية «التحكم في المزادات»')
    const t = now()
    return db.auctions.filter((a) => (type === 'all' ? true : a.type === type)).filter((a) => {
      const ph = phaseOf(a, t)
      switch (state) {
        case 'live': return !a.settled && !a.paused && ph === 'live'
        case 'scheduled': return !a.settled && !a.paused && ph === 'scheduled'
        case 'paused': return !!a.paused && !a.cancelled
        case 'cancelled': return !!a.cancelled
        case 'ended': return !a.cancelled && !a.paused && (a.settled || ph === 'ended')
        case 'active': return !a.settled && !a.cancelled
        default: return true
      }
    }).sort((x, y) => Number(x.settled) - Number(y.settled) || Date.parse(x.endsAt) - Date.parse(y.endsAt))
  }),
  pauseAuctions: (scope, reason) => tx((db) => control(db, scope, 'auctions.manage', 'AuctionPause', reason, (a) => {
    if (closedWhy(a)) return closedWhy(a)
    if (a.paused) return 'متوقف مسبقًا'
    Object.assign(a, { paused: true, pausedAt: iso(now()), pauseReason: reason?.trim() || undefined })
    followers(db, a, `توقف مزاد «${a.name}» مؤقتًا`, reason?.trim() || 'أوقفت إدارة المنصة المزاد مؤقتًا، ويُضاف وقت التوقف إلى مدته عند الاستئناف.')
    return null
  })),
  resumeAuctions: (scope) => tx((db) => control(db, scope, 'auctions.manage', 'AuctionResume', undefined, (a) => {
    if (a.cancelled) return 'ملغى'
    if (!a.paused || !a.pausedAt) return 'غير متوقف'
    const at = Date.parse(a.pausedAt), shift = now() - at
    if (at < Date.parse(a.startsAt)) a.startsAt = iso(Date.parse(a.startsAt) + shift)
    a.endsAt = iso(Date.parse(a.endsAt) + shift)
    Object.assign(a, { paused: undefined, pausedAt: undefined, pauseReason: undefined })
    followers(db, a, `استؤنف مزاد «${a.name}»`, 'عاد المزاد ومُدّد بمقدار مدة التوقف.')
    return null
  })),
  extendAuctions: (scope, minutes) => tx((db) => {
    if (!(minutes >= 1 && minutes <= 43200)) throw new ApiError('مدة التمديد من دقيقة إلى 30 يومًا')
    return control(db, scope, 'auctions.manage', 'AuctionExtend', `+${minutes} دقيقة`, (a) => {
      if (closedWhy(a)) return closedWhy(a)
      a.endsAt = iso(Date.parse(a.endsAt) + minutes * 60_000)
      followers(db, a, `مُدّد مزاد «${a.name}»`, `أُضيفت ${minutes} دقيقة إلى مدة المزاد.`)
      return null
    })
  }),
  cancelAuctions: (scope, reason) => tx((db) => {
    const why = reason?.trim()
    if (!why) throw new ApiError('اكتب سبب الإلغاء، يصل للمالك والمزايدين')
    return control(db, scope, 'auctions.cancel', 'AuctionCancel', why, (a) => {
      if (closedWhy(a)) return closedWhy(a)
      Object.assign(a, { cancelled: true, cancelReason: why, paused: undefined, pausedAt: undefined, settled: true })
      db.autobids = (db.autobids ?? []).filter((x) => x.auctionId !== a.id)
      const bidders = [...new Set(db.bids.filter((b) => b.auctionId === a.id).map((b) => b.userId))]
      if (!a.listingId) refundEntry(db, a)
      if (a.icoReservedId) {
        for (const u of bidders) notify(db, u, 'auction_update', `أُلغي مزاد «${a.name}»`, `لم تُحتسب المزايدات على هذا المزاد. السبب: ${why}`, `/auctions/${a.id}`)
        return null
      }
      if (a.listingId) {
        const l = db.listings?.find((x) => x.id === a.listingId)
        if (l) { l.status = 'cancelled'; const r = db.reserved.find((x) => x.id === l.reservedId); if (r) r.listingId = undefined }
        for (const d of db.bidDeposits ?? []) if (d.auctionId === a.id && d.state === 'held') {
          d.state = 'refunded'
          db.txs.push({ id: uid(db, 't'), userId: d.userId, amount: d.amount, kind: 'refund', note: `استرداد ضمان دخول مزاد «${a.name}»`, createdAt: iso(now()) })
        }
        notify(db, a.requesterId, 'auction_update', `أُلغي مزاد «${a.name}»`, `بقي الاسم باسمك ويمكنك عرضه من جديد. السبب: ${why}`, '/dashboard/sell')
      } else {
        const r = db.requests.find((x) => x.id === a.requestId)
        const c = r?.candidates.find((x) => x.id === a.candidateId)
        if (c && c.auctionId === a.id) c.auctionId = undefined
        notify(db, a.requesterId, 'auction_update', `أُلغي مزاد «${a.name}»`, `يعود الاسم إلى قائمة الجدولة وتحدد اللجنة موعدًا جديدًا. السبب: ${why}`, '/dashboard/requests')
      }
      for (const b of bidders) if (b !== a.requesterId) notify(db, b, 'auction_update', `أُلغي مزاد «${a.name}»`, `لم تُحتسب المزايدات على هذا المزاد. السبب: ${why}`, `/auctions/${a.id}`)
      return null
    })
  }),

  // ───── audit of requested names ─────
  requestsAudit: (status = 'under_review', type = 'all') => tx((db) => {
    need(db, 'requests.audit')
    const reqs = db.requests.filter((r) => r.status !== 'pending_payment' && (status === 'all' || r.status === status) && (type === 'all' || r.type === type))
    type K = { name: string; normalized: string; type: NameType; source: SimilarHit['source']; price?: number; priceKind?: 'sold' | 'current'; at?: string; requestId?: string }
    const pool: K[] = db.reserved.map((x) => ({ name: x.name, normalized: x.normalized, type: x.type, source: 'reserved', price: x.price, priceKind: 'sold', at: x.acquiredAt }))
    for (const r of db.requests) {
      if (r.status !== 'under_review' && r.status !== 'accepted') continue
      for (const c of r.candidates) {
        if (c.status === 'rejected' || c.status === 'withdrawn') continue
        const a = c.auctionId ? db.auctions.find((x) => x.id === c.auctionId) : undefined
        if (a?.settled || a?.cancelled) continue
        pool.push({ name: c.name, normalized: c.normalized, type: r.type, source: a ? 'auction' : 'request', price: a?.currentPrice, priceKind: a ? 'current' : undefined, at: a?.startsAt, requestId: r.id })
      }
    }
    const rows: AuditRow[] = []
    for (const r of reqs.sort((x, y) => (y.submittedAt ?? y.createdAt).localeCompare(x.submittedAt ?? x.createdAt))) for (const c of r.candidates) {
      const matches: AuditRow['matches'] = []
      for (const k of pool) {
        if (k.requestId === r.id) continue
        if (r.kind === 'compound' && r.baseName && k.normalized === normalizeName(r.baseName)) continue
        let score = similarity(c.normalized, k.normalized)
        const forms = sameForms(c.normalized, k.normalized)
        if (score < SIMILAR_THRESHOLD && !forms) continue
        if (forms && score < 0.9) score = 0.9
        matches.push({ name: k.name, type: k.type, source: k.source, score: Math.round(score * 100) / 100, relation: relation(c.name, k.name), price: k.price, priceKind: k.priceKind, at: k.at })
      }
      matches.sort((x, y) => y.score - x.score || (y.price ?? 0) - (x.price ?? 0))
      const top = matches.filter((m) => m.priceKind === 'sold' && (m.price ?? 0) > 0).sort((x, y) => (y.price ?? 0) - (x.price ?? 0))[0]
      rows.push({
        requestId: r.id, number: r.number, kind: r.kind ?? 'standard', type: r.type, ownerName: r.ownerName, requestStatus: r.status, submittedAt: r.submittedAt,
        candidateId: c.id, name: c.name, status: c.status, rejectReason: c.rejectReason, verdict: matches.some((m) => m.score >= 1) ? 'exact' : matches.length ? 'similar' : 'clear',
        matches: matches.slice(0, 12), topPrice: top, ownerId: r.userId,
      })
    }
    return rows
  }),

  // ───── customers (CRM) ─────
  listOwners: () => tx((db) => {
    const u = need(db, 'owners.view')
    const full = can_(db, u, 'owners.full')
    return db.users.filter((x) => x.role === 'owner').map((x): OwnerCrm => {
      const names = db.reserved.filter((n) => n.ownerId === x.id).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'ar'))
        .map((n) => ({ id: n.id, name: n.name, type: n.type, price: n.price, acquiredAt: n.acquiredAt, source: n.source, certCode: `SMC-${n.id.slice(-8).toUpperCase()}` }))
      const reqs = db.requests.filter((r) => r.userId === x.id && r.status !== 'pending_payment')
      return {
        id: x.id, nationalId: full ? x.nationalId : maskMid(x.nationalId), fullName: x.fullName, nationality: x.p?.nationality, residenceCountry: x.p?.residenceCountry,
        residenceCity: x.p?.residenceCity, phone: full ? x.phone : maskMid(x.phone)!, altPhone: full ? x.p?.altPhone : maskMid(x.p?.altPhone), email: x.email,
        emailVerified: !!x.emailVerifiedAt, active: x.active !== false, createdAt: x.createdAt, lastLoginAt: x.lastLoginAt, completion: profileOf(x).completion,
        names, totalValue: round2(names.reduce((s, n) => s + n.price, 0)), requests: reqs.length, openRequests: reqs.filter((r) => r.status === 'under_review' || r.status === 'accepted').length, masked: !full,
      }
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }),
  logOwnersReport: (kind, count, filter) => tx((db) => {
    const u = need(db, 'owners.full')
    logAction('OwnersReport', u.fullName, `${kind === 'csv' ? 'تصدير CSV' : 'طباعة'} · ${count} عميل${filter ? ` · ${filter}` : ''}`)
  }),

  // ───── marks report ─────
  marksReport: (f = {}) => tx((db) => {
    need(db, 'reports.marks')
    const t = now()
    const st = (a: Auction): MarkRow['status'] => (a.cancelled ? 'cancelled' : a.settled ? 'sold' : a.paused ? 'paused' : phaseOf(a, t) === 'scheduled' ? 'scheduled' : phaseOf(a, t) === 'live' ? 'live' : 'settling')
    return db.auctions
      .filter((a) => (!f.type || f.type === 'all' || a.type === f.type) && (!f.state || f.state === 'all' || st(a) === f.state)
        && (!f.from || Date.parse(a.endsAt) >= Date.parse(f.from)) && (!f.to || Date.parse(a.startsAt) <= Date.parse(f.to)))
      .sort((x, y) => Date.parse(y.endsAt) - Date.parse(x.endsAt))
      .map((a): MarkRow => {
        const r = db.requests.find((x) => x.id === a.requestId)
        const l = a.listingId ? db.listings?.find((x) => x.id === a.listingId) : undefined
        const inv = db.invoices.filter((i) => i.auctionId === a.id).sort((x, y) => y.issuedAt.localeCompare(x.issuedAt))[0]
        const res = a.settled && !a.cancelled ? db.reserved.find((x) => x.type === a.type && x.normalized === normalizeName(a.name)) : undefined
        return {
          auctionId: a.id, number: a.number ?? '', name: a.name, type: a.type, kind: a.listingId ? 'resale' : a.investment ? 'investment' : 'request',
          requestNumber: r?.number, listingNumber: l?.number, ownerName: db.users.find((u) => u.id === a.requesterId)?.fullName ?? '', status: st(a),
          startsAt: a.startsAt, endsAt: a.endsAt, openingPrice: a.openingPrice, price: a.finalPrice ?? a.currentPrice, bidCount: a.bidCount,
          bidders: new Set(db.bids.filter((b) => b.auctionId === a.id).map((b) => b.userId)).size, winnerName: a.winnerId ? db.users.find((u) => u.id === a.winnerId)?.fullName : undefined,
          wonByRequester: a.wonByRequester, invoiceNumber: inv?.number, invoiceStatus: inv?.status, vat: inv?.vat, certCode: res ? `SMC-${res.id.slice(-8).toUpperCase()}` : undefined, extensions: a.extensions ?? 0, ownerId: a.requesterId, winnerId: a.winnerId,
        }
      })
  }),

  // ───── owner: bank account and refunds ─────
  checkIban: (iban) => delay(checkIbanLocal(iban)),
  myBankAccount: () => tx((db) => { const u = me(db); const b = db.banks?.find((x) => x.userId === u.id); return b ? bankDto(b, true) : null }),
  saveMyBankAccount: (i) => tx((db) => {
    const u = me(db)
    if (u.role !== 'owner') throw new ApiError('الحساب البنكي لملاك الإبل')
    const c = checkIbanLocal(i.iban)
    if (!c.valid) throw new ApiError(c.message)
    const name = i.accountName.trim()
    if (name.length < 3) throw new ApiError('اكتب اسم صاحب الحساب كما في شهادة الآيبان')
    const bank = c.bankName ?? (i.bankName ?? '').trim()
    if (bank.length < 2) throw new ApiError('اكتب اسم البنك')
    db.banks ??= []
    let b = db.banks.find((x) => x.userId === u.id)
    let doc: string | undefined
    if (i.docBase64) {
      doc = i.docBase64.includes(',') ? i.docBase64.slice(i.docBase64.indexOf(',') + 1) : i.docBase64
      if (doc.length * 0.75 > 5 * 1024 * 1024) throw new ApiError('حجم شهادة الآيبان أكبر من 5 ميجابايت')
    } else if (!b) throw new ApiError('ارفع شهادة الآيبان (PDF أو صورة)')
    const type = doc ? sniff(doc) : null
    if (doc && !type) throw new ApiError('شهادة الآيبان تكون PDF أو صورة PNG أو JPG')
    const changed = !b || b.iban !== c.iban || b.accountName !== name || !!doc
    if (!b) { b = { userId: u.id, iban: '', bankName: '', accountName: '', docName: '', docType: '', docBase64: '', status: 'pending', updatedAt: iso(now()) }; db.banks.push(b) }
    Object.assign(b, { iban: c.iban, bankName: bank, accountName: name, updatedAt: iso(now()) })
    if (doc) Object.assign(b, { docBase64: doc, docType: type, docName: (i.docName || 'iban-certificate').slice(0, 120) })
    if (changed) Object.assign(b, { status: 'pending', rejectReason: undefined, reviewedAt: undefined, reviewedBy: undefined })
    return bankDto(b, true)
  }),
  myBankDocument: () => tx((db) => {
    const u = me(db); const b = db.banks?.find((x) => x.userId === u.id)
    if (!b) throw new ApiError('لا يوجد حساب بنكي')
    return { name: b.docName, contentType: b.docType, base64: b.docBase64 }
  }),
  myWithdrawals: () => tx((db) => { const u = me(db); return (db.withdrawals ?? []).filter((w) => w.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
  requestWithdrawal: (amount) => tx((db) => {
    const u = writer(db)
    const a = round2(amount)
    if (!(a >= 10)) throw new ApiError('أقل مبلغ للاسترداد 10 ⃁')
    const b = db.banks?.find((x) => x.userId === u.id)
    if (!b) throw new ApiError('أضف حسابك البنكي وشهادة الآيبان أولًا')
    if (b.status !== 'verified') throw new ApiError('حسابك البنكي بانتظار اعتماد الإدارة المالية')
    if ((db.withdrawals ?? []).filter((w) => w.userId === u.id && (w.status === 'pending' || w.status === 'processing')).length >= 3) throw new ApiError('لديك 3 طلبات استرداد قيد التنفيذ')
    if (balanceOf(db, u.id) < a) throw new ApiError('المبلغ أكبر من رصيد المحفظة')
    const w: Withdrawal = { id: uid(db, 'wd'), number: wNumber(db), userId: u.id, ownerName: u.fullName, amount: a, iban: b.iban, bankName: b.bankName, accountName: b.accountName, status: 'pending', byStaff: false, createdAt: iso(now()) }
    ;(db.withdrawals ??= []).push(w)
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: -a, kind: 'withdrawal', note: `طلب استرداد ${w.number} إلى ${b.bankName} ${maskIban(b.iban)}`, createdAt: iso(now()) })
    return w
  }),

  // ───── finance ─────
  bankAccounts: (status = 'all') => tx((db) => {
    const u = staff(db)
    if (!can_(db, u, 'banks.verify') && !can_(db, u, 'wallets.view')) throw new ApiError('ليست لديك صلاحية «اعتماد الحسابات البنكية»')
    const full = can_(db, u, 'banks.verify')
    return (db.banks ?? []).filter((b) => status === 'all' || b.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((b) => { const o = db.users.find((x) => x.id === b.userId)!; return { userId: b.userId, ownerName: o.fullName, phone: o.phone, account: bankDto(b, full) } })
  }),
  bankDocument: (userId) => tx((db) => {
    need(db, 'banks.verify')
    const b = db.banks?.find((x) => x.userId === userId)
    if (!b) throw new ApiError('لا يوجد حساب بنكي')
    return { name: b.docName, contentType: b.docType, base64: b.docBase64 }
  }),
  verifyBankAccount: (userId) => tx((db) => bankReview(db, userId, true)),
  rejectBankAccount: (userId, reason) => tx((db) => bankReview(db, userId, false, reason)),
  wallets: () => tx((db) => {
    const u = need(db, 'wallets.view')
    const full = can_(db, u, 'owners.full')
    const ids = new Set(db.txs.map((t) => t.userId))
    return db.users.filter((x) => x.role === 'owner' && ids.has(x.id)).map((x) => walletRow(db, x, full)).sort((a, b) => b.balance - a.balance)
  }),
  walletDetail: (userId) => tx((db) => {
    const u = need(db, 'wallets.view')
    const o = db.users.find((x) => x.id === userId && x.role === 'owner')
    if (!o) throw new ApiError('المالك غير موجود')
    const full = can_(db, u, 'wallets.refund')
    const b = db.banks?.find((x) => x.userId === userId)
    return {
      wallet: walletRow(db, o, can_(db, u, 'owners.full')),
      txs: db.txs.filter((t) => t.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      withdrawals: (db.withdrawals ?? []).filter((w) => w.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((w) => wDto(w, full)),
      bank: b ? bankDto(b, full) : undefined,
    }
  }),
  directRefund: (userId, amount, transferRef, note) => tx((db) => {
    const u = need(db, 'wallets.refund')
    const a = round2(amount)
    if (!(a > 0)) throw new ApiError('اكتب مبلغًا صحيحًا')
    if (transferRef.trim().length < 3) throw new ApiError('اكتب رقم الحوالة البنكية')
    const o = db.users.find((x) => x.id === userId && x.role === 'owner')
    if (!o) throw new ApiError('المالك غير موجود')
    const b = db.banks?.find((x) => x.userId === userId)
    if (b?.status !== 'verified') throw new ApiError('لا يوجد حساب بنكي معتمد لهذا المالك؛ اعتمد شهادة الآيبان أولًا')
    if (balanceOf(db, userId) < a) throw new ApiError('المبلغ أكبر من رصيد المحفظة')
    const w: Withdrawal = { id: uid(db, 'wd'), number: wNumber(db), userId, ownerName: o.fullName, amount: a, iban: b.iban, bankName: b.bankName, accountName: b.accountName, status: 'completed', byStaff: true, createdAt: iso(now()), processedAt: iso(now()), processedBy: u.fullName, transferRef: transferRef.trim(), note: note?.trim() || undefined }
    ;(db.withdrawals ??= []).push(w)
    db.txs.push({ id: uid(db, 't'), userId, amount: -a, kind: 'withdrawal', note: `استرداد ${w.number} إلى ${b.bankName} ${maskIban(b.iban)}، حوالة ${w.transferRef}`, createdAt: iso(now()) })
    logAction('WithdrawalDirect', u.fullName, `${o.fullName} · ${w.number} · ${sarText(a)} · حوالة ${w.transferRef}`)
    notify(db, userId, 'refund', 'حُوّل رصيد من محفظتك إلى حسابك البنكي', `${sarText(a)} إلى ${b.bankName} ${maskIban(b.iban)}، رقم الحوالة ${w.transferRef}.`, '/dashboard/wallet')
    return w
  }),
  adjustWallet: (userId, amount, reason) => tx((db) => {
    const u = need(db, 'wallets.adjust')
    const a = round2(amount)
    if (!a || Math.abs(a) > 1_000_000) throw new ApiError('اكتب مبلغ التسوية (موجب للإضافة، سالب للخصم)')
    const why = reason.trim()
    if (why.length < 5) throw new ApiError('اكتب سبب التسوية بوضوح، يظهر في كشف المالك')
    const o = db.users.find((x) => x.id === userId && x.role === 'owner')
    if (!o) throw new ApiError('المالك غير موجود')
    if (a < 0 && balanceOf(db, userId) < -a) throw new ApiError('الخصم أكبر من رصيد المحفظة')
    db.txs.push({ id: uid(db, 't'), userId, amount: a, kind: 'adjustment', note: `تسوية: ${why}`, createdAt: iso(now()) })
    logAction('WalletAdjust', u.fullName, `${o.fullName} · ${a > 0 ? '+' : ''}${sarText(a)} · ${why}`)
    notify(db, userId, 'refund', a > 0 ? 'أُضيف مبلغ إلى محفظتك' : 'خُصم مبلغ من محفظتك', `${sarText(Math.abs(a))}: ${why}`, '/dashboard/wallet')
    return walletRow(db, o, can_(db, u, 'owners.full'))
  }),
  withdrawals: (status = 'all') => tx((db) => {
    const u = staff(db)
    if (!can_(db, u, 'wallets.view') && !can_(db, u, 'wallets.refund')) throw new ApiError('ليست لديك صلاحية «تقرير المحافظ»')
    const full = can_(db, u, 'wallets.refund')
    return (db.withdrawals ?? []).filter((w) => status === 'all' || w.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((w) => wDto(w, full))
  }),
  completeWithdrawal: (id, transferRef) => tx((db) => {
    const u = need(db, 'wallets.refund')
    const ref = transferRef.trim()
    if (ref.length < 3) throw new ApiError('اكتب رقم الحوالة البنكية')
    const w = db.withdrawals?.find((x) => x.id === id)
    if (!w) throw new ApiError('طلب الاسترداد غير موجود')
    if (w.status !== 'pending') throw new ApiError('تمت معالجة هذا الطلب')
    Object.assign(w, { status: 'completed', transferRef: ref, processedAt: iso(now()), processedBy: u.fullName })
    logAction('WithdrawalCompleted', u.fullName, `${w.ownerName} · ${w.number} · ${sarText(w.amount)} · حوالة ${ref}`)
    notify(db, w.userId, 'refund', 'حُوّل مبلغ الاسترداد إلى حسابك', `${sarText(w.amount)} إلى ${w.bankName} ${maskIban(w.iban)}، رقم الحوالة ${ref}.`, '/dashboard/wallet')
    return w
  }),
  payoutStatus: () => tx((db) => { need(db, 'wallets.view'); return { enabled: true, provider: 'simulated' } }),
  payoutWithdrawal: (id) => tx((db) => {
    const u = need(db, 'wallets.refund')
    const w = db.withdrawals?.find((x) => x.id === id)
    if (!w) throw new ApiError('طلب الاسترداد غير موجود')
    if (w.status !== 'pending') throw new ApiError('تمت معالجة هذا الطلب')
    const bank = db.banks?.find((b) => b.userId === w.userId)
    if (!bank || bank.status !== 'verified' || bank.iban !== w.iban) throw new ApiError('الحساب البنكي للمالك غير معتمد أو تغيّر بعد الطلب')
    // the demo simulates the gateway: the transfer succeeds at once
    const ref = `SIM-${w.number}`
    Object.assign(w, { status: 'completed', transferRef: ref, processedAt: iso(now()), processedBy: u.fullName, payoutProvider: 'simulated', payoutSentAt: iso(now()), payoutError: undefined })
    logAction('WithdrawalPaidOut', u.fullName, `${w.ownerName} · ${w.number} · ${sarText(w.amount)} · ${ref}`)
    notify(db, w.userId, 'refund', 'حُوّل مبلغ الاسترداد إلى حسابك', `${sarText(w.amount)} إلى ${w.bankName} ${maskIban(w.iban)}، رقم العملية ${ref}.`, '/dashboard/wallet')
    return w
  }),
  rejectWithdrawal: (id, reason) => tx((db) => {
    const u = need(db, 'wallets.refund')
    const why = reason.trim()
    if (why.length < 3) throw new ApiError('اكتب سبب الرفض، يصل للمالك')
    const w = db.withdrawals?.find((x) => x.id === id)
    if (!w) throw new ApiError('طلب الاسترداد غير موجود')
    if (w.status !== 'pending') throw new ApiError('تمت معالجة هذا الطلب')
    Object.assign(w, { status: 'rejected', note: why, processedAt: iso(now()), processedBy: u.fullName })
    db.txs.push({ id: uid(db, 't'), userId: w.userId, amount: w.amount, kind: 'withdrawal', note: `إعادة مبلغ طلب الاسترداد ${w.number} (${why})`, createdAt: iso(now()) })
    logAction('WithdrawalRejected', u.fullName, `${w.ownerName} · ${w.number} · ${sarText(w.amount)} · ${why}`)
    notify(db, w.userId, 'refund', 'لم يُنفّذ طلب الاسترداد', `أُعيد ${sarText(w.amount)} إلى محفظتك. السبب: ${why}`, '/dashboard/wallet')
    return w
  }),
  deposits: (state = 'all') => tx((db) => {
    need(db, 'deposits.view')
    const rows: DepositRow[] = []
    for (const r of db.requests) {
      if (r.depositState === 'none' || !r.depositAmount) continue
      if (state !== 'all' && r.depositState !== state) continue
      rows.push({
        kind: 'request', requestId: r.id, userId: r.userId, ownerName: r.ownerName, reference: r.number,
        auctionNumber: db.auctions.filter((a) => a.requestId === r.id && a.number).map((a) => a.number).join('، ') || undefined,
        names: r.candidates.filter((c) => c.status !== 'withdrawn').map((c) => c.name).join('، '), type: r.type, amount: r.depositAmount, state: r.depositState as DepositRow['state'],
        context: r.kind === 'investment' ? 'رسوم دراسة استثمار' : r.status, at: r.submittedAt ?? r.createdAt,
      })
    }
    for (const d of db.bidDeposits ?? []) {
      if (state !== 'all' && d.state !== state) continue
      const a = db.auctions.find((x) => x.id === d.auctionId)
      if (!a) continue
      rows.push({
        kind: 'bid', auctionId: a.id, userId: d.userId, ownerName: db.users.find((u) => u.id === d.userId)?.fullName ?? '', reference: db.listings?.find((l) => l.id === a.listingId)?.number ?? '',
        auctionNumber: a.number, names: a.name, type: a.type, amount: d.amount, state: d.state, context: a.cancelled ? 'cancelled' : a.settled ? 'settled' : now() >= Date.parse(a.endsAt) ? 'ended' : 'open', at: d.createdAt,
      })
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at))
  }),
  refundDeposit: (i) => tx((db) => {
    const u = need(db, 'deposits.refund')
    const why = i.reason.trim()
    if (why.length < 3) throw new ApiError('اكتب سبب الاسترداد، يصل للمالك')
    if (i.kind === 'request') {
      const r = db.requests.find((x) => x.id === i.requestId)
      if (!r) throw new ApiError('الطلب غير موجود')
      if (r.kind === 'investment') throw new ApiError('رسوم دراسة الاستثمار غير مستردة؛ للاستثناء استخدم تسوية المحفظة')
      if (r.depositState !== 'held') throw new ApiError('هذا الضمان ليس محجوزًا (رُدّ أو خُصم من الفاتورة)')
      r.depositState = 'refunded'
      db.txs.push({ id: uid(db, 't'), userId: r.userId, amount: r.depositAmount, kind: 'refund', note: `استرداد ضمان الطلب ${r.number} (${why})`, createdAt: iso(now()) })
      notify(db, r.userId, 'refund', 'أُعيد ضمان المزاد إلى محفظتك', `${sarText(r.depositAmount)} من الطلب ${r.number} (${why}).`, '/dashboard/wallet')
      logAction('DepositRefund', u.fullName, `${r.ownerName} · ضمان الطلب ${r.number} · ${sarText(r.depositAmount)} · ${why}`)
      return { kind: 'request', requestId: r.id, userId: r.userId, ownerName: r.ownerName, reference: r.number, names: r.candidates.map((c) => c.name).join('، '), type: r.type, amount: r.depositAmount, state: 'refunded', context: r.status, at: r.submittedAt ?? r.createdAt }
    }
    const d = db.bidDeposits?.find((x) => x.auctionId === i.auctionId && x.userId === i.userId)
    const a = db.auctions.find((x) => x.id === i.auctionId)
    if (!d || !a) throw new ApiError('الضمان غير موجود')
    if (d.state !== 'held') throw new ApiError('هذا الضمان ليس محجوزًا')
    if (!a.settled && !a.cancelled && a.leaderId === d.userId) throw new ApiError('المالك متصدر المزاد حاليًا؛ لا يُرد ضمانه قبل انتهاء المزاد')
    d.state = 'refunded'
    db.txs.push({ id: uid(db, 't'), userId: d.userId, amount: d.amount, kind: 'refund', note: `استرداد ضمان دخول مزاد «${a.name}» (${why})`, createdAt: iso(now()) })
    const o = db.users.find((x) => x.id === d.userId)!
    notify(db, d.userId, 'refund', 'أُعيد ضمان دخول المزاد إلى محفظتك', `${sarText(d.amount)} من مزاد «${a.name}» (${why}).`, '/dashboard/wallet')
    logAction('DepositRefund', u.fullName, `${o.fullName} · ضمان دخول ${a.number} «${a.name}» · ${sarText(d.amount)} · ${why}`)
    return { kind: 'bid', auctionId: a.id, userId: d.userId, ownerName: o.fullName, reference: '', auctionNumber: a.number, names: a.name, type: a.type, amount: d.amount, state: 'refunded', context: a.settled ? 'settled' : 'open', at: d.createdAt }
  }),

  // ───── activity log (the wrapper below writes it) ─────
  myActivity: (f = {}) => tx((db) => {
    const id = ownerSelf(db).id
    let list = readActivity().filter((a) => a.actorId === id || a.onBehalfOfId === id)
    if (f.who === 'me') list = list.filter((a) => a.actorId === id && !a.onBehalfOfId)
    if (f.who === 'delegates') list = list.filter((a) => a.onBehalfOfId === id)
    if (f.who === 'as_delegate') list = list.filter((a) => a.actorId === id && a.onBehalfOfId)
    return pageActivity(list, f, 200)
  }),
  activity: (f = {}) => tx((db) => {
    need(db, 'logs.view')
    let list = readActivity()
    if (f.role) list = list.filter((a) => (f.role === 'staff' ? a.actorRole === 'admin' || a.actorRole === 'committee' : a.actorRole === f.role))
    return pageActivity(list, f, 500)
  }),

  // ───── certificates (bilingual, signed, issued at once) ─────
  verifyIssuedCertificate: (number, sig) => tx((db) => {
    const c = (db.certificates ?? []).find((x) => x.number === number.trim().toUpperCase())
    if (!c) return null
    const { items, status } = certCurrent(db, c)
    const intact = certSign(c) === c.signature
    return {
      number: c.number, scope: c.scope, ownerNameAr: c.ownerNameAr, ownerNameEn: c.ownerNameEn, nationality: c.nationality, issuedAt: c.issuedAt,
      status: intact ? status : 'revoked', signatureMatches: sig ? intact && sig.replace(/\s/g, '').toUpperCase() === c.signature : undefined,
      revokedAt: c.revokedAt, revokeReason: intact ? c.revokeReason : 'تعذّر التحقق من سلامة بيانات الشهادة', items,
    }
  }),
  myCertificates: () => tx((db) => { const u = me(db); return (db.certificates ?? []).filter((c) => c.ownerId === u.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map((c) => certDto(db, c)) }),
  myCertificate: (number) => tx((db) => {
    const u = me(db)
    const c = (db.certificates ?? []).find((x) => x.number === number.trim().toUpperCase())
    if (!c) throw new ApiError('الشهادة غير موجودة')
    if (c.ownerId !== u.id) need(db, 'certificates.manage')
    return certDto(db, c)
  }),
  issueCertificate: ({ scope, reservedNameId, ownerNameEn }) => tx((db) => {
    const u = writer(db)
    if (u.role !== 'owner') throw new ApiError('الشهادات لحسابات ملاك الإبل')
    if (!u.p?.firstName || !u.p?.familyName || !u.nationalId) throw new ApiError('أكمل بياناتك الشخصية (الاسم ورقم الهوية) في «حسابي» قبل إصدار الشهادة')
    const list = (db.certificates ??= [])
    if (list.filter((c) => c.ownerId === u.id && Date.parse(c.issuedAt) > now() - 864e5).length >= 30) throw new ApiError('بلغت حد الإصدار اليومي (30 شهادة)، حاول غدًا')
    let marks: ReservedName[]
    if (scope === 'mark') {
      const r = db.reserved.find((x) => x.id === reservedNameId)
      if (!reservedNameId) throw new ApiError('اختر الشعار')
      if (!r) throw new ApiError('الشعار غير موجود')
      if (r.ownerId !== u.id) throw new ApiError('هذا الشعار ليس مسجلًا باسمك')
      marks = [r]
    } else {
      marks = db.reserved.filter((x) => x.ownerId === u.id).sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt))
      if (!marks.length) throw new ApiError('لا توجد شعارات مسجلة باسمك بعد')
    }
    let en = (ownerNameEn ?? '').trim().replace(/\s+/g, ' ')
    if (en) {
      if (!/^[A-Za-z][A-Za-z .'\-]{3,118}[A-Za-z.]$/.test(en)) throw new ApiError('اكتب اسمك بالإنجليزية بحروف لاتينية كما في جواز السفر')
      u.fullNameEn = en
    } else en = u.fullNameEn ?? toLatin(u.fullName)
    db.seq += 1
    const issued = new Date(Math.floor(now() / 1000) * 1000)
    const c: DemoCert = {
      id: uid(db, 'crt'), number: `SC-${issued.getUTCFullYear()}-${String(list.length + 1).padStart(6, '0')}`, ownerId: u.id, scope: scope === 'portfolio' ? 'portfolio' : 'mark',
      ownerNameAr: u.fullName, ownerNameEn: en, nationalId: u.nationalId, nationality: u.p?.nationality,
      items: marks.map((r) => ({ id: r.id, name: r.name, latin: latinOf(r), type: r.type, acquiredAt: r.acquiredAt, registryCode: certNo(r), source: r.source, baseName: r.baseName })),
      issuedAt: issued.toISOString(), signature: '',
    }
    c.signature = certSign(c)
    list.push(c)
    notify(db, u.id, 'certificate', `صدرت شهادة ${c.number}`, `شهادة تسجيل ${c.scope === 'mark' ? `شعار «${marks[0].name}»` : `جميع شعاراتك (${marks.length})`}، موثقة من المنظمة الدولية للإبل.`, `/dashboard/certificates/${c.number}`)
    return certDto(db, c)
  }),
  staffCertificates: (f = {}) => tx((db) => {
    need(db, 'certificates.manage')
    let list = [...(db.certificates ?? [])].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    if (f.q?.trim()) { const t = f.q.trim(); list = list.filter((c) => c.number.includes(t.toUpperCase()) || c.ownerNameAr.includes(t) || c.ownerNameEn.toLowerCase().includes(t.toLowerCase()) || c.items.some((i) => i.name.includes(t))) }
    if (f.status === 'revoked') list = list.filter((c) => c.revokedAt)
    if (f.status === 'active') list = list.filter((c) => !c.revokedAt)
    const page = Math.max(1, f.page ?? 1)
    return { items: list.slice((page - 1) * 50, page * 50).map((c) => certDto(db, c)), total: list.length }
  }),
  staffCertificate: (number) => tx((db) => {
    need(db, 'certificates.manage')
    const c = (db.certificates ?? []).find((x) => x.number === number.trim().toUpperCase())
    if (!c) throw new ApiError('الشهادة غير موجودة')
    return certDto(db, c)
  }),
  revokeCertificate: (id, reason) => tx((db) => {
    const s = need(db, 'certificates.manage')
    const c = (db.certificates ?? []).find((x) => x.id === id)
    if (!c) throw new ApiError('الشهادة غير موجودة')
    if ((reason ?? '').trim().length < 5) throw new ApiError('اكتب سبب الإلغاء')
    if (c.revokedAt) throw new ApiError('الشهادة ملغاة مسبقًا')
    c.revokedAt = iso(now()); c.revokedBy = s.fullName; c.revokeReason = reason.trim().slice(0, 300)
    notify(db, c.ownerId, 'certificate', `أُلغيت الشهادة ${c.number}`, `السبب: ${c.revokeReason}. يمكنك إصدار شهادة جديدة.`, '/dashboard/certificates')
    return certDto(db, c)
  }),
  icoNames: () => tx((db) => {
    need(db, 'names.ico')
    return db.reserved.filter((r) => !r.ownerId && r.source === 'exception').sort((a, b) => (b.forfeitedAt ?? '').localeCompare(a.forfeitedAt ?? '')).map((r) => ({
      id: r.id, name: r.name, latin: latinOf(r), type: r.type, forfeitedFromName: r.forfeitedFromName, forfeitedFromId: r.forfeitedFromId, forfeitedAt: r.forfeitedAt,
      forfeitedPrice: r.forfeitedPrice, forfeitedDeposit: r.forfeitedDeposit, certCode: certNo(r), auction: db.auctions.find((a) => a.icoReservedId === r.id && !a.settled && !a.cancelled),
    }))
  }),
  auctionIcoName: (id, startsAt, endsAt, openingPrice) => tx((db) => {
    need(db, 'names.ico')
    const s = Date.parse(startsAt), e = Date.parse(endsAt)
    if (!s || !e) throw new ApiError('حدد موعد البداية والنهاية')
    if (e <= s) throw new ApiError('موعد النهاية يجب أن يكون بعد البداية')
    if (e <= now()) throw new ApiError('موعد النهاية في الماضي')
    if (openingPrice != null && openingPrice < 0) throw new ApiError('السعر الافتتاحي غير صحيح')
    const rn = db.reserved.find((x) => x.id === id)
    if (!rn) throw new ApiError('الاسم غير موجود')
    if (rn.ownerId || rn.source !== 'exception') throw new ApiError('هذا الاسم ليس من أسماء المنظمة')
    if (db.auctions.some((a) => a.icoReservedId === rn.id && !a.settled && !a.cancelled)) throw new ApiError('للاسم مزاد قائم أو مجدول')
    const opening = round2(openingPrice ?? RULES.openingPrice)
    const entry = readSettings().depositAmount
    const a: Auction = {
      id: uid(db, 'a'), requestId: '', candidateId: '', icoReservedId: rn.id, name: rn.name, type: rn.type, requesterId: '', openingPrice: opening, minIncrement: RULES.minIncrement,
      startsAt: iso(s), endsAt: iso(e), currentPrice: opening, bidCount: 0, settled: false, bidDeposit: entry > 0 ? entry : undefined,
    }
    db.auctions.push(a)
    numberAuctions(db)
    if (rn.forfeitedFromId) notify(db, rn.forfeitedFromId, 'auction_opened', `يُطرح «${rn.name}» في مزاد جديد`, 'طرحته المنظمة الدولية للإبل في مزاد عام، وتستطيع المشاركة بسداد ضمان الدخول.', `/auctions/${a.id}`)
    return a
  }),
  setLatinName: (id, latin) => tx((db) => {
    need(db, 'names.latin')
    const r = db.reserved.find((x) => x.id === id)
    if (!r) throw new ApiError('الاسم غير موجود')
    const v = (latin ?? '').trim().replace(/\s+/g, ' ')
    if (!v) delete r.latinName
    else {
      if (v.length > 80 || !/^[A-Za-z][A-Za-z '\-’]*$/.test(v)) throw new ApiError('الكتابة اللاتينية بحروف إنجليزية فقط (مع - أو \')')
      r.latinName = v
    }
    return { ...r }
  }),

  // ───── account delegation ─────
  myDelegations: () => tx((db) => {
    const u = ownerSelf(db)
    return (db.delegations ?? []).filter((d) => d.ownerId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((d) => delegationDto(db, d))
  }),
  saveDelegation: (id, i) => tx((db) => {
    const u = ownerSelf(db)
    const name = i.fullName.trim().replace(/\s+/g, ' ')
    if (name.length < 6) throw new ApiError('اكتب اسم المفوض الرباعي')
    const nid = i.nationalId.trim().toUpperCase()
    if (!/^[A-Z0-9]{5,20}$/.test(nid)) throw new ApiError('رقم هوية المفوض غير صحيح')
    const phone = normalizeIntl(i.phoneCountry, i.phone)
    if (!phone) throw new ApiError('رقم جوال المفوض غير صحيح')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim())) throw new ApiError('بريد المفوض غير صحيح')
    if (nid === u.nationalId || phone === u.phone) throw new ApiError('لا يمكنك تفويض نفسك')
    if (!i.capacity) throw new ApiError('اختر صفة المفوض')
    if (i.capacity === 'other' && !i.capacityNote?.trim()) throw new ApiError('اكتب صفة المفوض')
    const starts = i.startsAt ? Date.parse(i.startsAt) : now()
    let ends: number | undefined
    if (!i.permanent) {
      if (!i.endsAt) throw new ApiError('حدّد نهاية التفويض المؤقت')
      ends = Date.parse(i.endsAt)
      if (ends <= starts) throw new ApiError('نهاية التفويض بعد بدايته')
      if (ends <= now()) throw new ApiError('نهاية التفويض في الماضي')
      if (ends > starts + 3 * 365.25 * D) throw new ApiError('أقصى مدة للتفويض المؤقت 3 سنوات، أو اختر تفويضًا دائمًا')
    }
    db.delegations ??= []
    let d = id ? db.delegations.find((x) => x.id === id && x.ownerId === u.id) : undefined
    if (id && !d) throw new ApiError('التفويض غير موجود')
    if (d?.revokedAt) throw new ApiError('التفويض ملغى؛ أضف تفويضًا جديدًا')
    if (!d) {
      const live = db.delegations.filter((x) => x.ownerId === u.id && delegationStatus(x) !== 'revoked' && delegationStatus(x) !== 'expired')
      if (live.length >= 5) throw new ApiError('5 تفويضات قائمة على الأكثر، ألغِ أحدها أولًا')
      if (live.some((x) => x.nationalId === nid)) throw new ApiError('يوجد تفويض قائم لهذا الشخص، عدّله بدل إضافة تفويض جديد')
      d = { id: uid(db, 'dlg'), ownerId: u.id, fullName: '', nationalId: '', phone: '', email: '', capacity: 'agent', scopes: [], permanent: true, startsAt: iso(now()), createdAt: iso(now()) }
      db.delegations.push(d)
    }
    const relink = d.nationalId !== nid || d.phone !== phone
    Object.assign(d, { fullName: name, nationalId: nid, phone, email: i.email.trim(), capacity: i.capacity, capacityNote: i.capacityNote?.trim() || undefined,
      scopes: [...new Set(i.scopes)], permanent: i.permanent, startsAt: iso(starts), endsAt: ends ? iso(ends) : undefined })
    if (relink) {
      const t = db.users.find((x) => x.nationalId === nid && x.phone === phone && x.role === 'owner' && x.active !== false)
      d.delegateUserId = t?.id
      if (t) notify(db, t.id, 'delegation', `فوّضك ${u.fullName} لإدارة حسابه`, 'ادخل إلى حسابه من «التفويض» في إعدادات لوحة التحكم.', '/dashboard/settings?tab=delegation')
    }
    return delegationDto(db, d)
  }),
  revokeDelegation: (id) => tx((db) => {
    const u = ownerSelf(db)
    const d = db.delegations?.find((x) => x.id === id && x.ownerId === u.id)
    if (!d) throw new ApiError('التفويض غير موجود')
    if (!d.revokedAt) {
      d.revokedAt = iso(now())
      if (d.delegateUserId) notify(db, d.delegateUserId, 'delegation', `ألغى ${u.fullName} تفويضك`, 'لم تعد تستطيع إدارة حسابه.', '/dashboard/settings?tab=delegation')
    }
    return delegationDto(db, d)
  }),
  delegatedToMe: () => tx((db) => {
    if (readActing()) return []
    const u = me(db)
    return (db.delegations ?? []).filter((d) => d.delegateUserId === u.id).map((d) => delegationDto(db, d))
  }),
  actAs: (delegationId) => tx((db) => {
    if (readActing()) throw new ApiError('ارجع إلى حسابك أولًا')
    const u = me(db)
    const d = db.delegations?.find((x) => x.id === delegationId && x.delegateUserId === u.id)
    if (!d) throw new ApiError('التفويض غير موجود')
    const st = delegationStatus(d)
    if (st !== 'active') throw new ApiError(st === 'scheduled' ? 'لم يبدأ التفويض بعد' : st === 'expired' ? 'انتهت مدة التفويض' : 'التفويض ملغى')
    const owner = db.users.find((x) => x.id === d.ownerId && x.active !== false)
    if (!owner) throw new ApiError('حساب صاحب التفويض موقوف')
    d.lastUsedAt = iso(now())
    notify(db, owner.id, 'delegation', `دخل المفوض ${u.fullName} إلى حسابك`, 'كل ما يجريه مسجّل باسمه في سجل النشاط.', '/dashboard/settings?tab=delegation')
    writeActing({ delegationId: d.id, actorId: u.id })
    setSession(owner.id)
    try { localStorage.setItem('sammha-demo-stamp', String(owner.stamp ?? 0)) } catch { /* ignore */ }
    return publicUser(owner)
  }),
  stopActing: () => tx((db) => {
    const a = readActing()
    if (!a) throw new ApiError('أنت في حسابك')
    const actor = db.users.find((x) => x.id === a.actorId)
    writeActing(null)
    if (!actor) { setSession(null); throw new ApiError('سجّل الدخول من جديد') }
    setSession(actor.id)
    try { localStorage.setItem('sammha-demo-stamp', String(actor.stamp ?? 0)) } catch { /* ignore */ }
    return publicUser(actor)
  }),
}

// ───────────────────────── activity log and delegated sessions (demo) ─────────────────────────
const ACT_KEY = 'sammha-demo-activity'
const ACTING_KEY = 'sammha-demo-acting'
const ACT_CATEGORIES: Record<string, string> = {
  auth: 'الدخول', account: 'الحساب', requests: 'طلبات الشعارات', auctions: 'المزادات', payments: 'المدفوعات', finance: 'المالية',
  users: 'المستخدمون والأدوار', settings: 'الإعدادات', tickets: 'الشكاوى والبلاغات', delegation: 'التفويض', content: 'المحتوى', reports: 'التقارير', certificates: 'الشهادات',
}
/** each write and its label in the log (same labels as the API) */
const ACT: Record<string, [string, string]> = {
  issueCertificate: ['إصدار شهادة', 'certificates'], revokeCertificate: ['إلغاء شهادة', 'certificates'], setLatinName: ['تعديل الكتابة اللاتينية لاسم', 'certificates'], auctionIcoName: ['طرح اسم للمنظمة في مزاد', 'auctions'],
  startSignIn: ['محاولة دخول', 'auth'], completeSignIn: ['تسجيل دخول', 'auth'], signOut: ['تسجيل خروج', 'auth'], startSignUp: ['بدء إنشاء حساب', 'auth'], signUp: ['إنشاء حساب مالك', 'auth'],
  changePassword: ['تغيير كلمة المرور', 'account'], revokeMySession: ['إخراج جهاز', 'account'], signOutEverywhere: ['خروج من كل الأجهزة', 'account'], updateMyAccount: ['تعديل بيانات الحساب', 'account'],
  updateMyProfile: ['تعديل الصورة الشخصية', 'account'], updateMyPersonal: ['إكمال البيانات الشخصية', 'account'], updateMyAddress: ['تعديل العنوان', 'account'],
  confirmEmailChange: ['تغيير البريد', 'account'], confirmPhoneChange: ['تغيير الجوال', 'account'], confirmEmailVerification: ['توثيق البريد', 'account'], saveMyPreferences: ['تعديل الإشعارات', 'account'],
  saveMyBankAccount: ['حفظ الحساب البنكي', 'finance'],
  createRequest: ['تقديم طلب شعار', 'requests'], payDeposit: ['سداد ضمان طلب', 'requests'], cancelMyRequest: ['إلغاء طلب من المالك', 'requests'], withdrawName: ['سحب اسم من طلب', 'requests'],
  createCompoundRequest: ['طلب اسم مركب', 'requests'], createInvestmentRequest: ['طلب استثمار اسم', 'requests'], reviewRequest: ['اعتماد قرار طلب', 'requests'], rejectRequest: ['رفض طلب', 'requests'], cancelRequest: ['إلغاء طلب من الإدارة', 'requests'],
  scheduleAuctions: ['فتح مزادات', 'auctions'], pauseAuctions: ['إيقاف مزادات مؤقتًا', 'auctions'], resumeAuctions: ['استئناف مزادات', 'auctions'], extendAuctions: ['تمديد مزادات', 'auctions'], cancelAuctions: ['إلغاء مزادات', 'auctions'],
  placeBid: ['مزايدة', 'auctions'], setAutoBid: ['تفعيل مزايدة آلية', 'auctions'], cancelAutoBid: ['إيقاف مزايدة آلية', 'auctions'], toggleWatch: ['متابعة مزاد', 'auctions'], payBidDeposit: ['سداد ضمان دخول مزاد', 'auctions'],
  createListing: ['عرض اسم للبيع', 'auctions'], cancelListing: ['إلغاء عرض بيع', 'auctions'], buyListing: ['شراء اسم', 'auctions'],
  topUp: ['شحن المحفظة', 'payments'], payInvoice: ['سداد فاتورة', 'payments'], markInvoicePaid: ['تسجيل سداد فاتورة', 'payments'],
  requestWithdrawal: ['طلب استرداد للبنك', 'finance'], completeWithdrawal: ['تنفيذ استرداد', 'finance'], rejectWithdrawal: ['رفض استرداد', 'finance'], directRefund: ['استرداد مباشر للبنك', 'finance'],
  adjustWallet: ['تسوية رصيد محفظة', 'finance'], verifyBankAccount: ['اعتماد حساب بنكي', 'finance'], rejectBankAccount: ['رفض حساب بنكي', 'finance'], refundDeposit: ['استرداد ضمان', 'finance'],
  createStaff: ['إضافة موظف', 'users'], setUserRole: ['تغيير نوع حساب', 'users'], setUserStaffRole: ['تغيير دور موظف', 'users'], setUserActive: ['إيقاف أو تفعيل حساب', 'users'], saveRole: ['حفظ دور', 'users'], deleteRole: ['حذف دور', 'users'],
  updateSettings: ['تعديل إعدادات المنصة', 'settings'], signOutEveryone: ['تسجيل خروج الجميع', 'settings'], saveTicketRouting: ['توزيع الشكاوى والبلاغات', 'settings'],
  submitTicket: ['تقديم شكوى أو استفسار', 'tickets'], followUpTicket: ['متابعة تذكرة', 'tickets'], replyTicket: ['رد على تذكرة', 'tickets'], updateTicket: ['تحديث تذكرة', 'tickets'],
  saveEvent: ['حفظ فعالية', 'content'], deleteEvent: ['حذف فعالية', 'content'], logOwnersReport: ['طباعة أو تصدير بيانات العملاء', 'reports'],
  saveDelegation: ['حفظ تفويض', 'delegation'], revokeDelegation: ['إلغاء تفويض', 'delegation'], actAs: ['الدخول بتفويض', 'delegation'], stopActing: ['الخروج من التفويض', 'delegation'],
}
/** the scope each owner write needs in a delegated session (same map as the API) */
const SCOPE_OF: Record<string, DelegationScope> = {
  createRequest: 'requests', payDeposit: 'requests', cancelMyRequest: 'requests', withdrawName: 'requests', createCompoundRequest: 'requests', createInvestmentRequest: 'invest',
  placeBid: 'bids', setAutoBid: 'bids', cancelAutoBid: 'bids', toggleWatch: 'bids', payBidDeposit: 'bids', buyListing: 'bids',
  topUp: 'payments', payInvoice: 'payments', createListing: 'sales', cancelListing: 'sales', submitTicket: 'tickets', followUpTicket: 'tickets',
}
const SCOPE_LABEL: Record<DelegationScope, string> = { requests: 'طلبات الشعارات', invest: 'استثمار الاسم', bids: 'المزايدة والشراء', payments: 'المحفظة والفواتير', sales: 'بيع الأسماء', tickets: 'الشكاوى والاستفسارات' }
const ALWAYS = new Set(['signOut', 'markNotificationsRead', 'stopActing'])
function pageActivity(all: ActivityEntry[], f: ActivityFilter, max: number) {
  let list = all
  if (f.from) list = list.filter((a) => a.at >= f.from!)
  if (f.to) list = list.filter((a) => a.at <= f.to!)
  if (f.category) list = list.filter((a) => a.category === f.category)
  if (f.failed) list = list.filter((a) => !a.success)
  if (f.q?.trim()) { const t = f.q.trim(); list = list.filter((a) => [a.actorName, a.action, a.details, a.onBehalfOfName, a.ip].some((x) => x?.includes(t))) }
  const size = Math.min(max, Math.max(10, f.size ?? 100)), page = Math.max(1, f.page ?? 1)
  return { items: list.slice((page - 1) * size, page * size), total: list.length, categories: Object.entries(ACT_CATEGORIES).map(([key, value]) => ({ key, value })) }
}
const HIDDEN = new Set(['myActivity', 'myBankAccount', 'myBankDocument', 'mySessions', 'mySecurity', 'myDelegations', 'myWithdrawals'])
const SECRET = /password|code|challenge|token|base64|iban|card|secret|^cur$|^next$/i

/** the registry's Latin spelling: staff's override, or the transliteration (same as the API's Mapper.LatinOf) */
function latinOf(r: { name: string; latinName?: string }) { return r.latinName?.trim() || toLatin(r.name) }
const TYPE_EN: Record<string, string> = { qaadan: "Qa'dan (young males)", bakkar: 'Bakkar (young females)', manqiya: 'Manqiya (select herd)' }
const TYPE_AR: Record<string, string> = { qaadan: 'القعدان', bakkar: 'البكار', manqiya: 'المنقية' }
/** demo signature: a keyed hash of the content (the API uses HMAC-SHA256 with a server secret) */
function certSign(c: DemoCert) {
  const content = [c.number, c.ownerId, c.ownerNameAr, c.ownerNameEn, c.nationalId ?? '', Math.floor(Date.parse(c.issuedAt) / 1000), JSON.stringify(c.items)].join('|')
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let h1 = 0xdeadbeef ^ 0x5a5a, h2 = 0x41c6ce57
  for (let i = 0; i < content.length; i++) { const ch = content.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677) }
  let out = ''
  for (let i = 0; i < 16; i++) {
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ i
    if (i && i % 4 === 0) out += '-'
    out += A[(h1 >>> 0) % A.length]
  }
  return out
}
function certCurrent(db: DB, c: DemoCert) {
  const items: CertificateItem[] = c.items.map((i) => {
    const r = db.reserved.find((x) => x.id === i.id)
    return { ...i, typeLabel: `${TYPE_AR[i.type] ?? i.type} · ${TYPE_EN[i.type] ?? i.type}`, current: !r ? 'removed' : r.ownerId === c.ownerId ? 'valid' : 'transferred' }
  })
  const held = items.filter((i) => i.current === 'valid').length
  const status: CertificateStatus = c.revokedAt ? 'revoked' : held === items.length ? 'valid' : held === 0 ? 'superseded' : 'partial'
  return { items, status }
}
function certDto(db: DB, c: DemoCert): Certificate {
  const { items, status } = certCurrent(db, c)
  const id = c.nationalId
  return {
    id: c.id, number: c.number, scope: c.scope, ownerId: c.ownerId, ownerNameAr: c.ownerNameAr, ownerNameEn: c.ownerNameEn,
    nationalIdMasked: id ? (id.length <= 4 ? id : '•'.repeat(id.length - 4) + id.slice(-4)) : undefined, nationality: c.nationality,
    issuedAt: c.issuedAt, signature: c.signature, status, revokedAt: c.revokedAt, revokeReason: c.revokeReason, items, itemCount: items.length,
  }
}
/** every name and auction the demo returns carries its Latin spelling, like the API's DTOs */
function withLatin<T>(v: T, depth = 0): T {
  if (!v || typeof v !== 'object' || depth > 3) return v
  if (Array.isArray(v)) return v.map((x) => withLatin(x, depth + 1)) as T
  const o = v as Record<string, unknown>
  if (typeof o.name === 'string' && typeof o.normalized === 'string' && typeof o.acquiredAt === 'string') {
    const r = o as unknown as ReservedName
    return { ...o, latin: latinOf(r), latinOverride: r.latinName ? true : undefined } as T
  }
  if (typeof o.name === 'string' && typeof o.openingPrice === 'number') return { ...o, latin: toLatin(o.name as string) } as T
  let changed = false
  const out: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(o)) { const y = x && typeof x === 'object' ? withLatin(x, depth + 1) : x; if (y !== x) changed = true; out[k] = y }
  return (changed ? out : o) as T
}
function readActivity(): ActivityEntry[] { try { return JSON.parse(localStorage.getItem(ACT_KEY) ?? '[]') } catch { return [] } }
function readActing(): { delegationId: string; actorId: string } | null { try { return JSON.parse(localStorage.getItem(ACTING_KEY) ?? 'null') } catch { return null } }
function writeActing(a: { delegationId: string; actorId: string } | null) { try { if (a) localStorage.setItem(ACTING_KEY, JSON.stringify(a)); else localStorage.removeItem(ACTING_KEY) } catch { /* ignore */ } }

type DemoDelegation = NonNullable<DB['delegations']>[number]
function delegationStatus(d: DemoDelegation): Delegation['status'] {
  const t = now()
  if (d.revokedAt) return 'revoked'
  if (!d.permanent && d.endsAt && t >= Date.parse(d.endsAt)) return 'expired'
  if (t < Date.parse(d.startsAt)) return 'scheduled'
  return d.delegateUserId ? 'active' : 'awaiting_account'
}
const CAP_LABEL: Record<string, string> = { agent: 'وكيل شرعي', family: 'فرد من العائلة', employee: 'موظف أو مدير أعمال', partner: 'شريك', other: 'أخرى' }
function delegationDto(db: DB, d: DemoDelegation): Delegation {
  const { delegateUserId, revokedAt: _r, ...rest } = d
  return { ...rest, ownerName: db.users.find((u) => u.id === d.ownerId)?.fullName ?? '', capacityLabel: CAP_LABEL[d.capacity] ?? d.capacity, status: delegationStatus(d), linked: !!delegateUserId }
}
/** the owner on their own account, never a delegate on it */
function ownerSelf(db: DB): DemoUser {
  if (readActing()) throw new ApiError('إدارة التفويض لصاحب الحساب فقط')
  const u = me(db)
  if (u.role !== 'owner') throw new ApiError('التفويض لحسابات ملاك الإبل')
  return u
}
function describe(args: unknown[]): string {
  const out: string[] = []
  const walk = (k: string, v: unknown, depth: number) => {
    if (v == null || depth > 2 || SECRET.test(k)) return
    if (['string', 'number', 'boolean'].includes(typeof v)) { const s = String(v); if (s) out.push(`${k}: ${s.length > 80 ? s.slice(0, 80) + '…' : s}`) }
    else if (Array.isArray(v)) { const s = v.filter((x) => typeof x !== 'object').slice(0, 6).join('، '); if (s) out.push(`${k}: ${s}`) }
    else if (typeof v === 'object') for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) walk(kk, vv, depth + 1)
  }
  args.forEach((a, i) => walk(['أ', 'ب', 'ج', 'د'][i] ?? String(i), a, 0))
  return out.join(' · ').slice(0, 480)
}
function logActivity(method: string, args: unknown[], ok: boolean, error?: string, result?: unknown, before?: string | null) {
  const meta = ACT[method]
  if (!meta) return
  try {
    const db = load()
    const act = readActing()
    let actor = db.users.find((u) => u.id === (before ?? getSession()))
    if (result && typeof result === 'object' && 'role' in (result as object) && (method === 'completeSignIn' || method === 'signUp' || method === 'actAs' || method === 'stopActing')) actor = db.users.find((u) => u.id === (result as User).id) ?? actor
    let onBehalf: DemoUser | undefined
    if (act && method !== 'actAs' && method !== 'stopActing') { onBehalf = actor; actor = db.users.find((u) => u.id === act.actorId) }
    if (method === 'actAs' && actor) { const real = db.users.find((u) => u.id === readActing()?.actorId); if (real) { onBehalf = actor; actor = real } }
    const ua = navigator.userAgent
    const device = `${ua.includes('Edg/') ? 'Edge' : ua.includes('Chrome/') ? 'Chrome' : ua.includes('Firefox/') ? 'Firefox' : ua.includes('Safari/') ? 'Safari' : ''} ${/iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''}`.trim()
    const login = method === 'startSignIn' && typeof args[0] === 'string' ? `${String(args[0]).slice(0, 3)}•••` : ''
    const list = readActivity()
    list.unshift({
      id: (list[0]?.id ?? 0) + 1, at: iso(now()), actorId: actor?.id, actorName: actor?.fullName ?? login, actorRole: onBehalf ? 'delegate' : actor?.role ?? '',
      onBehalfOfId: onBehalf?.id, onBehalfOfName: onBehalf?.fullName, action: meta[0], category: meta[1], categoryLabel: ACT_CATEGORIES[meta[1]] ?? meta[1],
      details: describe(/signin|otp|verify|password|session|code|challenge/i.test(method) ? [] : args) || undefined, success: ok, error, ip: 'نسخة تجريبية', device,
    })
    localStorage.setItem(ACT_KEY, JSON.stringify(list.slice(0, 1500)))
  } catch { /* the log never breaks the action */ }
}

/** every write is logged; in a delegated session only the granted scopes go through */
export const demoApi: SammhaApi = new Proxy(rawApi, {
  get(target, prop: string) {
    const fn = (target as unknown as Record<string, unknown>)[prop]
    if (typeof fn !== 'function') return fn
    return (...args: unknown[]) => {
      const act = readActing()
      if (act) {
        const db = load()
        const d = db.delegations?.find((x) => x.id === act.delegationId)
        if (!d || delegationStatus(d) !== 'active') {
          writeActing(null); setSession(null)
          const err = new ApiError('انتهى التفويض أو أُلغي، سجّل الدخول بحسابك')
          logActivity(prop, args, false, err.message)
          return Promise.reject(err)
        }
        let deny: string | null = null
        if (HIDDEN.has(prop)) deny = 'هذه البيانات لصاحب الحساب فقط'
        else if (ACT[prop] && !ALWAYS.has(prop)) {
          const scope = SCOPE_OF[prop]
          if (!scope) deny = 'هذا الإجراء لصاحب الحساب فقط'
          else if (!d.scopes.includes(scope)) deny = `التفويض لا يشمل «${SCOPE_LABEL[scope]}»`
        }
        if (deny) { logActivity(prop, args, false, deny); return Promise.reject(new ApiError(deny)) }
      }
      const who = getSession()
      const out = (fn as (...a: unknown[]) => unknown).apply(target, args)
      if (!(out instanceof Promise)) return out
      if (!ACT[prop]) return out.then((r) => withLatin(r))
      return out.then((r) => withLatin(r)).then((r) => { logActivity(prop, args, true, undefined, r, prop === 'signOut' ? who : null); return r }, (e: Error) => { logActivity(prop, args, false, e.message); throw e })
    }
  },
}) as SammhaApi
