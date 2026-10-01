"use client";

import { useEffect, useRef, useState } from "react";
import { LINK_KIND_OPTIONS, guessLinkKind, type LinkKind } from "@/components/services/types";
import { MAX_REQUEST_FILE_BYTES, fieldsFor, type FieldValue } from "@/components/hire/fields";
import { Label, SpecField, inputClass, smallButton, textareaClass } from "@/components/hire/SpecField";
import { MAX_JOB_FILES, MAX_JOB_LINKS } from "@/lib/plan-rules";

type Props = {
  categories: { id: number; name: string }[];
  onClose: () => void;
  onPosted: () => void;
};

type Budget = "fixed" | "range" | "quote";

export default function PostJobModal({ categories, onClose, onPosted }: Props) {
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [brief, setBrief] = useState("");
  const [details, setDetails] = useState<Record<string, FieldValue>>({});
  const [budget, setBudget] = useState<Budget>("fixed");
  const [amount, setAmount] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [deadline, setDeadline] = useState("");
  const [links, setLinks] = useState<{ kind: LinkKind; url: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const fileInput = useRef<HTMLInputElement>(null);

  const category = categories.find((c) => String(c.id) === categoryId);
  const specs = category ? fieldsFor(category.name) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_JOB_FILES) return setError(`You can attach up to ${MAX_JOB_FILES} files. Put the rest in a link.`);
      if (f.size > MAX_REQUEST_FILE_BYTES) {
        setError(`"${f.name}" is larger than 10 MB. Add it as a link instead.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!category) return setError("Please choose the category of the work.");
    if (title.trim().length < 5) return setError("Give the job a title (at least 5 characters).");
    if (summary.trim().length < 30) return setError("Describe the job in a few sentences (at least 30 characters).");
    for (const spec of specs) {
      const v = details[spec.key];
      if (spec.required && (v === undefined || v === "" || (Array.isArray(v) && v.length === 0))) return setError(`Please answer: ${spec.label}`);
    }
    if (budget !== "quote" && !(Number(amount) >= 1)) return setError("Enter the budget, at least 1 LYD.");
    if (budget === "range" && !(Number(amountMax) >= Number(amount))) return setError("The highest price must be equal to or more than the lowest.");

    const payload = {
      categoryId: category.id,
      title: title.trim(),
      summary: summary.trim(),
      brief: brief.trim(),
      details,
      links: links.filter((l) => l.url.trim()).map((l) => ({ kind: l.kind, label: null, url: l.url.trim() })),
      budget: { type: budget, amount: budget === "quote" ? null : Number(amount), amountMax: budget === "range" ? Number(amountMax) : null },
      deadline: deadline || null,
    };
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    files.forEach((f) => form.append("files", f));

    setBusy(true);
    try {
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Could not post your job.");
      onPosted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-title"
        className="relative z-10 flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between rounded-t-2xl border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 py-4">
          <div>
            <h2 id="job-title" className="text-lg font-bold">
              Post a job
            </h2>
            <p className="text-xs text-[var(--ui-muted)]">Creators of this specialty can read it and send you offers.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="text-lg leading-none text-[var(--ui-muted)] hover:text-[var(--ui-text)]">
            ✕
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <div className="max-w-sm">
            <Label htmlFor="j-cat">Category of the work</Label>
            <select
              id="j-cat"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setDetails({});
              }}
              className={inputClass}
            >
              <option value="">Select...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="j-title">Job title</Label>
            <input id="j-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Logo and colours for a new bakery" className={inputClass} />
          </div>
          <div>
            <Label htmlFor="j-summary">What do you need?</Label>
            <textarea id="j-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={1500} rows={4} placeholder="Explain the work: what it is, who it is for and what a great result looks like." className={textareaClass} />
          </div>
          <div>
            <Label htmlFor="j-brief" optional>
              Detailed brief
            </Label>
            <textarea id="j-brief" value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={5000} rows={3} className={textareaClass} />
          </div>

          {specs.length > 0 && (
            <section className="space-y-5 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4">
              <h3 className="text-sm font-bold">About the work</h3>
              {specs.map((spec) => (
                <SpecField key={spec.key} spec={spec} value={details[spec.key]} onChange={(v) => setDetails((d) => ({ ...d, [spec.key]: v }))} />
              ))}
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-bold">Budget</h3>
            <div role="radiogroup" aria-label="Budget type" className="flex flex-wrap gap-2">
              {(
                [
                  ["fixed", "A fixed price"],
                  ["range", "A price range"],
                  ["quote", "Open to offers"],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm transition ${budget === id ? "border-[#C86C29] bg-[#C86C29]/5 font-medium" : "border-[var(--ui-input)] bg-[var(--ui-surface)]"}`}>
                  <input type="radio" name="budget" checked={budget === id} onChange={() => setBudget(id)} className="mr-2 accent-[#C86C29]" />
                  {label}
                </label>
              ))}
            </div>
            {budget !== "quote" && (
              <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="j-amount">{budget === "range" ? "From (LYD)" : "Budget (LYD)"}</Label>
                  <input id="j-amount" type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
                </div>
                {budget === "range" && (
                  <div>
                    <Label htmlFor="j-max">To (LYD)</Label>
                    <input id="j-max" type="number" min={1} step="0.01" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className={inputClass} />
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 max-w-xs">
              <Label htmlFor="j-deadline" optional>
                Needed by
              </Label>
              <input id="j-deadline" type="date" min={tomorrow} value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold">References</h3>
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={l.kind}
                  onChange={(e) => setLinks(links.map((x, idx) => (idx === i ? { ...x, kind: e.target.value as LinkKind } : x)))}
                  aria-label="Link type"
                  className="h-10 w-32 shrink-0 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-2 text-sm"
                >
                  {LINK_KIND_OPTIONS.map((o) => (
                    <option key={o.kind} value={o.kind}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  value={l.url}
                  onChange={(e) =>
                    setLinks(links.map((x, idx) => (idx === i ? { kind: x.kind === "other" ? (guessLinkKind(e.target.value) ?? "other") : x.kind, url: e.target.value } : x)))
                  }
                  inputMode="url"
                  aria-label="Link address"
                  placeholder="https://"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-3 text-sm outline-none focus:border-[#C86C29]"
                />
                <button type="button" aria-label="Remove link" onClick={() => setLinks(links.filter((_, idx) => idx !== i))} className={`${smallButton} h-10`}>
                  ✕
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={links.length >= MAX_JOB_LINKS} onClick={() => setLinks([...links, { kind: "other", url: "" }])} className={`${smallButton} h-9`}>
                + Add link ({links.length}/{MAX_JOB_LINKS})
              </button>
              <input ref={fileInput} id="j-files" type="file" multiple onChange={(e) => addFiles(e.target.files)} className="hidden" />
              <label htmlFor="j-files" className={`${smallButton} inline-flex h-9 cursor-pointer items-center ${files.length >= MAX_JOB_FILES ? "pointer-events-none opacity-50" : ""}`}>
                + Attach files ({files.length}/{MAX_JOB_FILES}, up to 10 MB)
              </label>
            </div>
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ui-border2)] bg-[var(--ui-surface)] px-3 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 rounded-b-2xl border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-4 py-2 text-sm font-medium transition hover:border-[#C86C29]">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="rounded-xl bg-[#C86C29] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#B05B1E] disabled:opacity-60">
            {busy ? "Posting..." : "Post job"}
          </button>
        </div>
      </form>
    </div>
  );
}
