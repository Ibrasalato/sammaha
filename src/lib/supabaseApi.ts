/**
 * Production backend: Supabase (Postgres + Auth). All business rules run inside
 * SECURITY DEFINER functions (supabase/migrations/0002_logic.sql) so the browser can
 * never change prices, statuses or wallet balances directly. Each RPC returns JSON in
 * the same camelCase shape as src/lib/types.ts.
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from './api'
import type { SammhaApi } from './api'
import { normalizePhone, validateTicket } from './tickets'
import { maskEmail } from './otp'
import type { User } from './types'

let client: SupabaseClient | null = null
function sb() {
  if (!client) client = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string)
  return client
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb().rpc(fn, args)
  if (error) throw new ApiError(error.message)
  return data as T
}

// A password session only counts once its one-time code was verified (see start/completeSignIn).
const OTP_OK = 'sammha-otp-ok'
const otpOk = (uid: string) => { try { return sessionStorage.getItem(OTP_OK) === uid } catch { return false } }
const setOtpOk = (uid: string | null) => { try { if (uid) sessionStorage.setItem(OTP_OK, uid); else sessionStorage.removeItem(OTP_OK) } catch { /* ignore */ } }

async function rawProfile(): Promise<User | null> {
  const { data } = await sb().auth.getSession()
  if (!data.session) return null
  return rpc<User>('me')
}
async function profile(): Promise<User | null> {
  const u = await rawProfile()
  return u && otpOk(u.id) ? u : null
}

/** Card payments go through Moyasar; the Edge Function `moyasar-webhook` confirms and credits the wallet. */
async function cardPayment(purpose: string, ref: string, amount: number) {
  const { data, error } = await sb().functions.invoke('create-payment', { body: { purpose, ref, amount, callback: location.href } })
  if (error) throw new ApiError(error.message)
  if (data?.url) { location.href = data.url; await new Promise(() => {}) }
}

export const supabaseApi: SammhaApi = {
  currentUser: profile,

  async signUp(input) {
    const { error } = await sb().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { full_name: input.fullName, phone: input.phone, national_id: input.nationalId } },
    })
    if (error) throw new ApiError(error.message)
    const u = await rawProfile()
    if (!u) throw new ApiError('تم إنشاء الحساب، فعّل بريدك الإلكتروني ثم سجّل الدخول')
    setOtpOk(u.id)
    return u
  },

  async startSignIn(login, password, portal) {
    let email = login.trim()
    if (!email.includes('@')) email = await rpc<string>('email_for_phone', { p_phone: email })
    const wrong = new ApiError(portal === 'staff' ? 'البيانات غير صحيحة' : 'رقم الجوال أو كلمة المرور غير صحيحة')
    setOtpOk(null)
    const { error } = await sb().auth.signInWithPassword({ email, password })
    if (error) throw wrong
    const u = await rawProfile()
    // staff sign in only on the staff portal, owners only on the public page; same error either way
    if (!u || (portal === 'staff') !== (u.role !== 'owner')) { await sb().auth.signOut(); throw wrong }
    if (u.active === false) { await sb().auth.signOut(); throw new ApiError('هذا الحساب موقوف، تواصل مع مدير النظام') }
    return rpc('request_otp', { p_purpose: 'login', p_phone: null })
  },

  async completeSignIn(challenge, code) {
    const res = await rpc<{ ok: boolean; error?: string }>('verify_otp', { p_challenge: challenge, p_code: code, p_purpose: 'login' })
    if (!res.ok) throw new ApiError(res.error ?? 'الرمز غير صحيح')
    const u = await rawProfile()
    if (!u) throw new ApiError('تعذّر الدخول')
    setOtpOk(u.id)
    return u
  },

  resendOtp: (challenge) => rpc('resend_otp', { p_challenge: challenge }),

  updateMyAccount: ({ fullName, nationalId }) => rpc('update_my_account', { p_full_name: fullName, p_national_id: nationalId ?? null }),

  // Email change uses Supabase Auth's own one-time code (template "Change Email Address" must include {{ .Token }}).
  async requestEmailChange(newEmail) {
    const mail = newEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new ApiError('البريد الإلكتروني غير صحيح')
    const { error } = await sb().auth.updateUser({ email: mail })
    if (error) throw new ApiError(error.message.includes('already') ? 'البريد الإلكتروني مسجل لحساب آخر' : error.message)
    return { challenge: mail, phoneMasked: maskEmail(mail), expiresAt: new Date(Date.now() + 3600_000).toISOString(), length: 6 }
  },
  async confirmEmailChange(challenge, code) {
    const { error } = await sb().auth.verifyOtp({ email: challenge, token: code, type: 'email_change' })
    if (error) throw new ApiError('الرمز غير صحيح أو انتهت صلاحيته')
    const u = await rawProfile()
    if (!u) throw new ApiError('تعذّر التحقق')
    return u
  },
  requestPhoneChange: (newPhone) => rpc('request_otp', { p_purpose: 'phone', p_phone: newPhone }),
  async confirmPhoneChange(challenge, code) {
    const res = await rpc<{ ok: boolean; error?: string; user?: User }>('change_my_phone', { p_challenge: challenge, p_code: code })
    if (!res.ok || !res.user) throw new ApiError(res.error ?? 'الرمز غير صحيح')
    return res.user
  },

  async changePassword(current, next) {
    if (next.length < 8) throw new ApiError('كلمة المرور الجديدة 8 أحرف على الأقل')
    const { data: { user } } = await sb().auth.getUser()
    const { error: e1 } = await sb().auth.signInWithPassword({ email: user?.email ?? '', password: current })
    if (e1) throw new ApiError('كلمة المرور الحالية غير صحيحة')
    const { error } = await sb().auth.updateUser({ password: next })
    if (error) throw new ApiError(error.message)
  },


  async signOut() { setOtpOk(null); await sb().auth.signOut() },

  stats: () => rpc('public_stats'),
  listAuctions: (f = {}) => rpc('list_auctions', { p_phase: f.phase ?? 'all', p_type: f.type ?? 'all', p_q: f.q ?? '' }),
  getAuction: (id) => rpc('get_auction', { p_id: id }),
  listReservedNames: (q = '', type = 'all') => rpc('list_reserved', { p_q: q, p_type: type }),
  checkNames: (names, type) => rpc('check_names', { p_names: names, p_type: type }),
  listEvents: () => rpc('list_events'),
  verifyCertificate: (code) => rpc('verify_certificate', { p_code: code }),
  // the database validates again and emails through n8n (app_settings.ticket_webhook_url)
  submitTicket: (i) => rpc('submit_ticket', { p_ticket: validateTicket(i) }),
  trackTicket: (number, phone) => rpc('track_ticket', { p_number: number.trim().toUpperCase(), p_phone: normalizePhone(phone) }),
  followUpTicket: (number, phone, body) => rpc('follow_up_ticket', { p_number: number.trim().toUpperCase(), p_phone: normalizePhone(phone), p_body: body }),
  myTickets: () => rpc('my_tickets'),

  myRequests: () => rpc('my_requests'),
  createCompoundRequest: (reservedId, fullName) => rpc('create_compound_request', { p_reserved: reservedId, p_name: fullName }),
  createRequest: (type, names) => rpc('create_request', { p_type: type, p_names: names }),
  async payDeposit(requestId, method) {
    if (method === 'card') await cardPayment('deposit', requestId, 50)
    return rpc('pay_deposit', { p_request: requestId })
  },
  withdrawName: (requestId, candidateId) => rpc('withdraw_name', { p_request: requestId, p_candidate: candidateId }),
  cancelMyRequest: (requestId, reason) => rpc('cancel_my_request', { p_request: requestId, p_reason: reason ?? null }),
  myWallet: () => rpc('my_wallet'),
  async topUp(amount) {
    await cardPayment('topup', '', amount)
    return rpc('my_wallet')
  },
  myInvoices: () => rpc('my_invoices'),
  async payInvoice(id, method) {
    if (method === 'card') await cardPayment('invoice', id, 0)
    return rpc('pay_invoice', { p_invoice: id })
  },
  myBids: () => rpc('my_bids'),
  async updateMyProfile({ avatarUrl, showAvatar }) {
    let url = avatarUrl
    if (avatarUrl && avatarUrl.startsWith('data:')) {
      // upload the resized photo to the public "avatars" bucket, one file per user
      const { data: { user } } = await sb().auth.getUser()
      const blob = await (await fetch(avatarUrl)).blob()
      const path = `${user!.id}.jpg`
      const { error } = await sb().storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw new ApiError(error.message)
      url = `${sb().storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
    }
    return rpc('update_my_profile', { p_avatar_url: url === undefined ? null : url, p_keep: url === undefined, p_show: showAvatar })
  },
  myNotifications: () => rpc('my_notifications'),
  async markNotificationsRead() { await rpc('mark_notifications_read') },
  myNames: () => rpc('my_names'),
  placeBid: (auctionId, amount) => rpc('place_bid', { p_auction: auctionId, p_amount: amount }),
  setAutoBid: (auctionId, max) => rpc('set_autobid', { p_auction: auctionId, p_max: max }),
  cancelAutoBid: (auctionId) => rpc('cancel_autobid', { p_auction: auctionId }),
  toggleWatch: (auctionId) => rpc('toggle_watch', { p_auction: auctionId }),
  myWatchlist: () => rpc('my_watchlist'),
  // Supabase Realtime: the auctions table is in the supabase_realtime publication (migration 0012)
  subscribeAuction(id, onChange) {
    const ch = sb().channel(`auction-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${id}` }, () => onChange())
      .subscribe()
    return () => { sb().removeChannel(ch) }
  },

  overview: () => rpc('admin_overview'),
  listRequests: (status = 'all') => rpc('admin_list_requests', { p_status: status }),
  getRequest: (id) => rpc('get_request', { p_id: id }),
  reviewRequest: (id, decisions, note) => rpc('admin_review_request', { p_id: id, p_decisions: decisions, p_note: note ?? null }),
  rejectRequest: (id, reason) => rpc('admin_reject_request', { p_id: id, p_reason: reason }),
  cancelRequest: (id, reason) => rpc('admin_cancel_request', { p_id: id, p_reason: reason }),
  awaitingSchedule: () => rpc('admin_awaiting_schedule'),
  scheduleAuctions: (candidateIds, startsAt, endsAt) => rpc('admin_schedule_auctions', { p_candidates: candidateIds, p_starts: startsAt, p_ends: endsAt }),
  allInvoices: () => rpc('admin_invoices'),
  markInvoicePaid: (id) => rpc('admin_mark_invoice_paid', { p_invoice: id }),
  listUsers: () => rpc('admin_users'),
  // creating a sign-in needs the service role, so it runs in the Edge Function admin-create-staff
  async createStaff(input) {
    const { data, error } = await sb().functions.invoke('admin-create-staff', { body: input })
    if (error || data?.error) throw new ApiError(data?.error ?? error!.message)
    return data as User
  },
  setUserRole: (id, role) => rpc('admin_set_role', { p_user: id, p_role: role }),
  setUserActive: (id, active) => rpc('admin_set_active', { p_user: id, p_active: active }),
  saveEvent: (e) => rpc('admin_save_event', { p_event: e }),
  async deleteEvent(id) { await rpc('admin_delete_event', { p_id: id }) },
  listTickets: () => rpc('admin_list_tickets'),
  getTicket: (id) => rpc('admin_get_ticket', { p_id: id }),
  updateTicket: (id, patch) => rpc('admin_update_ticket', { p_id: id, p_patch: patch }),
  replyTicket: (id, body, internal) => rpc('admin_reply_ticket', { p_id: id, p_body: body, p_internal: internal }),
}
