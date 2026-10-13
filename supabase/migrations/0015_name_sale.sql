-- ════════════════════════════════════════════════════════════════
-- Sammha — «بيع اسم»: an owner sells a name they own.
--  • resale auction: listed and announced 72 h before it opens, opens at the owner's minimum,
--    runs 3 days, every bidder pays a participation guarantee, Sammha keeps 10% of the final value;
--  • instant sale: on the market for 72 h at the owner's price, first buyer who pays takes it,
--    Sammha keeps 15%.
-- The buyer pays through the platform; the seller is credited (price − commission) once paid.
-- ════════════════════════════════════════════════════════════════

alter table public.app_settings add column if not exists resale_notice_hours int not null default 72;
alter table public.app_settings add column if not exists resale_auction_days int not null default 3;
alter table public.app_settings add column if not exists resale_commission numeric(5,4) not null default 0.10;
alter table public.app_settings add column if not exists resale_bid_deposit numeric(12,2) not null default 50;
alter table public.app_settings add column if not exists instant_sale_hours int not null default 72;
alter table public.app_settings add column if not exists instant_commission numeric(5,4) not null default 0.15;

create sequence if not exists public.listing_no start 1001;
create table if not exists public.name_listings (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('SL-' || nextval('public.listing_no')),
  reserved_id uuid not null references public.reserved_names,
  name text not null,
  type text not null check (type in ('qaadan','bakkar','manqiya')),
  seller_id uuid not null references public.profiles,
  mode text not null check (mode in ('auction','instant')),
  price numeric(12,2) not null check (price > 0),
  commission_rate numeric(5,4) not null,
  status text not null check (status in ('scheduled','live','sold','unsold','expired','cancelled')),
  created_at timestamptz not null default now(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  auction_id uuid,
  sold_price numeric(12,2),
  sold_at timestamptz,
  payout numeric(12,2),
  payout_paid boolean not null default false
);
create unique index if not exists name_listings_active_uq on public.name_listings (reserved_id) where status in ('scheduled','live');
alter table public.name_listings enable row level security;

-- resale auctions have no request behind them
alter table public.auctions alter column request_id drop not null;
alter table public.auctions alter column candidate_id drop not null;
alter table public.auctions add column if not exists listing_id uuid references public.name_listings;
alter table public.auctions add column if not exists bid_deposit numeric(12,2);
alter table public.name_listings drop constraint if exists name_listings_auction_fk;
alter table public.name_listings add constraint name_listings_auction_fk foreign key (auction_id) references public.auctions;

-- an instant sale's invoice has no auction
alter table public.invoices alter column auction_id drop not null;
alter table public.invoices add column if not exists listing_id uuid references public.name_listings;

create table if not exists public.bid_deposits (
  auction_id uuid not null references public.auctions,
  user_id uuid not null references public.profiles,
  amount numeric(12,2) not null,
  state text not null default 'held' check (state in ('held','refunded','applied')),
  created_at timestamptz not null default now(),
  primary key (auction_id, user_id)
);
alter table public.bid_deposits enable row level security;

alter table public.reserved_names drop constraint if exists reserved_names_source_check;
alter table public.reserved_names add constraint reserved_names_source_check check (source in ('auction','legacy','compound','investment','resale'));
alter table public.wallet_txs drop constraint if exists wallet_txs_kind_check;
alter table public.wallet_txs add constraint wallet_txs_kind_check check (kind in ('topup','deposit','refund','invoice_payment','service_fee','investment_payout','bid_deposit','sale_payout','purchase'));

alter table public.payments drop constraint if exists payments_purpose_check;
alter table public.payments add constraint payments_purpose_check check (purpose in ('topup','deposit','invoice','bid_deposit','listing'));

-- ───────────── JSON ─────────────
create or replace function public.j_listing(l public.name_listings) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'number', l.number, 'reservedId', l.reserved_id, 'name', l.name, 'type', l.type,
    'sellerId', case when l.seller_id = auth.uid() then l.seller_id end, 'mode', l.mode, 'price', l.price, 'commissionRate', l.commission_rate,
    'status', l.status, 'createdAt', l.created_at, 'startsAt', l.starts_at, 'endsAt', l.ends_at, 'auctionId', l.auction_id,
    'soldPrice', l.sold_price, 'soldAt', l.sold_at,
    'payout', case when l.seller_id = auth.uid() then l.payout end, 'payoutPaid', case when l.seller_id = auth.uid() then l.payout_paid end,
    'currentPrice', coalesce((select current_price from auctions where id = l.auction_id), l.price),
    'bidCount', (select bid_count from auctions where id = l.auction_id))
$$;

create or replace function public.j_auction(a public.auctions) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'requestId', a.request_id, 'candidateId', a.candidate_id, 'name', a.name, 'type', a.type,
    'requesterId', a.requester_id, 'openingPrice', a.opening_price, 'minIncrement', a.min_increment,
    'startsAt', a.starts_at, 'endsAt', a.ends_at, 'currentPrice', a.current_price, 'bidCount', a.bid_count,
    'leaderId', a.leader_id, 'leaderLabel', (select public.mask_name(full_name) from profiles where id = a.leader_id),
    'settled', a.settled, 'winnerId', a.winner_id, 'winnerName', (select full_name from profiles where id = a.winner_id),
    'finalPrice', a.final_price, 'wonByRequester', a.won_by_requester, 'extensions', a.extensions,
    'investment', exists (select 1 from requests where id = a.request_id and kind = 'investment'),
    'listingId', a.listing_id, 'bidDeposit', a.bid_deposit)
$$;

create or replace function public.j_invoice(i public.invoices) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'number', i.number, 'userId', i.user_id,
    'buyerName', p.full_name, 'buyerPhone', p.phone, 'auctionId', coalesce(i.auction_id, i.listing_id), 'name', i.name, 'type', i.type,
    'total', i.total, 'vat', i.vat, 'subtotal', i.subtotal, 'depositApplied', i.deposit_applied, 'amountDue', i.amount_due,
    'status', i.status, 'issuedAt', i.issued_at, 'paidAt', i.paid_at,
    'ownerShare', i.owner_share, 'ownerShareTo', i.owner_share_to, 'ownerSharePaid', i.owner_share_paid, 'listingId', i.listing_id)
  from profiles p where p.id = i.user_id
$$;

create or replace function public.auction_view(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare a auctions; me uuid := auth.uid();
begin
  select * into a from auctions where id = p_id;
  if not found then raise exception 'المزاد غير موجود'; end if;
  return jsonb_build_object('auction', public.j_auction(a), 'bids', coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'auctionId', b.auction_id, 'userId', b.user_id,
      'bidderLabel', public.mask_name(p.full_name), 'amount', b.amount, 'createdAt', b.created_at, 'auto', b.auto) order by b.amount desc, b.created_at desc)
    from bids b join profiles p on p.id = b.user_id where b.auction_id = p_id), '[]'),
    'mine', case when me is null then null else jsonb_build_object(
      'watching', exists (select 1 from watches where auction_id = p_id and user_id = me),
      'autoMax', (select max_amount from autobids where auction_id = p_id and user_id = me),
      'depositPaid', exists (select 1 from bid_deposits where auction_id = p_id and user_id = me and state = 'held')) end);
end $$;

create or replace function public.my_names() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'normalized', r.normalized, 'type', r.type, 'ownerId', r.owner_id,
    'ownerName', r.owner_name, 'price', r.price, 'acquiredAt', r.acquired_at, 'source', r.source, 'baseName', r.base_name,
    'listingId', (select l.id from name_listings l where l.reserved_id = r.id and l.status in ('scheduled','live'))) order by r.acquired_at desc), '[]')
  from reserved_names r where r.owner_id = public.uid_or_fail()
$$;

-- ───────────── listing ─────────────
create or replace function public.create_listing(p_reserved uuid, p_mode text, p_price numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_settings := public.cfg(); u uuid := public.uid_or_fail(); r reserved_names; l name_listings; a auctions; p numeric := floor(p_price); x uuid;
begin
  select * into r from reserved_names where id = p_reserved and owner_id = u for update;
  if not found then raise exception 'الاسم غير مسجل باسمك'; end if;
  if p_mode not in ('auction','instant') then raise exception 'اختر نوع الطرح'; end if;
  if exists (select 1 from name_listings where reserved_id = r.id and status in ('scheduled','live')) then raise exception 'الاسم معروض للبيع حاليًا'; end if;
  if exists (select 1 from invoices where user_id = u and name = r.name and status = 'unpaid') then raise exception 'سدّد فاتورة الاسم أولًا قبل عرضه للبيع'; end if;
  if exists (select 1 from auctions where name = r.name and not settled) then raise exception 'للاسم مزاد قائم حاليًا'; end if;
  if p is null or p < s.opening_price then raise exception 'أقل قيمة % ريال', s.opening_price; end if;
  if p > 10000000 then raise exception 'القيمة كبيرة جدًا'; end if;
  if p_mode = 'auction' then
    insert into name_listings (reserved_id, name, type, seller_id, mode, price, commission_rate, status, starts_at, ends_at)
    values (r.id, r.name, r.type, u, 'auction', p, s.resale_commission, 'scheduled',
            now() + make_interval(hours => s.resale_notice_hours), now() + make_interval(hours => s.resale_notice_hours) + make_interval(days => s.resale_auction_days))
    returning * into l;
    insert into auctions (name, type, requester_id, opening_price, min_increment, starts_at, ends_at, current_price, listing_id, bid_deposit)
    values (l.name, l.type, u, p, s.min_increment, l.starts_at, l.ends_at, p, l.id, s.resale_bid_deposit) returning * into a;
    update name_listings set auction_id = a.id where id = l.id returning * into l;
  else
    insert into name_listings (reserved_id, name, type, seller_id, mode, price, commission_rate, status, starts_at, ends_at)
    values (r.id, r.name, r.type, u, 'instant', p, s.instant_commission, 'live', now(), now() + make_interval(hours => s.instant_sale_hours))
    returning * into l;
  end if;
  -- announced to every registered owner (the notify webhook sends it on by SMS)
  for x in select id from profiles where role = 'owner' and coalesce(active, true) and id <> u loop
    perform public.notify(x, 'auction_opened',
      case when l.mode = 'auction' then format('مزاد إعادة بيع: «%s»', l.name) else format('اسم معروض للبيع الفوري: «%s»', l.name) end,
      case when l.mode = 'auction' then format('يبدأ بعد %s ساعة بسعر افتتاحي %s ريال، ويستمر %s أيام.', s.resale_notice_hours, p, s.resale_auction_days)
           else format('بسعر %s ريال، متاح للشراء %s ساعة.', p, s.instant_sale_hours) end,
      case when l.mode = 'auction' then '/auctions/' || l.auction_id else '/market' end);
  end loop;
  return public.j_listing(l);
end $$;

create or replace function public.cancel_listing(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l name_listings; a auctions;
begin
  select * into l from name_listings where id = p_listing and seller_id = public.uid_or_fail() for update;
  if not found then raise exception 'العرض غير موجود'; end if;
  if l.mode = 'auction' then
    select * into a from auctions where id = l.auction_id for update;
    if l.status <> 'scheduled' or now() >= a.starts_at then raise exception 'بدأ المزاد، فلا يمكن إلغاء العرض'; end if;
    update name_listings set status = 'cancelled', auction_id = null where id = l.id returning * into l;
    delete from watches where auction_id = a.id;
    delete from autobids where auction_id = a.id;
    delete from auctions where id = a.id;
  else
    if l.status <> 'live' then raise exception 'العرض منتهٍ'; end if;
    update name_listings set status = 'cancelled' where id = l.id returning * into l;
  end if;
  return public.j_listing(l);
end $$;

create or replace function public.my_listings() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.j_listing(l) order by l.created_at desc), '[]') from name_listings l where l.seller_id = public.uid_or_fail()
$$;

-- fixed-price names on sale now, plus those closed in the last 3 days (shown locked)
create or replace function public.market_listings() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.sweep_listings();
  return (select coalesce(jsonb_agg(public.j_listing(l) order by (l.status = 'live') desc, l.ends_at), '[]') from name_listings l
    where l.mode = 'instant' and (l.status = 'live' or (l.status in ('sold','expired') and coalesce(l.sold_at, l.ends_at) > now() - interval '3 days')));
end $$;
grant execute on function public.market_listings() to anon, authenticated;

-- instant offers close after their window; resale auctions go live with their auction
create or replace function public.sweep_listings() returns int language plpgsql security definer set search_path = public as $$
declare l name_listings; n int := 0;
begin
  for l in update name_listings set status = 'expired' where mode = 'instant' and status = 'live' and ends_at <= now() returning * loop
    perform public.notify(l.seller_id, 'lost', format('انتهت مدة عرض «%s» للبيع', l.name), 'لم يُشترَ الاسم خلال 72 ساعة وبقي باسمك. تقدر تعرضه من جديد.', '/dashboard/sell');
    n := n + 1;
  end loop;
  update name_listings set status = 'live' where mode = 'auction' and status = 'scheduled' and starts_at <= now();
  return n;
end $$;
revoke execute on function public.sweep_listings() from public, anon, authenticated;

create or replace function public.transfer_name(p_listing uuid, p_buyer uuid, p_price numeric) returns void
language sql security definer set search_path = public as $$
  update reserved_names set owner_id = p_buyer, owner_name = (select full_name from profiles where id = p_buyer), price = p_price,
    acquired_at = now(), source = 'resale' where id = (select reserved_id from name_listings where id = p_listing)
$$;
revoke execute on function public.transfer_name(uuid, uuid, numeric) from public, anon, authenticated;

create or replace function public.buy_listing_for(p_user uuid, p_listing uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_settings := public.cfg(); l name_listings; vat numeric; inv invoices;
begin
  perform public.sweep_listings();
  select * into l from name_listings where id = p_listing for update;
  if not found or l.mode <> 'instant' then raise exception 'العرض غير موجود'; end if;
  if l.status <> 'live' or now() >= l.ends_at then raise exception 'انتهى عرض هذا الاسم'; end if;
  if l.seller_id = p_user then raise exception 'لا يمكنك شراء اسم تبيعه'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  if public.balance_of(p_user) < l.price then raise exception 'رصيد المحفظة لا يكفي، اشحن المحفظة أو ادفع بالبطاقة'; end if;
  insert into wallet_txs (user_id, amount, kind, note, ref) values (p_user, -l.price, 'purchase', format('شراء فوري للاسم «%s» (%s)', l.name, l.number), l.id);
  vat := round(l.price * s.vat_rate / (1 + s.vat_rate), 2);
  insert into invoices (number, user_id, auction_id, listing_id, name, type, total, vat, subtotal, deposit_applied, amount_due, status, paid_at, owner_share, owner_share_to)
  values ('INV-' || extract(year from now())::int || '-' || lpad(nextval('invoice_no')::text, 5, '0'), p_user, null, l.id, l.name, l.type,
          l.price, vat, l.price - vat, 0, l.price, 'unpaid', null, round(l.price * (1 - l.commission_rate), 2), l.seller_id)
  returning * into inv;
  update name_listings set status = 'sold', sold_price = l.price, sold_at = now(), payout = inv.owner_share where id = l.id;
  perform public.transfer_name(l.id, p_user, l.price);
  -- marking it paid credits the seller through the owner-share trigger
  update invoices set status = 'paid', paid_at = now() where id = inv.id;
  perform public.notify(p_user, 'won', format('مبارك، أصبح «%s» باسمك', l.name), format('اشتريته بـ %s ريال. فاتورتك وشهادة التسجيل في «أسمائي».', l.price), '/dashboard/names');
  perform public.notify(l.seller_id, 'won', format('بيع اسمك «%s»', l.name), format('بـ %s ريال، ويُضاف %s ريال إلى محفظتك بعد عمولة سمّها.', l.price, inv.owner_share), '/dashboard/sell');
  select * into l from name_listings where id = l.id;
  return public.j_listing(l);
end $$;
revoke execute on function public.buy_listing_for(uuid, uuid) from public, anon, authenticated;
create or replace function public.buy_listing(p_listing uuid) returns jsonb language sql security definer set search_path = public as $$
  select public.buy_listing_for(public.uid_or_fail(), p_listing)
$$;

-- ───────────── resale auctions: participation guarantee ─────────────
create or replace function public.pay_bid_deposit_for(p_user uuid, p_auction uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a auctions;
begin
  select * into a from auctions where id = p_auction for update;
  if not found or a.listing_id is null then raise exception 'المزاد غير موجود'; end if;
  if a.settled or now() >= a.ends_at then raise exception 'انتهى المزاد'; end if;
  if a.requester_id = p_user then raise exception 'لا يمكنك المزايدة على اسم تبيعه'; end if;
  if exists (select 1 from bid_deposits where auction_id = a.id and user_id = p_user and state = 'held') then return jsonb_build_object('ok', true); end if;
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  if public.balance_of(p_user) < a.bid_deposit then raise exception 'رصيد المحفظة لا يكفي، اشحن المحفظة أو ادفع بالبطاقة'; end if;
  insert into wallet_txs (user_id, amount, kind, note, ref) values (p_user, -a.bid_deposit, 'bid_deposit', format('ضمان دخول مزاد «%s»', a.name), a.id);
  insert into bid_deposits (auction_id, user_id, amount) values (a.id, p_user, a.bid_deposit)
  on conflict (auction_id, user_id) do update set state = 'held', amount = excluded.amount, created_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.pay_bid_deposit_for(uuid, uuid) from public, anon, authenticated;
create or replace function public.pay_bid_deposit(p_auction uuid) returns jsonb language sql security definer set search_path = public as $$
  select public.pay_bid_deposit_for(public.uid_or_fail(), p_auction)
$$;

create or replace function public.resale_guard(a public.auctions, u uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if a.listing_id is null then return; end if;
  if a.requester_id = u then raise exception 'لا يمكنك المزايدة على اسم تبيعه'; end if;
  if not exists (select 1 from bid_deposits where auction_id = a.id and user_id = u and state = 'held') then
    raise exception 'ادفع ضمان دخول المزاد % ريال أولًا', a.bid_deposit;
  end if;
end $$;
revoke execute on function public.resale_guard(public.auctions, uuid) from public, anon, authenticated;

-- ───────────── settlement ─────────────
create or replace function public.settle_resale(p_auction uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; l name_listings; s app_settings := public.cfg(); vat numeric; inv invoices; dep numeric := 0; d bid_deposits; u uuid;
begin
  select * into a from auctions where id = p_auction for update;
  select * into l from name_listings where id = a.listing_id for update;
  if a.bid_count = 0 or a.leader_id is null then
    update auctions set settled = true, winner_id = a.requester_id, final_price = 0, won_by_requester = true where id = a.id;
    update name_listings set status = 'unsold' where id = l.id;
    perform public.notify(l.seller_id, 'lost', format('انتهى مزاد «%s» دون مزايدات', a.name), 'بقي الاسم باسمك. تقدر تعرضه من جديد بسعر آخر.', '/dashboard/sell');
  else
    select * into d from bid_deposits where auction_id = a.id and user_id = a.leader_id and state = 'held';
    if found then dep := least(d.amount, a.current_price); update bid_deposits set state = 'applied' where auction_id = a.id and user_id = a.leader_id; end if;
    vat := round(a.current_price * s.vat_rate / (1 + s.vat_rate), 2);
    insert into invoices (number, user_id, auction_id, listing_id, name, type, total, vat, subtotal, deposit_applied, amount_due, status, owner_share, owner_share_to)
    values ('INV-' || extract(year from now())::int || '-' || lpad(nextval('invoice_no')::text, 5, '0'), a.leader_id, a.id, l.id, a.name, a.type,
            a.current_price, vat, a.current_price - vat, dep, a.current_price - dep, 'unpaid', round(a.current_price * (1 - l.commission_rate), 2), l.seller_id)
    returning * into inv;
    update auctions set settled = true, winner_id = a.leader_id, final_price = a.current_price, won_by_requester = false where id = a.id;
    update name_listings set status = 'sold', sold_price = a.current_price, sold_at = now(), payout = inv.owner_share where id = l.id;
    perform public.transfer_name(l.id, a.leader_id, a.current_price);
    perform public.notify(a.leader_id, 'won', format('مبارك عليك الفوز بمزاد شعار «%s»', a.name),
      format('بسعر %s ريال، وخُصم منه ضمان الدخول. سدّد الفاتورة خلال 3 أيام لإصدار شهادة الاسم.', a.current_price), '/dashboard/invoices');
    perform public.notify(l.seller_id, 'won', format('بيع اسمك «%s» في المزاد', a.name),
      format('بسعر %s ريال. يصلك %s ريال بعد عمولة سمّها فور سداد المشتري.', a.current_price, inv.owner_share), '/dashboard/sell');
    for u in select distinct user_id from bids where auction_id = a.id and user_id <> a.leader_id loop
      perform public.notify(u, 'lost', format('انتهى مزاد «%s»', a.name), format('رسا الاسم بسعر %s ريال.', a.current_price), '/auctions/' || a.id);
    end loop;
    if s.invoice_webhook_url is not null then
      perform net.http_post(s.invoice_webhook_url, public.j_invoice(inv) || jsonb_build_object('email', (select email from profiles where id = a.leader_id)));
    end if;
  end if;
  -- everyone else gets the participation guarantee back
  for d in update bid_deposits set state = 'refunded' where auction_id = a.id and state = 'held' returning * loop
    insert into wallet_txs (user_id, amount, kind, note, ref) values (d.user_id, d.amount, 'refund', format('استرداد ضمان دخول مزاد «%s»', a.name), a.id);
    perform public.notify(d.user_id, 'refund', 'أُعيد ضمان دخول المزاد إلى محفظتك', format('%s ريال من مزاد «%s».', d.amount, a.name), '/dashboard/wallet');
  end loop;
end $$;
revoke execute on function public.settle_resale(uuid) from public, anon, authenticated;

create or replace function public.settle_due_auctions() returns int
language plpgsql security definer set search_path = public as $$
declare a auctions; r requests; s app_settings := public.cfg(); winner uuid; price numeric; dep numeric; vat numeric; n int := 0; inv invoices;
begin
  for a in select * from auctions where not settled and ends_at <= now() order by ends_at for update skip locked loop
    if a.listing_id is not null then
      perform public.settle_resale(a.id);
      n := n + 1;
      continue;
    end if;
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
  perform public.resale_guard(a, u);
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
  perform public.resale_guard(a, u);
  if p_max is null or p_max < a.current_price + a.min_increment then raise exception 'الحد الأقصى % ريال على الأقل', a.current_price + a.min_increment; end if;
  if p_max > 1000000 then raise exception 'الحد الأقصى كبير جدًا'; end if;
  insert into autobids (auction_id, user_id, max_amount) values (a.id, u, floor(p_max))
  on conflict (auction_id, user_id) do update set max_amount = excluded.max_amount, created_at = now();
  insert into watches (auction_id, user_id) values (a.id, u) on conflict do nothing;
  perform public.resolve_autobids(a.id);
  return public.auction_view(a.id);
end $$;

create or replace function public.trg_invoice_owner_share() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status <> 'paid' and new.owner_share > 0 and new.owner_share_to is not null and not new.owner_share_paid then
    if new.listing_id is not null then
      insert into wallet_txs (user_id, amount, kind, note, ref)
      values (new.owner_share_to, new.owner_share, 'sale_payout', format('ثمن بيع الاسم «%s» بعد عمولة سمّها (%s)', new.name, new.number), new.id);
      update name_listings set payout_paid = true where id = new.listing_id;
      perform public.notify(new.owner_share_to, 'refund', format('أُضيف %s ريال إلى محفظتك', new.owner_share), format('ثمن بيع اسمك «%s» بعد خصم عمولة سمّها.', new.name), '/dashboard/wallet');
    else
      insert into wallet_txs (user_id, amount, kind, note, ref)
      values (new.owner_share_to, new.owner_share, 'investment_payout', format('نصيبك 30%% من بيع الاسم «%s» (%s)', new.name, new.number), new.id);
      perform public.notify(new.owner_share_to, 'refund', format('أُضيف %s ريال إلى محفظتك', new.owner_share), format('نصيبك من بيع الاسم «%s» في المزاد.', new.name), '/dashboard/wallet');
    end if;
    update invoices set owner_share_paid = true where id = new.id;
  end if;
  return new;
end $$;

-- resale auctions send their own result notices
create or replace function public.trg_auction_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.requester_id, 'auction_opened', format('حُدّد موعد مزاد «%s»', new.name),
      format('يبدأ %s بتوقيت الرياض.', to_char(new.starts_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI')), '/auctions/' || new.id);
  elsif new.settled and not old.settled and new.listing_id is null then
    perform public.notify(new.winner_id, 'won', format('مبارك عليك الفوز بمزاد شعار «%s»', new.name),
      format('بسعر %s ريال. فاتورتك الإلكترونية جاهزة، سدّدها لإصدار شهادة التسجيل.', new.final_price), '/dashboard/invoices');
    for u in select distinct user_id from bids where auction_id = new.id and user_id <> new.winner_id loop
      perform public.notify(u, 'lost', format('انتهى مزاد «%s»', new.name), format('رسا الاسم بسعر %s ريال.', new.final_price), '/auctions/' || new.id);
    end loop;
  end if;
  return new;
end $$;

-- the minute cron also closes expired instant offers
create or replace function public.settle_and_sweep() returns int language plpgsql security definer set search_path = public as $$
begin
  perform public.sweep_listings();
  return public.settle_due_auctions();
end $$;
revoke execute on function public.settle_and_sweep() from public, anon, authenticated;
select cron.schedule('sammha-settle-auctions', '* * * * *', $$select public.settle_and_sweep()$$);
