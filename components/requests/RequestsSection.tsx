"use client";

import { useCallback, useEffect, useState } from "react";
import ClientCard from "@/components/ClientCard";
import { fieldsFor } from "@/components/hire/fields";
import { TONE_CLASSES, type Viewer } from "@/lib/order-status";
import { requestStatusLabel, type RequestRow } from "@/lib/request-status";

const POLL_MS = 15000;

function budgetText(b: RequestRow["budget"]): string {
  const n = (v: number | null) => (v ?? 0).toLocaleString();
  switch (b.type) {
    case "fixed":
      return `${n(b.amount)} ${b.currency} (fixed price)`;
    case "range":
      return `${n(b.amount)} to ${n(b.amountMax)} ${b.currency}`;
    case "hourly":
      return `${n(b.hourlyRate)} ${b.currency} per hour, about ${b.hours} hours (around ${n(b.amount)} ${b.currency})`;
    case "quote":
      return "No price set: asking for a quote";
  }
}

const yesNo = (v: boolean) => (v ? "Yes" : "No");

/** Everything the client wrote, as labelled rows grouped like the form's review step. */
function sections(r: RequestRow): { title: string; rows: { label: string; value: string }[] }[] {
  const details: { label: string; value: string }[] = [];
  for (const spec of fieldsFor(r.category)) {
    const v = r.details[spec.key];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    details.push({ label: spec.label, value: Array.isArray(v) ? v.join(", ") : v === true ? "Yes" : String(v) });
  }
  return [
    {
      title: "Project",
      rows: [
        ...(r.baseServiceTitle ? [{ label: "Based on the service", value: r.baseServiceTitle }] : []),
        { label: "Description", value: r.summary },
        ...(r.brief ? [{ label: "Detailed brief", value: r.brief }] : []),
        ...(r.goals ? [{ label: "Goals and audience", value: r.goals }] : []),
        { label: "Language of the work", value: r.language },
        ...(r.links.length ? [{ label: "Reference links", value: r.links.map((l) => l.url).join("\n") }] : []),
      ],
    },
    ...(details.length ? [{ title: "Details", rows: details }] : []),
    {
      title: "Budget and time",
      rows: [
        { label: "Budget", value: budgetText(r.budget) },
        { label: "Needed by", value: r.deadline ?? "Flexible" },
        { label: "Urgent (rush job)", value: yesNo(r.rush) },
        { label: "Revisions expected", value: String(r.revisions) },
      ],
    },
    {
      title: "Extras",
      rows: [
        { label: "Usage rights", value: r.usageRights },
        { label: "Confidentiality (NDA) needed", value: yesNo(r.nda) },
        { label: "May be shown in the portfolio", value: yesNo(r.portfolio) },
        { label: "Source files needed", value: yesNo(r.sourceFiles) },
        { label: "Contact", value: r.contact },
        ...(r.questions ? [{ label: "Questions", value: r.questions }] : []),
      ],
    },
  ];
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

async function send(id: string, action: string, extra: Record<string, unknown> = {}): Promise<{ error: string | null; orderId?: string }> {
  try {
    const res = await fetch(`/api/custom-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { error: null, orderId: data.orderId } : { error: data.error || "Could not update the request." };
  } catch {
    return { error: "Network error. Please try again." };
  }
}

const small = "px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-50";
const input =
  "w-full h-10 rounded-xl border border-[#D9CFC5] bg-white px-3 text-sm outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20";

function RequestCard({ r, viewer, onChanged }: { r: RequestRow; viewer: Viewer; onChanged: () => void }) {
  const isClient = viewer === "client";
  const [open, setOpen] = useState(!isClient && r.status === "open");
  const [offering, setOffering] = useState(false);
  const [price, setPrice] = useState(String(r.offer?.price ?? (r.budget.type !== "quote" ? r.budget.amount ?? "" : "")));
  const [days, setDays] = useState(String(r.offer?.days ?? 7));
  const [message, setMessage] = useState(r.offer?.message ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const status = requestStatusLabel(r.status, viewer);
  const waiting = r.status === "open" || r.status === "offered";

  const run = async (action: string, extra?: Record<string, unknown>) => {
    setError("");
    setBusy(true);
    const res = await send(r.id, action, extra);
    setBusy(false);
    if (res.error) setError(res.error);
    else setOffering(false);
    onChanged();
  };

  const decline = () => {
    if (!window.confirm(`Decline the request from ${r.other.name}?`)) return;
    run("decline");
  };
  const cancel = () => {
    const q = isClient && r.status === "offered" ? `Turn down the offer from ${r.other.name}?` : `Cancel your request to ${r.other.name}?`;
    if (window.confirm(q)) run("cancel");
  };
  const accept = () => {
    if (
      window.confirm(
        `Accept this offer: ${r.offer?.price.toLocaleString()} LYD in ${r.offer?.days} days?\n\nAn order is created and you pay to start the work. The money is held until you approve the delivery.`
      )
    ) {
      run("accept");
    }
  };

  return (
    <div className="rounded-xl border border-[#EFE8E1] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-[#2C221E]">{r.title}</div>
          <div className="text-xs text-[#7D6E65]">
            {isClient ? "To" : "From"} {r.other.name}
            {r.other.subtitle ? `, ${r.other.subtitle}` : ""} · sent {formatDate(r.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium whitespace-nowrap">{budgetText(r.budget).split(" (")[0]}</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
        </div>
      </div>

      {!isClient && r.client && (
        <div className="mt-3">
          <ClientCard name={r.other.name} info={r.client} />
        </div>
      )}

      {r.offer && (r.status === "offered" || r.status === "accepted") && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="font-semibold">
            {isClient ? "Offer from the creator" : "Your offer"}: {r.offer.price.toLocaleString()} LYD in {r.offer.days} days
          </div>
          {r.offer.message && <p className="mt-1 whitespace-pre-line">{r.offer.message}</p>}
          {r.status === "offered" && <p className="mt-1 text-xs text-blue-800">Valid until {formatDate(r.expiresAt)}.</p>}
        </div>
      )}

      {r.status === "accepted" && (
        <p className="mt-3 text-sm text-green-800">
          Accepted.{" "}
          {r.orderNumber
            ? isClient
              ? `Order ${r.orderNumber} was created, pay it in Your Orders to start the work.`
              : `Order ${r.orderNumber} was created and waits for the client's payment.`
            : ""}
        </p>
      )}
      {r.status === "declined" && (
        <p className="mt-3 text-sm text-[#554f49]">
          {isClient ? "The creator declined this request." : "You declined this request."}
          {r.declineNote ? ` "${r.declineNote}"` : ""}
        </p>
      )}
      {r.status === "expired" && <p className="mt-3 text-sm text-[#554f49]">Nobody answered in time, so this request ended.</p>}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className={`${small} border-[#D9CFC5] bg-white hover:border-[#C86C29]`}>
          {open ? "Hide details" : "View details"}
        </button>
        {!isClient && waiting && (
          <>
            <button type="button" onClick={() => setOffering((v) => !v)} disabled={busy} className={`${small} border-transparent bg-[#C86C29] text-white hover:bg-[#B05B1E]`}>
              {r.status === "offered" ? "Change offer" : "Send offer"}
            </button>
            <button type="button" onClick={decline} disabled={busy} className={`${small} border-red-200 text-red-700 hover:bg-red-50`}>
              Decline
            </button>
          </>
        )}
        {isClient && r.status === "offered" && (
          <>
            <button type="button" onClick={accept} disabled={busy} className={`${small} border-transparent bg-green-700 text-white hover:bg-green-800`}>
              {busy ? "Working..." : "Accept offer"}
            </button>
            <button type="button" onClick={cancel} disabled={busy} className={`${small} border-red-200 text-red-700 hover:bg-red-50`}>
              Turn down
            </button>
          </>
        )}
        {isClient && r.status === "open" && (
          <button type="button" onClick={cancel} disabled={busy} className={`${small} border-red-200 text-red-700 hover:bg-red-50`}>
            Cancel request
          </button>
        )}
      </div>

      {offering && (
        <div className="mt-4 space-y-3 rounded-xl border border-[#E5DCD2] bg-[#FDFBF7] p-4">
          <p className="text-xs text-[#7D6E65]">
            Client budget: <span className="font-semibold">{budgetText(r.budget)}</span>. Your offer can be the same or a different price.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <label className="text-xs font-medium">
              Price (LYD)
              <input type="number" min={1} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} mt-1`} />
            </label>
            <label className="text-xs font-medium">
              Delivery (days)
              <input type="number" min={1} max={365} step={1} value={days} onChange={(e) => setDays(e.target.value)} className={`${input} mt-1`} />
            </label>
          </div>
          <label className="block text-xs font-medium">
            Message to the client (optional)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="What is included, what you need from them, anything to clarify."
              className="mt-1 w-full rounded-xl border border-[#D9CFC5] bg-white p-3 text-sm outline-none focus:border-[#C86C29] resize-none"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("offer", { price: Number(price), days: Number(days), note: message })}
            className="rounded-xl bg-[#C86C29] px-5 py-2 text-sm font-medium text-white hover:bg-[#B05B1E] transition disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send offer to the client"}
          </button>
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t border-[#EFE8E1] pt-4">
          {sections(r).map((s) => (
            <section key={s.title}>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#7D6E65]">{s.title}</h4>
              <dl className="space-y-2">
                {s.rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-1 gap-0.5 sm:grid-cols-3 sm:gap-3">
                    <dt className="text-xs font-semibold text-[#7D6E65]">{row.label}</dt>
                    <dd className="whitespace-pre-line break-words text-sm sm:col-span-2">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {r.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className={`${small} border-[#D9CFC5] bg-white hover:border-[#C86C29]`}>
                  {l.label || l.url.replace(/^https?:\/\//, "").slice(0, 40)}
                </a>
              ))}
            </div>
          )}
          {r.files.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#7D6E65]">Attached files</h4>
              <ul className="space-y-1.5">
                {r.files.map((f) => (
                  <li key={f.id}>
                    <a href={`/api/custom-requests/files/${f.id}?download=1`} className="text-sm font-medium text-[#C86C29] hover:underline">
                      {f.name}
                    </a>{" "}
                    <span className="text-xs text-[#7D6E65]">({f.size < 1048576 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1048576).toFixed(1)} MB`})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Props = { viewer: Viewer; onOrdersChanged?: () => void };

/** Custom requests ("Hire me") of the logged-in user. Shows nothing until there is at least one. */
export default function RequestsSection({ viewer, onOrdersChanged }: Props) {
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/custom-requests", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setRequests((await res.json()).requests);
      setError("");
    } catch {
      setError("Could not load your custom requests.");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(reload, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [reload]);

  const changed = useCallback(() => {
    reload();
    onOrdersChanged?.();
  }, [reload, onOrdersChanged]);

  if (error && !requests) {
    return (
      <p role="alert" className="text-sm font-medium text-red-600">
        {error}
      </p>
    );
  }
  if (!requests || requests.length === 0) return null;

  const waiting = requests.filter((r) => (viewer === "creator" ? r.status === "open" : r.status === "offered")).length;

  return (
    <div className="bg-white border border-[#EFE8E1] rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8E1] pb-5 mb-6">
        <h2 className="text-xl font-bold">Custom Requests</h2>
        {waiting > 0 && (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
            {viewer === "creator"
              ? `${waiting} new ${waiting === 1 ? "request needs" : "requests need"} your answer`
              : `${waiting} ${waiting === 1 ? "offer is" : "offers are"} waiting for you`}
          </span>
        )}
      </div>
      <div className="space-y-4">
        {requests.map((r) => (
          <RequestCard key={r.id} r={r} viewer={viewer} onChanged={changed} />
        ))}
      </div>
    </div>
  );
}
