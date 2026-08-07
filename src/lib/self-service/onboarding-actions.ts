"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  onboardingRawBrief,
  SELF_SERVICE_ONBOARDING_COOKIE,
  SelfServiceOnboardingSchema,
  selfServiceOnboardingFromFormData,
  type SelfServiceOnboarding,
} from "@/lib/self-service/onboarding";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createWorkspaceForUser(userId: string, input: SelfServiceOnboarding) {
  const existingMembership = await prisma.workspaceMembership.findFirst({
    where: { userId, role: "owner" },
    select: { clientId: true },
  });

  if (existingMembership) return existingMembership.clientId;

  const client = await prisma.client.create({
    data: {
      name: input.brief.brandName,
      website: input.brief.website || null,
      briefs: {
        create: {
          rawBrief: onboardingRawBrief(input),
        },
      },
      brandProfile: {
        create: {
          toneOfVoice: input.brief.tone,
          keyMessages: input.brief.keyMessage || input.brief.priorityOffer,
          targetAudienceNotes: input.brief.audience,
          forbiddenTopics: input.brief.restrictions || null,
          productServiceNotes: input.brief.priorityOffer,
          visualStyle: null,
        },
      },
      memberships: {
        create: {
          userId,
          role: "owner",
        },
      },
      subscription: {
        create: {
          planCode: "trial",
          status: "pending",
        },
      },
    },
    select: { id: true },
  });

  return client.id;
}

export async function stageSelfServiceOnboarding(formData: FormData) {
  let input: SelfServiceOnboarding;

  try {
    input = selfServiceOnboardingFromFormData(formData);
  } catch {
    redirect("/start?error=brief_invalid");
  }

  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await createWorkspaceForUser(user.id, input);
      redirect("/app?notice=brand_created");
    }
  }

  const cookieStore = await cookies();
  const existingRawToken = cookieStore.get(SELF_SERVICE_ONBOARDING_COOKIE)?.value;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  let rawToken = existingRawToken;

  if (existingRawToken) {
    const existingDraft = await prisma.selfServiceOnboardingDraft.findUnique({
      where: { tokenHash: tokenHash(existingRawToken) },
      select: { id: true, claimedAt: true, expiresAt: true },
    });

    if (existingDraft && !existingDraft.claimedAt && existingDraft.expiresAt > new Date()) {
      await prisma.selfServiceOnboardingDraft.update({
        where: { id: existingDraft.id },
        data: { payload: input, expiresAt },
      });
    } else {
      rawToken = undefined;
    }
  }

  if (!rawToken) {
    rawToken = randomBytes(32).toString("base64url");
    await prisma.selfServiceOnboardingDraft.create({
      data: {
        tokenHash: tokenHash(rawToken),
        payload: input,
        expiresAt,
      },
    });
  }

  cookieStore.set(SELF_SERVICE_ONBOARDING_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 60 * 60,
  });

  redirect("/sign-in?callbackUrl=/app/setup");
}

export async function claimSelfServiceOnboarding() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/setup");

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) redirect("/sign-in?error=account_missing&callbackUrl=/app/setup");

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SELF_SERVICE_ONBOARDING_COOKIE)?.value;
  if (!rawToken) redirect("/start?error=onboarding_missing");

  const draft = await prisma.selfServiceOnboardingDraft.findUnique({
    where: { tokenHash: tokenHash(rawToken) },
  });

  if (!draft || draft.claimedAt || draft.expiresAt < new Date()) {
    cookieStore.delete(SELF_SERVICE_ONBOARDING_COOKIE);
    redirect("/start?error=onboarding_expired");
  }

  const input = SelfServiceOnboardingSchema.parse(draft.payload);

  await prisma.$transaction(async (tx) => {
    const existingMembership = await tx.workspaceMembership.findFirst({
      where: { userId: user.id, role: "owner" },
      select: { clientId: true },
    });

    if (!existingMembership) {
      await tx.client.create({
        data: {
          name: input.brief.brandName,
          website: input.brief.website || null,
          briefs: { create: { rawBrief: onboardingRawBrief(input) } },
          brandProfile: {
            create: {
              toneOfVoice: input.brief.tone,
              keyMessages: input.brief.keyMessage || input.brief.priorityOffer,
              targetAudienceNotes: input.brief.audience,
              forbiddenTopics: input.brief.restrictions || null,
              productServiceNotes: input.brief.priorityOffer,
            },
          },
          memberships: { create: { userId: user.id, role: "owner" } },
          subscription: { create: { planCode: "trial", status: "pending" } },
        },
      });
    }

    await tx.selfServiceOnboardingDraft.update({
      where: { id: draft.id },
      data: {
        claimedAt: new Date(),
        claimedByUserId: user.id,
        email,
      },
    });
  });

  cookieStore.delete(SELF_SERVICE_ONBOARDING_COOKIE);
  redirect("/app?notice=brand_created");
}
