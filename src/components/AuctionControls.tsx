import { tr } from '../lib/i18n'
import { useState } from 'react'
import { ErrorBox, Modal } from './ui'
import { can } from '../lib/permissions'
import { api, useApp } from '../lib/store'
import type { AuctionActionResult, AuctionScope } from '../lib/types'
import { localizeServerText as L } from '../lib/serverText'

export type AuctionAction = 'pause' | 'resume' | 'extend' | 'cancel'

const TITLE: Record<AuctionAction, string> = { get pause() { return tr('إيقاف مؤقت', 'Pause') }, get resume() { return tr('استئناف', 'Resume') }, get extend() { return tr('تمديد', 'Extend') }, get cancel() { return tr('إلغاء المزاد', 'Cancel auction') } }
const PRESETS = (): [number, string][] => [[15, tr('15 دقيقة', '15 minutes')], [60, tr('ساعة', '1 hour')], [360, tr('6 ساعات', '6 hours')], [1440, tr('يوم', '1 day')], [4320, tr('3 أيام', '3 days')], [10080, tr('أسبوع', '1 week')]]

/** human summary of what was done and what was skipped */
export function resultText(r: AuctionActionResult, verb: string) {
  const sep = tr('، ', ', ')
  if (!r.affected && r.skipped.length) return tr(`لم يُطبّق ${verb}: `, `${verb} not applied: `) + r.skipped.slice(0, 3).map((s) => `${s.name || tr('مزاد', 'Auction')} (${L(s.reason)})`).join(sep)
  const skip = r.skipped.length ? ` · ${tr('تخطّي', 'skipped')} ${r.skipped.length}: ${r.skipped.slice(0, 2).map((s) => `${s.name} (${L(s.reason)})`).join(sep)}${r.skipped.length > 2 ? '…' : ''}` : ''
  return tr(`تم ${verb} ${r.affected === 1 ? 'مزاد واحد' : `${r.affected} مزاد`}`, `${verb}: ${r.affected === 1 ? '1 auction' : `${r.affected} auctions`}`) + skip
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
      toast(resultText(r, { pause: tr('إيقاف', 'Paused'), resume: tr('استئناف', 'Resumed'), extend: tr('تمديد', 'Extended'), cancel: tr('إلغاء', 'Cancelled') }[action]), r.affected ? undefined : 'bad')
      close(); onDone(r)
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open={!!action} onClose={close} title={action ? `${TITLE[action]} · ${label}` : ''}>
      {action && (
        <div className="space-y-4">
          {err && <ErrorBox text={err} />}
          {action === 'pause' && <>
            <p className="text-[15px] leading-7">{tr('يتوقف استقبال المزايدات والمزايدة الآلية، ويتوقف العدّاد. عند الاستئناف يُضاف وقت التوقف إلى مدة المزاد. يصل إشعار للمزايدين والمتابعين.', 'Bids and auto-bidding stop and the countdown freezes. On resume, the paused time is added to the auction. Bidders and followers are notified.')}</p>
            <div><label className="label" htmlFor="pr">{tr('السبب', 'Reason')} <span className="text-xs font-normal text-muted">({tr('اختياري، يظهر للمزايدين', 'optional, shown to bidders')})</span></label><input id="pr" className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={tr('مثال: مراجعة فنية', 'e.g. technical review')} /></div>
          </>}
          {action === 'resume' && <p className="text-[15px] leading-7">{tr('يعود المزاد لاستقبال المزايدات، ويُمدّد وقته بمقدار مدة التوقف.', 'The auction accepts bids again and is extended by the paused time.')}</p>}
          {action === 'extend' && <>
            <p className="text-[15px] leading-7">{bulk ? tr('يُضاف الوقت إلى موعد انتهاء كل مزاد.', 'The time is added to the end of each auction.') : tr('يُضاف الوقت إلى موعد انتهاء المزاد.', 'The time is added to the end of the auction.')}</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS().map(([m, l]) => <button key={m} type="button" className={`btn-sm rounded-lg border-2 ${!custom && minutes === m ? 'border-pine bg-pine-soft' : 'border-line'}`} onClick={() => { setMinutes(m); setCustom('') }}>{l}</button>)}
            </div>
            <div><label className="label" htmlFor="cm">{tr('أو مدة أخرى بالساعات', 'Or another duration in hours')}</label><input id="cm" className="field num" dir="ltr" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ''))} placeholder={tr('مثال: 2.5', 'e.g. 2.5')} /></div>
          </>}
          {action === 'cancel' && <>
            <div className="rounded-lg border border-bad/30 bg-bad/5 p-3 text-[14.5px] leading-7">
              {tr('لا يُرسى المزاد ولا تُحتسب مزايداته. مزادات طلبات الشعارات يعود اسمها إلى قائمة «فتح المزادات»، ومزادات إعادة البيع يبقى الاسم لمالكه ويُرد ضمان الدخول للمزايدين.', 'The auction is not awarded and its bids do not count. For mark request auctions the name returns to the "Open auctions" list; for resale auctions the name stays with its owner and bidders\' entry guarantees are refunded.')} <b>{tr('لا يمكن التراجع.', 'This cannot be undone.')}</b>
            </div>
            <div><label className="label" htmlFor="cr">{tr('سبب الإلغاء', 'Cancellation reason')} <span className="text-bad">*</span></label><textarea id="cr" className="field min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={tr('يصل للمالك والمزايدين', 'Sent to the owner and bidders')} /></div>
          </>}
          {needsTyped && (
            <div><label className="label" htmlFor="ca">{tr('للتأكيد اكتب', 'To confirm, type')} <b>{tr('تأكيد', 'CONFIRM')}</b></label><input id="ca" className="field" value={confirmAll} onChange={(e) => setConfirmAll(e.target.value)} /></div>
          )}
          <div className="flex gap-2">
            <button className={`${action === 'cancel' ? 'btn-danger' : 'btn-primary'} flex-1`} disabled={busy || (action === 'cancel' && reason.trim().length < 3) || (needsTyped && confirmAll.trim() !== tr('تأكيد', 'CONFIRM'))} onClick={run}>
              {busy ? tr('جارٍ التنفيذ…', 'Working…') : TITLE[action]}
            </button>
            <button className="btn-ghost" onClick={close}>{tr('رجوع', 'Back')}</button>
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
