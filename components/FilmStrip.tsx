"use client";

import { useState } from "react";

const strips = [
  { name: "Strip 1", from: "#ff9447", to: "#29124d" },
  { name: "Strip 2", from: "#33ccb8", to: "#0a263d" },
  { name: "Strip 3", from: "#f273b2", to: "#380d2e" },
  { name: "Strip 4", from: "#a8e040", to: "#12301a" },
  { name: "Strip 5", from: "#8f61f2", to: "#140d33" },
];

export default function FilmStrip() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div
      className="
      mx-auto
      w-full
      max-w-[1164px]
      flex
      gap-2
      p-4
      rounded-3xl
      bg-[#12110e]
      "
      onMouseLeave={() => setActive(null)}
    >

      {strips.map((strip, index) => (

        <div
          key={strip.name}
          tabIndex={0}
          onMouseEnter={() => setActive(index)}
          onFocus={() => setActive(index)}
          onBlur={() => setActive(null)}
          style={{
            backgroundImage: `linear-gradient(to bottom, ${strip.from}, ${strip.to})`,
            flexGrow: active === index ? 6 : 1,
          }}
          className="
          h-[360px]
          md:h-[528px]
          flex-1
          basis-0
          min-w-0
          rounded-2xl
          outline-none
          transition-[flex-grow]
          duration-500
          ease-out
          "
        />

      ))}

    </div>
  );
}
