import { useState } from 'react'
import { ErrorBox, Modal } from './ui'
import { can } from '../lib/permissions'
import { api, useApp } from '../lib/store'
import type { AuctionActionResult, AuctionScope } from '../lib/types'

export type AuctionAction = 'pause' | 'resume' | 'extend' | 'cancel'

const TITLE: Record<AuctionAction, string> = { pause: 'إيقاف مؤقت', resume: 'استئناف', extend: 'تمديد', cancel: 'إلغاء المزاد' }
const PRESETS: [number, string][] = [[15, '15 دقيقة'], [60, 'ساعة'], [360, '6 ساعات'], [1440, 'يوم'], [4320, '3 أيام'], [10080, 'أسبوع']]

/** human summary of what was done and what was skipped */
export function resultText(r: AuctionActionResult, verb: string) {
  if (!r.affected && r.skipped.length) return `لم يُطبّق ${verb}: ${r.skipped.slice(0, 3).map((s) => `${s.name || 'مزاد'} (${s.reason})`).join('، ')}`
  const skip = r.skipped.length ? ` · تخطّي ${r.skipped.length}: ${r.skipped.slice(0, 2).map((s) => `${s.name} (${s.reason})`).join('، ')}${r.skipped.length > 2 ? '…' : ''}` : ''
  return `تم ${verb} ${r.affected === 1 ? 'مزاد واحد' : `${r.affected} مزاد`}${skip}`
}

/**
 * Asks for what the action needs (a reason, a duration, a confirmation) and runs it on the scope.
 * `label` names the scope in the dialog, e.g. «نور الفجر» or «كل مزادات البكار».
 */
export function AuctionActionDialog({ action, scope, label, onClose, onDone }: { action: AuctionAction | null; scope: AuctionScope; label: string; onClose: () => void; onDone: (r: AuctionActionResult) => void }) {
  const { toast } = useApp()
  const [reason, setReason] = useState('')
  const [minutes, setMinutes] = useState(60)
  const [custom, setCustom] = useState('')
  const [confirmAll, setConfirmAll] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const bulk = !!scope.all || (scope.ids?.length ?? 0) > 1
  const needsTyped = !!scope.all && (action === 'cancel' || action === 'pause')

  function close() { setReason(''); setCustom(''); setConfirmAll(''); setErr(''); onClose() }

  async function run() {
    if (!action) return
    setBusy(true); setErr('')
    try {
      const m = custom ? Math.round(Number(custom) * 60) : minutes
      const r = action === 'pause' ? await api.pauseAuctions(scope, reason)
        : action === 'resume' ? await api.resumeAuctions(scope)
        : action === 'extend' ? await api.extendAuctions(scope, m)
        : await api.cancelAuctions(scope, reason)
      toast(resultText(r, { pause: 'إيقاف', resume: 'استئناف', extend: 'تمديد', cancel: 'إلغاء' }[action]), r.affected ? undefined : 'bad')
      close(); onDone(r)
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open={!!action} onClose={close} title={action ? `${TITLE[action]} · ${label}` : ''}>
      {action && (
        <div className="space-y-4">
          {err && <ErrorBox text={err} />}
          {action === 'pause' && <>
            <p className="text-[15px] leading-7">يتوقف استقبال المزايدات والمزايدة الآلية، ويتوقف العدّاد. عند الاستئناف يُضاف وقت التوقف إلى مدة المزاد. يصل إشعار للمزايدين والمتابعين.</p>
            <div><label className="label" htmlFor="pr">السبب <span className="text-xs font-normal text-muted">(اختياري، يظهر للمزايدين)</span></label><input id="pr" className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="مثال: مراجعة فنية" /></div>
          </>}
          {action === 'resume' && <p className="text-[15px] leading-7">يعود المزاد لاستقبال المزايدات، ويُمدّد وقته بمقدار مدة التوقف.</p>}
          {action === 'extend' && <>
            <p className="text-[15px] leading-7">يُضاف الوقت إلى موعد انتهاء {bulk ? 'كل مزاد' : 'المزاد'}.</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(([m, l]) => <button key={m} type="button" className={`btn-sm rounded-lg border-2 ${!custom && minutes === m ? 'border-pine bg-pine-soft' : 'border-line'}`} onClick={() => { setMinutes(m); setCustom('') }}>{l}</button>)}
            </div>
            <div><label className="label" htmlFor="cm">أو مدة أخرى بالساعات</label><input id="cm" className="field num" dir="ltr" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ''))} placeholder="مثال: 2.5" /></div>
          </>}
          {action === 'cancel' && <>
            <div className="rounded-lg border border-bad/30 bg-bad/5 p-3 text-[14.5px] leading-7">
              لا يُرسى المزاد ولا تُحتسب مزايداته. مزادات طلبات الشعارات يعود اسمها إلى قائمة «فتح المزادات»، ومزادات إعادة البيع يبقى الاسم لمالكه ويُرد ضمان الدخول للمزايدين. <b>لا يمكن التراجع.</b>
            </div>
            <div><label className="label" htmlFor="cr">سبب الإلغاء <span className="text-bad">*</span></label><textarea id="cr" className="field min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="يصل للمالك والمزايدين" /></div>
          </>}
          {needsTyped && (
            <div><label className="label" htmlFor="ca">للتأكيد اكتب <b>تأكيد</b></label><input id="ca" className="field" value={confirmAll} onChange={(e) => setConfirmAll(e.target.value)} /></div>
          )}
          <div className="flex gap-2">
            <button className={`${action === 'cancel' ? 'btn-danger' : 'btn-primary'} flex-1`} disabled={busy || (action === 'cancel' && reason.trim().length < 3) || (needsTyped && confirmAll.trim() !== 'تأكيد')} onClick={run}>
              {busy ? 'جارٍ التنفيذ…' : TITLE[action]}
            </button>
            <button className="btn-ghost" onClick={close}>رجوع</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** which actions this staff member may run */
export function useAuctionRights() {
  const { user } = useApp()
  return { manage: can(user, 'auctions.manage'), cancel: can(user, 'auctions.cancel') }
}
