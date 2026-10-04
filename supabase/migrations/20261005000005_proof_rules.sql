-- Rules the proofs in proofs/ (npm run prove) showed the engine relies on.
-- Safe on a database set up from an earlier setup.sql: each check is added only once.

do $$
begin
  -- R10: with farmer_share + nudge_cap > 1 and a big-lot cut, a higher mandi price could lower the suggested rate.
  alter table public.engine_settings add constraint engine_settings_share_plus_nudge check (farmer_share + nudge_cap <= 1);
exception when duplicate_object then null;
end $$;

do $$
begin
  -- M3: each weight set has all five parts, none negative, adding up to 1, so scores stay within 0-100.
  alter table public.engine_settings add constraint engine_settings_weights check (
    w_household ?& array['price', 'fresh', 'near', 'trust', 'fill']
    and w_business ?& array['price', 'fresh', 'near', 'trust', 'fill']
    and least((w_household ->> 'price')::numeric, (w_household ->> 'fresh')::numeric, (w_household ->> 'near')::numeric,
              (w_household ->> 'trust')::numeric, (w_household ->> 'fill')::numeric) >= 0
    and least((w_business ->> 'price')::numeric, (w_business ->> 'fresh')::numeric, (w_business ->> 'near')::numeric,
              (w_business ->> 'trust')::numeric, (w_business ->> 'fill')::numeric) >= 0
    and abs((w_household ->> 'price')::numeric + (w_household ->> 'fresh')::numeric + (w_household ->> 'near')::numeric
            + (w_household ->> 'trust')::numeric + (w_household ->> 'fill')::numeric - 1) < 0.000001
    and abs((w_business ->> 'price')::numeric + (w_business ->> 'fresh')::numeric + (w_business ->> 'near')::numeric
            + (w_business ->> 'trust')::numeric + (w_business ->> 'fill')::numeric - 1) < 0.000001
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  -- M3a: trust stays at most 1 only if the prior's on-time count is at most its total.
  alter table public.engine_settings add constraint engine_settings_trust_prior check (trust_prior_on_time <= trust_prior_total);
exception when duplicate_object then null;
end $$;

do $$
begin
  -- M3a, M6: a farmer's on-time count never exceeds their completed count.
  alter table public.farmer_details add constraint farmer_details_on_time_le_completed check (orders_on_time <= orders_completed);
exception when duplicate_object then null;
end $$;
