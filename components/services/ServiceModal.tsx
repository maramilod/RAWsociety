"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  guessLinkKind,
  LINK_KIND_OPTIONS,
  type Category,
  type LinkKind,
  type Service,
  type ServiceLimits,
} from "./types";

type Props = {
  initial: Service | null; // null = creating a new service
  categories: Category[];
  defaultCategoryId: number | null;
  currency: string;
  hasProfile: boolean;
  limits: ServiceLimits;
  onClose: () => void;
  onSaved: () => void;
};

// One picture in the gallery: either already saved (existingId) or newly chosen (file)
type ImageItem = { key: string; existingId?: string; file?: File; url: string };
type LinkRow = { key: string; kind: LinkKind; label: string; url: string };

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const inputClass =
  "w-full h-11 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 transition";
const textareaClass =
  "w-full rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] p-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 transition resize-none";
const smallButton =
  "px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--ui-input)] bg-[var(--ui-surface)] hover:border-[#C86C29] transition disabled:opacity-40";

let keyCounter = 0;
const nextKey = () => `k${++keyCounter}`;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && <p className="text-xs text-[var(--ui-muted)] mt-0.5 mb-2">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

export default function ServiceModal({
  initial,
  categories,
  defaultCategoryId,
  currency,
  hasProfile,
  limits,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(initial?.categoryId ?? defaultCategoryId ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [deliveryDays, setDeliveryDays] = useState(initial?.deliveryDays ? String(initial.deliveryDays) : "");
  const [revisions, setRevisions] = useState(
    initial?.revisions !== null && initial?.revisions !== undefined ? String(initial.revisions) : ""
  );
  const [requirements, setRequirements] = useState(initial?.requirements ?? "");
  const [deliverables, setDeliverables] = useState<string[]>(initial?.deliverables ?? []);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [links, setLinks] = useState<LinkRow[]>(
    (initial?.links ?? []).map((l) => ({ key: nextKey(), kind: l.kind, label: l.label ?? "", url: l.url }))
  );
  const [images, setImages] = useState<ImageItem[]>(
    (initial?.images ?? []).map((i) => ({ key: nextKey(), existingId: i.id, url: i.url }))
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);
  // Preview addresses made from chosen files must be released when the form goes away
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((i) => i.file && URL.revokeObjectURL(i.url));
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // ---------- images ----------
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError("");
    const room = limits.images - images.length;
    const accepted: ImageItem[] = [];
    for (const file of Array.from(list)) {
      if (!IMAGE_TYPES.includes(file.type)) {
        setError(`"${file.name}" is not a PNG, JPG or WebP image.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`"${file.name}" is larger than 2 MB.`);
        continue;
      }
      if (accepted.length >= room) {
        setError(`You can add up to ${limits.images} images.`);
        break;
      }
      accepted.push({ key: nextKey(), file, url: URL.createObjectURL(file) });
    }
    if (accepted.length) setImages((prev) => [...prev, ...accepted]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const moveImage = (index: number, delta: number) => {
    setImages((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const item = prev[index];
      if (item?.file) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ---------- tags ----------
  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, "").trim();
    if (!tag) return;
    if (tag.length > 30) return setError("A tag can be at most 30 characters.");
    setTags((prev) => {
      if (prev.length >= limits.tags || prev.some((t) => t.toLowerCase() === tag.toLowerCase())) return prev;
      return [...prev, tag];
    });
    setTagInput("");
  };

  // ---------- links ----------
  const updateLink = (key: string, patch: Partial<LinkRow>) =>
    setLinks((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // When the address is typed, pick the matching link type for the creator
        if (patch.url !== undefined && next.kind === "other") {
          const guess = guessLinkKind(patch.url);
          if (guess) next.kind = guess;
        }
        return next;
      })
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Quick checks so the creator gets an answer without a round trip
    if (title.trim().length < 3) return setError("Please enter a title (at least 3 characters).");
    if (categoryId === "") return setError("Please choose a category.");
    if (!(Number(price) >= 1)) return setError(`Please enter a price of at least 1 ${currency}.`);
    const filledLinks = links.filter((l) => l.url.trim());
    for (const l of filledLinks) {
      if (!/^https?:\/\/\S+$/i.test(l.url.trim())) {
        return setError(`"${l.url.trim().slice(0, 40)}" is not a valid link (it must start with https://).`);
      }
    }

    const form = new FormData();
    form.set("title", title);
    form.set("description", description);
    form.set("categoryId", String(categoryId));
    form.set("price", price);
    form.set("deliveryDays", deliveryDays);
    form.set("revisions", revisions);
    form.set("requirements", requirements);
    form.set("isActive", String(isActive));
    tags.forEach((t) => form.append("tags", t));
    deliverables.filter((d) => d.trim()).forEach((d) => form.append("deliverables", d));
    form.set(
      "links",
      JSON.stringify(filledLinks.map((l) => ({ kind: l.kind, label: l.label, url: l.url.trim() })))
    );

    // New files are sent in the order they appear; imageOrder says where every picture belongs
    let newIndex = 0;
    const order: string[] = [];
    for (const img of images) {
      if (img.existingId) {
        order.push(`e:${img.existingId}`);
      } else if (img.file) {
        form.append("images", img.file);
        order.push(`n:${newIndex++}`);
      }
    }
    form.set("imageOrder", JSON.stringify(order));

    setSaving(true);
    try {
      const res = await fetch(initial ? `/api/services/${initial.id}` : "/api/services", {
        method: initial ? "PATCH" : "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the service.");
        return;
      }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />

      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-modal-title"
        className="relative z-10 w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-2xl bg-[var(--ui-bg)] border border-[var(--ui-border)] shadow-2xl text-[var(--ui-text)]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] rounded-t-2xl shrink-0">
          <h2 id="service-modal-title" className="text-lg font-bold">
            {initial ? "Edit service" : "New service"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-[var(--ui-muted)] hover:text-[var(--ui-text)] text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-7 overflow-y-auto">
          {!hasProfile && (
            <p className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              Complete your creator profile first, so clients know who you are.{" "}
              <Link href="/onboarding/creator" className="font-semibold underline">
                Set up profile
              </Link>
            </p>
          )}

          {/* Basics */}
          <Section title="The basics">
            <div className="space-y-4">
              <div>
                <label htmlFor="svc-title" className="block mb-1.5 text-sm font-medium">
                  Title
                </label>
                <input
                  id="svc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={160}
                  placeholder="e.g. Brand identity design"
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="svc-category" className="block mb-1.5 text-sm font-medium">
                  Category
                </label>
                <select
                  id="svc-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputClass}
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="svc-description" className="block mb-1.5 text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="svc-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="What do clients get? What makes your work different?"
                  className={textareaClass}
                />
                <p className="mt-1 text-right text-[11px] text-[var(--ui-muted)]">{description.length}/2000</p>
              </div>
            </div>
          </Section>

          {/* Images */}
          <Section
            title="Images"
            hint={`Show your work. Up to ${limits.images} images (PNG, JPG or WebP, 2 MB each). The first one is the cover.`}
          >
            {images.length > 0 && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {images.map((img, i) => (
                  <li key={img.key} className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] overflow-hidden">
                    <div className="relative aspect-[4/3] bg-[var(--ui-soft)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Service image ${i + 1}`} className="h-full w-full object-cover" />
                      {i === 0 && (
                        <span className="absolute left-2 top-2 rounded-full bg-[#C86C29] px-2 py-0.5 text-[10px] font-semibold text-white">
                          Cover
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 p-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveImage(i, -1)}
                          disabled={i === 0}
                          aria-label="Move image earlier"
                          className={smallButton}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(i, 1)}
                          disabled={i === images.length - 1}
                          aria-label="Move image later"
                          className={smallButton}
                        >
                          →
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className={`${smallButton} text-red-600 dark:text-red-400`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileInput}
              id="svc-images"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <label
              htmlFor="svc-images"
              className={`inline-flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-[#C86C29] px-4 text-sm font-medium text-[#C86C29] hover:bg-[#C86C29]/5 transition ${
                images.length >= limits.images ? "pointer-events-none opacity-50" : ""
              }`}
            >
              + Add images ({images.length}/{limits.images})
            </label>
          </Section>

          {/* Price and delivery */}
          <Section title="Price and delivery">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="svc-price" className="block mb-1.5 text-sm font-medium">
                  Price ({currency})
                </label>
                <input
                  id="svc-price"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="500"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="svc-days" className="block mb-1.5 text-sm font-medium">
                  Delivery (days)
                </label>
                <input
                  id="svc-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  step={1}
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                  placeholder="7"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="svc-revisions" className="block mb-1.5 text-sm font-medium">
                  Revisions
                </label>
                <input
                  id="svc-revisions"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  step={1}
                  value={revisions}
                  onChange={(e) => setRevisions(e.target.value)}
                  placeholder="2"
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          {/* What's included */}
          <Section
            title="What's included"
            hint={`List what the client receives, for example "3 logo concepts" or "Source code on GitHub". Up to ${limits.deliverables}.`}
          >
            <div className="space-y-2">
              {deliverables.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={d}
                    onChange={(e) =>
                      setDeliverables((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                    maxLength={120}
                    aria-label={`Included item ${i + 1}`}
                    placeholder="e.g. Logo in PNG, SVG and PDF"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setDeliverables((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove item"
                    className={`${smallButton} h-11 shrink-0`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDeliverables((prev) => [...prev, ""])}
                disabled={deliverables.length >= limits.deliverables}
                className={`${smallButton} h-9`}
              >
                + Add item
              </button>
            </div>
          </Section>

          {/* Tags */}
          <Section
            title="Skills and tools"
            hint={`Tags clients can search for, like React, Figma or Photoshop. Press Enter to add. Up to ${limits.tags}.`}
          >
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-soft)] pl-3 pr-1.5 py-1 text-xs font-medium"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                      aria-label={`Remove ${t}`}
                      className="h-4 w-4 rounded-full text-[var(--ui-muted)] hover:bg-[var(--ui-border2)] leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              onBlur={() => addTag(tagInput)}
              disabled={tags.length >= limits.tags}
              maxLength={30}
              aria-label="Add a tag"
              placeholder={tags.length >= limits.tags ? "Tag limit reached" : "Type a tag and press Enter"}
              className={inputClass}
            />
          </Section>

          {/* Links */}
          <Section
            title="Links"
            hint={`Point clients to proof of your work: a GitHub repository, a live demo, your Behance, a video... Up to ${limits.links}.`}
          >
            <div className="space-y-3">
              {links.map((l) => {
                const option = LINK_KIND_OPTIONS.find((o) => o.kind === l.kind);
                return (
                  <div key={l.key} className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-3 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={l.kind}
                        onChange={(e) => updateLink(l.key, { kind: e.target.value as LinkKind })}
                        aria-label="Link type"
                        className="h-10 w-40 shrink-0 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-2 text-sm outline-none focus:border-[#C86C29]"
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
                        className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-3 text-sm outline-none focus:border-[#C86C29]"
                      />
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((x) => x.key !== l.key))}
                        aria-label="Remove link"
                        className={`${smallButton} h-10 shrink-0`}
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      value={l.label}
                      onChange={(e) => updateLink(l.key, { label: e.target.value })}
                      maxLength={60}
                      aria-label="Link label (optional)"
                      placeholder="Button text (optional), e.g. See the source code"
                      className="h-9 w-full rounded-lg border border-[var(--ui-border2)] bg-[var(--ui-bg)] px-3 text-xs outline-none focus:border-[#C86C29]"
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  setLinks((prev) => [...prev, { key: nextKey(), kind: "other", label: "", url: "" }])
                }
                disabled={links.length >= limits.links}
                className={`${smallButton} h-9`}
              >
                + Add link
              </button>
            </div>
          </Section>

          {/* Requirements */}
          <Section title="What I need from you" hint="Tell clients what to send you before you start (brief, content, logo, access...).">
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              maxLength={1000}
              rows={3}
              aria-label="What I need from you"
              placeholder="e.g. Your company name, preferred colours and two examples you like."
              className={textareaClass}
            />
          </Section>

          <label className="flex items-center gap-3 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-[#C86C29]"
            />
            <span>
              Show this service on Explore <span className="text-[var(--ui-muted)]">(you can pause it any time)</span>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-[var(--ui-input)] rounded-xl hover:border-[#C86C29] transition bg-[var(--ui-surface)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !hasProfile}
            className="px-5 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition shadow-sm disabled:opacity-60"
          >
            {saving ? "Saving..." : initial ? "Save changes" : "Publish service"}
          </button>
        </div>
      </form>
    </div>
  );
}
