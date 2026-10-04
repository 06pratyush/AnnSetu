-- Row-level security and privileges. The browser holds only the public anon key, so these
-- policies, column grants and the SECURITY DEFINER functions are the whole security boundary.

alter table public.profiles enable row level security;
alter table public.farmer_details enable row level security;
alter table public.buyer_details enable row level security;
alter table public.addresses enable row level security;
alter table public.produce enable row level security;
alter table public.produce_log enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.demand_requests enable row level security;
alter table public.reviews enable row level security;

-- Profiles and details: each user sees and edits only their own rows.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "farmer_details: own" on public.farmer_details
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "buyer_details: own" on public.buyer_details
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "addresses: own" on public.addresses
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Produce: listings on the market are public; farmers manage their own.
create policy "produce: read market or own" on public.produce
  for select to anon, authenticated
  using (status in ('active', 'sold_out') or farmer_id = (select auth.uid()));
create policy "produce: farmers insert own" on public.produce
  for insert to authenticated
  with check (farmer_id = (select auth.uid()));
create policy "produce: farmers update own" on public.produce
  for update to authenticated
  using (farmer_id = (select auth.uid())) with check (farmer_id = (select auth.uid()));

create policy "produce_log: farmers read own" on public.produce_log
  for select to authenticated using (farmer_id = (select auth.uid()));

-- Orders: visible to the two parties; written only through place_order / update_order_status.
create policy "orders: parties read" on public.orders
  for select to authenticated
  using (buyer_id = (select auth.uid()) or farmer_id = (select auth.uid()));
create policy "order_items: parties read" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.buyer_id = (select auth.uid()) or o.farmer_id = (select auth.uid()))
  ));

-- Demand: buyers manage their own; everyone signed in reads open requests via public.open_demand.
create policy "demand: buyers read own" on public.demand_requests
  for select to authenticated using (buyer_id = (select auth.uid()));
create policy "demand: buyers insert own" on public.demand_requests
  for insert to authenticated with check (buyer_id = (select auth.uid()));
create policy "demand: buyers update own" on public.demand_requests
  for update to authenticated using (buyer_id = (select auth.uid())) with check (buyer_id = (select auth.uid()));
create policy "demand: buyers delete own" on public.demand_requests
  for delete to authenticated using (buyer_id = (select auth.uid()));

-- Reviews are public; the insert trigger checks the order was delivered to this buyer.
create policy "reviews: public read" on public.reviews
  for select to anon, authenticated using (true);
create policy "reviews: buyers insert own" on public.reviews
  for insert to authenticated with check (buyer_id = (select auth.uid()));

-- Privileges: start from nothing, then grant exactly what the app uses.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, preferred_lang, onboarded) on public.profiles to authenticated;

grant select on public.farmer_details, public.buyer_details to authenticated;
grant insert (user_id, farm_name, farm_size_acres, main_crops), update (farm_name, farm_size_acres, main_crops)
  on public.farmer_details to authenticated;
grant insert (user_id, business_name, business_type, gstin), update (business_name, business_type, gstin)
  on public.buyer_details to authenticated;

grant select, delete on public.addresses to authenticated;
grant insert (label, line1, line2, village_city, district, state, pincode, lat, lng, is_default),
      update (label, line1, line2, village_city, district, state, pincode, lat, lng, is_default)
  on public.addresses to authenticated;

grant select on public.produce to anon, authenticated;
grant insert (category, name, variety, description, unit, price_per_unit, qty_listed, min_order_qty,
              harvest_date, best_before, is_organic, images, status)
  on public.produce to authenticated;
grant update (category, name, variety, description, unit, price_per_unit, min_order_qty,
              harvest_date, best_before, is_organic, images, status)
  on public.produce to authenticated;

grant select on public.produce_log to authenticated;
grant select on public.orders, public.order_items to authenticated;

grant select, delete on public.demand_requests to authenticated;
grant insert (category, item_name, quantity, unit, target_price, needed_by, notes, district, state, lat, lng)
  on public.demand_requests to authenticated;
grant update (category, item_name, quantity, unit, target_price, needed_by, notes, status)
  on public.demand_requests to authenticated;

grant select on public.reviews to anon, authenticated;
grant insert (order_id, rating, comment) on public.reviews to authenticated;

grant select on public.market_listings, public.farmer_public, public.farmer_ratings to anon, authenticated;
grant select on public.open_demand to authenticated;

-- Functions: RPCs for signed-in users only; trigger functions are not callable at all.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.adjust_stock(uuid, public.ledger_type, numeric, text) to authenticated;
