"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  SELF_SERVICE_AUTH_REDIRECT_COOKIE,
  SELF_SERVICE_ONBOARDING_COOKIE,
} from "@/lib/self-service/onboarding";

function safeCallbackPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value.trim() : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/app";
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") === "http" ? "http" : "https";

  if (forwardedHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function requestSelfServiceMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const redirectTo = safeCallbackPath(formData.get("callbackUrl"));

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    redirect(`/sign-in?error=invalid_email&callbackUrl=${encodeURIComponent(redirectTo)}`);
  }

  const cookieStore = await cookies();
  const onboardingToken = cookieStore.get(SELF_SERVICE_ONBOARDING_COOKIE)?.value;

  if (onboardingToken) {
    await prisma.selfServiceOnboardingDraft.updateMany({
      where: {
        tokenHash: tokenHash(onboardingToken),
        claimedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { email },
    });
  }

  cookieStore.set(SELF_SERVICE_AUTH_REDIRECT_COOKIE, redirectTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });

  const completionUrl = new URL("/auth/complete", await requestOrigin()).toString();

  await signIn("resend", {
    email,
    redirectTo: completionUrl,
  });
}

export async function signOutSelfService() {
  await signOut({ redirectTo: "/sign-in" });
}
