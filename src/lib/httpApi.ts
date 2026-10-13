import { ApiError } from './api'
import type { OtpChallenge, PayMethod, SammhaApi } from './api'
import type { Auction, AuctionView, Invoice, LogoRequest, NameListing, User, Wallet } from './types'

/**
 * The production backend: Sammha API (ASP.NET Core + SQL Server, repo Ibrasalato/sammaha-api).
 * Set VITE_API_URL to its address (e.g. https://api.sammha.ico.org.sa).
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'sammha-token'

function getToken() { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
function setToken(t: string | null) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم، تحقق من الإنترنت وحاول مرة أخرى')
  }
  if (res.status === 401 && token) setToken(null) // expired or suspended
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
  currentUser: async () => (getToken() ? get<User | null>('/api/auth/me').catch(() => null) : null),
  async signUp(input) {
    const r = await post<{ user: User; token: string }>('/api/auth/signup', input)
    setToken(r.token)
    return r.user
  },
  startSignIn: (login, password, portal) => post<OtpChallenge>('/api/auth/signin', { login, password, portal }),
  async completeSignIn(challenge, code) {
    const r = await post<{ user: User; token: string }>('/api/auth/signin/complete', { challenge, code })
    setToken(r.token)
    return r.user
  },
  resendOtp: (challenge) => post('/api/auth/otp/resend', { challenge }),
  changePassword: async (current, next) => { await post('/api/auth/password', { current, next }) },
  signOut: async () => { setToken(null) },

  // ───── public ─────
  stats: () => get('/api/stats'),
  listAuctions: (f = {}) => get(`/api/auctions${qs({ phase: f.phase, type: f.type, q: f.q })}`),
  getAuction: (id) => get(`/api/auctions/${id}`),
  subscribeAuction(id, onChange) {
    let stop = () => {}
    let closed = false
    import('@microsoft/signalr').then(({ HubConnectionBuilder, LogLevel }) => {
      if (closed) return
      const conn = new HubConnectionBuilder().withUrl(`${BASE}/hubs/auctions`).withAutomaticReconnect().configureLogging(LogLevel.Warning).build()
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
