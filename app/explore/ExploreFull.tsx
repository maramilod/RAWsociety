"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Anta } from "next/font/google";
import { formatDelivery, formatPrice } from "@/components/services/types";
import ServiceDetailModal from "@/components/services/ServiceDetailModal";
import RatingLine from "@/components/services/RatingLine";
import UserMenu from "@/components/UserMenu";
import { useSession } from "next-auth/react";

// إعداد خط Anta
const anta = Anta({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "sans-serif"],
});

type Creator = {
  id: string;
  name: string;
  role: string;
  bio: string;
  rating: string;
  reviews: number;
  avatarUrl: string | null;
  cvUrl: string | null;
};

type ServiceCard = {
  full?: boolean;
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  deliveryDays: number | null;
  category: string;
  tags: string[];
  coverUrl: string | null;
  rating: number | null;
  reviewsCount: number;
  creator: { id: string; name: string; image: string | null };
};

type Work = {
  id: string;
  title: string;
  author: string;
  likes: number;
  coverUrl: string | null;
};

// ألوان ثابتة لكل منشئ حسب الـ id (لأن قاعدة البيانات لا تخزن الألوان)
const PALETTE = [
  { avatarBg: "bg-purple-600", tagBg: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200" },
  { avatarBg: "bg-amber-700", tagBg: "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200" },
  { avatarBg: "bg-rose-500", tagBg: "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200" },
  { avatarBg: "bg-blue-600", tagBg: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200" },
  { avatarBg: "bg-emerald-600", tagBg: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200" },
];

function paletteFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function ExploreFull() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // حالة الـ Popup الخاص بالـ CV
  const [selectedCvCreator, setSelectedCvCreator] = useState<null | Creator>(null);

  // البيانات القادمة من قاعدة البيانات
  const [creators, setCreators] = useState<Creator[]>([]);
  const [featuredWorks, setFeaturedWorks] = useState<Work[]>([]);
  const { data: session } = useSession();
  const upgradeHref =
    session?.user?.role === "client" || session?.user?.role === "creator"
      ? `/onboarding/plan?role=${session.user.role}`
      : "/onboarding/plan";
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // جلب المنشئين عند تغيير الفئة أو البحث
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ category: activeCategory });
    if (search) params.set("q", search);

    fetch(`/api/explore?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        setCreators(data.creators);
        setFeaturedWorks(data.works);
        setServices(data.services);
        setLoadError("");
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoadError("Could not load creators. Please try again.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [activeCategory, search]);

  // مراقبة التمرير لإظهار أو إخفاء زر الرجوع للأعلى
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

  // دالة الصعود إلى أعلى الصفحة بشكل انسيابي
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased relative">
      
      {/* Header / Navbar */}
      <header className="border-b border-[var(--border-default)] bg-[var(--page-bg)] relative md:sticky md:top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          
          <Link 
            href="/" 
            className={`${anta.className} text-3xl leading-6 tracking-wide`} 
            style={{ opacity: 0.2 }}
          >
            <div>RAW</div>
            <div>society</div>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-[var(--text-main)]">
            <Link href="#featured-work" className="hover:text-[#c86d38] transition">Featured Work</Link>
            {services.length > 0 && (
              <Link href="#services" className="hover:text-[#c86d38] transition">Services</Link>
            )}
            <Link href="#creators" className="hover:text-[#c86d38] transition">Top Talents</Link>
            <Link href="#categories" className="hover:text-[#c86d38] transition">Categories</Link>
            <Link href="#pricing" className="hover:text-[#c86d38] transition">Membership</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={upgradeHref}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#c86d38] text-white hover:opacity-90 transition shadow-sm text-xs font-semibold"
            >
              <span>Upgrade</span>
            </Link>

            <UserMenu />

            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-[var(--ex-text)] bg-[var(--ex-surface)] border border-[var(--ex-border)] hover:bg-[var(--ex-soft)] rounded-full transition shadow-sm"
              title="Open Menu"
            >
              <svg className="w-4 h-4 text-[var(--ex-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Sidebar / Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="relative w-72 bg-[var(--ex-faint)] border-r border-[var(--ex-border)] h-full shadow-2xl p-6 flex flex-col z-10 animate-in slide-in-from-left duration-200">
            
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-[var(--ex-border)]">
              <div className={`${anta.className} text-2xl leading-5 tracking-wide text-[#c86d38]`} style={{ opacity: 0.9 }}>
                <div>RAW</div>
                <div>society</div>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-[var(--ex-muted)] hover:text-[#c86d38] rounded-full transition"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col space-y-3 text-base font-medium text-[var(--ex-text2)]">
              <Link 
                href="#featured-work" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-[var(--ex-soft)] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
              >
                <span>Featured Work</span>
                <span className="text-xs text-[#c86d38]">→</span>
              </Link>
              <Link 
                href="#creators" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-[var(--ex-soft)] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
              >
                <span>Top Talents</span>
                <span className="text-xs text-[#c86d38]">→</span>
              </Link>
              <Link 
                href="#categories" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-[var(--ex-soft)] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
              >
                <span>Categories</span>
                <span className="text-xs text-[#c86d38]">→</span>
              </Link>
              <Link 
                href="#pricing" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-[var(--ex-soft)] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
              >
                <span>Membership</span>
                <span className="text-xs text-[#c86d38]">→</span>
              </Link>
            </nav>

          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-16">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[var(--hero-badge-bg)] text-[var(--text-main)] text-xs font-medium mb-6">
            For brands, businesses & creators
          </span>
          <h1 className="text-3xl md:text-5xl font-serif font-bold tracking-wide uppercase text-[var(--ex-text)] mb-4">
            FIND YOUNG CREATIVE TALENT — FAST
          </h1>
          <p className="text-sm md:text-base text-[var(--ex-muted)] uppercase tracking-wider font-medium max-w-xl mx-auto leading-relaxed">
            CONNECT WITH SKILLED WRITERS, PHOTOGRAPHERS, DESIGNERS, AND MORE.<br />
            SUBSCRIBE TO UNLOCK UNLIMITED HIRES
          </p>
        </div>

        {/* Search Bar & Filters Section */}
        <div id="categories" className="max-w-xl mx-auto mb-16 scroll-mt-20">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search projects, creators..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setLoading(true);
                    setSearch(searchInput.trim());
                  }
                }}
                className="w-full px-4 py-3 rounded-2xl md:rounded-full bg-[var(--ex-surface)] border border-[var(--ex-border)] text-sm focus:outline-none shadow-sm placeholder:text-[var(--ex-muted)]"
              />
            </div>
            <button
              onClick={() => {
                setLoading(true);
                setSearch(searchInput.trim());
              }}
              className="px-6 py-3 bg-[#c86d38] text-white rounded-2xl md:rounded-full font-medium text-sm hover:opacity-90 transition shadow-sm"
            >
              Go
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none justify-start md:justify-center">
            {["All", "Design", "Photo", "Dev"].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setLoading(true);
                  setActiveCategory(cat);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-[var(--ex-inv-bg)] text-[var(--ex-inv-text)]"
                    : "bg-[var(--ex-surface)] border border-[var(--ex-border)] text-[var(--ex-text2)] hover:bg-[var(--ex-soft)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Work Section */}
        {featuredWorks.length > 0 && (
        <section id="featured-work" className="mb-16 scroll-mt-20">
          <h2 className="text-lg font-serif font-bold uppercase tracking-wider mb-6 text-[var(--ex-text)]">
            FEATURED WORK
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredWorks.map((work) => (
              <div key={work.id} className="bg-[var(--ex-surface)] rounded-2xl border border-[var(--ex-border)] overflow-hidden shadow-sm">
                {work.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={work.coverUrl} alt={work.title} className="h-64 w-full object-cover" />
                ) : (
                  <div className="h-64 bg-[var(--ex-soft)] p-6 relative flex items-center justify-between">
                    <div className="w-28 h-28 bg-[#c86d38] rounded-2xl transform -rotate-6 shadow-md" />
                    <div className="w-24 h-24 bg-[#3e2723] rounded-full transform translate-y-4 shadow-md" />
                  </div>
                )}
                
                <div className="p-4 flex items-center justify-between border-t border-[var(--ex-soft)]">
                  <div>
                    <h3 className="font-bold text-sm text-[var(--ex-text)]">{work.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-5 h-5 rounded-full bg-[var(--ex-soft)]" />
                      <span className="text-xs text-[var(--ex-muted)] font-medium">{work.author}</span>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--ex-muted)] font-medium">{work.likes} likes</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Services Section */}
        {services.length > 0 && (
          <section id="services" className="mb-16 scroll-mt-20">
            <h2 className="text-lg font-serif font-bold uppercase tracking-wider mb-6 text-[var(--ex-text)]">
              SERVICES YOU CAN HIRE
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {services.map((service) => {
                const colors = paletteFor(service.creator.id);
                const delivery = formatDelivery(service.deliveryDays);
                return (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => setSelectedServiceId(service.id)}
                    className="group text-left bg-[var(--ex-surface)] border border-[var(--ex-border)] rounded-2xl p-5 flex flex-col shadow-sm hover:shadow-md hover:border-[#c86d38] transition overflow-hidden"
                  >
                    {service.coverUrl && (
                      <div className="-mx-5 -mt-5 mb-4 h-40 overflow-hidden bg-[var(--ex-soft)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={service.coverUrl}
                          alt=""
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    )}
                    <span className="self-start px-2.5 py-0.5 rounded-full bg-[var(--ex-soft)] text-[10px] font-semibold text-[var(--ex-text2)] mb-3">
                      {service.category}
                    </span>
                    <h3 className="font-bold text-sm text-[var(--ex-text)] mb-1 group-hover:text-[#c86d38] transition">
                      {service.title}
                    </h3>
                    <RatingLine rating={service.rating} count={service.reviewsCount} className="text-xs mb-2" />
                    <p className="text-xs text-[var(--ex-muted)] line-clamp-3 mb-3 min-h-[48px]">
                      {service.description || "No description provided."}
                    </p>
                    {service.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {service.tags.slice(0, 3).map((t) => (
                          <span key={t} className="rounded-md bg-[var(--ex-faint)] border border-[var(--ex-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--ex-text2)]">
                            {t}
                          </span>
                        ))}
                        {service.tags.length > 3 && (
                          <span className="text-[10px] text-[var(--ex-muted)] self-center">+{service.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-4">
                      {service.creator.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={service.creator.image} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className={`w-6 h-6 rounded-full ${colors.avatarBg} text-white text-[10px] font-bold flex items-center justify-center`}>
                          {service.creator.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-medium text-[var(--ex-muted)] truncate">{service.creator.name}</span>
                    </div>

                    <div className="mt-auto pt-3 border-t border-[var(--ex-soft)] flex items-center justify-between">
                      <span className="text-sm font-bold text-[#c86d38]">
                        {formatPrice(service.price, service.currency)}
                      </span>
                      <span className="text-[11px] text-[var(--ex-muted)]">
                        {delivery ? `${delivery} · ` : ""}{service.full ? "Full this month" : "View & book"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Creators Grid Section */}
        <section id="creators" className="mb-12 scroll-mt-20">
          <div className="text-center mb-8">
            <h2 className="text-lg md:text-xl font-serif font-bold uppercase tracking-widest text-[var(--ex-text)]">
              A FEW CREATORS WORTH MEETING
            </h2>
          </div>

          {loading && (
            <p className="text-center text-sm text-[var(--ex-muted)]">Loading creators...</p>
          )}
          {!loading && loadError && (
            <p role="alert" className="text-center text-sm font-medium text-red-600 dark:text-red-400">{loadError}</p>
          )}
          {!loading && !loadError && creators.length === 0 && (
            <p className="text-center text-sm text-[var(--ex-muted)]">
              {search || activeCategory !== "All"
                ? "No creators match your search."
                : "No creators have joined yet. Check back soon."}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {creators.map((creator) => {
              const colors = paletteFor(creator.id);
              return (
              <div key={creator.id} className="bg-[var(--ex-surface)] border border-[var(--ex-border)] rounded-2xl p-5 text-center flex flex-col items-center shadow-sm">
                {creator.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creator.avatarUrl} alt={creator.name} className="w-12 h-12 rounded-full object-cover mb-3" />
                ) : (
                  <div className={`w-12 h-12 rounded-full ${colors.avatarBg} text-white font-bold flex items-center justify-center text-sm mb-3`}>
                    {creator.name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                  </div>
                )}
                <h3 className="font-bold text-sm text-[var(--ex-text)]">{creator.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold my-2 ${colors.tagBg}`}>
                  {creator.role}
                </span>
                <p className="text-xs text-[var(--ex-muted)] line-clamp-2 mb-3 min-h-[32px]">
                  {creator.bio}
                </p>
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-4">
                  ★ {creator.rating} <span className="text-[var(--ex-muted)] font-normal">({creator.reviews})</span>
                </div>

                {/* أزرار View Profile وزر فتح الـ CV Modal */}
                <div className="w-full flex items-center gap-2 mt-auto pt-3 border-t border-[var(--ex-soft)]">
                  <Link 
                    href={`/creators/${creator.id}`} 
                    className="flex-1 py-1.5 px-2 bg-[var(--ex-inv-bg)] text-[var(--ex-inv-text)] text-[11px] font-semibold rounded-lg hover:opacity-90 transition text-center"
                  >
                    View Profile
                  </Link>
                  {creator.cvUrl && (
                    <button
                      onClick={() => setSelectedCvCreator(creator)}
                      className="py-1.5 px-3 bg-[var(--ex-soft)] text-[var(--ex-text2)] text-[11px] font-semibold rounded-lg hover:bg-[var(--ex-border)] transition text-center"
                    >
                      CV
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <button className="text-xs font-semibold underline text-[var(--ex-muted)] hover:text-[var(--ex-text)]">
              Browse all creators →
            </button>
          </div>
        </section>

      </main>

      {/* نافذة منبثقة (Popup / Modal) لعرض السيرة الذاتية (CV Viewer) */}
      {selectedCvCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* خلفية معتمة */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedCvCreator(null)}
          />

          {/* محتوى الـ Modal */}
          <div className="relative bg-[var(--ex-surface)] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* رأس الـ Modal */}
            <div className="px-6 py-4 border-b border-[var(--ex-border)] flex items-center justify-between bg-[var(--ex-faint)]">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--ex-text)]">
                  {selectedCvCreator.name} — Curriculum Vitae
                </h3>
                <p className="text-xs text-[var(--ex-muted)]">
                  {selectedCvCreator.role} · Attached file format: PDF
                </p>
              </div>
              <button 
                onClick={() => setSelectedCvCreator(null)}
                className="p-2 text-[var(--ex-muted)] hover:text-[var(--ex-text)] rounded-full transition"
              >
                ✕
              </button>
            </div>

            {/* جسم الـ Modal (عنصر العرض: iframe للـ PDF أو مشغل معاينة للـ Word) */}
            <div className="flex-1 bg-[var(--ex-soft)] p-4 flex items-center justify-center min-h-[400px] overflow-y-auto">
              <iframe
                src={`${selectedCvCreator.cvUrl}#view=FitH`}
                className="w-full h-[500px] rounded-lg border border-[var(--ex-border)] bg-[var(--ex-surface)] shadow-inner"
                title="CV Document Preview"
              />
            </div>

            {/* تذييل الـ Modal */}
            <div className="px-6 py-3 border-t border-[var(--ex-border)] bg-[var(--ex-surface)] flex items-center justify-between">
              <span className="text-[11px] text-[var(--ex-muted)]">
                Direct client preview mode
              </span>
              <div className="flex items-center gap-2">
                <a 
                  href={selectedCvCreator.cvUrl ?? undefined}
                  download
                  className="px-4 py-2 bg-[var(--ex-soft)] text-[var(--ex-text)] text-xs font-semibold rounded-xl hover:bg-[var(--ex-border)] transition"
                >
                  Download CV
                </a>
                <button 
                  onClick={() => setSelectedCvCreator(null)}
                  className="px-4 py-2 bg-[#c86d38] text-white text-xs font-semibold rounded-xl hover:opacity-90 transition"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {selectedServiceId && (
        <ServiceDetailModal
          serviceId={selectedServiceId}
          showProfileLink
          onClose={() => setSelectedServiceId(null)}
        />
      )}

      {/* زر الرجوع للأعلى (Back to Top Button) */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 bg-[#c86d38] text-white rounded-full shadow-lg hover:opacity-90 transition-all duration-300 flex items-center justify-center"
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