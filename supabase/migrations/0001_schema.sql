-- ════════════════════════════════════════════════════════════════
-- Sammha (سمّها) — schema
-- All writes go through SECURITY DEFINER functions in 0002_logic.sql.
-- RLS is enabled on every table with no client policies (deny by default),
-- so the browser can never edit prices, statuses or balances directly.
-- ════════════════════════════════════════════════════════════════
create extension if not exists fuzzystrmatch;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.app_settings (
  id boolean primary key default true check (id),
  deposit_amount numeric(12,2) not null default 50,
  opening_price numeric(12,2) not null default 50,
  min_increment numeric(12,2) not null default 10,
  extend_minutes int not null default 2,
  names_per_request int not null default 3,
  vat_rate numeric(5,4) not null default 0.15,
  similar_threshold numeric(4,3) not null default 0.7,
  invoice_webhook_url text            -- n8n webhook that emails the e-invoice to the owner (optional)
);
insert into public.app_settings default values;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text not null unique check (phone ~ '^05[0-9]{8}$'),
  email text not null,
  national_id text,
  role text not null default 'owner' check (role in ('owner','committee','admin')),
  created_at timestamptz not null default now()
);

create sequence public.request_no start 1001;
create sequence public.invoice_no start 1;

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('SM-' || nextval('public.request_no')),
  user_id uuid not null references public.profiles,
  type text not null check (type in ('qaadan','bakkar')),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','under_review','accepted','rejected','cancelled')),
  deposit_amount numeric(12,2) not null,
  deposit_paid boolean not null default false,
  deposit_state text not null default 'none' check (deposit_state in ('none','held','applied','refunded')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles,
  review_note text
);
create index on public.requests (user_id);
create index on public.requests (status);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests on delete cascade,
  position int not null,
  name text not null,
  normalized text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  "similar" jsonb not null default '[]',
  reject_reason text,
  auction_id uuid
);
create index on public.candidates (normalized);

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests,
  candidate_id uuid not null unique references public.candidates,
  name text not null,
  type text not null check (type in ('qaadan','bakkar')),
  requester_id uuid not null references public.profiles,
  opening_price numeric(12,2) not null,
  min_increment numeric(12,2) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  current_price numeric(12,2) not null,
  bid_count int not null default 0,
  leader_id uuid references public.profiles,
  settled boolean not null default false,
  winner_id uuid references public.profiles,
  final_price numeric(12,2),
  won_by_requester boolean
);
alter table public.candidates add constraint candidates_auction_fk foreign key (auction_id) references public.auctions;
create index on public.auctions (ends_at) where not settled;

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions,
  user_id uuid not null references public.profiles,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index on public.bids (auction_id, amount desc);
create index on public.bids (user_id);

create table public.reserved_names (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized text not null,
  type text not null check (type in ('qaadan','bakkar')),
  owner_id uuid references public.profiles,
  owner_name text not null,
  price numeric(12,2) not null default 0,
  acquired_at timestamptz not null default now(),
  source text not null default 'legacy' check (source in ('auction','legacy')),
  auction_id uuid references public.auctions
);
create unique index reserved_names_normalized_uq on public.reserved_names (normalized);

create table public.wallet_txs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  amount numeric(12,2) not null,
  kind text not null check (kind in ('topup','deposit','refund','invoice_payment')),
  note text not null,
  ref uuid,
  created_at timestamptz not null default now()
);
create index on public.wallet_txs (user_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  user_id uuid not null references public.profiles,
  auction_id uuid not null unique references public.auctions,
  name text not null,
  type text not null,
  total numeric(12,2) not null,
  vat numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  deposit_applied numeric(12,2) not null default 0,
  amount_due numeric(12,2) not null,
  status text not null default 'unpaid' check (status in ('paid','unpaid')),
  issued_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Moyasar card payments, confirmed by the moyasar-webhook Edge Function
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  purpose text not null check (purpose in ('topup','deposit','invoice')),
  ref uuid,
  amount numeric(12,2) not null,
  provider_id text unique,
  status text not null default 'initiated' check (status in ('initiated','paid','failed')),
  created_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.candidates enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.reserved_names enable row level security;
alter table public.wallet_txs enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

-- Realtime: clients may subscribe to auction price changes (read-only, public data)
create policy auctions_public_read on public.auctions for select using (true);

-- New auth user → profile (data passed in signUp options)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, email, national_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone',
          new.email, nullif(new.raw_user_meta_data->>'national_id', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
