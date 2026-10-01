"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Anta } from "next/font/google";
import Messenger, { openChat } from "@/components/Messenger";
import { formatDelivery, formatPrice } from "@/components/services/types";
import ServiceDetailModal from "@/components/services/ServiceDetailModal";
import RatingLine from "@/components/services/RatingLine";
import UserMenu from "@/components/UserMenu";
import HireModal from "@/components/hire/HireModal";

const anta = Anta({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "sans-serif"],
});

type ServiceItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  deliveryDays: number | null;
  tags: string[];
  coverUrl: string | null;
  rating: number | null;
  reviewsCount: number;
};

type Work = {
  id: string;
  title: string;
  category: string | null;
  price: string | null;
  likes: number;
  coverUrl: string | null;
};

type Review = {
  id: string;
  client: string;
  service: string | null; // the service the review is about
  rating: number;
  comment: string;
  date: string;
};

type Creator = {
  id: string;
  name: string;
  role: string;
  bio: string;
  about: string;
  location: string | null;
  rate: string | null;
  badge: string | null;
  rating: string;
  reviewsCount: number;
  projects: number;
  followers: number;
  avatarUrl: string | null;
  coverUrl: string | null;
  cvUrl: string | null;
  links: string[];
  services: ServiceItem[];
  works: Work[];
  reviews: Review[];
};

// ألوان ثابتة لكل منشئ حسب الـ id
const AVATAR_COLORS = [
  "bg-[#e5d4cb] text-[#3e2723]",
  "bg-amber-700 text-white",
  "bg-rose-500 text-white",
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
];

function avatarColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function linkLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Header() {
  return (
    <header className="border-b border-[var(--border-default)] bg-[var(--page-bg)] sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link
          href="/"
          className={`${anta.className} text-3xl leading-6 tracking-wide`}
          style={{ opacity: 0.2 }}
        >
          <div>RAW</div>
          <div>society</div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/explore"
            className="text-xs font-semibold px-4 py-2 bg-[#1c1917] text-white rounded-full hover:opacity-90 transition"
          >
            Back to Explore
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export default function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: creatorId } = use(params);

  const [creator, setCreator] = useState<Creator | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [activeTab, setActiveTab] = useState("work"); // work | about | reviews
  const [isCvModalOpen, setIsCvModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageNotice, setMessageNotice] = useState("");
  const [hireOpen, setHireOpen] = useState(false);

  // زر Message: يبدأ محادثة مع المنشئ ويفتح صندوق الرسائل
  const handleMessage = async () => {
    setMessageNotice("");
    if (sessionStatus !== "authenticated" || !session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/creators/${creatorId}`)}`);
      return;
    }
    if (session.user.role !== "client") {
      setMessageNotice("Only client accounts can message creators.");
      return;
    }
    setMessageBusy(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessageNotice(data.error || "Could not start the conversation.");
        return;
      }
      openChat(data.id);
    } catch {
      setMessageNotice("Network error. Please try again.");
    } finally {
      setMessageBusy(false);
    }
  };

  // زر Hire me: يفتح نموذج طلب خدمة مخصصة
  const handleHire = () => {
    setMessageNotice("");
    if (sessionStatus !== "authenticated" || !session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/creators/${creatorId}`)}`);
      return;
    }
    if (session.user.role !== "client") {
      setMessageNotice("Only client accounts can hire creators.");
      return;
    }
    setHireOpen(true);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/creators/${encodeURIComponent(creatorId)}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setStatus("notfound");
          return;
        }
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        setCreator(data.creator);
        // Services are what a visitor can hire, so show them first when there are any
        if (data.creator.services.length > 0) setActiveTab("services");
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [creatorId]);

  if (status !== "ready" || !creator) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased">
        <Header />
        <div className="max-w-5xl mx-auto px-4 py-24 text-center">
          {status === "loading" && <p className="text-sm text-[#68625d]">Loading profile...</p>}
          {status === "notfound" && (
            <>
              <h1 className="text-xl font-serif font-bold text-[#1c1917] mb-2">Creator not found</h1>
              <p className="text-sm text-[#68625d] mb-6">
                This profile doesn&apos;t exist or is no longer public.
              </p>
              <Link
                href="/explore"
                className="text-xs font-semibold px-4 py-2 bg-[#c86d38] text-white rounded-full hover:opacity-90 transition"
              >
                Browse creators
              </Link>
            </>
          )}
          {status === "error" && (
            <p role="alert" className="text-sm font-medium text-red-600">
              Could not load this profile. Please try again.
            </p>
          )}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Rating", value: `${creator.rating} ★` },
    { label: "Projects", value: String(creator.projects) },
    { label: "Followers", value: String(creator.followers) },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased pb-20">

      {/* 1. Header Navigation */}
      <Header />

      {/* 2. Cover Banner */}
      {creator.coverUrl ? (
        <div className="w-full h-40 sm:h-52 border-b border-[#e5e0d8] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creator.coverUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-40 sm:h-52 bg-[#f3ede2] border-b border-[#e5e0d8] relative overflow-hidden flex items-center justify-between px-6">
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#c86d38]/20 rounded-2xl transform rotate-12 blur-sm" />
          <div className="absolute right-10 top-5 w-32 h-32 bg-[#3e2723]/10 rounded-full blur-sm" />
        </div>
      )}

      {/* 3. Profile Info Section */}
      <div className="max-w-5xl mx-auto px-4 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between -mt-12 sm:-mt-14 mb-8 gap-4">

          {/* الصورة والبيانات الأساسية */}
          <div className="flex items-end gap-4">
            {creator.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={creator.avatarUrl}
                alt={creator.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white shadow-md object-cover shrink-0 bg-white"
              />
            ) : (
              <div
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl ${avatarColor(creator.id)} border-4 border-white shadow-md flex items-center justify-center font-bold text-2xl sm:text-3xl uppercase shrink-0`}
              >
                {initials(creator.name)}
              </div>
            )}
            <div className="pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#1c1917]">{creator.name}</h1>
                {creator.badge && (
                  <span className="px-2 py-0.5 bg-[#fce7f3] text-rose-700 text-[10px] font-semibold rounded-full border border-rose-200">
                    {creator.badge}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#68625d] mt-0.5 font-medium">
                {creator.role}
                {creator.location ? ` · ${creator.location}` : ""}
              </p>
              {creator.rate && (
                <p className="text-xs text-[#c86d38] font-semibold mt-1">From {creator.rate} / hour</p>
              )}
            </div>
          </div>

          {/* الإحصائيات الأفقية على اللابتوب */}
          <div className="hidden lg:flex items-center gap-6 text-xs font-semibold text-[#44403c] bg-white border border-[#e5e0d8] px-5 py-3 rounded-2xl shadow-sm">
            {stats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div className="w-px h-6 bg-gray-200" />}
                <div>
                  <span className="text-black font-bold block text-sm">{s.value}</span>
                  <span className="text-[10px] text-gray-400 font-normal">{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* أزرار التفاعل (Hire / Message / CV) */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {creator.cvUrl && (
              <button
                onClick={() => setIsCvModalOpen(true)}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-[#c86d38] text-white text-xs font-semibold rounded-xl hover:opacity-95 transition shadow-sm text-center"
              >
                View CV
              </button>
            )}
            <button
              onClick={handleHire}
              className="flex-1 md:flex-initial px-4 py-2.5 bg-[#3e2723] text-white text-xs font-semibold rounded-xl hover:opacity-90 transition shadow-sm text-center">
              Hire me
            </button>
            <button
              onClick={handleMessage}
              disabled={messageBusy}
              className="px-4 py-2.5 bg-white border border-[#e5e0d8] text-[#1c1917] text-xs font-semibold rounded-xl hover:bg-gray-50 transition shadow-sm disabled:opacity-60"
            >
              {messageBusy ? "Opening..." : "Message"}
            </button>
          </div>

        </div>

        {messageNotice && (
          <p role="alert" className="-mt-4 mb-6 text-xs font-medium text-red-600">
            {messageNotice}
          </p>
        )}

        {/* إحصائيات الموبايل المصغرة */}
        <div className="flex lg:hidden items-center justify-around bg-white border border-[#e5e0d8] p-3 rounded-2xl mb-6 text-center text-xs shadow-sm">
          {stats.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className="w-px h-5 bg-gray-200" />}
              <div>
                <span className="font-bold text-black">{s.value}</span>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* نبذة تعريفية قصيرة تحت الهيدر */}
        {creator.bio && (
          <p className="text-xs sm:text-sm text-[#554f49] max-w-2xl mb-8 leading-relaxed whitespace-pre-line">
            {creator.bio}
          </p>
        )}

        {/* 4. Tabs Navigation (Shop / Work, About, Reviews) */}
        <div className="border-b border-[#e5e0d8] flex gap-8 mb-8 text-sm font-medium">
          {[
            { key: "services", label: `Services (${creator.services.length})` },
            { key: "work", label: `Shop (${creator.works.length})` },
            { key: "about", label: "About" },
            { key: "reviews", label: `Reviews (${creator.reviewsCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 border-b-2 transition ${
                activeTab === tab.key
                  ? "border-[#1c1917] text-[#1c1917] font-bold"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 5. Tab Content */}
        {activeTab === "services" && (
          creator.services.length === 0 ? (
            <p className="text-sm text-[#68625d]">{creator.name} hasn&apos;t published any services yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
              {creator.services.map((service) => {
                const delivery = formatDelivery(service.deliveryDays);
                return (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => setSelectedServiceId(service.id)}
                    className="group text-left bg-white border border-[#e5e0d8] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#c86d38] transition flex flex-col overflow-hidden"
                  >
                    {service.coverUrl && (
                      <div className="-mx-5 -mt-5 mb-4 h-40 overflow-hidden bg-[#f0eae1]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={service.coverUrl}
                          alt=""
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    )}
                    <span className="self-start px-2.5 py-0.5 rounded-full bg-[#f0eae1] text-[10px] font-semibold text-[#44403c] mb-3">
                      {service.category}
                    </span>
                    <h3 className="font-bold text-sm text-[#1c1917] mb-1 group-hover:text-[#c86d38] transition">
                      {service.title}
                    </h3>
                    <RatingLine rating={service.rating} count={service.reviewsCount} className="text-xs mb-2" />
                    {service.description && (
                      <p className="text-xs text-[#68625d] leading-relaxed line-clamp-3 mb-3">
                        {service.description}
                      </p>
                    )}
                    {service.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {service.tags.slice(0, 4).map((t) => (
                          <span key={t} className="rounded-md bg-[#f9f6f0] border border-[#e5e0d8] px-2 py-0.5 text-[10px] font-medium text-[#44403c]">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-auto pt-3 border-t border-[#f0eae1] flex items-center justify-between">
                      <span className="text-sm font-bold text-[#c86d38]">
                        {formatPrice(service.price, service.currency)}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {delivery ? `Delivery in ${delivery} · ` : ""}View &amp; book
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {activeTab === "work" && (
          creator.works.length === 0 ? (
            <p className="text-sm text-[#68625d]">{creator.name} hasn&apos;t added any work yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {creator.works.map((work) => (
                <div key={work.id} className="bg-white rounded-2xl border border-[#e5e0d8] overflow-hidden shadow-sm hover:shadow-md transition">
                  {work.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={work.coverUrl} alt={work.title} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="h-48 bg-[#f5efe6] p-6 relative flex items-center justify-between">
                      <div className="w-20 h-20 bg-[#c86d38] rounded-xl transform -rotate-6 shadow-sm" />
                      <div className="w-16 h-16 bg-[#3e2723] rounded-full shadow-sm" />
                    </div>
                  )}
                  <div className="p-4 border-t border-[#f0eae1] flex items-center justify-between">
                    <div>
                      {work.category && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 mb-1">
                          {work.category}
                        </span>
                      )}
                      <h3 className="font-bold text-xs sm:text-sm text-[#1c1917]">{work.title}</h3>
                      <p className="text-xs font-semibold text-[#c86d38] mt-1">{work.price || "Free"}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium">♥ {work.likes}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "about" && (
          <div className="bg-white border border-[#e5e0d8] rounded-2xl p-6 shadow-sm max-w-2xl">
            <h3 className="font-serif font-bold text-base mb-3 text-[#1c1917]">Biography</h3>
            <p className="text-sm text-[#68625d] leading-relaxed mb-6 whitespace-pre-line">
              {creator.about || "This creator hasn't written a biography yet."}
            </p>
            <h3 className="font-serif font-bold text-base mb-2 text-[#1c1917]">Specialty</h3>
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-3 py-1 bg-[#f9f6f0] border border-[#e5e0d8] rounded-lg text-xs font-medium text-[#44403c]">
                {creator.role}
              </span>
            </div>
            {creator.links.length > 0 && (
              <>
                <h3 className="font-serif font-bold text-base mb-2 text-[#1c1917]">Portfolio links</h3>
                <ul className="space-y-1">
                  {creator.links.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-sm font-medium text-[#c86d38] hover:underline break-all"
                      >
                        {linkLabel(url)}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          creator.reviews.length === 0 ? (
            <p className="text-sm text-[#68625d]">No reviews yet.</p>
          ) : (
            <div className="space-y-4 max-w-2xl">
              {creator.reviews.map((r) => (
                <div key={r.id} className="bg-white border border-[#e5e0d8] p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-[#1c1917]">{r.client}</span>
                      {r.service && (
                        <span className="ml-2 inline-block rounded-full bg-[#f0eae1] px-2 py-0.5 text-[10px] font-semibold text-[#44403c]">
                          {r.service}
                        </span>
                      )}
                    </div>
                    <span className="text-amber-500 text-xs font-semibold" aria-label={`${r.rating} out of 5`}>
                      {"★".repeat(r.rating)}
                      <span className="text-gray-300">{"★".repeat(5 - r.rating)}</span>
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-[#68625d] leading-relaxed whitespace-pre-line">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )
        )}

      </div>

      {selectedServiceId && (
        <ServiceDetailModal
          serviceId={selectedServiceId}
          showProfileLink={false}
          onClose={() => setSelectedServiceId(null)}
        />
      )}

      {hireOpen && (
        <HireModal
          creator={{
            id: creator.id,
            name: creator.name,
            category: creator.role,
            services: creator.services,
          }}
          onClose={() => setHireOpen(false)}
        />
      )}

      {/* Messenger (يظهر للمستخدم المسجل فقط) */}
      <Messenger />

      {/* 6. CV Modal Popup (نافذة عرض السيرة الذاتية) */}
      {isCvModalOpen && creator.cvUrl && (
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
                <p className="text-xs text-gray-500">{creator.role} · Format: PDF</p>
              </div>
              <button
                onClick={() => setIsCvModalOpen(false)}
                className="p-2 text-gray-400 hover:text-[#1c1917] rounded-full transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 bg-[#f0eae1] p-4 flex items-center justify-center min-h-[400px] overflow-y-auto">
              <iframe
                src={`${creator.cvUrl}#view=FitH`}
                className="w-full h-[500px] rounded-lg border border-[#d8d0c5] bg-white shadow-inner"
                title="CV Preview"
              />
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
