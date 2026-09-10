import React from "react";

export default function AuthCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
className="
w-full
max-w-md

lg:max-w-6xl

rounded-3xl
border
border-[var(--border-default)]

bg-[var(--white)]

p-8

lg:p-10

shadow-sm
"
>
      {children}
    </div>
  );
}