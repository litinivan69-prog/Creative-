import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: {
    strategy: "database",
  },
  providers: [
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? "Adaptive Presence <no-reply@example.com>",
    }),
  ],
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
  },
});
