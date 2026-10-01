"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";

export default function GoogleButton({
  role = "client",
  callbackUrl,
}: {
  role?: string;
  callbackUrl?: string;
}) {
  const handleClick = () => {
    // Remember the chosen role for a brand-new Google account (read server-side on first sign-in)
    document.cookie = `raw_role=${role === "creator" ? "creator" : "client"}; path=/; max-age=600; samesite=lax`;
    const target =
      callbackUrl ?? (role === "creator" ? "/onboarding/creator" : "/onboarding/plan?role=client");
    signIn("google", { callbackUrl: target });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="
flex
h-14
w-full
items-center
justify-center
gap-3
rounded-xl
border
border-[var(--border-default)]
hover:bg-[var(--ui-soft)]
transition
"
    >
      <Image src="/images/google.png" alt="Google" width={40} height={40} />
      Continue with Google
    </button>
  );
}
