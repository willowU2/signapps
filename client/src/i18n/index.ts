import fr from "./messages/fr.json";
import en from "./messages/en.json";

export type Locale = "fr" | "en";
export const defaultLocale: Locale = "fr";
export const locales: Locale[] = ["fr", "en"];

const messages = { fr, en } as const;

export function t(key: string, locale: Locale = defaultLocale): string {
  const keys = key.split(".");
  let value: unknown = messages[locale];
  for (const k of keys) {
    if (value && typeof value === "object")
      value = (value as Record<string, unknown>)[k];
    else return key;
  }
  return typeof value === "string" ? value : key;
}
