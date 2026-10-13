-- ════════════════════════════════════════════════════════════════
-- Sammha — one-time codes (sign-in and phone change) and owner account editing.
-- Until an SMS provider is connected the code is app_settings.otp_fixed_code (4321).
-- Once sms_webhook_url is set (e.g. an n8n workflow calling the SMS provider), codes are
-- random and sent by SMS; set otp_fixed_code to null at that point.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

alter table public.app_settings add column if not exists otp_fixed_code text default '4321';
alter table public.app_settings add column if not exists sms_webhook_url text;

create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  purpose text not null check (purpose in ('login','phone')),
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.otp_codes (user_id, created_at desc);
alter table public.otp_codes enable row level security;

create or replace function public.mask_phone(p text) returns text language sql immutable as $$
  select left(p, 2) || repeat('•', greatest(length(p) - 5, 0)) || right(p, 3)
$$;

create or replace function public.issue_otp(p_user uuid, p_purpose text, p_phone text, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s app_settings; code text; rec otp_codes; recent int;
begin
  select * into s from app_settings limit 1;
  select count(*) into recent from otp_codes where user_id = p_user and created_at > now() - interval '10 minutes';
  if recent >= 5 then raise exception 'طلبت رموزًا كثيرة، حاول بعد دقائق'; end if;
  code := coalesce(s.otp_fixed_code, lpad((floor(random() * 10000))::int::text, 4, '0'));
  if p_id is not null then delete from otp_codes where id = p_id and user_id = p_user; end if;
  insert into otp_codes (id, user_id, purpose, phone, code_hash, expires_at)
  values (coalesce(p_id, gen_random_uuid()), p_user, p_purpose, p_phone, encode(digest(code, 'sha256'), 'hex'), now() + interval '5 minutes')
  returning * into rec;
  if s.sms_webhook_url is not null and s.otp_fixed_code is null then
    perform net.http_post(s.sms_webhook_url, jsonb_build_object('phone', p_phone, 'purpose', p_purpose,
      'message', format('رمز التحقق لمنصة سمّها: %s. لا تشاركه مع أحد.', code)));
  end if;
  return jsonb_build_object('challenge', rec.id, 'phoneMasked', public.mask_phone(p_phone), 'expiresAt', rec.expires_at);
end $$;
revoke execute on function public.issue_otp(uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public.request_otp(p_purpose text, p_phone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; ph text;
begin
  select * into me from profiles where id = public.uid_or_fail();
  if p_purpose = 'login' then
    return public.issue_otp(me.id, 'login', me.phone);
  elsif p_purpose = 'phone' then
    ph := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
    if ph !~ '^05[0-9]{8}$' then raise exception 'رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام'; end if;
    if ph = me.phone then raise exception 'هذا رقمك الحالي'; end if;
    if exists (select 1 from profiles where phone = ph) then raise exception 'رقم الجوال مسجل لحساب آخر'; end if;
    return public.issue_otp(me.id, 'phone', ph);
  end if;
  raise exception 'طلب غير صحيح';
end $$;

create or replace function public.resend_otp(p_challenge uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare rec otp_codes;
begin
  select * into rec from otp_codes where id = p_challenge and user_id = public.uid_or_fail() and used_at is null;
  if not found then raise exception 'انتهت الجلسة، أعد إدخال بياناتك'; end if;
  return public.issue_otp(rec.user_id, rec.purpose, rec.phone, rec.id);
end $$;

-- Wrong codes must NOT raise: a raise would roll back the attempt counter and allow brute force.
-- Returns {"ok": true, "phone", "userId"} or {"ok": false, "error"}.
create or replace function public.consume_otp(p_challenge uuid, p_code text, p_purpose text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare rec otp_codes;
begin
  select * into rec from otp_codes where id = p_challenge and user_id = public.uid_or_fail() and purpose = p_purpose and used_at is null for update;
  if not found or rec.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'انتهت صلاحية الرمز، اطلب رمزًا جديدًا'); end if;
  if rec.attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'تجاوزت عدد المحاولات، اطلب رمزًا جديدًا'); end if;
  update otp_codes set attempts = attempts + 1 where id = rec.id;
  if encode(digest(regexp_replace(coalesce(p_code, ''), '\D', '', 'g'), 'sha256'), 'hex') <> rec.code_hash then
    return jsonb_build_object('ok', false, 'error', format('الرمز غير صحيح، بقي %s محاولات', 4 - rec.attempts));
  end if;
  update otp_codes set used_at = now() where id = rec.id;
  return jsonb_build_object('ok', true, 'phone', rec.phone, 'userId', rec.user_id);
end $$;
revoke execute on function public.consume_otp(uuid, text, text) from public, anon, authenticated;

create or replace function public.verify_otp(p_challenge uuid, p_code text, p_purpose text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return public.consume_otp(p_challenge, p_code, p_purpose);
end $$;

create or replace function public.change_my_phone(p_challenge uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb := public.consume_otp(p_challenge, p_code, 'phone'); ph text; p profiles;
begin
  if not (res->>'ok')::boolean then return res; end if;
  ph := res->>'phone';
  if exists (select 1 from profiles where phone = ph and id <> auth.uid()) then return jsonb_build_object('ok', false, 'error', 'رقم الجوال مسجل لحساب آخر'); end if;
  update profiles set phone = ph where id = auth.uid() returning * into p;
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}') || jsonb_build_object('phone', ph) where id = auth.uid();
  return jsonb_build_object('ok', true, 'user', public.j_profile(p));
end $$;

create or replace function public.update_my_account(p_full_name text, p_national_id text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nm text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g'); nid text := nullif(btrim(coalesce(p_national_id, '')), ''); p profiles;
begin
  if length(nm) < 6 then raise exception 'اكتب الاسم الرباعي'; end if;
  if nid is not null and nid !~ '^[12][0-9]{9}$' then raise exception 'رقم الهوية أو الإقامة 10 أرقام يبدأ بـ 1 أو 2'; end if;
  update profiles set full_name = nm, national_id = nid where id = public.uid_or_fail() returning * into p;
  update reserved_names set owner_name = nm where owner_id = p.id;
  return public.j_profile(p);
end $$;

-- the profile email follows the auth email once the user confirms the change
create or replace function public.trg_auth_email_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then update profiles set email = new.email where id = new.id; end if;
  return new;
end $$;
drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email after update of email on auth.users for each row execute function public.trg_auth_email_sync();
