"use client";

import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="
      border-b
      border-[var(--border-default)]
      bg-[var(--page-bg)]
      relative
      z-50
      "
    >

      <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">


        {/* Logo */}
        <div
          className="
          text-3xl
          font-light
          leading-6
          tracking-wide
          "
          style={{
            opacity: 0.2
          }}
        >
          <div>RAW</div>
          <div>society</div>
        </div>



        {/* Desktop Menu */}
        <nav
          className="
          hidden
          md:flex
          gap-10
          text-base
          font-medium
          text-[var(--text-main)]
          "
        >
          <a href="#">Browse</a>
          <a href="#">How it works</a>
          <a href="#">Creators</a>
        </nav>




        {/* Desktop Button */}
        <button
          className="
            hidden
            md:block
            px-3
            py-1
            rounded-full
            border
            border-[var(--brand-dark)]
            text-[var(--brand-dark)]
            text-center
            text-[24px]
            font-normal
            transition-all
            duration-300
            hover:bg-[var(--home-icon-bg)]
          "
        >
          Get Started
        </button>




        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpen(!open)}
          className="
          md:hidden
          text-3xl
          text-[var(--text-muted)]
          "
        >
          {open ? "✕" : "☰"}
        </button>


      </div>





      {/* Mobile Dropdown */}
      <div
        className={`
          md:hidden
          absolute
          top-20
          left-0
          w-full
          bg-[var(--page-bg)]
          border-b
          border-[var(--border-default)]
          transition-all
          duration-300
          overflow-hidden

          ${
            open
              ? "max-h-96 opacity-100"
              : "max-h-0 opacity-0"
          }
        `}
      >


        <nav
          className="
          flex
          flex-col
          gap-6
          px-8
          py-8
          text-lg
          text-[var(--text-main)]
          "
        >

          <a href="#">
            Browse
          </a>


          <a href="#">
            How it works
          </a>


          <a href="#">
            Creators
          </a>



          <button
            className="
              mt-2
              px-6
              py-3
              rounded-full
              border
              border-[var(--brand-dark)]
              text-[var(--brand-dark)]
              text-lg
            "
          >
            Get Started
          </button>


        </nav>


      </div>


    </header>
  );
}