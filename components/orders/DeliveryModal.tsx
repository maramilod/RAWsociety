"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/delivery-rules";
import { linkText, type LinkKind } from "@/components/services/types";
import { sendOrderAction } from "./useOrders";
import ReviewForm from "./ReviewForm";

type DeliveryItem = {
  type: "delivery";
  at: string;
  round: number;
  message: string;
  accessNote: string;
  files: { id: string; name: string; size: number; isImage: boolean }[];
  links: { kind: LinkKind; label: string | null; url: string }[];
};

type NoteItem = {
  type: "note";
  at: string;
  kind: "revision_request" | "dispute" | "dispute_resolution";
  body: string;
  by: "client" | "creator" | "admin";
};

type Data = {
  order: {
    number: string;
    title: string;
    creatorName: string;
    status: string;
    revisionsLeft: number;
    revisionsAllowed: number;
  };
  timeline: (DeliveryItem | NoteItem)[];
};

type Props = {
  orderId: string;
  viewer: "client" | "creator" | "admin";
  onClose: () => void;
  onChanged: () => void;
};

const NOTE_TITLE: Record<NoteItem["kind"], string> = {
  revision_request: "Change requested",
  dispute: "Problem reported",
  dispute_resolution: "Decision by RAW society",
};

const NOTE_STYLE: Record<NoteItem["kind"], string> = {
  revision_request: "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-200",
  dispute: "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-200",
  dispute_resolution: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function DeliveryModal({ orderId, viewer, onClose, onChanged }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [panel, setPanel] = useState<null | "revision" | "dispute">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // after approving, the same window asks for a rating
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/orders/${orderId}/delivery`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(body.error || "Could not load the delivery.");
          setStatus("error");
          return;
        }
        setData(body);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoadError("Network error. Please try again.");
        setStatus("error");
      });
    return () => controller.abort();
  }, [orderId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const canAct = viewer === "client" && data?.order.status === "in_review" && !approved;

  const run = async (action: "approve" | "revision" | "dispute") => {
    setError("");
    if (action === "approve" && !window.confirm("Approve this work? The payment will be released to the creator.")) return;
    setBusy(true);
    const problem = await sendOrderAction(orderId, action, action === "approve" ? undefined : note);
    setBusy(false);
    if (problem) return setError(problem);
    if (action === "approve") return setApproved(true);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !busy && onClose()} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-title"
        className="relative z-10 w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-2xl bg-[var(--ui-bg)] border border-[var(--ui-border)] shadow-2xl text-[var(--ui-text)]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] rounded-t-2xl shrink-0">
          <div>
            <h2 id="delivery-title" className="text-lg font-bold">
              Delivered work
            </h2>
            {data && (
              <p className="text-xs text-[var(--ui-muted)]">
                {data.order.number} · {data.order.title}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="text-[var(--ui-muted)] hover:text-[var(--ui-text)] text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {status === "loading" && <p className="text-sm text-[var(--ui-muted)]">Loading...</p>}
          {status === "error" && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {loadError}
            </p>
          )}

          {status === "ready" && data && data.timeline.length === 0 && (
            <p className="text-sm text-[var(--ui-muted)]">Nothing has been delivered yet.</p>
          )}

          {status === "ready" &&
            data?.timeline.map((item, i) =>
              item.type === "delivery" ? (
                <section key={i} className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">{item.round === 1 ? "Delivery" : `Delivery ${item.round} (after your feedback)`}</h3>
                    <span className="text-xs text-[var(--ui-muted)]">{when(item.at)}</span>
                  </div>

                  {item.message && <p className="text-sm text-[var(--ui-text2)] whitespace-pre-line">{item.message}</p>}

                  {item.accessNote && (
                    <p className="rounded-lg bg-[var(--ui-soft)] px-3 py-2 text-xs text-[var(--ui-text2)]">
                      <span className="font-semibold">How to get access: </span>
                      {item.accessNote}
                    </p>
                  )}

                  {item.files.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--ui-muted)] mb-2">Files</p>
                      <ul className="space-y-2">
                        {item.files.map((f) => (
                          <li key={f.id} className="rounded-xl border border-[var(--ui-border)] p-2">
                            {f.isImage && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/deliveries/files/${f.id}`}
                                alt={f.name}
                                className="mb-2 max-h-56 w-full rounded-lg object-contain bg-[var(--ui-soft)]"
                              />
                            )}
                            <div className="flex items-center justify-between gap-3 px-1">
                              <span className="truncate text-sm">
                                {f.name} <span className="text-xs text-[var(--ui-muted)]">({formatBytes(f.size)})</span>
                              </span>
                              <a
                                href={`/api/deliveries/files/${f.id}?download=1`}
                                className="shrink-0 rounded-lg border border-[var(--ui-input)] px-3 py-1.5 text-xs font-semibold text-[#C86C29] hover:border-[#C86C29] transition"
                              >
                                Download
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.links.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--ui-muted)] mb-2">Links</p>
                      <div className="flex flex-wrap gap-2">
                        {item.links.map((l) => (
                          <a
                            key={l.url}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-semibold hover:border-[#C86C29] hover:text-[#C86C29] transition"
                          >
                            {linkText({ kind: l.kind, label: l.label, url: l.url })}
                            <span aria-hidden="true">↗</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ) : (
                <section key={i} className={`rounded-xl border px-4 py-3 text-sm ${NOTE_STYLE[item.kind]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">
                      {NOTE_TITLE[item.kind]}{" "}
                      <span className="font-normal opacity-75">
                        {item.by === "client" ? "by the client" : item.by === "creator" ? "by the creator" : ""}
                      </span>
                    </p>
                    <span className="text-xs opacity-75">{when(item.at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line">{item.body}</p>
                </section>
              )
            )}

          {approved && data && (
            <div className="rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-4 space-y-4">
              <p className="text-sm font-semibold text-green-900 dark:text-green-200">
                Work approved. The payment is released to {data.order.creatorName}.
              </p>
              <div className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4">
                <ReviewForm
                  orderId={orderId}
                  creatorName={data.order.creatorName}
                  onDone={onChanged}
                  onSkip={onChanged}
                />
              </div>
            </div>
          )}

          {canAct && data && (
            <div className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4 space-y-3">
              <p className="text-sm font-semibold">What do you think of the work?</p>
              <p className="text-xs text-[var(--ui-muted)]">
                If you do nothing, it is approved automatically 5 days after the delivery.
              </p>

              {panel && (
                <div>
                  <label htmlFor="delivery-note" className="block mb-1.5 text-sm font-medium">
                    {panel === "revision" ? "What should the creator change?" : "What is the problem?"}
                  </label>
                  <textarea
                    id="delivery-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder={
                      panel === "revision"
                        ? "Be specific, so the creator can fix it in one go."
                        : "Explain what is wrong. RAW society will review it and decide."
                    }
                    className="w-full rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] p-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 resize-none"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPanel(null);
                        setNote("");
                        setError("");
                      }}
                      className="rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-semibold hover:border-[#C86C29] transition"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(panel)}
                      className="rounded-xl bg-[#C86C29] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B05B1E] transition disabled:opacity-60"
                    >
                      {busy ? "Sending..." : panel === "revision" ? "Send change request" : "Report the problem"}
                    </button>
                  </div>
                </div>
              )}

              {!panel && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run("approve")}
                    className="rounded-xl bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-800 transition disabled:opacity-60"
                  >
                    Approve &amp; release payment
                  </button>
                  <button
                    type="button"
                    disabled={busy || data.order.revisionsLeft === 0}
                    onClick={() => setPanel("revision")}
                    className="rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-semibold hover:border-[#C86C29] transition disabled:opacity-50"
                  >
                    Request a change ({data.order.revisionsLeft} left)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPanel("dispute")}
                    className="rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:border-red-400 transition"
                  >
                    Report a problem
                  </button>
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium border border-[var(--ui-input)] rounded-xl hover:border-[#C86C29] transition bg-[var(--ui-surface)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
