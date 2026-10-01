"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // قراءة الخطة والسعر القادمين من صفحة الخطط
  const selectedPlan = searchParams.get("plan") || "pro";
  const selectedPrice = searchParams.get("price") || "";

  const [nickname, setNickname] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("All fields");
  const [companySize, setCompanySize] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill with the saved profile (for returning users)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/client")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const p = data?.profile;
        if (cancelled || !p) return;
        setNickname(p.nickname);
        setCompany(p.company);
        setIndustry(p.industry || "All fields");
        setCompanySize(p.companySize);
        setServices(p.services);
        setBudget(p.budget);
        setDescription(p.description);
        if (p.logoUrl) setLogo(p.logoUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogo(URL.createObjectURL(file));
    }
  };

  const toggleService = (item: string) => {
    setServices((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handleNext = async (skip = false) => {
    setError("");
    setSaving(true);
    try {
      // حفظ الملف الشخصي في قاعدة البيانات
      const form = new FormData();
      if (skip) form.set("skip", "1");
      if (!skip) {
        form.set("nickname", nickname);
        form.set("company", company);
        form.set("industry", industry);
        form.set("companySize", companySize);
        form.set("budget", budget);
        form.set("description", description);
        services.forEach((s) => form.append("services", s));
        if (logoFile) form.set("logo", logoFile);
      }

      const res = await fetch("/api/profile/client", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Please log in first to save your profile."
            : data.error || "Could not save your profile."
        );
        return;
      }

      // بناء الرابط ونقل معامل price مع plan
      const queryParams = new URLSearchParams({
        role: "client",
        plan: selectedPlan,
      });

      if (selectedPrice) {
        queryParams.set("price", selectedPrice);
      }

      router.push(`/onboarding/payment?${queryParams.toString()}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-10">
      <p>Step 2 of 5</p>

      <div className="h-2 bg-orange-100 dark:bg-orange-500/20 rounded-full mt-2 mb-8">
        <div className="h-2 w-2/5 bg-orange-500 rounded-full" />
      </div>

      <h1 className="text-4xl font-bold mb-2">
        Set up your client profile
      </h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        Nothing here is required. If you skip, your profile uses your account name, a default picture, all fields and no budget. You can change it later.
      </p>

      {/* Logo Upload */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="w-[88px] h-[88px] rounded-2xl bg-[var(--profile-logo-bg)] overflow-hidden flex items-center justify-center">
            {logo ? (
              <img
                src={logo}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-[var(--profile-icon)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                />
              </svg>
            )}
          </div>

          <div className="flex flex-col justify-center">
            <label
              htmlFor="logo-upload"
              className="inline-flex h-[37px] w-fit cursor-pointer items-center rounded-lg border-[1.5px] border-[#352524] px-4 py-[10px] text-sm font-medium text-var(--profile-input-txt) hover:bg-[#352524] hover:text-white transition"
            >
              Upload logo
            </label>

            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />

            <p className="mt-2 text-[12px] leading-none font-normal text-[var(--text-muted)]">
              Company logo or your photo
            </p>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div>
          <label className="block mb-2 text-sm font-medium text-var(--profile-input-txt)">
            Nickname
          </label>

          <input
            className="w-full h-12 rounded-xl border border-[var(--ui-input)] bg-[var(--profile-input-bg)] px-4 text-[var(--profile-input-txt)] placeholder:text-[var(--profile-placeholder-txt)] outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 transition"
            placeholder="Nickname"
            value={nickname}
            maxLength={60}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-var(--profile-input-txt)">
            Company
          </label>

          <input
            className="w-full h-12 rounded-xl border border-[var(--ui-input)] bg-[var(--profile-input-bg)] px-4 text-[var(--profile-input-txt)] placeholder:text-[var(--profile-placeholder-txt)] outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 transition"
            placeholder="Company name"
            value={company}
            maxLength={160}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-var(--profile-input-txt)">
            Industry
          </label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className={`w-full h-12 rounded-xl border border-[var(--border-default)] bg-[var(--profile-input-bg)] px-4 outline-none transition ${
              industry
                ? "text-[var(--ui-text)] dark:text-white"
                : "text-[var(--text-placeholder)]"
            } focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/20`}
          >
            <option value="All fields">All fields</option>
            <option>Technology</option>
            <option>Marketing & Advertising</option>
            <option>Design & Creative</option>
            <option>E-commerce</option>
            <option>Finance</option>
          </select>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-var(--profile-input-txt)">
            Company Size
          </label>

          <select
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className={`w-full h-12 rounded-xl border border-[var(--ui-input)] bg-[var(--profile-input-bg)] px-4 outline-none focus:border-[#C86L29] focus:ring-2 focus:ring-[#C86C29]/20 transition ${
              companySize
                ? "text-[var(--ui-text)] dark:text-white"
                : "text-[var(--text-placeholder)]"
            } focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/20`}
          >
            <option value="">Company Size</option>
            <option>1 - 10</option>
            <option>11 - 50</option>
            <option>51 - 200</option>
            <option>200+</option>
          </select>
        </div>
      </div>

      {/* Services */}
      <div className="mt-8">
        <label className="block mb-4 text-sm font-medium text-var(--profile-input-txt)">
          What services do you need?
        </label>

        <div className="grid grid-cols-2 gap-4">
          {["Design", "Web Development", "Photography", "Writing"].map(
            (item) => (
              <label
                key={item}
                className="flex items-center gap-3 h-12 px-4 rounded-xl border border-[var(--ui-input)] bg-[var(--profile-input-bg)] cursor-pointer hover:border-[#C86C29] transition"
              >
                <input
                  type="checkbox"
                  checked={services.includes(item)}
                  onChange={() => toggleService(item)}
                  className="peer h-5 w-5 appearance-none rounded-md border-2 border-[var(--brand-orange)] checked:bg-[var(--brand-orange)] checked:border-[var(--brand-orange)] relative cursor-pointer after:hidden checked:after:block checked:after:absolute checked:after:left-[3px] checked:after:top-[-1px] checked:after:text-white checked:after:content-['✓']"
                />

                <span className="text-sm text-var(--profile-input-txt) peer-checked:text-[var(--brand-orange)]">
                  {item}
                </span>
              </label>
            )
          )}
        </div>
      </div>

      {/* Budget */}
      <div className="mt-8">
        <label className="block mb-2 text-sm font-medium text-var(--profile-input-txt)">
          Budget
        </label>

        <select
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className={`w-full h-12 rounded-xl border border-[var(--ui-input)] bg-[var(--profile-input-bg)] px-4 text-[var(--profile-placeholder-txt)] outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 transition ${
            budget
              ? "text-[var(--profile-input-bg)]"
              : "text-[var(--text-placeholder)]"
          } focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/20`}
        >
          <option value="">Not specified</option>
          <option>Less than 1000 LYD</option>
          <option>1000 - 5000 LYD</option>
          <option>5000+ LYD</option>
        </select>
      </div>

      {/* Description */}
      <div className="mt-8">
        <label className="block mb-2 text-sm font-medium text-[var(--profile-placeholder-txt)]">
          Tell us about your project
        </label>

        <textarea
          rows={5}
          className="w-full rounded-xl border border-[var(--ui-input)] bg-[var(--profile-input-bg)] p-4 text-[var(--profile-input-txt)] placeholder:text-[var(--profile-placeholder-txt)] outline-none focus:border-[#C86C29] focus:ring-2 focus:ring-[#C86C29]/20 transition resize-none"
          placeholder="Tell creators what kind of work you usually need…"
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm font-medium text-red-600 dark:text-red-400">
          {error}{" "}
          {error.startsWith("Please log in") && (
            <a href="/login" className="underline">
              Log in
            </a>
          )}
        </p>
      )}

      <div className="flex justify-between mt-8">
        <button
          onClick={() => router.back()}
          className="px-6 py-3 rounded border border-[var(--border-default)] text-[var(--profile-input-txt)] hover:border-[var(--brand-orange)] transition"
        >
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNext(true)}
            disabled={saving}
            className="px-6 py-3 rounded border border-[var(--border-default)] font-medium hover:border-[var(--brand-orange)] transition disabled:opacity-60"
          >
            Skip
          </button>
          <button
            onClick={() => handleNext()}
            disabled={saving}
            className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:opacity-90 px-8 py-3 rounded disabled:opacity-60"
          >
            {saving ? "Saving..." : "Next"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <ProfilePageContent />
    </Suspense>
  );
}