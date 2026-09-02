"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scheduledAutopublishDefaults } from "@/lib/scheduled-autopublish";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { cleanVisibleContentText } from "@/lib/content-draft-schema";
import { getClientBrandContext, getClientVisualBranding } from "@/lib/brand-context";
import { stripCarouselSlideLabel } from "@/lib/creative-asset-schema";
import { generateCreativeVisualVariant } from "@/lib/openai";
import { CREDIT_PRODUCTS } from "@/lib/self-service/credit-catalog";
import { storeGeneratedVisual } from "@/lib/visual-storage";
import { clientHasUnlimitedCredits } from "@/lib/self-service/admin-access";

async function currentClientId() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true },
  });
  return membership?.clientId ?? null;
}

export async function regenerateSelfServiceVisual(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const creativeAssetId = String(formData.get("creativeAssetId") ?? "").trim();
  const revisionInstruction = String(formData.get("revisionInstruction") ?? "").trim();
  const clientId = await currentClientId();

  if (!clientId) redirect(`/sign-in?callbackUrl=/app/month/${encodeURIComponent(itemId)}`);
  if (!itemId || !creativeAssetId) redirect(`/app/month/${encodeURIComponent(itemId)}?error=visual_missing`);
  if (revisionInstruction.length < 5 || revisionInstruction.length > 1_000) {
    redirect(`/app/month/${encodeURIComponent(itemId)}?error=revision_instruction`);
  }

  const [asset, wallet, unlimited] = await Promise.all([
    prisma.creativeAsset.findFirst({
      where: { id: creativeAssetId, plannedContentItemId: itemId, clientId },
      include: {
        client: true,
        contentDraft: true,
        scheduledPublication: true,
        generatedVariants: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.creditWallet.findUnique({ where: { clientId } }),
    clientHasUnlimitedCredits(clientId),
  ]);

  const revisionCost = CREDIT_PRODUCTS.visual_revision.credits;
  if (!asset) redirect(`/app/month/${encodeURIComponent(itemId)}?error=visual_missing`);
  if (!wallet || (!unlimited && wallet.balance < revisionCost)) redirect(`/app/month/${encodeURIComponent(itemId)}?error=credits`);

  try {
    const visualBranding = await getClientVisualBranding(clientId);
    const sourceVariant = asset.generatedVariants[0] ?? null;
    const sourceVisualUrl = sourceVariant?.imageUrl
      ?? (sourceVariant?.imageBase64 ? `data:${sourceVariant.mimeType};base64,${sourceVariant.imageBase64}` : null);
    const generated = await generateCreativeVisualVariant({
      clientName: asset.client.name,
      clientIndustry: asset.client.industry,
      brandContext: await getClientBrandContext(clientId),
      brandLogoUrl: visualBranding.logoUrl,
      sourceVisualUrl,
      brandTypography: visualBranding.typography,
      creativeAsset: {
        assetType: asset.assetType,
        title: stripCarouselSlideLabel(asset.title),
        brief: asset.brief,
        formatRequirements: asset.formatRequirements,
        textOnAsset: asset.textOnAsset ? stripCarouselSlideLabel(asset.textOnAsset) || null : asset.textOnAsset,
        references: asset.references,
        notes: [
          asset.notes,
          "Это не случайная перегенерация, а адресная правка по комментарию клиента.",
          `ОБЯЗАТЕЛЬНАЯ ПРАВКА КЛИЕНТА: ${revisionInstruction}`,
          "Измени только то, о чём попросил клиент. Остальные удачные решения, единую типографическую систему бренда и точный текст из ТЗ сохрани.",
        ].filter(Boolean).join("\n"),
      },
      scheduledPublication: {
        platformName: asset.scheduledPublication.platformName,
        format: asset.scheduledPublication.format,
        topic: asset.scheduledPublication.topic,
        scheduledDate: asset.scheduledPublication.scheduledDate,
        scheduledTime: asset.scheduledPublication.scheduledTime,
      },
      contentDraft: {
        draftTitle: asset.contentDraft.draftTitle,
        draftBody: asset.contentDraft.draftBody,
        riskLevel: asset.contentDraft.riskLevel,
        approvalRequired: asset.contentDraft.approvalRequired,
      },
    });

    const stored = await storeGeneratedVisual({
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      clientId,
      monthlyPlanId: asset.monthlyPlanId,
      creativeAssetId: asset.id,
    });

    await prisma.$transaction(async (tx) => {
      const currentWallet = await tx.creditWallet.findUnique({ where: { clientId } });
      if (!currentWallet || (!unlimited && currentWallet.balance < revisionCost)) throw new Error("INSUFFICIENT_CREDITS");
      const updatedWallet = unlimited
        ? currentWallet
        : await tx.creditWallet.update({
            where: { id: currentWallet.id },
            data: { balance: { decrement: revisionCost }, lifetimeSpent: { increment: revisionCost } },
          });
      const createdVariant = await tx.generatedCreativeVariant.create({
        data: {
          clientId,
          blueprintId: asset.blueprintId,
          monthlyPlanId: asset.monthlyPlanId,
          plannedContentItemId: asset.plannedContentItemId,
          contentDraftId: asset.contentDraftId,
          scheduledPublicationId: asset.scheduledPublicationId,
          creativeAssetId: asset.id,
          variantTitle: `Исправленный вариант: ${asset.title}`,
          prompt: generated.prompt,
          revisedPrompt: generated.revisedPrompt,
          imageBase64: stored.storageProvider === "database_base64" ? stored.imageBase64 : null,
          imageUrl: stored.storageProvider === "vercel_blob" ? stored.imageUrl : null,
          storageKey: stored.storageProvider === "vercel_blob" ? stored.storageKey : null,
          storageProvider: stored.storageProvider,
          fileSize: stored.fileSize,
          mimeType: generated.mimeType,
          status: "generated",
          source: generated.provider,
          provider: generated.provider,
          model: generated.model,
          quality: generated.quality,
          size: generated.size,
          textMode: generated.textMode,
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          totalTokens: generated.totalTokens,
          estimatedCostUsd: generated.estimatedCostUsd,
          qualityStatus: "needs_manual_review",
          qualityNotes: `Вариант создан по правке клиента: ${revisionInstruction}. Логотип допускается только из подтверждённого бренд-ассета.`,
        },
      });
      await tx.creditTransaction.create({
        data: {
          clientId,
          walletId: currentWallet.id,
          amount: unlimited ? 0 : -revisionCost,
          balanceAfter: updatedWallet.balance,
          kind: unlimited ? "admin_usage" : "spend",
          description: unlimited ? "Правка визуала · админский тест без списания" : "Правка визуала по комментарию клиента",
          referenceType: "generated_creative_variant",
          referenceId: createdVariant.id,
          idempotencyKey: `visual-revision:${createdVariant.id}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      redirect(`/app/month/${encodeURIComponent(itemId)}?error=credits`);
    }
    console.error("Self-service visual regeneration failed", error);
    redirect(`/app/month/${encodeURIComponent(itemId)}?error=visual_revision_failed`);
  }

  revalidatePath("/app");
  revalidatePath("/app/month");
  revalidatePath(`/app/month/${itemId}`);
  redirect(`/app/month/${itemId}?notice=visual_revised`);
}

export async function saveSelfServiceMaterialText(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const rawBody = String(formData.get("body") ?? "").trim();
  const clientId = await currentClientId();

  if (!clientId) redirect(`/sign-in?callbackUrl=/app/month/${encodeURIComponent(itemId)}`);
  if (!itemId || !rawBody || rawBody.length > 120_000) {
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
  const body = article ? rawBody : cleanVisibleContentText(rawBody);

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
    ? await prisma.article.findFirst({ where: { plannedContentItemId: item.id, clientId }, select: { bodyMarkdown: true, images: true } })
    : null;

  const slides = item.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");
  const requiredAssets = slides.length > 0
    ? slides
    : item.creativeAssets.filter((asset) => !asset.notes?.includes("legacyCombinedCarouselAsset=true"));
  const articleImages = article
    ? ((article.images as Array<{ url?: string | null }> | null) ?? []).filter((image) => Boolean(image.url))
    : [];
  const visualsReady = article
    ? articleImages.length > 0
    : requiredAssets.length > 0
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

export async function markSelfServiceMaterialPublishedManually(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const externalUrlRaw = String(formData.get("externalUrl") ?? "").trim();
  const clientId = await currentClientId();

  if (!clientId) redirect(`/sign-in?callbackUrl=/app/month/${encodeURIComponent(itemId)}`);
  if (!itemId) redirect("/app/month?error=material_missing");

  let externalUrl: string | null = null;
  if (externalUrlRaw) {
    try {
      const parsed = new URL(externalUrlRaw);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("invalid protocol");
      externalUrl = parsed.toString();
    } catch {
      redirect(`/app/month/${encodeURIComponent(itemId)}?error=publication_url_invalid`);
    }
  }

  const item = await prisma.plannedContentItem.findFirst({
    where: { id: itemId, monthlyPlan: { clientId } },
    include: {
      contentDraft: { select: { id: true, status: true } },
      scheduledPublications: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, publishStatus: true } },
    },
  });
  if (!item?.contentDraft) redirect(`/app/month/${encodeURIComponent(itemId)}?error=material_not_ready`);

  const publication = item.scheduledPublications[0];
  if (!publication) redirect(`/app/month/${encodeURIComponent(itemId)}?error=publication_missing`);
  if (publication.publishStatus === "published") redirect(`/app/month/${encodeURIComponent(itemId)}?notice=already_published`);
  if (!["ready_to_schedule", "approved"].includes(item.contentDraft.status)) {
    redirect(`/app/month/${encodeURIComponent(itemId)}?error=confirm_first`);
  }

  await prisma.scheduledPublication.update({
    where: { id: publication.id },
    data: {
      status: "published",
      publishStatus: "published",
      publishedAt: new Date(),
      externalUrl,
      publishErrorMessage: null,
    },
  });

  await prisma.contentDraftReviewEvent.create({
    data: {
      contentDraftId: item.contentDraft.id,
      actorType: "client",
      action: "marked_published_manually",
      comment: externalUrl ? "Публикация отмечена вручную со ссылкой." : "Публикация отмечена вручную.",
    },
  });

  revalidatePath("/app");
  revalidatePath("/app/month");
  revalidatePath("/app/results");
  revalidatePath(`/app/month/${itemId}`);
  redirect(`/app/month/${itemId}?notice=published`);
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
