"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import InputField from "@/components/auth/InputField";
import Divider from "@/components/auth/Divider";
import GoogleButton from "@/components/auth/GoogleButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Incorrect email or password.");
        return;
      }
      // Only follow same-site paths from the callback parameter
      const safe = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//");
      router.push(safe ? callbackUrl : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="mx-auto w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black uppercase">Welcome back</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Log in to your RAW society account.</p>
      </div>

      <InputField
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <InputField
        label="Password"
        type="password"
        placeholder="Your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="h-14 w-full rounded-xl bg-[var(--brand-orange)] font-semibold text-white mt-4 transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Logging in..." : "Log in"}
      </button>

      <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-[var(--brand-orange)] hover:underline">
          Create an account
        </Link>
      </p>

      <Divider />
      <GoogleButton callbackUrl={callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard"} />
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--page-bg)] flex items-center justify-center px-6 lg:px-12 py-6">
      <AuthCard>
        <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </AuthCard>
    </main>
  );
}
