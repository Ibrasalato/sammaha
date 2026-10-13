import { Link } from 'react-router-dom'
import { TicketStatusPill, TicketThread } from '../../components/TicketThread'
import { Empty, Loading, PageHead } from '../../components/ui'
import { date } from '../../lib/format'
import { api, useLoad } from '../../lib/store'
import { kindLabel } from '../../lib/tickets'

export function MyTickets() {
  const { data, loading } = useLoad(() => api.myTickets(), [])
  return (
    <>
      <PageHead title="الشكاوى والاستفسارات" sub="طلباتك المقدّمة من صفحة تواصل معنا وردود فريق سمّها عليها."
        action={<Link to="/contact" className="btn-primary">طلب جديد</Link>} />
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="space-y-4">
          {data.map((t) => (
            <details key={t.id} className="panel group overflow-hidden" open={t.status === 'answered'}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-stone">
                <span className="num font-bold" dir="ltr">{t.number}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{t.subject}</span>
                <span className="text-[14px] text-muted">{kindLabel(t.kind)} · {date(t.createdAt)}</span>
                <TicketStatusPill status={t.status} />
              </summary>
              <div className="border-t border-line p-5">
                <TicketThread t={t} />
                <Link to={`/contact/track/${t.number}`} className="mt-4 inline-block text-[14px] font-bold text-gold-deep hover:underline">إضافة رد أو متابعة</Link>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <Empty title="لا توجد طلبات بعد">
          <p className="text-muted">لأي شكوى أو بلاغ أو استفسار، قدّم طلبًا وستحصل على رقم متابعة.</p>
          <Link to="/contact" className="btn-primary">تواصل معنا</Link>
        </Empty>
      )}
    </>
  )
}
