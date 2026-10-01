"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import RatingLine from "./RatingLine";
import {
  formatDelivery,
  formatPrice,
  formatRevisions,
  linkText,
  type Service,
} from "./types";

type Creator = { id: string; name: string; image: string | null; role: string };

type Props = {
  serviceId: string;
  /** Show the "View profile" button (hidden when the window is already on that creator's profile) */
  showProfileLink: boolean;
  onClose: () => void;
};

export default function ServiceDetailModal({ serviceId, showProfileLink, onClose }: Props) {
  const [service, setService] = useState<Service | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [limited, setLimited] = useState(false);
  const [reviews, setReviews] = useState<{ id: string; client: string; rating: number; comment: string }[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [imageIndex, setImageIndex] = useState(0);

  // Booking: idle -> form (write a note) -> sending -> done
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [booking, setBooking] = useState<"idle" | "form" | "sending" | "done">("idle");
  const [note, setNote] = useState("");
  const [bookingError, setBookingError] = useState("");

  const startBooking = () => {
    setBookingError("");
    if (sessionStatus === "loading") return;
    if (sessionStatus !== "authenticated" || !session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }
    if (session.user.role !== "client") {
      setBookingError("Only client accounts can book services.");
      return;
    }
    setBooking("form");
  };

  const sendBooking = async () => {
    setBookingError("");
    setBooking("sending");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBookingError(data.error || "Could not send your request.");
        setBooking("form");
        return;
      }
      setBooking("done");
    } catch {
      setBookingError("Network error. Please try again.");
      setBooking("form");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/services/${encodeURIComponent(serviceId)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        setService(data.service);
        setCreator(data.creator);
        setLimited(!!data.limited);
        setReviews(data.reviews ?? []);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [serviceId]);

  const imageCount = service?.images.length ?? 0;

  // Escape closes, arrow keys browse the gallery
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (imageCount > 1 && e.key === "ArrowRight") setImageIndex((i) => (i + 1) % imageCount);
      if (imageCount > 1 && e.key === "ArrowLeft") setImageIndex((i) => (i - 1 + imageCount) % imageCount);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, imageCount]);

  const delivery = service ? formatDelivery(service.deliveryDays) : null;
  const revisions = service ? formatRevisions(service.revisions) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={service?.title ?? "Service details"}
        className="relative z-10 w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-[var(--ui-bg)] border border-[var(--ui-border2)] shadow-2xl text-[var(--ui-text)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky top-3 float-right mr-3 mt-3 z-20 h-8 w-8 rounded-full bg-[var(--ui-surface)]/90 border border-[var(--ui-border2)] text-[var(--ui-text2)] hover:text-[var(--ui-text)] shadow-sm leading-none"
        >
          ✕
        </button>

        {status === "loading" && <p className="p-10 text-center text-sm text-[var(--ui-muted)]">Loading...</p>}
        {status === "error" && (
          <p role="alert" className="p-10 text-center text-sm font-medium text-red-600 dark:text-red-400">
            This service is no longer available.
          </p>
        )}

        {status === "ready" && service && (
          <div>
            {/* Gallery */}
            {service.images.length > 0 && (
              <div className="bg-[var(--ui-soft)]">
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={service.images[imageIndex].url}
                    alt={`${service.title} - image ${imageIndex + 1}`}
                    className="h-full w-full object-contain bg-black/5"
                  />
                  {service.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setImageIndex((i) => (i - 1 + imageCount) % imageCount)}
                        aria-label="Previous image"
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-[var(--ui-surface)]/90 border border-[var(--ui-border2)] shadow hover:bg-[var(--ui-surface)]"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageIndex((i) => (i + 1) % imageCount)}
                        aria-label="Next image"
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-[var(--ui-surface)]/90 border border-[var(--ui-border2)] shadow hover:bg-[var(--ui-surface)]"
                      >
                        →
                      </button>
                      <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white">
                        {imageIndex + 1} / {imageCount}
                      </span>
                    </>
                  )}
                </div>
                {service.images.length > 1 && (
                  <ul className="flex gap-2 overflow-x-auto p-3">
                    {service.images.map((img, i) => (
                      <li key={img.id} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setImageIndex(i)}
                          aria-label={`Show image ${i + 1}`}
                          className={`block h-14 w-20 overflow-hidden rounded-lg border-2 ${
                            i === imageIndex ? "border-[#c86d38]" : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="p-6 md:p-8 space-y-6">
              <div>
                <span className="inline-block rounded-full bg-[var(--ui-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--ui-text2)] mb-2">
                  {service.category}
                </span>
                <h2 className="text-xl md:text-2xl font-serif font-bold">{service.title}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <span className="text-lg font-bold text-[#c86d38]">
                    {formatPrice(service.price, service.currency)}
                  </span>
                  <RatingLine rating={service.rating} count={service.reviewsCount} className="text-sm" />
                  {delivery && <span className="text-[var(--ui-muted)]">Delivery in {delivery}</span>}
                  {revisions && <span className="text-[var(--ui-muted)]">{revisions}</span>}
                </div>

                {/* Booking */}
                <div className="mt-4">
                  {limited && (
                    <div className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4 text-sm text-[var(--ui-text2)]">
                      <p className="font-semibold text-[var(--ui-text)]">Ordering is part of Business Pro</p>
                      <p className="mt-1 text-xs">
                        The Free plan shows you the offer, not the creator behind it. Upgrade to order services, open creator profiles and message them.
                      </p>
                      <Link
                        href="/onboarding/plan?role=client"
                        className="mt-3 inline-block rounded-lg bg-[#c86d38] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
                      >
                        See plans
                      </Link>
                    </div>
                  )}

                  {!limited && service.monthly?.full && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                      <p className="font-semibold">Full this month</p>
                      <p className="mt-1 text-xs">
                        This service already took {service.monthly.cap} requests this month. It opens again on {new Date(service.monthly.reopensAt).toLocaleDateString([], { month: "long", day: "numeric" })}.
                      </p>
                    </div>
                  )}

                  {!limited && !service.monthly?.full && booking === "idle" && (
                    <button
                      type="button"
                      onClick={startBooking}
                      className="rounded-xl bg-[#c86d38] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                    >
                      Book this service
                    </button>
                  )}

                  {(booking === "form" || booking === "sending") && (
                    <div className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4">
                      <label htmlFor="booking-note" className="block text-sm font-semibold mb-1">
                        Message to {creator?.name ?? "the creator"}{" "}
                        <span className="font-normal text-[var(--ui-muted)]">(optional)</span>
                      </label>
                      <p className="text-xs text-[var(--ui-muted)] mb-2">
                        Describe your project and anything the creator should know. They will review your
                        request and accept or decline it.
                      </p>
                      <textarea
                        id="booking-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={1000}
                        rows={4}
                        placeholder="e.g. I need a logo for my new cafe in Tripoli..."
                        className="w-full resize-none rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] p-3 text-sm text-[var(--ui-text)] outline-none focus:border-[#c86d38] focus:ring-2 focus:ring-[#c86d38]/20"
                      />
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setBooking("idle")}
                          disabled={booking === "sending"}
                          className="rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-semibold text-[var(--ui-text)] hover:border-[#c86d38] transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={sendBooking}
                          disabled={booking === "sending"}
                          className="rounded-xl bg-[#c86d38] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
                        >
                          {booking === "sending" ? "Sending..." : "Send request"}
                        </button>
                      </div>
                    </div>
                  )}

                  {booking === "done" && (
                    <div role="status" className="rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-4 text-sm text-green-900 dark:text-green-200">
                      <p className="font-semibold">Request sent!</p>
                      <p className="mt-1 text-xs">
                        {creator?.name ?? "The creator"} will review it. It shows as{" "}
                        <strong>Pending Approval</strong> in your dashboard until they accept.
                      </p>
                      <Link
                        href="/dashboard/client"
                        className="mt-3 inline-block rounded-lg bg-green-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition"
                      >
                        Go to my dashboard
                      </Link>
                    </div>
                  )}

                  {bookingError && (
                    <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                      {bookingError}{" "}
                      {bookingError.includes("dashboard") && (
                        <Link href="/dashboard/client" className="underline">
                          Open dashboard
                        </Link>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {service.description && (
                <p className="text-sm text-[var(--ui-text2)] leading-relaxed whitespace-pre-line">{service.description}</p>
              )}

              {service.deliverables.length > 0 && (
                <div>
                  <h3 className="font-serif font-bold text-base mb-2">What&apos;s included</h3>
                  <ul className="space-y-1.5">
                    {service.deliverables.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[var(--ui-text2)]">
                        <span className="text-[#c86d38] font-bold" aria-hidden="true">
                          ✓
                        </span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {service.tags.length > 0 && (
                <div>
                  <h3 className="font-serif font-bold text-base mb-2">Skills and tools</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-lg border border-[var(--ui-border2)] bg-[var(--ui-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-text2)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {service.links.length > 0 && (
                <div>
                  <h3 className="font-serif font-bold text-base mb-2">See the work</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.links.map((l) => (
                      <a
                        key={l.id ?? l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-semibold text-[var(--ui-text)] shadow-sm hover:border-[#c86d38] hover:text-[#c86d38] transition"
                      >
                        {linkText(l)}
                        <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {service.requirements && (
                <div className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4">
                  <h3 className="font-serif font-bold text-base mb-1">What I need from you</h3>
                  <p className="text-sm text-[var(--ui-text2)] leading-relaxed whitespace-pre-line">{service.requirements}</p>
                </div>
              )}

              {reviews.length > 0 && (
                <div>
                  <h3 className="font-serif font-bold text-base mb-2">What clients say about this service</h3>
                  <ul className="space-y-3">
                    {reviews.map((r) => (
                      <li key={r.id} className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{r.client}</span>
                          <span className="text-xs text-amber-500" aria-label={`${r.rating} out of 5 stars`}>
                            {"★".repeat(r.rating)}
                            <span className="text-gray-300">{"★".repeat(5 - r.rating)}</span>
                          </span>
                        </div>
                        {r.comment && (
                          <p className="mt-1 text-xs text-[var(--ui-text2)] leading-relaxed whitespace-pre-line">{r.comment}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {creator && (
                <div className="flex items-center justify-between gap-4 border-t border-[var(--ui-border2)] pt-5">
                  <div className="flex items-center gap-3 min-w-0">
                    {creator.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={creator.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#e5d4cb] text-[#3e2723] font-bold flex items-center justify-center">
                        {creator.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{creator.name}</p>
                      <p className="text-xs text-[var(--ui-muted)] truncate">{creator.role}</p>
                    </div>
                  </div>
                  {showProfileLink && (
                    <Link
                      href={`/creators/${creator.id}`}
                      className="shrink-0 rounded-xl bg-[var(--ui-inv-bg)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
                    >
                      View profile
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
