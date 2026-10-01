"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import JobDetails from "@/components/jobs/JobDetails";
import PostJobModal from "@/components/jobs/PostJobModal";
import { TONE_CLASSES } from "@/lib/order-status";
import { applicationStatusLabel, budgetLabel, jobStatusLabel, type ApplicationForClient, type JobRow } from "@/lib/job-types";

type Board = { canPost: boolean; plan: string; categories: { id: number; name: string }[]; jobs: JobRow[] };

const small = "px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-50";
const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

function Applicant({ a, jobOpen, onAct }: { a: ApplicationForClient; jobOpen: boolean; onAct: (id: string, action: "accept" | "reject", who: string, price: number) => void }) {
  const st = applicationStatusLabel(a.status);
  return (
    <div className="rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-bg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/creators/${a.creator.id}`} target="_blank" className="font-semibold text-[var(--ui-text)] hover:text-[#C86C29] hover:underline">
            {a.creator.name}
          </Link>
          <div className="text-xs text-[var(--ui-muted)]">
            {a.creator.category} · {a.creator.reviews > 0 ? `${a.creator.rating.toFixed(1)} ★ (${a.creator.reviews})` : "No reviews yet"} · {a.creator.completed} completed
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">
            {a.price.toLocaleString()} LYD · {a.days} days
          </span>
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[st.tone]}`}>{st.label}</span>
        </div>
      </div>
      {a.message && <p className="mt-2 whitespace-pre-line text-sm text-[var(--ui-text2)]">{a.message}</p>}
      {a.links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {a.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className={`${small} border-[var(--ui-input)] bg-[var(--ui-surface)] hover:border-[#C86C29]`}>
              {l.label || l.url.replace(/^https?:\/\//, "").slice(0, 40)}
            </a>
          ))}
        </div>
      )}
      {a.status === "accepted" && a.orderNumber && <p className="mt-2 text-sm text-green-800 dark:text-green-200">Order {a.orderNumber} was created, pay it in Your Orders to start the work.</p>}
      {a.status === "pending" && jobOpen && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onAct(a.id, "accept", a.creator.name, a.price)} className={`${small} border-transparent bg-green-700 text-white hover:bg-green-800`}>
            Accept offer
          </button>
          <button type="button" onClick={() => onAct(a.id, "reject", a.creator.name, a.price)} className={`${small} border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200 hover:bg-red-50`}>
            Not this one
          </button>
        </div>
      )}
    </div>
  );
}

function JobCard({ job, onChanged, onError }: { job: JobRow; onChanged: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [showApps, setShowApps] = useState(job.status === "open" && (job.applications?.length ?? 0) > 0);
  const status = jobStatusLabel(job.status);
  const apps = job.applications ?? [];

  const patch = async (url: string, body: object) => {
    onError("");
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) onError((await res.json().catch(() => ({}))).error || "Something went wrong.");
    onChanged();
  };

  const act = (id: string, action: "accept" | "reject", who: string, price: number) => {
    const q =
      action === "accept"
        ? `Accept the offer of ${who}: ${price.toLocaleString()} LYD?\n\nAn order is created and you pay to start the work. The other applications are closed.`
        : `Turn down the offer of ${who}?`;
    if (window.confirm(q)) patch(`/api/jobs/applications/${id}`, { action });
  };

  return (
    <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{job.title}</div>
          <div className="text-xs text-[var(--ui-muted)]">
            {job.category.name} · posted {formatDate(job.createdAt)}
            {job.status === "open" ? ` · open until ${formatDate(job.expiresAt)}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-sm font-medium">{budgetLabel(job.budget)}</span>
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowApps((v) => !v)} className={`${small} border-[var(--ui-input)] bg-[var(--ui-surface)] hover:border-[#C86C29]`}>
          {apps.length} {apps.length === 1 ? "application" : "applications"} {showApps ? "▲" : "▼"}
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} className={`${small} border-[var(--ui-input)] bg-[var(--ui-surface)] hover:border-[#C86C29]`}>
          {open ? "Hide job" : "View job"}
        </button>
        {job.status === "open" && (
          <button
            type="button"
            onClick={() => window.confirm("Close this job? Creators can no longer apply, and waiting applications are closed.") && patch(`/api/jobs/${job.id}`, { action: "close" })}
            className={`${small} border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200 hover:bg-red-50`}
          >
            Close job
          </button>
        )}
      </div>

      {showApps && (
        <div className="mt-4 space-y-3">
          {apps.length === 0 && <p className="text-sm text-[var(--ui-muted)]">No one has applied yet.</p>}
          {apps.map((a) => (
            <Applicant key={a.id} a={a} jobOpen={job.status === "open"} onAct={act} />
          ))}
        </div>
      )}
      {open && (
        <div className="mt-4 border-t border-[var(--ui-border)] pt-4">
          <JobDetails job={job} />
        </div>
      )}
    </div>
  );
}

export default function ClientJobsPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "failed");
      setBoard(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error && e.message !== "failed" ? e.message : "Could not load your jobs. Please refresh the page.");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    return () => {
      clearTimeout(t);
      clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="min-h-screen bg-[var(--ui-bg)] p-6 text-[var(--ui-text)] md:p-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/client" className="text-sm font-medium text-[#C86C29] hover:underline">
          ← Back to dashboard
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your jobs</h1>
            <p className="mt-1 text-sm text-[var(--ui-muted)]">Post the work you need and choose from the offers creators send you.</p>
          </div>
          {board?.canPost && (
            <button type="button" onClick={() => setPosting(true)} className="rounded-xl bg-[#C86C29] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#B05B1E]">
              + Post a job
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-6 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
            {notice}
          </p>
        )}
        {!board && !error && <p className="mt-6 text-sm text-[var(--ui-muted)]">Loading...</p>}

        {board && !board.canPost && (
          <div className="mt-8 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-8 text-center shadow-sm">
            <p className="text-lg font-semibold">Posting jobs is part of the Enterprise plan</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ui-muted)]">
              Describe the work, set a budget and let creators apply with their price and time. You pick the one you like and pay through RAW society as usual.
            </p>
            <Link href="/dashboard/plan" className="mt-5 inline-block rounded-xl bg-[#C86C29] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#B05B1E]">
              See membership plans
            </Link>
          </div>
        )}

        {board && board.jobs.length > 0 && (
          <div className="mt-8 space-y-4">
            {board.jobs.map((j) => (
              <JobCard key={j.id} job={j} onChanged={load} onError={setNotice} />
            ))}
          </div>
        )}
        {board?.canPost && board.jobs.length === 0 && <p className="mt-8 text-sm text-[var(--ui-muted)]">You have not posted a job yet.</p>}
      </div>

      {posting && board && (
        <PostJobModal
          categories={board.categories}
          onClose={() => setPosting(false)}
          onPosted={() => {
            setPosting(false);
            load();
          }}
        />
      )}
    </div>
  );
}
