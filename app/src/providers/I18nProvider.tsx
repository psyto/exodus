"use client";

import {
  FC,
  ReactNode,
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Locale, defaultLocale, locales } from "@/i18n/config";
import en from "@/i18n/en.json";
import ja from "@/i18n/ja.json";

const messages: Record<Locale, typeof en> = { en, ja };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  t: (key: string, fallback?: string) => fallback ?? key,
});

export const useI18n = () => useContext(I18nContext);

interface Props {
  children: ReactNode;
  initialLocale?: Locale;
}

/** Extract locale from URL pathname, e.g. "/ja/dashboard" → "ja" */
function localeFromPath(pathname: string): Locale | null {
  const seg = pathname.split("/")[1];
  return locales.includes(seg as Locale) ? (seg as Locale) : null;
}

export const I18nProvider: FC<Props> = ({
  children,
  initialLocale,
}) => {
  const pathname = usePathname();
  const router = useRouter();

  const urlLocale = useMemo(() => localeFromPath(pathname), [pathname]);

  const [locale, setLocaleState] = useState<Locale>(
    initialLocale ?? urlLocale ?? defaultLocale
  );

  // Sync locale when URL changes (e.g. browser back/forward)
  useEffect(() => {
    if (urlLocale && urlLocale !== locale) {
      setLocaleState(urlLocale);
    }
  }, [urlLocale]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback(
    (newLocale: Locale) => {
      if (!locales.includes(newLocale)) return;
      setLocaleState(newLocale);

      // Navigate to the equivalent page under the new locale
      if (urlLocale) {
        // Currently on a locale route — swap the locale segment
        const newPath = pathname.replace(`/${urlLocale}`, `/${newLocale}`);
        router.push(newPath);
      } else {
        // On the landing page or non-locale route — no URL change needed
      }
    },
    [pathname, urlLocale, router]
  );

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const keys = key.split(".");
      let value: any = messages[locale];
      for (const k of keys) {
        value = value?.[k];
      }
      return typeof value === "string" ? value : (fallback ?? key);
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};
