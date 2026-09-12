"use client";

import { useState } from "react";
import Link from "next/link";

export default function ClientDashboardPage() {
  const [activeTab, setActiveTab] = useState("all");

  // بيانات توضيحية لطلبات العميل
  const activeOrders = [
    {
      id: "ORD-101",
      creator: "Sarah Al-Mansi",
      role: "UGC Creator & Video Editor",
      service: "Brand Promotion Reel",
      amount: "650 LYD",
      status: "In Progress",
      deliveryDate: "2026-09-18",
    },
    {
      id: "ORD-104",
      creator: "Ahmed Zuwara",
      role: "Graphic Designer",
      service: "Product Packaging Design",
      amount: "1,100 LYD",
      status: "Pending Approval",
      deliveryDate: "2026-09-12",
    },
    {
      id: "ORD-098",
      creator: "Laila K.",
      role: "Content Strategist",
      service: "Social Media Strategy",
      amount: "800 LYD",
      status: "Completed",
      deliveryDate: "2026-08-30",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C221E] p-6 md:p-10">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Dashboard</h1>
          <p className="text-sm text-[#7D6E65] mt-1">
            Manage your hired creators, ongoing orders, and active creative requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/onboarding/client"
            className="px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-[#C86C29] transition bg-white"
          >
            Manage Profile
          </Link>
          <Link
            href="/creators"
            className="px-5 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition shadow-sm"
          >
            Find Creators
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Active Orders</p>
            <p className="text-3xl font-extrabold mt-2 text-[#2C221E]">2</p>
            <span className="inline-block mt-2 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
              In production
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Total Investment</p>
            <p className="text-3xl font-extrabold mt-2 text-[#2C221E]">2,550 LYD</p>
            <span className="inline-block mt-2 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-md">
              Across 3 campaigns
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Hired Creators</p>
            <p className="text-3xl font-extrabold mt-2 text-[#2C221E]">3</p>
            <span className="inline-block mt-2 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
              Verified professionals
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Saved Creators</p>
            <p className="text-3xl font-extrabold mt-2 text-[#2C221E]">12</p>
            <span className="inline-block mt-2 text-xs font-semibold text-[#7D6E65] bg-[#F7F4F0] px-2.5 py-1 rounded-md">
              In your bookmarks
            </span>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-[#EFE8E1] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFE8E1] pb-5 mb-6">
            <h2 className="text-xl font-bold">Your Orders</h2>

            <div className="flex items-center gap-2 bg-[#F7F4F0] p-1 rounded-xl">
              {["all", "In Progress", "Pending Approval", "Completed"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition ${
                    activeTab === tab
                      ? "bg-white text-[#2C221E] shadow-sm"
                      : "text-[#7D6E65] hover:text-[#2C221E]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FDFBF7] text-[#7D6E65] border-b border-[#EFE8E1]">
                <tr>
                  <th className="pb-3 pt-3 px-4 font-semibold">Order ID</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Creator</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Service</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Amount</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Status</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Expected Delivery</th>
                  <th className="pb-3 pt-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE8E1]">
                {activeOrders
                  .filter((item) => activeTab === "all" || item.status === activeTab)
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-[#FDFBF7]/50 transition">
                      <td className="py-4 px-4 font-medium text-[#2C221E]">
                        {item.id}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-[#2C221E]">{item.creator}</div>
                        <div className="text-xs text-[#7D6E65]">{item.role}</div>
                      </td>
                      <td className="py-4 px-4 text-[#7D6E65]">{item.service}</td>
                      <td className="py-4 px-4 font-semibold">{item.amount}</td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "In Progress"
                              ? "bg-amber-100 text-amber-800"
                              : item.status === "Pending Approval"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-[#7D6E65]">{item.deliveryDate}</td>
                      <td className="py-4 px-4 text-right">
                        <button className="text-xs font-semibold text-[#C86C29] hover:underline">
                          View Order
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}