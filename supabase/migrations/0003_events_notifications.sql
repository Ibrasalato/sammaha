-- ════════════════════════════════════════════════════════════════
-- Sammha — camel events calendar, in-app notifications, certificate verification
-- ════════════════════════════════════════════════════════════════

create table public.events (
  id text primary key default ('ev-' || substr(gen_random_uuid()::text, 1, 8)),
  title text not null,
  title_en text not null default '',
  kind text not null check (kind in ('mazayin','race','conference','world_day','heritage')),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  approx boolean not null default true,
  city text not null default '',
  country text not null default '',
  description text not null default '',
  url text,
  city_en text,
  country_en text,
  description_en text
);
alter table public.events enable row level security;

insert into public.events (id, kind, approx, title, title_en, starts_on, ends_on, city, country, description, url) values
 ('ev-kacf-11','mazayin',true,'مهرجان الملك عبدالعزيز للإبل','King Abdulaziz Camel Festival','2026-12-01','2027-01-15','الصياهد، الدهناء','السعودية','أكبر تجمع ثقافي واقتصادي للإبل في العالم، ويضم مسابقات المزاين بفئات الألوان والطلبية والأشواط، بتنظيم نادي الإبل.','https://camelclub.gov.sa'),
 ('ev-dhafra','mazayin',true,'مهرجان الظفرة','Al Dhafra Festival','2026-12-15','2027-01-25','مدينة زايد، الظفرة','الإمارات','مهرجان تراثي سنوي يضم مزاينة الإبل ومسابقات الحلاب وسباقات الهجن والصناعات التقليدية.',null),
 ('ev-marmoom','race',true,'مهرجان المرموم التراثي للهجن','Al Marmoom Heritage Festival','2027-03-20','2027-04-05','ميدان المرموم، دبي','الإمارات','من أبرز مواسم سباقات الهجن في الخليج، ويختتم موسم السباقات بأشواط الرموز.',null),
 ('ev-camel-day-2027','world_day',false,'اليوم العالمي للإبل','World Camel Day','2027-06-22','2027-06-22','حول العالم','دولي','يوم سنوي للتعريف بمكانة الإبل وقيمتها البيئية والاقتصادية والثقافية.',null),
 ('ev-cpcf','race',true,'مهرجان ولي العهد للهجن','Crown Prince Camel Festival','2027-08-05','2027-09-05','ميدان الهجن، الطائف','السعودية','أكبر مهرجان لسباقات الهجن في المملكة، بأشواط مخصصة للفئات العمرية وجوائز الرموز.',null),
 ('ev-racing-season','race',true,'موسم سباقات الهجن المحلية','Local camel racing season','2026-10-20','2027-04-30','ميادين المملكة','السعودية','سلسلة سباقات الهجن الأسبوعية في ميادين المملكة على مدار الموسم الشتوي.',null);

create or replace function public.j_event(e public.events) returns jsonb language sql stable as $$
  select jsonb_build_object('id', e.id, 'title', e.title, 'titleEn', e.title_en, 'kind', e.kind, 'startsOn', e.starts_on,
    'endsOn', e.ends_on, 'approx', e.approx, 'city', e.city, 'country', e.country, 'description', e.description, 'url', e.url,
    'cityEn', e.city_en, 'countryEn', e.country_en, 'descriptionEn', e.description_en)
$$;

create or replace function public.list_events() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.j_event(e) order by e.starts_on), '[]') from events e
$$;

create or replace function public.admin_save_event(p_event jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e events;
begin
  perform public.require_staff();
  insert into events (id, title, title_en, kind, starts_on, ends_on, approx, city, country, description, url)
  values (coalesce(nullif(p_event->>'id', ''), 'ev-' || substr(gen_random_uuid()::text, 1, 8)), p_event->>'title', coalesce(p_event->>'titleEn', ''),
          p_event->>'kind', (p_event->>'startsOn')::date, (p_event->>'endsOn')::date, coalesce((p_event->>'approx')::boolean, true),
          coalesce(p_event->>'city', ''), coalesce(p_event->>'country', ''), coalesce(p_event->>'description', ''), nullif(p_event->>'url', ''))
  on conflict (id) do update set title = excluded.title, title_en = excluded.title_en, kind = excluded.kind, starts_on = excluded.starts_on,
    ends_on = excluded.ends_on, approx = excluded.approx, city = excluded.city, country = excluded.country, description = excluded.description, url = excluded.url
  returning * into e;
  return public.j_event(e);
end $$;

create or replace function public.admin_delete_event(p_id text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  delete from events where id = p_id;
end $$;

-- ───────────── certificates ─────────────
create or replace function public.cert_no(p_id uuid) returns text language sql immutable as $$
  select 'SMC-' || upper(right(replace(p_id::text, '-', ''), 8))
$$;

create or replace function public.verify_certificate(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name, 'normalized', normalized, 'type', type, 'ownerId', owner_id,
    'ownerName', owner_name, 'price', price, 'acquiredAt', acquired_at, 'source', source)
  from reserved_names where public.cert_no(id) = upper(btrim(p_code)) limit 1
$$;

-- ───────────── notifications ─────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  kind text not null check (kind in ('outbid','won','lost','reviewed','auction_opened','refund')),
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

alter table public.app_settings add column if not exists notify_webhook_url text; -- n8n: WhatsApp/SMS/email fan-out

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text default null) returns void
language plpgsql security definer set search_path = public as $$
declare url text := (select notify_webhook_url from app_settings limit 1);
begin
  insert into notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
  if url is not null then
    perform net.http_post(url, jsonb_build_object('kind', p_kind, 'title', p_title, 'body', p_body, 'link', p_link,
      'phone', (select phone from profiles where id = p_user), 'email', (select email from profiles where id = p_user)));
  end if;
end $$;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.my_notifications() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'userId', user_id, 'kind', kind, 'title', title, 'body', body,
    'link', link, 'createdAt', created_at, 'read', read) order by created_at desc), '[]')
  from (select * from notifications where user_id = public.uid_or_fail() order by created_at desc limit 30) n
$$;

create or replace function public.mark_notifications_read() returns void language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = public.uid_or_fail() and not read
$$;

-- Fire notifications from data changes (keeps 0002 functions untouched)
create or replace function public.trg_bid_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare prev uuid; nm text;
begin
  select user_id into prev from bids where auction_id = new.auction_id and id <> new.id order by amount desc, created_at desc limit 1;
  select name into nm from auctions where id = new.auction_id;
  if prev is not null and prev <> new.user_id then
    perform public.notify(prev, 'outbid', format('تجاوز مزايد آخر مزايدتك على «%s»', nm),
      format('أعلى مزايدة الآن %s ريال. زايد قبل انتهاء الوقت.', new.amount), '/auctions/' || new.auction_id);
  end if;
  return new;
end $$;
create trigger bids_notify after insert on public.bids for each row execute function public.trg_bid_notify();

create or replace function public.trg_auction_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.requester_id, 'auction_opened', format('حُدّد موعد مزاد «%s»', new.name),
      format('يبدأ %s بتوقيت الرياض.', to_char(new.starts_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI')), '/auctions/' || new.id);
  elsif new.settled and not old.settled then
    perform public.notify(new.winner_id, 'won', format('رسا عليك اسم «%s»', new.name),
      format('بسعر %s ريال. فاتورتك الإلكترونية جاهزة.', new.final_price), '/dashboard/invoices');
    for u in select distinct user_id from bids where auction_id = new.id and user_id <> new.winner_id loop
      perform public.notify(u, 'lost', format('انتهى مزاد «%s»', new.name), format('رسا الاسم بسعر %s ريال.', new.final_price), '/auctions/' || new.id);
    end loop;
  end if;
  return new;
end $$;
create trigger auctions_notify after insert or update of settled on public.auctions for each row execute function public.trg_auction_notify();

create or replace function public.trg_request_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'under_review' and new.status in ('accepted','rejected','cancelled') then
    perform public.notify(new.user_id, 'reviewed',
      case new.status when 'accepted' then format('قُبل طلبك %s', new.number) when 'rejected' then format('لم يُقبل طلبك %s', new.number) else format('أُلغي طلبك %s', new.number) end,
      coalesce(new.review_note, case when new.status = 'accepted' then 'سيُحدَّد موعد المزاد قريبًا.' else 'أُعيد ضمان المزاد إلى محفظتك.' end),
      '/dashboard/requests/' || new.id);
  end if;
  if old.deposit_state = 'held' and new.deposit_state = 'refunded' then
    perform public.notify(new.user_id, 'refund', 'أُعيد ضمان المزاد إلى محفظتك', format('%s ريال من الطلب %s.', new.deposit_amount, new.number), '/dashboard/wallet');
  end if;
  return new;
end $$;
create trigger requests_notify after update on public.requests for each row execute function public.trg_request_notify();

update public.events set city_en = 'Al-Sayahid, Al-Dahna', country_en = 'Saudi Arabia', description_en = 'The world''s largest cultural and economic gathering for camels, with beauty contests by colour category, organised by the Camel Club.' where id = 'ev-kacf-11';
update public.events set city_en = 'Madinat Zayed, Al Dhafra', country_en = 'UAE', description_en = 'Annual heritage festival with camel beauty contests, milking competitions, races and traditional crafts.' where id = 'ev-dhafra';
update public.events set city_en = 'Al Marmoom track, Dubai', country_en = 'UAE', description_en = 'One of the Gulf''s leading camel racing seasons, closing with the flagship races.' where id = 'ev-marmoom';
update public.events set city_en = 'Worldwide', country_en = 'International', description_en = 'An annual day celebrating the environmental, economic and cultural value of camels.' where id = 'ev-camel-day-2027';
update public.events set city_en = 'Camel racetrack, Taif', country_en = 'Saudi Arabia', description_en = 'The Kingdom''s largest camel racing festival, with age-group heats and flagship prizes.' where id = 'ev-cpcf';
update public.events set city_en = 'Racetracks across the Kingdom', country_en = 'Saudi Arabia', description_en = 'Weekly camel races across the Kingdom throughout the winter season.' where id = 'ev-racing-season';
