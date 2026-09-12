"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { Anta } from "next/font/google";

const anta = Anta({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "sans-serif"],
});

// بيانات افتراضية للمتخصصين لتغذية صفحة البروفايل ديناميكياً حسب الـ ID
const creatorsData: Record<string, {
  id: number;
  name: string;
  role: string;
  location: string;
  bio: string;
  rating: string;
  reviewsCount: number;
  sales: string;
  followers: string;
  ratePerHour: string;
  projectsCount: number;
  avatarBg: string;
  tagBg: string;
  badge: string;
  cvUrl: string;
  cvType: string;
  works: Array<{ id: string; title: string; category: string; price?: string; likes: number; bgColor: string; shape1: string; shape2: string }>;
  aboutText: string;
}> = {
  "1": {
    id: 1,
    name: "Sahar Talaa",
    role: "Product & Brand Designer",
    location: "Zuwara, Libya",
    bio: "I craft clean, modern brand identities and UI kits for startups. 4+ years designing for SaaS and consumer apps.",
    rating: "4.9",
    reviewsCount: 142,
    sales: "1,240",
    followers: "3.4K",
    ratePerHour: "50 LYD",
    projectsCount: 18,
    avatarBg: "bg-[#e5d4cb] text-[#3e2723]",
    tagBg: "bg-rose-100 text-rose-700",
    badge: "Top Rated",
    cvUrl: "/files/sahar-talaa-cv.pdf",
    cvType: "pdf",
    aboutText: "Passionate brand designer and frontend enthusiast. Specializing in creating intuitive user experiences, design systems, and digital art direction.",
    works: [
      { id: "w1", title: "Minimalist UI Kit — Figma", category: "UI/UX", price: "$49", likes: 120, bgColor: "bg-[#e2ddd8]", shape1: "bg-[#c86d38]", shape2: "bg-[#3e2723]" },
      { id: "w2", title: "Brand Identity Template Pack", category: "Branding", price: "$35", likes: 85, bgColor: "bg-[#eef2f6]", shape1: "bg-blue-400", shape2: "bg-indigo-900" },
      { id: "w3", title: "SaaS Landing Page Kit", category: "Web Template", price: "$59", likes: 210, bgColor: "bg-[#faf9f6]", shape1: "bg-emerald-500", shape2: "bg-stone-800" },
      { id: "w4", title: "Icon Set — 200+ Icons", category: "Icons", price: "$19", likes: 94, bgColor: "bg-[#ede9fe]", shape1: "bg-purple-400", shape2: "bg-purple-900" },
    ]
  },
  "2": {
    id: 2,
    name: "Sara M.",
    role: "Photographer",
    location: "Tripoli, Libya",
    bio: "Editorial & product photography specializing in lifestyle and desert aesthetics.",
    rating: "4.9",
    reviewsCount: 112,
    sales: "890",
    followers: "1.2K",
    ratePerHour: "60 LYD",
    projectsCount: 24,
    avatarBg: "bg-amber-700 text-white",
    tagBg: "bg-amber-100 text-amber-800",
    badge: "Featured",
    cvUrl: "/files/sara-m-cv.docx",
    cvType: "docx",
    aboutText: "Professional photographer capturing raw stories through the lens. Experience in commercial product shoots and architectural framing.",
    works: [
      { id: "m1", title: "Old Tripoli in Frames", category: "Photography", likes: 342, bgColor: "bg-[#210e0b]", shape1: "bg-[#e8e3de]", shape2: "bg-[#c86d38]" },
      { id: "m2", title: "Sahara at Dawn", category: "Editorial", likes: 289, bgColor: "bg-[#f5efe6]", shape1: "bg-[#c86d38]", shape2: "bg-[#3e2723]" },
    ]
  },
  "3": {
    id: 3,
    name: "Priya Nair",
    role: "Video Editor",
    location: "Dubai, UAE",
    bio: "Short-form video creator & reels master for global brands.",
    rating: "5.0",
    reviewsCount: 98,
    sales: "1,500",
    followers: "5.1K",
    ratePerHour: "75 LYD",
    projectsCount: 30,
    avatarBg: "bg-rose-500 text-white",
    tagBg: "bg-rose-100 text-rose-700",
    badge: "Top Rated",
    cvUrl: "/files/priya-cv.pdf",
    cvType: "pdf",
    aboutText: "Dynamic video editor with a passion for high-retention storytelling on TikTok, Instagram Reels, and YouTube Shorts.",
    works: [
      { id: "p1", title: "Cinematic Travel Reels Pack", category: "Video", price: "$40", likes: 410, bgColor: "bg-rose-50", shape1: "bg-rose-400", shape2: "bg-rose-900" }
    ]
  },
  "4": {
    id: 4,
    name: "Jonas Weber",
    role: "Developer",
    location: "Berlin, Germany",
    bio: "Full-stack web & app developer building scalable digital products.",
    rating: "4.7",
    reviewsCount: 104,
    sales: "650",
    followers: "2.8K",
    ratePerHour: "80 LYD",
    projectsCount: 15,
    avatarBg: "bg-blue-600 text-white",
    tagBg: "bg-blue-100 text-blue-700",
    badge: "Pro",
    cvUrl: "/files/jonas-cv.pdf",
    cvType: "pdf",
    aboutText: "Software engineer focused on React, Next.js, and high-performance backend architectures.",
    works: [
      { id: "j1", title: "E-Commerce SaaS Boilerplate", category: "Development", price: "$129", likes: 190, bgColor: "bg-blue-50", shape1: "bg-blue-500", shape2: "bg-slate-900" }
    ]
  }
};

export default function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const creatorId = resolvedParams.id;
  
  // جلب بيانات الكريتور أو استخدام الكريتور الأول كافتراضي في حال لم يوجد
  const creator = creatorsData[creatorId] || creatorsData["1"];

  const [activeTab, setActiveTab] = useState("work"); // work | about | reviews
  const [isCvModalOpen, setIsCvModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased pb-20">
      
      {/* 1. Header Navigation */}
      <header className="border-b border-[#e5e0d8] bg-[var(--background)] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link 
            href="/" 
            className={`${anta.className} text-3xl leading-6 tracking-wide`} 
            style={{ opacity: 0.2 }}
          >
            <div>RAW</div>
            <div>society</div>
          </Link>

          <Link
            href="/explore"
            className="text-xs font-semibold px-4 py-2 bg-[#1c1917] text-white rounded-full hover:opacity-90 transition"
          >
            Back to Explore
          </Link>
        </div>
      </header>

      {/* 2. Cover Banner */}
      <div className="w-full h-40 sm:h-52 bg-[#f3ede2] border-b border-[#e5e0d8] relative overflow-hidden flex items-center justify-between px-6">
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#c86d38]/20 rounded-2xl transform rotate-12 blur-sm" />
        <div className="absolute right-10 top-5 w-32 h-32 bg-[#3e2723]/10 rounded-full blur-sm" />
      </div>

      {/* 3. Profile Info Section */}
      <div className="max-w-5xl mx-auto px-4 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between -mt-12 sm:-mt-14 mb-8 gap-4">
          
          {/* الصورة والبيانات الأساسية */}
          <div className="flex items-end gap-4">
            <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl ${creator.avatarBg} border-4 border-white shadow-md flex items-center justify-center font-bold text-2xl sm:text-3xl uppercase shrink-0`}>
              {creator.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#1c1917]">{creator.name}</h1>
                <span className="px-2 py-0.5 bg-[#fce7f3] text-rose-700 text-[10px] font-semibold rounded-full border border-rose-200">
                  {creator.badge}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#68625d] mt-0.5 font-medium">
                {creator.role} · {creator.location}
              </p>
              <p className="text-xs text-[#c86d38] font-semibold mt-1">
                From {creator.ratePerHour}
              </p>
            </div>
          </div>

          {/* الإحصائيات الأفقية على اللابتوب */}
          <div className="hidden lg:flex items-center gap-6 text-xs font-semibold text-[#44403c] bg-white border border-[#e5e0d8] px-5 py-3 rounded-2xl shadow-sm">
            <div>
              <span className="text-black font-bold block text-sm">{creator.rating} ★</span>
              <span className="text-[10px] text-gray-400 font-normal">Rating</span>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div>
              <span className="text-black font-bold block text-sm">{creator.sales}</span>
              <span className="text-[10px] text-gray-400 font-normal">Sales</span>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div>
              <span className="text-black font-bold block text-sm">{creator.followers}</span>
              <span className="text-[10px] text-gray-400 font-normal">Followers</span>
            </div>
          </div>

          {/* أزرار التفاعل (Hire / Message / CV) */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button 
              onClick={() => setIsCvModalOpen(true)}
              className="flex-1 md:flex-initial px-4 py-2.5 bg-[#c86d38] text-white text-xs font-semibold rounded-xl hover:opacity-95 transition shadow-sm text-center"
            >
              View CV
            </button>
            <button className="flex-1 md:flex-initial px-4 py-2.5 bg-[#3e2723] text-white text-xs font-semibold rounded-xl hover:opacity-90 transition shadow-sm text-center">
              Hire me
            </button>
            <button className="px-4 py-2.5 bg-white border border-[#e5e0d8] text-[#1c1917] text-xs font-semibold rounded-xl hover:bg-gray-50 transition shadow-sm">
              Message
            </button>
          </div>

        </div>

        {/* إحصائيات الموبايل المصغرة */}
        <div className="flex lg:hidden items-center justify-around bg-white border border-[#e5e0d8] p-3 rounded-2xl mb-6 text-center text-xs shadow-sm">
          <div>
            <span className="font-bold text-black">{creator.rating} ★</span>
            <p className="text-[10px] text-gray-400">Rating</p>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <span className="font-bold text-black">{creator.sales}</span>
            <p className="text-[10px] text-gray-400">Sales</p>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <span className="font-bold text-black">{creator.followers}</span>
            <p className="text-[10px] text-gray-400">Followers</p>
          </div>
        </div>

        {/* نبذة تعريفية قصيرة تحت الهيدر */}
        <p className="text-xs sm:text-sm text-[#554f49] max-w-2xl mb-8 leading-relaxed">
          {creator.bio}
        </p>

        {/* 4. Tabs Navigation (Shop / Work, About, Reviews) */}
        <div className="border-b border-[#e5e0d8] flex gap-8 mb-8 text-sm font-medium">
          <button
            onClick={() => setActiveTab("work")}
            className={`pb-3 border-b-2 transition ${
              activeTab === "work"
                ? "border-[#1c1917] text-[#1c1917] font-bold"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            Shop ({creator.works.length})
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`pb-3 border-b-2 transition ${
              activeTab === "about"
                ? "border-[#1c1917] text-[#1c1917] font-bold"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`pb-3 border-b-2 transition ${
              activeTab === "reviews"
                ? "border-[#1c1917] text-[#1c1917] font-bold"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            Reviews ({creator.reviewsCount})
          </button>
        </div>

        {/* 5. Tab Content */}
        {activeTab === "work" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {creator.works.map((work) => (
              <div key={work.id} className="bg-white rounded-2xl border border-[#e5e0d8] overflow-hidden shadow-sm hover:shadow-md transition">
                <div className={`h-48 ${work.bgColor} p-6 relative flex items-center justify-between`}>
                  <div className={`w-20 h-20 ${work.shape1} rounded-xl transform -rotate-6 shadow-sm`} />
                  <div className={`w-16 h-16 ${work.shape2} rounded-full shadow-sm`} />
                </div>
                <div className="p-4 border-t border-[#f0eae1] flex items-center justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 mb-1">
                      {work.category}
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-[#1c1917]">{work.title}</h3>
                    <p className="text-xs font-semibold text-[#c86d38] mt-1">{work.price || "Free"}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">❤️ {work.likes}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "about" && (
          <div className="bg-white border border-[#e5e0d8] rounded-2xl p-6 shadow-sm max-w-2xl">
            <h3 className="font-serif font-bold text-base mb-3 text-[#1c1917]">Biography</h3>
            <p className="text-sm text-[#68625d] leading-relaxed mb-6">
              {creator.aboutText}
            </p>
            <h3 className="font-serif font-bold text-base mb-2 text-[#1c1917]">Specializations & Skills</h3>
            <div className="flex flex-wrap gap-2">
              {["Brand Identity", "UI/UX Design", "Figma", "Design Systems", "Typography"].map((skill, idx) => (
                <span key={idx} className="px-3 py-1 bg-[#f9f6f0] border border-[#e5e0d8] rounded-lg text-xs font-medium text-[#44403c]">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-4 max-w-2xl">
            {[1, 2].map((_, i) => (
              <div key={i} className="bg-white border border-[#e5e0d8] p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-[#1c1917]">Verified Client #{i + 1}</span>
                  <span className="text-amber-500 text-xs font-semibold">★★★★★</span>
                </div>
                <p className="text-xs text-[#68625d] leading-relaxed">
                  Outstanding quality of work and very professional communication. Delivered the project ahead of schedule!
                </p>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* 6. CV Modal Popup (نافذة عرض السيرة الذاتية) */}
      {isCvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsCvModalOpen(false)}
          />

          <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-[#e5e0d8] flex items-center justify-between bg-[#f9f6f0]">
              <div>
                <h3 className="font-serif font-bold text-base text-[#1c1917]">
                  {creator.name} — Curriculum Vitae
                </h3>
                <p className="text-xs text-gray-500">
                  {creator.role} · Format: {creator.cvType.toUpperCase()}
                </p>
              </div>
              <button 
                onClick={() => setIsCvModalOpen(false)}
                className="p-2 text-gray-400 hover:text-[#1c1917] rounded-full transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 bg-[#f0eae1] p-4 flex items-center justify-center min-h-[400px] overflow-y-auto">
              {creator.cvType === "pdf" ? (
                <iframe 
                  src={`${creator.cvUrl}#view=FitH`} 
                  className="w-full h-[500px] rounded-lg border border-[#d8d0c5] bg-white shadow-inner"
                  title="CV Preview"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-xl border border-[#d8d0c5] shadow-sm max-w-md w-full">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center mx-auto mb-3 text-sm">
                    DOC
                  </div>
                  <h4 className="font-bold text-sm text-[#1c1917] mb-1">Word Document File</h4>
                  <p className="text-xs text-gray-500 mb-4">
                    This CV is available as a Word document format. Download to inspect details.
                  </p>
                  <a 
                    href={creator.cvUrl} 
                    download 
                    className="inline-block px-4 py-2 bg-[#1c1917] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition shadow-sm"
                  >
                    Download & View File
                  </a>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-[#e5e0d8] bg-white flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Direct client preview mode</span>
              <div className="flex items-center gap-2">
                <a 
                  href={creator.cvUrl}
                  download
                  className="px-4 py-2 bg-[#f0eae1] text-[#1c1917] text-xs font-semibold rounded-xl hover:bg-[#e4dbcd] transition"
                >
                  Download CV
                </a>
                <button 
                  onClick={() => setIsCvModalOpen(false)}
                  className="px-4 py-2 bg-[#c86d38] text-white text-xs font-semibold rounded-xl hover:opacity-90 transition"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}