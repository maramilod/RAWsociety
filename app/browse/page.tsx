"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function BrowseFreePlanPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#1c1917] flex flex-col items-center">
      <div className="w-full max-w-md bg-[#f7f5f0] min-h-screen border-x border-[#e5e0d8]">
        
        {/* Navbar */}
        <header className="px-5 py-4 border-b border-[#e5e0d8] flex justify-between items-center bg-[#f7f5f0]">
          <Link href="/" className="font-serif font-black text-base tracking-tight leading-none">
            RAW<br />society
          </Link>
          <button className="p-1 focus:outline-none">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        {/* Free Plan Alert Banner */}
        <div className="bg-[#f7e8e8] p-4 border-b border-[#ebd3d3]">
          <p className="text-xs text-[#4a3232] leading-tight mb-2">
            You're on the Free plan — portfolios are locked. Upgrade from 30 LYD/month.
          </p>
          <Link href="/onboarding/plans">
            <button className="px-3 py-1.5 bg-[#c86d38] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition">
              See plans
            </button>
          </Link>
        </div>

        <main className="p-5">
          <h1 className="text-xl font-serif font-bold uppercase tracking-wide mb-4">
            BROWSE CREATORS
          </h1>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 mb-6">
            {["All", "Design", "Photo", "Dev"].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeCategory === cat
                    ? "bg-[#1c1917] text-white"
                    : "bg-white border border-[#e5e0d8] text-[#44403c]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Creator Card 1 - Wireframe view */}
          <div className="bg-white border border-[#e5e0d8] rounded-2xl overflow-hidden mb-4 shadow-sm">
            <div className="h-40 bg-[#f0eae1] relative flex items-center justify-center">
              {/* Wireframe Placeholder Cross lines */}
              <svg className="w-full h-full text-[#d8d0c5]" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="0.5" />
                <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.5" />
              </svg>
            </div>
            <div className="p-4 flex items-center justify-between border-t border-[#f0eae1]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#e8e3de]" />
                <div>
                  <h3 className="font-bold text-xs">Sara M.</h3>
                  <p className="text-[10px] text-gray-500">Photographer · 60 LYD/hr</p>
                </div>
              </div>
              <button className="px-3 py-1.5 bg-[#eae7e1] text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed">
                Message · Pro
              </button>
            </div>
          </div>

          {/* Creator Card 2 - Locked Blur Portfolio */}
          <div className="bg-white border border-[#e5e0d8] rounded-2xl overflow-hidden mb-6 shadow-sm">
            <div className="h-40 bg-gradient-to-r from-[#f0dcd0] to-[#d8d8d8] backdrop-blur-md relative flex flex-col items-center justify-center gap-2">
              <svg className="w-6 h-6 text-[#1c1917]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-bold text-[#1c1917]">Upgrade to view portfolio</span>
            </div>
            <div className="p-4 flex items-center justify-between border-t border-[#f0eae1]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#e8e3de]" />
                <div>
                  <h3 className="font-bold text-xs">Omar K.</h3>
                  <p className="text-[10px] text-gray-500">UI/UX Designer · 75 LYD/hr</p>
                </div>
              </div>
              <button className="px-3 py-1.5 bg-[#eae7e1] text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed">
                Message · Pro
              </button>
            </div>
          </div>

          {/* Locked Load More */}
          <button className="w-full py-3 bg-[#e8e3de] text-[#68625d] text-xs font-bold rounded-xl flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Load more — Pro feature</span>
          </button>
        </main>
      </div>
    </div>
  );
}