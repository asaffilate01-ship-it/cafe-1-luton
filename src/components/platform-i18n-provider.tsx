import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePlatformLocale, type PlatformLocale } from "@/lib/platform-i18n";
import { platformCopy, type PlatformCopy } from "@/lib/platform-copy";

type Ctx = {
  locale: PlatformLocale;
  setLocale: (next: PlatformLocale) => void;
  t: PlatformCopy;
};

const PlatformI18nContext = createContext<Ctx | null>(null);

export function PlatformI18nProvider({ children }: { children: ReactNode }) {
  const { locale, setLocale } = usePlatformLocale();
  const value = useMemo(() => ({ locale, setLocale, t: platformCopy[locale] }), [locale, setLocale]);
  return <PlatformI18nContext.Provider value={value}>{children}</PlatformI18nContext.Provider>;
}

/** Falls back to English so the hook is safe outside the provider. */
export function usePlatformI18n(): Ctx {
  const ctx = useContext(PlatformI18nContext);
  return ctx ?? { locale: "en", setLocale: () => {}, t: platformCopy.en };
}
