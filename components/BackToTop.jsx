"use client";

import { useEffect, useState } from "react";

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const scrollHandler = () => {
      const scroll =
        document.documentElement.scrollTop ||
        document.body.scrollTop;

      setShow(scroll > 200);
    };

    window.addEventListener("scroll", scrollHandler, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", scrollHandler);
    };
  }, []);


  return (
    <button
      onClick={() => {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }}
      className={`
        fixed right-5 bottom-5
        z-[9999]
        w-12 h-12
        rounded-full
        bg-[var(--cta-bg)]
        text-[#FBF8F6]
        flex items-center justify-center
        transition-all duration-300
        ${show ? "opacity-100" : "opacity-0 pointer-events-none"}
      `}
    >
      RAW
    </button>
  );
}