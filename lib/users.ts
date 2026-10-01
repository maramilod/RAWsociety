import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { execute, queryOne, type RowDataPacket } from "@/lib/db";

export type Role = "creator" | "client" | "admin";

export interface DbUser extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  image: string | null;
  role: Role;
  status: "active" | "suspended" | "pending_verification";
}

export function normalizeRole(value: unknown): "creator" | "client" {
  return value === "creator" ? "creator" : "client";
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  return queryOne<DbUser>(
    "SELECT id, email, password_hash, name, image, role, status FROM users WHERE email = ? AND deleted_at IS NULL",
    [email.trim().toLowerCase()]
  );
}

export async function createUser(input: {
  email: string;
  name: string;
  role: "creator" | "client";
  password?: string;
  image?: string | null;
  emailVerified?: boolean;
}): Promise<DbUser> {
  const id = randomUUID();
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
  await execute(
    `INSERT INTO users (id, email, email_verified, password_hash, name, image, role)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.email.trim().toLowerCase(),
      input.emailVerified ? new Date() : null,
      passwordHash,
      input.name.trim(),
      input.image ?? null,
      input.role,
    ]
  );
  const user = await queryOne<DbUser>(
    "SELECT id, email, password_hash, name, image, role, status FROM users WHERE id = ?",
    [id]
  );
  if (!user) throw new Error("User was not created");
  return user;
}

export async function verifyPassword(user: DbUser, password: string): Promise<boolean> {
  if (!user.password_hash) return false;
  return bcrypt.compare(password, user.password_hash);
}

export async function touchLogin(userId: string): Promise<void> {
  await execute("UPDATE users SET last_login_at = NOW(3) WHERE id = ?", [userId]);
}
