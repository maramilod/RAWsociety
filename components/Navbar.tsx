"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { useDashboardAccess } from "@/components/useDashboardAccess";

// the sections of this page, in the order they appear
const LINKS = [
  { id: "top", label: "Home" },
  { id: "numbers", label: "Numbers" },
  { id: "how-it-works", label: "How we work" },
  { id: "join", label: "Join us" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: session, status } = useSession();
  const loggedIn = status === "authenticated" && !!session?.user;
  const { hasDashboard } = useDashboardAccess();
  // /dashboard sends each user to the dashboard for their role; a client on the free plan has none, only Explore
  const ctaHref = !loggedIn ? "/signup" : hasDashboard ? "/dashboard" : "/explore/free";
  const ctaLabel = !loggedIn ? "Get Started" : hasDashboard ? "My Dashboard" : "Explore";

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      id="top"
      className={`sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--page-bg)]/90 backdrop-blur-md transition-shadow ${
        scrolled ? "shadow-[0_6px_24px_rgba(0,0,0,0.08)]" : ""
      }`}
    >
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 md:h-20 md:gap-8 lg:px-8">
        {/* Logo */}
        <Link href="/" aria-label="RAW society" translate="no" className="font-logo text-2xl font-light leading-[1.05] tracking-wide opacity-70 transition-opacity hover:opacity-100 md:text-3xl">
          <div>RAW</div>
          <div>society</div>
        </Link>

        {/* Desktop menu */}
        <nav className="hidden items-center justify-center gap-8 md:flex lg:gap-12" aria-label="Main">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={go(l.id)}
              className="py-2 text-[15px] font-medium text-[var(--text-main)]/75 transition-colors hover:text-[var(--text-main)] lg:text-base"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="col-start-3 flex items-center justify-self-end gap-2 sm:gap-3">
          <LanguageToggle className="inline-flex h-9 items-center rounded-full border border-[var(--border-default)] px-3.5 text-sm font-semibold text-[var(--text-main)] transition hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange)] md:h-10 md:px-4" />

          <Link
            href={ctaHref}
            className="hidden h-10 items-center rounded-full border border-[var(--text-main)] px-6 text-[15px] font-medium text-[var(--text-main)] transition-all duration-300 hover:bg-[var(--text-main)] hover:text-[var(--page-bg)] md:inline-flex lg:text-base"
          >
            {ctaLabel}
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label="Open Menu"
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-main)] transition hover:bg-[var(--home-icon-bg)] md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div
        className={`absolute inset-x-0 top-full overflow-hidden border-b border-[var(--border-default)] bg-[var(--page-bg)] shadow-[0_16px_32px_rgba(0,0,0,0.12)] transition-all duration-300 md:hidden ${
          open ? "max-h-[28rem] opacity-100" : "pointer-events-none max-h-0 border-transparent opacity-0"
        }`}
      >
        <nav className="flex flex-col px-4 pb-6 pt-2 sm:px-6" aria-label="Mobile">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={go(l.id)}
              className="border-b border-[var(--border-default)]/60 py-4 text-lg font-medium text-[var(--text-main)]"
            >
              {l.label}
            </a>
          ))}

          <Link
            href={ctaHref}
            onClick={() => setOpen(false)}
            className="mt-5 flex h-12 items-center justify-center rounded-full border border-[var(--text-main)] text-lg font-medium text-[var(--text-main)] active:bg-[var(--text-main)] active:text-[var(--page-bg)]"
          >
            {ctaLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
