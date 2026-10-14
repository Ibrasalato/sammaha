import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, SectionCard } from '../../components/dash'
import { PayModal } from '../../components/PayModal'
import { Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, TypeBadge } from '../../components/ui'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { NameTransfer, TransferReason, TransferStatus } from '../../lib/types'
import { tr } from '../../lib/i18n'
import { ClosedNotice, useClosed } from '../../components/SettingsUi'

const NOTE_MAX = 500

const statusMap = (): Record<TransferStatus, [string, string]> => ({
  pending_payment: [tr('بانتظار سداد الرسوم', 'Awaiting fee payment'), 'bg-gold-soft text-gold-deep'],
  awaiting_recipient: [tr('بانتظار موافقة المستلم', 'Awaiting recipient'), 'bg-info-soft text-info-deep'],
  under_review: [tr('قيد مراجعة اللجنة', 'Under committee review'), 'bg-gold text-pine'],
  completed: [tr('اكتمل النقل', 'Transfer completed'), 'bg-[#E2F0E8] text-ok'],
  rejected: [tr('رفضته اللجنة', 'Rejected by committee'), 'bg-bad/10 text-bad'],
  declined: [tr('رفضه المستلم', 'Declined by recipient'), 'bg-stone-deep text-ink'],
  cancelled: [tr('ملغى', 'Cancelled'), 'bg-stone-deep text-muted'],
})

const reasons = (): [TransferReason, string][] => [
  ['sale', tr('بيع خارج المنصة', 'Sale outside the platform')],
  ['gift', tr('هبة / إهداء', 'Gift')],
  ['inheritance', tr('إرث', 'Inheritance')],
  ['other', tr('أخرى', 'Other')],
]
const reasonLabel = (r: TransferReason) => reasons().find(([k]) => k === r)?.[1] ?? r

type Confirm = { title: string; text: string; label: string; danger?: boolean; run: () => Promise<void> }

function StatusPill({ s }: { s: TransferStatus }) {
  const [label, cls] = statusMap()[s]
  return <span className={`pill ${cls}`}>{label}</span>
}

/** «نقل ملكية اسم»: the owner transfers a name to another user; the recipient accepts, then the committee approves. */
export function TransfersPage() {
  const { toast } = useApp()
  const closed = useClosed('transfer')
  const [params] = useSearchParams()
  const data = useLoad(() => api.myTransfers(), [])
  const names = useLoad(() => api.myNames(), [])

  const [reservedId, setReservedId] = useState(params.get('name') ?? '')
  const [phone, setPhone] = useState('')
  const [recipient, setRecipient] = useState('')
  const [checking, setChecking] = useState(false)
  const [phoneErr, setPhoneErr] = useState('')
  const [reason, setReason] = useState<TransferReason | ''>('')
  const [note, setNote] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [paying, setPaying] = useState<NameTransfer | null>(null)
  const [confirming, setConfirming] = useState<Confirm | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const fee = data.data?.fee ?? 0
  const outgoing = data.data?.outgoing ?? []
  const incoming = data.data?.incoming ?? []
  const open = (t: NameTransfer) => t.status === 'pending_payment' || t.status === 'awaiting_recipient' || t.status === 'under_review'
  const busyNames = useMemo(() => new Set(outgoing.filter(open).map((t) => t.reservedId)), [outgoing])
  const transferable = useMemo(() => (names.data ?? []).filter((n) => !n.listingId && !busyNames.has(n.id)), [names.data, busyNames])
  const chosen = transferable.find((n) => n.id === reservedId)
  const noteOk = reason !== 'other' || note.trim().length > 0
  const valid = !!chosen && !!recipient && !!reason && noteOk && agree

  function reload() { data.reload(); names.reload() }

  async function verify() {
    setChecking(true); setPhoneErr(''); setRecipient('')
    try { setRecipient((await api.findRecipient(phone.trim())).maskedName) } catch (e) { setPhoneErr((e as Error).message) } finally { setChecking(false) }
  }

  async function submit() {
    if (!chosen || !reason) return
    setBusy(true)
    try {
      const t = await api.createTransfer({ reservedId: chosen.id, phone: phone.trim(), reason, note: note.trim() || undefined })
      setReservedId(''); setPhone(''); setRecipient(''); setReason(''); setNote(''); setAgree(false)
      reload()
      if (t.status === 'pending_payment') {
        toast(tr(`أُنشئ طلب النقل ${t.number}، ادفع الرسوم لإرساله للمستلم`, `Transfer request ${t.number} created; pay the fee to send it to the recipient`))
        setPaying(t)
      } else toast(tr(`أُرسل طلب نقل «${t.name}» إلى المستلم للموافقة`, `Transfer request for «${t.name}» sent to the recipient for approval`))
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  async function runConfirm() {
    if (!confirming) return
    setConfirmBusy(true)
    try { await confirming.run(); setConfirming(null) } catch (e) { toast((e as Error).message, 'bad') } finally { setConfirmBusy(false) }
  }

  const askCancel = (t: NameTransfer) => setConfirming({
    title: tr('إلغاء طلب النقل', 'Cancel transfer request'),
    text: tr(`إلغاء طلب نقل «${t.name}» إلى ${t.toName}؟ يبقى الاسم باسمك${t.fee > 0 && t.status !== 'pending_payment' ? '، وتُعاد الرسوم إلى محفظتك' : ''}.`, `Cancel the transfer of «${t.name}» to ${t.toName}? The name stays yours${t.fee > 0 && t.status !== 'pending_payment' ? ' and the fee is refunded to your wallet' : ''}.`),
    label: tr('إلغاء الطلب', 'Cancel request'), danger: true,
    run: async () => { await api.cancelTransfer(t.id); toast(tr('أُلغي طلب النقل', 'Transfer request cancelled')); reload() },
  })
  const askRespond = (t: NameTransfer, accept: boolean) => setConfirming(accept ? {
    title: tr('قبول نقل الاسم', 'Accept name transfer'),
    text: tr(`قبول نقل «${t.name}» من ${t.fromName}؟ يُحال الطلب إلى اللجنة، ويُنقل الاسم إليك بعد اعتمادها.`, `Accept the transfer of «${t.name}» from ${t.fromName}? The request goes to the committee, and the name moves to you once approved.`),
    label: tr('قبول', 'Accept'),
    run: async () => { await api.respondTransfer(t.id, true); toast(tr('قبلت النقل، والطلب الآن لدى اللجنة', 'You accepted; the request is now with the committee')); reload() },
  } : {
    title: tr('رفض نقل الاسم', 'Decline name transfer'),
    text: tr(`رفض نقل «${t.name}» من ${t.fromName}؟ يبقى الاسم باسم مالكه الحالي.`, `Decline the transfer of «${t.name}» from ${t.fromName}? The name stays with its current owner.`),
    label: tr('رفض', 'Decline'), danger: true,
    run: async () => { await api.respondTransfer(t.id, false); toast(tr('رفضت طلب النقل', 'You declined the transfer request')); reload() },
  })

  const feeText = fee > 0 ? tr(`رسوم النقل: ${sar(fee)} شاملة الضريبة (تُدفع بالبطاقة)`, `Transfer fee: ${sar(fee)} incl. VAT (paid by card)`) : tr('رسوم النقل: مجانًا', 'Transfer fee: free')

  return (
    <>
      <PageHead title={tr('نقل ملكية اسم', 'Transfer name ownership')}
        sub={tr('انقل اسمًا تملكه إلى مستخدم آخر في ثلاث خطوات: تقدّم الطلب، فيوافق المستلم، ثم تعتمده اللجنة. بعدها يُنقل الاسم إلى المستلم ويمكنه إصدار شهادة جديدة، ولا تعود أي شهادة تتضمنه سارية لك.', 'Transfer a name you own to another user in three steps: you submit the request, the recipient accepts, then the committee approves. The name then moves to the recipient, who can issue a new certificate, and any certificate including it is no longer valid for you.')}
        action={<span className={`pill ${fee > 0 ? 'bg-gold-soft text-gold-deep' : 'bg-[#E2F0E8] text-ok'}`}>{data.data ? feeText : '…'}</span>} />

      <ol className="mb-6 grid gap-2 sm:grid-cols-3">
        {[tr('تقدّم طلب النقل', 'You submit the request'), tr('يوافق المستلم', 'The recipient accepts'), tr('تعتمد اللجنة ويُنقل الاسم', 'The committee approves and the name moves')].map((s, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3 text-[14.5px]">
            <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pine text-paper font-extrabold">{i + 1}</span>{s}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 text-lg"><span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-soft text-gold-deep"><Icon name="arrow" /></span>{tr('طلب نقل جديد', 'New transfer request')}</h2>
          <ClosedNotice intake="transfer" className="mt-3" />
          {names.loading && !names.data ? <Loading /> : !transferable.length ? (
            <p className="mt-4 rounded-lg bg-stone p-4 text-[15px] text-muted">{tr('لا يوجد اسم متاح للنقل. تظهر هنا أسماؤك غير المعروضة للبيع وليس عليها طلب نقل قائم.', 'No names available to transfer. Your names that are not listed for sale and have no open transfer request appear here.')}</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="tr-name">{tr('اختر الاسم', 'Choose the name')}</label>
                <select id="tr-name" className="field" value={reservedId} onChange={(e) => setReservedId(e.target.value)}>
                  <option value="">{tr('اختر من أسمائك', 'Choose from your names')}</option>
                  {transferable.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                {chosen && <div className="mt-3 flex items-center gap-3"><NameSeal name={chosen.name} type={chosen.type} size="sm" latin={chosen.latin} /><TypeBadge type={chosen.type} /></div>}
              </div>

              <div>
                <label className="label" htmlFor="tr-phone">{tr('جوال المستلم', 'Recipient mobile')}</label>
                <div className="flex gap-2">
                  <input id="tr-phone" className="field num flex-1" dir="ltr" inputMode="tel" placeholder="05xxxxxxxx / +971…" value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/[^\d+]/g, '')); setRecipient(''); setPhoneErr('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && phone.trim()) { e.preventDefault(); verify() } }} />
                  <button type="button" className="btn-ghost shrink-0" disabled={!phone.trim() || checking} onClick={verify}>{checking ? '…' : tr('تحقق', 'Verify')}</button>
                </div>
                {recipient && <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-ok"><Icon name="check" className="h-4 w-4" />{tr('سيُنقل إلى:', 'Will be transferred to:')} <b>{recipient}</b></p>}
                {phoneErr && <p className="mt-1.5 text-[14px] text-bad">{phoneErr}</p>}
                {!recipient && !phoneErr && <p className="hint">{tr('يجب أن يكون للمستلم حساب في سمّها بهذا الرقم.', 'The recipient must have a Sammha account with this number.')}</p>}
              </div>

              <fieldset>
                <legend className="label">{tr('سبب النقل', 'Reason for transfer')}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {reasons().map(([k, l]) => (
                    <label key={k} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border-2 p-3 text-[14.5px] ${reason === k ? 'border-pine bg-pine-soft/50' : 'border-line'}`}>
                      <input type="radio" name="tr-reason" checked={reason === k} onChange={() => setReason(k)} />{l}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="label" htmlFor="tr-note">{reason === 'other' ? tr('اذكر السبب', 'Describe the reason') : tr('ملاحظة (اختياري)', 'Note (optional)')}</label>
                <textarea id="tr-note" className="field min-h-[84px]" maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
                <p className="hint num">{note.length}/{NOTE_MAX}</p>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-stone p-3 text-[14.5px]">
                <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{tr('أقرّ برغبتي في نقل ملكية هذا الاسم نهائيًا إلى المستلم بعد موافقته واعتماد اللجنة، وأن أي شهادة تتضمنه لن تعود سارية لي.', 'I confirm I want to permanently transfer ownership of this name to the recipient once they accept and the committee approves, and that any certificate including it will no longer be valid for me.')}{fee > 0 && tr(` وأوافق على رسوم النقل ${sar(fee)}.`, ` I agree to the transfer fee of ${sar(fee)}.`)}</span>
              </label>

              <button className="btn-gold w-full sm:w-auto sm:px-6" disabled={!valid || busy || !!closed} onClick={submit}>
                {busy ? tr('جارٍ الإرسال…', 'Submitting…') : fee > 0 ? tr(`إرسال الطلب ودفع ${sar(fee)}`, `Submit and pay ${sar(fee)}`) : tr('إرسال طلب النقل', 'Submit transfer request')}
              </button>
            </div>
          )}
        </section>

        <aside className="panel space-y-3 p-5 text-[14.5px]">
          <h3 className="text-[16px]">{tr('قبل أن تنقل', 'Before you transfer')}</h3>
          <ul className="space-y-1.5 text-ink/80">
            <li>• {fee > 0 ? tr(`رسوم النقل ${sar(fee)} شاملة الضريبة، وتُدفع بالبطاقة فقط ولا تُدفع من المحفظة.`, `The transfer fee is ${sar(fee)} incl. VAT, paid by card only, not from the wallet.`) : tr('النقل حاليًا مجاني.', 'Transfers are currently free.')}</li>
            <li>• {tr('إن رفض المستلم أو اللجنة أو ألغيت الطلب، تُعاد الرسوم إلى محفظتك ويمكنك سحبها إلى حسابك البنكي.', 'If the recipient or committee declines, or you cancel, the fee is refunded to your wallet and can be withdrawn to your bank account.')}</li>
            <li>• {tr('لا يمكن نقل اسم معروض للبيع؛ ألغِ العرض أولًا.', 'A name listed for sale cannot be transferred; cancel the listing first.')}</li>
            <li>• {tr('بعد اكتمال النقل يصدر المستلم شهادة جديدة، ولا تعود شهاداتك السابقة المتضمنة للاسم سارية.', 'After the transfer, the recipient issues a new certificate and your earlier certificates including the name are no longer valid.')}</li>
          </ul>
        </aside>
      </div>

      {data.error && <div className="mt-6"><ErrorBox text={data.error} /></div>}

      <div className="mt-8 space-y-6">
        <SectionCard title={tr('طلبات النقل الصادرة', 'Outgoing transfers')} icon="arrow">
          <div className="p-5">
            {data.loading && !data.data ? <Loading /> : outgoing.length ? (
              <ul className="space-y-3">
                {outgoing.map((t) => (
                  <li key={t.id} className={`rounded-xl border border-line p-4 ${t.status === 'cancelled' || t.status === 'declined' ? 'opacity-70' : ''}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-[12rem] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num text-[13px] text-muted">{t.number}</span>
                          <b className="flex items-center gap-1.5 text-[16px]"><TypeBadge type={t.type} />{t.name}</b>
                          <StatusPill s={t.status} />
                        </div>
                        <p className="mt-1 text-[13.5px] text-muted">
                          {tr('إلى', 'To')} <b className="text-ink">{t.toName}</b>{t.toPhone && <> · <span className="num" dir="ltr">{t.toPhone}</span></>} · {reasonLabel(t.reason)} · {tr('الرسوم', 'Fee')} <span className="num">{t.fee > 0 ? sar(t.fee) : tr('مجانًا', 'Free')}</span> · {dateTime(t.createdAt)}
                        </p>
                        {t.note && <p className="mt-1 text-[13.5px]">{t.note}</p>}
                        {t.status === 'rejected' && t.reviewNote && <p className="mt-2 rounded-lg bg-bad/5 px-3 py-2 text-[13.5px] text-bad">{tr('سبب الرفض:', 'Rejection reason:')} {t.reviewNote}</p>}
                        {t.status === 'completed' && <p className="mt-1 text-[13px] text-ok">{tr('نُقل الاسم في', 'Transferred on')} {dateTime(t.completedAt ?? t.reviewedAt)}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.status === 'pending_payment' && <button className="btn-gold btn-sm" onClick={() => setPaying(t)}>{tr('ادفع الرسوم', 'Pay fee')} {sar(t.fee)}</button>}
                        {open(t) && <button className="btn-ghost btn-sm text-bad" onClick={() => askCancel(t)}>{tr('إلغاء الطلب', 'Cancel request')}</button>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty title={tr('لا توجد طلبات نقل صادرة', 'No outgoing transfers')}><p className="text-muted">{tr('اختر اسمًا من أسمائك في النموذج أعلاه لنقله.', 'Choose one of your names in the form above to transfer it.')}</p></Empty>}
          </div>
        </SectionCard>

        <SectionCard title={tr('طلبات النقل الواردة', 'Incoming transfers')} icon="users">
          <div className="p-5">
            {data.loading && !data.data ? <Loading /> : incoming.length ? (
              <ul className="space-y-3">
                {incoming.map((t) => (
                  <li key={t.id} className={`rounded-xl border p-4 ${t.status === 'awaiting_recipient' ? 'border-gold bg-gold-soft/30' : 'border-line'}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-[12rem] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num text-[13px] text-muted">{t.number}</span>
                          <b className="flex items-center gap-1.5 text-[16px]"><TypeBadge type={t.type} />{t.name}</b>
                          <StatusPill s={t.status} />
                        </div>
                        <p className="mt-1 text-[13.5px] text-muted">{tr('من', 'From')} <b className="text-ink">{t.fromName}</b> · {reasonLabel(t.reason)} · {dateTime(t.createdAt)}</p>
                        {t.note && <p className="mt-1 text-[13.5px]">{t.note}</p>}
                        {t.status === 'rejected' && t.reviewNote && <p className="mt-2 rounded-lg bg-bad/5 px-3 py-2 text-[13.5px] text-bad">{tr('سبب الرفض:', 'Rejection reason:')} {t.reviewNote}</p>}
                        {t.status === 'completed' && <p className="mt-1 text-[13px] text-ok">{tr('أصبح الاسم باسمك، ويمكنك إصدار شهادة جديدة.', 'The name is now yours, and you can issue a new certificate.')}</p>}
                      </div>
                      {t.status === 'awaiting_recipient' && (
                        <div className="flex gap-1.5">
                          <button className="btn-primary btn-sm" onClick={() => askRespond(t, true)}>{tr('قبول', 'Accept')}</button>
                          <button className="btn-danger btn-sm" onClick={() => askRespond(t, false)}>{tr('رفض', 'Decline')}</button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty title={tr('لا توجد طلبات نقل واردة', 'No incoming transfers')}><p className="text-muted">{tr('تظهر هنا الأسماء التي يرغب مالكوها في نقلها إليك.', 'Names their owners want to transfer to you appear here.')}</p></Empty>}
          </div>
        </SectionCard>
      </div>

      <PayModal open={!!paying} onClose={() => setPaying(null)} cardOnly
        title={paying ? tr(`رسوم نقل «${paying.name}»`, `Transfer fee for «${paying.name}»`) : ''}
        amount={paying?.fee ?? 0}
        onPay={async () => {
          if (!paying) return
          try {
            await api.payTransferFee(paying.id)
            toast(tr('دُفعت الرسوم وأُرسل الطلب إلى المستلم للموافقة', 'Fee paid; the request was sent to the recipient for approval'))
            reload()
          } catch (e) { toast((e as Error).message, 'bad'); throw e }
        }} />

      <Modal open={!!confirming} onClose={() => !confirmBusy && setConfirming(null)} title={confirming?.title ?? ''}>
        {confirming && (
          <div className="space-y-4">
            <p className="text-[15px] leading-7">{confirming.text}</p>
            <div className="flex gap-2">
              <button className={`${confirming.danger ? 'btn-danger' : 'btn-primary'} flex-1`} disabled={confirmBusy} onClick={runConfirm}>{confirmBusy ? '…' : confirming.label}</button>
              <button className="btn-ghost" disabled={confirmBusy} onClick={() => setConfirming(null)}>{tr('رجوع', 'Back')}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
