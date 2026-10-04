import type { TFunction } from "i18next";
import { ApiError } from "./api";

/** Turns Supabase/Postgres errors into a translated sentence that says what to do next. */
export function errorMessage(err: unknown, t: TFunction): string {
  const e = err as { message?: string; code?: string; status?: number; name?: string };
  const msg = e?.message ?? "";
  if (err instanceof ApiError) {
    const name = err.detail ?? "";
    switch (err.code) {
      case "insufficient_stock":
        return t("checkout.insufficient", { name, qty: err.hint ?? "0" });
      case "below_min_order":
        return t("checkout.belowMin", { name });
      case "unavailable":
        return t("checkout.unavailable", { name: name || t("market.notFound") });
      case "invalid_delivery":
        return t("checkout.needLocation");
      case "invalid_transition":
        return t("orders.transitionError");
      case "exceeds_available":
        return t("ledger.tooMuch", { qty: err.hint ?? "0", unit: "" }).trim();
      case "unit_locked":
        return t("produce.unitLocked");
      case "min_order_too_big":
        return t("errors.minOrderTooBig");
      case "upload_failed":
        return t("errors.upload");
      case "out_of_range":
      case "not_fresh_on_arrival":
      case "hidden_in_area":
        return t(`checkout.problem.${err.code}`, { name });
      case "location_required":
        return t("checkout.needPin");
      case "unknown_item":
      case "unit_not_allowed":
      case "item_locked":
      case "harvest_in_future":
      case "deliver_by_in_past":
        return t(`errors.${err.code}`);
    }
  }
  if (/invalid login credentials/i.test(msg)) return t("auth.invalidCredentials");
  if (/already registered|already been registered|user already exists/i.test(msg)) return t("auth.emailTaken");
  if (/email not confirmed/i.test(msg)) return t("auth.emailNotConfirmed");
  if (/rate limit|too many/i.test(msg) || e?.status === 429) return t("auth.rateLimited");
  if (/password/i.test(msg) && /(least|short|weak)/i.test(msg)) return t("errors.minLength", { count: 8 });
  if (/failed to fetch|network/i.test(msg)) return t("errors.network");
  return t("errors.generic");
}
