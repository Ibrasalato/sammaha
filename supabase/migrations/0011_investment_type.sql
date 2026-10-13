-- ════════════════════════════════════════════════════════════════
-- Sammha — third name category: استثمار (investment), alongside قعدان and بكار.
-- ════════════════════════════════════════════════════════════════

alter table public.requests drop constraint if exists requests_type_check;
alter table public.requests add constraint requests_type_check check (type in ('qaadan','bakkar','istithmar'));
alter table public.auctions drop constraint if exists auctions_type_check;
alter table public.auctions add constraint auctions_type_check check (type in ('qaadan','bakkar','istithmar'));
alter table public.reserved_names drop constraint if exists reserved_names_type_check;
alter table public.reserved_names add constraint reserved_names_type_check check (type in ('qaadan','bakkar','istithmar'));
alter table public.invoices drop constraint if exists invoices_type_check;
alter table public.invoices add constraint invoices_type_check check (type in ('qaadan','bakkar','istithmar'));

create or replace function public.create_request(p_type text, p_names text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s app_settings := public.cfg(); checks jsonb; c jsonb; r requests; i int := 0; bad text;
begin
  perform public.uid_or_fail();
  if p_type not in ('qaadan','bakkar','istithmar') then raise exception 'نوع غير صحيح'; end if;
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
