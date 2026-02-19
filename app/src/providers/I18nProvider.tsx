"use client";

import { FC, ReactNode, createContext, useContext, useState, useCallback } from "react";
import { Locale, defaultLocale, locales } from "@/i18n/config";
import en from "@/i18n/en.json";
import ja from "@/i18n/ja.json";

const messages: Record<Locale, typeof en> = { en, ja };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  t: (key: string) => key,
});

export const useI18n = () => useContext(I18nContext);

interface Props {
  children: ReactNode;
  initialLocale?: Locale;
}

export const I18nProvider: FC<Props> = ({
  children,
  initialLocale = defaultLocale,
}) => {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    if (locales.includes(newLocale)) {
      setLocaleState(newLocale);
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const keys = key.split(".");
      let value: any = messages[locale];
      for (const k of keys) {
        value = value?.[k];
      }
      return typeof value === "string" ? value : key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};
