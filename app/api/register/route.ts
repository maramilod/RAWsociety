import { NextResponse } from "next/server";
import { createUser, findUserByEmail, normalizeRole } from "@/lib/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = normalizeRole(body.role);

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json(
      { error: "Password must be between 8 and 72 characters." },
      { status: 400 }
    );
  }

  try {
    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }
    const user = await createUser({ name, email, password, role });
    return NextResponse.json({ id: user.id, role: user.role }, { status: 201 });
  } catch (err) {
    // A concurrent sign-up with the same email hits the unique index
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }
    console.error("register failed:", err);
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }
}
