import { TYPE_LABEL } from '../lib/config'
import { tr } from '../lib/i18n'
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
    <div className="wrap py-10">
      <PageHead title={tr('المزادات', 'Auctions')} sub={tr('السعر الافتتاحي لكل اسم 50 ريال. يرسو الاسم على أعلى مزايد عند انتهاء الوقت.', 'Every name opens at SAR 50 and is awarded to the highest bidder when time runs out.')} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented value={phase} onChange={setPhase} options={[['live', tr('جارية', 'Live')], ['scheduled', tr('قادمة', 'Upcoming')], ['ended', tr('منتهية', 'Ended')], ['all', tr('الكل', 'All')]]} />
        <Segmented value={type} onChange={setType} options={[['all', tr('الكل', 'All')], ['qaadan', TYPE_LABEL.qaadan], ['bakkar', TYPE_LABEL.bakkar]]} />
        <input className="field max-w-xs" placeholder={tr('ابحث باسم', 'Search a name')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('ابحث باسم', 'Search a name')} />
      </div>
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.map((a) => <AuctionCard key={a.id} a={a} />)}</div>
      ) : <Empty title={tr('لا توجد مزادات بهذه التصفية', 'No auctions match this filter')} />}
    </div>
  )
}
