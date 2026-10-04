"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { isLang, LANG_STORAGE_KEY, type Lang } from "./index";

type LangContextValue = { lang: Lang; setLang: (lang: Lang) => void };
const LangContext = createContext<LangContextValue>({ lang: "en", setLang: () => {} });

function readStoredLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

// i18next owns the current language; React reads it as an external store.
const subscribe = (cb: () => void) => {
  i18n.on("languageChanged", cb);
  return () => i18n.off("languageChanged", cb);
};
const getSnapshot = (): Lang => (isLang(i18n.language) ? i18n.language : "en");
const getServerSnapshot = (): Lang => "en";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Pages are prerendered in English; switch to the saved language once hydrated.
  useEffect(() => {
    const stored = readStoredLang();
    if (stored && stored !== i18n.language) void i18n.changeLanguage(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    void i18n.changeLanguage(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* storage blocked: the choice lasts for this visit */
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return (
    <I18nextProvider i18n={i18n}>
      <LangContext.Provider value={value}>{children}</LangContext.Provider>
    </I18nextProvider>
  );
}

export const useLang = () => useContext(LangContext);
