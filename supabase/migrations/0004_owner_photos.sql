-- ════════════════════════════════════════════════════════════════
-- Sammha — owner profile photos (uploaded by the owner, shown publicly only with consent)
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists show_avatar boolean not null default false;

create or replace function public.j_profile(p public.profiles) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'fullName', p.full_name, 'phone', p.phone, 'email', p.email,
    'nationalId', p.national_id, 'role', p.role, 'createdAt', p.created_at,
    'avatarUrl', p.avatar_url, 'showAvatar', p.show_avatar)
$$;

-- p_keep = true leaves the current photo untouched (only the consent flag changes)
create or replace function public.update_my_profile(p_avatar_url text, p_keep boolean, p_show boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  update profiles set
    avatar_url = case when p_keep then avatar_url else p_avatar_url end,
    show_avatar = coalesce(p_show, false) and (case when p_keep then avatar_url else p_avatar_url end) is not null
  where id = public.uid_or_fail() returning * into p;
  return public.j_profile(p);
end $$;

create or replace function public.list_reserved(p_q text default '', p_type text default 'all') returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'normalized', r.normalized, 'type', r.type, 'ownerId', r.owner_id,
    'ownerName', r.owner_name, 'price', r.price, 'acquiredAt', r.acquired_at, 'source', r.source,
    'ownerAvatar', case when p.show_avatar then p.avatar_url end) order by r.acquired_at desc), '[]')
  from reserved_names r left join profiles p on p.id = r.owner_id
  where (p_type = 'all' or r.type = p_type)
    and (coalesce(p_q, '') = '' or r.normalized like '%' || public.normalize_name(p_q) || '%' or r.owner_name like '%' || p_q || '%')
$$;

-- Storage: public bucket, each owner may write only <their id>.jpg
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
create policy "avatars: owner uploads own photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
create policy "avatars: owner replaces own photo" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
create policy "avatars: owner deletes own photo" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
