-- ════════════════════════════════════════════════════════════════
-- Sammha — business logic (mirrors src/lib/demoApi.ts)
-- Every RPC returns JSON in the camelCase shape of src/lib/types.ts.
-- ════════════════════════════════════════════════════════════════

-- ───────────── helpers ─────────────
create or replace function public.normalize_name(p text) returns text
language plpgsql immutable as $$
declare s text := coalesce(btrim(p), '');
begin
  s := regexp_replace(s, '[ً-ٰٟۖ-ۭـ]', '', 'g');
  s := translate(s, 'أإآٱىةؤئ', 'اااايهوي');
  s := replace(s, 'ء', '');
  s := regexp_replace(s, '[^ء-يa-zA-Z0-9]', '', 'g');
  if char_length(s) > 4 and left(s, 2) = 'ال' then s := substr(s, 3); end if;
  return lower(s);
end $$;

create or replace function public.name_similarity(a text, b text) returns numeric
language plpgsql immutable as $$
declare score numeric;
begin
  if a = '' or b = '' then return 0; end if;
  if a = b then return 1; end if;
  score := 1 - levenshtein(a, b)::numeric / greatest(char_length(a), char_length(b));
  if least(char_length(a), char_length(b)) >= 3 and (position(b in a) > 0 or position(a in b) > 0) then
    score := greatest(score, 0.8);
  end if;
  return round(score, 2);
end $$;

create or replace function public.mask_name(p text) returns text language sql immutable as $$
  select case when array_length(regexp_split_to_array(btrim(p), '\s+'), 1) = 1
    then left(btrim(p), 2) || '…'
    else split_part(btrim(p), ' ', 1) || ' ' || left((regexp_split_to_array(btrim(p), '\s+'))[array_length(regexp_split_to_array(btrim(p), '\s+'), 1)], 2) || '…' end
$$;

create or replace function public.cfg() returns public.app_settings language sql stable security definer set search_path = public as $$
  select * from public.app_settings limit 1
$$;

create or replace function public.uid_or_fail() returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;
  return auth.uid();
end $$;

create or replace function public.require_staff() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = public.uid_or_fail();
  if p.role not in ('committee','admin') then raise exception 'هذه العملية للجنة الاعتماد فقط'; end if;
  return p;
end $$;

create or replace function public.phase_of(s timestamptz, e timestamptz) returns text language sql stable as $$
  select case when now() < s then 'scheduled' when now() < e then 'live' else 'ended' end
$$;

create or replace function public.balance_of(p_user uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from public.wallet_txs where user_id = p_user
$$;

-- ───────────── JSON shapes ─────────────
create or replace function public.j_profile(p public.profiles) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'fullName', p.full_name, 'phone', p.phone, 'email', p.email,
    'nationalId', p.national_id, 'role', p.role, 'createdAt', p.created_at)
$$;

create or replace function public.j_auction(a public.auctions) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'requestId', a.request_id, 'candidateId', a.candidate_id, 'name', a.name, 'type', a.type,
    'requesterId', a.requester_id, 'openingPrice', a.opening_price, 'minIncrement', a.min_increment,
    'startsAt', a.starts_at, 'endsAt', a.ends_at, 'currentPrice', a.current_price, 'bidCount', a.bid_count,
    'leaderId', a.leader_id, 'leaderLabel', (select public.mask_name(full_name) from profiles where id = a.leader_id),
    'settled', a.settled, 'winnerId', a.winner_id, 'winnerName', (select full_name from profiles where id = a.winner_id),
    'finalPrice', a.final_price, 'wonByRequester', a.won_by_requester)
$$;

create or replace function public.j_request(r public.requests) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'number', r.number, 'userId', r.user_id,
    'ownerName', (select full_name from profiles where id = r.user_id), 'type', r.type, 'status', r.status,
    'depositAmount', r.deposit_amount, 'depositPaid', r.deposit_paid, 'depositState', r.deposit_state,
    'createdAt', r.created_at, 'submittedAt', r.submitted_at, 'reviewedAt', r.reviewed_at,
    'reviewerName', (select full_name from profiles where id = r.reviewer_id), 'reviewNote', r.review_note,
    'candidates', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'normalized', c.normalized,
        'status', c.status, 'similar', c."similar", 'rejectReason', c.reject_reason, 'auctionId', c.auction_id) order by c.position)
      from candidates c where c.request_id = r.id), '[]'))
$$;

create or replace function public.j_invoice(i public.invoices) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'number', i.number, 'userId', i.user_id,
    'buyerName', p.full_name, 'buyerPhone', p.phone, 'auctionId', i.auction_id, 'name', i.name, 'type', i.type,
    'total', i.total, 'vat', i.vat, 'subtotal', i.subtotal, 'depositApplied', i.deposit_applied, 'amountDue', i.amount_due,
    'status', i.status, 'issuedAt', i.issued_at, 'paidAt', i.paid_at)
  from profiles p where p.id = i.user_id
$$;

-- ───────────── matching ─────────────
-- Existing names = reserved names + names in live requests/auctions (not rejected).
create or replace function public.find_similar(p_norm text, p_exclude uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  with pool as (
    select name, normalized, type, 'reserved'::text as source from reserved_names
    union all
    select c.name, c.normalized, r.type, case when c.auction_id is null then 'request' else 'auction' end
    from candidates c join requests r on r.id = c.request_id
    left join auctions a on a.id = c.auction_id
    where r.status in ('pending_payment','under_review','accepted') and c.status <> 'rejected'
      and (p_exclude is null or r.id <> p_exclude) and coalesce(a.settled, false) = false
  ), scored as (
    select name, type, source, public.name_similarity(p_norm, normalized) as score from pool
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'type', type, 'source', source, 'score', score) order by score desc), '[]')
  from (select * from scored where score >= (select similar_threshold from app_settings) order by score desc limit 8) t
$$;

create or replace function public.check_names(p_names text[], p_type text default null, p_exclude uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb := '[]'; n text; norm text; hits jsonb; exact jsonb; seen text[] := '{}'; v text; msg text; cnt int;
begin
  foreach n in array p_names loop
    norm := public.normalize_name(n);
    hits := '[]';
    if btrim(coalesce(n, '')) = '' then v := 'invalid'; msg := 'اكتب الاسم';
    elsif char_length(btrim(n)) < 2 then v := 'invalid'; msg := 'الاسم قصير جدًا';
    elsif char_length(btrim(n)) > 30 then v := 'invalid'; msg := 'الاسم أطول من 30 حرفًا';
    elsif btrim(n) !~ '^[؀-ۿ[:space:]]+$' then v := 'invalid'; msg := 'استخدم الحروف العربية فقط';
    elsif norm = any(seen) then v := 'duplicate'; msg := 'مكرر داخل نفس الطلب';
    else
      hits := public.find_similar(norm, p_exclude);
      select h into exact from jsonb_array_elements(hits) h where (h->>'score')::numeric = 1 limit 1;
      cnt := jsonb_array_length(hits);
      if exact is not null then
        v := 'exact';
        msg := format('مطابق تمامًا لاسم %s: «%s»', case when exact->>'source' = 'reserved' then 'مسجل' else 'تحت الطلب أو المزاد' end, exact->>'name');
      elsif cnt > 0 then v := 'similar'; msg := format('متاح، وستراجع اللجنة تشابهه مع %s', case cnt when 1 then 'اسم واحد' when 2 then 'اسمين' else cnt || ' أسماء' end);
      else v := 'available'; msg := 'متاح';
      end if;
    end if;
    seen := seen || norm;
    exact := null;
    out := out || jsonb_build_array(jsonb_build_object('name', n, 'normalized', norm, 'verdict', v, 'message', msg, 'hits', hits));
  end loop;
  return out;
end $$;

-- ───────────── money ─────────────
create or replace function public.refund_deposit(p_request uuid, p_why text) returns void
language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = p_request for update;
  if r.deposit_state <> 'held' then return; end if;
  update requests set deposit_state = 'refunded' where id = r.id;
  insert into wallet_txs (user_id, amount, kind, note, ref)
  values (r.user_id, r.deposit_amount, 'refund', format('استرداد ضمان الطلب %s (%s)', r.number, p_why), r.id);
end $$;

-- Settle every auction whose end time has passed (run by pg_cron every minute and on reads).
create or replace function public.settle_due_auctions() returns int
language plpgsql security definer set search_path = public as $$
declare a auctions; r requests; s app_settings := public.cfg(); winner uuid; price numeric; dep numeric; vat numeric; n int := 0; inv invoices;
begin
  for a in select * from auctions where not settled and ends_at <= now() order by ends_at for update skip locked loop
    select * into r from requests where id = a.request_id for update;
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

select cron.schedule('sammha-settle-auctions', '* * * * *', $$select public.settle_due_auctions()$$);

-- ───────────── auth & public ─────────────
create or replace function public.me() returns jsonb language sql stable security definer set search_path = public as $$
  select public.j_profile(p) from profiles p where p.id = auth.uid()
$$;

create or replace function public.email_for_phone(p_phone text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select email from profiles where phone = regexp_replace(p_phone, '\s', '', 'g')), 'unknown@invalid')
$$;

create or replace function public.public_stats() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.settle_due_auctions();
  return jsonb_build_object(
    'live', (select count(*) from auctions where public.phase_of(starts_at, ends_at) = 'live'),
    'upcoming', (select count(*) from auctions where public.phase_of(starts_at, ends_at) = 'scheduled'),
    'reserved', (select count(*) from reserved_names),
    'owners', (select count(distinct owner_name) from reserved_names));
end $$;

create or replace function public.list_auctions(p_phase text default 'all', p_type text default 'all', p_q text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.settle_due_auctions();
  return coalesce((
    select jsonb_agg(public.j_auction(a) order by
      case public.phase_of(a.starts_at, a.ends_at) when 'live' then 0 when 'scheduled' then 1 else 2 end,
      case when public.phase_of(a.starts_at, a.ends_at) = 'ended' then -extract(epoch from a.ends_at) else 0 end,
      case when public.phase_of(a.starts_at, a.ends_at) = 'scheduled' then a.starts_at else a.ends_at end)
    from auctions a
    where (p_phase = 'all' or public.phase_of(a.starts_at, a.ends_at) = p_phase)
      and (p_type = 'all' or a.type = p_type)
      and (coalesce(p_q, '') = '' or public.normalize_name(a.name) like '%' || public.normalize_name(p_q) || '%')), '[]');
end $$;

create or replace function public.get_auction(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare a auctions;
begin
  perform public.settle_due_auctions();
  select * into a from auctions where id = p_id;
  if not found then raise exception 'المزاد غير موجود'; end if;
  return jsonb_build_object('auction', public.j_auction(a), 'bids', coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'auctionId', b.auction_id, 'userId', b.user_id,
      'bidderLabel', public.mask_name(p.full_name), 'amount', b.amount, 'createdAt', b.created_at) order by b.amount desc)
    from bids b join profiles p on p.id = b.user_id where b.auction_id = p_id), '[]'));
end $$;

create or replace function public.list_reserved(p_q text default '', p_type text default 'all') returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'normalized', normalized, 'type', type, 'ownerId', owner_id,
    'ownerName', owner_name, 'price', price, 'acquiredAt', acquired_at, 'source', source) order by acquired_at desc), '[]')
  from reserved_names
  where (p_type = 'all' or type = p_type)
    and (coalesce(p_q, '') = '' or normalized like '%' || public.normalize_name(p_q) || '%' or owner_name like '%' || p_q || '%')
$$;

-- ───────────── owner ─────────────
create or replace function public.my_requests() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.j_request(r) order by r.created_at desc), '[]') from requests r where r.user_id = public.uid_or_fail()
$$;

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

-- internal: also called by the moyasar webhook after a card payment credited the wallet
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
  insert into wallet_txs (user_id, amount, kind, note, ref) values (p_user, -r.deposit_amount, 'deposit', 'ضمان مزاد الطلب ' || r.number, r.id);
  update candidates c set "similar" = x.value->'hits'
    from jsonb_array_elements(checks) with ordinality x(value, ord) where c.request_id = r.id and c.position = x.ord;
  update requests set status = 'under_review', deposit_paid = true, deposit_state = 'held', submitted_at = now() where id = r.id returning * into r;
  return public.j_request(r);
end $$;
revoke execute on function public.pay_deposit_for(uuid, uuid) from public, anon, authenticated;

create or replace function public.pay_deposit(p_request uuid) returns jsonb language sql security definer set search_path = public as $$
  select public.pay_deposit_for(public.uid_or_fail(), p_request)
$$;

create or replace function public.cancel_my_request(p_request uuid) returns void language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = p_request and user_id = public.uid_or_fail() for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if r.status not in ('pending_payment','under_review') then raise exception 'لا يمكن إلغاء الطلب بعد مراجعته'; end if;
  update requests set status = 'cancelled' where id = r.id;
  perform public.refund_deposit(r.id, 'ألغاه المالك');
end $$;

create or replace function public.my_wallet() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('balance', public.balance_of(public.uid_or_fail()), 'txs', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'userId', user_id, 'amount', amount, 'kind', kind, 'note', note, 'createdAt', created_at) order by created_at desc)
    from wallet_txs where user_id = auth.uid()), '[]'))
$$;

create or replace function public.my_invoices() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.j_invoice(i) order by i.issued_at desc), '[]') from invoices i where i.user_id = public.uid_or_fail()
$$;

create or replace function public.pay_invoice_for(p_user uuid, p_invoice uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i invoices;
begin
  select * into i from invoices where id = p_invoice and user_id = p_user for update;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  if i.status = 'paid' then return public.j_invoice(i); end if;
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  if public.balance_of(p_user) < i.amount_due then raise exception 'رصيد المحفظة لا يكفي'; end if;
  insert into wallet_txs (user_id, amount, kind, note, ref) values (p_user, -i.amount_due, 'invoice_payment', format('سداد الفاتورة %s — %s', i.number, i.name), i.id);
  update invoices set status = 'paid', paid_at = now() where id = i.id returning * into i;
  return public.j_invoice(i);
end $$;
revoke execute on function public.pay_invoice_for(uuid, uuid) from public, anon, authenticated;

create or replace function public.pay_invoice(p_invoice uuid) returns jsonb language sql security definer set search_path = public as $$
  select public.pay_invoice_for(public.uid_or_fail(), p_invoice)
$$;

create or replace function public.my_bids() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'auctionId', b.auction_id, 'userId', b.user_id, 'bidderLabel', '',
    'amount', b.amount, 'createdAt', b.created_at, 'auction', public.j_auction(a)) order by b.created_at desc), '[]')
  from (select distinct on (auction_id) * from bids where user_id = public.uid_or_fail() order by auction_id, amount desc) b
  join auctions a on a.id = b.auction_id
$$;

create or replace function public.my_names() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'normalized', normalized, 'type', type, 'ownerId', owner_id,
    'ownerName', owner_name, 'price', price, 'acquiredAt', acquired_at, 'source', source) order by acquired_at desc), '[]')
  from reserved_names where owner_id = public.uid_or_fail()
$$;

create or replace function public.place_bid(p_auction uuid, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a auctions; u uuid := public.uid_or_fail(); s app_settings := public.cfg(); win interval;
begin
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'المزاد غير موجود'; end if;
  if now() < a.starts_at then raise exception 'المزاد لم يبدأ بعد'; end if;
  if now() >= a.ends_at then raise exception 'انتهى المزاد'; end if;
  if p_amount is null or p_amount < a.current_price + a.min_increment then raise exception 'أقل مزايدة % ريال', a.current_price + a.min_increment; end if;
  if a.leader_id = u then raise exception 'أنت صاحب أعلى مزايدة حاليًا'; end if;
  insert into bids (auction_id, user_id, amount) values (a.id, u, p_amount);
  win := make_interval(mins => s.extend_minutes);
  update auctions set current_price = p_amount, bid_count = bid_count + 1, leader_id = u,
    ends_at = case when ends_at - now() < win then now() + win else ends_at end
  where id = a.id;
  return public.get_auction(a.id);
end $$;

-- ───────────── approval committee ─────────────
create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  perform public.settle_due_auctions();
  return jsonb_build_object(
    'underReview', (select count(*) from requests where status = 'under_review'),
    'awaitingSchedule', (select count(*) from candidates c join requests r on r.id = c.request_id where r.status = 'accepted' and c.status = 'accepted' and c.auction_id is null),
    'live', (select count(*) from auctions where public.phase_of(starts_at, ends_at) = 'live'),
    'scheduled', (select count(*) from auctions where public.phase_of(starts_at, ends_at) = 'scheduled'),
    'unpaidInvoices', (select count(*) from invoices where status = 'unpaid'),
    'revenue', (select coalesce(sum(total), 0) from invoices where status = 'paid'));
end $$;

create or replace function public.admin_list_requests(p_status text default 'all') returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return coalesce((select jsonb_agg(public.j_request(r) order by coalesce(r.submitted_at, r.created_at) desc) from requests r
    where (p_status = 'all' and r.status <> 'pending_payment') or r.status = p_status), '[]');
end $$;

create or replace function public.get_request(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare r requests; p profiles;
begin
  select * into p from profiles where id = public.uid_or_fail();
  select * into r from requests where id = p_id;
  if not found or (p.role = 'owner' and r.user_id <> p.id) then raise exception 'الطلب غير موجود'; end if;
  if p.role <> 'owner' and r.status = 'under_review' then
    update candidates set "similar" = public.find_similar(normalized, r.id) where request_id = r.id;
  end if;
  return public.j_request(r);
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
    if not found then continue; end if;
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
  update candidates set status = 'rejected', reject_reason = p_reason where request_id = r.id;
  perform public.refund_deposit(r.id, 'مرفوض');
  return public.j_request(r);
end $$;

create or replace function public.admin_cancel_request(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare staff profiles := public.require_staff(); r requests;
begin
  if exists (select 1 from candidates where request_id = p_id and auction_id is not null) then raise exception 'لا يمكن إلغاء طلب فُتح له مزاد'; end if;
  update requests set status = 'cancelled', reviewed_at = now(), reviewer_id = staff.id, review_note = p_reason
  where id = p_id and status in ('under_review','accepted') returning * into r;
  if not found then raise exception 'لا يمكن إلغاء هذا الطلب'; end if;
  perform public.refund_deposit(r.id, 'ألغته اللجنة');
  return public.j_request(r);
end $$;

create or replace function public.admin_awaiting_schedule() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'normalized', c.normalized, 'status', c.status,
      'similar', c."similar", 'request', public.j_request(r)) order by r.reviewed_at)
    from candidates c join requests r on r.id = c.request_id
    where r.status = 'accepted' and c.status = 'accepted' and c.auction_id is null), '[]');
end $$;

create or replace function public.admin_schedule_auctions(p_candidates uuid[], p_starts timestamptz, p_ends timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_settings := public.cfg(); c candidates; r requests; a auctions; out jsonb := '[]';
begin
  perform public.require_staff();
  if p_ends <= p_starts then raise exception 'موعد النهاية يجب أن يكون بعد البداية'; end if;
  if p_ends <= now() then raise exception 'موعد النهاية في الماضي'; end if;
  if coalesce(array_length(p_candidates, 1), 0) = 0 then raise exception 'اختر اسمًا واحدًا على الأقل'; end if;
  for c in select * from candidates where id = any(p_candidates) and status = 'accepted' and auction_id is null for update loop
    select * into r from requests where id = c.request_id;
    insert into auctions (request_id, candidate_id, name, type, requester_id, opening_price, min_increment, starts_at, ends_at, current_price)
    values (r.id, c.id, c.name, r.type, r.user_id, s.opening_price, s.min_increment, p_starts, p_ends, s.opening_price) returning * into a;
    update candidates set auction_id = a.id where id = c.id;
    out := out || jsonb_build_array(public.j_auction(a));
  end loop;
  return out;
end $$;

create or replace function public.admin_invoices() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return coalesce((select jsonb_agg(public.j_invoice(i) order by i.issued_at desc) from invoices i), '[]');
end $$;

create or replace function public.admin_users() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return coalesce((select jsonb_agg(public.j_profile(p) order by p.created_at desc) from profiles p), '[]');
end $$;

-- Internal functions must not be callable from the browser
revoke execute on function public.refund_deposit(uuid, text) from public, anon, authenticated;
revoke execute on function public.settle_due_auctions() from anon, authenticated;

-- Committee records an offline payment (cash / bank transfer) for an invoice
create or replace function public.admin_mark_invoice_paid(p_invoice uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i invoices;
begin
  perform public.require_staff();
  update invoices set status = 'paid', paid_at = now() where id = p_invoice and status = 'unpaid' returning * into i;
  if not found then raise exception 'الفاتورة غير موجودة أو مدفوعة'; end if;
  return public.j_invoice(i);
end $$;

-- The moyasar-webhook Edge Function (service role) completes card payments
grant execute on function public.pay_deposit_for(uuid, uuid) to service_role;
grant execute on function public.pay_invoice_for(uuid, uuid) to service_role;
