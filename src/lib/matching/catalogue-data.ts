// The seed catalogue (supabase/catalogue.json) as CatalogueItems, for tests and offline use.
// At runtime the app reads the same items from the database (public.items, public.item_names).
import raw from "../../../supabase/catalogue.json";
import type { CatalogueItem } from "./search";

type RawItem = { id: string; category: string; en: string; hi: string; unit: string; shelf_life_hours: number; names: string[] };

export const SEED_CATALOGUE: CatalogueItem[] = (raw.items as RawItem[]).map((i) => ({
  id: i.id,
  category: i.category,
  nameEn: i.en,
  nameHi: i.hi,
  baseUnit: i.unit as CatalogueItem["baseUnit"],
  shelfLifeHours: i.shelf_life_hours,
  names: i.names,
}));
