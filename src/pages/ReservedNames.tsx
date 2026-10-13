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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHead title="الأسماء المحجوزة" sub="الأسماء المسجلة لأصحابها. لا يمكن طلب اسم مطابق لأي اسم في هذا السجل." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input className="field max-w-sm" placeholder="ابحث باسم أو مالك" value={q} aria-label="ابحث باسم أو مالك"
          onChange={(e) => { setQ(e.target.value); setSp(e.target.value ? { q: e.target.value } : {}, { replace: true }) }} />
        <Segmented value={type} onChange={setType} options={[['all', 'الكل'], ['qaadan', 'قعدان'], ['bakkar', 'بكار']]} />
        {data && <span className="text-sm text-muted">{data.length} اسم</span>}
      </div>
      {loading && !data ? <Loading /> : data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <li key={r.id} className="panel flex items-center gap-4 p-3">
              <NameSeal name={r.name} type={r.type} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="font-extrabold text-lg">{r.name}</span><TypeBadge type={r.type} /></div>
                <p className="truncate text-sm text-muted">{r.ownerName}</p>
                <p className="text-[13px] text-muted">منذ {date(r.acquiredAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : <Empty title="لا يوجد اسم محجوز بهذا البحث">{q && <p className="text-muted">قد يكون «{q}» متاحًا للطلب.</p>}</Empty>}
    </div>
  )
}
