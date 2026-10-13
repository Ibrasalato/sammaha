import { useEffect, useRef, useState } from 'react'
import type { OtpChallenge } from '../lib/api'
import { IS_DEMO, OTP } from '../lib/config'
import { tr } from '../lib/i18n'
import { otpDigits } from '../lib/otp'
import { ErrorBox } from './ui'

/** Four-box one-time-code entry with paste support, auto-submit and a resend timer. */
export function OtpForm({ c, onVerify, onResend, onBack, title }: {
  c: OtpChallenge
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<OtpChallenge>
  onBack?: () => void
  title?: string
}) {
  const [digits, setDigits] = useState<string[]>(Array(OTP.length).fill(''))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(60)
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { boxes.current[0]?.focus() }, [c.challenge])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function verify(code: string) {
    if (code.length !== OTP.length || busy) return
    setBusy(true); setErr('')
    try { await onVerify(code) } catch (e) {
      setErr((e as Error).message); setDigits(Array(OTP.length).fill('')); boxes.current[0]?.focus()
    } finally { setBusy(false) }
  }
  function put(i: number, raw: string) {
    const v = otpDigits(raw)
    if (v.length > 1) { // pasted the whole code
      const all = v.slice(0, OTP.length).split('')
      const next = Array(OTP.length).fill('').map((_, k) => all[k] ?? '')
      setDigits(next); boxes.current[Math.min(all.length, OTP.length - 1)]?.focus()
      if (all.length === OTP.length) verify(all.join(''))
      return
    }
    const next = [...digits]; next[i] = v; setDigits(next)
    if (v && i < OTP.length - 1) boxes.current[i + 1]?.focus()
    if (next.every(Boolean)) verify(next.join(''))
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); verify(digits.join('')) }} className="space-y-5">
      <div>
        <h2 className="text-[20px]">{title ?? tr('رمز التحقق', 'Verification code')}</h2>
        <p className="mt-1 text-[15px] text-muted">{tr('أرسلنا رمزًا من 4 أرقام إلى الجوال', 'We sent a 4-digit code to')} <b className="num text-ink" dir="ltr">{c.phoneMasked}</b></p>
      </div>
      {err && <ErrorBox text={err} />}
      <div className="flex justify-center gap-3" dir="ltr">
        {digits.map((d, i) => (
          <input key={i} ref={(el) => { boxes.current[i] = el }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={OTP.length}
            aria-label={tr(`الرقم ${i + 1}`, `Digit ${i + 1}`)} disabled={busy}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) boxes.current[i - 1]?.focus() }}
            className="num h-14 w-14 rounded-lg border-2 border-line bg-paper text-center text-[26px] font-extrabold outline-none focus:border-pine focus:ring-2 focus:ring-pine/10" />
        ))}
      </div>
      {IS_DEMO && <p className="rounded-md bg-gold-soft px-3 py-2 text-center text-[13.5px] text-gold-deep">{tr(`نسخة تجريبية: الرمز الثابت ${OTP.fixedCode} لحين ربط مزود الرسائل`, `Demo: the fixed code is ${OTP.fixedCode} until SMS is connected`)}</p>}
      <button className="btn-primary w-full" disabled={busy || digits.some((x) => !x)}>{busy ? tr('جارٍ التحقق…', 'Checking…') : tr('تحقق', 'Verify')}</button>
      <div className="flex items-center justify-between text-[14px]">
        {onBack ? <button type="button" className="font-bold text-muted hover:text-ink" onClick={onBack}>{tr('رجوع', 'Back')}</button> : <span />}
        {wait > 0
          ? <span className="text-muted">{tr(`إعادة الإرسال بعد ${wait} ث`, `Resend in ${wait}s`)}</span>
          : <button type="button" className="font-bold text-gold-deep hover:underline" onClick={async () => { try { await onResend(); setWait(60); setErr('') } catch (e) { setErr((e as Error).message) } }}>{tr('إعادة إرسال الرمز', 'Resend code')}</button>}
      </div>
    </form>
  )
}
