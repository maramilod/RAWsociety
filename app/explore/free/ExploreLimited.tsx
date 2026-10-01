"use client";

import React, { useState, useEffect } from "react";
import LinkNext from "next/link";
import { Anta } from "next/font/google";

const anta = Anta({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "sans-serif"],
});

const creators = [
  { 
    id: 1, 
    name: "Sara M.", 
    role: "Photographer", 
    rate: "60 LYD/hr", 
    bio: "Editorial & product photography", 
    rating: "4.9", 
    reviews: 112, 
    avatarBg: "bg-amber-700", 
    tagBg: "bg-amber-100 text-amber-800",
    isLocked: false 
  },
  { 
    id: 2, 
    name: "Omar K.", 
    role: "UI/UX Designer", 
    rate: "75 LYD/hr", 
    bio: "Web & mobile interfaces", 
    rating: "4.8", 
    reviews: 94, 
    avatarBg: "bg-purple-600", 
    tagBg: "bg-purple-100 text-purple-700",
    isLocked: false 
  },
  { 
    id: 3, 
    name: "Laila B.", 
    role: "Content Writer & Copywriter", 
    rate: "50 LYD/hr", 
    bio: "Brand storytelling & essays", 
    rating: "5.0", 
    reviews: 78, 
    avatarBg: "bg-emerald-600", 
    tagBg: "bg-emerald-100 text-emerald-700",
    isLocked: true 
  },
  { 
    id: 4, 
    name: "Tariq N.", 
    role: "Full-Stack Developer", 
    rate: "90 LYD/hr", 
    bio: "Laravel & React architectures", 
    rating: "4.9", 
    reviews: 130, 
    avatarBg: "bg-blue-600", 
    tagBg: "bg-blue-100 text-blue-700",
    isLocked: true 
  },
];

export default function ExploreLimited() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

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
    <div className="min-h-screen bg-[#f7f5f0] text-[#1c1917] font-sans antialiased flex flex-col items-stretch w-full">
      
      <div className="w-full bg-[#f7f5f0] min-h-screen flex flex-col">
        
        {/* Navbar */}
        <header className="border-b border-[#e5e0d8] bg-[#f7f5f0] sticky top-0 z-50">
          <div className="w-full px-8 md:px-16 py-5 flex justify-between items-center">
            
            <LinkNext 
              href="/" 
              className={`${anta.className} text-4xl leading-none tracking-wide`} 
              style={{ opacity: 0.2 }}
            >
              <div>RAW</div>
              <div>society</div>
            </LinkNext>

            <nav className="hidden md:flex items-center space-x-10 text-sm font-medium text-[#44403c]">
              <LinkNext href="#creators" className="hover:text-black transition">Top Talents</LinkNext>
              <LinkNext href="#categories" className="hover:text-black transition">Categories</LinkNext>
              <LinkNext href="/onboarding/plan?role=client" className="hover:text-black transition">Membership</LinkNext>
            </nav>

            <div className="flex items-center gap-4">
              <LinkNext
                href="/onboarding/plan?role=client"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#c86d38] text-white hover:opacity-90 transition shadow-sm text-xs font-semibold"
              >
                <span>Upgrade</span>
              </LinkNext>

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

            <div className="relative w-72 bg-[#f7f5f0] border-r border-[#e5e0d8] h-full shadow-2xl p-6 flex flex-col z-10 animate-in slide-in-from-left duration-200">
              
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#e5e0d8]">
                <div className="font-serif font-black text-base tracking-tight leading-none">
                  RAW<br />society
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-gray-500 hover:text-[#c86d38] rounded-full transition"
                >
                  ✕
                </button>
              </div>

              <nav className="flex flex-col space-y-3 text-base font-medium text-[#44403c]">
                <LinkNext 
                  href="#creators" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 hover:bg-[#f0eae1] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
                >
                  <span>Top Talents</span>
                  <span className="text-xs text-[#c86d38]">→</span>
                </LinkNext>
                <LinkNext 
                  href="#categories" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 hover:bg-[#f0eae1] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
                >
                  <span>Categories</span>
                  <span className="text-xs text-[#c86d38]">→</span>
                </LinkNext>
                <LinkNext 
                  href="/onboarding/plan?role=client" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 hover:bg-[#f0eae1] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
                >
                  <span>Membership</span>
                  <span className="text-xs text-[#c86d38]">→</span>
                </LinkNext>
              </nav>

            </div>
          </div>
        )}

        {/* Free Plan Alert Banner */}
        <div className="bg-[#f7e8e8] px-8 md:px-16 py-4 border-b border-[#ebd3d3] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs md:text-sm text-[#4a3232] font-medium leading-relaxed">
            You&apos;re on the Free plan — portfolios are locked. Upgrade from 30 LYD/month to unlock unlimited access.
          </p>
          <LinkNext href="/onboarding/plan?role=client">
            <button className="px-4 py-2 bg-[#c86d38] text-white text-xs font-bold rounded-xl hover:opacity-90 transition whitespace-nowrap shadow-sm">
              See plans
            </button>
          </LinkNext>
        </div>

        {/* Main Content */}
        <main className="px-8 md:px-16 py-10 md:py-14 w-full flex-1">
          
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-6 border-b border-[#e5e0d8] pb-6">
            <div>
              <span className="text-xs font-semibold tracking-widest uppercase text-[#c86d38] mb-2 block">
                EXPLORE NETWORK
              </span>
              <h1 className="text-3xl md:text-5xl font-serif font-bold uppercase tracking-wide text-[#1c1917]">
                BROWSE CREATORS
              </h1>
            </div>

            {/* Category Filter Pills */}
            <div id="categories" className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-none scroll-mt-24">
              {["All", "Design", "Photo", "Dev"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                    activeCategory === cat
                      ? "bg-[#1c1917] text-white shadow-sm"
                      : "bg-white border border-[#e5e0d8] text-[#44403c] hover:bg-gray-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Browse Creators Section */}
          <section id="creators" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 scroll-mt-24">
            
            {creators.map((creator) => (
              <div key={creator.id} className="bg-white border border-[#e5e0d8] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition">
                
                <div className={`h-56 md:h-64 relative flex items-center justify-center ${creator.isLocked ? "bg-gradient-to-r from-[#f0dcd0] to-[#d8d8d8] backdrop-blur-md flex-col gap-3" : "bg-[#f0eae1]"}`}>
                  {creator.isLocked ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-[#1c1917]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-[#1c1917]">Upgrade to view portfolio</span>
                    </>
                  ) : (
                    <svg className="w-full h-full text-[#d8d0c5]" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.5" />
                      <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.5" />
                    </svg>
                  )}
                </div>

                <div className="p-5 flex items-center justify-between border-t border-[#f0eae1] bg-white">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${creator.avatarBg} text-white font-bold flex items-center justify-center text-xs flex-shrink-0`}>
                      {creator.name[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#1c1917]">{creator.name}</h3>
                      <p className="text-xs text-gray-500">{creator.role} · {creator.rate}</p>
                    </div>
                  </div>
                  
                  <button className="px-3.5 py-1.5 bg-[#eae7e1] text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed">
                    Message · Pro
                  </button>
                </div>

              </div>
            ))}

          </section>

        </main>
      </div>

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