-- Matching engine, part 1: what the five algorithms need stored.
--   items + item_names     the catalogue every listing and request points at (search, shelf life)
--   engine_settings        every number the engine uses, editable without code
--   area_rules             hide an item, or shift its expected demand, by area and date
--   reference_prices       today's mandi and shop price per item and area (live feed + manual)
--   delivery_batches       household orders pooled into one trip until it pays for itself
-- plus the new columns on farmers, buyers, listings, requests and orders.

create table public.items (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  category public.produce_category not null,
  name_en text not null,
  name_hi text not null,
  base_unit text not null check (base_unit in ('kg', 'litre', 'piece', 'dozen')),
  shelf_life_hours integer not null check (shelf_life_hours > 0),
  agmarknet_names text[] not null default '{}',
  sort integer not null default 0,
  active boolean not null default true
);

-- Every spelling a buyer or farmer might type, in English, Hindi in Latin letters and Hindi script.
create table public.item_names (
  item_id text not null references public.items (id) on delete cascade,
  name text not null,
  primary key (item_id, name)
);

-- One row. Each value is the design default; change it here and the engine follows.
create table public.engine_settings (
  id boolean primary key default true check (id),
  road_factor numeric not null default 1.3 check (road_factor >= 1),
  speed_kmph numeric not null default 30 check (speed_kmph > 0),
  freshness_limit numeric not null default 0.6 check (freshness_limit > 0 and freshness_limit <= 1),
  cost_per_road_km numeric not null default 10 check (cost_per_road_km >= 0),
  farmer_share numeric not null default 0.5 check (farmer_share between 0 and 1),
  nudge_cap numeric not null default 0.25 check (nudge_cap between 0 and 1),
  nudge_min_requests integer not null default 20 check (nudge_min_requests >= 0),
  lot_cut_per_100 numeric not null default 0.05 check (lot_cut_per_100 >= 0),
  lot_cut_max numeric not null default 0.05 check (lot_cut_max between 0 and 0.5),
  trust_prior_on_time numeric not null default 8 check (trust_prior_on_time >= 0),
  trust_prior_total numeric not null default 10 check (trust_prior_total > 0),
  w_household jsonb not null default '{"price": 0.30, "fresh": 0.30, "near": 0.20, "trust": 0.20, "fill": 0}',
  w_business jsonb not null default '{"price": 0.35, "fresh": 0.10, "near": 0.05, "trust": 0.30, "fill": 0.20}',
  household_max_km numeric not null default 25 check (household_max_km > 0),
  business_max_km numeric not null default 100 check (business_max_km > 0),
  farmer_radius_km numeric not null default 40 check (farmer_radius_km > 0),
  require_verified boolean not null default false,
  batch_window_hours numeric not null default 24 check (batch_window_hours > 0),
  fallback_break_even_kg numeric not null default 20 check (fallback_break_even_kg > 0),
  -- Shop price estimate = mandi x markup when no shop price is known. Vegetables, fruits and pulses
  -- follow the RBI farmers'-share studies (2024); the other categories are estimates to replace.
  shop_markup jsonb not null default '{"vegetables": 3.0, "fruits": 2.7, "grains": 1.5, "pulses": 1.4, "spices": 1.8, "oilseeds": 1.5, "dairy": 1.35, "others": 2.0}',
  search_cutoff numeric not null default 0.55 check (search_cutoff between 0 and 1),
  updated_at timestamptz not null default now()
);
insert into public.engine_settings default values;

-- Admin-set rules for an area and a date range. Never about a person: an area, an item or category, dates.
create table public.area_rules (
  id uuid primary key default gen_random_uuid(),
  state text,
  district text,
  item_id text references public.items (id) on delete cascade,
  category public.produce_category,
  starts_on date not null,
  ends_on date not null,
  action text not null check (action in ('hide', 'demand')),
  demand_multiplier numeric check (demand_multiplier > 0),
  note text check (char_length(note) <= 300),
  constraint area_rule_target check (item_id is not null or category is not null),
  constraint area_rule_dates check (ends_on >= starts_on),
  constraint area_rule_multiplier check ((action = 'demand') = (demand_multiplier is not null)),
  constraint area_rule_place check (district is null or state is not null)
);

-- Prices per item base unit (kg, litre, piece). state/district '' = national / state-wide.
create table public.reference_prices (
  item_id text not null references public.items (id) on delete cascade,
  state text not null default '',
  district text not null default '',
  source text not null check (source in ('manual', 'agmarknet', 'sample')),
  price_date date not null,
  mandi_price numeric(12, 2) check (mandi_price > 0),
  shop_price numeric(12, 2) check (shop_price > 0),
  markets integer,
  fetched_at timestamptz not null default now(),
  primary key (item_id, state, district, source),
  constraint reference_price_some check (mandi_price is not null or shop_price is not null)
);

alter table public.farmer_details
  add column verified boolean not null default false,
  add column delivery_radius_km numeric(6, 1) check (delivery_radius_km > 0),
  add column orders_completed integer not null default 0 check (orders_completed >= 0),
  add column orders_on_time integer not null default 0 check (orders_on_time >= 0);

alter table public.buyer_details
  add column max_distance_km numeric(6, 1) check (max_distance_km > 0);

alter table public.produce
  add column item_id text not null references public.items (id),
  add column harvested_at timestamptz not null default now(),
  add column delivery_radius_km numeric(6, 1) check (delivery_radius_km > 0);
create index produce_match_idx on public.produce (item_id, status) include (lat, lng);
create index produce_active_geo_idx on public.produce (lat, lng) where status = 'active';

alter table public.demand_requests
  add column item_id text references public.items (id);
create index demand_item_idx on public.demand_requests (item_id, status);

-- A trip from one farm to one PIN code, collecting household orders until it pays for itself.
create table public.delivery_batches (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  drop_lat double precision,
  drop_lng double precision,
  distance_km numeric(8, 2),
  trip_cost numeric(12, 2) not null default 0,
  status text not null default 'open' check (status in ('open', 'released', 'cancelled')),
  -- Load and savings (shop - mandi) of the orders in the batch; it releases when room >= trip_cost.
  load_qty numeric(14, 2) not null default 0,
  room numeric(14, 2) not null default 0,
  below_break_even boolean not null default false,
  opened_at timestamptz not null default now(),
  cutoff_at timestamptz not null,
  released_at timestamptz
);
-- At most one open batch per farm and PIN code; place_order relies on this to pool orders.
create unique index batches_open_idx on public.delivery_batches (farmer_id, pincode) where status = 'open';
create index batches_cutoff_idx on public.delivery_batches (cutoff_at) where status = 'open';

alter table public.orders
  add column batch_id uuid references public.delivery_batches (id) on delete set null,
  add column delivery_fee numeric(12, 2) not null default 0,
  add column distance_km numeric(8, 2),
  add column deliver_by timestamptz;
create index orders_batch_idx on public.orders (batch_id);

-- Views now carry the item, harvest time and the farmer's record (columns appended at the end).
create or replace view public.market_listings as
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
  coalesce(r.ratings_count, 0) as farmer_ratings_count,
  p.item_id,
  p.harvested_at,
  fd.verified as farmer_verified,
  fd.orders_completed,
  fd.orders_on_time
from public.produce p
join public.profiles pr on pr.id = p.farmer_id
left join public.farmer_details fd on fd.user_id = p.farmer_id
left join public.farmer_ratings r on r.farmer_id = p.farmer_id
where p.status in ('active', 'sold_out');

create or replace view public.farmer_public as
select
  pr.id, pr.full_name, pr.avatar_url,
  fd.farm_name, fd.farm_size_acres, fd.main_crops,
  a.district, a.state,
  r.avg_rating,
  coalesce(r.ratings_count, 0) as ratings_count,
  pr.created_at as member_since,
  fd.verified,
  fd.orders_completed,
  fd.orders_on_time
from public.profiles pr
left join public.farmer_details fd on fd.user_id = pr.id
left join public.addresses a on a.user_id = pr.id and a.is_default
left join public.farmer_ratings r on r.farmer_id = pr.id
where pr.role = 'farmer' and pr.onboarded;

create or replace view public.open_demand as
select
  d.id, d.buyer_id, d.category, d.item_name, d.quantity, d.unit, d.target_price, d.needed_by, d.notes,
  d.district, d.state, d.status, d.created_at,
  pr.consumer_type as buyer_type,
  case
    when pr.consumer_type = 'industrial' then coalesce(nullif(trim(bd.business_name), ''), split_part(pr.full_name, ' ', 1))
    else split_part(pr.full_name, ' ', 1)
  end as buyer_label,
  round(d.lat::numeric, 2)::float8 as approx_lat,
  round(d.lng::numeric, 2)::float8 as approx_lng,
  d.item_id
from public.demand_requests d
join public.profiles pr on pr.id = d.buyer_id
left join public.buyer_details bd on bd.user_id = d.buyer_id
where d.status = 'open' and (d.needed_by is null or d.needed_by >= current_date);
