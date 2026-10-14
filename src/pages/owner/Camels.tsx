import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { ErrorBox, Loading, Modal, NameSeal, PageHead, TypeBadge } from '../../components/ui'
import { dateTime } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { OwnedCamel, ReservedName } from '../../lib/types'

export const sexLabel = (s?: string) => (s === 'male' ? tr('ذكر', 'Male') : s === 'female' ? tr('أنثى', 'Female') : s || '—')
/** male | female | null (unknown), as the registry may send it */
const sexOf = (s?: string) => (s === 'male' || s === 'ذكر' ? 'male' : s === 'female' || s === 'أنثى' ? 'female' : null)

function Chips({ c }: { c: OwnedCamel }) {
  return c.chipNumbers.length
    ? <span className="flex flex-col gap-0.5">{c.chipNumbers.map((n) => <span key={n} className="num text-[14px]" dir="ltr">{n}</span>)}</span>
    : <span>—</span>
}

/** «ربط بشريحة»: choose one of the owner's camels without a linked name (قعود → male, بكرة → female; unknown sex is shown too) */
export function LinkChipModal({ name, onClose, onDone }: { name: ReservedName; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const { data, loading, error } = useLoad(() => api.myCamels(), [])
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const want = name.type === 'qaadan' ? 'male' : 'female'
  const free = (data?.camels ?? []).filter((c) => !c.reservedId && (sexOf(c.sex) === null || sexOf(c.sex) === want))
  async function link() {
    setBusy(true); setErr('')
    try {
      const c = await api.linkCamel(chosen, name.id)
      toast(tr(`رُبط «${name.name}» بالشريحة ${c.chipNumbers[0] ?? ''}`, `«${name.name}» was linked to chip ${c.chipNumbers[0] ?? ''}`))
      onDone()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={tr(`ربط «${name.name}» بشريحة`, `Link «${name.name}» to a chip`)} wide>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <NameSeal name={name.name} type={name.type} size="sm" latin={name.latin} /><TypeBadge type={name.type} />
          <p className="text-[14px] text-muted">{want === 'male' ? tr('أسماء القعدان تُربط بالذكور.', 'Qa’dan names go on males.') : tr('أسماء البكار تُربط بالإناث.', 'Bakkar names go on females.')}</p>
        </div>
        {err && <ErrorBox text={err} />}
        {error ? <ErrorBox text={error} /> : loading && !data ? <Loading /> : free.length ? (
          <fieldset className="space-y-2">
            <legend className="label">{tr('اختر من إبلك التي لا تحمل اسمًا', 'Choose from your camels with no name')}</legend>
            {free.map((c) => (
              <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 ${chosen === c.id ? 'border-pine bg-pine-soft/50' : 'border-line'}`}>
                <input type="radio" name="chip" checked={chosen === c.id} onChange={() => setChosen(c.id)} />
                <span className="min-w-[9rem] flex-1"><Chips c={c} />{c.name && <span className="block text-[12.5px] text-muted">{c.name}</span>}</span>
                <span className="text-[13.5px] text-muted">{sexLabel(c.sex)} · {c.color || '—'} · {c.age || '—'}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="rounded-lg bg-stone p-4 text-[14.5px] leading-7 text-muted">
            <b className="block text-ink">{tr('لا توجد إبل بلا اسم مرتبط حاليًا', 'No camels without a linked name yet')}</b>
            {tr('تأتي بيانات الإبل والشرائح من منصة KACF بعد الربط، وتظهر هنا الإبل المناسبة لنوع الاسم والتي لم يُربط بها اسم.', 'Camel and chip data come from the KACF platform once linked; camels that suit this name type and carry no name appear here.')}
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!chosen || busy} onClick={link}>{busy ? tr('جارٍ الربط…', 'Linking…') : tr('ربط الاسم بالشريحة', 'Link name to chip')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('رجوع', 'Back')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** «إبلي»: the camels registered to the owner on KACF. Nothing is entered here; the data arrives with the integration. */
export function MyCamelsPage() {
  const { data, loading, error } = useLoad(() => api.myCamels(), [])
  const camels = data?.camels ?? []
  const tf = useTableFilter<OwnedCamel>(data?.camels, {
    fields: (c) => [c.name ?? '', ...c.chipNumbers, c.color ?? '', c.type ?? '', c.status ?? '', c.reservedName ?? ''],
  })
  return (
    <>
      <PageHead title={tr('إبلي', 'My camels')} sub={tr('تأتي بيانات الإبل والشرائح من منصة KACF بعد الربط. اربط أسماء القعدان والبكار بشرائحها من «أسمائي».', 'Camel and chip data come from the KACF platform once linked. Link your Qa’dan and Bakkar names to their chips from “My names”.')} />
      {error ? <ErrorBox text={error} /> : loading && !data ? <Loading /> : camels.length ? (
        <>
          {data?.lastSyncedAt && <p className="mb-3 text-[13.5px] text-muted">{tr('آخر تحديث من KACF', 'Last updated from KACF')}: {dateTime(data.lastSyncedAt)}</p>}
          <TableTools t={tf} placeholder={tr('بحث بالاسم أو رقم الشريحة', 'Search by name or chip number')} />
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{tr('أرقام الشرائح', 'Chip numbers')}</th><th>{tr('الاسم المرتبط', 'Linked name')}</th><th>{tr('الجنس', 'Sex')}</th><th>{tr('اللون', 'Colour')}</th>
                  <th>{tr('الفئة', 'Category')}</th><th>{tr('العمر', 'Age')}</th><th>{tr('الحالة', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {!tf.list.length && <NoResults cols={7} onReset={tf.reset} />}
                {tf.list.map((c) => (
                  <tr key={c.id}>
                    <td><Chips c={c} />{c.name && <span className="block text-[12.5px] text-muted">{c.name}</span>}</td>
                    <td>{c.reservedName
                      ? <Link to="/dashboard/names" className="inline-flex flex-wrap items-center gap-1.5 font-extrabold text-pine underline">{c.reservedName}{c.reservedType && <TypeBadge type={c.reservedType} />}</Link>
                      : <span className="text-muted">{tr('غير مرتبط', 'Not linked')}</span>}</td>
                    <td className="whitespace-nowrap">{sexLabel(c.sex)}</td>
                    <td>{c.color || '—'}</td>
                    <td>{c.type || '—'}</td>
                    <td className="whitespace-nowrap">{c.age || '—'}</td>
                    <td>{c.status ? <span className="pill bg-stone text-ink/80">{c.status}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-pine-soft text-pine"><Icon name="shield" className="h-7 w-7" /></span>
          <p className="text-lg font-extrabold">{data?.connected ? tr('لا توجد إبل مسجلة باسمك', 'No camels are registered to you') : tr('لم يكتمل الربط مع KACF بعد', 'KACF is not linked yet')}</p>
          <p className="max-w-lg leading-7 text-muted">
            {data?.connected
              ? tr('تظهر هنا الإبل المسجلة باسمك ورقم هويتك في KACF فور تسجيلها هناك.', 'Camels registered to your name and national ID on KACF appear here as soon as they are registered there.')
              : tr('تأتي بيانات الإبل والشرائح من منصة KACF بعد الربط: أرقام الشرائح والجنس واللون والفئة والعمر، مع الاسم المرتبط بكل منها من أسمائك. لا تحتاج إلى إدخال أي بيانات.', 'Camel and chip data come from the KACF platform once linked: chip numbers, sex, colour, category and age, with the name from your names linked to each. You do not need to enter anything.')}
          </p>
          <Link to="/dashboard/names" className="btn-ghost btn-sm mt-1">{tr('أسمائي', 'My names')}</Link>
        </div>
      )}
    </>
  )
}
