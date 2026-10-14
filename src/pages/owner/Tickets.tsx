import { Link } from 'react-router-dom'
import { TicketStatusPill, TicketThread } from '../../components/TicketThread'
import { Empty, Loading, PageHead } from '../../components/ui'
import { date } from '../../lib/format'
import { api, useLoad } from '../../lib/store'
import { kindLabel } from '../../lib/tickets'
import { tr } from '../../lib/i18n'

export function MyTickets() {
  const { data, loading } = useLoad(() => api.myTickets(), [])
  return (
    <>
      <PageHead title={tr('الشكاوى والاستفسارات', 'Complaints & inquiries')} sub={tr('طلباتك المقدّمة من صفحة تواصل معنا وردود فريق سمّها عليها.', 'Requests you submitted via the Contact us page, and the Sammha team’s replies.')}
        action={<Link to="/contact" className="btn-primary">{tr('طلب جديد', 'New request')}</Link>} />
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
                <Link to={`/contact/track/${t.number}`} className="mt-4 inline-block text-[14px] font-bold text-gold-deep hover:underline">{tr('إضافة رد أو متابعة', 'Reply or follow up')}</Link>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <Empty title={tr('لا توجد طلبات بعد', 'No requests yet')}>
          <p className="text-muted">{tr('لأي شكوى أو بلاغ أو استفسار، قدّم طلبًا وستحصل على رقم متابعة.', 'For any complaint, report or inquiry, submit a request and you will get a tracking number.')}</p>
          <Link to="/contact" className="btn-primary">{tr('تواصل معنا', 'Contact us')}</Link>
        </Empty>
      )}
    </>
  )
}
