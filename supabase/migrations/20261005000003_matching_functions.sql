-- Matching engine, part 2: the algorithms that run inside the database.
--   match_listings     steps 2 + 3 (hard rules, score), built from live stock on every request (step 4)
--   match_hidden       how many listings each hard rule removed, for "why don't I see …"
--   rate_inputs        the signals the rate suggestion needs (step 5 runs in the browser)
--   quote_delivery     delivery fee and batch progress before a buyer places an order
--   place_order        one-step reserve (step 4) + delivery fee + household batches
--   release_due_batches, update_order_status, update_batch_status
-- The TypeScript reference in src/lib/matching/engine.ts implements the same rules; tests compare them.

-- Helpers --------------------------------------------------------------------------------------

create or replace function public.geo_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable parallel safe
set search_path = ''
as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

-- How many base units (kg, litre, piece, dozen) one selling unit holds; null when they don't convert.
create or replace function public.unit_factor(p_unit public.unit, p_base text)
returns numeric
language sql immutable parallel safe
set search_path = ''
as $$
  select (case p_base
    when 'kg' then case p_unit when 'kg' then 1 when 'quintal' then 100 when 'tonne' then 1000 end
    when 'litre' then case p_unit when 'litre' then 1 end
    when 'piece' then case p_unit when 'piece' then 1 when 'dozen' then 12 end
    when 'dozen' then case p_unit when 'dozen' then 1 end
  end)::numeric
$$;

-- Distance a delivery is charged on: rounded to whole km (min 1), so fees never reveal a farm's exact spot.
create or replace function public.billing_km(p_km double precision)
returns numeric
language sql immutable parallel safe
set search_path = ''
as $$
  select greatest(1, round(p_km::numeric))
$$;

-- Today's reference price for an item where the buyer is: the most specific area first
-- (district, then state, then all-India), then manual > live feed > sample, then the newest.
-- Live prices older than 30 days are ignored. Shop price falls back to mandi x category markup.
-- Area names compared loosely: case, outer spaces and a trailing "district" don't matter,
-- so an address saved as "Pune District" finds the mandi price filed under "Pune".
create or replace function public.area_key(p text)
returns text
language sql immutable
set search_path = ''
as $$
  select regexp_replace(lower(btrim(coalesce(p, ''))), '\s+(district|dist\.?)$', '')
$$;

create or replace function public.price_ref(p_item_id text, p_state text, p_district text)
returns table (mandi numeric, shop numeric, source text, price_date date, area text)
language sql stable
set search_path = ''
as $$
  with best as (
    select r.*,
      case when r.district <> '' then 2 when r.state <> '' then 1 else 0 end as specificity
    from public.reference_prices r
    where r.item_id = p_item_id
      and (r.state = '' or public.area_key(r.state) = public.area_key(p_state))
      and (r.district = '' or public.area_key(r.district) = public.area_key(p_district))
      and (r.source in ('sample', 'manual') or r.price_date >= current_date - 30)
    order by specificity desc,
      case r.source when 'manual' then 3 when 'agmarknet' then 2 else 1 end desc,
      r.price_date desc
    limit 1
  )
  select
    b.mandi_price,
    coalesce(b.shop_price, b.mandi_price * coalesce((s.shop_markup ->> i.category::text)::numeric, 2)),
    b.source,
    b.price_date,
    case b.specificity when 2 then b.district when 1 then b.state else 'India' end
  from best b
  join public.items i on i.id = p_item_id
  cross join public.engine_settings s
$$;

create or replace function public.area_rule_matches(
  r public.area_rules, p_item_id text, p_category public.produce_category, p_state text, p_district text, p_day date
)
returns boolean
language sql immutable
set search_path = ''
as $$
  select (r.state is null or lower(r.state) = lower(coalesce(p_state, '')))
     and (r.district is null or lower(r.district) = lower(coalesce(p_district, '')))
     and (r.item_id = p_item_id or (r.item_id is null and r.category = p_category))
     and p_day between r.starts_on and r.ends_on
$$;

-- Steps 2 + 3: listings that can serve this buyer, best first ---------------------------------
create or replace function public.match_listings(
  p_item_id text default null,
  p_quantity numeric default null,            -- in the item's base unit; null = just browsing
  p_lat double precision default null,
  p_lng double precision default null,
  p_buyer_type public.consumer_type default null,
  p_max_km numeric default null,              -- null = the default for the buyer type
  p_state text default null,
  p_district text default null,
  p_category public.produce_category default null,
  p_organic boolean default false,
  p_limit integer default 48,
  p_offset integer default 0,
  p_now timestamptz default now()
)
returns table (
  id uuid, farmer_id uuid, item_id text, category public.produce_category, name text, variety text,
  description text, unit public.unit, price_per_unit numeric, qty_available numeric, min_order_qty numeric,
  harvested_at timestamptz, is_organic boolean, images text[], district text, state text, created_at timestamptz,
  farmer_name text, farm_name text, farmer_avatar text, farmer_verified boolean,
  farmer_rating double precision, farmer_ratings_count integer, orders_completed integer, orders_on_time integer,
  distance_km numeric, travel_hours numeric, hours_used numeric, shelf_life_hours integer,
  price_base double precision, shop_price double precision, trip_cost numeric,
  part_price double precision, part_fresh double precision, part_near double precision,
  part_trust double precision, part_fill double precision, score double precision, total_count bigint
)
language sql stable
security definer
set search_path = ''
as $$
  with s as (
    select e.*,
      coalesce(p_max_km, case when p_buyer_type = 'industrial' then e.business_max_km else e.household_max_km end)::float8 as max_km,
      case when p_buyer_type = 'industrial' then e.w_business else e.w_household end as w,
      (p_now at time zone 'Asia/Kolkata')::date as day,
      (p_lat is not null and p_lng is not null) as located
    from public.engine_settings e
    limit 1
  ),
  cand as (
    select p.id, p.farmer_id, p.item_id, p.category, p.name, p.variety, p.description, p.unit, p.price_per_unit,
      p.qty_available, p.min_order_qty, p.harvested_at, p.is_organic, p.images, p.district, p.state, p.created_at,
      i.shelf_life_hours,
      (p.price_per_unit / uf.f)::float8 as price_base,
      (p.qty_available * uf.f)::float8 as avail_base,
      (p.min_order_qty * uf.f)::float8 as min_base,
      coalesce(p.delivery_radius_km, fd.delivery_radius_km, s.farmer_radius_km)::float8 as radius,
      fd.verified, fd.orders_completed, fd.orders_on_time,
      case when s.located and p.lat is not null and p.lng is not null then public.geo_km(p_lat, p_lng, p.lat, p.lng) end as dist
    from public.produce p
    join public.items i on i.id = p.item_id
    join public.farmer_details fd on fd.user_id = p.farmer_id
    cross join s
    cross join lateral (select public.unit_factor(p.unit, i.base_unit) as f) uf
    where p.status = 'active' and p.qty_available > 0 and uf.f is not null
      and (p_item_id is null or p.item_id = p_item_id)
      and (p_category is null or p.category = p_category)
      and (not coalesce(p_organic, false) or p.is_organic)
      -- coarse latitude box from the index; the exact distance rule follows
      and (not s.located or p.lat between p_lat - s.max_km / 111.0 and p_lat + s.max_km / 111.0)
  ),
  kept as (
    select c.*,
      case when c.dist is null then 0 else c.dist * s.road_factor / s.speed_kmph end::float8 as travel_h,
      (extract(epoch from (p_now - c.harvested_at)) / 3600.0)::float8 as since_h
    from cand c cross join s
    where (not s.require_verified or c.verified)
      and (not s.located or (c.dist is not null and c.dist <= s.max_km and c.dist <= c.radius))
      and (p_quantity is null or (p_quantity >= c.min_base and (p_buyer_type = 'industrial' or c.avail_base >= p_quantity)))
  ),
  fresh as (
    select k.*, (k.since_h + k.travel_h) as used_h
    from kept k cross join s
    where k.since_h + k.travel_h <= s.freshness_limit * k.shelf_life_hours
      and not exists (
        select 1 from public.area_rules r
        where r.action = 'hide' and public.area_rule_matches(r, k.item_id, k.category, p_state, p_district, s.day)
      )
  ),
  areas as (
    select distinct f.item_id, coalesce(p_state, f.state) as st, coalesce(p_district, f.district) as di from fresh f
  ),
  priced as (
    select a.item_id, a.st, a.di, pr.shop::float8 as shop
    from areas a
    left join lateral public.price_ref(a.item_id, a.st, a.di) pr on true
  ),
  parts as (
    select f.*, pr.shop as shop_price,
      case when pr.shop > 0 then least(1, greatest(0, 1.5 - f.price_base / pr.shop)) else 0.5 end as p_price,
      least(1, greatest(0, 1 - f.used_h / f.shelf_life_hours)) as p_fresh,
      case when f.dist is null then 0.5 else least(1, greatest(0, 1 - f.dist / s.max_km)) end as p_near,
      (f.orders_on_time + s.trust_prior_on_time)::float8 / (f.orders_completed + s.trust_prior_total)::float8 as p_trust,
      case when p_quantity is null then 1 else least(1, f.avail_base / p_quantity::float8) end as p_fill,
      (s.w ->> 'price')::float8 as w_price, (s.w ->> 'fresh')::float8 as w_fresh, (s.w ->> 'near')::float8 as w_near,
      (s.w ->> 'trust')::float8 as w_trust, (s.w ->> 'fill')::float8 as w_fill,
      s.road_factor, s.cost_per_road_km
    from fresh f
    cross join s
    left join priced pr on pr.item_id = f.item_id
      and pr.st is not distinct from coalesce(p_state, f.state)
      and pr.di is not distinct from coalesce(p_district, f.district)
  ),
  scored as (
    select p.*,
      round((p.w_price * p.p_price + p.w_fresh * p.p_fresh + p.w_near * p.p_near + p.w_trust * p.p_trust + p.w_fill * p.p_fill)::numeric, 9)::float8 as score,
      count(*) over () as total_count
    from parts p
  ),
  page as (
    select * from scored
    order by score desc, dist asc nulls last, price_base asc, id asc
    limit greatest(0, least(coalesce(p_limit, 48), 500)) offset greatest(0, coalesce(p_offset, 0))
  )
  select
    g.id, g.farmer_id, g.item_id, g.category, g.name, g.variety, g.description, g.unit, g.price_per_unit,
    g.qty_available, g.min_order_qty, g.harvested_at, g.is_organic, g.images, g.district, g.state, g.created_at,
    pr.full_name, fd.farm_name, pr.avatar_url, g.verified,
    r.avg_rating, coalesce(r.ratings_count, 0), g.orders_completed, g.orders_on_time,
    case when g.dist is null then null else public.billing_km(g.dist) end,
    round(g.travel_h::numeric, 1), round(g.used_h::numeric, 1), g.shelf_life_hours,
    g.price_base, g.shop_price,
    case when g.dist is null then null else round(2 * g.road_factor * public.billing_km(g.dist) * g.cost_per_road_km, 2) end,
    g.p_price, g.p_fresh, g.p_near, g.p_trust, g.p_fill, g.score, g.total_count
  from page g
  join public.profiles pr on pr.id = g.farmer_id
  left join public.farmer_details fd on fd.user_id = g.farmer_id
  left join public.farmer_ratings r on r.farmer_id = g.farmer_id
  order by g.score desc, g.dist asc nulls last, g.price_base asc, g.id asc
$$;

-- How many listings of the item each hard rule removed (the first rule each one breaks).
create or replace function public.match_hidden(
  p_item_id text,
  p_quantity numeric default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_buyer_type public.consumer_type default null,
  p_max_km numeric default null,
  p_state text default null,
  p_district text default null,
  p_now timestamptz default now()
)
returns table (reason text, listings bigint)
language sql stable
security definer
set search_path = ''
as $$
  with s as (
    select e.*,
      coalesce(p_max_km, case when p_buyer_type = 'industrial' then e.business_max_km else e.household_max_km end)::float8 as max_km,
      (p_now at time zone 'Asia/Kolkata')::date as day,
      (p_lat is not null and p_lng is not null) as located
    from public.engine_settings e limit 1
  ),
  c as (
    select p.item_id, p.category, i.shelf_life_hours, fd.verified,
      (p.qty_available * uf.f)::float8 as avail_base, (p.min_order_qty * uf.f)::float8 as min_base,
      coalesce(p.delivery_radius_km, fd.delivery_radius_km, s.farmer_radius_km)::float8 as radius,
      case when s.located and p.lat is not null and p.lng is not null then public.geo_km(p_lat, p_lng, p.lat, p.lng) end as dist,
      (extract(epoch from (p_now - p.harvested_at)) / 3600.0)::float8 as since_h
    from public.produce p
    join public.items i on i.id = p.item_id
    join public.farmer_details fd on fd.user_id = p.farmer_id
    cross join s
    cross join lateral (select public.unit_factor(p.unit, i.base_unit) as f) uf
    where p.item_id = p_item_id and p.status = 'active' and p.qty_available > 0 and uf.f is not null
  ),
  why as (
    select case
      when s.require_verified and not c.verified then 'unverified'
      when s.located and c.dist is null then 'no_location'
      when s.located and (c.dist > s.max_km or c.dist > c.radius) then 'too_far'
      when p_quantity is not null and p_quantity < c.min_base then 'below_min_order'
      when p_quantity is not null and p_buyer_type is distinct from 'industrial' and c.avail_base < p_quantity then 'not_enough_stock'
      when c.since_h + case when c.dist is null then 0 else c.dist * s.road_factor / s.speed_kmph end > s.freshness_limit * c.shelf_life_hours then 'not_fresh_on_arrival'
      when exists (select 1 from public.area_rules r where r.action = 'hide' and public.area_rule_matches(r, c.item_id, c.category, p_state, p_district, s.day)) then 'hidden_in_area'
    end as reason
    from c cross join s
  )
  select reason, count(*) from why where reason is not null group by reason order by count(*) desc, reason
$$;

-- Signals for the rate suggestion around a point (step 5 runs in the browser with these).
create or replace function public.rate_inputs(
  p_item_id text,
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric,
  p_state text default null,
  p_district text default null
)
returns table (
  mandi numeric, shop numeric, source text, price_date date, area text,
  demand_qty numeric, demand_requests integer, supply_qty numeric, demand_multiplier numeric
)
language sql stable
security definer
set search_path = ''
as $$
  with i as (select * from public.items where id = p_item_id),
  d as (
    select coalesce(sum(dr.quantity * public.unit_factor(dr.unit, i.base_unit)), 0) as qty, count(*)::int as n
    from public.demand_requests dr cross join i
    where dr.item_id = p_item_id and dr.status = 'open'
      and (dr.needed_by is null or dr.needed_by >= current_date)
      and public.unit_factor(dr.unit, i.base_unit) is not null
      and (p_lat is null or dr.lat is null or public.geo_km(p_lat, p_lng, dr.lat, dr.lng) <= p_radius_km)
  ),
  sup as (
    select coalesce(sum(p.qty_available * public.unit_factor(p.unit, i.base_unit)), 0) as qty
    from public.produce p cross join i
    where p.item_id = p_item_id and p.status = 'active'
      and (p_lat is null or p.lat is null or public.geo_km(p_lat, p_lng, p.lat, p.lng) <= p_radius_km)
  ),
  m as (
    select coalesce(exp(sum(ln(r.demand_multiplier))), 1) as mult
    from public.area_rules r cross join i
    where r.action = 'demand'
      and public.area_rule_matches(r, p_item_id, i.category, p_state, p_district, (now() at time zone 'Asia/Kolkata')::date)
  )
  select pr.mandi, pr.shop, pr.source, pr.price_date, pr.area, d.qty, d.n, sup.qty, m.mult
  from d cross join sup cross join m
  left join lateral public.price_ref(p_item_id, p_state, p_district) pr on true
$$;

-- Household batches ----------------------------------------------------------------------------

-- Recomputes a batch's load and savings ("room"); releases it once the room covers the trip, i.e.
-- once the households together save more against the shop than the trip costs. (The design's
-- break-even weight, trip / (shop - mandi), is the same test at the lowest fair price.)
create or replace function public.refresh_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.delivery_batches%rowtype;
  v_s public.engine_settings%rowtype;
  v_load numeric;
  v_room numeric;
begin
  select * into v_b from public.delivery_batches where id = p_batch_id for update;
  if not found or v_b.status <> 'open' then
    return;
  end if;
  select * into v_s from public.engine_settings limit 1;

  select
    coalesce(sum(oi.quantity * public.unit_factor(oi.unit, i.base_unit)), 0),
    -- Savings at the farmer's own price: (shop price - listed price) per base unit, never below 0.
    coalesce(sum(oi.quantity * public.unit_factor(oi.unit, i.base_unit)
      * case when pr.shop is null then v_b.trip_cost / v_s.fallback_break_even_kg
             else greatest(pr.shop - oi.unit_price / public.unit_factor(oi.unit, i.base_unit), 0) end), 0)
  into v_load, v_room
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  join public.produce p on p.id = oi.produce_id
  join public.items i on i.id = p.item_id
  left join lateral public.price_ref(p.item_id, o.delivery_state, o.delivery_district) pr on true
  where o.batch_id = p_batch_id and o.status = 'pooling';

  update public.delivery_batches set load_qty = round(v_load, 2), room = round(v_room, 2) where id = p_batch_id;

  if v_load = 0 then
    update public.delivery_batches set status = 'cancelled' where id = p_batch_id;
  elsif v_room >= v_b.trip_cost then
    perform public.release_batch(p_batch_id, false);
  end if;
end;
$$;

-- Hands a batch to the farmer as one trip and splits the trip cost by each order's share of the load.
create or replace function public.release_batch(p_batch_id uuid, p_below boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.delivery_batches%rowtype;
  v_order record;
  v_now timestamptz := now();
begin
  select * into v_b from public.delivery_batches where id = p_batch_id for update;
  if not found or v_b.status <> 'open' then
    return;
  end if;
  for v_order in
    select o.id, sum(oi.quantity * public.unit_factor(oi.unit, i.base_unit)) as load
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.produce p on p.id = oi.produce_id
    join public.items i on i.id = p.item_id
    where o.batch_id = p_batch_id and o.status = 'pooling'
    group by o.id
    order by o.id
  loop
    update public.orders
    set status = 'placed',
        delivery_fee = case when v_b.load_qty > 0 then round(v_b.trip_cost * v_order.load / v_b.load_qty, 2) else v_b.trip_cost end,
        status_history = status_history || jsonb_build_array(jsonb_build_object('status', 'placed', 'at', v_now, 'by', 'system')),
        updated_at = v_now
    where id = v_order.id;
  end loop;
  update public.delivery_batches
  set status = 'released', released_at = v_now, below_break_even = p_below
  where id = p_batch_id;
end;
$$;

-- Releases every batch whose collection window has closed; under-filled ones are flagged so the
-- farmer can decide. Safe to call any time (pg_cron runs it every 10 minutes when available).
create or replace function public.release_due_batches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_n integer := 0;
begin
  for v_id in
    select id from public.delivery_batches where status = 'open' and cutoff_at <= now() order by id for update skip locked
  loop
    perform public.refresh_batch(v_id);
    if (select status from public.delivery_batches where id = v_id) = 'open' then
      perform public.release_batch(v_id, true);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Checkout preview: delivery fee per farmer, and for households how far their batch is from paying for itself.
create or replace function public.quote_delivery(p_items jsonb, p_lat double precision, p_lng double precision, p_pincode text)
returns table (
  farmer_id uuid, distance_km numeric, trip_cost numeric, pooled boolean,
  batch_load numeric, batch_room numeric, my_load numeric, my_room numeric,
  fee_now numeric, ships_now boolean, cutoff_at timestamptz, problem text, problem_item text
)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_type public.consumer_type;
  v_max numeric;
  v_s public.engine_settings%rowtype;
  v_state text;
  v_district text;
  r record;
begin
  select * into v_s from public.engine_settings limit 1;
  select pr.consumer_type, bd.max_distance_km into v_type, v_max
  from public.profiles pr left join public.buyer_details bd on bd.user_id = pr.id where pr.id = v_uid;
  v_max := coalesce(v_max, case when v_type = 'industrial' then v_s.business_max_km else v_s.household_max_km end);
  select a.state, a.district into v_state, v_district from public.addresses a where a.user_id = v_uid and a.is_default;

  for r in
    with lines as (
      select (e ->> 'produce_id')::uuid as produce_id, sum((e ->> 'quantity')::numeric) as qty
      from jsonb_array_elements(p_items) e group by 1
    ),
    j as (
      select p.farmer_id, p.name, p.lat, p.lng, i.shelf_life_hours, p.item_id, p.category, p.harvested_at,
        coalesce(p.delivery_radius_km, fd.delivery_radius_km, v_s.farmer_radius_km) as radius,
        l.qty * public.unit_factor(p.unit, i.base_unit) as load,
        public.geo_km(p_lat, p_lng, p.lat, p.lng) as dist,
        case when pr.shop is null then null
             else greatest(pr.shop - p.price_per_unit / public.unit_factor(p.unit, i.base_unit), 0) end as gap
      from lines l
      join public.produce p on p.id = l.produce_id
      join public.items i on i.id = p.item_id
      join public.farmer_details fd on fd.user_id = p.farmer_id
      left join lateral public.price_ref(p.item_id, v_state, v_district) pr on true
    )
    select j.farmer_id,
      max(j.dist) as dist,
      sum(j.load) as load,
      sum(j.load * coalesce(j.gap, 0)) as room_known,
      sum(case when j.gap is null then j.load else 0 end) as load_unpriced,
      max(case
        when j.dist is null then 'no_location'
        when j.dist > v_max or j.dist > j.radius then 'too_far'
        when extract(epoch from (now() - j.harvested_at)) / 3600.0 + j.dist * v_s.road_factor / v_s.speed_kmph > v_s.freshness_limit * j.shelf_life_hours then 'not_fresh_on_arrival'
      end) as problem,
      max(case
        when j.dist is null or j.dist > v_max or j.dist > j.radius
          or extract(epoch from (now() - j.harvested_at)) / 3600.0 + j.dist * v_s.road_factor / v_s.speed_kmph > v_s.freshness_limit * j.shelf_life_hours
        then j.name end) as problem_item
    from j group by j.farmer_id
  loop
    farmer_id := r.farmer_id;
    distance_km := case when r.dist is null then null else public.billing_km(r.dist) end;
    trip_cost := case when r.dist is null then null else round(2 * v_s.road_factor * public.billing_km(r.dist) * v_s.cost_per_road_km, 2) end;
    problem := r.problem;
    problem_item := r.problem_item;
    my_load := round(r.load, 2);
    my_room := round(r.room_known + r.load_unpriced * coalesce(trip_cost / v_s.fallback_break_even_kg, 0), 2);
    pooled := v_type is distinct from 'industrial';
    batch_load := 0;
    batch_room := 0;
    cutoff_at := null;
    if pooled then
      select b.load_qty, b.room, b.cutoff_at into batch_load, batch_room, cutoff_at
      from public.delivery_batches b
      where b.farmer_id = r.farmer_id and b.pincode = p_pincode and b.status = 'open' and b.cutoff_at > now();
      batch_load := coalesce(batch_load, 0);
      batch_room := coalesce(batch_room, 0);
      -- No open batch yet: this order would open one, closing one window from now.
      cutoff_at := coalesce(cutoff_at, now() + make_interval(secs => (v_s.batch_window_hours * 3600)::double precision));
      ships_now := trip_cost is not null and batch_room + my_room >= trip_cost;
      fee_now := case when trip_cost is null then null else round(trip_cost * my_load / nullif(batch_load + my_load, 0), 2) end;
    else
      ships_now := true;
      fee_now := trip_cost;
    end if;
    return next;
  end loop;
end;
$$;

-- place_order, now with the delivery rules, the delivery fee and household batches -------------
-- p_items:    [{"produce_id": "...", "quantity": 4}, ...]   (quantity in the listing's unit)
-- p_delivery: {"name","phone","line1","line2","village_city","district","state","pincode","lat","lng","notes"}
-- Lock order everywhere: batch -> order -> produce, so concurrent calls cannot deadlock.
create or replace function public.place_order(p_items jsonb, p_delivery jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer public.profiles%rowtype;
  v_max_km numeric;
  v_s public.engine_settings%rowtype;
  v_checkout uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_lat double precision := nullif(p_delivery ->> 'lat', '')::double precision;
  v_lng double precision := nullif(p_delivery ->> 'lng', '')::double precision;
  v_pin text := trim(coalesce(p_delivery ->> 'pincode', ''));
  v_pooled boolean;
  v_farmer record;
  v_line record;
  v_prod public.produce%rowtype;
  v_item public.items%rowtype;
  v_batch public.delivery_batches%rowtype;
  v_order_id uuid;
  v_total numeric(14, 2);
  v_km double precision;
  v_bkm numeric;
  v_trip numeric;
  v_result jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_buyer from public.profiles where id = v_uid;
  if not found or v_buyer.role <> 'consumer' then
    raise exception 'only_buyers_can_order' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_cart' using errcode = '22023';
  end if;
  if coalesce(trim(p_delivery ->> 'name'), '') = ''
     or coalesce(trim(p_delivery ->> 'phone'), '') !~ '^[0-9+ -]{7,16}$'
     or coalesce(trim(p_delivery ->> 'line1'), '') = ''
     or coalesce(trim(p_delivery ->> 'village_city'), '') = ''
     or coalesce(trim(p_delivery ->> 'district'), '') = ''
     or coalesce(trim(p_delivery ->> 'state'), '') = ''
     or v_pin !~ '^[0-9]{6}$' then
    raise exception 'invalid_delivery' using errcode = '22023';
  end if;
  if v_lat is null or v_lng is null then
    raise exception 'location_required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    left join public.produce p on p.id = (e ->> 'produce_id')::uuid
    where p.id is null
  ) then
    raise exception 'unavailable' using errcode = 'P0001';
  end if;

  -- Batches whose window has closed are released first, so a new order never joins an expired one.
  perform public.release_due_batches();

  select * into v_s from public.engine_settings limit 1;
  select coalesce(bd.max_distance_km, case when v_buyer.consumer_type = 'industrial' then v_s.business_max_km else v_s.household_max_km end)
  into v_max_km from public.buyer_details bd where bd.user_id = v_uid;
  v_max_km := coalesce(v_max_km, v_s.household_max_km);
  v_pooled := v_buyer.consumer_type is distinct from 'industrial';

  -- Households: open (or join) one batch per farmer for this PIN code, locked in farmer order.
  if v_pooled then
    for v_farmer in
      select distinct p.farmer_id
      from public.produce p
      where p.id in (select (e ->> 'produce_id')::uuid from jsonb_array_elements(p_items) e)
      order by p.farmer_id
    loop
      insert into public.delivery_batches (farmer_id, pincode, cutoff_at)
      values (v_farmer.farmer_id, v_pin, v_now + make_interval(secs => (v_s.batch_window_hours * 3600)::double precision))
      on conflict (farmer_id, pincode) where status = 'open' do nothing;
      perform 1 from public.delivery_batches
      where farmer_id = v_farmer.farmer_id and pincode = v_pin and status = 'open'
      for update;
    end loop;
  end if;

  perform 1
  from public.produce
  where id in (select (e ->> 'produce_id')::uuid from jsonb_array_elements(p_items) e)
  order by id
  for update;

  for v_farmer in
    select p.farmer_id, pr.full_name as farmer_name, pr.phone as farmer_phone,
      min(p.lat) as lat, min(p.lng) as lng
    from public.produce p
    join public.profiles pr on pr.id = p.farmer_id
    where p.id in (select (e ->> 'produce_id')::uuid from jsonb_array_elements(p_items) e)
    group by p.farmer_id, pr.full_name, pr.phone
    order by p.farmer_id
  loop
    if v_farmer.lat is null or v_farmer.lng is null then
      raise exception 'out_of_range' using errcode = 'P0001';
    end if;
    v_km := public.geo_km(v_lat, v_lng, v_farmer.lat, v_farmer.lng);
    v_bkm := public.billing_km(v_km);
    v_trip := round(2 * v_s.road_factor * v_bkm * v_s.cost_per_road_km, 2);

    if v_pooled then
      select * into v_batch from public.delivery_batches
      where farmer_id = v_farmer.farmer_id and pincode = v_pin and status = 'open';
      if v_batch.drop_lat is null then
        update public.delivery_batches
        set drop_lat = v_lat, drop_lng = v_lng, distance_km = v_bkm, trip_cost = v_trip
        where id = v_batch.id
        returning * into v_batch;
      end if;
    end if;

    insert into public.orders (
      checkout_id, buyer_id, farmer_id, status,
      delivery_name, delivery_phone, delivery_line1, delivery_line2, delivery_village_city,
      delivery_district, delivery_state, delivery_pincode, delivery_lat, delivery_lng, delivery_notes,
      buyer_name, buyer_type, farmer_name, farmer_phone, status_history,
      batch_id, delivery_fee, distance_km
    )
    values (
      v_checkout, v_uid, v_farmer.farmer_id,
      case when v_pooled then 'pooling' else 'placed' end::public.order_status,
      left(trim(p_delivery ->> 'name'), 120),
      trim(p_delivery ->> 'phone'),
      left(trim(p_delivery ->> 'line1'), 200),
      nullif(left(trim(coalesce(p_delivery ->> 'line2', '')), 200), ''),
      left(trim(p_delivery ->> 'village_city'), 120),
      left(trim(p_delivery ->> 'district'), 120),
      left(trim(p_delivery ->> 'state'), 80),
      v_pin, v_lat, v_lng,
      nullif(left(trim(coalesce(p_delivery ->> 'notes', '')), 500), ''),
      coalesce(nullif(v_buyer.full_name, ''), left(trim(p_delivery ->> 'name'), 120)),
      v_buyer.consumer_type,
      v_farmer.farmer_name,
      v_farmer.farmer_phone,
      jsonb_build_array(jsonb_build_object('status', case when v_pooled then 'pooling' else 'placed' end, 'at', v_now, 'by', 'buyer')),
      case when v_pooled then v_batch.id end,
      case when v_pooled then 0 else v_trip end,
      case when v_pooled then v_batch.distance_km else v_bkm end
    )
    returning id into v_order_id;

    v_total := 0;
    for v_line in
      select (e ->> 'produce_id')::uuid as produce_id, sum((e ->> 'quantity')::numeric) as qty
      from jsonb_array_elements(p_items) e
      group by 1
      order by 1
    loop
      select * into v_prod from public.produce where id = v_line.produce_id;
      continue when v_prod.farmer_id <> v_farmer.farmer_id;
      select * into v_item from public.items where id = v_prod.item_id;

      if v_prod.status <> 'active' then
        raise exception 'unavailable' using errcode = 'P0001', detail = v_prod.name;
      end if;
      if v_line.qty is null or v_line.qty <= 0 then
        raise exception 'invalid_quantity' using errcode = '22023', detail = v_prod.name;
      end if;
      if v_line.qty < v_prod.min_order_qty then
        raise exception 'below_min_order' using errcode = 'P0001', detail = v_prod.name, hint = v_prod.min_order_qty::text;
      end if;
      if v_line.qty > v_prod.qty_available then
        raise exception 'insufficient_stock' using errcode = 'P0001', detail = v_prod.name, hint = v_prod.qty_available::text;
      end if;
      -- The same hard rules the market applies (step 2), so an order can't bypass them.
      if v_s.require_verified and not coalesce((select verified from public.farmer_details where user_id = v_prod.farmer_id), false) then
        raise exception 'unavailable' using errcode = 'P0001', detail = v_prod.name;
      end if;
      if v_km > v_max_km or v_km > coalesce(v_prod.delivery_radius_km,
           (select delivery_radius_km from public.farmer_details where user_id = v_prod.farmer_id), v_s.farmer_radius_km) then
        raise exception 'out_of_range' using errcode = 'P0001', detail = v_prod.name;
      end if;
      if extract(epoch from (v_now - v_prod.harvested_at)) / 3600.0 + v_km * v_s.road_factor / v_s.speed_kmph
           > v_s.freshness_limit * v_item.shelf_life_hours then
        raise exception 'not_fresh_on_arrival' using errcode = 'P0001', detail = v_prod.name;
      end if;
      if exists (
        select 1 from public.area_rules r
        where r.action = 'hide'
          and public.area_rule_matches(r, v_prod.item_id, v_prod.category, trim(p_delivery ->> 'state'), trim(p_delivery ->> 'district'), v_day)
      ) then
        raise exception 'hidden_in_area' using errcode = 'P0001', detail = v_prod.name;
      end if;

      insert into public.order_items (order_id, produce_id, name, unit, unit_price, quantity)
      values (v_order_id, v_prod.id, v_prod.name, v_prod.unit, v_prod.price_per_unit, v_line.qty);

      -- Step 4: check and subtract in one step, under the row lock taken above.
      update public.produce set qty_reserved = qty_reserved + v_line.qty where id = v_prod.id;

      insert into public.produce_log (produce_id, farmer_id, change_type, quantity, order_id)
      values (v_prod.id, v_prod.farmer_id, 'reserved', v_line.qty, v_order_id);

      v_total := v_total + round(v_line.qty * v_prod.price_per_unit, 2);
    end loop;

    update public.orders set total = v_total where id = v_order_id;

    if v_pooled then
      perform public.refresh_batch(v_batch.id);
      select * into v_batch from public.delivery_batches where id = v_batch.id;
    end if;

    v_result := v_result || jsonb_build_array(
      (select jsonb_build_object(
        'order_id', o.id, 'farmer_id', o.farmer_id, 'total', o.total, 'status', o.status,
        'delivery_fee', o.delivery_fee, 'distance_km', o.distance_km,
        'batch', case when v_pooled then jsonb_build_object(
          'id', v_batch.id, 'status', v_batch.status, 'load_qty', v_batch.load_qty, 'room', v_batch.room,
          'trip_cost', v_batch.trip_cost, 'cutoff_at', v_batch.cutoff_at) end)
       from public.orders o where o.id = v_order_id));
  end loop;

  return jsonb_build_object('checkout_id', v_checkout, 'orders', v_result);
end;
$$;

-- update_order_status, now with pooling, the promised delivery date and the farmer's record -----
--   farmer: placed -> accepted | rejected; accepted -> packed | out_for_delivery | cancelled;
--           packed -> out_for_delivery | cancelled; out_for_delivery -> delivered
--   buyer:  pooling | placed | accepted -> cancelled
-- Trust: every delivered order counts as completed, and as on time when it arrives by deliver_by;
-- a farmer cancelling after accepting counts as completed but not on time.
drop function if exists public.update_order_status(uuid, public.order_status);

create or replace function public.update_order_status(p_order_id uuid, p_status public.order_status, p_deliver_by timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_batch_id uuid;
  v_order public.orders%rowtype;
  v_actor text;
  v_ok boolean;
  v_item record;
  v_deliver_by timestamptz;
begin
  select batch_id into v_batch_id from public.orders where id = p_order_id;
  if v_batch_id is not null then
    perform 1 from public.delivery_batches where id = v_batch_id for update;
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if v_uid is not null and v_uid = v_order.farmer_id then
    v_actor := 'farmer';
  elsif v_uid is not null and v_uid = v_order.buyer_id then
    v_actor := 'buyer';
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  v_ok := case v_actor
    when 'farmer' then
      (v_order.status = 'placed' and p_status in ('accepted', 'rejected'))
      or (v_order.status = 'accepted' and p_status in ('packed', 'out_for_delivery', 'cancelled'))
      or (v_order.status = 'packed' and p_status in ('out_for_delivery', 'cancelled'))
      or (v_order.status = 'out_for_delivery' and p_status = 'delivered')
    else
      v_order.status in ('pooling', 'placed', 'accepted') and p_status = 'cancelled'
  end;
  if not v_ok then
    raise exception 'invalid_transition' using errcode = '22023', detail = v_order.status::text || ' -> ' || p_status::text;
  end if;

  perform 1 from public.produce
  where id in (select produce_id from public.order_items where order_id = p_order_id)
  order by id
  for update;

  if p_status = 'delivered' then
    for v_item in select * from public.order_items where order_id = p_order_id and produce_id is not null loop
      update public.produce
      set qty_reserved = greatest(qty_reserved - v_item.quantity, 0), qty_sold = qty_sold + v_item.quantity
      where id = v_item.produce_id;
      insert into public.produce_log (produce_id, farmer_id, change_type, quantity, order_id)
      values (v_item.produce_id, v_order.farmer_id, 'sold', v_item.quantity, p_order_id);
    end loop;
    update public.farmer_details
    set orders_completed = orders_completed + 1,
        orders_on_time = orders_on_time + case when v_order.deliver_by is null or now() <= v_order.deliver_by then 1 else 0 end
    where user_id = v_order.farmer_id;
  elsif p_status in ('rejected', 'cancelled') then
    for v_item in select * from public.order_items where order_id = p_order_id and produce_id is not null loop
      update public.produce set qty_reserved = greatest(qty_reserved - v_item.quantity, 0) where id = v_item.produce_id;
      insert into public.produce_log (produce_id, farmer_id, change_type, quantity, order_id)
      values (v_item.produce_id, v_order.farmer_id, 'released', v_item.quantity, p_order_id);
    end loop;
    if v_actor = 'farmer' and p_status = 'cancelled' then
      update public.farmer_details set orders_completed = orders_completed + 1 where user_id = v_order.farmer_id;
    end if;
  end if;

  if p_status = 'accepted' then
    v_deliver_by := coalesce(
      p_deliver_by,
      ((now() at time zone 'Asia/Kolkata')::date + 1 + time '20:00') at time zone 'Asia/Kolkata'
    );
    if v_deliver_by < now() then
      raise exception 'deliver_by_in_past' using errcode = '22023';
    end if;
  end if;

  update public.orders
  set status = p_status,
      status_history = status_history || jsonb_build_array(jsonb_build_object('status', p_status, 'at', now(), 'by', v_actor)),
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      deliver_by = coalesce(v_deliver_by, deliver_by),
      updated_at = now()
  where id = p_order_id;

  -- A household leaving a batch shrinks it; an empty batch closes.
  if v_order.status = 'pooling' and v_batch_id is not null then
    perform public.refresh_batch(v_batch_id);
  end if;

  return (select to_jsonb(o) from public.orders o where o.id = p_order_id);
end;
$$;

-- One action for a whole released trip: accept, reject, or move every order in it along together.
create or replace function public.update_batch_status(p_batch_id uuid, p_status public.order_status, p_deliver_by timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_n integer := 0;
begin
  if not exists (select 1 from public.delivery_batches where id = p_batch_id and farmer_id = v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  for v_order in
    select id, status from public.orders where batch_id = p_batch_id order by id
  loop
    if (v_order.status = 'placed' and p_status in ('accepted', 'rejected'))
       or (v_order.status = 'accepted' and p_status in ('packed', 'out_for_delivery', 'cancelled'))
       or (v_order.status = 'packed' and p_status in ('out_for_delivery', 'cancelled'))
       or (v_order.status = 'out_for_delivery' and p_status = 'delivered') then
      perform public.update_order_status(v_order.id, p_status, p_deliver_by);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- Listings: the item decides the category, the allowed units and the default name ---------------
create or replace function public.produce_item_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.items%rowtype;
begin
  select * into v_item from public.items where id = new.item_id;
  if not found or not v_item.active then
    raise exception 'unknown_item' using errcode = '22023';
  end if;
  if public.unit_factor(new.unit, v_item.base_unit) is null then
    raise exception 'unit_not_allowed' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.item_id is distinct from old.item_id and (old.qty_sold > 0 or old.qty_reserved > 0) then
    raise exception 'item_locked' using errcode = '22023';
  end if;
  new.category := v_item.category;
  if coalesce(trim(new.name), '') = '' then
    new.name := v_item.name_en;
  end if;
  if new.harvested_at > now() + interval '1 hour' then
    raise exception 'harvest_in_future' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger produce_item_check
  before insert or update of item_id, unit, harvested_at on public.produce
  for each row execute function public.produce_item_check();

create or replace function public.demand_item_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.item_id is not null then
    select category into new.category from public.items where id = new.item_id;
  end if;
  return new;
end;
$$;

create trigger demand_item_check
  before insert or update of item_id on public.demand_requests
  for each row execute function public.demand_item_check();

-- Release batches every 10 minutes where pg_cron is available (Supabase); harmless elsewhere.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('annsetu-release-batches', '*/10 * * * *', 'select public.release_due_batches()');
  end if;
exception when others then
  raise notice 'pg_cron not set up: %', sqlerrm;
end;
$$;

-- The farmer's demand panel: open buyer requests, the ones this farm can reach first.
-- A request is reachable when it is within the farm's delivery radius and the buyer's distance
-- limit; "ready" means the farmer already has a listing that could fill it and arrive fresh.
create or replace function public.demand_for_farmer(p_limit integer default 50)
returns table (
  id uuid, item_id text, category public.produce_category, item_name text, quantity numeric, unit public.unit,
  target_price numeric, needed_by date, notes text, district text, state text, created_at timestamptz,
  buyer_type public.consumer_type, buyer_label text, distance_km numeric, can_reach boolean,
  listing_id uuid, listing_available numeric, listing_unit public.unit, ready boolean
)
language sql stable
security definer
set search_path = ''
as $$
  with s as (select * from public.engine_settings limit 1),
  me as (
    select a.lat, a.lng, coalesce(fd.delivery_radius_km, s.farmer_radius_km)::float8 as radius
    from public.addresses a
    join public.farmer_details fd on fd.user_id = a.user_id
    cross join s
    where a.user_id = auth.uid() and a.is_default
  ),
  reqs as (
    select d.*, pr.consumer_type,
      case
        when pr.consumer_type = 'industrial' then coalesce(nullif(trim(bd.business_name), ''), split_part(pr.full_name, ' ', 1))
        else split_part(pr.full_name, ' ', 1)
      end as label,
      coalesce(bd.max_distance_km, case when pr.consumer_type = 'industrial' then s.business_max_km else s.household_max_km end)::float8 as buyer_max,
      case when me.lat is not null and d.lat is not null then public.geo_km(me.lat, me.lng, d.lat, d.lng) end as dist,
      me.radius
    from public.demand_requests d
    join public.profiles pr on pr.id = d.buyer_id
    left join public.buyer_details bd on bd.user_id = d.buyer_id
    cross join s
    left join me on true
    where d.status = 'open' and (d.needed_by is null or d.needed_by >= current_date)
  )
  select
    r.id, r.item_id, r.category, r.item_name, r.quantity, r.unit, r.target_price, r.needed_by, r.notes,
    r.district, r.state, r.created_at, r.consumer_type, r.label,
    case when r.dist is null then null else public.billing_km(r.dist) end,
    coalesce(r.dist <= r.radius and r.dist <= r.buyer_max, false),
    l.id, l.qty_available, l.unit,
    coalesce(l.id is not null and r.dist <= r.radius and r.dist <= r.buyer_max, false)
  from reqs r
  cross join s
  left join lateral (
    select p.id, p.qty_available, p.unit
    from public.produce p
    join public.items i on i.id = p.item_id
    where p.farmer_id = auth.uid() and p.status = 'active' and r.item_id is not null and p.item_id = r.item_id
      and p.qty_available * public.unit_factor(p.unit, i.base_unit) >= r.quantity * coalesce(public.unit_factor(r.unit, i.base_unit), 0)
      and extract(epoch from (now() - p.harvested_at)) / 3600.0 + coalesce(r.dist, 0) * s.road_factor / s.speed_kmph <= s.freshness_limit * i.shelf_life_hours
    order by p.qty_available desc
    limit 1
  ) l on true
  order by 16 desc, 20 desc, r.dist asc nulls last, r.needed_by asc nulls last, r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
$$;
