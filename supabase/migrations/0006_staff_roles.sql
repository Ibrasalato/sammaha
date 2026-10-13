-- ════════════════════════════════════════════════════════════════
-- Sammha — super admin and staff management
-- role 'admin' = super admin (manages staff accounts), 'committee' = approval committee staff.
-- The platform owner's email is always admin and cannot be demoted or suspended.
-- ════════════════════════════════════════════════════════════════

alter table public.app_settings add column if not exists super_admin_email text not null default 'ibrasalato@gmail.com';
alter table public.profiles add column if not exists active boolean not null default true;

create or replace function public.is_super_email(p_email text) returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(p_email, '')) = lower((select super_admin_email from app_settings limit 1))
$$;

-- the super admin email always gets the admin role, whenever the profile is created or edited
create or replace function public.trg_profile_super() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_super_email(new.email) then new.role := 'admin'; new.active := true; end if;
  return new;
end $$;
drop trigger if exists profiles_super on public.profiles;
create trigger profiles_super before insert or update on public.profiles for each row execute function public.trg_profile_super();
update public.profiles set role = 'admin' where public.is_super_email(email);

-- staff checks now also refuse suspended accounts
create or replace function public.require_staff() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = public.uid_or_fail();
  if p.role not in ('committee','admin') or not p.active then raise exception 'هذه العملية للجنة الاعتماد فقط'; end if;
  return p;
end $$;

create or replace function public.require_admin() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = public.uid_or_fail();
  if p.role <> 'admin' or not p.active then raise exception 'هذه العملية لمدير النظام فقط'; end if;
  return p;
end $$;

create or replace function public.j_profile(p public.profiles) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'fullName', p.full_name, 'phone', p.phone, 'email', p.email,
    'nationalId', p.national_id, 'role', p.role, 'createdAt', p.created_at,
    'avatarUrl', p.avatar_url, 'showAvatar', p.show_avatar, 'active', p.active)
$$;

create or replace function public.admin_target(p_user uuid) returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare actor public.profiles := public.require_admin(); t public.profiles;
begin
  select * into t from profiles where id = p_user;
  if t.id is null then raise exception 'المستخدم غير موجود'; end if;
  if public.is_super_email(t.email) then raise exception 'لا يمكن تعديل حساب مدير النظام الرئيسي'; end if;
  if t.id = actor.id then raise exception 'لا يمكنك تعديل صلاحيات حسابك'; end if;
  return t;
end $$;
revoke execute on function public.admin_target(uuid) from public, anon, authenticated;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.profiles := public.admin_target(p_user);
begin
  if p_role not in ('owner','committee','admin') then raise exception 'صلاحية غير معروفة'; end if;
  update profiles set role = p_role where id = t.id returning * into t;
  return public.j_profile(t);
end $$;

create or replace function public.admin_set_active(p_user uuid, p_active boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.profiles := public.admin_target(p_user);
begin
  update profiles set active = p_active where id = t.id returning * into t;
  return public.j_profile(t);
end $$;

-- suspended accounts can't use any signed-in function (owners included)
create or replace function public.uid_or_fail() returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;
  if exists (select 1 from profiles where id = auth.uid() and not active) then raise exception 'هذا الحساب موقوف'; end if;
  return auth.uid();
end $$;
