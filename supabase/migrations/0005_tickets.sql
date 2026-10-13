-- ════════════════════════════════════════════════════════════════
-- Sammha — contact tickets: complaints, reports, enquiries, suggestions
-- Anyone (signed in or not) files a ticket and gets a BL- tracking number;
-- staff handle them from the committee dashboard; n8n emails the team and the customer.
-- ════════════════════════════════════════════════════════════════

create sequence public.ticket_no start 1;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  kind text not null check (kind in ('complaint','report','inquiry','suggestion')),
  topic text not null default '',
  subject text not null check (length(subject) between 3 and 120),
  name text not null check (length(name) between 2 and 80),
  phone text not null check (phone ~ '^05[0-9]{8}$'),
  email text check (email is null or email ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$'),
  ref_number text,
  message text not null check (length(message) between 10 and 3000),
  user_id uuid references public.profiles,
  status text not null default 'new' check (status in ('new','in_progress','answered','closed')),
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  assignee text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tickets (phone);
create index on public.tickets (status, created_at desc);
alter table public.tickets enable row level security;

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets on delete cascade,
  by_role text not null check (by_role in ('customer','staff')),
  author text not null,
  body text not null check (length(body) between 2 and 3000),
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.ticket_messages (ticket_id, created_at);
alter table public.ticket_messages enable row level security;

alter table public.app_settings add column if not exists ticket_webhook_url text; -- n8n "Sammha 6 — Tickets Email"
alter table public.app_settings add column if not exists site_url text default 'https://ibrasalato.github.io/sammaha/';

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('outbid','won','lost','reviewed','auction_opened','refund','ticket'));

create or replace function public.ticket_kind_label(k text) returns text language sql immutable as $$
  select case k when 'complaint' then 'شكوى' when 'report' then 'بلاغ' when 'inquiry' then 'استفسار' else 'اقتراح' end
$$;
create or replace function public.ticket_status_label(s text) returns text language sql immutable as $$
  select case s when 'new' then 'جديد' when 'in_progress' then 'قيد المعالجة' when 'answered' then 'تم الرد' else 'مغلق' end
$$;

create or replace function public.j_ticket(t public.tickets, p_staff boolean) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'number', t.number, 'kind', t.kind, 'topic', t.topic, 'subject', t.subject, 'name', t.name,
    'phone', t.phone, 'email', t.email, 'refNumber', t.ref_number, 'message', t.message, 'userId', t.user_id, 'status', t.status,
    'priority', t.priority, 'assignee', case when p_staff then t.assignee end, 'createdAt', t.created_at, 'updatedAt', t.updated_at,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'by', m.by_role, 'author', m.author, 'body', m.body,
        'internal', m.internal, 'createdAt', m.created_at) order by m.created_at)
      from ticket_messages m where m.ticket_id = t.id and (p_staff or not m.internal)), '[]'))
$$;
revoke execute on function public.j_ticket(public.tickets, boolean) from public, anon, authenticated;

-- emails go out through n8n; the webhook payload matches src/lib/tickets.ts emailTicketEvent()
create or replace function public.ticket_email(p_event text, t public.tickets, p_reply text default '') returns void
language plpgsql security definer set search_path = public as $$
declare s app_settings;
begin
  select * into s from app_settings limit 1;
  if s.ticket_webhook_url is null then return; end if;
  perform net.http_post(s.ticket_webhook_url, jsonb_build_object('event', p_event, 'reply', coalesce(p_reply, ''),
    'ticket', jsonb_build_object('number', t.number, 'kind', t.kind, 'kindLabel', public.ticket_kind_label(t.kind), 'topic', t.topic,
      'subject', t.subject, 'name', t.name, 'phone', t.phone, 'email', coalesce(t.email, ''), 'message', t.message,
      'refNumber', coalesce(t.ref_number, ''), 'status', t.status, 'statusLabel', public.ticket_status_label(t.status),
      'trackUrl', coalesce(s.site_url, '') || '#/contact/track/' || t.number)));
end $$;
revoke execute on function public.ticket_email(text, public.tickets, text) from public, anon, authenticated;

-- ───────────── public ─────────────
create or replace function public.submit_ticket(p_ticket jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare t tickets; recent int;
begin
  -- simple abuse guard: at most 5 tickets per mobile number per hour
  select count(*) into recent from tickets where phone = p_ticket->>'phone' and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'أرسلت عدة طلبات خلال وقت قصير، حاول بعد قليل'; end if;
  insert into tickets (number, kind, topic, subject, name, phone, email, ref_number, message, user_id, priority)
  values ('BL-' || to_char(now() at time zone 'Asia/Riyadh', 'YY') || lpad(nextval('ticket_no')::text, 4, '0'),
    p_ticket->>'kind', left(coalesce(p_ticket->>'topic', ''), 60), btrim(p_ticket->>'subject'), btrim(p_ticket->>'name'), p_ticket->>'phone',
    nullif(btrim(coalesce(p_ticket->>'email', '')), ''), nullif(left(btrim(coalesce(p_ticket->>'refNumber', '')), 40), ''),
    btrim(p_ticket->>'message'), auth.uid(), case when p_ticket->>'kind' = 'report' then 'urgent' else 'normal' end)
  returning * into t;
  perform public.ticket_email('created', t);
  return public.j_ticket(t, false);
end $$;

create or replace function public.track_ticket(p_number text, p_phone text) returns jsonb language sql stable security definer set search_path = public as $$
  select public.j_ticket(t, false) from tickets t where t.number = upper(btrim(p_number)) and t.phone = p_phone limit 1
$$;

create or replace function public.follow_up_ticket(p_number text, p_phone text, p_body text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t tickets;
begin
  select * into t from tickets where number = upper(btrim(p_number)) and phone = p_phone;
  if t.id is null then raise exception 'لم نجد طلبًا بهذا الرقم والجوال'; end if;
  if t.status = 'closed' then raise exception 'هذا الطلب مغلق، افتح طلبًا جديدًا'; end if;
  insert into ticket_messages (ticket_id, by_role, author, body) values (t.id, 'customer', t.name, left(btrim(p_body), 3000));
  update tickets set status = case when status = 'answered' then 'in_progress' else status end, updated_at = now()
    where id = t.id returning * into t;
  return public.j_ticket(t, false);
end $$;

create or replace function public.my_tickets() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.j_ticket(t, false) order by t.created_at desc), '[]') from tickets t
  where t.user_id = public.uid_or_fail() or t.phone = (select phone from profiles where id = auth.uid())
$$;

-- ───────────── staff ─────────────
create or replace function public.admin_list_tickets() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return (select coalesce(jsonb_agg(public.j_ticket(t, true) order by t.created_at desc), '[]') from tickets t);
end $$;

create or replace function public.admin_get_ticket(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t tickets;
begin
  perform public.require_staff();
  select * into t from tickets where id = p_id;
  if t.id is null then raise exception 'الطلب غير موجود'; end if;
  return public.j_ticket(t, true);
end $$;

create or replace function public.admin_update_ticket(p_id uuid, p_patch jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare t tickets; old_status text;
begin
  perform public.require_staff();
  select status into old_status from tickets where id = p_id;
  if old_status is null then raise exception 'الطلب غير موجود'; end if;
  update tickets set
    status = coalesce(p_patch->>'status', status),
    priority = coalesce(p_patch->>'priority', priority),
    assignee = case when p_patch ? 'assignee' then nullif(p_patch->>'assignee', '') else assignee end,
    updated_at = now()
  where id = p_id returning * into t;
  if t.status <> old_status and t.status in ('in_progress', 'closed') then perform public.ticket_email('status', t); end if;
  return public.j_ticket(t, true);
end $$;

create or replace function public.admin_reply_ticket(p_id uuid, p_body text, p_internal boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare p profiles; t tickets; body text := left(btrim(p_body), 3000);
begin
  p := public.require_staff();
  select * into t from tickets where id = p_id;
  if t.id is null then raise exception 'الطلب غير موجود'; end if;
  insert into ticket_messages (ticket_id, by_role, author, body, internal) values (t.id, 'staff', p.full_name, body, coalesce(p_internal, false));
  update tickets set
    status = case when not coalesce(p_internal, false) then 'answered' when status = 'new' then 'in_progress' else status end,
    assignee = coalesce(assignee, p.full_name), updated_at = now()
  where id = t.id returning * into t;
  if not coalesce(p_internal, false) then
    if t.user_id is not null then
      perform public.notify(t.user_id, 'ticket', format('رد فريق سمّها على طلبك %s', t.number), left(body, 120), '/dashboard/tickets');
    end if;
    perform public.ticket_email('reply', t, body);
  end if;
  return public.j_ticket(t, true);
end $$;

-- overview now also counts open tickets
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
    'revenue', (select coalesce(sum(total), 0) from invoices where status = 'paid'),
    'openTickets', (select count(*) from tickets where status in ('new', 'in_progress')));
end $$;

grant execute on function public.submit_ticket(jsonb), public.track_ticket(text, text), public.follow_up_ticket(text, text, text) to anon, authenticated;
