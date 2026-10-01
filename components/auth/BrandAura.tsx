"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";

// The brand side of the sign-up page: a warm aura that follows the mouse, with the specialties floating above it.
// A big soft glow trails the pointer, a small bright core is faster, clicking sends out a ripple, the cards tilt in 3D
// with the mouse and the mouse wheel spins them. Without the mouse the aura slowly drifts on its own.

// the colours of the site: brand orange, amber, terracotta and a dusty rose
const COLORS = ["#C86C29", "#E58B4A", "#8E3B1F", "#D98B7A"];

const CARDS = [
  { title: "Brand identity", from: "#D97A35", to: "#3B1409", z: 40, x: -46, y: 34, r: -8 },
  { title: "UI/UX design", from: "#C98A64", to: "#4A1D12", z: 110, x: 0, y: -8, r: 3 },
  { title: "Photography", from: "#B5524A", to: "#2C0F0F", z: 180, x: 46, y: -50, r: 10 },
];

type Ripple = { id: number; x: number; y: number };

export default function BrandAura() {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  // pointer position in pixels inside the panel
  const px = useMotionValue(200);
  const py = useMotionValue(300);
  const hue = useMotionValue(0);

  const glowX = useSpring(px, { stiffness: 55, damping: 17, mass: 1.1 });
  const glowY = useSpring(py, { stiffness: 55, damping: 17, mass: 1.1 });
  const coreX = useSpring(px, { stiffness: 220, damping: 22 });
  const coreY = useSpring(py, { stiffness: 220, damping: 22 });
  const hueSpring = useSpring(hue, { stiffness: 50, damping: 15 });
  const spin = useMotionValue(0);
  const spinSpring = useSpring(spin, { stiffness: 60, damping: 14 });
  // 3D tilt of the cards, from the pointer position
  const tx = useTransform(glowX, (v) => (v / (box.current?.clientWidth || 400)) - 0.5);
  const ty = useTransform(glowY, (v) => (v / (box.current?.clientHeight || 600)) - 0.5);
  const rotateY = useTransform([tx, spinSpring], ([x, sp]: number[]) => x * 38 + sp);
  const rotateX = useTransform(ty, [-0.5, 0.5], [14, -14]);
  const shiftX = useTransform(tx, [-0.5, 0.5], [26, -26]);
  const shiftY = useTransform(ty, [-0.5, 0.5], [20, -20]);
  const filter = useMotionTemplate`hue-rotate(${hueSpring}deg) saturate(1.25)`;

  // the logo and the text lean a little away from the pointer, like they float above the glow
  const leanX = useTransform(glowX, (v) => (v - (box.current?.clientWidth ?? 400) / 2) * -0.04);
  const leanY = useTransform(glowY, (v) => (v - (box.current?.clientHeight ?? 600) / 2) * -0.03);

  const center = () => {
    const b = box.current;
    if (!b) return;
    px.set(b.clientWidth / 2);
    py.set(b.clientHeight / 2);
  };
  useEffect(() => {
    center();
    window.addEventListener("resize", center);
    return () => window.removeEventListener("resize", center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const at = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
  };

  return (
    <div
      ref={box}
      onPointerMove={(e) => {
        const p = !reduce && at(e);
        if (p) {
          px.set(p.x);
          py.set(p.y);
        }
      }}
      onPointerLeave={center}
      onPointerDown={(e) => {
        const p = !reduce && at(e);
        if (!p) return;
        const id = nextId.current++;
        setRipples((r) => [...r.slice(-4), { id, ...p }]);
        setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 1400);
      }}
      onWheel={(e) => {
        if (reduce) return;
        const d = Math.max(-80, Math.min(80, e.deltaY));
        hue.set(hue.get() + d * 0.5);
        spin.set(spin.get() + d * 0.6);
      }}
      className="relative flex h-full min-h-[560px] w-full select-none flex-col items-center justify-center overflow-hidden rounded-3xl"
      style={{ perspective: 1100 }}
    >
      {/* the aura */}
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ filter }}>
        {/* slow ambient colours, they drift even when nobody moves the mouse */}
        {COLORS.map((c, i) => (
          <motion.div
            key={c}
            className="absolute h-64 w-64 rounded-full opacity-40 blur-3xl"
            style={{ background: c, left: `${12 + i * 22}%`, top: `${18 + ((i * 37) % 60)}%` }}
            animate={reduce ? undefined : { x: [0, 40 * (i % 2 ? -1 : 1), -30, 0], y: [0, -50, 30 * (i % 2 ? 1 : -1), 0], scale: [1, 1.2, 0.9, 1] }}
            transition={{ duration: 14 + i * 3, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

        {/* the glow that trails the pointer */}
        <motion.div className="absolute left-0 top-0 h-[22rem] w-[22rem]" style={{ x: glowX, y: glowY, marginLeft: -176, marginTop: -176 }}>
          <motion.div
            className="h-full w-full rounded-full opacity-70 blur-[60px]"
            style={{ background: `conic-gradient(from 0deg, ${COLORS.join(", ")}, ${COLORS[0]})` }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>

        {/* the small bright core */}
        <motion.div
          className="absolute left-0 top-0 h-28 w-28 rounded-full blur-2xl"
          style={{ x: coreX, y: coreY, marginLeft: -56, marginTop: -56, background: "radial-gradient(circle, rgba(255,236,214,0.9), rgba(229,139,74,0.35) 45%, transparent 70%)" }}
        />

        {/* ripples from clicks */}
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="absolute rounded-full border border-[#E58B4A]/70"
            style={{ left: r.x, top: r.y, translateX: "-50%", translateY: "-50%" }}
            initial={{ width: 10, height: 10, opacity: 0.9 }}
            animate={{ width: 360, height: 360, opacity: 0 }}
            transition={{ duration: 1.3, ease: "easeOut" }}
          />
        ))}
      </motion.div>

      {/* readable layer on top of the colours */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[var(--page-bg)]/35" aria-hidden="true" />

      <motion.div className="relative z-10 flex w-full flex-col items-center px-6" style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
        <motion.div style={{ x: leanX, y: leanY, z: 90 }}>
          <h1 translate="no" className="font-logo text-center text-6xl font-light leading-[1.02] tracking-wide text-[var(--brand-dark)] drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)]">
            RAW <br /> society
          </h1>
        </motion.div>
        <motion.p style={{ z: 50 }} className="mt-6 max-w-xs text-center font-medium text-[var(--text-main)]/80">
          A creative space connecting creators with opportunities.
        </motion.p>

        <div className="relative mt-10 h-56 w-full" style={{ transformStyle: "preserve-3d" }}>
          {CARDS.map((c) => (
            <FloatingCard key={c.title} card={c} px={shiftX} py={shiftY} reduce={!!reduce} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

type Card = (typeof CARDS)[number];

// one floating card: the closer it is to the viewer, the more it slides with the mouse
function FloatingCard({ card, px, py, reduce }: { card: Card; px: MotionValue<number>; py: MotionValue<number>; reduce: boolean }) {
  const depth = card.z / 180;
  const x = useTransform(px, (v) => v * depth);
  const y = useTransform(py, (v) => v * depth);
  return (
    <motion.div
      className="absolute h-32 w-44 overflow-hidden rounded-2xl border border-white/20 shadow-[0_24px_50px_rgba(0,0,0,0.35)]"
      style={{
        left: `calc(50% - 5.5rem + ${card.x}px)`,
        top: `calc(50% - 4rem + ${card.y}px)`,
        x,
        y,
        z: card.z,
        rotateZ: card.r,
        backgroundImage: `linear-gradient(150deg, ${card.from}, ${card.to})`,
      }}
      whileHover={reduce ? undefined : { scale: 1.08 }}
    >
      <div className="flex h-full flex-col justify-between p-4 text-white">
        <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">{card.title}</span>
        <div className="space-y-1.5">
          <div className="h-1.5 w-4/5 rounded-full bg-white/60" />
          <div className="h-1.5 w-3/5 rounded-full bg-white/35" />
        </div>
      </div>
    </motion.div>
  );
}
