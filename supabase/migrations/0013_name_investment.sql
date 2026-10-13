-- ════════════════════════════════════════════════════════════════
-- Sammha — «استثمار الاسم» (name investment) replaces the short-lived «استثمار» category.
-- One new, non-duplicate name per request; non-refundable study fee (100 SAR); committee review
-- (rejection: SMS notice, no refund); public auction; proceeds 70% organization / 30% name owner
-- (paid to the owner's wallet once the winner pays); no bids: the name goes to its owner without the 30%.
-- ════════════════════════════════════════════════════════════════

-- back to two name categories (any rows made under the short-lived third category fall back to قعدان)
update public.requests set type = 'qaadan' where type not in ('qaadan','bakkar');
update public.auctions set type = 'qaadan' where type not in ('qaadan','bakkar');
update public.reserved_names set type = 'qaadan' where type not in ('qaadan','bakkar');
update public.invoices set type = 'qaadan' where type not in ('qaadan','bakkar');
alter table public.requests drop constraint if exists requests_type_check;
alter table public.requests add constraint requests_type_check check (type in ('qaadan','bakkar'));
alter table public.auctions drop constraint if exists auctions_type_check;
alter table public.auctions add constraint auctions_type_check check (type in ('qaadan','bakkar'));
alter table public.reserved_names drop constraint if exists reserved_names_type_check;
alter table public.reserved_names add constraint reserved_names_type_check check (type in ('qaadan','bakkar'));
alter table public.invoices drop constraint if exists invoices_type_check;
alter table public.invoices add constraint invoices_type_check check (type in ('qaadan','bakkar'));
create or replace function public.create_request(p_type text, p_names text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_settings := public.cfg(); checks jsonb; c jsonb; r requests; i int := 0; bad text;
begin
  perform public.uid_or_fail();
  if p_type not in ('qaadan','bakkar') then raise exception 'نوع غير صحيح'; end if;
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

alter table public.app_settings add column if not exists invest_fee numeric(12,2) not null default 100;
alter table public.app_settings add column if not exists invest_owner_share numeric(5,4) not null default 0.30;

alter table public.requests drop constraint if exists requests_kind_check;
alter table public.requests add constraint requests_kind_check check (kind in ('standard','compound','investment'));
alter table public.requests drop constraint if exists requests_deposit_state_check;
alter table public.requests add constraint requests_deposit_state_check check (deposit_state in ('none','held','applied','refunded','fee'));
alter table public.reserved_names drop constraint if exists reserved_names_source_check;
alter table public.reserved_names add constraint reserved_names_source_check check (source in ('auction','legacy','compound','investment'));
alter table public.wallet_txs drop constraint if exists wallet_txs_kind_check;
alter table public.wallet_txs add constraint wallet_txs_kind_check check (kind in ('topup','deposit','refund','invoice_payment','service_fee','investment_payout'));
alter table public.invoices add column if not exists owner_share numeric(12,2);
alter table public.invoices add column if not exists owner_share_to uuid references public.profiles;
alter table public.invoices add column if not exists owner_share_paid boolean not null default false;

create or replace function public.create_investment_request(p_type text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_settings := public.cfg(); chk jsonb; r requests;
begin
  perform public.uid_or_fail();
  if p_type not in ('qaadan','bakkar') then raise exception 'اختر النوع'; end if;
  chk := public.check_names(array[btrim(coalesce(p_name, ''))], p_type) -> 0;
  if chk->>'verdict' = 'invalid' then raise exception '%', coalesce(chk->>'message', 'الاسم غير صالح'); end if;
  if chk->>'verdict' = 'exact' then raise exception '«%» مسجل أو مطلوب مسبقًا، اختر اسمًا جديدًا غير مكرر', btrim(p_name); end if;
  insert into requests (user_id, type, kind, deposit_amount) values (auth.uid(), p_type, 'investment', s.invest_fee) returning * into r;
  insert into candidates (request_id, position, name, normalized, "similar") values (r.id, 1, btrim(p_name), chk->>'normalized', chk->'hits');
  return public.j_request(r);
end $$;

create or replace function public.pay_deposit_for(p_user uuid, p_request uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r requests; checks jsonb; taken text;
begin
  select * into r from requests where id = p_request and user_id = p_user for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if r.status <> 'pending_payment' then raise exception 'تم سداد ضمان هذا الطلب'; end if;
  checks := public.check_names(array(select name from candidates where request_id = r.id order by position), r.type, r.id);
  select x->>'name' into taken from jsonb_array_elements(checks) x where x->>'verdict' = 'exact' limit 1;
  if taken is not null then raise exception 'أصبح الاسم «%» محجوزًا، ألغِ الطلب وأنشئ طلبًا جديدًا', taken; end if;
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  if public.balance_of(p_user) < r.deposit_amount then raise exception 'رصيد المحفظة لا يكفي، اشحن المحفظة أو ادفع بالبطاقة'; end if;
  if r.kind = 'investment' then
    insert into wallet_txs (user_id, amount, kind, note, ref) values (p_user, -r.deposit_amount, 'service_fee', 'رسوم دراسة طلب استثمار الاسم ' || r.number, r.id);
  else
    insert into wallet_txs (user_id, amount, kind, note, ref) values (p_user, -r.deposit_amount, 'deposit', 'ضمان مزاد الطلب ' || r.number, r.id);
  end if;
  update candidates c set "similar" = x.value->'hits'
    from jsonb_array_elements(checks) with ordinality x(value, ord) where c.request_id = r.id and c.position = x.ord;
  update requests set status = 'under_review', deposit_paid = true, deposit_state = case when r.kind = 'investment' then 'fee' else 'held' end, submitted_at = now() where id = r.id returning * into r;
  return public.j_request(r);
end $$;
revoke execute on function public.pay_deposit_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pay_deposit_for(uuid, uuid) to service_role;

-- settle one investment auction
create or replace function public.settle_investment(p_auction uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; r requests; s app_settings := public.cfg(); vat numeric; inv invoices; share numeric; u uuid;
begin
  select * into a from auctions where id = p_auction for update;
  select * into r from requests where id = a.request_id;
  if a.bid_count = 0 or a.leader_id is null then
    insert into reserved_names (name, normalized, type, owner_id, owner_name, price, acquired_at, source, auction_id)
    values (a.name, public.normalize_name(a.name), a.type, r.user_id, (select full_name from profiles where id = r.user_id), 0, a.ends_at, 'investment', a.id);
    update auctions set settled = true, winner_id = r.user_id, final_price = 0, won_by_requester = true where id = a.id;
    perform public.notify(r.user_id, 'won', format('انتهى مزاد «%s» دون مزايدات', a.name), 'رسا الاسم عليك بلا مقابل، ولا تُستحق نسبة الـ30% لعدم وجود مزايدة.', '/dashboard/names');
    return;
  end if;
  vat := round(a.current_price * s.vat_rate / (1 + s.vat_rate), 2);
  share := round((a.current_price - vat) * s.invest_owner_share, 2);
  insert into invoices (number, user_id, auction_id, name, type, total, vat, subtotal, deposit_applied, amount_due, status, owner_share, owner_share_to)
  values ('INV-' || extract(year from now())::int || '-' || lpad(nextval('invoice_no')::text, 5, '0'), a.leader_id, a.id, a.name, a.type,
          a.current_price, vat, a.current_price - vat, 0, a.current_price, 'unpaid', share, r.user_id)
  returning * into inv;
  insert into reserved_names (name, normalized, type, owner_id, owner_name, price, acquired_at, source, auction_id)
  values (a.name, public.normalize_name(a.name), a.type, a.leader_id, (select full_name from profiles where id = a.leader_id), a.current_price, a.ends_at, 'investment', a.id);
  update auctions set settled = true, winner_id = a.leader_id, final_price = a.current_price, won_by_requester = false where id = a.id;
  -- the winner's «won» notice comes from the auctions trigger
  perform public.notify(r.user_id, 'won', format('بيع اسمك «%s» في المزاد', a.name),
    format('بسعر %s ريال. نصيبك %s ريال (30%%) يُضاف إلى محفظتك فور سداد الفائز.', a.current_price, share), '/dashboard/invest');
  if s.invoice_webhook_url is not null then
    perform net.http_post(s.invoice_webhook_url, public.j_invoice(inv) || jsonb_build_object('email', (select email from profiles where id = a.leader_id)));
  end if;
end $$;
revoke execute on function public.settle_investment(uuid) from public, anon, authenticated;

create or replace function public.settle_due_auctions() returns int
language plpgsql security definer set search_path = public as $$
declare a auctions; r requests; s app_settings := public.cfg(); winner uuid; price numeric; dep numeric; vat numeric; n int := 0; inv invoices;
begin
  for a in select * from auctions where not settled and ends_at <= now() order by ends_at for update skip locked loop
    select * into r from requests where id = a.request_id for update;
    if r.kind = 'investment' then
      perform public.settle_investment(a.id);
      n := n + 1;
      continue;
    end if;
    winner := case when a.bid_count = 0 then a.requester_id else a.leader_id end;
    price := case when a.bid_count = 0 then a.opening_price else a.current_price end;
    dep := 0;
    if winner = r.user_id and r.deposit_state = 'held' then
      dep := least(r.deposit_amount, price);
      update requests set deposit_state = 'applied' where id = r.id;
    end if;
    vat := round(price * s.vat_rate / (1 + s.vat_rate), 2);
    insert into invoices (number, user_id, auction_id, name, type, total, vat, subtotal, deposit_applied, amount_due, status, paid_at)
    values ('INV-' || extract(year from now())::int || '-' || lpad(nextval('invoice_no')::text, 5, '0'), winner, a.id, a.name, a.type,
            price, vat, price - vat, dep, price - dep,
            case when price - dep <= 0 then 'paid' else 'unpaid' end, case when price - dep <= 0 then now() end)
    returning * into inv;
    insert into reserved_names (name, normalized, type, owner_id, owner_name, price, acquired_at, source, auction_id)
    values (a.name, public.normalize_name(a.name), a.type, winner, (select full_name from profiles where id = winner), price, a.ends_at, 'auction', a.id);
    update auctions set settled = true, winner_id = winner, final_price = price, won_by_requester = (winner = r.user_id) where id = a.id;
    -- requester won none of the request's names → refund the guarantee
    if not exists (select 1 from candidates where request_id = r.id and status = 'accepted' and auction_id is null)
       and not exists (select 1 from auctions where request_id = r.id and not settled)
       and (select deposit_state from requests where id = r.id) = 'held' then
      perform public.refund_deposit(r.id, 'لم يُرسَ عليك أي اسم');
    end if;
    -- e-invoice notification (n8n emails the PDF/QR to the owner)
    if s.invoice_webhook_url is not null then
      perform net.http_post(s.invoice_webhook_url, public.j_invoice(inv) || jsonb_build_object('email', (select email from profiles where id = winner)));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- the owner's 30% reaches the wallet once the winner's invoice is paid (wallet, card or recorded by the committee)
create or replace function public.trg_invoice_owner_share() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status <> 'paid' and new.owner_share > 0 and new.owner_share_to is not null and not new.owner_share_paid then
    insert into wallet_txs (user_id, amount, kind, note, ref)
    values (new.owner_share_to, new.owner_share, 'investment_payout', format('نصيبك 30%% من بيع الاسم «%s» (%s)', new.name, new.number), new.id);
    update invoices set owner_share_paid = true where id = new.id;
    perform public.notify(new.owner_share_to, 'refund', format('أُضيف %s ريال إلى محفظتك', new.owner_share), format('نصيبك من بيع الاسم «%s» في المزاد.', new.name), '/dashboard/wallet');
  end if;
  return new;
end $$;
drop trigger if exists invoices_owner_share on public.invoices;
create trigger invoices_owner_share after update of status on public.invoices for each row execute function public.trg_invoice_owner_share();

create or replace function public.j_auction(a public.auctions) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'requestId', a.request_id, 'candidateId', a.candidate_id, 'name', a.name, 'type', a.type,
    'requesterId', a.requester_id, 'openingPrice', a.opening_price, 'minIncrement', a.min_increment,
    'startsAt', a.starts_at, 'endsAt', a.ends_at, 'currentPrice', a.current_price, 'bidCount', a.bid_count,
    'leaderId', a.leader_id, 'leaderLabel', (select public.mask_name(full_name) from profiles where id = a.leader_id),
    'settled', a.settled, 'winnerId', a.winner_id, 'winnerName', (select full_name from profiles where id = a.winner_id),
    'finalPrice', a.final_price, 'wonByRequester', a.won_by_requester, 'extensions', a.extensions,
    'investment', exists (select 1 from requests where id = a.request_id and kind = 'investment'))
$$;

create or replace function public.place_bid(p_auction uuid, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a auctions; u uuid := public.uid_or_fail();
begin
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'المزاد غير موجود'; end if;
  if now() < a.starts_at then raise exception 'المزاد لم يبدأ بعد'; end if;
  if now() >= a.ends_at then raise exception 'انتهى المزاد'; end if;
  if p_amount is null or p_amount < a.current_price + a.min_increment then raise exception 'أقل مزايدة % ريال', a.current_price + a.min_increment; end if;
  if a.leader_id = u then raise exception 'أنت صاحب أعلى مزايدة حاليًا'; end if;
  if a.requester_id = u and exists (select 1 from requests where id = a.request_id and kind = 'investment') then
    raise exception 'لا يمكنك المزايدة على اسم قدّمته في «استثمار الاسم»';
  end if;
  perform public.record_bid(a.id, u, p_amount, false);
  perform public.resolve_autobids(a.id);
  return public.auction_view(a.id);
end $$;

create or replace function public.set_autobid(p_auction uuid, p_max numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a auctions; u uuid := public.uid_or_fail();
begin
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'المزاد غير موجود'; end if;
  if a.settled or now() >= a.ends_at then raise exception 'انتهى المزاد'; end if;
  if a.requester_id = u and exists (select 1 from requests where id = a.request_id and kind = 'investment') then
    raise exception 'لا يمكنك المزايدة على اسم قدّمته في «استثمار الاسم»';
  end if;
  if p_max is null or p_max < a.current_price + a.min_increment then raise exception 'الحد الأقصى % ريال على الأقل', a.current_price + a.min_increment; end if;
  if p_max > 1000000 then raise exception 'الحد الأقصى كبير جدًا'; end if;
  insert into autobids (auction_id, user_id, max_amount) values (a.id, u, floor(p_max))
  on conflict (auction_id, user_id) do update set max_amount = excluded.max_amount, created_at = now();
  insert into watches (auction_id, user_id) values (a.id, u) on conflict do nothing;
  perform public.resolve_autobids(a.id);
  return public.auction_view(a.id);
end $$;

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
      perform public.notify(r.user_id, 'reviewed', format('قُبل اسمك «%s» في «استثمار الاسم»', (select name from candidates where request_id = r.id limit 1)),
        'سيُطرح في مزاد عام قريبًا، ولك 30% من قيمة بيعه.', '/dashboard/invest');
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
      perform public.notify(r.user_id, 'reviewed', 'لم يُقبل الاسم المقدّم في «استثمار الاسم»',
        coalesce((select reject_reason from candidates where request_id = r.id limit 1), 'وفق معايير اللجنة') || '. رسوم الدراسة غير مستردة.', '/dashboard/invest');
    end if;
  end if;
  return public.j_request(r);
end $$;

create or replace function public.admin_awaiting_schedule() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'normalized', c.normalized, 'status', c.status,
      'similar', c."similar", 'request', public.j_request(r)) order by r.reviewed_at)
    from candidates c join requests r on r.id = c.request_id
    where r.status = 'accepted' and r.kind in ('standard','investment') and c.status = 'accepted' and c.auction_id is null), '[]');
end $$;

create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  perform public.settle_due_auctions();
  return jsonb_build_object(
    'underReview', (select count(*) from requests where status = 'under_review'),
    'awaitingSchedule', (select count(*) from candidates c join requests r on r.id = c.request_id where r.status = 'accepted' and r.kind in ('standard','investment') and c.status = 'accepted' and c.auction_id is null),
    'live', (select count(*) from auctions where public.phase_of(starts_at, ends_at) = 'live'),
    'scheduled', (select count(*) from auctions where public.phase_of(starts_at, ends_at) = 'scheduled'),
    'unpaidInvoices', (select count(*) from invoices where status = 'unpaid'),
    'revenue', (select coalesce(sum(total), 0) from invoices where status = 'paid'),
    'openTickets', (select count(*) from tickets where status in ('new', 'in_progress')));
end $$;

create or replace function public.my_investments() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'request', public.j_request(r),
      'auction', (select public.j_auction(a) from auctions a where a.request_id = r.id limit 1),
      'share', (select i.owner_share from invoices i join auctions a on a.id = i.auction_id where a.request_id = r.id limit 1),
      'sharePaid', (select i.owner_share_paid from invoices i join auctions a on a.id = i.auction_id where a.request_id = r.id limit 1),
      'keptByOwner', exists (select 1 from auctions a where a.request_id = r.id and a.settled and a.winner_id = r.user_id)
    ) order by r.created_at desc), '[]')
  from requests r where r.user_id = public.uid_or_fail() and r.kind = 'investment'
$$;

-- invoices carry the name owner's share (shown to staff)
create or replace function public.j_invoice(i public.invoices) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'number', i.number, 'userId', i.user_id,
    'buyerName', p.full_name, 'buyerPhone', p.phone, 'auctionId', i.auction_id, 'name', i.name, 'type', i.type,
    'total', i.total, 'vat', i.vat, 'subtotal', i.subtotal, 'depositApplied', i.deposit_applied, 'amountDue', i.amount_due,
    'status', i.status, 'issuedAt', i.issued_at, 'paidAt', i.paid_at,
    'ownerShare', i.owner_share, 'ownerShareTo', i.owner_share_to, 'ownerSharePaid', i.owner_share_paid)
  from profiles p where p.id = i.user_id
$$;

-- rejecting a whole investment request: notice (sent on as SMS by the notify webhook), fee kept
create or replace function public.admin_reject_request(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare staff profiles := public.require_staff(); r requests;
begin
  update requests set status = 'rejected', reviewed_at = now(), reviewer_id = staff.id, review_note = p_reason
  where id = p_id and status = 'under_review' returning * into r;
  if not found then raise exception 'لا يمكن رفض هذا الطلب'; end if;
  update candidates set status = 'rejected', reject_reason = p_reason where request_id = r.id and status <> 'withdrawn';
  perform public.refund_deposit(r.id, 'مرفوض');
  if r.kind = 'investment' then
    perform public.notify(r.user_id, 'reviewed', 'لم يُقبل الاسم المقدّم في «استثمار الاسم»',
      coalesce(nullif(p_reason, ''), 'وفق معايير اللجنة') || '. رسوم الدراسة غير مستردة.', '/dashboard/invest');
  end if;
  return public.j_request(r);
end $$;
