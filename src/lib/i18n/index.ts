import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import hi from "@/locales/hi.json";

export const LANGS = ["en", "hi"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_STORAGE_KEY = "annsetu.lang";

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "hi";
}

if (!i18n.isInitialized) {
  // Pages are prerendered in English; the provider switches to the saved language after hydration.
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, hi: { translation: hi } },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    initAsync: false,
    returnNull: false,
  });
}

export default i18n;
