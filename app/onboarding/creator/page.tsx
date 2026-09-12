"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatorProfileSetup() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    category: "",
    bio: "",
    avatar: null as File | null,
    cover: null as File | null,
    cv: null as File | null,
    portfolioLinks: [""],
  });

  const categories = [
    "Graphic Design & Branding",
    "UI/UX Design",
    "Video Editing & Motion",
    "3D & Animation",
    "Software & Web Development",
    "Photography & Videography",
  ];

  const handleLinkChange = (index: number, value: string) => {
    const updatedLinks = [...formData.portfolioLinks];
    updatedLinks[index] = value;
    setFormData({ ...formData, portfolioLinks: updatedLinks });
  };

  const addLinkInput = () => {
    setFormData({
      ...formData,
      portfolioLinks: [...formData.portfolioLinks, ""],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // الانتقال للخطوة التالية: اختيار الخطة
    router.push("/onboarding/plan?role=creator");
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 min-h-screen">
      {/* Progress Bar */}
      <div className="mb-8">
        <p className="text-xs uppercase font-semibold text-[var(--text-muted)] tracking-wider">
          Step 2 of 5
        </p>
        <div className="h-2 bg-gray-200 rounded-full my-3 overflow-hidden">
          <div className="h-2 w-2/5 bg-[var(--brand-orange)] rounded-full transition-all duration-300" />
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black uppercase">
          Set up your creator profile
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Showcase your personal brand, primary specialty, and portfolio to stand out.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Cover & Avatar Upload */}
        <div className="space-y-4">
          <label className="block text-sm font-bold uppercase tracking-wider">
            Brand Visuals (Cover & Avatar)
          </label>

          <div className="relative w-full h-40 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden hover:bg-gray-50 transition cursor-pointer">
            <span className="text-xs font-semibold text-gray-500">
              {formData.cover ? formData.cover.name : "Click to upload Cover Banner"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) =>
                setFormData({ ...formData, cover: e.target.files?.[0] || null })
              }
            />
          </div>

          <div className="flex items-center gap-4 -mt-10 px-6">
            <div className="relative w-20 h-20 bg-white rounded-full border-4 border-white shadow-md flex items-center justify-center overflow-hidden bg-gray-200 cursor-pointer">
              <span className="text-[10px] font-bold text-gray-500 text-center px-1">
                {formData.avatar ? "Uploaded" : "Avatar"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) =>
                  setFormData({ ...formData, avatar: e.target.files?.[0] || null })
                }
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] pt-8">
              Upload a clear profile picture (JPG, PNG).
            </p>
          </div>
        </div>

        {/* Primary Field */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider mb-2">
            Primary Specialty
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full h-14 px-4 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 font-medium focus:bg-white focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/20 outline-none transition"
            required
          >
            <option value="" disabled className="text-gray-400">
              Select your field
            </option>
            {categories.map((cat) => (
              <option key={cat} value={cat} className="text-gray-900 bg-white py-2">
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider mb-2">
            Bio / About You
          </label>
          <textarea
            rows={3}
            placeholder="Tell clients about your creative style, experience, and skills..."
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[var(--brand-orange)] outline-none resize-none"
          />
        </div>

        {/* CV Upload */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider mb-2">
            Upload CV / Resume (PDF)
          </label>
          <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition">
            <p className="text-sm text-gray-600 font-medium">
              {formData.cv ? formData.cv.name : "Click to upload CV file (PDF)"}
            </p>
            <input
              type="file"
              accept=".pdf"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) =>
                setFormData({ ...formData, cv: e.target.files?.[0] || null })
              }
            />
          </div>
        </div>

        {/* Portfolio Links */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider mb-2">
            Portfolio / Work Links (Behance, Dribbble, GitHub, Drive)
          </label>
          {formData.portfolioLinks.map((link, idx) => (
            <input
              key={idx}
              type="url"
              placeholder="https://"
              value={link}
              onChange={(e) => handleLinkChange(idx, e.target.value)}
              className="w-full h-12 px-4 mb-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[var(--brand-orange)] outline-none text-sm"
            />
          ))}
          <button
            type="button"
            onClick={addLinkInput}
            className="text-xs font-bold text-[var(--brand-orange)] hover:underline"
          >
            + Add another link
          </button>
        </div>

        {/* Action Button */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl border border-gray-300 font-medium hover:bg-gray-50 transition"
          >
            Back
          </button>

          <button
            type="submit"
            className="h-14 px-8 rounded-xl bg-[var(--brand-orange)] font-semibold text-white hover:opacity-90 transition"
          >
            Continue to Plans
          </button>
        </div>
      </form>
    </main>
  );
}