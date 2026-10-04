-- Matching engine, part 3: who may read and call what. Same approach as before: start from
-- nothing, then grant exactly what the app uses.

alter table public.items enable row level security;
alter table public.item_names enable row level security;
alter table public.engine_settings enable row level security;
alter table public.area_rules enable row level security;
alter table public.reference_prices enable row level security;
alter table public.delivery_batches enable row level security;

-- Catalogue, settings, area rules and reference prices are public facts. Changes come from the
-- dashboard / service role (the price feed), never from the browser.
create policy "items: public read" on public.items for select to anon, authenticated using (true);
create policy "item_names: public read" on public.item_names for select to anon, authenticated using (true);
create policy "engine_settings: public read" on public.engine_settings for select to anon, authenticated using (true);
create policy "area_rules: public read" on public.area_rules for select to anon, authenticated using (true);
create policy "reference_prices: public read" on public.reference_prices for select to anon, authenticated using (true);

-- A batch is visible to its farmer and to the buyers with an order in it.
create policy "delivery_batches: parties read" on public.delivery_batches
  for select to authenticated
  using (
    farmer_id = (select auth.uid())
    or exists (select 1 from public.orders o where o.batch_id = delivery_batches.id and o.buyer_id = (select auth.uid()))
  );

revoke all on public.items, public.item_names, public.engine_settings, public.area_rules, public.reference_prices, public.delivery_batches
  from anon, authenticated;
grant select on public.items, public.item_names, public.engine_settings, public.area_rules, public.reference_prices to anon, authenticated;
grant select on public.delivery_batches to authenticated;
-- Only the daily price job (service role, never the browser) writes prices.
grant select, insert, update on public.reference_prices to service_role;

-- New columns the browser may write.
grant insert (item_id, harvested_at, delivery_radius_km), update (item_id, harvested_at, delivery_radius_km) on public.produce to authenticated;
grant insert (delivery_radius_km), update (delivery_radius_km) on public.farmer_details to authenticated;
grant insert (max_distance_km), update (max_distance_km) on public.buyer_details to authenticated;
grant insert (item_id), update (item_id) on public.demand_requests to authenticated;

-- Functions: revoke everything (new functions get default execute), then grant the entry points.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
grant execute on function public.adjust_stock(uuid, public.ledger_type, numeric, text) to authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, timestamptz) to authenticated;
grant execute on function public.update_batch_status(uuid, public.order_status, timestamptz) to authenticated;
grant execute on function public.quote_delivery(jsonb, double precision, double precision, text) to authenticated;
grant execute on function public.match_listings(text, numeric, double precision, double precision, public.consumer_type, numeric, text, text, public.produce_category, boolean, integer, integer, timestamptz) to anon, authenticated;
grant execute on function public.match_hidden(text, numeric, double precision, double precision, public.consumer_type, numeric, text, text, timestamptz) to anon, authenticated;
grant execute on function public.rate_inputs(text, double precision, double precision, numeric, text, text) to anon, authenticated;
grant execute on function public.release_due_batches() to anon, authenticated;
grant execute on function public.demand_for_farmer(integer) to authenticated;
