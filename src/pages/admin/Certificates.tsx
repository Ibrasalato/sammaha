import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { dateTime, num } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { can } from '../../lib/permissions'
import { api, useApp, useLoad } from '../../lib/store'
import { toLatin } from '../../lib/translit'
import type { Certificate, ReservedName } from '../../lib/types'
import { certStatus } from '../owner/Certificates'

function IssuedList() {
  const { toast } = useApp()
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'revoked'>('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useLoad(() => api.staffCertificates({ q: term || undefined, status: status || undefined, page }), [term, status, page])
  const [revoking, setRevoking] = useState<Certificate | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-stone/40 px-5 py-3">
        <form className="w-full sm:w-72" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); setPage(1) }}>
          <input className="field py-2 text-[14px]" placeholder={tr('بحث برقم الشهادة أو المالك أو الاسم', 'Search by certificate no., owner or name')} value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => { setTerm(q.trim()); setPage(1) }} />
        </form>
        <select className="field w-auto py-2 text-[14px]" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }} aria-label={tr('الحالة', 'Status')}>
          <option value="">{tr('كل الشهادات', 'All certificates')}</option><option value="active">{tr('غير ملغاة', 'Not revoked')}</option><option value="revoked">{tr('ملغاة', 'Revoked')}</option>
        </select>
        <span className="ms-auto text-[13px] text-muted">{data ? tr(`${num(data.total)} شهادة`, `${num(data.total)} certificates`) : ''}</span>
      </div>
      {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : data?.items.length ? (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('رقم الشهادة', 'Certificate no.')}</th><th>{tr('المالك', 'Owner')}</th><th>{tr('الشمول', 'Covers')}</th><th>{tr('صدرت', 'Issued')}</th><th>{tr('الحالة', 'Status')}</th><th /></tr></thead>
            <tbody>
              {data.items.map((c) => {
                const [l, cls] = certStatus(c.status)
                return (
                  <tr key={c.id}>
                    <td className="num whitespace-nowrap font-bold" dir="ltr" style={{ textAlign: 'start' }}>{c.number}</td>
                    <td><b className="block">{c.ownerNameAr}</b><span className="block text-[12px] text-muted" dir="ltr">{c.ownerNameEn}</span></td>
                    <td className="text-[13.5px]">{c.scope === 'mark' ? <>«{c.items[0]?.name}» <span className="text-muted" dir="ltr">{c.items[0]?.latin}</span></> : tr(`جميع الشعارات (${c.itemCount})`, `All marks (${c.itemCount})`)}</td>
                    <td className="whitespace-nowrap text-[13px] text-muted">{dateTime(c.issuedAt)}</td>
                    <td><span className={`pill ${cls}`}>{l}</span>{c.revokeReason && <span className="block max-w-[14rem] text-[12px] text-bad">{c.revokeReason}</span>}</td>
                    <td className="whitespace-nowrap">
                      <Link to={`/admin/certificates/${c.number}`} className="btn-ghost btn-sm">{tr('عرض', 'View')}</Link>{' '}
                      {c.status !== 'revoked' && <button className="btn-danger btn-sm" onClick={() => { setRevoking(c); setReason('') }}>{tr('إلغاء', 'Revoke')}</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-10 text-center text-muted">{tr('لا توجد شهادات بهذه التصفية.', 'No certificates match this filter.')}</p>}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-line px-5 py-3 text-[14px]">
          <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{tr('السابق', 'Previous')}</button>
          <span className="num">{tr(`صفحة ${page} من ${pages}`, `Page ${page} of ${pages}`)}</span>
          <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{tr('التالي', 'Next')}</button>
        </div>
      )}
      <Modal open={!!revoking} onClose={() => setRevoking(null)} title={tr('إلغاء شهادة', 'Revoke certificate')}>
        {revoking && (
          <div className="space-y-3">
            <p className="text-[15px]">{tr(`إلغاء الشهادة ${revoking.number} للمالك ${revoking.ownerNameAr}؟ تظهر «ملغاة» في صفحة التحقق، ويصل المالك إشعار بالسبب.`, `Revoke certificate ${revoking.number} of ${revoking.ownerNameEn}? The verification page will show it as revoked, and the owner is notified with the reason.`)}</p>
            <label htmlFor="rr" className="block font-bold">{tr('السبب', 'Reason')}</label>
            <textarea id="rr" className="field min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            <div className="flex gap-2">
              <button className="btn-danger flex-1" disabled={busy || reason.trim().length < 5} onClick={async () => {
                setBusy(true)
                try { await api.revokeCertificate(revoking.id, reason.trim()); toast(tr('أُلغيت الشهادة', 'Certificate revoked')); setRevoking(null); reload() } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
              }}>{tr('إلغاء الشهادة', 'Revoke certificate')}</button>
              <button className="btn-ghost" onClick={() => setRevoking(null)}>{tr('رجوع', 'Back')}</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

function LatinRow({ r, onSaved }: { r: ReservedName; onSaved: (n: ReservedName) => void }) {
  const { toast } = useApp()
  const [v, setV] = useState(r.latinOverride ? r.latin ?? '' : '')
  const [busy, setBusy] = useState(false)
  const auto = toLatin(r.name)
  const save = async (val: string) => {
    setBusy(true)
    try { const n = await api.setLatinName(r.id, val); onSaved(n); setV(n.latinOverride ? n.latin ?? '' : ''); toast(tr('حُفظت الكتابة اللاتينية', 'Latin spelling saved')) } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  return (
    <tr>
      <td className="text-[16px] font-extrabold">{r.name}</td>
      <td className="text-[13px] text-muted" dir="ltr" style={{ textAlign: 'start' }}>{auto}</td>
      <td><input className="field py-1.5 text-[14px]" dir="ltr" placeholder={auto} value={v} onChange={(e) => setV(e.target.value)} maxLength={80} aria-label={tr(`الكتابة اللاتينية لـ ${r.name}`, `Latin spelling of ${r.name}`)} /></td>
      <td className="whitespace-nowrap"><b dir="ltr">{r.latin ?? auto}</b>{r.latinOverride && <span className="pill ms-1 bg-gold-soft text-[11px] text-gold-deep">{tr('معدّل', 'Edited')}</span>}</td>
      <td className="whitespace-nowrap">
        <button className="btn-primary btn-sm" disabled={busy || v.trim() === (r.latinOverride ? r.latin ?? '' : '') || !v.trim()} onClick={() => save(v.trim())}>{tr('حفظ', 'Save')}</button>{' '}
        {r.latinOverride && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => save('')}>{tr('استعادة التلقائي', 'Use automatic')}</button>}
      </td>
    </tr>
  )
}

function LatinNames() {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [onlyEdited, setOnlyEdited] = useState(false)
  const { data, loading, error, setData } = useLoad(() => api.listReservedNames(term || undefined), [term])
  const rows = (data ?? []).filter((r) => !onlyEdited || r.latinOverride).slice(0, 300)
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-stone/40 px-5 py-3">
        <form className="w-full sm:w-72" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()) }}>
          <input className="field py-2 text-[14px]" placeholder={tr('بحث بالاسم بالعربية أو الإنجليزية', 'Search by name in Arabic or English')} value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setTerm(q.trim())} />
        </form>
        <label className="flex items-center gap-1.5 text-[13.5px]"><input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} />{tr('المعدّلة فقط', 'Edited only')}</label>
        <p className="ms-auto max-w-md text-[12.5px] text-muted">{tr('تُكتب الأسماء آليًا بالحروف اللاتينية. صحّح ما يحتاج، فيظهر التصحيح في الموقع الإنجليزي والبحث والشهادات الجديدة.', 'Names are spelled in Latin letters automatically. Correct what needs it; the correction shows on the English site, in search and on new certificates.')}</p>
      </div>
      {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : rows.length ? (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('الاسم', 'Name')}</th><th>{tr('الكتابة التلقائية', 'Automatic')}</th><th>{tr('التصحيح', 'Correction')}</th><th>{tr('المعتمدة', 'In use')}</th><th /></tr></thead>
            <tbody>{rows.map((r) => <LatinRow key={r.id} r={r} onSaved={(n) => setData((d) => d?.map((x) => (x.id === n.id ? { ...x, latin: n.latin, latinOverride: n.latinOverride } : x)) ?? d)} />)}</tbody>
          </table>
        </div>
      ) : <p className="px-5 py-10 text-center text-muted">{tr('لا توجد أسماء.', 'No names.')}</p>}
    </section>
  )
}

/** the names registry for staff: issued certificates (certificates.manage) and Latin spellings (names.latin) */
export function AdminCertificates() {
  const { user } = useApp()
  const tabs = [
    can(user, 'certificates.manage') && { id: 'issued', label: tr('الشهادات الصادرة', 'Issued certificates'), icon: 'file' as const },
    can(user, 'names.latin') && { id: 'latin', label: tr('الكتابة اللاتينية', 'Latin spellings'), icon: 'tag' as const },
  ].filter(Boolean) as { id: string; label: string; icon: 'file' | 'tag' }[]
  const [tab, setTab] = useState(tabs[0]?.id ?? 'issued')
  return (
    <>
      <PageHead title={tr('الشهادات والسجل', 'Certificates & registry')} sub={tr('الشهادات التي أصدرها الملاك آليًا، والتحقق منها وإلغاؤها، وتصحيح كتابة الأسماء بالحروف اللاتينية.', 'Certificates owners issued automatically, checking and revoking them, and correcting how names are spelled in Latin letters.')} />
      {tabs.length > 1 && (
        <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-[15px] font-bold ${tab === t.id ? 'border-gold text-pine' : 'border-transparent text-muted hover:text-pine'}`}>
              <Icon name={t.icon} className="h-[18px] w-[18px]" />{t.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'issued' && can(user, 'certificates.manage') && <IssuedList />}
      {tab === 'latin' && can(user, 'names.latin') && <LatinNames />}
    </>
  )
}
