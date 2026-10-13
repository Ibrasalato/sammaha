-- ════════════════════════════════════════════════════════════════
-- Sammha — the owner withdraws any single name from a request, or all of them.
-- Withdrawing the last remaining name cancels the request and refunds the guarantee.
-- A name can be withdrawn while pending or accepted and its auction (if any) has not started.
-- ════════════════════════════════════════════════════════════════

alter table public.candidates drop constraint if exists candidates_status_check;
alter table public.candidates add constraint candidates_status_check check (status in ('pending','accepted','rejected','withdrawn'));
alter table public.candidates add column if not exists withdrawn_at timestamptz;

create or replace function public.candidate_withdrawable(r public.requests, c public.candidates) returns boolean
language sql stable security definer set search_path = public as $$
  select r.status in ('pending_payment','under_review','accepted') and c.status in ('pending','accepted')
    and not exists (select 1 from auctions a where a.id = c.auction_id and (a.starts_at <= now() or a.bid_count > 0))
$$;

create or replace function public.j_request(r public.requests) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'number', r.number, 'userId', r.user_id,
    'ownerName', (select full_name from profiles where id = r.user_id), 'type', r.type, 'status', r.status,
    'depositAmount', r.deposit_amount, 'depositPaid', r.deposit_paid, 'depositState', r.deposit_state,
    'createdAt', r.created_at, 'submittedAt', r.submitted_at, 'reviewedAt', r.reviewed_at,
    'reviewerName', (select full_name from profiles where id = r.reviewer_id), 'reviewNote', r.review_note,
    'cancellable', public.request_cancellable(r), 'cancelledAt', r.cancelled_at, 'cancelledBy', r.cancelled_by, 'cancelReason', r.cancel_reason,
    'candidates', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'normalized', c.normalized,
        'status', c.status, 'similar', c."similar", 'rejectReason', c.reject_reason, 'auctionId', c.auction_id,
        'withdrawnAt', c.withdrawn_at, 'withdrawable', public.candidate_withdrawable(r, c)) order by c.position)
      from candidates c where c.request_id = r.id), '[]'))
$$;

-- withdrawn names are free again for everyone
create or replace function public.find_similar(p_norm text, p_exclude uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  with pool as (
    select name, normalized, type, 'reserved'::text as source from reserved_names
    union all
    select c.name, c.normalized, r.type, case when c.auction_id is null then 'request' else 'auction' end
    from candidates c join requests r on r.id = c.request_id
    left join auctions a on a.id = c.auction_id
    where r.status in ('pending_payment','under_review','accepted') and c.status not in ('rejected','withdrawn')
      and (p_exclude is null or r.id <> p_exclude) and coalesce(a.settled, false) = false
  ), scored as (
    select name, type, source, public.name_similarity(p_norm, normalized) as score from pool
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'type', type, 'source', source, 'score', score) order by score desc), '[]')
  from (select * from scored where score >= (select similar_threshold from app_settings) order by score desc limit 8) t
$$;

create or replace function public.withdraw_name(p_request uuid, p_candidate uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r requests; c candidates; held numeric := 0; refunded numeric := 0;
begin
  select * into r from requests where id = p_request and user_id = public.uid_or_fail() for update;
  if not found then raise exception 'الاسم غير موجود'; end if;
  select * into c from candidates where id = p_candidate and request_id = r.id for update;
  if not found then raise exception 'الاسم غير موجود'; end if;
  perform 1 from auctions where request_id = r.id for update;
  if not public.candidate_withdrawable(r, c) then
    raise exception '%', case when c.status = 'withdrawn' then 'سُحب هذا الاسم مسبقًا' when c.auction_id is not null then 'بدأ مزاد هذا الاسم، فلا يمكن سحبه' else 'لا يمكن سحب هذا الاسم' end;
  end if;
  if c.auction_id is not null then
    update candidates set auction_id = null where id = c.id;
    delete from auctions where id = c.auction_id;
  end if;
  update candidates set status = 'withdrawn', withdrawn_at = now() where id = c.id;

  if exists (select 1 from candidates where request_id = r.id and status in ('pending','accepted')) then
    return jsonb_build_object('refunded', 0, 'requestCancelled', false);
  end if;
  if r.deposit_state = 'held' then held := r.deposit_amount; end if;
  if not exists (select 1 from auctions where request_id = r.id) then
    update requests set status = 'cancelled', cancelled_at = now(), cancelled_by = 'owner', cancel_reason = 'سحب المالك كل الأسماء' where id = r.id;
    perform public.refund_deposit(r.id, 'سحب المالك كل الأسماء');
    if held > 0 then
      perform public.notify(r.user_id, 'refund', 'أُعيد ضمان المزاد إلى محفظتك', format('%s ريال من الطلب %s (سحبت كل الأسماء).', held, r.number), '/dashboard/wallet');
    end if;
    return jsonb_build_object('refunded', held, 'requestCancelled', true);
  end if;
  -- other names already went to auction: refund only when all settled and none was won by the owner (deposit still held)
  if not exists (select 1 from auctions where request_id = r.id and not settled) and held > 0 then
    perform public.refund_deposit(r.id, 'لم يُرسَ عليك أي اسم');
    refunded := held;
  end if;
  return jsonb_build_object('refunded', refunded, 'requestCancelled', false);
end $$;

-- the committee never decides on a withdrawn name
create or replace function public.admin_review_request(p_id uuid, p_decisions jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare staff profiles := public.require_staff(); r requests; d jsonb; c candidates; exact jsonb;
begin
  select * into r from requests where id = p_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if r.status <> 'under_review' then raise exception 'تمت مراجعة هذا الطلب'; end if;
  for d in select * from jsonb_array_elements(p_decisions) loop
    select * into c from candidates where id = (d->>'candidateId')::uuid and request_id = r.id;
    if not found or c.status = 'withdrawn' then continue; end if;
    if d->>'status' = 'accepted' then
      select h into exact from jsonb_array_elements(public.find_similar(c.normalized, r.id)) h where (h->>'score')::numeric = 1 limit 1;
      if exact is not null then raise exception 'لا يمكن قبول «%»: مطابق لـ«%»', c.name, exact->>'name'; end if;
      update candidates set status = 'accepted', reject_reason = null where id = c.id;
    elsif d->>'status' = 'rejected' then
      update candidates set status = 'rejected', reject_reason = coalesce(nullif(d->>'reason', ''), 'مشابه لاسم مسجل') where id = c.id;
    end if;
  end loop;
  if exists (select 1 from candidates where request_id = r.id and status = 'pending') then raise exception 'حدد قرارًا لكل اسم'; end if;
  if exists (select 1 from candidates where request_id = r.id and status = 'accepted') then
    update requests set status = 'accepted', reviewed_at = now(), reviewer_id = staff.id, review_note = p_note where id = r.id returning * into r;
  else
    update requests set status = 'rejected', reviewed_at = now(), reviewer_id = staff.id, review_note = p_note where id = r.id returning * into r;
    perform public.refund_deposit(r.id, 'مرفوض');
  end if;
  return public.j_request(r);
end $$;

create or replace function public.admin_reject_request(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare staff profiles := public.require_staff(); r requests;
begin
  update requests set status = 'rejected', reviewed_at = now(), reviewer_id = staff.id, review_note = p_reason
  where id = p_id and status = 'under_review' returning * into r;
  if not found then raise exception 'لا يمكن رفض هذا الطلب'; end if;
  update candidates set status = 'rejected', reject_reason = p_reason where request_id = r.id and status <> 'withdrawn';
  perform public.refund_deposit(r.id, 'مرفوض');
  return public.j_request(r);
end $$;

-- congratulate the winner
create or replace function public.trg_auction_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.requester_id, 'auction_opened', format('حُدّد موعد مزاد «%s»', new.name),
      format('يبدأ %s بتوقيت الرياض.', to_char(new.starts_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI')), '/auctions/' || new.id);
  elsif new.settled and not old.settled then
    perform public.notify(new.winner_id, 'won', format('مبارك عليك الفوز بمزاد شعار «%s»', new.name),
      format('بسعر %s ريال. فاتورتك الإلكترونية جاهزة، سدّدها لإصدار شهادة التسجيل.', new.final_price), '/dashboard/invoices');
    for u in select distinct user_id from bids where auction_id = new.id and user_id <> new.winner_id loop
      perform public.notify(u, 'lost', format('انتهى مزاد «%s»', new.name), format('رسا الاسم بسعر %s ريال.', new.final_price), '/auctions/' || new.id);
    end loop;
  end if;
  return new;
end $$;
