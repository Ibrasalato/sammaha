import { useState } from 'react'
import { AuctionCard } from '../components/AuctionCard'
import { Empty, Loading, PageHead, Segmented } from '../components/ui'
import { api, useLoad } from '../lib/store'
import type { AuctionPhase, NameType } from '../lib/types'

export default function Auctions() {
  const [phase, setPhase] = useState<AuctionPhase | 'all'>('live')
  const [type, setType] = useState<NameType | 'all'>('all')
  const [q, setQ] = useState('')
  const { data, loading } = useLoad(() => api.listAuctions({ phase, type, q }), [phase, type, q], 15000)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHead title="المزادات" sub="السعر الافتتاحي لكل اسم 50 ريال. يرسو الاسم على أعلى مزايد عند انتهاء الوقت." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented value={phase} onChange={setPhase} options={[['live', 'جارية'], ['scheduled', 'قادمة'], ['ended', 'منتهية'], ['all', 'الكل']]} />
        <Segmented value={type} onChange={setType} options={[['all', 'الكل'], ['qaadan', 'قعدان'], ['bakkar', 'بكار']]} />
        <input className="field max-w-xs" placeholder="ابحث باسم" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ابحث باسم" />
      </div>
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.map((a) => <AuctionCard key={a.id} a={a} />)}</div>
      ) : <Empty title="لا توجد مزادات بهذه التصفية" />}
    </div>
  )
}
