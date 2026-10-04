-- Triggers and the three trusted operations (place_order, update_order_status, adjust_stock).
-- SECURITY DEFINER functions use an empty search_path and fully qualified names.

-- updated_at bookkeeping ------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger farmer_details_touch before update on public.farmer_details for each row execute function public.touch_updated_at();
create trigger buyer_details_touch before update on public.buyer_details for each row execute function public.touch_updated_at();
create trigger demand_touch before update on public.demand_requests for each row execute function public.touch_updated_at();

-- New auth user -> profile -------------------------------------------------------------------
-- The role comes from sign-up metadata and can never change afterwards (no column grant on role).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role;
  v_ctype public.consumer_type;
begin
  v_role := case when v_meta ->> 'role' = 'farmer' then 'farmer' else 'consumer' end::public.user_role;
  if v_role = 'consumer' then
    v_ctype := case when v_meta ->> 'consumer_type' = 'industrial' then 'industrial' else 'individual' end::public.consumer_type;
  end if;

  insert into public.profiles (id, role, consumer_type, full_name, preferred_lang)
  values (
    new.id,
    v_role,
    v_ctype,
    left(coalesce(trim(v_meta ->> 'full_name'), ''), 120),
    case when v_meta ->> 'preferred_lang' = 'hi' then 'hi' else 'en' end
  );

  if v_role = 'farmer' then
    insert into public.farmer_details (user_id) values (new.id);
  else
    insert into public.buyer_details (user_id) values (new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Addresses: a new default address replaces the previous default ------------------------------
create or replace function public.addresses_single_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses set is_default = false
    where user_id = new.user_id and is_default and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row when (new.is_default)
  execute function public.addresses_single_default();

-- Produce ------------------------------------------------------------------------------------
create or replace function public.produce_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_addr public.addresses%rowtype;
begin
  if not exists (select 1 from public.profiles where id = new.farmer_id and role = 'farmer') then
    raise exception 'only_farmers_can_list' using errcode = '42501';
  end if;
  if new.qty_listed <= 0 then
    raise exception 'quantity_required' using errcode = '22023';
  end if;
  if new.min_order_qty > new.qty_listed then
    raise exception 'min_order_too_big' using errcode = '22023';
  end if;
  if new.status not in ('active', 'paused') then
    new.status := 'active';
  end if;
  new.qty_sold := 0;
  new.qty_reserved := 0;
  new.qty_spoiled := 0;

  select * into v_addr from public.addresses where user_id = new.farmer_id and is_default limit 1;
  if found then
    new.district := coalesce(new.district, v_addr.district);
    new.state := coalesce(new.state, v_addr.state);
    new.lat := coalesce(new.lat, v_addr.lat);
    new.lng := coalesce(new.lng, v_addr.lng);
  end if;
  return new;
end;
$$;

create trigger produce_before_insert
  before insert on public.produce
  for each row execute function public.produce_before_insert();

create or replace function public.produce_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.produce_log (produce_id, farmer_id, change_type, quantity)
  values (new.id, new.farmer_id, 'listed', new.qty_listed);
  return new;
end;
$$;

create trigger produce_after_insert
  after insert on public.produce
  for each row execute function public.produce_after_insert();

-- Keeps status honest: nothing left -> sold_out; stock back -> active again.
create or replace function public.produce_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_available numeric := new.qty_listed - new.qty_sold - new.qty_reserved - new.qty_spoiled;
begin
  if new.unit is distinct from old.unit and (old.qty_sold > 0 or old.qty_reserved > 0) then
    raise exception 'unit_locked' using errcode = '22023';
  end if;
  if new.min_order_qty > greatest(new.qty_listed, 0) then
    raise exception 'min_order_too_big' using errcode = '22023';
  end if;
  if new.status = 'active' and v_available <= 0 then
    new.status := 'sold_out';
  elsif new.status = 'sold_out' and v_available > 0 and old.status = 'sold_out' then
    new.status := 'active';
  elsif new.status = 'sold_out' and old.status <> 'sold_out' and v_available > 0 then
    new.status := old.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger produce_before_update
  before update on public.produce
  for each row execute function public.produce_before_update();

-- Demand: default the location to the buyer's saved address ----------------------------------
create or replace function public.demand_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_addr public.addresses%rowtype;
begin
  if not exists (select 1 from public.profiles where id = new.buyer_id and role = 'consumer') then
    raise exception 'only_buyers_can_post' using errcode = '42501';
  end if;
  new.status := 'open';
  if new.district is null or new.state is null then
    select * into v_addr from public.addresses where user_id = new.buyer_id and is_default limit 1;
    if found then
      new.district := coalesce(new.district, v_addr.district);
      new.state := coalesce(new.state, v_addr.state);
      new.lat := coalesce(new.lat, v_addr.lat);
      new.lng := coalesce(new.lng, v_addr.lng);
    end if;
  end if;
  return new;
end;
$$;

create trigger demand_before_insert
  before insert on public.demand_requests
  for each row execute function public.demand_before_insert();

-- Reviews: only the buyer of a delivered order, once ------------------------------------------
create or replace function public.reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = new.order_id;
  if not found or v_order.buyer_id is distinct from auth.uid() or v_order.status <> 'delivered' then
    raise exception 'cannot_review' using errcode = '42501';
  end if;
  new.buyer_id := v_order.buyer_id;
  new.farmer_id := v_order.farmer_id;
  new.reviewer_name := split_part(coalesce(v_order.buyer_name, ''), ' ', 1);
  return new;
end;
$$;

create trigger reviews_before_insert
  before insert on public.reviews
  for each row execute function public.reviews_before_insert();

-- place_order: the whole cart in one transaction ----------------------------------------------
-- p_items:    [{"produce_id": "...", "quantity": 4}, ...]
-- p_delivery: {"name","phone","line1","line2","village_city","district","state","pincode","lat","lng","notes"}
-- Rows are locked in id order, so two buyers racing for the last kilo cannot both get it.
create or replace function public.place_order(p_items jsonb, p_delivery jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer public.profiles%rowtype;
  v_checkout uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_farmer record;
  v_line record;
  v_prod public.produce%rowtype;
  v_order_id uuid;
  v_total numeric(14, 2);
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
     or coalesce(trim(p_delivery ->> 'pincode'), '') !~ '^[0-9]{6}$' then
    raise exception 'invalid_delivery' using errcode = '22023';
  end if;

  -- Every item must point at a real listing.
  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    left join public.produce p on p.id = (e ->> 'produce_id')::uuid
    where p.id is null
  ) then
    raise exception 'unavailable' using errcode = 'P0001';
  end if;

  perform 1
  from public.produce
  where id in (select (e ->> 'produce_id')::uuid from jsonb_array_elements(p_items) e)
  order by id
  for update;

  for v_farmer in
    select p.farmer_id, pr.full_name as farmer_name, pr.phone as farmer_phone
    from public.produce p
    join public.profiles pr on pr.id = p.farmer_id
    where p.id in (select (e ->> 'produce_id')::uuid from jsonb_array_elements(p_items) e)
    group by p.farmer_id, pr.full_name, pr.phone
    order by p.farmer_id
  loop
    insert into public.orders (
      checkout_id, buyer_id, farmer_id,
      delivery_name, delivery_phone, delivery_line1, delivery_line2, delivery_village_city,
      delivery_district, delivery_state, delivery_pincode, delivery_lat, delivery_lng, delivery_notes,
      buyer_name, buyer_type, farmer_name, farmer_phone, status_history
    )
    values (
      v_checkout, v_uid, v_farmer.farmer_id,
      left(trim(p_delivery ->> 'name'), 120),
      trim(p_delivery ->> 'phone'),
      left(trim(p_delivery ->> 'line1'), 200),
      nullif(left(trim(coalesce(p_delivery ->> 'line2', '')), 200), ''),
      left(trim(p_delivery ->> 'village_city'), 120),
      left(trim(p_delivery ->> 'district'), 120),
      left(trim(p_delivery ->> 'state'), 80),
      trim(p_delivery ->> 'pincode'),
      nullif(p_delivery ->> 'lat', '')::double precision,
      nullif(p_delivery ->> 'lng', '')::double precision,
      nullif(left(trim(coalesce(p_delivery ->> 'notes', '')), 500), ''),
      coalesce(nullif(v_buyer.full_name, ''), left(trim(p_delivery ->> 'name'), 120)),
      v_buyer.consumer_type,
      v_farmer.farmer_name,
      v_farmer.farmer_phone,
      jsonb_build_array(jsonb_build_object('status', 'placed', 'at', v_now, 'by', 'buyer'))
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

      insert into public.order_items (order_id, produce_id, name, unit, unit_price, quantity)
      values (v_order_id, v_prod.id, v_prod.name, v_prod.unit, v_prod.price_per_unit, v_line.qty);

      update public.produce set qty_reserved = qty_reserved + v_line.qty where id = v_prod.id;

      insert into public.produce_log (produce_id, farmer_id, change_type, quantity, order_id)
      values (v_prod.id, v_prod.farmer_id, 'reserved', v_line.qty, v_order_id);

      v_total := v_total + round(v_line.qty * v_prod.price_per_unit, 2);
    end loop;

    update public.orders set total = v_total where id = v_order_id;
    v_result := v_result || jsonb_build_array(jsonb_build_object('order_id', v_order_id, 'farmer_id', v_farmer.farmer_id, 'total', v_total));
  end loop;

  return jsonb_build_object('checkout_id', v_checkout, 'orders', v_result);
end;
$$;

-- update_order_status: allowed moves per side, with the stock bookkeeping ----------------------
--   farmer: placed -> accepted | rejected; accepted -> packed | out_for_delivery | cancelled;
--           packed -> out_for_delivery | cancelled; out_for_delivery -> delivered
--   buyer:  placed | accepted -> cancelled
-- delivered moves reserved -> sold; rejected/cancelled releases the reservation.
create or replace function public.update_order_status(p_order_id uuid, p_status public.order_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_actor text;
  v_ok boolean;
  v_item record;
begin
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
      v_order.status in ('placed', 'accepted') and p_status = 'cancelled'
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
      set qty_reserved = greatest(qty_reserved - v_item.quantity, 0),
          qty_sold = qty_sold + v_item.quantity
      where id = v_item.produce_id;
      insert into public.produce_log (produce_id, farmer_id, change_type, quantity, order_id)
      values (v_item.produce_id, v_order.farmer_id, 'sold', v_item.quantity, p_order_id);
    end loop;
  elsif p_status in ('rejected', 'cancelled') then
    for v_item in select * from public.order_items where order_id = p_order_id and produce_id is not null loop
      update public.produce
      set qty_reserved = greatest(qty_reserved - v_item.quantity, 0)
      where id = v_item.produce_id;
      insert into public.produce_log (produce_id, farmer_id, change_type, quantity, order_id)
      values (v_item.produce_id, v_order.farmer_id, 'released', v_item.quantity, p_order_id);
    end loop;
  end if;

  update public.orders
  set status = p_status,
      status_history = status_history || jsonb_build_array(jsonb_build_object('status', p_status, 'at', now(), 'by', v_actor)),
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      updated_at = now()
  where id = p_order_id;

  return (select to_jsonb(o) from public.orders o where o.id = p_order_id);
end;
$$;

-- adjust_stock: restock (+), spoiled (moves unsold to spoiled), adjusted (signed correction) ----
create or replace function public.adjust_stock(p_produce_id uuid, p_type public.ledger_type, p_qty numeric, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prod public.produce%rowtype;
begin
  if p_type not in ('restocked', 'spoiled', 'adjusted') then
    raise exception 'invalid_type' using errcode = '22023';
  end if;
  select * into v_prod from public.produce where id = p_produce_id for update;
  if not found or v_prod.farmer_id is distinct from auth.uid() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_prod.status = 'archived' then
    raise exception 'archived_listing' using errcode = '22023';
  end if;
  if p_qty is null or p_qty = 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  if p_type = 'restocked' then
    if p_qty < 0 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;
    update public.produce set qty_listed = qty_listed + p_qty where id = p_produce_id;
  elsif p_type = 'spoiled' then
    if p_qty < 0 or p_qty > v_prod.qty_available then
      raise exception 'exceeds_available' using errcode = 'P0001', hint = v_prod.qty_available::text;
    end if;
    update public.produce set qty_spoiled = qty_spoiled + p_qty where id = p_produce_id;
  else
    if v_prod.qty_available + p_qty < 0 then
      raise exception 'exceeds_available' using errcode = 'P0001', hint = v_prod.qty_available::text;
    end if;
    update public.produce set qty_listed = qty_listed + p_qty where id = p_produce_id;
  end if;

  insert into public.produce_log (produce_id, farmer_id, change_type, quantity, note)
  values (p_produce_id, v_prod.farmer_id, p_type, p_qty, nullif(left(trim(coalesce(p_note, '')), 300), ''));

  return (select to_jsonb(p) from public.produce p where p.id = p_produce_id);
end;
$$;
