"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Anta } from "next/font/google";

// إعداد خط Anta
const anta = Anta({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "sans-serif"],
});

// بيانات محاكاة للمتخصصين (Creators) مع تضمين رابط ملف الـ CV (PDF أو Word)
const creators = [
  { 
    id: 1, 
    name: "Elena Brooks", 
    role: "Writer", 
    bio: "Brand story for tech startups", 
    rating: "4.9", 
    reviews: 142, 
    avatarBg: "bg-purple-600", 
    tagBg: "bg-purple-100 text-purple-700",
    cvUrl: "/files/elena-brooks-cv.pdf", // رابط افتراضي لملف السيرة الذاتية
    cvType: "pdf"
  },
  { 
    id: 2, 
    name: "Theo Marin", 
    role: "Photographer", 
    bio: "Editorial & product photography", 
    rating: "4.9", 
    reviews: 112, 
    avatarBg: "bg-amber-700", 
    tagBg: "bg-amber-100 text-amber-800",
    cvUrl: "/files/theo-marin-cv.docx",
    cvType: "docx"
  },
  { 
    id: 3, 
    name: "Priya Nair", 
    role: "Video Editor", 
    bio: "Short-form video & reels", 
    rating: "5.0", 
    reviews: 98, 
    avatarBg: "bg-rose-500", 
    tagBg: "bg-rose-100 text-rose-700",
    cvUrl: "/files/priya-nair-cv.pdf",
    cvType: "pdf"
  },
  { 
    id: 4, 
    name: "Jonas Weber", 
    role: "Developer", 
    bio: "Full-stack web & app dev", 
    rating: "4.7", 
    reviews: 104, 
    avatarBg: "bg-blue-600", 
    tagBg: "bg-blue-100 text-blue-700",
    cvUrl: "/files/jonas-weber-cv.pdf",
    cvType: "pdf"
  },
];

// بيانات محاكاة للأعمال المميزة (Featured Works)
const featuredWorks = [
  {
    id: "old-tripoli",
    title: "Desert Brand Identity",
    author: "Aya H.",
    likes: 214,
    bgColor: "bg-pink-100",
    shape1Color: "bg-[#c86d38]",
    shape2Color: "bg-[#3e2723]",
  },
  {
    id: "old-tripoli-2",
    title: "Old Tripoli in Frames",
    author: "Sara M.",
    likes: 342,
    bgColor: "bg-[#210e0b]",
    shape1Color: "bg-[#e8e3de]",
    shape2Color: "bg-[#c86d38]",
  },
];

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // حالة الـ Popup الخاص بالـ CV
  const [selectedCvCreator, setSelectedCvCreator] = useState<null | typeof creators[0]>(null);

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
      <header className="border-b border-[#e5e0d8] bg-[var(--background)] relative md:sticky md:top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          
          <Link 
            href="/" 
            className={`${anta.className} text-3xl leading-6 tracking-wide`} 
            style={{ opacity: 0.2 }}
          >
            <div>RAW</div>
            <div>society</div>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-[#44403c]">
            <Link href="#featured-work" className="hover:text-black transition">Featured Work</Link>
            <Link href="#creators" className="hover:text-black transition">Top Talents</Link>
            <Link href="#categories" className="hover:text-black transition">Categories</Link>
            <Link href="#pricing" className="hover:text-black transition">Membership</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/onboarding/plans"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#c86d38] text-white hover:opacity-90 transition shadow-sm text-xs font-semibold"
            >
              <span>Plans</span>
            </Link>

            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-[#1c1917] bg-white border border-[#e5e0d8] hover:bg-gray-100 rounded-full transition shadow-sm"
              title="Open Menu"
            >
              <svg className="w-4 h-4 text-[#1c1917]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <div className="relative w-72 bg-[#f9f6f0] border-r border-[#e5e0d8] h-full shadow-2xl p-6 flex flex-col z-10 animate-in slide-in-from-left duration-200">
            
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#e8e2d5]">
              <div className={`${anta.className} text-2xl leading-5 tracking-wide text-[#c86d38]`} style={{ opacity: 0.9 }}>
                <div>RAW</div>
                <div>society</div>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-500 hover:text-[#c86d38] rounded-full transition"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col space-y-3 text-base font-medium text-[#44403c]">
              <Link 
                href="#featured-work" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-[#f0eae1] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
              >
                <span>Featured Work</span>
                <span className="text-xs text-[#c86d38]">→</span>
              </Link>
              <Link 
                href="#creators" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-[#f0eae1] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
              >
                <span>Top Talents</span>
                <span className="text-xs text-[#c86d38]">→</span>
              </Link>
              <Link 
                href="#categories" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-[#f0eae1] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
              >
                <span>Categories</span>
                <span className="text-xs text-[#c86d38]">→</span>
              </Link>
              <Link 
                href="#pricing" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-[#f0eae1] hover:text-[#c86d38] rounded-xl transition flex items-center justify-between"
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
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#e6ddfa] text-[#6b46c1] text-xs font-medium mb-6">
            For brands, businesses & creators
          </span>
          <h1 className="text-3xl md:text-5xl font-serif font-bold tracking-wide uppercase text-[#1c1917] mb-4">
            FIND YOUNG CREATIVE TALENT — FAST
          </h1>
          <p className="text-sm md:text-base text-[#68625d] uppercase tracking-wider font-medium max-w-xl mx-auto leading-relaxed">
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
                className="w-full px-4 py-3 rounded-2xl md:rounded-full bg-white border border-[#e5e0d8] text-sm focus:outline-none shadow-sm placeholder:text-gray-400"
              />
            </div>
            <button className="px-6 py-3 bg-[#c86d38] text-white rounded-2xl md:rounded-full font-medium text-sm hover:opacity-90 transition shadow-sm">
              Go
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none justify-start md:justify-center">
            {["All", "Design", "Photo", "Dev"].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-[#1c1917] text-white"
                    : "bg-white border border-[#e5e0d8] text-[#44403c] hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Work Section */}
        <section id="featured-work" className="mb-16 scroll-mt-20">
          <h2 className="text-lg font-serif font-bold uppercase tracking-wider mb-6 text-[#1c1917]">
            FEATURED WORK
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredWorks.map((work) => (
              <div key={work.id} className="bg-white rounded-2xl border border-[#e5e0d8] overflow-hidden shadow-sm">
                <div className={`h-64 ${work.bgColor} p-6 relative flex items-center justify-between`}>
                  <div className={`w-28 h-28 ${work.shape1Color} rounded-2xl transform -rotate-6 shadow-md`} />
                  <div className={`w-24 h-24 ${work.shape2Color} rounded-full transform translate-y-4 shadow-md`} />
                </div>
                
                <div className="p-4 flex items-center justify-between border-t border-[#f0eae1]">
                  <div>
                    <h3 className="font-bold text-sm text-[#1c1917]">{work.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-5 h-5 rounded-full bg-gray-200" />
                      <span className="text-xs text-[#68625d] font-medium">{work.author}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">{work.likes} likes</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Creators Grid Section */}
        <section id="creators" className="mb-12 scroll-mt-20">
          <div className="text-center mb-8">
            <h2 className="text-lg md:text-xl font-serif font-bold uppercase tracking-widest text-[#1c1917]">
              A FEW CREATORS WORTH MEETING
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {creators.map((creator) => (
              <div key={creator.id} className="bg-white border border-[#e5e0d8] rounded-2xl p-5 text-center flex flex-col items-center shadow-sm">
                <div className={`w-12 h-12 rounded-full ${creator.avatarBg} text-white font-bold flex items-center justify-center text-sm mb-3`}>
                  {creator.name.split(" ").map(n => n[0]).join("")}
                </div>
                <h3 className="font-bold text-sm text-[#1c1917]">{creator.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold my-2 ${creator.tagBg}`}>
                  {creator.role}
                </span>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3 min-h-[32px]">
                  {creator.bio}
                </p>
                <div className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-4">
                  ★ {creator.rating} <span className="text-gray-400 font-normal">({creator.reviews})</span>
                </div>

                {/* أزرار View Profile وزر فتح الـ CV Modal */}
                <div className="w-full flex items-center gap-2 mt-auto pt-3 border-t border-[#f0eae1]">
                  <Link 
                    href={`/creators/${creator.id}`} 
                    className="flex-1 py-1.5 px-2 bg-[#1c1917] text-white text-[11px] font-semibold rounded-lg hover:opacity-90 transition text-center"
                  >
                    View Profile
                  </Link>
                  <button 
                    onClick={() => setSelectedCvCreator(creator)}
                    className="py-1.5 px-3 bg-[#f0eae1] text-[#44403c] text-[11px] font-semibold rounded-lg hover:bg-[#e4dbcd] transition text-center"
                  >
                    CV
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button className="text-xs font-semibold underline text-[#68625d] hover:text-black">
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
          <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* رأس الـ Modal */}
            <div className="px-6 py-4 border-b border-[#e5e0d8] flex items-center justify-between bg-[#f9f6f0]">
              <div>
                <h3 className="font-serif font-bold text-base text-[#1c1917]">
                  {selectedCvCreator.name} — Curriculum Vitae
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedCvCreator.role} · Attached file format: {selectedCvCreator.cvType.toUpperCase()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedCvCreator(null)}
                className="p-2 text-gray-400 hover:text-[#1c1917] rounded-full transition"
              >
                ✕
              </button>
            </div>

            {/* جسم الـ Modal (عنصر العرض: iframe للـ PDF أو مشغل معاينة للـ Word) */}
            <div className="flex-1 bg-[#f0eae1] p-4 flex items-center justify-center min-h-[400px] overflow-y-auto">
              {selectedCvCreator.cvType === "pdf" ? (
                <iframe 
                  src={`${selectedCvCreator.cvUrl}#view=FitH`} 
                  className="w-full h-[500px] rounded-lg border border-[#d8d0c5] bg-white shadow-inner"
                  title="CV Document Preview"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-xl border border-[#d8d0c5] shadow-sm max-w-md w-full">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center mx-auto mb-3 text-sm">
                    DOC
                  </div>
                  <h4 className="font-bold text-sm text-[#1c1917] mb-1">Word Document File</h4>
                  <p className="text-xs text-gray-500 mb-4">
                    This CV has been uploaded as a Word (.docx) document. You can download and view it directly.
                  </p>
                  <a 
                    href={selectedCvCreator.cvUrl} 
                    download 
                    className="inline-block px-4 py-2 bg-[#1c1917] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition shadow-sm"
                  >
                    Download & View File
                  </a>
                </div>
              )}
            </div>

            {/* تذييل الـ Modal */}
            <div className="px-6 py-3 border-t border-[#e5e0d8] bg-white flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                Direct client preview mode
              </span>
              <div className="flex items-center gap-2">
                <a 
                  href={selectedCvCreator.cvUrl}
                  download
                  className="px-4 py-2 bg-[#f0eae1] text-[#1c1917] text-xs font-semibold rounded-xl hover:e4dbcd transition"
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