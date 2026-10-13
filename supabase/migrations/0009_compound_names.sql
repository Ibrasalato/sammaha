-- ════════════════════════════════════════════════════════════════
-- Sammha — compound names: an owner asks for a compound name built on a name he already
-- holds (e.g. «مدعث» → «مدعث الشمال»). The committee reviews it; on approval it is
-- registered to him directly, with no auction and no guarantee.
-- ════════════════════════════════════════════════════════════════

alter table public.requests add column if not exists kind text not null default 'standard' check (kind in ('standard','compound'));
alter table public.requests add column if not exists base_reserved_id uuid references public.reserved_names;
alter table public.reserved_names drop constraint if exists reserved_names_source_check;
alter table public.reserved_names add constraint reserved_names_source_check check (source in ('auction','legacy','compound'));
alter table public.reserved_names add column if not exists base_name text;

create or replace function public.request_cancellable(r public.requests) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when r.status in ('pending_payment','under_review') then true
    when r.status <> 'accepted' or r.kind = 'compound' then false
    else not exists (select 1 from auctions a where a.request_id = r.id and (a.starts_at <= now() or a.bid_count > 0))
  end
$$;

create or replace function public.candidate_withdrawable(r public.requests, c public.candidates) returns boolean
language sql stable security definer set search_path = public as $$
  select r.kind = 'standard' and r.status in ('pending_payment','under_review','accepted') and c.status in ('pending','accepted')
    and not exists (select 1 from auctions a where a.id = c.auction_id and (a.starts_at <= now() or a.bid_count > 0))
$$;

create or replace function public.j_request(r public.requests) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'number', r.number, 'userId', r.user_id,
    'ownerName', (select full_name from profiles where id = r.user_id), 'type', r.type, 'status', r.status,
    'depositAmount', r.deposit_amount, 'depositPaid', r.deposit_paid, 'depositState', r.deposit_state,
    'createdAt', r.created_at, 'submittedAt', r.submitted_at, 'reviewedAt', r.reviewed_at,
    'reviewerName', (select full_name from profiles where id = r.reviewer_id), 'reviewNote', r.review_note,
    'cancellable', public.request_cancellable(r), 'cancelledAt', r.cancelled_at, 'cancelledBy', r.cancelled_by, 'cancelReason', r.cancel_reason,
    'kind', r.kind, 'baseReservedId', r.base_reserved_id, 'baseName', (select name from reserved_names where id = r.base_reserved_id),
    'candidates', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'normalized', c.normalized,
        'status', c.status, 'similar', c."similar", 'rejectReason', c.reject_reason, 'auctionId', c.auction_id,
        'withdrawnAt', c.withdrawn_at, 'withdrawable', public.candidate_withdrawable(r, c)) order by c.position)
      from candidates c where c.request_id = r.id), '[]'))
$$;

-- an approved compound name is already in reserved_names, so leave its candidate out of the pool
create or replace function public.find_similar(p_norm text, p_exclude uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  with pool as (
    select name, normalized, type, 'reserved'::text as source from reserved_names
    union all
    select c.name, c.normalized, r.type, case when c.auction_id is null then 'request' else 'auction' end
    from candidates c join requests r on r.id = c.request_id
    left join auctions a on a.id = c.auction_id
    where r.status in ('pending_payment','under_review','accepted') and c.status not in ('rejected','withdrawn')
      and not (r.kind = 'compound' and r.status = 'accepted')
      and (p_exclude is null or r.id <> p_exclude) and coalesce(a.settled, false) = false
  ), scored as (
    select name, type, source, public.name_similarity(p_norm, normalized) as score from pool
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'type', type, 'source', source, 'score', score) order by score desc), '[]')
  from (select * from scored where score >= (select similar_threshold from app_settings) order by score desc limit 8) t
$$;

create or replace function public.create_compound_request(p_reserved uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare base reserved_names; nm text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'); norm text; chk jsonb; r requests; inv text;
begin
  select * into base from reserved_names where id = p_reserved and owner_id = public.uid_or_fail();
  if not found then raise exception 'اختر اسمًا من أسمائك المسجلة'; end if;
  select number into inv from invoices where user_id = auth.uid() and name = base.name and status = 'unpaid' limit 1;
  if inv is not null then raise exception 'سدّد فاتورة «%» أولًا (%)', base.name, inv; end if;
  norm := public.normalize_name(nm);
  if position(base.normalized in norm) = 0 or norm = base.normalized then raise exception 'الاسم المركب يتكون من «%» مع كلمة أخرى', base.name; end if;
  if array_length(string_to_array(nm, ' '), 1) > 4 or length(nm) > 40 then raise exception 'الاسم المركب طويل، اكتفِ بكلمتين أو ثلاث'; end if;
  chk := public.check_names(array[nm], base.type) -> 0;
  if chk->>'verdict' = 'invalid' then raise exception '%', coalesce(chk->>'message', 'الاسم غير صالح'); end if;
  if chk->>'verdict' = 'exact' then raise exception '«%» مسجل أو مطلوب مسبقًا', nm; end if;
  if exists (select 1 from requests where kind = 'compound' and base_reserved_id = base.id and status = 'under_review') then
    raise exception 'لديك طلب اسم مركب لـ«%» تحت المراجعة', base.name;
  end if;
  insert into requests (user_id, type, kind, base_reserved_id, status, deposit_amount, submitted_at)
  values (auth.uid(), base.type, 'compound', base.id, 'under_review', 0, now()) returning * into r;
  insert into candidates (request_id, position, name, normalized, "similar")
  values (r.id, 1, nm, norm, coalesce((select jsonb_agg(h) from jsonb_array_elements(chk->'hits') h where public.normalize_name(h->>'name') <> base.normalized), '[]'));
  return public.j_request(r);
end $$;

-- compound approvals register the name at once; standard ones wait for an auction as before
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
    if r.kind = 'compound' then
      select * into c from candidates where request_id = r.id and status = 'accepted' limit 1;
      insert into reserved_names (name, normalized, type, owner_id, owner_name, price, acquired_at, source, base_name)
      values (c.name, c.normalized, r.type, r.user_id, (select full_name from profiles where id = r.user_id), 0, now(), 'compound',
              (select name from reserved_names where id = r.base_reserved_id));
      perform public.notify(r.user_id, 'reviewed', format('اعتُمد الاسم المركب «%s»', c.name), 'سُجّل باسمك مباشرة دون مزاد، وشهادته في «أسمائي».', '/dashboard/names');
    end if;
  else
    update requests set status = 'rejected', reviewed_at = now(), reviewer_id = staff.id, review_note = p_note where id = r.id returning * into r;
    perform public.refund_deposit(r.id, 'مرفوض');
  end if;
  return public.j_request(r);
end $$;

create or replace function public.admin_awaiting_schedule() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'normalized', c.normalized, 'status', c.status,
      'similar', c."similar", 'request', public.j_request(r)) order by r.reviewed_at)
    from candidates c join requests r on r.id = c.request_id
    where r.status = 'accepted' and r.kind = 'standard' and c.status = 'accepted' and c.auction_id is null), '[]');
end $$;

create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  perform public.settle_due_auctions();
  return jsonb_build_object(
    'underReview', (select count(*) from requests where status = 'under_review'),
    'awaitingSchedule', (select count(*) from candidates c join requests r on r.id = c.request_id where r.status = 'accepted' and r.kind = 'standard' and c.status = 'accepted' and c.auction_id is null),
    'live', (select count(*) from auctions where public.phase_of(starts_at, ends_at) = 'live'),
    'scheduled', (select count(*) from auctions where public.phase_of(starts_at, ends_at) = 'scheduled'),
    'unpaidInvoices', (select count(*) from invoices where status = 'unpaid'),
    'revenue', (select coalesce(sum(total), 0) from invoices where status = 'paid'),
    'openTickets', (select count(*) from tickets where status in ('new', 'in_progress')));
end $$;

create or replace function public.my_names() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'normalized', normalized, 'type', type, 'ownerId', owner_id,
    'ownerName', owner_name, 'price', price, 'acquiredAt', acquired_at, 'source', source, 'baseName', base_name) order by acquired_at desc), '[]')
  from reserved_names where owner_id = public.uid_or_fail()
$$;
