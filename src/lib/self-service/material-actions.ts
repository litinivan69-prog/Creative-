"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scheduledAutopublishDefaults } from "@/lib/scheduled-autopublish";

async function currentClientId() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    select: { clientId: true },
  });
  return membership?.clientId ?? null;
}

export async function saveSelfServiceMaterialText(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const clientId = await currentClientId();

  if (!clientId) redirect(`/sign-in?callbackUrl=/app/month/${encodeURIComponent(itemId)}`);
  if (!itemId || !body || body.length > 120_000) {
    redirect(`/app/month/${encodeURIComponent(itemId)}?error=text_invalid`);
  }

  const item = await prisma.plannedContentItem.findFirst({
    where: { id: itemId, monthlyPlan: { clientId } },
    include: { contentDraft: { select: { id: true, platformName: true } } },
  });
  if (!item) redirect("/app/month?error=material_missing");

  const article = item.deliverableKind === "article"
    ? await prisma.article.findFirst({ where: { plannedContentItemId: item.id, clientId }, select: { id: true } })
    : null;

  if (item.contentDraft) {
    const telegram = /telegram|телег/i.test(item.contentDraft.platformName);
    await prisma.$transaction([
      prisma.contentDraft.update({
        where: { id: item.contentDraft.id },
        data: {
          draftBody: body,
          ...(telegram ? { telegramBody: body } : {}),
          status: "draft",
        },
      }),
      ...(article ? [prisma.article.update({ where: { id: article.id }, data: { bodyMarkdown: body, status: "draft" } })] : []),
    ]);
  } else {
    if (!article) redirect(`/app/month/${encodeURIComponent(item.id)}?error=text_not_ready`);
    await prisma.article.update({
      where: { id: article.id },
      data: { bodyMarkdown: body, status: "draft" },
    });
  }

  revalidatePath("/app/month");
  revalidatePath(`/app/month/${item.id}`);
  redirect(`/app/month/${item.id}?notice=saved`);
}

export async function markSelfServiceMaterialReady(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const clientId = await currentClientId();

  if (!clientId) redirect(`/sign-in?callbackUrl=/app/month/${encodeURIComponent(itemId)}`);
  if (!itemId) redirect("/app/month?error=material_missing");

  const item = await prisma.plannedContentItem.findFirst({
    where: { id: itemId, monthlyPlan: { clientId } },
    include: {
      contentDraft: { select: { id: true, draftBody: true } },
      creativeAssets: {
        select: {
          assetType: true,
          notes: true,
          generatedVariants: { select: { id: true }, take: 1 },
        },
      },
      generatedCreativeVariants: { select: { id: true }, take: 1 },
      scheduledPublications: { select: { id: true, scheduledTime: true, timezone: true } },
    },
  });
  if (!item) redirect("/app/month?error=material_missing");

  const article = item.deliverableKind === "article"
    ? await prisma.article.findFirst({ where: { plannedContentItemId: item.id, clientId }, select: { bodyMarkdown: true } })
    : null;

  const slides = item.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");
  const requiredAssets = slides.length > 0
    ? slides
    : item.creativeAssets.filter((asset) => !asset.notes?.includes("legacyCombinedCarouselAsset=true"));
  const visualsReady = requiredAssets.length > 0
    ? requiredAssets.every((asset) => asset.generatedVariants.length > 0)
    : item.generatedCreativeVariants.length > 0;

  const textReady = Boolean(article?.bodyMarkdown.trim() || item.contentDraft?.draftBody.trim());
  if (!item.contentDraft || !textReady || !visualsReady) {
    redirect(`/app/month/${encodeURIComponent(item.id)}?error=material_not_ready`);
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.contentDraft.update({
      where: { id: item.contentDraft!.id },
      data: { status: "ready_to_schedule" },
    });
    await transaction.contentDraftReviewEvent.create({
      data: {
        contentDraftId: item.contentDraft!.id,
        actorType: "client",
        action: "marked_ready_to_schedule",
        comment: "Материал подтверждён в личном кабинете.",
      },
    });
    if (item.scheduledPublications.length > 0) {
      await transaction.scheduledPublication.updateMany({
        where: { id: { in: item.scheduledPublications.map((publication) => publication.id) } },
        data: {
          status: "ready",
          scheduledTime: item.scheduledPublications[0]?.scheduledTime || scheduledAutopublishDefaults.time,
          timezone: item.scheduledPublications[0]?.timezone || scheduledAutopublishDefaults.timezone,
          publishStatus: "queued",
          publishErrorMessage: null,
        },
      });
    }
  });

  revalidatePath("/app");
  revalidatePath("/app/month");
  revalidatePath(`/app/month/${item.id}`);
  redirect(`/app/month/${item.id}?notice=ready`);
}

export async function saveSelfServicePublicationSchedule(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const scheduledDate = String(formData.get("scheduledDate") ?? "").trim();
  const scheduledTime = String(formData.get("scheduledTime") ?? "").trim();
  const clientId = await currentClientId();

  if (!clientId) redirect(`/sign-in?callbackUrl=/app/month/${encodeURIComponent(itemId)}`);
  if (!itemId || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) {
    redirect(`/app/month/${encodeURIComponent(itemId)}?error=schedule_invalid`);
  }

  const publication = await prisma.scheduledPublication.findFirst({
    where: { plannedContentItemId: itemId, clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, publishStatus: true },
  });
  if (!publication) redirect(`/app/month/${encodeURIComponent(itemId)}?error=publication_missing`);
  if (publication.publishStatus === "published") redirect(`/app/month/${encodeURIComponent(itemId)}?error=already_published`);

  await prisma.scheduledPublication.update({
    where: { id: publication.id },
    data: {
      scheduledDate,
      scheduledTime,
      timezone: scheduledAutopublishDefaults.timezone,
      publishStatus: "queued",
      publishErrorMessage: null,
    },
  });

  revalidatePath("/app");
  revalidatePath("/app/month");
  revalidatePath(`/app/month/${itemId}`);
  revalidatePath("/app/autoposting");
  redirect(`/app/month/${itemId}?notice=schedule_saved`);
}
