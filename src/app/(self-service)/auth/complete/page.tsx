import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  SELF_SERVICE_AUTH_REDIRECT_COOKIE,
  SELF_SERVICE_ONBOARDING_COOKIE,
} from "@/lib/self-service/onboarding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Завершаем вход · Adaptive Presence",
  robots: { index: false, follow: false },
};

function safeCallbackPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export default async function SelfServiceAuthCompletePage() {
  const cookieStore = await cookies();
  const requestedPath = safeCallbackPath(cookieStore.get(SELF_SERVICE_AUTH_REDIRECT_COOKIE)?.value);
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(requestedPath)}`);
  }

  const hasOnboardingCookie = Boolean(cookieStore.get(SELF_SERVICE_ONBOARDING_COOKIE)?.value);
  const pendingOnboarding = hasOnboardingCookie
    ? true
    : Boolean(
        await prisma.selfServiceOnboardingDraft.findFirst({
          where: {
            email,
            claimedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        }),
      );

  if (pendingOnboarding) redirect("/app/setup");
  redirect(requestedPath);
}
