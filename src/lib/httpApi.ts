import { ApiError } from './api'
import type { OtpChallenge, PayMethod, SammhaApi } from './api'
import type { Auction, AuctionView, Invoice, LogoRequest, NameListing, User, Wallet } from './types'

/**
 * The production backend: Sammha API (ASP.NET Core + SQL Server, repo Ibrasalato/sammaha-api).
 * Set VITE_API_URL to its address (e.g. https://api.sammha.ico.org.sa).
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined ?? '').replace(/\/$/, '')
const SESSION_KEY = 'sammha-session'

/** JWT session: a 15-minute access token plus a rotating refresh token. */
interface Session { token: string; expiresAt: number; refreshToken: string }
interface AuthResult { user: User; token: string; expiresAt: string; refreshToken: string; refreshExpiresAt: string }

let session: Session | null = (() => {
  try {
    localStorage.removeItem('sammha-token') // the old single-token format
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch { return null }
})()

function saveSession(r: AuthResult | null) {
  session = r ? { token: r.token, expiresAt: Date.parse(r.expiresAt), refreshToken: r.refreshToken } : null
  try { if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

// another tab rotated or ended the session
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => {
  if (e.key !== SESSION_KEY) return
  try { session = e.newValue ? (JSON.parse(e.newValue) as Session) : null } catch { session = null }
})

/** One refresh at a time; concurrent callers share it. A rejected refresh ends the session. */
let refreshing: Promise<boolean> | null = null
function refresh(): Promise<boolean> {
  if (!session) return Promise.resolve(false)
  const used = session.refreshToken
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ refreshToken: used }) })
      if (res.ok) { saveSession(await res.json() as AuthResult); return true }
      // another tab may have rotated it already
      if (session && session.refreshToken !== used) return true
      if (res.status === 401) saveSession(null)
      return false
    } catch { return false } finally { refreshing = null }
  })()
  return refreshing
}

/** A valid access token, renewed shortly before it expires. */
async function accessToken(): Promise<string | null> {
  if (!session) return null
  if (session.expiresAt - Date.now() < 60_000) await refresh()
  return session?.token ?? null
}

async function call<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = await accessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم، تحقق من الإنترنت وحاول مرة أخرى')
  }
  // the access token was rejected early (clock skew, password changed elsewhere): renew once and retry
  if (res.status === 401 && token && !retried && await refresh()) return call<T>(method, path, body, true)
  if (res.status === 204) return null as T
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(data?.message || 'حدث خطأ، حاول مرة أخرى')
  return data as T
}
const get = <T,>(p: string) => call<T>('GET', p)
const post = <T,>(p: string, b: unknown = {}) => call<T>('POST', p, b)
const put = <T,>(p: string, b: unknown) => call<T>('PUT', p, b)
const qs = (o: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== 'all') as [string, string][]).toString()
  return s ? `?${s}` : ''
}

/** Card: Moyasar's hosted page (the webhook completes the action), or an immediate simulated charge in development. */
async function card(purpose: 'topup' | 'deposit' | 'invoice' | 'bid_deposit' | 'listing', ref: string | null, amount = 0) {
  const r = await post<{ url?: string; simulated: boolean }>('/api/payments/card', { purpose, ref, amount, callback: location.href })
  if (r.url) { location.href = r.url; await new Promise(() => {}) }
}

export const httpApi: SammhaApi = {
  // ───── auth ─────
  currentUser: async () => (session ? get<User | null>('/api/auth/me').catch(() => null) : null),
  async signUp(input) {
    const r = await post<AuthResult>('/api/auth/signup', input)
    saveSession(r)
    return r.user
  },
  startSignIn: (login, password, portal) => post<OtpChallenge>('/api/auth/signin', { login, password, portal }),
  async completeSignIn(challenge, code) {
    const r = await post<AuthResult>('/api/auth/signin/complete', { challenge, code })
    saveSession(r)
    return r.user
  },
  resendOtp: (challenge) => post('/api/auth/otp/resend', { challenge }),
  // other devices are signed out; this one gets a fresh session
  changePassword: async (current, next) => { saveSession(await post<AuthResult>('/api/auth/password', { current, next })) },
  async signOut() {
    const s = session
    saveSession(null)
    if (s) await fetch(`${BASE}/api/auth/signout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` }, body: JSON.stringify({ refreshToken: s.refreshToken }) }).catch(() => {})
  },

  // ───── public ─────
  stats: () => get('/api/stats'),
  listAuctions: (f = {}) => get(`/api/auctions${qs({ phase: f.phase, type: f.type, q: f.q })}`),
  getAuction: (id) => get(`/api/auctions/${id}`),
  subscribeAuction(id, onChange) {
    let stop = () => {}
    let closed = false
    import('@microsoft/signalr').then(({ HubConnectionBuilder, LogLevel }) => {
      if (closed) return
      const conn = new HubConnectionBuilder().withUrl(`${BASE}/hubs/auctions`, { accessTokenFactory: async () => (await accessToken()) ?? '' }).withAutomaticReconnect().configureLogging(LogLevel.Warning).build()
      conn.on('changed', () => onChange())
      conn.onreconnected(() => { conn.invoke('Join', id).catch(() => {}) })
      conn.start().then(() => conn.invoke('Join', id)).catch(() => { /* the page also polls */ })
      stop = () => { conn.stop().catch(() => {}) }
    }).catch(() => {})
    return () => { closed = true; stop() }
  },
  listReservedNames: (q, type) => get(`/api/names${qs({ q, type })}`),
  checkNames: (names, type) => post('/api/names/check', { names, type }),
  listEvents: () => get('/api/events'),
  verifyCertificate: (code) => get(`/api/certificates/${encodeURIComponent(code.trim())}`),
  submitTicket: (input) => post('/api/tickets', input),
  trackTicket: (number, phone) => post('/api/tickets/track', { number, phone }),
  followUpTicket: (number, phone, body) => post('/api/tickets/follow-up', { number, phone, body }),

  // ───── owner ─────
  myRequests: () => get('/api/me/requests'),
  createRequest: (type, names) => post('/api/me/requests', { type, names }),
  createCompoundRequest: (reservedId, fullName) => post('/api/me/requests/compound', { reservedId, fullName }),
  createInvestmentRequest: (type, names) => post('/api/me/requests/investment', { type, names }),
  myInvestments: () => get('/api/me/investments'),
  async payDeposit(requestId, method: PayMethod) {
    if (method === 'card') await card('deposit', requestId)
    return post<LogoRequest>(`/api/me/requests/${requestId}/pay`)
  },
  cancelMyRequest: (requestId, reason) => post(`/api/me/requests/${requestId}/cancel`, { reason: reason ?? null }),
  withdrawName: (requestId, candidateId) => post(`/api/me/requests/${requestId}/withdraw`, { candidateId }),
  myWallet: () => get('/api/me/wallet'),
  async topUp(amount) {
    await card('topup', null, amount)
    return get<Wallet>('/api/me/wallet')
  },
  myInvoices: () => get('/api/me/invoices'),
  async payInvoice(id, method) {
    if (method === 'card') await card('invoice', id)
    return post<Invoice>(`/api/me/invoices/${id}/pay`)
  },
  myBids: () => get('/api/me/bids'),
  myNames: () => get('/api/me/names'),
  createListing: (reservedId, mode, price) => post('/api/me/listings', { reservedId, mode, price }),
  cancelListing: (id) => post(`/api/me/listings/${id}/cancel`),
  myListings: () => get('/api/me/listings'),
  marketListings: () => get('/api/market'),
  async buyListing(id, method) {
    if (method === 'card') await card('listing', id)
    return post<NameListing>(`/api/market/${id}/buy`)
  },
  async payBidDeposit(auctionId, method) {
    if (method === 'card') await card('bid_deposit', auctionId)
    return post<AuctionView>(`/api/auctions/${auctionId}/deposit`)
  },
  updateMyProfile: ({ avatarUrl, showAvatar }) => put('/api/me/profile', { avatarUrl: avatarUrl ?? null, avatarSet: avatarUrl !== undefined, showAvatar }),
  updateMyAccount: ({ fullName, nationalId }) => put('/api/me/account', { fullName, nationalId: nationalId ?? null }),
  requestEmailChange: (email) => post('/api/me/email', { email }),
  confirmEmailChange: (challenge, code) => post('/api/me/email/confirm', { challenge, code }),
  requestPhoneChange: (phone) => post('/api/me/phone', { phone }),
  confirmPhoneChange: (challenge, code) => post('/api/me/phone/confirm', { challenge, code }),
  myNotifications: () => get('/api/me/notifications'),
  markNotificationsRead: async () => { await post('/api/me/notifications/read') },
  myTickets: () => get('/api/me/tickets'),
  placeBid: (auctionId, amount) => post(`/api/auctions/${auctionId}/bids`, { amount }),
  setAutoBid: (auctionId, max) => put(`/api/auctions/${auctionId}/autobid`, { max }),
  cancelAutoBid: (auctionId) => call('DELETE', `/api/auctions/${auctionId}/autobid`),
  toggleWatch: async (auctionId) => (await post<{ watching: boolean }>(`/api/auctions/${auctionId}/watch`)).watching,
  myWatchlist: () => get<Auction[]>('/api/me/watchlist'),

  // ───── committee ─────
  overview: () => get('/api/admin/overview'),
  listRequests: (status = 'all') => get(`/api/admin/requests${qs({ status })}`),
  getRequest: (id) => get(`/api/requests/${id}`),
  reviewRequest: (id, decisions, note) => post(`/api/admin/requests/${id}/review`, { decisions, note: note ?? null }),
  rejectRequest: (id, reason) => post(`/api/admin/requests/${id}/reject`, { reason }),
  cancelRequest: (id, reason) => post(`/api/admin/requests/${id}/cancel`, { reason }),
  awaitingSchedule: () => get('/api/admin/schedule'),
  scheduleAuctions: (candidateIds, startsAt, endsAt) => post('/api/admin/schedule', { candidateIds, startsAt, endsAt }),
  allInvoices: () => get('/api/admin/invoices'),
  markInvoicePaid: (id) => post(`/api/admin/invoices/${id}/paid`),
  listUsers: () => get('/api/admin/users'),
  createStaff: (input) => post<User>('/api/admin/users', input),
  setUserRole: (id, role) => put(`/api/admin/users/${id}/role`, { role }),
  setUserActive: (id, active) => put(`/api/admin/users/${id}/active`, { active }),
  saveEvent: (e) => put('/api/admin/events', e),
  deleteEvent: async (id) => { await call('DELETE', `/api/admin/events/${encodeURIComponent(id)}`) },
  listTickets: () => get('/api/admin/tickets'),
  getTicket: (id) => get(`/api/admin/tickets/${id}`),
  updateTicket: (id, patch) => call('PATCH', `/api/admin/tickets/${id}`, patch),
  replyTicket: (id, body, internal) => post(`/api/admin/tickets/${id}/reply`, { body, internal }),
}
