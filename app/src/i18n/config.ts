export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ja";

export function getMessages(locale: Locale) {
  return require(`./${locale}.json`);
}
