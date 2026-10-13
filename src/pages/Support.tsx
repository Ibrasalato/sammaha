import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/dash'
import type { IconName } from '../components/dash'
import { TicketProgress, TicketStatusPill, TicketThread } from '../components/TicketThread'
import { ErrorBox } from '../components/ui'
import { SELLER } from '../lib/config'
import { date } from '../lib/format'
import { getLang, tr } from '../lib/i18n'
import { api, useApp } from '../lib/store'
import { KIND_LABEL, TICKET_KINDS, TOPICS, kindLabel } from '../lib/tickets'
import type { Ticket, TicketInput, TicketKind } from '../lib/types'
import { PageBand } from './Content'

const KIND_ICON: Record<TicketKind, IconName> = { complaint: 'alert', report: 'shield', inquiry: 'file', suggestion: 'plus' }

function CopyNumber({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1800) }).catch(() => {}) }}>
      {done ? tr('تم النسخ', 'Copied') : tr('نسخ الرقم', 'Copy number')}
    </button>
  )
}

export function Contact() {
  const { user } = useApp()
  const en = getLang() === 'en'
  const blank = (): TicketInput => ({ kind: 'inquiry', topic: TOPICS[0][0], subject: '', name: user?.fullName ?? '', phone: user?.phone ?? '', email: user?.email ?? '', refNumber: '', message: '' })
  const [f, setF] = useState<TicketInput>(blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<Ticket | null>(null)
  const set = (k: keyof TicketInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { setDone(await api.submitTicket(f)); window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <PageBand title={tr('تواصل معنا', 'Contact us')} sub={tr('قدّم شكوى أو بلاغًا أو استفسارًا، واحصل فورًا على رقم متابعة تتابع به طلبك حتى يُغلق.', 'File a complaint, report or enquiry and get a tracking number straight away.')} />
      <div className="wrap grid gap-6 py-12 lg:grid-cols-[1.55fr_1fr]">
        {done ? (
          <section className="panel p-6 text-center sm:p-10" aria-live="polite">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E2F0E8] text-ok"><Icon name="check" className="h-7 w-7" /></span>
            <h2 className="mt-4 text-[24px]">{tr(`استلمنا ${kindLabel(done.kind)}ك`, `We received your ${kindLabel(done.kind).toLowerCase()}`)}</h2>
            <p className="mt-1 text-muted">{tr('احتفظ برقم المتابعة، ستحتاجه مع رقم جوالك لمتابعة الطلب.', 'Keep this number. You will need it with your mobile number to track the request.')}</p>
            <div className="mx-auto mt-6 max-w-xs rounded-xl border-2 border-dashed border-gold/60 bg-gold-soft/40 px-6 py-5">
              <div className="text-[13px] font-medium text-muted">{tr('رقم المتابعة', 'Tracking number')}</div>
              <div className="num mt-1 text-[34px] font-extrabold tracking-wide text-pine" dir="ltr">{done.number}</div>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <CopyNumber value={done.number} />
              <Link to={`/contact/track/${done.number}`} className="btn-primary btn-sm">{tr('متابعة الطلب', 'Track request')}</Link>
              <button className="btn-ghost btn-sm" onClick={() => { setDone(null); setF(blank()) }}>{tr('طلب جديد', 'New request')}</button>
            </div>
            <p className="mt-6 text-[14px] text-muted">
              {done.email ? tr(`أرسلنا تأكيدًا إلى ${done.email}، وسنبلغك بالبريد عند الرد.`, `A confirmation is on its way to ${done.email}.`) : tr('أضف بريدك في الطلبات القادمة لتصلك التحديثات بالبريد.', 'Add your email next time to get updates by email.')}
            </p>
          </section>
        ) : (
          <form onSubmit={submit} className="panel space-y-5 p-6 sm:p-8" noValidate>
            <fieldset>
              <legend className="label text-[15px]">{tr('نوع الطلب', 'Request type')}</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TICKET_KINDS.map((k) => (
                  <label key={k} className={`flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition-colors ${f.kind === k ? 'border-pine bg-pine-soft' : 'border-line hover:border-pine/40'}`}>
                    <input type="radio" name="kind" value={k} checked={f.kind === k} onChange={() => setF({ ...f, kind: k })} className="sr-only" />
                    <span className={`flex items-center gap-2 font-extrabold ${f.kind === k ? 'text-pine' : ''}`}><Icon name={KIND_ICON[k]} className="h-[18px] w-[18px]" />{kindLabel(k)}</span>
                    <span className="text-[12.5px] leading-5 text-muted">{en ? KIND_LABEL[k].hintEn : KIND_LABEL[k].hintAr}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="tn">{tr('الاسم', 'Name')}</label><input id="tn" className="field" value={f.name} onChange={set('name')} required autoComplete="name" /></div>
              <div><label className="label" htmlFor="tp">{tr('رقم الجوال', 'Mobile')}</label><input id="tp" className="field" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" value={f.phone} onChange={set('phone')} required autoComplete="tel" /></div>
              <div><label className="label" htmlFor="te">{tr('البريد الإلكتروني', 'Email')} <span className="font-normal text-muted">{tr('(اختياري، لتصلك التحديثات)', '(optional, for updates)')}</span></label><input id="te" type="email" className="field" dir="ltr" value={f.email} onChange={set('email')} autoComplete="email" /></div>
              <div><label className="label" htmlFor="tt">{tr('الموضوع', 'Topic')}</label>
                <select id="tt" className="field" value={f.topic} onChange={set('topic')}>
                  {TOPICS.map(([a, b]) => <option key={a} value={a}>{en ? b : a}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
              <div><label className="label" htmlFor="ts">{tr('العنوان', 'Subject')}</label><input id="ts" className="field" maxLength={120} value={f.subject} onChange={set('subject')} required /></div>
              <div><label className="label" htmlFor="tr">{tr('رقم مرجعي', 'Reference')} <span className="font-normal text-muted">{tr('(اختياري)', '(optional)')}</span></label><input id="tr" className="field" dir="ltr" placeholder="SM-1001" value={f.refNumber} onChange={set('refNumber')} /></div>
            </div>
            <div>
              <label className="label" htmlFor="tm">{tr('التفاصيل', 'Details')}</label>
              <textarea id="tm" className="field" rows={6} maxLength={3000} value={f.message} onChange={set('message')} required
                placeholder={tr('اكتب ما حدث بالتفصيل: الاسم أو رقم الطلب أو المزاد، والتاريخ، وما تتوقعه منا.', 'Describe what happened: name, request or auction number, date, and what you expect from us.')} />
              <p className="hint">{tr('رقم الطلب أو المزاد أو الفاتورة يسرّع المعالجة.', 'A request, auction or invoice number speeds things up.')}</p>
            </div>
            {err && <ErrorBox text={err} />}
            <div className="flex flex-wrap items-center gap-4">
              <button className="btn-primary min-w-40" disabled={busy}>{busy ? tr('جارٍ الإرسال…', 'Sending…') : tr(`إرسال ${kindLabel(f.kind)}`, `Send ${kindLabel(f.kind).toLowerCase()}`)}</button>
              <p className="text-[13px] text-muted">{tr('بإرسال الطلب توافق على ', 'By sending you accept the ')}<Link to="/privacy" className="underline">{tr('سياسة الخصوصية', 'privacy policy')}</Link>.</p>
            </div>
          </form>
        )}

        <aside className="space-y-4">
          <Link to="/contact/track" className="panel group flex items-center gap-4 p-5 hover:border-pine">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-pine text-paper"><Icon name="clock" /></span>
            <span className="flex-1"><b className="block text-[17px]">{tr('تابع طلبًا سابقًا', 'Track a request')}</b><span className="text-[14px] text-muted">{tr('برقم المتابعة ورقم الجوال', 'With the tracking and mobile numbers')}</span></span>
            <Icon name="arrow" className="h-5 w-5 text-gold-deep rtl:rotate-180" />
          </Link>
          <div className="panel divide-y divide-line/70">
            {([
              [tr('البريد الإلكتروني', 'Email'), SELLER.email, `mailto:${SELLER.email}`],
              [tr('واتساب', 'WhatsApp'), SELLER.whatsapp.replace(/^966/, '0'), `https://wa.me/${SELLER.whatsapp}`],
              ['X', '@samha_ico', SELLER.x],
              [tr('العنوان', 'Address'), tr(SELLER.address, 'Riyadh, Saudi Arabia'), ''],
            ] as [string, string, string][]).map(([l, v, href]) => (
              <div key={l} className="px-5 py-4">
                <div className="text-[13px] font-medium text-muted">{l}</div>
                {href ? <a href={href} target="_blank" rel="noreferrer" className="text-[17px] font-extrabold text-pine hover:text-gold-deep" dir="auto">{v}</a> : <div className="text-[17px] font-extrabold">{v}</div>}
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-gold/40 bg-gold-soft/50 p-5 text-[14.5px] leading-7">
            <b className="block text-ink">{tr('مواعيد الرد', 'Response times')}</b>
            {tr('من الأحد إلى الخميس، 8 صباحًا حتى 4 مساءً بتوقيت الرياض. البلاغات العاجلة عن استخدام اسم بغير حق تُعالج أولًا.', 'Sunday to Thursday, 8am to 4pm Riyadh time. Urgent reports about misuse of a name are handled first.')}
          </div>
        </aside>
      </div>
    </>
  )
}

export function TrackTicket() {
  const { number: param } = useParams()
  const { user } = useApp()
  const [number, setNumber] = useState(param ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [t, setT] = useState<Ticket | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')

  async function find(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await api.trackTicket(number, phone)
      setT(r)
      if (!r) setErr(tr('لم نجد طلبًا بهذا الرقم ورقم الجوال. تأكد من البيانات.', 'No request matches this number and mobile.'))
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  // signed-in owners arriving from a link see their ticket straight away
  useEffect(() => { if (param && user?.phone) find() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [param, user?.phone])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!t) return
    setBusy(true); setErr('')
    try { setT(await api.followUpTicket(t.number, phone, reply)); setReply('') } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <PageBand title={tr('متابعة طلب', 'Track a request')} sub={tr('اكتب رقم المتابعة ورقم الجوال الذي قدّمت به الطلب.', 'Enter the tracking number and the mobile number you used.')} />
      <div className="wrap max-w-3xl space-y-6 py-12">
        <form onSubmit={find} className="panel grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div><label className="label" htmlFor="kn">{tr('رقم المتابعة', 'Tracking number')}</label><input id="kn" className="field num" dir="ltr" placeholder="BL-260001" value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
          <div><label className="label" htmlFor="kp">{tr('رقم الجوال', 'Mobile')}</label><input id="kp" className="field" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
          <button className="btn-primary" disabled={busy}>{tr('بحث', 'Search')}</button>
        </form>
        {err && <ErrorBox text={err} />}
        {t && (
          <section className="panel overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted"><span className="num font-bold text-ink" dir="ltr">{t.number}</span><span>·</span><span>{kindLabel(t.kind)}</span><span>·</span><span>{date(t.createdAt)}</span></div>
                <h2 className="mt-1 text-[21px]">{t.subject}</h2>
              </div>
              <TicketStatusPill status={t.status} />
            </header>
            <div className="border-b border-line px-6 py-4"><TicketProgress status={t.status} /></div>
            <div className="p-6"><TicketThread t={t} /></div>
            {t.status !== 'closed' ? (
              <form onSubmit={send} className="space-y-3 border-t border-line bg-stone/60 p-6">
                <label className="label" htmlFor="kr">{tr('إضافة رد أو معلومة', 'Add a reply or detail')}</label>
                <textarea id="kr" className="field" rows={3} maxLength={3000} value={reply} onChange={(e) => setReply(e.target.value)} required />
                <button className="btn-primary btn-sm" disabled={busy || reply.trim().length < 2}>{tr('إرسال', 'Send')}</button>
              </form>
            ) : <p className="border-t border-line bg-stone/60 px-6 py-4 text-[14px] text-muted">{tr('أُغلق هذا الطلب. لأي موضوع جديد ', 'This request is closed. For anything new, ')}<Link to="/contact" className="font-bold text-pine underline">{tr('قدّم طلبًا جديدًا', 'file a new one')}</Link>.</p>}
          </section>
        )}
      </div>
    </>
  )
}
