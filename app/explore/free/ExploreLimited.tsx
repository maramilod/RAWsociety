"use client";

import React, { useState, useEffect } from "react";
import LinkNext from "next/link";
import { Anta } from "next/font/google";
import { formatPrice } from "@/components/services/types";
import ServiceDetailModal from "@/components/services/ServiceDetailModal";
import UserMenu from "@/components/UserMenu";

const anta = Anta({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "sans-serif"],
});

type Offer = {
  id: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  deliveryDays: number | null;
  coverUrl: string | null;
};

const GRADIENTS = ["from-[#ff9447] to-[#5b1d38]", "from-[#C98A64] to-[#4A1D12]", "from-[#B5524A] to-[#2C0F0F]", "from-[#D97A35] to-[#3B1409]"];

export default function ExploreLimited() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [limit, setLimit] = useState(6);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // the server decides what a free client may see: a few offers, without the creators
  useEffect(() => {
    fetch("/api/explore", { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return setError(d.error || "Could not load the offers.");
        setOffers(d.services ?? []);
        if (d.limited?.offers) setLimit(d.limited.offers);
      })
      .catch(() => setError("Could not load the offers."));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[var(--ex-bg)] text-[var(--ex-text)] font-sans antialiased flex flex-col items-stretch w-full">
      
      <div className="w-full bg-[var(--ex-bg)] min-h-screen flex flex-col">
        
        {/* Navbar */}
        <header className="border-b border-[var(--ex-border)] bg-[var(--ex-bg)] sticky top-0 z-50">
          <div className="w-full px-8 md:px-16 py-5 flex justify-between items-center">
            
            <LinkNext 
              href="/" 
              className={`${anta.className} text-4xl leading-none tracking-wide`} 
              style={{ opacity: 0.2 }}
            >
              <div>RAW</div>
              <div>society</div>
            </LinkNext>

            <nav className="hidden md:flex items-center space-x-10 text-sm font-medium text-[var(--ex-text2)]">
              <LinkNext href="#offers" className="hover:text-[var(--ex-text)] transition">Offers</LinkNext>
              <LinkNext href="/onboarding/plan?role=client" className="hover:text-[var(--ex-text)] transition">Membership</LinkNext>
            </nav>

            <div className="flex items-center gap-4">
              <LinkNext
                href="/onboarding/plan?role=client"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#c86d38] text-white hover:opacity-90 transition shadow-sm text-xs font-semibold"
              >
                <span>Upgrade</span>
              </LinkNext>

              <UserMenu />

              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-1.5 focus:outline-none"
                title="Open Menu"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

          </div>
        </header>

        {/* Mobile Sidebar / Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <div className="relative w-72 bg-[var(--ex-bg)] border-r border-[var(--ex-border)] h-full shadow-2xl p-6 flex flex-col z-10 animate-in slide-in-from-left duration-200">
              
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-[var(--ex-border)]">
                <div className="font-serif font-black text-base tracking-tight leading-none">
                  RAW<br />society
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-[var(--ex-muted)] hover:text-[#c86d38] rounded-full transition"
                >
                  ✕
                </button>
              </div>

              <nav className="flex flex-col space-y-3 text-base font-medium text-[var(--ex-text2)]">
                <LinkNext 
                  href="#offers" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 hover:bg-[var(--ex-soft)] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
                >
                  <span>Offers</span>
                  <span className="text-xs text-[#c86d38]">→</span>
                </LinkNext>
                <LinkNext 
                  href="/onboarding/plan?role=client" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 hover:bg-[var(--ex-soft)] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
                >
                  <span>Membership</span>
                  <span className="text-xs text-[#c86d38]">→</span>
                </LinkNext>
              </nav>

            </div>
          </div>
        )}

        {/* Free Plan Alert Banner */}
        <div className="bg-[var(--ex-note-bg)] px-8 md:px-16 py-4 border-b border-[var(--ex-note-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs md:text-sm text-[var(--ex-note-text)] font-medium leading-relaxed">
            You&apos;re on the Free plan: you can see {limit} offers, and the creators behind them stay hidden. Upgrade to see every offer and every creator, and to message them.
          </p>
          <LinkNext href="/onboarding/plan?role=client">
            <button className="px-4 py-2 bg-[#c86d38] text-white text-xs font-bold rounded-xl hover:opacity-90 transition whitespace-nowrap shadow-sm">
              See plans
            </button>
          </LinkNext>
        </div>

        {/* Main Content */}
        <main className="px-8 md:px-16 py-10 md:py-14 w-full flex-1">
          
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-6 border-b border-[var(--ex-border)] pb-6">
            <div>
              <span className="text-xs font-semibold tracking-widest uppercase text-[#c86d38] mb-2 block">
                EXPLORE NETWORK
              </span>
              <h1 className="text-3xl md:text-5xl font-serif font-bold uppercase tracking-wide text-[var(--ex-text)]">
                BROWSE OFFERS
              </h1>
            </div>
          </div>

          {error && <p role="alert" className="mb-6 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          {!offers && !error && <p className="text-sm text-[var(--ex-muted)]">Loading...</p>}
          {offers && offers.length === 0 && <p className="text-sm text-[var(--ex-muted)]">No offers yet. Check back soon.</p>}

          <section id="offers" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 scroll-mt-24">
            {offers?.map((o, i) => (
              <div
                key={o.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(o.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpenId(o.id))}
                className="bg-[var(--ex-surface)] border border-[var(--ex-border)] rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c86d38]"
              >
                <div
                  className={`h-52 md:h-60 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} bg-cover bg-center`}
                  style={o.coverUrl ? { backgroundImage: `url(${o.coverUrl})` } : undefined}
                  role="img"
                  aria-label={o.title}
                />
                <div className="p-5 flex flex-1 flex-col gap-3 bg-[var(--ex-surface)]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c86d38]">{o.category}</p>
                    <h3 className="mt-1 font-bold text-[var(--ex-text)] leading-snug">{o.title}</h3>
                  </div>
                  <p className="text-sm text-[var(--ex-muted)]">
                    {formatPrice(o.price, o.currency)}
                    {o.deliveryDays ? ` · ${o.deliveryDays} days` : ""}
                  </p>
                  <span className="text-xs font-semibold text-[#c86d38]">View details →</span>
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--ex-bg)] px-3 py-2 text-xs font-medium text-[var(--ex-text2)]">
                    <svg className="w-4 h-4 shrink-0 text-[var(--ex-text)]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Creator hidden on the Free plan
                  </div>
                </div>
              </div>
            ))}
          </section>

          {offers && offers.length > 0 && (
            <div className="mb-12 rounded-2xl border border-[var(--ex-border)] bg-[var(--ex-surface)] p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-[var(--ex-text)]">Want to see more?</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--ex-muted)]">
                Business Pro opens every offer and every creator profile, lets you order services and send messages. Enterprise adds your own job posts and unlimited Hire me requests.
              </p>
              <LinkNext href="/onboarding/plan?role=client" className="mt-5 inline-block rounded-xl bg-[#c86d38] px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition">
                See plans
              </LinkNext>
            </div>
          )}

        </main>
      </div>

      {openId && <ServiceDetailModal serviceId={openId} showProfileLink={false} onClose={() => setOpenId(null)} />}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 p-3.5 bg-[#c86d38] text-white rounded-full shadow-lg hover:opacity-90 transition-all duration-300 flex items-center justify-center"
          title="Back to top"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

    </div>
  );
}