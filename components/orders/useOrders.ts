"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderRow } from "@/lib/order-status";

export interface ClientStats {
  active: number;
  pending: number; // waiting for the creator's answer
  toPay: number; // accepted, waiting for the client's payment
  investment: number; // total of the paid orders
  hired: number;
  saved: number;
}

export interface CreatorStats {
  requests: number; // new requests to answer
  awaitingPayment: number;
  active: number;
  completed: number;
  revenue: number; // released to the creator (after the platform's commission)
  escrow: number; // paid by clients, held until they approve the delivery
  rating: number;
  reviews: number;
}

interface OrdersState<S> {
  orders: OrderRow[];
  stats: S | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}

const POLL_MS = 15000;

/** The logged-in user's orders and dashboard numbers. Refreshes every few seconds, so a creator sees new requests. */
export function useOrders<S extends ClientStats | CreatorStats>(): OrdersState<S> {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stats, setStats] = useState<S | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setOrders(data.orders);
      setStats(data.stats);
      setError("");
    } catch {
      setError("Could not load your orders. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(reload, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  return { orders, stats, loading, error, reload };
}

/**
 * Moves an order along: accept / decline (creator); cancel / approve / revision / dispute (client).
 * "revision" and "dispute" need a written note. Returns an error message, or null on success.
 * (Delivering the work has its own form: POST /api/orders/[id]/delivery.)
 */
export async function sendOrderAction(
  orderId: string,
  action: "accept" | "decline" | "cancel" | "approve" | "revision" | "dispute",
  note?: string
): Promise<string | null> {
  try {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.error || "Could not update the order.";
  } catch {
    return "Network error. Please try again.";
  }
}
