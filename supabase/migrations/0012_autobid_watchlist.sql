-- ════════════════════════════════════════════════════════════════
-- Sammha — automatic (proxy) bidding, watchlist with reminders, extension counter, realtime.
-- ════════════════════════════════════════════════════════════════

alter table public.bids add column if not exists auto boolean not null default false;
alter table public.auctions add column if not exists extensions int not null default 0;

create table public.autobids (
  auction_id uuid not null references public.auctions on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  max_amount numeric(12,2) not null check (max_amount > 0),
  created_at timestamptz not null default now(),
  primary key (auction_id, user_id)
);
alter table public.autobids enable row level security;

create table public.watches (
  auction_id uuid not null references public.auctions on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  notified_start boolean not null default false,
  notified_end boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (auction_id, user_id)
);
alter table public.watches enable row level security;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('outbid','won','lost','reviewed','auction_opened','refund','ticket','reminder'));

-- realtime row updates for the auction page (only ids/prices travel; RLS still denies direct reads)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.auctions';
  end if;
exception when duplicate_object then null; end $$;

create or replace function public.j_auction(a public.auctions) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'requestId', a.request_id, 'candidateId', a.candidate_id, 'name', a.name, 'type', a.type,
    'requesterId', a.requester_id, 'openingPrice', a.opening_price, 'minIncrement', a.min_increment,
    'startsAt', a.starts_at, 'endsAt', a.ends_at, 'currentPrice', a.current_price, 'bidCount', a.bid_count,
    'leaderId', a.leader_id, 'leaderLabel', (select public.mask_name(full_name) from profiles where id = a.leader_id),
    'settled', a.settled, 'winnerId', a.winner_id, 'winnerName', (select full_name from profiles where id = a.winner_id),
    'finalPrice', a.final_price, 'wonByRequester', a.won_by_requester, 'extensions', a.extensions)
$$;

-- one bid: price, leader and the anti-sniping extension (outbid notice comes from the bids trigger)
create or replace function public.record_bid(p_auction uuid, p_user uuid, p_amount numeric, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
declare win interval := make_interval(mins => (public.cfg()).extend_minutes);
begin
  insert into bids (auction_id, user_id, amount, auto) values (p_auction, p_user, p_amount, p_auto);
  update auctions set current_price = p_amount, bid_count = bid_count + 1, leader_id = p_user,
    extensions = extensions + case when ends_at - now() < win then 1 else 0 end,
    ends_at = case when ends_at - now() < win then now() + win else ends_at end
  where id = p_auction;
end $$;
revoke execute on function public.record_bid(uuid, uuid, numeric, boolean) from public, anon, authenticated;

-- proxy bidding: raise auto-bidders by the minimum step up to their ceiling; the earlier ceiling wins ties
create or replace function public.resolve_autobids(p_auction uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; ch autobids; lead autobids; lead_max numeric; i int;
begin
  for i in 1..20 loop
    select * into a from auctions where id = p_auction for update;
    exit when a.settled or now() < a.starts_at or now() >= a.ends_at;
    select * into ch from autobids where auction_id = a.id and user_id is distinct from a.leader_id
      and max_amount >= a.current_price + a.min_increment order by max_amount desc, created_at limit 1;
    exit when ch.user_id is null;
    select * into lead from autobids where auction_id = a.id and user_id = a.leader_id;
    lead_max := greatest(coalesce(lead.max_amount, 0), a.current_price);
    if ch.max_amount > lead_max then
      if lead.user_id is not null and lead.max_amount > a.current_price then
        perform public.record_bid(a.id, a.leader_id, lead.max_amount, true);
      end if;
      perform public.record_bid(a.id, ch.user_id, least(ch.max_amount, lead_max + a.min_increment), true);
    else
      perform public.record_bid(a.id, ch.user_id, ch.max_amount, true);
      perform public.record_bid(a.id, a.leader_id, least(lead_max, ch.max_amount + a.min_increment), true);
    end if;
  end loop;
end $$;
revoke execute on function public.resolve_autobids(uuid) from public, anon, authenticated;

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
      'autoMax', (select max_amount from autobids where auction_id = p_id and user_id = me)) end);
end $$;
revoke execute on function public.auction_view(uuid) from public, anon;

create or replace function public.get_auction(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.settle_due_auctions();
  perform public.resolve_autobids(p_id);
  return public.auction_view(p_id);
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
  if p_max is null or p_max < a.current_price + a.min_increment then raise exception 'الحد الأقصى % ريال على الأقل', a.current_price + a.min_increment; end if;
  if p_max > 1000000 then raise exception 'الحد الأقصى كبير جدًا'; end if;
  insert into autobids (auction_id, user_id, max_amount) values (a.id, u, floor(p_max))
  on conflict (auction_id, user_id) do update set max_amount = excluded.max_amount, created_at = now();
  insert into watches (auction_id, user_id) values (a.id, u) on conflict do nothing;
  perform public.resolve_autobids(a.id);
  return public.auction_view(a.id);
end $$;

create or replace function public.cancel_autobid(p_auction uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  delete from autobids where auction_id = p_auction and user_id = public.uid_or_fail();
  return public.auction_view(p_auction);
end $$;

create or replace function public.toggle_watch(p_auction uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare u uuid := public.uid_or_fail();
begin
  if not exists (select 1 from auctions where id = p_auction) then raise exception 'المزاد غير موجود'; end if;
  delete from watches where auction_id = p_auction and user_id = u;
  if found then return false; end if;
  insert into watches (auction_id, user_id) values (p_auction, u);
  return true;
end $$;

create or replace function public.my_watchlist() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.j_auction(a) order by a.ends_at), '[]')
  from watches w join auctions a on a.id = w.auction_id where w.user_id = public.uid_or_fail()
$$;

-- reminders an hour before the start and an hour before the end; run every minute by pg_cron
create or replace function public.notify_watchers() returns int language plpgsql security definer set search_path = public as $$
declare w record; n int := 0;
begin
  for w in select ws.*, a.name, a.starts_at, a.ends_at, a.current_price from watches ws join auctions a on a.id = ws.auction_id
    where not a.settled and ((not ws.notified_start and now() < a.starts_at and a.starts_at - now() <= interval '1 hour')
       or (not ws.notified_end and now() >= a.starts_at and now() < a.ends_at and a.ends_at - now() <= interval '1 hour')) loop
    if now() < w.starts_at then
      perform public.notify(w.user_id, 'reminder', format('مزاد «%s» يبدأ خلال ساعة', w.name), 'جهّز مزايدتك، أو فعّل المزايدة التلقائية.', '/auctions/' || w.auction_id);
      update watches set notified_start = true where auction_id = w.auction_id and user_id = w.user_id;
    else
      perform public.notify(w.user_id, 'reminder', format('مزاد «%s» ينتهي خلال ساعة', w.name), format('أعلى مزايدة الآن %s ريال.', w.current_price), '/auctions/' || w.auction_id);
      update watches set notified_end = true where auction_id = w.auction_id and user_id = w.user_id;
    end if;
    n := n + 1;
  end loop;
  -- auctions that just opened with auto-bids waiting
  perform public.resolve_autobids(a.id) from auctions a
    where not a.settled and now() >= a.starts_at and now() < a.ends_at and exists (select 1 from autobids b where b.auction_id = a.id);
  return n;
end $$;
revoke execute on function public.notify_watchers() from public, anon, authenticated;
select cron.schedule('sammha-notify-watchers', '* * * * *', $$select public.notify_watchers()$$);
