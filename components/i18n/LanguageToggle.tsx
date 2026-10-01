"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";

/** The language switch. `floating` puts it in the corner of every page; the landing page has it inside its menu bar. */
export default function LanguageToggle({ floating = false, className = "" }: { floating?: boolean; className?: string }) {
  const { lang, setLang } = useLanguage();
  const pathname = usePathname();
  if (floating && pathname === "/") return null;
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      translate="no"
      onClick={() => setLang(next)}
      aria-label={next === "ar" ? "Switch to Arabic" : "Switch to English"}
      className={
        (floating
          ? "fixed bottom-4 left-4 z-40 h-11 rounded-full border border-[#D9CFC5] bg-white/95 px-4 text-sm font-semibold text-[#2C221E] shadow-lg backdrop-blur transition hover:border-[#C86C29] hover:text-[#C86C29] "
          : "") + className
      }
    >
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}
