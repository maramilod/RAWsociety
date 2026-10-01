import type { Metadata } from "next";
import { Anta, Alegreya_SC, Alegreya_Sans, Cairo } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import LanguageProvider from "@/components/i18n/LanguageProvider";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { LANG_COOKIE, isLang } from "@/lib/i18n";

const anta = Anta({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anta",
});

const alegreyaSC = Alegreya_SC({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-alegreya-sc",
});

const alegreyaSans = Alegreya_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-alegreya-sans",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "RAW Society",
  description: "RAW Society",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(saved) ? saved : "en";
  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      data-i18n={lang === "ar" ? "pending" : undefined}
      suppressHydrationWarning
      className={`${anta.variable} ${alegreyaSC.variable} ${alegreyaSans.variable} ${cairo.variable}`}
    >
      <body>
        {lang === "ar" && (
          // never leave the page hidden if the translation fails to load
          <script dangerouslySetInnerHTML={{ __html: "setTimeout(function(){document.documentElement.removeAttribute('data-i18n')},2500)" }} />
        )}
        <LanguageProvider lang={lang}>
          <SessionProvider>
            {children}
          </SessionProvider>
          <LanguageToggle floating />
        </LanguageProvider>
      </body>
    </html>
  );
}