-- AnnSetu schema: users' profiles, produce with its stock ledger, orders, buyer demand, reviews.
-- Quantities are numeric so "2.5 kg" works; money is numeric(12,2) rupees.

create type public.user_role as enum ('farmer', 'consumer');
create type public.consumer_type as enum ('individual', 'industrial');
create type public.unit as enum ('kg', 'quintal', 'tonne', 'dozen', 'piece', 'litre', 'bunch');
create type public.produce_category as enum ('vegetables', 'fruits', 'grains', 'pulses', 'spices', 'dairy', 'oilseeds', 'others');
create type public.produce_status as enum ('active', 'paused', 'sold_out', 'archived');
-- 'pooling': a household order waiting in a delivery batch until the trip pays for itself.
create type public.order_status as enum ('pooling', 'placed', 'accepted', 'rejected', 'packed', 'out_for_delivery', 'delivered', 'cancelled');
create type public.ledger_type as enum ('listed', 'restocked', 'reserved', 'released', 'sold', 'spoiled', 'adjusted');
create type public.demand_status as enum ('open', 'fulfilled', 'closed');
create type public.business_type as enum ('restaurant', 'retailer', 'wholesaler', 'processor', 'institution', 'other');

-- One row per auth user, created by the on_auth_user_created trigger.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  consumer_type public.consumer_type,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^[0-9+ -]{7,16}$'),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  preferred_lang text not null default 'en' check (preferred_lang in ('en', 'hi')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consumer_type_matches_role check ((role = 'consumer') = (consumer_type is not null))
);

create table public.farmer_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  farm_name text check (char_length(farm_name) <= 120),
  farm_size_acres numeric(10, 2) check (farm_size_acres is null or farm_size_acres >= 0),
  main_crops text[] not null default '{}' check (cardinality(main_crops) <= 20),
  updated_at timestamptz not null default now()
);

create table public.buyer_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text check (char_length(business_name) <= 160),
  business_type public.business_type,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label text not null default 'home' check (char_length(label) <= 40),
  line1 text not null check (char_length(line1) between 1 and 200),
  line2 text check (char_length(line2) <= 200),
  village_city text not null check (char_length(village_city) between 1 and 120),
  district text not null check (char_length(district) between 1 and 120),
  state text not null check (char_length(state) between 1 and 80),
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

-- A farmer's listing. qty_available is derived; the four counters only change through the
-- functions in 20261004000002_functions.sql, which also write the produce_log ledger.
create table public.produce (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category public.produce_category not null,
  name text not null check (char_length(name) between 1 and 80),
  variety text check (char_length(variety) <= 80),
  description text check (char_length(description) <= 2000),
  unit public.unit not null,
  price_per_unit numeric(12, 2) not null check (price_per_unit > 0),
  qty_listed numeric(14, 2) not null check (qty_listed >= 0),
  qty_sold numeric(14, 2) not null default 0 check (qty_sold >= 0),
  qty_reserved numeric(14, 2) not null default 0 check (qty_reserved >= 0),
  qty_spoiled numeric(14, 2) not null default 0 check (qty_spoiled >= 0),
  qty_available numeric(14, 2) generated always as (qty_listed - qty_sold - qty_reserved - qty_spoiled) stored,
  min_order_qty numeric(14, 2) not null default 1 check (min_order_qty > 0),
  harvest_date date,
  best_before date,
  is_organic boolean not null default false,
  images text[] not null default '{}' check (cardinality(images) <= 4),
  status public.produce_status not null default 'active',
  district text,
  state text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produce_stock_non_negative check (qty_listed - qty_sold - qty_reserved - qty_spoiled >= 0),
  constraint produce_dates check (best_before is null or harvest_date is null or best_before >= harvest_date)
);
create index produce_farmer_idx on public.produce (farmer_id, created_at desc);
create index produce_market_idx on public.produce (status, category, created_at desc);

-- A checkout with items from several farmers becomes one order per farmer (same checkout_id).
-- Delivery, buyer and farmer details are snapshots taken when the order is placed.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null,
  buyer_id uuid references public.profiles (id) on delete set null,
  farmer_id uuid references public.profiles (id) on delete set null,
  status public.order_status not null default 'placed',
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  total numeric(14, 2) not null default 0,
  delivery_name text not null,
  delivery_phone text not null,
  delivery_line1 text not null,
  delivery_line2 text,
  delivery_village_city text not null,
  delivery_district text not null,
  delivery_state text not null,
  delivery_pincode text not null,
  delivery_lat double precision,
  delivery_lng double precision,
  delivery_notes text,
  buyer_name text not null,
  buyer_type public.consumer_type,
  farmer_name text not null,
  farmer_phone text,
  status_history jsonb not null default '[]'::jsonb,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_farmer_idx on public.orders (farmer_id, created_at desc);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_checkout_idx on public.orders (checkout_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  produce_id uuid references public.produce (id) on delete set null,
  name text not null,
  unit public.unit not null,
  unit_price numeric(12, 2) not null,
  quantity numeric(14, 2) not null check (quantity > 0)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_produce_idx on public.order_items (produce_id);

-- Append-only stock ledger behind each listing's "Stock log".
create table public.produce_log (
  id uuid primary key default gen_random_uuid(),
  produce_id uuid not null references public.produce (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  change_type public.ledger_type not null,
  quantity numeric(14, 2) not null,
  note text check (char_length(note) <= 300),
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);
create index produce_log_produce_idx on public.produce_log (produce_id, created_at desc);

-- What buyers need. Open requests feed the farmers' suggestion panel.
create table public.demand_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category public.produce_category not null default 'others',
  item_name text not null check (char_length(item_name) between 1 and 80),
  quantity numeric(14, 2) not null check (quantity > 0),
  unit public.unit not null,
  target_price numeric(12, 2) check (target_price is null or target_price > 0),
  needed_by date,
  notes text check (char_length(notes) <= 1000),
  district text,
  state text,
  lat double precision,
  lng double precision,
  status public.demand_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index demand_open_idx on public.demand_requests (status, created_at desc);
create index demand_buyer_idx on public.demand_requests (buyer_id, created_at desc);

-- One rating per delivered order.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  buyer_id uuid references public.profiles (id) on delete set null,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  reviewer_name text not null default '',
  created_at timestamptz not null default now()
);
create index reviews_farmer_idx on public.reviews (farmer_id, created_at desc);

-- Public, privacy-trimmed views. They run with the owner's rights, so they expose only the
-- columns listed here: no phone numbers, and coordinates rounded to about 1 km.
create view public.farmer_ratings as
select farmer_id, round(avg(rating)::numeric, 1)::float8 as avg_rating, count(*)::int as ratings_count
from public.reviews
group by farmer_id;

create view public.market_listings as
select
  p.id, p.farmer_id, p.category, p.name, p.variety, p.description, p.unit, p.price_per_unit,
  p.qty_available, p.min_order_qty, p.harvest_date, p.best_before, p.is_organic, p.images, p.status,
  p.district, p.state,
  round(p.lat::numeric, 2)::float8 as approx_lat,
  round(p.lng::numeric, 2)::float8 as approx_lng,
  p.created_at,
  pr.full_name as farmer_name,
  fd.farm_name,
  pr.avatar_url as farmer_avatar,
  r.avg_rating as farmer_rating,
  coalesce(r.ratings_count, 0) as farmer_ratings_count
from public.produce p
join public.profiles pr on pr.id = p.farmer_id
left join public.farmer_details fd on fd.user_id = p.farmer_id
left join public.farmer_ratings r on r.farmer_id = p.farmer_id
where p.status in ('active', 'sold_out');

create view public.farmer_public as
select
  pr.id, pr.full_name, pr.avatar_url,
  fd.farm_name, fd.farm_size_acres, fd.main_crops,
  a.district, a.state,
  r.avg_rating,
  coalesce(r.ratings_count, 0) as ratings_count,
  pr.created_at as member_since
from public.profiles pr
left join public.farmer_details fd on fd.user_id = pr.id
left join public.addresses a on a.user_id = pr.id and a.is_default
left join public.farmer_ratings r on r.farmer_id = pr.id
where pr.role = 'farmer' and pr.onboarded;

create view public.open_demand as
select
  d.id, d.buyer_id, d.category, d.item_name, d.quantity, d.unit, d.target_price, d.needed_by, d.notes,
  d.district, d.state, d.status, d.created_at,
  pr.consumer_type as buyer_type,
  case
    when pr.consumer_type = 'industrial' then coalesce(nullif(trim(bd.business_name), ''), split_part(pr.full_name, ' ', 1))
    else split_part(pr.full_name, ' ', 1)
  end as buyer_label,
  round(d.lat::numeric, 2)::float8 as approx_lat,
  round(d.lng::numeric, 2)::float8 as approx_lng
from public.demand_requests d
join public.profiles pr on pr.id = d.buyer_id
left join public.buyer_details bd on bd.user_id = d.buyer_id
where d.status = 'open' and (d.needed_by is null or d.needed_by >= current_date);
