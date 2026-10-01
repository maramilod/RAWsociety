"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState, Suspense } from "react";
import AuthCard from "@/components/auth/AuthCard";
import InputField from "@/components/auth/InputField";
import Divider from "@/components/auth/Divider";
import GoogleButton from "@/components/auth/GoogleButton";
import RoleCard from "@/components/auth/RoleCard"; // استدعاء RoleCard مباشرة
import { useRouter, useSearchParams } from "next/navigation";
import RawAnimation from "@/components/auth/RawAnimation";

// مكون النموذج الداخلي
function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRole = searchParams.get("role");

  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>(urlRole || "client");

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

  useEffect(() => {
    if (urlRole) {
      setSelectedRole(urlRole);
    }
  }, [urlRole]);

 
const goToOnboarding = () => {
  if (selectedRole === "creator") {
    // توجيه الكريتور أولاً لإعداد الملف الشخصي، الهوية البصرية، والـ CV
    router.push("/onboarding/creator");
  } else {
    // توجيه العميل مباشرة لصفحة الخطط
    router.push("/onboarding/plan?role=client");
  }
};

const handleNextStep = async () => {
  setError("");

  // Already signed in (for example with Google): nothing to create,
  // but only if the chosen role matches the account
  if (session?.user) {
    if (session.user.role !== selectedRole) {
      setError(
        `You are logged in as a ${session.user.role} (${session.user.email}). ` +
          `To create a ${selectedRole} account, log out first and sign up with another email.`
      );
      return;
    }
    goToOnboarding();
    return;
  }

  setLoading(true);
  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: selectedRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not create the account.");
      return;
    }

    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (login?.error) {
      setError("Account created, but automatic login failed. Please log in.");
      router.push("/login");
      return;
    }
    goToOnboarding();
  } catch {
    setError("Network error. Please try again.");
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="col-span-3">
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-3xl font-black uppercase">Create your account</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          How do you want to use RAW society? You can switch later.
        </p>
      </div>

      {/* دمج اختيار الأدوار مباشرة في الصفحة */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <RoleCard
          active={selectedRole === "creator"}
          title="I'm a creator"
          onClick={() => setSelectedRole("creator")}
        />
        <RoleCard
          active={selectedRole === "client"}
          title="I'm a client"
          onClick={() => setSelectedRole("client")}
        />
      </div>

      <InputField
        label="Full name"
        placeholder="e.g. Sahar Taloa"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

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
        placeholder="8+ characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {session?.user && (
        <button
          type="button"
          onClick={async () => {
            await signOut({ redirect: false });
            setName("");
            setEmail("");
            setPassword("");
            setError("");
          }}
          className="mt-2 text-sm font-semibold text-[var(--brand-orange)] hover:underline"
        >
          Log out ({session.user.email}) to use another account
        </button>
      )}

      <button
        type="button"
        onClick={handleNextStep}
        disabled={loading}
        className="h-14 w-full rounded-xl bg-[var(--brand-orange)] font-semibold text-white mt-4 transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
        Already have an account?{" "}
        <a href="/login" className="font-semibold text-[var(--brand-orange)] hover:underline">
          Log in
        </a>
      </p>

      <Divider />
      <GoogleButton role={selectedRole} />
    </div>
  );
}

// الصفحة الرئيسية
export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[var(--page-bg)] flex items-center justify-center px-6 lg:px-12 py-6">
      <AuthCard>
        <div className="lg:grid lg:grid-cols-5 lg:gap-12">
          {/* Brand Side */}
          <div className="hidden lg:flex lg:col-span-2 relative overflow-hidden rounded-3xl bg-[var(--page-bg)] items-center justify-center flex-col p-10">
            <h1 className="text-6xl leading-none tracking-wide text-[var(--brand-dark)]">
              RAW <br /> society
            </h1>
            <p className="mt-6 text-center text-[var(--text-muted)] max-w-xs">
              A creative space connecting creators with opportunities.
            </p>
            <RawAnimation />
          </div>

          {/* Form Side */}
          <Suspense fallback={<div className="col-span-3 p-6 text-center">Loading...</div>}>
            <SignUpForm />
          </Suspense>
        </div>
      </AuthCard>
    </main>
  );
}