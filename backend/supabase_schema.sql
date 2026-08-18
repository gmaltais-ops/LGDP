-- ============================================================
-- LGDP APP — Supabase Postgres Schema
-- Copy-paste this ENTIRE file into: Supabase Dashboard → SQL Editor → Run
-- Idempotent: safe to run multiple times.
-- ============================================================

create extension if not exists pgcrypto;

-- Auto-update trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------- USERS (JWT auth managed by FastAPI) ----------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,            -- legacy id format (user_xxx)
  email text not null unique,
  name text not null,
  password_hash text,
  picture text,
  is_admin boolean not null default false,
  auth_provider text not null default 'password',  -- 'password' | 'google'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------- SESSIONS (Emergent Google Auth) ----------------
create table if not exists public.user_sessions (
  session_token text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user on public.user_sessions(user_id);
create index if not exists idx_sessions_expires on public.user_sessions(expires_at);

-- ---------------- WRESTLERS ----------------
create table if not exists public.wrestlers (
  wrestler_id text primary key,
  name text not null,
  nickname text,
  photo text,
  bio text,
  style text,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------- CHAMPIONSHIPS ----------------
create table if not exists public.championships (
  championship_id text primary key,
  title text not null,
  current_holder text,
  image text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------- MATCHES ----------------
create table if not exists public.matches (
  match_id text primary key,
  wrestler_one text not null,
  wrestler_two text not null,
  event text,
  date timestamptz not null,
  winner text,
  match_type text,
  status text not null default 'upcoming' check (status in ('upcoming','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_matches_date on public.matches(date);

-- ---------------- EPISODES ----------------
create table if not exists public.episodes (
  episode_id text primary key,
  episode_number integer not null,
  title text not null,
  description text,
  cover_image text,
  audio_url text not null,
  duration integer not null default 0,
  release_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_episodes_number on public.episodes(episode_number desc);

-- ---------------- EVENTS ----------------
create table if not exists public.events (
  event_id text primary key,
  name text not null,
  date timestamptz not null,
  location text not null,
  description text,
  poster text,
  capacity integer not null default 500,
  price numeric(10,2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_events_date on public.events(date);

-- ---------------- PRODUCTS ----------------
create table if not exists public.products (
  product_id text primary key,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image text,
  stock integer not null default 0 check (stock >= 0),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_category on public.products(category);

-- ---------------- TICKETS ----------------
create table if not exists public.tickets (
  ticket_id text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  event_id text not null references public.events(event_id) on delete cascade,
  event_name text not null,
  event_date timestamptz not null,
  event_location text not null,
  quantity integer not null check (quantity > 0),
  total numeric(10,2) not null check (total >= 0),
  square_payment_id text not null,
  status text not null default 'confirmed',
  purchase_date timestamptz not null default now()
);
create index if not exists idx_tickets_user on public.tickets(user_id);
create index if not exists idx_tickets_event on public.tickets(event_id);

-- ---------------- ORDERS ----------------
create table if not exists public.orders (
  order_id text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  product_id text not null references public.products(product_id),
  product_name text not null,
  product_image text,
  quantity integer not null check (quantity > 0),
  total numeric(10,2) not null check (total >= 0),
  square_payment_id text not null,
  status text not null default 'confirmed',
  date timestamptz not null default now()
);
create index if not exists idx_orders_user on public.orders(user_id);

-- ---------------- FAVORITES ----------------
create table if not exists public.favorites (
  user_id text not null references public.users(user_id) on delete cascade,
  episode_id text not null references public.episodes(episode_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

-- ---------------- NEWS ----------------
create table if not exists public.news (
  news_id text primary key,
  title text not null,
  description text,
  image text,
  category text not null,
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_news_date on public.news(date desc);

-- ---------------- UPDATED_AT triggers ----------------
do $$
declare t text;
begin
  foreach t in array array['users','wrestlers','championships','matches','episodes','events','products'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------- SECURITY ----------------
-- Backend uses service_role key which bypasses RLS.
-- Lock out anon + authenticated roles as defense in depth.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ============================================================
-- DONE. Now set env vars in /app/backend/.env:
--   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
--   USE_SUPABASE=true
-- Then restart backend: sudo supervisorctl restart backend
-- ============================================================
