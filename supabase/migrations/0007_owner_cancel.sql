-- ════════════════════════════════════════════════════════════════
-- Sammha — the owner can cancel a request and get the guarantee back in the wallet:
-- before review, or after acceptance as long as none of its auctions has started.
-- ════════════════════════════════════════════════════════════════

alter table public.requests add column if not exists cancelled_at timestamptz;
alter table public.requests add column if not exists cancelled_by text check (cancelled_by in ('owner','committee'));
alter table public.requests add column if not exists cancel_reason text;

create or replace function public.request_cancellable(r public.requests) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when r.status in ('pending_payment','under_review') then true
    when r.status <> 'accepted' then false
    else not exists (select 1 from auctions a where a.request_id = r.id and (a.starts_at <= now() or a.bid_count > 0))
  end
$$;

create or replace function public.j_request(r public.requests) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'number', r.number, 'userId', r.user_id,
    'ownerName', (select full_name from profiles where id = r.user_id), 'type', r.type, 'status', r.status,
    'depositAmount', r.deposit_amount, 'depositPaid', r.deposit_paid, 'depositState', r.deposit_state,
    'createdAt', r.created_at, 'submittedAt', r.submitted_at, 'reviewedAt', r.reviewed_at,
    'reviewerName', (select full_name from profiles where id = r.reviewer_id), 'reviewNote', r.review_note,
    'cancellable', public.request_cancellable(r), 'cancelledAt', r.cancelled_at, 'cancelledBy', r.cancelled_by, 'cancelReason', r.cancel_reason,
    'candidates', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'normalized', c.normalized,
        'status', c.status, 'similar', c."similar", 'rejectReason', c.reject_reason, 'auctionId', c.auction_id) order by c.position)
      from candidates c where c.request_id = r.id), '[]'))
$$;

drop function if exists public.cancel_my_request(uuid);
create or replace function public.cancel_my_request(p_request uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r requests; held numeric := 0;
begin
  select * into r from requests where id = p_request and user_id = public.uid_or_fail() for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if r.status = 'cancelled' then raise exception 'الطلب ملغى مسبقًا'; end if;
  -- lock the request's auctions so a bid can't land while we cancel
  perform 1 from auctions where request_id = r.id for update;
  if not public.request_cancellable(r) then
    raise exception '%', case when r.status = 'accepted' then 'بدأ مزاد أحد أسماء هذا الطلب، فلا يمكن إلغاؤه الآن' else 'لا يمكن إلغاء هذا الطلب' end;
  end if;
  -- scheduled auctions that have not started are removed
  update candidates set auction_id = null where request_id = r.id;
  delete from auctions where request_id = r.id;
  if r.deposit_state = 'held' then held := r.deposit_amount; end if;
  update requests set status = 'cancelled', cancelled_at = now(), cancelled_by = 'owner',
    cancel_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), '') where id = r.id;
  perform public.refund_deposit(r.id, 'ألغاه المالك');
  if held > 0 then
    perform public.notify(r.user_id, 'refund', 'أُعيد ضمان المزاد إلى محفظتك', format('%s ريال من الطلب %s (ألغيته).', held, r.number), '/dashboard/wallet');
  end if;
  return jsonb_build_object('refunded', held);
end $$;
