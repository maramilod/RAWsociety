"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function CreatorProfileSetup() {
  const router = useRouter();
  const { data: session } = useSession();

  const [formData, setFormData] = useState({
    category: "",
    bio: "",
    avatar: null as File | null,
    cover: null as File | null,
    cv: null as File | null,
    portfolioLinks: [""],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Files already saved on the server (shown when the user comes back to edit)
  const [saved, setSaved] = useState<{ avatar: string | null; cover: string | null; cvName: string | null }>({
    avatar: null,
    cover: null,
    cvName: null,
  });

  // What the chosen pictures look like: the new file if there is one, otherwise the saved picture
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!formData.avatar) return setAvatarPreview(null);
    const url = URL.createObjectURL(formData.avatar);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [formData.avatar]);
  useEffect(() => {
    if (!formData.cover) return setCoverPreview(null);
    const url = URL.createObjectURL(formData.cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [formData.cover]);
  const avatarSrc = avatarPreview ?? saved.avatar;
  const coverSrc = coverPreview ?? saved.cover;

  // Pre-fill with the saved profile (for returning users)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/creator")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const p = data?.profile;
        if (cancelled || !p) return;
        setFormData((prev) => ({
          ...prev,
          category: p.category,
          bio: p.bio,
          portfolioLinks: p.portfolioLinks.length ? p.portfolioLinks : [""],
        }));
        setSaved({ avatar: p.avatarUrl ?? null, cover: p.coverUrl ?? null, cvName: p.cvName });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // حفظ الملف الشخصي في قاعدة البيانات
      const body = new FormData();
      body.set("category", formData.category);
      body.set("bio", formData.bio);
      formData.portfolioLinks.forEach((l) => body.append("links", l));
      if (formData.avatar) body.set("avatar", formData.avatar);
      if (formData.cover) body.set("cover", formData.cover);
      if (formData.cv) body.set("cv", formData.cv);

      const res = await fetch("/api/profile/creator", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Please log in first to save your profile."
            : data.error || "Could not save your profile."
        );
        return;
      }
      // الانتقال للخطوة التالية: اختيار الخطة
      router.push("/onboarding/payout");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 min-h-screen">
      {/* Progress Bar */}
      <div className="mb-8">
        <p className="text-xs uppercase font-semibold text-[var(--text-muted)] tracking-wider">
          Step 2 of 5
        </p>
        <div className="h-2 bg-[var(--ui-soft)] rounded-full my-3 overflow-hidden">
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

          {/* The profile header as visitors will see it: the cover with the picture on top of it */}
          <div className="overflow-hidden rounded-2xl border border-[var(--ui-border2)] bg-[var(--ui-surface)]">
            <div
              className="relative h-40 w-full cursor-pointer bg-[var(--ui-soft)] bg-cover bg-center transition hover:opacity-90"
              style={coverSrc ? { backgroundImage: `url(${coverSrc})` } : undefined}
            >
              {!coverSrc && (
                <span className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-[var(--ui-border2)] text-xs font-semibold text-[var(--ui-muted)]">
                  Click to upload Cover Banner
                </span>
              )}
              {coverSrc && (
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">
                  {formData.cover ? formData.cover.name : "Cover saved - click to replace"}
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                aria-label="Cover banner"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => setFormData({ ...formData, cover: e.target.files?.[0] || null })}
              />
            </div>

            <div className="flex items-end gap-4 px-6 pb-5">
              <div className="relative -mt-10 h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-4 border-[var(--ui-surface)] bg-[var(--ui-soft)] shadow-md">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="Your profile picture" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-bold text-[var(--ui-muted)]">Avatar</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Profile picture"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.files?.[0] || null })}
                />
              </div>
              <div className="min-w-0 pt-3">
                <p className="truncate text-lg font-bold">{session?.user?.name || "Your name"}</p>
                <p className="truncate text-sm text-[var(--text-muted)]">{formData.category || "Your specialty"}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Upload a clear profile picture (JPG, PNG). This is how your profile header will look.</p>
        </div>

        {/* Primary Field */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider mb-2">
            Primary Specialty
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full h-14 px-4 rounded-xl border border-[var(--ui-border2)] bg-[var(--ui-soft)] text-[var(--ui-text)] font-medium focus:bg-white focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/20 outline-none transition"
            required
          >
            <option value="" disabled className="text-[var(--ui-muted)]">
              Select your field
            </option>
            {categories.map((cat) => (
              <option key={cat} value={cat} className="text-[var(--ui-text)] bg-[var(--ui-surface)] py-2">
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
            className="w-full p-4 rounded-xl border border-[var(--ui-border2)] focus:ring-2 focus:ring-[var(--brand-orange)] outline-none resize-none"
          />
        </div>

        {/* CV Upload */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider mb-2">
            Upload CV / Resume (PDF)
          </label>
          <div className="relative border-2 border-dashed border-[var(--ui-border2)] rounded-xl p-4 text-center cursor-pointer hover:bg-[var(--ui-soft)] transition">
            <p className="text-sm text-[var(--ui-muted)] font-medium">
              {formData.cv ? formData.cv.name : saved.cvName ? `${saved.cvName} (saved) - click to replace` : "Click to upload CV file (PDF)"}
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
              className="w-full h-12 px-4 mb-3 rounded-xl border border-[var(--ui-border2)] focus:ring-2 focus:ring-[var(--brand-orange)] outline-none text-sm"
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

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}{" "}
            {error.startsWith("Please log in") && (
              <a href="/login" className="underline">
                Log in
              </a>
            )}
          </p>
        )}

        {/* Action Button */}
        <div className="flex justify-between items-center pt-6 border-t border-[var(--ui-border2)]">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl border border-[var(--ui-border2)] font-medium hover:bg-[var(--ui-soft)] transition"
          >
            Back
          </button>

          <button
            type="submit"
            disabled={saving}
            className="h-14 px-8 rounded-xl bg-[var(--brand-orange)] font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </div>
      </form>
    </main>
  );
}