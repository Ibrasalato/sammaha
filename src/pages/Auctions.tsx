import { typeOptions } from '../lib/config'
import { tr } from '../lib/i18n'
import { useEffect, useState } from 'react'
import { AuctionGrid, CardStylePicker } from '../components/AuctionCard'
import { Empty, Loading, PageHead, Segmented } from '../components/ui'
import { api, useLoad } from '../lib/store'
import type { AuctionPhase, NameType } from '../lib/types'

export default function Auctions() {
  const [phase, setPhase] = useState<AuctionPhase | 'all'>('live')
  const [type, setType] = useState<NameType | 'all'>('all')
  const [q, setQ] = useState('')
  const { data, loading, reload } = useLoad(() => api.listAuctions({ phase, type, q }), [phase, type, q], 15000)
  // live prices: reload (at most once a second) when any listed auction changes
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const stop = api.subscribeLive?.({ onAuction: () => { t ??= setTimeout(() => { t = undefined; reload() }, 1000) } })
    return () => { clearTimeout(t); stop?.() }
  }, [reload])

  return (
    <div className="wrap py-10">
      <PageHead title={tr('المزادات', 'Auctions')} sub={tr('السعر الافتتاحي لكل اسم 50 ريال. يرسو الاسم على أعلى مزايد عند انتهاء الوقت.', 'Every name opens at SAR 50 and is awarded to the highest bidder when time runs out.')} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented value={phase} onChange={setPhase} options={[['live', tr('جارية', 'Live')], ['scheduled', tr('قادمة', 'Upcoming')], ['ended', tr('منتهية', 'Ended')], ['all', tr('الكل', 'All')]]} />
        <Segmented value={type} onChange={setType} options={typeOptions('all', tr('الكل', 'All'))} />
        <input className="field max-w-xs" placeholder={tr('ابحث باسم', 'Search a name')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('ابحث باسم', 'Search a name')} />
      </div>
      <CardStylePicker className="mb-5 border-y border-line py-3" />
      {loading && !data ? <Loading /> : data?.length ? (
        <AuctionGrid list={data} />
      ) : <Empty title={tr('لا توجد مزادات بهذه التصفية', 'No auctions match this filter')} />}
    </div>
  )
}
