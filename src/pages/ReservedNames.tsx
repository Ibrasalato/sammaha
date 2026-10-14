import { typeOptions } from '../lib/config'
import { tr } from '../lib/i18n'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Empty, Loading, NameSeal, PageHead, Segmented, TypeBadge } from '../components/ui'
import { date } from '../lib/format'
import { api, useLoad } from '../lib/store'
import type { NameType } from '../lib/types'

export default function ReservedNames() {
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [type, setType] = useState<NameType | 'all'>('all')
  const { data, loading } = useLoad(() => api.listReservedNames(q, type), [q, type])

  return (
    <div className="wrap py-10">
      <PageHead title={tr('الأسماء المحجوزة', 'Names registry')} sub={tr('الأسماء المسجلة لأصحابها. لا يمكن طلب اسم مطابق لأي اسم في هذا السجل.', 'Names registered to their owners. A name identical to any name here cannot be requested.')} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input className="field max-w-sm" placeholder={tr('ابحث باسم أو مالك (بالعربية أو الإنجليزية)', 'Search a name (Arabic or English) or owner')} value={q} aria-label={tr('ابحث باسم أو مالك', 'Search a name or owner')}
          onChange={(e) => { setQ(e.target.value); setSp(e.target.value ? { q: e.target.value } : {}, { replace: true }) }} />
        <Segmented value={type} onChange={setType} options={typeOptions('all', tr('الكل', 'All'))} />
        {data && <span className="text-sm text-muted">{data.length} {tr('اسم', 'names')}</span>}
      </div>
      {loading && !data ? <Loading /> : data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <li key={r.id} className="panel flex items-center gap-4 p-3">
              <NameSeal name={r.name} type={r.type} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="font-extrabold text-lg">{r.name}</span>{r.latin && <span className="truncate text-[13px] font-semibold text-muted" dir="ltr">{r.latin}</span>}<TypeBadge type={r.type} /></div>
                <p className="truncate text-sm text-muted">{r.ownerName}</p>
                <p className="text-[13px] text-muted">{tr('منذ', 'Since')} {date(r.acquiredAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : <Empty title={tr('لا يوجد اسم محجوز بهذا البحث', 'No registered name matches this search')}>{q && <p className="text-muted">{tr(`قد يكون «${q}» متاحًا للطلب.`, `“${q}” may be available to request.`)}</p>}</Empty>}
    </div>
  )
}
