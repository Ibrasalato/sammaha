import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { IssuedCertificate, issuedVerifyUrl } from '../../components/IssuedCertificate'
import { Empty, ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { date } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import { toLatin } from '../../lib/translit'
import type { Certificate, CertificateScope, CertificateStatus, ReservedName } from '../../lib/types'

export const certStatus = (s: CertificateStatus): [string, string] => (({
  valid: [tr('سارية', 'Valid'), 'bg-[#E2F0E8] text-ok'],
  partial: [tr('سارية جزئيًا', 'Partly valid'), 'bg-gold-soft text-gold-deep'],
  superseded: [tr('انتقلت الملكية', 'Ownership changed'), 'bg-stone-deep text-muted'],
  revoked: [tr('ملغاة', 'Revoked'), 'bg-bad/10 text-bad'],
}) as Record<CertificateStatus, [string, string]>)[s]

function IssueModal({ names, preset, lastEn, onClose }: { names: ReservedName[]; preset?: string; lastEn?: string; onClose: () => void }) {
  const { user, toast } = useApp()
  const nav = useNavigate()
  const [scope, setScope] = useState<CertificateScope>(preset ? 'mark' : names.length > 1 ? 'portfolio' : 'mark')
  const [mark, setMark] = useState(preset ?? names[0]?.id ?? '')
  const [en, setEn] = useState(lastEn ?? toLatin(user?.fullName ?? ''))
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function issue() {
    setBusy(true); setErr('')
    try {
      const c = await api.issueCertificate({ scope, reservedNameId: scope === 'mark' ? mark : undefined, ownerNameEn: en.trim() })
      toast(tr(`صدرت الشهادة ${c.number}`, `Certificate ${c.number} issued`))
      nav(`/dashboard/certificates/${c.number}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={tr('إصدار شهادة تسجيل', 'Issue a registration certificate')}>
      <div className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div className="grid grid-cols-2 gap-2">
          {([['mark', tr('شعار محدد', 'One mark'), tr('شهادة لاسم واحد', 'A certificate for one name')], ['portfolio', tr('جميع شعاراتي', 'All my marks'), tr(`شهادة شاملة لـ ${names.length} شعار`, `One certificate listing ${names.length} marks`)]] as const).map(([k, l, h]) => (
            <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)} className={`rounded-lg border-2 p-3 text-start ${scope === k ? 'border-pine bg-pine-soft/60' : 'border-line'}`}>
              <b className="block">{l}</b><span className="text-[12.5px] text-muted">{h}</span>
            </button>
          ))}
        </div>
        {scope === 'mark' && (
          <div>
            <label htmlFor="cm" className="mb-1 block font-bold">{tr('الشعار', 'Mark')}</label>
            <select id="cm" className="field" value={mark} onChange={(e) => setMark(e.target.value)}>
              {names.map((n) => <option key={n.id} value={n.id}>{n.name} · {n.latin ?? toLatin(n.name)}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="cen" className="mb-1 block font-bold">{tr('اسمك بالإنجليزية كما في جواز السفر', 'Your name in English, as in your passport')}</label>
          <input id="cen" className="field" dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} maxLength={120} />
          <p className="hint">{tr('يظهر في الجزء الإنجليزي من الشهادة. اقترحناه من اسمك بالعربية، فعدّله ليطابق جوازك.', 'Shown on the English side of the certificate. We suggested it from your Arabic name; edit it to match your passport.')}</p>
        </div>
        <div className="rounded-lg bg-stone/70 p-3 text-[13px] leading-6 text-muted">
          {tr('تصدر الشهادة فورًا بالعربية والإنجليزية، برقم تسلسلي ورمز توثيق ورمز QR يتحقق منه أي شخص. تُظهر الشهادة رقم هويتك مخفيًا جزئيًا، وتبقى صفحة التحقق العامة بدون رقم الهوية.', 'The certificate is issued at once in Arabic and English, with a serial number, an authentication code and a QR code anyone can check. It shows your ID partly hidden; the public verification page never shows it.')}
        </div>
        <label className="flex items-start gap-2 text-[14px]"><input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />{tr('أقرّ بصحة بياناتي، وأعلم أن الشهادة تُثبت الملكية حتى تاريخ إصدارها.', 'I confirm my details are correct, and understand the certificate proves ownership as of its issue date.')}</label>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy || !ok || (scope === 'mark' && !mark)} onClick={issue}>{busy ? tr('جارٍ الإصدار…', 'Issuing…') : tr('إصدار الشهادة', 'Issue certificate')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('إلغاء', 'Cancel')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** the owner's certificates: request one for a mark or for all marks; it is issued at once */
export function CertificatesPage() {
  const { user } = useApp()
  const [params, setParams] = useSearchParams()
  const certs = useLoad(() => api.myCertificates(), [])
  const names = useLoad(() => api.myNames(), [])
  const [open, setOpen] = useState(false)
  const preset = params.get('mark') ?? undefined
  useEffect(() => { if (preset && names.data?.length) setOpen(true) }, [preset, names.data])
  const close = () => { setOpen(false); if (preset) setParams((p) => { p.delete('mark'); return p }, { replace: true }) }
  const delegate = !!user?.acting
  return (
    <>
      <PageHead title={tr('شهاداتي', 'My certificates')} sub={tr('شهادات تسجيل بالعربية والإنجليزية، موثقة من المنظمة الدولية للإبل، تصدر فورًا لشعار محدد أو لكل شعاراتك.', 'Registration certificates in Arabic and English, attested by the International Camel Organization, issued at once for one mark or all your marks.')}
        action={!delegate && names.data?.length ? <button className="btn-gold" onClick={() => setOpen(true)}><Icon name="plus" className="h-4 w-4" />{tr('إصدار شهادة', 'Issue certificate')}</button> : undefined} />
      {delegate && <p className="mb-4 rounded-lg bg-gold-soft p-3 text-[14px] text-gold-deep">{tr('إصدار الشهادات لصاحب الحساب فقط. يمكنك عرض الشهادات الصادرة وطباعتها.', 'Only the account owner can issue certificates. You can view and print issued ones.')}</p>}
      {certs.error ? <ErrorBox text={certs.error} /> : certs.loading && !certs.data ? <Loading /> : certs.data?.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {certs.data.map((c) => {
            const [l, cls] = certStatus(c.status)
            return (
              <li key={c.id} className="panel flex items-start gap-4 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-pine-soft text-pine"><Icon name="file" className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><b className="num" dir="ltr">{c.number}</b><span className={`pill ${cls}`}>{l}</span></div>
                  <p className="mt-0.5 text-[14px]">{c.scope === 'mark' ? <>{tr('شعار', 'Mark')} «<b>{c.items[0]?.name}</b>» <span className="text-muted" dir="ltr">{c.items[0]?.latin}</span></> : tr(`جميع الشعارات (${c.itemCount})`, `All marks (${c.itemCount})`)}</p>
                  <p className="text-[13px] text-muted">{tr('صدرت', 'Issued')} {date(c.issuedAt)}</p>
                </div>
                <Link to={`/dashboard/certificates/${c.number}`} className="btn-ghost btn-sm">{tr('عرض وطباعة', 'View & print')}</Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty title={tr('لم تُصدر شهادات بعد', 'No certificates issued yet')}>
          <p className="text-muted">{names.data?.length ? tr('أصدر شهادة لأحد شعاراتك أو لجميعها.', 'Issue a certificate for one of your marks or all of them.') : tr('تُصدر الشهادات للأسماء المسجلة باسمك.', 'Certificates are issued for names registered to you.')}</p>
          {!delegate && !!names.data?.length && <button className="btn-primary mt-3" onClick={() => setOpen(true)}>{tr('إصدار شهادة', 'Issue certificate')}</button>}
        </Empty>
      )}
      {open && names.data && <IssueModal names={names.data} preset={preset} lastEn={certs.data?.[0]?.ownerNameEn} onClose={close} />}
    </>
  )
}

/** one certificate: status, share link, print */
export function CertificateView({ staff = false }: { staff?: boolean }) {
  const { number = '' } = useParams()
  const { toast } = useApp()
  const { data, loading, error } = useLoad(() => (staff ? api.staffCertificate(number) : api.myCertificate(number)), [number])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox text={error ?? tr('الشهادة غير موجودة', 'Certificate not found')} />
  const c: Certificate = data
  const [l, cls] = certStatus(c.status)
  const link = issuedVerifyUrl(c)
  return (
    <>
      <style>{`@page { size: A4 ${c.scope === 'mark' ? 'landscape' : 'portrait'}; margin: 0 }`}</style>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link to={staff ? '/admin/certificates' : '/dashboard/certificates'} className="text-sm font-medium text-muted hover:text-pine">{staff ? tr('الشهادات', 'Certificates') : tr('شهاداتي', 'My certificates')}</Link>
        <span className={`pill ${cls}`}>{l}</span>
        <span className="ms-auto" />
        <button className="btn-ghost btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(link); toast(tr('نُسخ رابط التحقق', 'Verification link copied')) } catch { toast(link) } }}>{tr('نسخ رابط التحقق', 'Copy verification link')}</button>
        <a className="btn-ghost btn-sm" href={link} target="_blank" rel="noreferrer">{tr('صفحة التحقق', 'Verification page')}</a>
        <button className="btn-primary" onClick={() => window.print()}><Icon name="file" className="h-4 w-4" />{tr('طباعة أو حفظ PDF', 'Print or save PDF')}</button>
      </div>
      {c.status === 'revoked' && <p className="mb-3 rounded-lg bg-bad/10 p-3 text-[14px] text-bad print:hidden">{tr(`أُلغيت هذه الشهادة: ${c.revokeReason ?? ''}`, `This certificate was revoked: ${c.revokeReason ?? ''}`)}</p>}
      {(c.status === 'partial' || c.status === 'superseded') && <p className="mb-3 rounded-lg bg-gold-soft p-3 text-[14px] text-gold-deep print:hidden">{tr('انتقلت ملكية بعض الأسماء منذ صدور الشهادة، وتظهر صفحة التحقق ذلك. أصدر شهادة جديدة بالوضع الحالي.', 'Some names have changed hands since this certificate was issued, and the verification page shows it. Issue a new certificate for the current state.')}</p>}
      <div className="overflow-x-auto print:overflow-visible"><div className="min-w-[860px] print:min-w-0"><IssuedCertificate c={c} /></div></div>
    </>
  )
}

/** the same view for staff with certificates.manage */
export function StaffCertificateView() {
  return <CertificateView staff />
}
