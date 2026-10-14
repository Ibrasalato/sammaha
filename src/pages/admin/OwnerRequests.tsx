import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/dash'
import type { IconName } from '../../components/dash'
import { PageHead } from '../../components/ui'
import { tr } from '../../lib/i18n'
import { canAny } from '../../lib/permissions'
import type { Permission } from '../../lib/permissions'
import { api, useApp, useLoad } from '../../lib/store'
import { AdminRequestsBoard } from './RequestsBoard'
import { AdminTransfers } from './Transfers'
import { AdminLogos } from './Logos'

type Tab = 'mark' | 'transfer' | 'compound' | 'investment' | 'logo'
const TABS: { id: Tab; label: () => string; icon: IconName; perms: Permission[] }[] = [
  { id: 'mark', label: () => tr('التقديم على شعار', 'Mark requests'), icon: 'file', perms: ['requests.view'] },
  { id: 'transfer', label: () => tr('نقل ملكية', 'Ownership transfers'), icon: 'users', perms: ['names.transfer'] },
  { id: 'compound', label: () => tr('إضافة اسم مركب', 'Compound names'), icon: 'plus', perms: ['requests.view'] },
  { id: 'investment', label: () => tr('شعارات الاستثمار', 'Name investment'), icon: 'coins', perms: ['requests.view'] },
  { id: 'logo', label: () => tr('لوجوهات الشعارات', 'Mark logos'), icon: 'tag', perms: ['names.logos'] },
]

/** every request owners send, one tab per kind (each tab keeps its own search and filters) */
export function AdminOwnerRequests() {
  const { user } = useApp()
  const [sp, setSp] = useSearchParams()
  const tabs = TABS.filter((t) => canAny(user, t.perms))
  const tab = tabs.find((t) => t.id === sp.get('tab'))?.id ?? tabs[0]?.id
  // waiting counts on each tab
  const can = (p: Permission) => canAny(user, [p])
  const reqs = useLoad(() => (can('requests.view') ? api.listRequests('under_review') : Promise.resolve([])), [])
  const transfers = useLoad(() => (can('names.transfer') ? api.adminTransfers('under_review') : Promise.resolve([])), [])
  const logos = useLoad(() => (can('names.logos') ? api.adminLogos('pending') : Promise.resolve([])), [])
  const count: Record<Tab, number> = {
    mark: (reqs.data ?? []).filter((r) => (r.kind ?? 'standard') === 'standard').length,
    compound: (reqs.data ?? []).filter((r) => r.kind === 'compound').length,
    investment: (reqs.data ?? []).filter((r) => r.kind === 'investment').length,
    transfer: transfers.data?.length ?? 0,
    logo: logos.data?.length ?? 0,
  }
  return (
    <>
      <PageHead title={tr('الطلبات', 'Requests')} sub={tr('كل ما يرسله الملاك في مكان واحد: لكل نوع تبويب ببحثه وفلاتره. الرقم بجانب التبويب يعني طلبات بانتظار المراجعة.', 'Everything owners send, in one place: each kind has its own tab with search and filters. The number beside a tab is requests awaiting review.')} />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setSp({ tab: t.id }, { replace: true })}
            className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-[15px] font-bold transition-colors ${tab === t.id ? 'text-pine after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t after:bg-gold' : 'text-muted hover:text-pine'}`}>
            <Icon name={t.icon} className="h-4 w-4" />{t.label()}
            {count[t.id] > 0 && <span className="num grid min-w-6 place-items-center rounded-full bg-gold px-1.5 text-[12px] text-ink">{count[t.id]}</span>}
          </button>
        ))}
      </div>
      {tab === 'mark' && <AdminRequestsBoard kind="standard" embedded />}
      {tab === 'compound' && <AdminRequestsBoard kind="compound" embedded />}
      {tab === 'investment' && <AdminRequestsBoard kind="investment" embedded />}
      {tab === 'transfer' && <AdminTransfers embedded />}
      {tab === 'logo' && <AdminLogos embedded />}
    </>
  )
}
