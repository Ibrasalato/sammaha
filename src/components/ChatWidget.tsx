import { Fragment, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getLang, tr, useLang } from '../lib/i18n'
import { useApp } from '../lib/store'

/** n8n workflow "Sammha 5 — Website Chat" (Claude agent with the platform facts, public FAQ and public records). */
const CHAT_URL = (import.meta.env.VITE_CHAT_WEBHOOK_URL as string | undefined) ?? 'https://ibrasalato.app.n8n.cloud/webhook/sammha-web-chat'
const SID_KEY = 'sammha-chat-sid'
const LOG_KEY = 'sammha-chat-log'

interface Msg { from: 'me' | 'bot'; text: string; error?: boolean }

function sessionId() {
  try {
    let s = localStorage.getItem(SID_KEY)
    if (!s) { s = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem(SID_KEY, s) }
    return s
  } catch { return `w${Date.now().toString(36)}` }
}
function loadLog(): Msg[] {
  try { return JSON.parse(sessionStorage.getItem(LOG_KEY) || '[]') as Msg[] } catch { return [] }
}
function saveLog(m: Msg[]) {
  try { sessionStorage.setItem(LOG_KEY, JSON.stringify(m.slice(-40))) } catch { /* ignore */ }
}

/** Inline formatting the agent is allowed to use: **bold**, site links (/#/page) and https links. */
function inline(text: string, onNav: () => void): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\(?(\/#\/[A-Za-z0-9/_-]*)\)?|(https:\/\/[^\s)]+)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<b key={k++}>{m[1]}</b>)
    else if (m[2]) {
      const to = m[2].slice(2) || '/'
      // "صفحة المزادات (/#/auctions)" → drop the repeated name before the link
      const prev = out[out.length - 1]
      const name = pageName(to)
      if (typeof prev === 'string' && prev.trimEnd().endsWith(name)) out[out.length - 1] = prev.trimEnd().slice(0, -name.length)
      out.push(<Link key={k++} to={to} onClick={onNav} className="font-bold text-gold-deep underline underline-offset-2">{name}</Link>)
    } else if (m[3]) out.push(<a key={k++} href={m[3]} target="_blank" rel="noreferrer" className="font-bold text-gold-deep underline" dir="ltr">{m[3].replace(/^https:\/\//, '')}</a>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const PAGES: Record<string, [string, string]> = {
  '/auctions': ['المزادات', 'Auctions'], '/events': ['المواعيد والمهرجانات', 'Events'], '/names': ['سجل الأسماء', 'Name registry'],
  '/verify': ['التحقق من شهادة', 'Verify a certificate'], '/faq': ['الأسئلة الشائعة', 'FAQ'], '/contact': ['تواصل معنا', 'Contact us'],
  '/contact/track': ['متابعة طلب', 'Track a request'], '/signup': ['إنشاء حساب', 'Sign up'], '/login': ['تسجيل الدخول', 'Sign in'],
  '/dashboard/requests/new': ['طلب شعار جديد', 'New logo request'], '/dashboard': ['لوحة التحكم', 'Dashboard'], '/terms': ['الشروط والأحكام', 'Terms'],
  '/about': ['عن المنصة', 'About'], '/': ['الرئيسية', 'Home'],
}
function pageName(to: string) {
  const p = PAGES[to.replace(/\/$/, '') || '/']
  return p ? p[getLang() === 'ar' ? 0 : 1] : to
}

function Rich({ text, onNav }: { text: string; onNav: () => void }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) blocks.push(<ul key={`u${blocks.length}`} className="my-1 list-disc space-y-0.5 ps-5">{list.map((l, i) => <li key={i}>{inline(l, onNav)}</li>)}</ul>)
    list = []
  }
  for (const raw of lines) {
    const l = raw.trim()
    if (/^[-•*]\s+/.test(l)) { list.push(l.replace(/^[-•*]\s+/, '')); continue }
    flush()
    if (l) blocks.push(<p key={`p${blocks.length}`} className="my-1">{inline(l.replace(/^#+\s*/, ''), onNav)}</p>)
  }
  flush()
  return <>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>
}

const SUGGEST: [string, string][] = [
  ['كيف أطلب شعار لإبلي؟', 'How do I request a name?'],
  ['كم ضمان المزاد ومتى يرجع؟', 'How does the guarantee work?'],
  ['كيف تعمل المزايدة؟', 'How does bidding work?'],
  ['متى مهرجانات الإبل القادمة؟', 'When are the next festivals?'],
]

export function ChatWidget() {
  const { user } = useApp()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<Msg[]>(loadLog)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const { lang } = useLang()
  const ar = lang === 'ar'

  useEffect(() => { saveLog(log); end.current?.scrollIntoView({ block: 'end' }) }, [log, open, busy])
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50) }, [open])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  // keep printed certificates and invoices clean
  if (/\/(certificate|invoices\/)/.test(loc.pathname)) return null

  async function ask(q: string) {
    const message = q.trim().slice(0, 1000)
    if (!message || busy) return
    setText('')
    setLog((l) => [...l, { from: 'me', text: message }])
    setBusy(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 60_000)
    try {
      const res = await fetch(CHAT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ message, sessionId: sessionId(), lang: getLang(), page: loc.pathname, userName: user?.fullName ?? '' }),
      })
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: boolean }
      if (!data.reply) throw new Error('empty')
      setLog((l) => [...l, { from: 'bot', text: data.reply!, error: data.error }])
    } catch {
      setLog((l) => [...l, { from: 'bot', error: true, text: tr('ما قدرت أوصل للمساعد الحين. جرّب بعد شوي، أو تواصل معنا من صفحة (/#/contact).', 'I could not reach the assistant right now. Try again shortly, or use (/#/contact).') }])
    } finally { clearTimeout(timer); setBusy(false) }
  }

  function submit(e: FormEvent) { e.preventDefault(); ask(text) }
  // inside dashboards the button shrinks to an icon so it never covers form controls
  const compact = /^\/(admin|dashboard)/.test(loc.pathname) || /^\/auctions\/[^/]+$/.test(loc.pathname)
  // on phones, stay above the dashboard tab bar and the auction bid bar
  const raised = compact || /^\/auctions\/[^/]+$/.test(loc.pathname)
  const closeOnMobile = () => { if (window.innerWidth < 640) setOpen(false) }

  return (
    <div className="print:hidden">
      {open && (
        <section role="dialog" aria-label={tr('مساعد سمّها', 'Sammha assistant')}
          className={`fixed inset-x-3 z-50 flex ${raised ? 'bottom-40 max-h-[min(640px,calc(100dvh-12rem))] lg:bottom-20 lg:max-h-[min(640px,calc(100dvh-7rem))]' : 'bottom-20 max-h-[min(640px,calc(100dvh-7rem))]'} flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_20px_60px_-15px_rgba(15,59,36,.45)] sm:inset-x-auto sm:end-5 sm:w-[390px]`}>
          <header className="relative flex items-center gap-3 bg-pine px-4 py-3.5 text-paper">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper/10 ring-1 ring-gold/50">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.9l.9-5.4L4.2 8.7l5.4-.8z" className="text-gold-light" stroke="#E2C27E" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-extrabold text-paper">{tr('مساعد سمّها', 'Sammha assistant')}</h2>
              <p className="flex items-center gap-1.5 text-[12.5px] text-paper/70"><span className="h-2 w-2 rounded-full bg-[#4ADE80]" />{tr('يرد فورًا على أسئلتك', 'Answers instantly')}</p>
            </div>
            {log.length > 0 && <button onClick={() => setLog([])} className="rounded-md px-2 py-1 text-[12.5px] text-paper/70 hover:bg-paper/10 hover:text-paper">{tr('محادثة جديدة', 'New chat')}</button>}
            <button onClick={() => setOpen(false)} aria-label={tr('إغلاق', 'Close')} className="grid h-8 w-8 place-items-center rounded-md hover:bg-paper/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gold" aria-hidden />
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-stone/60 px-4 py-4 text-[15px] leading-7" aria-live="polite">
            <div className="max-w-[88%] rounded-2xl rounded-ss-sm bg-paper px-4 py-3 shadow-card">
              {tr('هلا والله، حياك الله في سمّها. أنا المساعد الذكي للمنصة، أساعدك في طلب الشعارات والمزادات والضمان والفواتير ومواعيد المهرجانات.', 'Welcome to Sammha. I can help with name requests, auctions, the guarantee, invoices and festival dates.')}
            </div>
            {log.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGEST.map(([a, b]) => (
                  <button key={a} onClick={() => ask(ar ? a : b)} className="rounded-full border border-pine/25 bg-paper px-3 py-1.5 text-[13.5px] font-bold text-pine hover:border-pine hover:bg-pine-soft">{ar ? a : b}</button>
                ))}
              </div>
            )}
            {log.map((m, i) => m.from === 'me' ? (
              <div key={i} className="ms-auto w-fit max-w-[85%] whitespace-pre-line rounded-2xl rounded-se-sm bg-pine px-4 py-2.5 text-paper">{m.text}</div>
            ) : (
              <div key={i} className={`max-w-[92%] rounded-2xl rounded-ss-sm px-4 py-2.5 shadow-card ${m.error ? 'border border-bad/20 bg-bad/5' : 'bg-paper'}`}>
                <Rich text={m.text} onNav={closeOnMobile} />
              </div>
            ))}
            {busy && (
              <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-ss-sm bg-paper px-4 py-3.5 shadow-card" aria-label={tr('يكتب…', 'Typing…')}>
                {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-pine/50" style={{ animationDelay: `${d * 150}ms` }} />)}
              </div>
            )}
            <div ref={end} />
          </div>

          <form onSubmit={submit} className="border-t border-line bg-paper p-3">
            <div className="flex items-end gap-2">
              <textarea ref={input} rows={1} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text) } }}
                placeholder={tr('اكتب سؤالك…', 'Type your question…')} aria-label={tr('رسالتك', 'Your message')}
                className="field max-h-28 min-h-[44px] resize-none py-2.5" />
              <button disabled={busy || !text.trim()} aria-label={tr('إرسال', 'Send')} className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-pine text-paper hover:bg-pine-3 disabled:opacity-40">
                <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[11.5px] text-muted">
              {tr('مساعد آلي وقد يخطئ. للشكاوى والبلاغات الرسمية ', 'Automated assistant, it can make mistakes. For formal complaints ')}
              <Link to="/contact" onClick={closeOnMobile} className="font-bold text-pine underline">{tr('قدّم طلبًا برقم متابعة', 'file a tracked request')}</Link>
            </p>
          </form>
        </section>
      )}

      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? tr('إغلاق المساعد', 'Close assistant') : tr('افتح مساعد سمّها', 'Open Sammha assistant')}
        className={`group fixed end-5 z-50 flex h-14 ${raised ? 'bottom-24 lg:bottom-5' : 'bottom-5'} items-center justify-center gap-2 rounded-full bg-pine text-paper ${compact ? 'w-14' : 'ps-4 pe-5'} shadow-[0_12px_30px_-8px_rgba(15,59,36,.6)] ring-2 ring-gold/70 transition hover:bg-pine-3`}>
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" /></svg>
        )}
        {!compact && <span className="text-[15px] font-bold">{open ? tr('إغلاق', 'Close') : tr('اسأل سمّها', 'Ask Sammha')}</span>}
      </button>
    </div>
  )
}
