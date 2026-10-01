import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { execute, queryOne, type RowDataPacket } from "@/lib/db";
import {
  createUser,
  findUserByEmail,
  normalizeRole,
  touchLogin,
  verifyPassword,
} from "@/lib/users";

const providers: Provider[] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;
      if (!email || !password) return null;

      const user = await findUserByEmail(email);
      if (!user || user.status !== "active") return null;
      if (!(await verifyPassword(user, password))) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

// Google sign-in is only offered once the keys are in .env.local
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // Google: create the user on first sign-in and link the OAuth account
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      let dbUser = await findUserByEmail(user.email);
      if (!dbUser) {
        const cookieStore = await cookies();
        const role = normalizeRole(cookieStore.get("raw_role")?.value);
        dbUser = await createUser({
          email: user.email,
          name: user.name || user.email.split("@")[0],
          role,
          image: user.image,
          emailVerified: true,
        });
      }
      if (dbUser.status !== "active") return false;

      const linked = await queryOne<RowDataPacket>(
        "SELECT id FROM accounts WHERE provider = ? AND provider_account_id = ?",
        [account.provider, account.providerAccountId]
      );
      if (!linked) {
        await execute(
          `INSERT INTO accounts (id, user_id, type, provider, provider_account_id)
           VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), dbUser.id, account.type, account.provider, account.providerAccountId]
        );
      }
      return true;
    },

    // Put our database id and role into the token
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await findUserByEmail(user.email);
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          await touchLogin(dbUser.id);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "client";
      }
      return session;
    },
  },
};
