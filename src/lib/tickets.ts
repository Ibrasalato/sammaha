import { ApiError } from './api'
import { getLang } from './i18n'
import type { Ticket, TicketInput, TicketKind, TicketPriority, TicketStatus } from './types'

const ar = () => getLang() === 'ar'

export const TICKET_KINDS: TicketKind[] = ['complaint', 'report', 'inquiry', 'suggestion']

export const KIND_LABEL: Record<TicketKind, { ar: string; en: string; hintAr: string; hintEn: string }> = {
  complaint: { ar: 'شكوى', en: 'Complaint', hintAr: 'على خدمة أو قرار أو تعامل لم يرضك', hintEn: 'About a service, decision or experience' },
  report: { ar: 'بلاغ', en: 'Report', hintAr: 'عن مخالفة أو استخدام اسم بغير حق أو احتيال', hintEn: 'Misuse of a name, a violation or fraud' },
  inquiry: { ar: 'استفسار', en: 'Enquiry', hintAr: 'سؤال عن الطلبات أو المزادات أو الفواتير', hintEn: 'A question about requests, auctions or invoices' },
  suggestion: { ar: 'اقتراح', en: 'Suggestion', hintAr: 'فكرة لتحسين المنصة', hintEn: 'An idea to improve the platform' },
}
export const kindLabel = (k: TicketKind) => (ar() ? KIND_LABEL[k].ar : KIND_LABEL[k].en)

export const STATUS_LABEL: Record<TicketStatus, [string, string]> = {
  new: ['جديد', 'New'],
  in_progress: ['قيد المعالجة', 'In progress'],
  answered: ['تم الرد', 'Answered'],
  closed: ['مغلق', 'Closed'],
}
export const statusLabel = (s: TicketStatus) => STATUS_LABEL[s][ar() ? 0 : 1]
export const STATUS_TONE: Record<TicketStatus, string> = {
  new: 'bg-gold-soft text-gold-deep',
  in_progress: 'bg-info-soft text-info-deep',
  answered: 'bg-[#E2F0E8] text-ok',
  closed: 'bg-stone-deep text-muted',
}
export const PRIORITY_LABEL: Record<TicketPriority, string> = { normal: 'عادي', urgent: 'عاجل' }

export const TOPICS: [string, string][] = [
  ['طلبات الشعارات', 'Logo requests'],
  ['المزادات والمزايدة', 'Auctions and bidding'],
  ['الفواتير والدفع', 'Invoices and payment'],
  ['استرداد الضمان', 'Guarantee refund'],
  ['الشهادات والتحقق', 'Certificates'],
  ['الحساب وتسجيل الدخول', 'Account and sign-in'],
  ['استخدام اسم بغير حق', 'Unauthorised use of a name'],
  ['أخرى', 'Other'],
]

/** Saudi mobile in a canonical 05XXXXXXXX form, so tracking works however it was typed. */
export function normalizePhone(p: string) {
  const d = p.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g, '')
  if (d.startsWith('9665') && d.length === 12) return `0${d.slice(3)}`
  if (d.startsWith('5') && d.length === 9) return `0${d}`
  return d
}

export function validateTicket(i: TicketInput): TicketInput {
  const clean = {
    kind: i.kind,
    topic: i.topic.trim().slice(0, 60),
    subject: i.subject.trim().slice(0, 120),
    name: i.name.trim().slice(0, 80),
    phone: normalizePhone(i.phone),
    email: i.email?.trim().slice(0, 120) || undefined,
    refNumber: i.refNumber?.trim().slice(0, 40) || undefined,
    message: i.message.trim().slice(0, 3000),
  }
  if (!TICKET_KINDS.includes(clean.kind)) throw new ApiError('اختر نوع الطلب')
  if (clean.name.length < 2) throw new ApiError('اكتب الاسم')
  if (!/^05\d{8}$/.test(clean.phone)) throw new ApiError('اكتب رقم جوال سعودي صحيح يبدأ بـ 05')
  if (clean.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(clean.email)) throw new ApiError('البريد الإلكتروني غير صحيح')
  if (clean.subject.length < 3) throw new ApiError('اكتب عنوانًا مختصرًا')
  if (clean.message.length < 10) throw new ApiError('اكتب التفاصيل (10 أحرف على الأقل)')
  return clean
}

/** Public view: never expose staff-only notes or the assignee to the customer. */
export function publicTicket(t: Ticket): Ticket {
  return { ...t, assignee: undefined, messages: t.messages.filter((m) => !m.internal) }
}

const WEBHOOK = (import.meta.env.VITE_TICKET_WEBHOOK_URL as string | undefined) ?? 'https://ibrasalato.app.n8n.cloud/webhook/sammha-tickets'

/**
 * Email fan-out through n8n ("Sammha 6 — Tickets Email"). In production the database calls the same
 * webhook (app_settings.ticket_webhook_url), so the browser only does this in demo mode.
 * Fire-and-forget: a failed email never blocks the ticket.
 */
export function emailTicketEvent(event: 'created' | 'reply' | 'status', t: Ticket, reply?: string) {
  if (!WEBHOOK) return
  const base = `${location.origin}${location.pathname}`
  const body = {
    event,
    ticket: {
      number: t.number, kind: t.kind, kindLabel: KIND_LABEL[t.kind].ar, topic: t.topic, subject: t.subject,
      name: t.name, phone: t.phone, email: t.email ?? '', message: t.message, refNumber: t.refNumber ?? '',
      status: t.status, statusLabel: STATUS_LABEL[t.status][0], trackUrl: `${base}#/contact/track/${t.number}`,
    },
    reply: reply ?? '',
  }
  try {
    fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {})
  } catch { /* ignore */ }
}
