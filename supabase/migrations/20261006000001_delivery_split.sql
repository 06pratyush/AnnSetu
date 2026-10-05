-- Shared household trips: who pays what.
-- Before: the trip cost was split by weight. In a trip mixing items, a household whose own saving
-- against the shop was small could then pay more than the shop, delivery included, even when the
-- trip as a whole paid for itself (found by proofs/delivery.proof.ts).
-- Now: when the households' savings cover the trip, it is split in proportion to each household's
-- saving, in whole paise that add up to the trip cost exactly; when they don't (released at the
-- cut-off), each household pays its saving and no more. Either way no household pays more than
-- the shop for the same goods, delivery included, and the farmer sees the total before accepting.
-- Safe to run on a database set up from an earlier setup.sql.

-- Each pooling order's load (base units) and saving against the shop, in whole paise, rounded down.
-- Items with no known shop price count trip_cost / fallback_break_even_kg per unit, as before.
create or replace function public.batch_savings(p_batch_id uuid)
returns table (order_id uuid, load numeric, saving_paise bigint)
language sql
stable
set search_path = ''
as $$
  select o.id,
    sum(oi.quantity * public.unit_factor(oi.unit, i.base_unit)),
    floor(100 * sum(oi.quantity * public.unit_factor(oi.unit, i.base_unit)
      * case when pr.shop is null then b.trip_cost / s.fallback_break_even_kg
             else greatest(pr.shop - oi.unit_price / public.unit_factor(oi.unit, i.base_unit), 0) end))::bigint
  from public.orders o
  join public.delivery_batches b on b.id = o.batch_id
  join public.order_items oi on oi.order_id = o.id
  join public.produce p on p.id = oi.produce_id
  join public.items i on i.id = p.item_id
  cross join (select fallback_break_even_kg from public.engine_settings limit 1) s
  left join lateral public.price_ref(p.item_id, o.delivery_state, o.delivery_district) pr on true
  where o.batch_id = p_batch_id and o.status = 'pooling'
  group by o.id
$$;

-- Keeps a batch's load and savings current; releases it once the savings cover the trip.
create or replace function public.refresh_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.delivery_batches%rowtype;
  v_load numeric;
  v_saving bigint;
begin
  select * into v_b from public.delivery_batches where id = p_batch_id for update;
  if not found or v_b.status <> 'open' then
    return;
  end if;
  select coalesce(sum(load), 0), coalesce(sum(saving_paise), 0) into v_load, v_saving from public.batch_savings(p_batch_id);
  update public.delivery_batches set load_qty = round(v_load, 2), room = v_saving / 100.0 where id = p_batch_id;
  if v_load = 0 then
    update public.delivery_batches set status = 'cancelled' where id = p_batch_id;
  elsif v_saving >= round(v_b.trip_cost * 100) then
    perform public.release_batch(p_batch_id, false);
  end if;
end;
$$;

-- Hands a batch to the farmer as one trip. Fees in paise:
--   savings S ≥ trip T: fee_i = T·s_i / S rounded down, and the paise left over go one each to the
--                       largest remainders (ties by order id), so the fees add up to T exactly;
--   savings S < T:      fee_i = s_i, and the batch is flagged below break-even for the farmer.
create or replace function public.release_batch(p_batch_id uuid, p_below boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.delivery_batches%rowtype;
  v_trip bigint;
  v_total bigint;
  v_order record;
  v_now timestamptz := now();
begin
  select * into v_b from public.delivery_batches where id = p_batch_id for update;
  if not found or v_b.status <> 'open' then
    return;
  end if;
  v_trip := round(v_b.trip_cost * 100);
  select coalesce(sum(saving_paise), 0) into v_total from public.batch_savings(p_batch_id);

  for v_order in
    with s as (
      select * from public.batch_savings(p_batch_id)
    ),
    shares as (
      select s.order_id,
        case when v_total >= v_trip and v_total > 0 then (v_trip * s.saving_paise) / v_total else s.saving_paise end as base,
        case when v_total >= v_trip and v_total > 0 then (v_trip * s.saving_paise) % v_total else 0 end as remainder
      from s
    ),
    ranked as (
      select shares.*,
        row_number() over (order by remainder desc, order_id) as place,
        case when v_total >= v_trip and v_total > 0 then v_trip - sum(base) over () else 0 end as leftover
      from shares
    )
    select order_id, base + case when place <= leftover then 1 else 0 end as fee_paise
    from ranked
    order by order_id
  loop
    update public.orders
    set status = 'placed',
        delivery_fee = v_order.fee_paise / 100.0,
        status_history = status_history || jsonb_build_array(jsonb_build_object('status', 'placed', 'at', v_now, 'by', 'system')),
        updated_at = v_now
    where id = v_order.order_id;
  end loop;

  update public.delivery_batches
  set status = 'released', released_at = v_now, below_break_even = v_total < v_trip, room = v_total / 100.0
  where id = p_batch_id;
end;
$$;

-- Checkout preview. For households, fee_max is the most this order can ever pay for delivery (its
-- saving against the shop); fee_now is its share if the trip shipped with this order, else null.
drop function if exists public.quote_delivery(jsonb, double precision, double precision, text);

create function public.quote_delivery(p_items jsonb, p_lat double precision, p_lng double precision, p_pincode text)
returns table (
  farmer_id uuid, distance_km numeric, trip_cost numeric, pooled boolean,
  batch_load numeric, batch_room numeric, my_load numeric, my_room numeric,
  fee_now numeric, fee_max numeric, ships_now boolean, cutoff_at timestamptz, problem text, problem_item text
)
language plpgsql
stable
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
    -- Same measure as batch_savings: whole paise, rounded down.
    my_room := floor(100 * (r.room_known + r.load_unpriced * coalesce(trip_cost / v_s.fallback_break_even_kg, 0))) / 100;
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
      fee_max := case when trip_cost is null then null else least(my_room, trip_cost) end;
      fee_now := case when ships_now and batch_room + my_room > 0 then round(trip_cost * my_room / (batch_room + my_room), 2) end;
    else
      ships_now := true;
      fee_now := trip_cost;
      fee_max := trip_cost;
    end if;
    return next;
  end loop;
end;
$$;

revoke execute on function public.quote_delivery(jsonb, double precision, double precision, text) from public, anon;
grant execute on function public.quote_delivery(jsonb, double precision, double precision, text) to authenticated;
revoke execute on function public.batch_savings(uuid) from public, anon, authenticated;
