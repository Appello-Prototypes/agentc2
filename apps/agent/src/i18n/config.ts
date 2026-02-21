export const locales = ["en", "de", "fr", "es", "ja", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
    en: "English",
    de: "Deutsch",
    fr: "Français",
    es: "Español",
    ja: "日本語",
    ar: "العربية"
};

export const rtlLocales: Locale[] = ["ar"];

export function isRtl(locale: Locale): boolean {
    return rtlLocales.includes(locale);
}
