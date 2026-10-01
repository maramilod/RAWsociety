"use client";

import { useState } from "react";
import { formatDelivery, formatPrice, type Service } from "./types";
import RatingLine from "./RatingLine";

type Props = {
  services: Service[];
  loading: boolean;
  loadError: string;
  onNew: () => void;
  onEdit: (service: Service) => void;
  onChanged: () => void;
};

export default function ServicesSection({ services, loading, loadError, onNew, onEdit, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const toggle = async (s: Service) => {
    setActionError("");
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/services/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      setActionError("Could not update the service. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (s: Service) => {
    if (!window.confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    setActionError("");
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/services/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      setActionError("Could not delete the service. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white border border-[#EFE8E1] rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFE8E1] pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold">My Services</h2>
          <p className="text-sm text-[#7D6E65] mt-1">
            What clients can hire you for. Live services appear on Explore and on your profile.
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="px-4 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition shadow-sm self-start sm:self-auto"
        >
          + New Service
        </button>
      </div>

      {actionError && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-600">
          {actionError}
        </p>
      )}

      {loading && <p className="text-sm text-[#7D6E65]">Loading your services...</p>}
      {!loading && loadError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {loadError}
        </p>
      )}

      {!loading && !loadError && services.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-[#7D6E65] mb-4">You haven&apos;t added any services yet.</p>
          <button
            type="button"
            onClick={onNew}
            className="px-5 py-2 text-sm font-medium border border-[#C86C29] text-[#C86C29] rounded-xl hover:bg-[#C86C29] hover:text-white transition"
          >
            Add your first service
          </button>
        </div>
      )}

      {services.length > 0 && (
        <ul className="divide-y divide-[#EFE8E1]">
          {services.map((s) => {
            const delivery = formatDelivery(s.deliveryDays);
            return (
              <li key={s.id} className="py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[#EFE8E1] bg-[#F7F4F0]">
                  {s.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[#7D6E65]">No image</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm truncate">{s.title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        s.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.isActive ? "Live" : "Paused"}
                    </span>
                  </div>
                  <p className="text-xs text-[#7D6E65] mt-1">
                    {s.category}
                    {delivery ? ` · Delivery in ${delivery}` : ""}
                    {s.images.length ? ` · ${s.images.length} image${s.images.length === 1 ? "" : "s"}` : ""}
                    {s.links.length ? ` · ${s.links.length} link${s.links.length === 1 ? "" : "s"}` : ""}
                  </p>
                  <RatingLine rating={s.rating} count={s.reviewsCount} className="mt-1 text-xs" />
                  {s.description && (
                    <p className="text-xs text-[#7D6E65] mt-1 line-clamp-2">{s.description}</p>
                  )}
                </div>

                <div className="font-bold text-sm md:w-32 md:text-right">{formatPrice(s.price, s.currency)}</div>

                <div className="flex items-center gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    disabled={busyId === s.id}
                    className="px-3 py-1.5 rounded-lg border border-[#D9CFC5] hover:border-[#C86C29] transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    disabled={busyId === s.id}
                    className="px-3 py-1.5 rounded-lg border border-[#D9CFC5] hover:border-[#C86C29] transition"
                  >
                    {s.isActive ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    disabled={busyId === s.id}
                    className="px-3 py-1.5 rounded-lg border border-[#D9CFC5] text-red-600 hover:border-red-400 transition"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
