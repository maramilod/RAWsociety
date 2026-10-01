"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

/**
 * Round user-icon button for the top bar. Opens a small menu with
 * "Dashboard" and "Log out". Shown only to logged-in users.
 */
export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // Close when clicking elsewhere or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status !== "authenticated" || !session?.user) return null;

  const itemClass =
    "block w-full px-4 py-2.5 text-left text-sm font-medium text-[var(--text-main)] hover:bg-[var(--home-icon-bg)] transition";

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title={session.user.name ?? "Account"}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--white)] text-[var(--text-main)] shadow-sm transition hover:border-[#c86d38] hover:text-[#c86d38]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--white)] py-1 shadow-lg"
        >
          <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            Dashboard
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className={`${itemClass} border-t border-[var(--border-default)] hover:text-red-600`}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
