"use client";

import { useState } from "react";
import Link from "next/link";

export default function CreatorDashboardPage() {
  const [activeTab, setActiveTab] = useState("all");

  // بيانات توضيحية للمشاريع والطلبات الحالية
  const projects = [
    {
      id: "ORD-101",
      client: "TechCorp Libya",
      service: "Brand Identity Design",
      price: "1,200 LYD",
      status: "In Progress",
      deadline: "2026-09-20",
    },
    {
      id: "ORD-102",
      client: "Omar Marketing",
      service: "Social Media Campaign",
      price: "850 LYD",
      status: "Review",
      deadline: "2026-09-15",
    },
    {
      id: "ORD-103",
      client: "Zuwara Cafe",
      service: "Promotional Video",
      price: "1,500 LYD",
      status: "Completed",
      deadline: "2026-09-01",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C221E] p-6 md:p-10">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creator Dashboard</h1>
          <p className="text-sm text-[#7D6E65] mt-1">
            Welcome back! Here is an overview of your active projects and total earnings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/onboarding/creator"
            className="px-4 py-2 text-sm font-medium border border-[#D9CFC5] rounded-xl hover:border-[#C86C29] transition bg-white"
          >
            Edit Profile
          </Link>
          <button className="px-5 py-2 text-sm font-medium bg-[#C86C29] text-white rounded-xl hover:bg-[#B05B1E] transition shadow-sm">
            + New Service
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Total Revenue</p>
            <p className="text-3xl font-extrabold mt-2 text-[#2C221E]">3,550 LYD</p>
            <span className="inline-block mt-2 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-md">
              +12% from last month
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Active Orders</p>
            <p className="text-3xl font-extrabold mt-2 text-[#2C221E]">2</p>
            <span className="inline-block mt-2 text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md">
              In progress
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Completed Projects</p>
            <p className="text-3xl font-extrabold mt-2 text-[#2C221E]">18</p>
            <span className="inline-block mt-2 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              100% On-time delivery
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#EFE8E1] shadow-sm">
            <p className="text-sm font-medium text-[#7D6E65]">Rating</p>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-3xl font-extrabold text-[#2C221E]">4.9</p>
              <span className="text-amber-500 text-lg">★</span>
            </div>
            <span className="inline-block mt-2 text-xs font-semibold text-[#7D6E65]">
              Based on 24 reviews
            </span>
          </div>
        </div>

        {/* Recent Orders Section */}
        <div className="bg-white border border-[#EFE8E1] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFE8E1] pb-5 mb-6">
            <h2 className="text-xl font-bold">Recent Orders</h2>

            <div className="flex items-center gap-2 bg-[#F7F4F0] p-1 rounded-xl">
              {["all", "In Progress", "Review", "Completed"].map((tab) => (
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

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FDFBF7] text-[#7D6E65] border-b border-[#EFE8E1]">
                <tr>
                  <th className="pb-3 pt-3 px-4 font-semibold">Order ID</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Client</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Service</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Price</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Status</th>
                  <th className="pb-3 pt-3 px-4 font-semibold">Deadline</th>
                  <th className="pb-3 pt-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE8E1]">
                {projects
                  .filter((p) => activeTab === "all" || p.status === activeTab)
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-[#FDFBF7]/50 transition">
                      <td className="py-4 px-4 font-medium text-[#2C221E]">
                        {item.id}
                      </td>
                      <td className="py-4 px-4 font-medium">{item.client}</td>
                      <td className="py-4 px-4 text-[#7D6E65]">{item.service}</td>
                      <td className="py-4 px-4 font-semibold">{item.price}</td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "In Progress"
                              ? "bg-amber-100 text-amber-800"
                              : item.status === "Review"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-[#7D6E65]">{item.deadline}</td>
                      <td className="py-4 px-4 text-right">
                        <button className="text-xs font-semibold text-[#C86C29] hover:underline">
                          View Details
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