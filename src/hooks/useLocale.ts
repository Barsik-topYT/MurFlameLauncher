import { useMemo } from "react";
import { useLauncherStore } from "../store/useLauncherStore";

// Прямой импорт JSON (работает в Vite)
import ruMessages from "../locales/ru.json";
import enMessages from "../locales/en.json";

type Messages = Record<string, string>;

const locales: Record<string, Messages> = {
  ru: ruMessages as Messages,
  en: enMessages as Messages,
};

export function useLocale() {
  const { settings } = useLauncherStore();
  const locale = settings?.language ?? "ru";
  
  const t = useMemo(() => {
    const messages = locales[locale] || locales.ru;
    return (key: string): string => {
      const value = messages[key];
      if (value) return value;
      console.warn(`Missing translation key: ${key} for locale: ${locale}`);
      return key;
    };
  }, [locale]);
  
  return { locale, t };
}