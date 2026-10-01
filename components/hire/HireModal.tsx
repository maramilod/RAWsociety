"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { guessLinkKind, LINK_KIND_OPTIONS, type LinkKind } from "@/components/services/types";
import {
  CONTACT_OPTIONS,
  LANGUAGE_OPTIONS,
  MAX_REQUEST_FILES,
  MAX_REQUEST_FILE_BYTES,
  MAX_REQUEST_LINKS,
  REVISION_OPTIONS,
  USAGE_RIGHTS,
  fieldsFor,
  type FieldSpec,
  type FieldValue,
} from "./fields";
import {
  STEPS,
  buildPayload,
  buildSummary,
  emptyDraft,
  firstInvalidStep,
  hourlyTotal,
  validateStep,
  type HireDraft,
  type PricingType,
} from "./form";
import { submitCustomRequest } from "./submit";
import { Label, SpecField, Toggle, inputClass, smallButton, textareaClass } from "./SpecField";

type Props = {
  creator: {
    id: string;
    name: string;
    category: string;
    services: { id: string; title: string; price: number; currency: string; deliveryDays: number | null }[];
  };
  onClose: () => void;
};

let keyCounter = 0;
const nextKey = () => `h${++keyCounter}`;

const storageKey = (creatorId: string) => `hire-draft-${creatorId}`;

/** The saved draft of this creator's form, if any. Always falls back to an empty form. */
function loadDraft(creatorId: string): HireDraft {
  const base = emptyDraft();
  try {
    const raw = localStorage.getItem(storageKey(creatorId));
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<HireDraft>;
    const merged: HireDraft = { ...base };
    for (const key of Object.keys(base) as (keyof HireDraft)[]) {
      const value = saved[key];
      if (value !== undefined && typeof value === typeof base[key]) (merged[key] as unknown) = value;
    }
    merged.links = Array.isArray(saved.links)
      ? saved.links.map((l) => ({ key: nextKey(), kind: l.kind, label: String(l.label ?? ""), url: String(l.url ?? "") }))
      : [];
    merged.terms = false; // the client confirms the terms again every time
    return merged;
  } catch {
    return base;
  }
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && <p className="mt-0.5 mb-2 text-xs text-[var(--ui-muted)]">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

const PRICING: { id: PricingType; title: string; text: string }[] = [
  { id: "fixed", title: "A fixed price", text: "You offer one price for the whole work." },
  { id: "range", title: "A price range", text: "You give the lowest and highest you can pay." },
  { id: "hourly", title: "By the hour", text: "An hourly rate and the hours you expect." },
  { id: "quote", title: "Ask for a quote", text: "You are not sure, the creator suggests a price." },
];

export default function HireModal({ creator, onClose }: Props) {
  const [draft, setDraft] = useState<HireDraft>(() => loadDraft(creator.id));
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const specFields = useMemo(() => fieldsFor(creator.category), [creator.category]);
  const baseService = creator.services.find((s) => s.id === draft.baseServiceId) ?? null;

  // Every change is kept on this device, so nothing is lost if the window is closed by mistake
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(creator.id), JSON.stringify({ ...draft, terms: false }));
    } catch {
      /* the browser may block storage: the form still works */
    }
  }, [draft, creator.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step]);

  const set = <K extends keyof HireDraft>(key: K, value: HireDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setDetail = (key: string, value: FieldValue) => setDraft((d) => ({ ...d, details: { ...d.details, [key]: value } }));

  const chooseBase = (id: string) => {
    setDraft((d) => {
      const svc = creator.services.find((s) => s.id === id);
      if (!svc) return { ...d, baseServiceId: "" };
      return {
        ...d,
        baseServiceId: id,
        title: d.title.trim() ? d.title : `Custom version of: ${svc.title}`,
        pricingType: "fixed",
        amount: d.amount.trim() ? d.amount : String(svc.price),
      };
    });
  };

  const updateLink = (key: string, patch: Partial<{ kind: LinkKind; label: string; url: string }>) =>
    setDraft((d) => ({
      ...d,
      links: d.links.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.url !== undefined && next.kind === "other") {
          const guess = guessLinkKind(patch.url);
          if (guess) next.kind = guess;
        }
        return next;
      }),
    }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_REQUEST_FILES) {
        setError(`You can attach up to ${MAX_REQUEST_FILES} files. Put the rest in a link.`);
        break;
      }
      if (f.size > MAX_REQUEST_FILE_BYTES) {
        setError(`"${f.name}" is larger than 10 MB. Add it as a link instead.`);
        continue;
      }
      if (f.size === 0) {
        setError(`"${f.name}" is empty.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const goNext = () => {
    const problem = validateStep(step, draft, creator.category, files);
    if (problem) return setError(problem);
    setError("");
    setNotice("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const send = async () => {
    setNotice("");
    const bad = firstInvalidStep(draft, creator.category, files);
    if (bad) {
      setStep(bad.step);
      return setError(bad.message);
    }
    setError("");
    setSending(true);
    try {
      const result = await submitCustomRequest(buildPayload(creator.id, draft, creator.category), files);
      if (result.ok) {
        try {
          localStorage.removeItem(storageKey(creator.id));
        } catch {
          /* ignore */
        }
        setSent(true);
      } else if (result.notConnected) {
        setNotice(result.error);
      } else {
        setError(result.error);
      }
    } finally {
      setSending(false);
    }
  };

  const clearDraft = () => {
    if (!window.confirm("Clear everything you typed in this form?")) return;
    try {
      localStorage.removeItem(storageKey(creator.id));
    } catch {
      /* ignore */
    }
    setDraft(emptyDraft());
    setFiles([]);
    setStep(0);
    setError("");
    setNotice("");
  };

  const total = hourlyTotal(draft);
  const summary = step === 4 ? buildSummary(draft, creator.category, files, baseService?.title ?? null) : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !sending && onClose()} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hire-title"
        className="relative z-10 flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-2xl"
      >
        {/* Header and progress */}
        <div className="shrink-0 rounded-t-2xl border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 pb-4 pt-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 id="hire-title" className="text-lg font-bold">
                Request a custom offer from {creator.name}
              </h2>
              <p className="text-xs text-[var(--ui-muted)]">{creator.category}</p>
            </div>
            <button type="button" onClick={onClose} disabled={sending} aria-label="Close" className="text-lg leading-none text-[var(--ui-muted)] hover:text-[var(--ui-text)]">
              ✕
            </button>
          </div>

          {!sent && (
            <ol className="mt-4 flex items-center gap-1 overflow-x-auto" aria-label="Steps">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={i > step}
                    onClick={() => {
                      setError("");
                      setStep(i);
                    }}
                    aria-current={i === step ? "step" : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      i === step ? "bg-[#C86C29] text-white" : i < step ? "bg-[var(--ui-soft)] text-[var(--ui-text)] hover:bg-[var(--ui-border2)]" : "bg-[var(--ui-soft)] text-[var(--ui-muted)]"
                    }`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${i === step ? "bg-[var(--ui-surface)]/25" : "bg-black/5"}`}>{i < step ? "✓" : i + 1}</span>
                    {label}
                  </button>
                  {i < STEPS.length - 1 && <span className="h-px w-3 bg-[var(--ui-border2)]" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Body */}
        <div ref={scroller} className="space-y-7 overflow-y-auto p-6">
          {sent && (
            <div role="status" className="rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-5 text-sm text-green-900 dark:text-green-200">
              <p className="font-semibold">Request sent!</p>
              <p className="mt-1">
                {creator.name} will review it and answer with an offer or a decline. You can follow it in your dashboard,
                under Custom Requests.
              </p>
            </div>
          )}

          {/* ---------------- Step 1: the project ---------------- */}
          {!sent && step === 0 && (
            <>
              {creator.services.length > 0 && (
                <Section title="Start from a service?" hint="Pick one of their services to customise, or leave it fully custom.">
                  <select value={draft.baseServiceId} onChange={(e) => chooseBase(e.target.value)} aria-label="Start from a service" className={inputClass}>
                    <option value="">Fully custom, nothing to start from</option>
                    {creator.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.price.toLocaleString()} {s.currency})
                      </option>
                    ))}
                  </select>
                </Section>
              )}

              <Section title="Your project">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="h-title">Title of your request</Label>
                    <input id="h-title" value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="e.g. Logo and colours for my new coffee shop" className={inputClass} />
                  </div>
                  <div>
                    <Label htmlFor="h-summary">What do you need? (short description)</Label>
                    <textarea id="h-summary" value={draft.summary} onChange={(e) => set("summary", e.target.value)} maxLength={1500} rows={4} placeholder="Explain the work in a few sentences: what it is, who it is for, and what a great result looks like." className={textareaClass} />
                    <p className="mt-1 text-right text-[11px] text-[var(--ui-muted)]">{draft.summary.length}/1500</p>
                  </div>
                  <div>
                    <Label htmlFor="h-brief" optional>
                      Detailed brief
                    </Label>
                    <textarea id="h-brief" value={draft.brief} onChange={(e) => set("brief", e.target.value)} maxLength={5000} rows={5} placeholder="Everything else the creator should know: requirements, dos and don'ts, anything about your business." className={textareaClass} />
                  </div>
                  <div>
                    <Label htmlFor="h-goals" optional>
                      Goals and audience
                    </Label>
                    <textarea id="h-goals" value={draft.goals} onChange={(e) => set("goals", e.target.value)} maxLength={1500} rows={3} placeholder="Who will see or use this, and what should it achieve?" className={textareaClass} />
                  </div>
                  <div className="max-w-xs">
                    <Label htmlFor="h-language">Language of the work</Label>
                    <select id="h-language" value={draft.language} onChange={(e) => set("language", e.target.value)} className={inputClass}>
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Section>

              <Section title="Examples and references" hint="Show what you like: links to inspiration, your current work, or files. Both are optional.">
                <div className="space-y-3">
                  {draft.links.map((l) => {
                    const option = LINK_KIND_OPTIONS.find((o) => o.kind === l.kind);
                    return (
                      <div key={l.key} className="space-y-2 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-3">
                        <div className="flex gap-2">
                          <select value={l.kind} onChange={(e) => updateLink(l.key, { kind: e.target.value as LinkKind })} aria-label="Link type" className="h-10 w-36 shrink-0 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-2 text-sm outline-none focus:border-[#C86C29]">
                            {LINK_KIND_OPTIONS.map((o) => (
                              <option key={o.kind} value={o.kind}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <input value={l.url} onChange={(e) => updateLink(l.key, { url: e.target.value })} maxLength={500} inputMode="url" aria-label="Link address" placeholder={option?.placeholder ?? "https://"} className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-3 text-sm outline-none focus:border-[#C86C29]" />
                          <button type="button" aria-label="Remove link" onClick={() => set("links", draft.links.filter((x) => x.key !== l.key))} className={`${smallButton} h-10 shrink-0`}>
                            ✕
                          </button>
                        </div>
                        <input value={l.label} onChange={(e) => updateLink(l.key, { label: e.target.value })} maxLength={60} aria-label="What is this link? (optional)" placeholder="What is this? (optional), e.g. A logo I like" className="h-9 w-full rounded-lg border border-[var(--ui-border2)] bg-[var(--ui-bg)] px-3 text-xs outline-none focus:border-[#C86C29]" />
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => set("links", [...draft.links, { key: nextKey(), kind: "other", label: "", url: "" }])} disabled={draft.links.length >= MAX_REQUEST_LINKS} className={`${smallButton} h-9`}>
                    + Add link ({draft.links.length}/{MAX_REQUEST_LINKS})
                  </button>

                  {files.length > 0 && (
                    <ul className="space-y-2">
                      {files.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] px-3 py-2 text-sm">
                          <span className="truncate">{f.name}</span>
                          <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input ref={fileInput} id="h-files" type="file" multiple onChange={(e) => addFiles(e.target.files)} className="hidden" />
                  <label htmlFor="h-files" className={`inline-flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-[#C86C29] px-4 text-sm font-medium text-[#C86C29] transition hover:bg-[#C86C29]/5 ${files.length >= MAX_REQUEST_FILES ? "pointer-events-none opacity-50" : ""}`}>
                    + Attach files ({files.length}/{MAX_REQUEST_FILES}, up to 10 MB each)
                  </label>
                </div>
              </Section>
            </>
          )}

          {/* ---------------- Step 2: details of the specialty ---------------- */}
          {!sent && step === 1 && (
            <Section title={`About your ${creator.category.toLowerCase()} project`} hint="These questions help the creator understand exactly what you need. Answer what you know and skip the rest.">
              <div className="space-y-5">
                {specFields.map((spec) => (
                  <SpecField key={spec.key} spec={spec} value={draft.details[spec.key]} onChange={(v) => setDetail(spec.key, v)} />
                ))}
              </div>
            </Section>
          )}

          {/* ---------------- Step 3: budget and time ---------------- */}
          {!sent && step === 2 && (
            <>
              <Section title="Your budget" hint="This is your offer. The creator can accept it, decline it, or answer with a different price.">
                <div role="radiogroup" aria-label="How do you want to price it?" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PRICING.map((p) => (
                    <label key={p.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${draft.pricingType === p.id ? "border-[#C86C29] bg-[#C86C29]/5" : "border-[var(--ui-input)] bg-[var(--ui-surface)]"}`}>
                      <input type="radio" name="pricing" checked={draft.pricingType === p.id} onChange={() => set("pricingType", p.id)} className="mt-1 accent-[#C86C29]" />
                      <span>
                        <span className="block text-sm font-medium">{p.title}</span>
                        <span className="block text-xs text-[var(--ui-muted)]">{p.text}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-4">
                  {draft.pricingType === "fixed" && (
                    <div className="max-w-xs">
                      <Label htmlFor="h-amount">Your offer (LYD)</Label>
                      <input id="h-amount" type="number" inputMode="decimal" min={1} step="0.01" value={draft.amount} onChange={(e) => set("amount", e.target.value)} placeholder="500" className={inputClass} />
                      {baseService && <p className="mt-1 text-xs text-[var(--ui-muted)]">The service costs {baseService.price.toLocaleString()} {baseService.currency}. A custom job can cost more or less.</p>}
                    </div>
                  )}
                  {draft.pricingType === "range" && (
                    <div className="grid max-w-md grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="h-min">From (LYD)</Label>
                        <input id="h-min" type="number" inputMode="decimal" min={1} step="0.01" value={draft.amount} onChange={(e) => set("amount", e.target.value)} placeholder="300" className={inputClass} />
                      </div>
                      <div>
                        <Label htmlFor="h-max">To (LYD)</Label>
                        <input id="h-max" type="number" inputMode="decimal" min={1} step="0.01" value={draft.amountMax} onChange={(e) => set("amountMax", e.target.value)} placeholder="600" className={inputClass} />
                      </div>
                    </div>
                  )}
                  {draft.pricingType === "hourly" && (
                    <div className="grid max-w-md grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="h-rate">Rate per hour (LYD)</Label>
                        <input id="h-rate" type="number" inputMode="decimal" min={1} step="0.01" value={draft.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} placeholder="40" className={inputClass} />
                      </div>
                      <div>
                        <Label htmlFor="h-hours">Expected hours</Label>
                        <input id="h-hours" type="number" inputMode="numeric" min={1} step={1} value={draft.hours} onChange={(e) => set("hours", e.target.value)} placeholder="10" className={inputClass} />
                      </div>
                      {total !== null && <p className="col-span-2 text-xs text-[var(--ui-muted)]">About {total.toLocaleString()} LYD in total.</p>}
                    </div>
                  )}
                  {draft.pricingType === "quote" && (
                    <p className="rounded-xl bg-[var(--ui-soft)] px-4 py-3 text-sm text-[var(--ui-text2)]">No problem. The creator will read your request and answer with their price.</p>
                  )}
                </div>
              </Section>

              <Section title="When do you need it?">
                <div role="radiogroup" aria-label="Deadline" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["flexible", "I am flexible", "The creator suggests a timeline."],
                      ["date", "By a date", "You need it by a specific day."],
                    ] as const
                  ).map(([id, title, text]) => (
                    <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${draft.deadlineType === id ? "border-[#C86C29] bg-[#C86C29]/5" : "border-[var(--ui-input)] bg-[var(--ui-surface)]"}`}>
                      <input type="radio" name="deadline" checked={draft.deadlineType === id} onChange={() => set("deadlineType", id)} className="mt-1 accent-[#C86C29]" />
                      <span>
                        <span className="block text-sm font-medium">{title}</span>
                        <span className="block text-xs text-[var(--ui-muted)]">{text}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {draft.deadlineType === "date" && (
                  <div className="mt-3 max-w-xs">
                    <Label htmlFor="h-deadline">Needed by</Label>
                    <input id="h-deadline" type="date" min={tomorrow} value={draft.deadline} onChange={(e) => set("deadline", e.target.value)} className={inputClass} />
                  </div>
                )}
                <div className="mt-3">
                  <Toggle id="h-rush" checked={draft.rush} onChange={(v) => set("rush", v)} label="This is urgent" help="Tell the creator it is a rush job, they may price it differently." />
                </div>
              </Section>

              <Section title="Revisions" hint="How many rounds of changes do you expect after the first delivery?">
                <select value={draft.revisions} onChange={(e) => set("revisions", e.target.value)} aria-label="Revisions" className={`${inputClass} max-w-[12rem]`}>
                  {REVISION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === "0" ? "No revisions" : r === "1" ? "1 revision" : `${r} revisions`}
                    </option>
                  ))}
                </select>
              </Section>

              <p className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4 text-xs leading-relaxed text-[var(--ui-text2)]">
                <span className="font-semibold">How payment works: </span>
                you pay only after the creator accepts. Your money is held safely by RAW society and released to the creator only when you approve the delivered work.
              </p>
            </>
          )}

          {/* ---------------- Step 4: extras ---------------- */}
          {!sent && step === 3 && (
            <>
              <Section title="Rights and privacy">
                <div className="space-y-4">
                  <div className="max-w-md">
                    <Label htmlFor="h-rights">How will you use the work?</Label>
                    <select id="h-rights" value={draft.usageRights} onChange={(e) => set("usageRights", e.target.value)} className={inputClass}>
                      {USAGE_RIGHTS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <Toggle id="h-source" checked={draft.sourceFiles} onChange={(v) => set("sourceFiles", v)} label="I need the source files" help="For example the editable design, the project file or the source code." />
                  <Toggle id="h-nda" checked={draft.nda} onChange={(v) => set("nda", v)} label="The work must stay confidential" help="The creator must keep your project private." />
                  <Toggle id="h-portfolio" checked={draft.portfolio} onChange={(v) => set("portfolio", v)} label="The creator may show the finished work in their portfolio" />
                </div>
              </Section>

              <Section title="Talking to the creator">
                <div className="space-y-4">
                  <div className="max-w-md">
                    <Label htmlFor="h-contact">How should they reach you?</Label>
                    <select id="h-contact" value={draft.contact} onChange={(e) => set("contact", e.target.value)} className={inputClass}>
                      {CONTACT_OPTIONS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="h-questions" optional>
                      Questions for the creator
                    </Label>
                    <textarea id="h-questions" value={draft.questions} onChange={(e) => set("questions", e.target.value)} maxLength={2000} rows={4} placeholder="Anything you want to ask before you start, for example about their experience or their process." className={textareaClass} />
                  </div>
                </div>
              </Section>
            </>
          )}

          {/* ---------------- Step 5: review ---------------- */}
          {!sent && step === 4 && (
            <>
              <p className="text-sm text-[var(--ui-text2)]">Check your request. This is what {creator.name} will read.</p>
              {summary.map((section) => (
                <section key={section.title} className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold">{section.title}</h3>
                    <button type="button" onClick={() => { setError(""); setStep(section.step); }} className="text-xs font-semibold text-[#C86C29] hover:underline">
                      Edit
                    </button>
                  </div>
                  <dl className="space-y-2.5">
                    {section.rows.map((row) => (
                      <div key={row.label} className="grid grid-cols-1 gap-0.5 sm:grid-cols-3 sm:gap-3">
                        <dt className="text-xs font-semibold text-[var(--ui-muted)]">{row.label}</dt>
                        <dd className="whitespace-pre-line break-words text-sm sm:col-span-2">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              <label htmlFor="h-terms" className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-surface)] p-4">
                <input id="h-terms" type="checkbox" checked={draft.terms} onChange={(e) => set("terms", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C86C29]" />
                <span className="text-sm">
                  I understand this is a request. The creator can accept it, decline it, or suggest a different price. I pay only after they accept, and my payment is held until I approve the work.
                </span>
              </label>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
              {notice}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-b-2xl border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 py-4">
          <div className="text-xs text-[var(--ui-muted)]">
            {!sent && (
              <>
                <span>Saved on this device as you type. </span>
                <button type="button" onClick={clearDraft} className="font-semibold text-[#C86C29] hover:underline">
                  Clear form
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sent ? (
              <button type="button" onClick={onClose} className="rounded-xl bg-[#C86C29] px-5 py-2 text-sm font-medium text-white hover:bg-[#B05B1E] transition">
                Close
              </button>
            ) : (
              <>
                {step > 0 && (
                  <button type="button" onClick={() => { setError(""); setNotice(""); setStep((s) => s - 1); }} disabled={sending} className="rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-4 py-2 text-sm font-medium hover:border-[#C86C29] transition">
                    Back
                  </button>
                )}
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={goNext} className="rounded-xl bg-[#C86C29] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#B05B1E] transition">
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={send} disabled={sending} className="rounded-xl bg-[#C86C29] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#B05B1E] transition disabled:opacity-60">
                    {sending ? "Sending..." : "Send request"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
