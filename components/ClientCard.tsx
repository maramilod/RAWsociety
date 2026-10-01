import type { ClientInfo } from "@/lib/request-status";

type Props = { name: string; info: ClientInfo };

/** Who is asking: a short card for the creator who has to answer a request. Shows facts only, never the client's budget. */
export default function ClientCard({ name, info }: Props) {
  const since = new Date(info.joinedAt).toLocaleDateString([], { month: "short", year: "numeric" });
  const facts = [info.industry, info.size ? `${info.size} people` : null].filter(Boolean).join(" · ");
  const history =
    info.paidOrders === 0
      ? "New client, no paid orders yet"
      : `${info.paidOrders} paid ${info.paidOrders === 1 ? "order" : "orders"}, ${info.completedOrders} completed`;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5DCD2] bg-[#FDFBF7] p-3">
      {info.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-[#E5DCD2] object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F0EAE1] text-sm font-bold text-[#7D6E65]"
        >
          {name.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <div className="min-w-0 text-sm">
        <div className="font-semibold text-[#2C221E]">
          {name}
          {info.company && <span className="font-normal text-[#7D6E65]"> · {info.company}</span>}
        </div>
        {facts && <div className="text-xs text-[#7D6E65]">{facts}</div>}
        <div className="mt-1 text-xs text-[#554f49]">
          {history} · member since {since}
        </div>
      </div>
    </div>
  );
}
