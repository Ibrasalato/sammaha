-- ════════════════════════════════════════════════════════════════
-- Sammha — name categories: «فردي» (مفاريد: بكار، قعدان) and «منقية» (a herd name),
-- and «استثمار الاسم» requests may carry up to three names (one study fee per request).
-- ════════════════════════════════════════════════════════════════

alter table public.requests drop constraint if exists requests_type_check;
alter table public.requests add constraint requests_type_check check (type in ('qaadan','bakkar','manqiya'));
alter table public.auctions drop constraint if exists auctions_type_check;
alter table public.auctions add constraint auctions_type_check check (type in ('qaadan','bakkar','manqiya'));
alter table public.reserved_names drop constraint if exists reserved_names_type_check;
alter table public.reserved_names add constraint reserved_names_type_check check (type in ('qaadan','bakkar','manqiya'));
alter table public.invoices drop constraint if exists invoices_type_check;
alter table public.invoices add constraint invoices_type_check check (type in ('qaadan','bakkar','manqiya'));

alter table public.app_settings add column if not exists invest_max_names int not null default 3;

create or replace function public.create_request(p_type text, p_names text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_settings := public.cfg(); checks jsonb; c jsonb; r requests; i int := 0; bad text;
begin
  perform public.uid_or_fail();
  if p_type not in ('qaadan','bakkar','manqiya') then raise exception 'نوع غير صحيح'; end if;
  if coalesce(array_length(p_names, 1), 0) <> s.names_per_request then raise exception 'أدخل % أسماء', s.names_per_request; end if;
  checks := public.check_names(p_names, p_type);
  select string_agg(x->>'name', '، ') into bad from jsonb_array_elements(checks) x where x->>'verdict' in ('exact','invalid','duplicate');
  if bad is not null then raise exception 'غيّر الأسماء المرفوضة: %', bad; end if;
  insert into requests (user_id, type, deposit_amount) values (auth.uid(), p_type, s.deposit_amount) returning * into r;
  for c in select * from jsonb_array_elements(checks) loop
    i := i + 1;
    insert into candidates (request_id, position, name, normalized, "similar") values (r.id, i, btrim(c->>'name'), c->>'normalized', c->'hits');
  end loop;
  return public.j_request(r);
end $$;

drop function if exists public.create_investment_request(text, text);
create or replace function public.create_investment_request(p_type text, p_names text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_settings := public.cfg(); names text[]; checks jsonb; c jsonb; r requests; i int := 0;
begin
  perform public.uid_or_fail();
  if p_type not in ('qaadan','bakkar','manqiya') then raise exception 'اختر النوع'; end if;
  select coalesce(array_agg(btrim(n)), '{}') into names from unnest(p_names) n where btrim(coalesce(n, '')) <> '';
  if coalesce(array_length(names, 1), 0) = 0 then raise exception 'اكتب اسمًا واحدًا على الأقل'; end if;
  if array_length(names, 1) > s.invest_max_names then raise exception 'الحد الأقصى % أسماء في الطلب', s.invest_max_names; end if;
  checks := public.check_names(names, p_type);
  for c in select * from jsonb_array_elements(checks) loop
    if c->>'verdict' = 'invalid' then raise exception '%', coalesce(c->>'message', 'الاسم غير صالح'); end if;
    if c->>'verdict' = 'duplicate' then raise exception '«%» مكرر في الطلب', c->>'name'; end if;
    if c->>'verdict' = 'exact' then raise exception '«%» مسجل أو مطلوب مسبقًا، اختر اسمًا جديدًا غير مكرر', c->>'name'; end if;
  end loop;
  insert into requests (user_id, type, kind, deposit_amount) values (auth.uid(), p_type, 'investment', s.invest_fee) returning * into r;
  for c in select * from jsonb_array_elements(checks) loop
    i := i + 1;
    insert into candidates (request_id, position, name, normalized, "similar") values (r.id, i, btrim(c->>'name'), c->>'normalized', c->'hits');
  end loop;
  return public.j_request(r);
end $$;

-- a name can be withdrawn from an investment request too (the study fee stays non-refundable)
create or replace function public.candidate_withdrawable(r public.requests, c public.candidates) returns boolean
language sql stable security definer set search_path = public as $$
  select r.kind in ('standard','investment') and r.status in ('pending_payment','under_review','accepted') and c.status in ('pending','accepted')
    and not exists (select 1 from auctions a where a.id = c.auction_id and (a.starts_at <= now() or a.bid_count > 0))
$$;

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
    if r.kind = 'investment' then
      perform public.notify(r.user_id, 'reviewed',
        format('قُبل في «استثمار الاسم»: %s', (select string_agg('«' || name || '»', '، ' order by position) from candidates where request_id = r.id and status = 'accepted')),
        'تُطرح الأسماء المقبولة في مزاد عام قريبًا، ولك 30% من قيمة بيع كل اسم.'
          || coalesce(' ولم يُقبل: ' || (select string_agg(name, '، ' order by position) from candidates where request_id = r.id and status = 'rejected') || '.', ''),
        '/dashboard/invest');
    end if;
    if r.kind = 'compound' then
      select * into c from candidates where request_id = r.id and status = 'accepted' limit 1;
      insert into reserved_names (name, normalized, type, owner_id, owner_name, price, acquired_at, source, base_name)
      values (c.name, c.normalized, r.type, r.user_id, (select full_name from profiles where id = r.user_id), 0, now(), 'compound',
              (select name from reserved_names where id = r.base_reserved_id));
      perform public.notify(r.user_id, 'reviewed', format('اعتُمد الاسم المركب «%s»', c.name), 'سُجّل باسمك مباشرة دون مزاد، وشهادته في «أسمائي».', '/dashboard/names');
    end if;
  else
    update requests set status = 'rejected', reviewed_at = now(), reviewer_id = staff.id, review_note = p_note where id = r.id returning * into r;
    perform public.refund_deposit(r.id, 'مرفوض');  -- no-op for the investment fee (state 'fee')
    if r.kind = 'investment' then  -- the notify webhook also sends the SMS
      perform public.notify(r.user_id, 'reviewed', 'لم تُقبل الأسماء المقدّمة في «استثمار الاسم»',
        coalesce((select reject_reason from candidates where request_id = r.id and status = 'rejected' order by position limit 1), 'وفق معايير اللجنة') || '. رسوم الدراسة غير مستردة.', '/dashboard/invest');
    end if;
  end if;
  return public.j_request(r);
end $$;

-- one row per offered name
create or replace function public.my_investments() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'request', public.j_request(r),
      'candidate', (select x from jsonb_array_elements(public.j_request(r)->'candidates') x where x->>'id' = c.id::text),
      'auction', (select public.j_auction(a) from auctions a where a.id = c.auction_id),
      'share', (select i.owner_share from invoices i where i.auction_id = c.auction_id),
      'sharePaid', (select i.owner_share_paid from invoices i where i.auction_id = c.auction_id),
      'keptByOwner', exists (select 1 from auctions a where a.id = c.auction_id and a.settled and a.winner_id = r.user_id)
    ) order by r.created_at desc, c.position), '[]')
  from requests r join candidates c on c.request_id = r.id
  where r.user_id = public.uid_or_fail() and r.kind = 'investment'
$$;

-- compound and investment requests send their own review notices; skip the generic one for them
create or replace function public.trg_request_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'under_review' and new.status in ('accepted','rejected','cancelled')
     and not (new.kind in ('compound','investment') and new.status in ('accepted','rejected')) then
    perform public.notify(new.user_id, 'reviewed',
      case new.status when 'accepted' then format('قُبل طلبك %s', new.number) when 'rejected' then format('لم يُقبل طلبك %s', new.number) else format('أُلغي طلبك %s', new.number) end,
      coalesce(new.review_note, case when new.status = 'accepted' then 'سيُحدَّد موعد المزاد قريبًا.'
        when new.deposit_state = 'fee' then 'رسوم الدراسة غير مستردة.' else 'أُعيد ضمان المزاد إلى محفظتك.' end),
      '/dashboard/requests/' || new.id);
  end if;
  if old.deposit_state = 'held' and new.deposit_state = 'refunded' then
    perform public.notify(new.user_id, 'refund', 'أُعيد ضمان المزاد إلى محفظتك', format('%s ريال من الطلب %s.', new.deposit_amount, new.number), '/dashboard/wallet');
  end if;
  return new;
end $$;
