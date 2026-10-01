"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ClientCard from "@/components/ClientCard";
import JobDetails from "@/components/jobs/JobDetails";
import { LINK_KIND_OPTIONS, guessLinkKind, type LinkKind } from "@/components/services/types";
import { TONE_CLASSES } from "@/lib/order-status";
import { MAX_APPLICATION_LINKS } from "@/lib/plan-rules";
import { applicationStatusLabel, budgetLabel, type JobRow, type MyApplication } from "@/lib/job-types";

type Access = { plan: string; canBrowse: boolean; limit: number | null; used: number; remaining: number | null };
type Board = {
  locked: boolean;
  openCount?: number;
  access: Access;
  myCategoryId?: number | null;
  categories: { id: number; name: string }[];
  jobs: JobRow[];
};

const input =
  "w-full h-10 rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] px-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20";
const small = "px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-50";
const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

function ApplyForm({ job, onDone }: { job: JobRow; onDone: () => void }) {
  const [price, setPrice] = useState(job.budget.type === "fixed" && job.budget.amount ? String(job.budget.amount) : "");
  const [days, setDays] = useState("7");
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<{ kind: LinkKind; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: Number(price),
          days: Number(days),
          message,
          links: links.filter((l) => l.url.trim()).map((l) => ({ kind: l.kind, label: null, url: l.url.trim() })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Could not send your application.");
      else onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-bg)] p-4">
      <p className="text-xs text-[var(--ui-muted)]">
        Client budget: <span className="font-semibold">{budgetLabel(job.budget)}</span>. Your offer can be the same or different.
      </p>
      <div className="grid max-w-sm grid-cols-2 gap-3">
        <label className="text-xs font-medium">
          Your price (LYD)
          <input type="number" min={1} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="text-xs font-medium">
          Delivery (days)
          <input type="number" min={1} max={365} step={1} value={days} onChange={(e) => setDays(e.target.value)} className={`${input} mt-1`} />
        </label>
      </div>
      <label className="block text-xs font-medium">
        Why you are the right creator
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1500}
          rows={4}
          placeholder="Your experience with this kind of work, how you would approach it, what you need from the client."
          className="mt-1 w-full resize-none rounded-xl border border-[var(--ui-input)] bg-[var(--ui-surface)] p-3 text-sm outline-none focus:border-[#C86C29]"
        />
      </label>
      <div className="space-y-2">
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
              aria-label="Link to earlier work"
              placeholder="https://link-to-your-earlier-work"
              className={input}
            />
            <button type="button" aria-label="Remove link" onClick={() => setLinks(links.filter((_, idx) => idx !== i))} className={`${small} border-[var(--ui-input)] bg-[var(--ui-surface)]`}>
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={links.length >= MAX_APPLICATION_LINKS}
          onClick={() => setLinks([...links, { kind: "other", url: "" }])}
          className={`${small} border-[var(--ui-input)] bg-[var(--ui-surface)] hover:border-[#C86C29]`}
        >
          + Add a link to earlier work ({links.length}/{MAX_APPLICATION_LINKS})
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded-xl bg-[#C86C29] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#B05B1E] disabled:opacity-60"
      >
        {busy ? "Sending..." : "Send application"}
      </button>
    </div>
  );
}

function JobCard({ job, canApply, outside, anySpecialty, onChanged }: { job: JobRow; canApply: boolean; outside: boolean; anySpecialty: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const mine = job.myApplication;
  const status = mine ? applicationStatusLabel(mine.status) : null;

  return (
    <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--ui-text)]">{job.title}</div>
          <div className="text-xs text-[var(--ui-muted)]">
            {job.category.name} · posted {formatDate(job.createdAt)} · {job.applicationsCount} {job.applicationsCount === 1 ? "application" : "applications"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-sm font-medium">{budgetLabel(job.budget)}</span>
          {status && <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[status.tone]}`}>{status.label}</span>}
        </div>
      </div>

      {job.client && (
        <div className="mt-3">
          <ClientCard name={job.client.name} info={job.client} />
        </div>
      )}

      <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-[var(--ui-text2)]">{job.summary}</p>

      {outside && !mine && (
        <p className="mt-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          {anySpecialty
            ? `Note: this job is in ${job.category.name}, which is different from your specialty. You can still apply.`
            : `This job is in ${job.category.name}, outside your specialty. Creators on the Max plan can apply to any specialty.`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className={`${small} border-[var(--ui-input)] bg-[var(--ui-surface)] hover:border-[#C86C29]`}>
          {open ? "Hide details" : "View details"}
        </button>
        {!mine && canApply && (!outside || anySpecialty) && (
          <button type="button" onClick={() => setApplying((v) => !v)} className={`${small} border-transparent bg-[#C86C29] text-white hover:bg-[#B05B1E]`}>
            Apply
          </button>
        )}
        {mine && (
          <span className="text-xs text-[var(--ui-muted)]">
            Your offer: {mine.price.toLocaleString()} LYD in {mine.days} days
          </span>
        )}
      </div>

      {applying && !mine && (
        <ApplyForm
          job={job}
          onDone={() => {
            setApplying(false);
            onChanged();
          }}
        />
      )}
      {open && (
        <div className="mt-4 border-t border-[var(--ui-border)] pt-4">
          <JobDetails job={job} />
        </div>
      )}
    </div>
  );
}

export default function CreatorJobsPage() {
  const [tab, setTab] = useState<"open" | "mine">("open");
  const [board, setBoard] = useState<Board | null>(null);
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (query) params.set("q", query);
      const [a, b] = await Promise.all([fetch(`/api/jobs?${params}`, { cache: "no-store" }), fetch("/api/jobs/applications", { cache: "no-store" })]);
      const jobs = await a.json().catch(() => ({}));
      if (!a.ok) throw new Error(jobs.error || "failed");
      setBoard(jobs);
      if (b.ok) setApps((await b.json()).applications);
      setError("");
    } catch (e) {
      setError(e instanceof Error && e.message !== "failed" ? e.message : "Could not load the jobs. Please refresh the page.");
    }
  }, [category, query]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const withdraw = async (a: MyApplication) => {
    if (!window.confirm(`Withdraw your application to "${a.job.title}"?`)) return;
    setNotice("");
    const res = await fetch(`/api/jobs/applications/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdraw" }),
    });
    if (!res.ok) setNotice((await res.json().catch(() => ({}))).error || "Could not withdraw.");
    load();
  };

  const access = board?.access;
  const tabBtn = (key: "open" | "mine", label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === key ? "bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-sm" : "text-[var(--ui-muted)] hover:text-[var(--ui-text)]"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--ui-bg)] p-6 text-[var(--ui-text)] md:p-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/creator" className="text-sm font-medium text-[#C86C29] hover:underline">
          ← Back to dashboard
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
            <p className="mt-1 text-sm text-[var(--ui-muted)]">Work that clients posted. Apply with your price and time.</p>
          </div>
          {access && access.canBrowse && (
            <p className="text-sm text-[var(--ui-text2)]">
              {access.limit === null ? (
                "Unlimited applications (Max plan)"
              ) : (
                <>
                  Applications this month: <strong>{access.used}</strong> of {access.limit}
                </>
              )}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-6 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {!board && !error && <p className="mt-6 text-sm text-[var(--ui-muted)]">Loading...</p>}

        {board?.locked && (
          <div className="mt-8 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-8 text-center shadow-sm">
            <p className="text-lg font-semibold">The jobs board is for Pro and Max members</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ui-muted)]">
              {board.openCount ? `${board.openCount} ${board.openCount === 1 ? "job is" : "jobs are"} open right now. ` : ""}
              Upgrade to read them and apply. Pro lets you apply to 3 jobs a month, Max has no limit.
            </p>
            <Link href="/dashboard/plan" className="mt-5 inline-block rounded-xl bg-[#C86C29] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#B05B1E]">
              See membership plans
            </Link>
          </div>
        )}

        {board && (!board.locked || (apps && apps.length > 0)) && (
          <div className="mt-8 inline-flex gap-1 rounded-xl bg-[var(--ui-soft)] p-1">
            {!board.locked && tabBtn("open", "Open jobs")}
            {tabBtn("mine", `My applications${apps ? ` (${apps.length})` : ""}`)}
          </div>
        )}

        {notice && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
            {notice}
          </p>
        )}

        {board && !board.locked && tab === "open" && (
          <>
            <form
              className="mt-5 flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(q.trim());
              }}
            >
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={`${input} max-w-xs`}>
                <option value="">All categories</option>
                {board.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs" aria-label="Search jobs" className={`${input} max-w-xs`} />
              <button type="submit" className={`${small} h-10 border-[var(--ui-input)] bg-[var(--ui-surface)] hover:border-[#C86C29]`}>
                Search
              </button>
            </form>
            <div className="mt-5 space-y-4">
              {board.jobs.length === 0 && <p className="text-sm text-[var(--ui-muted)]">No open jobs match right now. Check back soon.</p>}
              {board.jobs.map((j) => (
                <JobCard
                  key={j.id}
                  job={j}
                  canApply={access?.remaining === null || (access?.remaining ?? 0) > 0}
                  outside={board.myCategoryId != null && j.category.id !== board.myCategoryId}
                  anySpecialty={access?.limit === null}
                  onChanged={load}
                />
              ))}
            </div>
            {access && access.remaining !== null && access.remaining <= 0 && (
              <p className="mt-5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                You used all {access.limit} applications of this month.{" "}
                <Link href="/dashboard/plan" className="font-semibold underline">
                  Upgrade to Max
                </Link>{" "}
                for unlimited applications.
              </p>
            )}
          </>
        )}

        {board && (tab === "mine" || board.locked) && (
          <div className="mt-5 space-y-4">
            {apps && apps.length === 0 && <p className="text-sm text-[var(--ui-muted)]">You have not applied to any job yet.</p>}
            {apps?.map((a) => {
              const st = applicationStatusLabel(a.status);
              return (
                <div key={a.id} className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{a.job.title}</div>
                      <div className="text-xs text-[var(--ui-muted)]">
                        {a.job.clientName} · applied {formatDate(a.createdAt)} · client budget {budgetLabel(a.job.budget)}
                      </div>
                    </div>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[st.tone]}`}>{st.label}</span>
                  </div>
                  <p className="mt-2 text-sm">
                    Your offer: <strong>{a.price.toLocaleString()} LYD</strong> in {a.days} days
                  </p>
                  {a.message && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-[var(--ui-text2)]">{a.message}</p>}
                  {a.status === "accepted" && a.orderNumber && (
                    <p className="mt-2 text-sm text-green-800 dark:text-green-200">Accepted. Order {a.orderNumber} was created and waits for the client&apos;s payment.</p>
                  )}
                  {a.status === "pending" && (
                    <button type="button" onClick={() => withdraw(a)} className={`${small} mt-3 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200 hover:bg-red-50`}>
                      Withdraw
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
