"use client";

import { useEffect, useRef, useState } from "react";
import {
  ALLOWED_EXTENSIONS,
  MAX_DELIVERY_FILE_BYTES,
  MAX_DELIVERY_FILES,
  MAX_DELIVERY_LINKS,
  extensionOf,
  formatBytes,
} from "@/lib/delivery-rules";
import { guessLinkKind, LINK_KIND_OPTIONS, type LinkKind } from "@/components/services/types";

type Props = {
  orderId: string;
  orderNumber: string;
  title: string;
  /** What the client asked to change, when this is a new round after a revision request */
  revisionNote: string | null;
  onClose: () => void;
  onDelivered: () => void;
};

type LinkRow = { key: string; kind: LinkKind; label: string; url: string };

let keyCounter = 0;
const nextKey = () => `d${++keyCounter}`;

const inputClass =
  "w-full h-11 rounded-xl border border-[#D9CFC5] bg-white px-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20";
const textareaClass =
  "w-full rounded-xl border border-[#D9CFC5] bg-white p-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 resize-none";

export default function DeliverModal({ orderId, orderNumber, title, revisionNote, onClose, onDelivered }: Props) {
  const [message, setMessage] = useState("");
  const [accessNote, setAccessNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_DELIVERY_FILES) {
        setError(`You can upload up to ${MAX_DELIVERY_FILES} files. Put the rest in a link.`);
        break;
      }
      if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
        setError(`"${file.name}" is not an allowed file type. Send it as a link instead.`);
        continue;
      }
      if (file.size > MAX_DELIVERY_FILE_BYTES) {
        setError(`"${file.name}" is larger than 25 MB. Upload it to Drive or GitHub and add the link.`);
        continue;
      }
      if (file.size === 0) {
        setError(`"${file.name}" is empty.`);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const updateLink = (key: string, patch: Partial<LinkRow>) =>
    setLinks((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.url !== undefined && next.kind === "other") {
          const guess = guessLinkKind(patch.url);
          if (guess) next.kind = guess;
        }
        return next;
      })
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const filled = links.filter((l) => l.url.trim());
    for (const l of filled) {
      if (!/^https?:\/\/\S+$/i.test(l.url.trim())) {
        return setError(`"${l.url.trim().slice(0, 40)}" is not a valid link (it must start with https://).`);
      }
    }
    if (!message.trim() && files.length === 0 && filled.length === 0) {
      return setError("Add a message, a file or a link to deliver.");
    }

    const form = new FormData();
    form.set("message", message);
    form.set("accessNote", accessNote);
    form.set("links", JSON.stringify(filled.map((l) => ({ kind: l.kind, label: l.label, url: l.url.trim() }))));
    files.forEach((f) => form.append("files", f));

    setSending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/delivery`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not deliver the work.");
        return;
      }
      onDelivered();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !sending && onClose()} />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deliver-title"
        className="relative z-10 w-full max-w-xl max-h-[92dvh] flex flex-col rounded-2xl bg-[#FDFBF7] border border-[#EFE8E1] shadow-2xl text-[#2C221E]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFE8E1] bg-white rounded-t-2xl shrink-0">
          <div>
            <h2 id="deliver-title" className="text-lg font-bold">
              Deliver the work
            </h2>
            <p className="text-xs text-[#7D6E65]">
              {orderNumber} · {title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            className="text-[#7D6E65] hover:text-[#2C221E] text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {revisionNote && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="font-semibold">The client asked for a change:</p>
              <p className="mt-1 whitespace-pre-line">{revisionNote}</p>
            </div>
          )}

          <p className="text-sm text-[#554f49]">
            The client will see everything you add here, and can approve it, ask for a change, or report a problem. Their
            payment is released to you when they approve.
          </p>

          <div>
            <label htmlFor="dv-message" className="block mb-1.5 text-sm font-semibold">
              Message to the client
            </label>
            <textarea
              id="dv-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={3000}
              rows={4}
              placeholder="What is included, how to use it, anything the client should know."
              className={textareaClass}
            />
          </div>

          <div>
            <p className="text-sm font-semibold">Files</p>
            <p className="text-xs text-[#7D6E65] mb-2">
              Up to {MAX_DELIVERY_FILES} files, 25 MB each: zip, rar, 7z, PDF, images, design files (psd, ai, fig, xd),
              documents, video, audio. Bigger work goes in a link below.
            </p>
            {files.length > 0 && (
              <ul className="space-y-2 mb-3">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#E5DCD2] bg-white px-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      {f.name} <span className="text-xs text-[#7D6E65]">({formatBytes(f.size)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileInput}
              id="dv-files"
              type="file"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="hidden"
            />
            <label
              htmlFor="dv-files"
              className={`inline-flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-[#C86C29] px-4 text-sm font-medium text-[#C86C29] hover:bg-[#C86C29]/5 transition ${
                files.length >= MAX_DELIVERY_FILES ? "pointer-events-none opacity-50" : ""
              }`}
            >
              + Add files ({files.length}/{MAX_DELIVERY_FILES})
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold">Links</p>
            <p className="text-xs text-[#7D6E65] mb-2">
              A GitHub repository, a Figma file, a Drive folder, a live website... Up to {MAX_DELIVERY_LINKS}.
            </p>
            <div className="space-y-3">
              {links.map((l) => {
                const option = LINK_KIND_OPTIONS.find((o) => o.kind === l.kind);
                return (
                  <div key={l.key} className="rounded-xl border border-[#E5DCD2] bg-white p-3 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={l.kind}
                        onChange={(e) => updateLink(l.key, { kind: e.target.value as LinkKind })}
                        aria-label="Link type"
                        className="h-10 w-36 shrink-0 rounded-xl border border-[#D9CFC5] bg-white px-2 text-sm outline-none focus:border-[#C86C29]"
                      >
                        {LINK_KIND_OPTIONS.map((o) => (
                          <option key={o.kind} value={o.kind}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={l.url}
                        onChange={(e) => updateLink(l.key, { url: e.target.value })}
                        maxLength={500}
                        inputMode="url"
                        aria-label="Link address"
                        placeholder={option?.placeholder ?? "https://"}
                        className="h-10 min-w-0 flex-1 rounded-xl border border-[#D9CFC5] bg-white px-3 text-sm outline-none focus:border-[#C86C29]"
                      />
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((x) => x.key !== l.key))}
                        aria-label="Remove link"
                        className="h-10 shrink-0 rounded-lg border border-[#D9CFC5] bg-white px-2.5 text-xs font-semibold hover:border-[#C86C29]"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      value={l.label}
                      onChange={(e) => updateLink(l.key, { label: e.target.value })}
                      maxLength={60}
                      aria-label="Link label (optional)"
                      placeholder="Button text (optional), e.g. Source code"
                      className="h-9 w-full rounded-lg border border-[#E5DCD2] bg-[#FDFBF7] px-3 text-xs outline-none focus:border-[#C86C29]"
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setLinks((prev) => [...prev, { key: nextKey(), kind: "other", label: "", url: "" }])}
                disabled={links.length >= MAX_DELIVERY_LINKS}
                className="h-9 rounded-lg border border-[#D9CFC5] bg-white px-3 text-xs font-semibold hover:border-[#C86C29] transition disabled:opacity-40"
              >
                + Add link
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="dv-access" className="block mb-1.5 text-sm font-semibold">
              How to get access <span className="font-normal text-[#7D6E65]">(optional)</span>
            </label>
            <input
              id="dv-access"
              value={accessNote}
              onChange={(e) => setAccessNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. I invited your GitHub account to the private repository"
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EFE8E1] bg-white rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-[#C86C29] transition bg-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition shadow-sm disabled:opacity-60"
          >
            {sending ? "Uploading..." : "Deliver to the client"}
          </button>
        </div>
      </form>
    </div>
  );
}
