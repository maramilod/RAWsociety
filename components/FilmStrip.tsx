"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatPrice } from "@/components/services/types";

// A gallery of thin slices. The slice under the pointer opens up into a card and its neighbours squeeze aside.
// A ribbon of text loops around the gallery and talks about the offers that are live right now.

type Item = {
  key: string;
  title: string;
  cover: string | null;
  gradient: string;
  category: string;
  href: string;
  price: number | null;
  currency: string;
  cta: string;
};

const GRADIENTS = [
  "linear-gradient(to bottom, #ff9447, #29124d)",
  "linear-gradient(to bottom, #33ccb8, #0a263d)",
  "linear-gradient(to bottom, #f273b2, #380d2e)",
  "linear-gradient(to bottom, #a8e040, #12301a)",
  "linear-gradient(to bottom, #8f61f2, #140d33)",
];

type ApiService = { id: string; title: string; price: number; currency: string; category: string; coverUrl: string | null; creator: { id: string; name: string } };
type ApiWork = { id: string; title: string; author?: string; coverUrl?: string | null };

/** Width of the "bump" around the open slice: 0 = far away, 1 = the open slice. */
const weight = (i: number, active: number | null, sigma: number) => (active === null ? 0 : Math.exp(-((i - active) ** 2) / (2 * sigma ** 2)));

// The ribbon is drawn left -> bottom -> right -> top, so its text reads upright where it passes in front of the gallery.
// Phones get a smaller drawing, so the letters stay large enough to read.
function ribbonShape(narrow: boolean) {
  const W = narrow ? 560 : 1200;
  const H = narrow ? 420 : 560;
  const rx = narrow ? 255 : 530;
  const ry = narrow ? 70 : 86;
  const cx = W / 2;
  const cy = H / 2;
  return {
    W,
    H,
    cx,
    cy,
    d: `M ${cx - rx},${cy} A ${rx},${ry} 0 1,0 ${cx + rx},${cy} A ${rx},${ry} 0 1,0 ${cx - rx},${cy} Z`,
    tilt: narrow ? -10 : -9,
    font: narrow ? 17 : 15,
  };
}

export default function FilmStrip() {
  const [items, setItems] = useState<Item[]>([]);
  const [liveOffers, setLiveOffers] = useState(0);
  const [count, setCount] = useState(26);
  const [active, setActive] = useState<number | null>(null);
  const narrow = count <= 7;
  const [reduced, setReduced] = useState(false);
  const [touch, setTouch] = useState(false);
  const { data: session, status } = useSession();
  const loggedIn = status === "authenticated" && !!session?.user;
  const lastTouch = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyLen, setCopyLen] = useState(3000);
  const [caption, setCaption] = useState<{ x: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const slices = useRef<(HTMLAnchorElement | null)[]>([]);
  const textEl = useRef<SVGTextElement>(null);

  // the live offers (and some portfolio work for more pictures)
  useEffect(() => {
    let off = false;
    fetch("/api/explore")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (off || !d) return;
        const services: Item[] = ((d.services ?? []) as ApiService[]).map((s, i) => ({
          key: "s" + s.id,
          title: s.title,
          cover: s.coverUrl,
          gradient: GRADIENTS[i % GRADIENTS.length],
          category: s.category,
          href: `/creators/${s.creator?.id}`,
          price: s.price,
          currency: s.currency,
          cta: "See more",
        }));
        const works: Item[] = ((d.works ?? []) as ApiWork[]).map((w, i) => ({
          key: "w" + w.id,
          title: w.title,
          cover: w.coverUrl ?? null,
          gradient: GRADIENTS[(i + 2) % GRADIENTS.length],
          category: "Portfolio",
          href: "/explore",
          price: null,
          currency: "LYD",
          cta: "See more",
        }));
        setItems([...services, ...works].filter((x) => x.cover || x.title));
        setLiveOffers(services.length);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  const pictures = useMemo<Item[]>(
    () =>
      items.length
        ? items
        : GRADIENTS.map((g, i) => ({ key: "g" + i, title: "", cover: null, gradient: g, category: "", href: "/explore", price: null, currency: "LYD", cta: "See more" })),
    [items]
  );
  
  // how many slices fit the screen
  useEffect(() => {
    const fit = () => setCount(window.innerWidth < 640 ? 7 : window.innerWidth < 1024 ? 21 : 29);
    fit();
    window.addEventListener("resize", fit);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    setTouch(window.matchMedia("(hover: none)").matches);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // one copy of the ribbon sentence is a third of the text, sliding by exactly that much makes a seamless loop
  useEffect(() => {
    const el = textEl.current;
    if (!el) return;
    const t = setTimeout(() => {
      const len = el.getComputedTextLength();
      if (len > 100) setCopyLen(Math.round(len / 3));
    }, 50);
    return () => clearTimeout(t);
  }, [items, liveOffers, count]);

  // when nobody has touched it for a while, the slices open one after another
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      if (Date.now() - lastTouch.current < 6000) return;
      setActive((a) => (a === null ? Math.floor(count / 2) : (a + 1) % count));
    }, narrow ? 2400 : 2200);
    return () => clearInterval(t);
  }, [reduced, count, narrow]);

  // the line and the label follow the open slice
  useEffect(() => {
    if (active === null) return setCaption(null);
    const place = () => {
      const el = slices.current[active];
      const b = box.current;
      if (el && b) setCaption({ x: el.offsetLeft + el.offsetWidth / 2 });
    };
    place();
    const t = setTimeout(place, 520);
    return () => clearTimeout(t);
  }, [active, count]);

  // a short pause before a slice opens, so crossing the thin slices quickly does not make everything jump around
  const openSlice = (i: number, now = false) => {
    lastTouch.current = Date.now();
    if (pending.current) clearTimeout(pending.current);
    if (now) return setActive(i);
    pending.current = setTimeout(() => setActive(i), 70);
  };

  // text of the ribbon: a few hooks that make the visitor curious
  const phrases: { t: string }[] = [];
  const base = [
    { t: "Subscribe to unlock the details" },
    { t: "Meet our creators" },
    { t: "What are you hiring for?" },
    ...(liveOffers > 0 ? [{ t: liveOffers === 1 ? "1 live offer waiting for you" : `${liveOffers} live offers waiting for you` }] : []),
    { t: touch ? "Tap a slice to peek" : "Peek inside, hover any slice" },
    { t: "Real creators · real prices" },
  ];
  for (let k = 0; k < 3; k++) phrases.push(...base);

  const open = active === null ? null : pictures[active % pictures.length];

  const shape = ribbonShape(narrow);
  const ribbon = (id: string, clipId: string) => (
    <svg
      key={id}
      aria-hidden="true"
      viewBox={`0 0 ${shape.W} ${shape.H}`}
      className={`pointer-events-none absolute left-1/2 top-1/2 h-auto w-[116%] max-w-none -translate-x-1/2 -translate-y-1/2 ${id === "front" ? "z-20" : "z-0"}`}
      style={{ direction: "ltr" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="-200" y={id === "front" ? shape.cy : -200} width={shape.W + 400} height={id === "front" ? shape.H : shape.cy + 200} transform={`rotate(${shape.tilt} ${shape.cx} ${shape.cy})`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`rotate(${shape.tilt} ${shape.cx} ${shape.cy})`}>
          <path id={`loop-${id}`} d={shape.d} fill="none" strokeWidth="34" style={{ stroke: "var(--text-main)", strokeOpacity: 0.94 }} />
          <text ref={id === "front" ? textEl : undefined} fontSize={shape.font} fontWeight="600" letterSpacing="1.5" dy="5.5" style={{ fill: "var(--page-bg)", textTransform: "uppercase" }}>
            <textPath href={`#loop-${id}`} startOffset="0">
              {!reduced && <animate attributeName="startOffset" from="0" to={-copyLen} dur={`${Math.max(20, Math.round(copyLen / 70))}s`} repeatCount="indefinite" />}
              {phrases.map((p, i) => (
                <tspan key={i}>
                  <tspan style={{ unicodeBidi: "isolate" }}>{p.t}</tspan>
                  {/* the star sits between two isolated phrases, with fixed spaces, so Arabic cannot reorder it into the words */}
                  <tspan style={{ unicodeBidi: "isolate" }}>{"    ✦    "}</tspan>
                </tspan>
              ))}
            </textPath>
          </text>
        </g>
      </g>
    </svg>
  );

  return (
    <div className="relative mx-auto w-full max-w-[1164px] py-14 md:py-20" role="region" aria-label="Offers gallery">
      {ribbon("back", "clip-back")}

      <div
        ref={box}
        className="relative z-10 flex h-[340px] touch-pan-y select-none gap-[3px] md:h-[470px]"
        onPointerLeave={() => {
          if (pending.current) clearTimeout(pending.current);
        }}
        onPointerMove={(e) => {
          // a finger (or pen) sliding over the gallery opens the slice under it, like a scrub bar
          if (e.pointerType === "mouse") return;
          const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-i]");
          const i = el ? Number(el.getAttribute("data-i")) : NaN;
          if (!Number.isNaN(i)) openSlice(i, true);
        }}
      >
        {Array.from({ length: count }, (_, i) => {
          const it = pictures[i % pictures.length];
          const w = weight(i, active, narrow ? 0.6 : 1.25);
          const isOpen = i === active;
          return (
            <Link
              key={i}
              ref={(el) => {
                slices.current[i] = el;
              }}
              // signed in: the offer itself. Not signed in: the page that creates an account
              data-i={i}
              href={loggedIn ? it.href : "/signup"}
              onPointerEnter={(e) => e.pointerType !== "touch" && openSlice(i)}
              onFocus={() => openSlice(i, true)}
              onClick={(e) => {
                // on a phone the first tap opens the slice, the second one goes on
                if (!isOpen) {
                  e.preventDefault();
                  openSlice(i, true);
                }
              }}
              aria-label={it.title || it.cta}
              tabIndex={isOpen || (active === null && i === 0) ? 0 : -1}
              style={{
                flexGrow: 1 + w * (narrow ? 40 : 15),
                backgroundImage: it.cover ? `url(${it.cover})` : it.gradient,
                filter: `grayscale(${1 - Math.min(1, w * 1.4)}) brightness(${i % 2 ? 1 - 0.16 * (1 - w) : 1 + 0.08 * (1 - w)})`,
              }}
              className="relative min-w-[3px] flex-1 basis-0 overflow-hidden rounded-[3px] bg-cover bg-center outline-none transition-[flex-grow,filter] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
            >
              {isOpen && (
                <span className="absolute inset-x-0 bottom-0 flex w-full min-w-0 flex-col gap-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2 pt-14 text-left text-white md:p-4 rtl:text-right">
                  {it.title && <span className="line-clamp-3 break-words text-xs font-semibold leading-snug md:text-lg">{it.title}</span>}
                  <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] md:text-sm">
                    <span className="opacity-80">{it.price !== null ? formatPrice(it.price, it.currency) : it.category}</span>
                    <span className="rounded-full bg-[var(--brand-orange)] px-3 py-1 text-[11px] font-semibold text-white md:text-xs">{it.cta}</span>
                  </span>
                </span>
              )}
            </Link>
          );
        })}

        {/* line and label of the open slice */}
        {caption && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 -bottom-10 w-px bg-[var(--text-main)]/50 transition-[left] duration-500 ease-out"
            style={{ left: caption.x }}
          >
            {open && open.category && (
              <span className="absolute left-2 top-0 whitespace-nowrap text-[10px] font-semibold uppercase leading-4 tracking-[0.16em] text-[var(--text-main)]/80 rtl:left-auto rtl:right-2">
                {open.category}
              </span>
            )}
          </span>
        )}
      </div>

      {ribbon("front", "clip-front")}
    </div>
  );
}
