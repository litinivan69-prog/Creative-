"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getClientBrandContext } from "@/lib/brand-context";
import { generateInstantSelfServiceText } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { spendCredits } from "@/lib/self-service/credits";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

const quickPlatforms = new Set(["VK", "Telegram", "Одноклассники"]);

function destination(kind: string, params: Record<string, string> = {}) {
  const path = kind === "yandex_review_reply" ? "/app/reputation" : "/app/quick-post";
  const query = new URLSearchParams(params);
  return query.size ? `${path}?${query.toString()}` : path;
}

async function currentWorkspace(email: string) {
  return prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { client: { select: { id: true, name: true } } },
  });
}

export async function generateSelfServiceInstantContent(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") === "yandex_review_reply" ? "yandex_review_reply" : "quick_post";
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect(`/sign-in?callbackUrl=${encodeURIComponent(destination(kind))}`);

  const membership = await currentWorkspace(email);
  if (!membership) redirect("/start");
  const sourceText = String(formData.get("sourceText") ?? "").trim();
  if (sourceText.length < 10 || sourceText.length > 6000) redirect(destination(kind, { error: "source" }));
  const platform = kind === "quick_post" ? String(formData.get("platform") ?? "") : null;
  if (kind === "quick_post" && !quickPlatforms.has(platform || "")) redirect(destination(kind, { error: "platform" }));
  const parsedRating = Number(formData.get("rating") ?? 0);
  const rating = kind === "yandex_review_reply" && Number.isInteger(parsedRating) && parsedRating >= 1 && parsedRating <= 5 ? parsedRating : null;

  const item = await prisma.selfServiceInstantContent.create({
    data: { clientId: membership.client.id, kind, platform, sourceText, rating, status: "generating" },
  });

  try {
    const transaction = await spendCredits({
      clientId: membership.client.id,
      credits: 1,
      description: kind === "yandex_review_reply" ? "Ответ на отзыв Яндекс Карт" : `Быстрый пост для ${platform}`,
      idempotencyKey: `instant-content:${item.id}`,
      referenceType: "self_service_instant_content",
      referenceId: item.id,
    });
    await prisma.selfServiceInstantContent.update({
      where: { id: item.id },
      data: { chargedCredits: 1, ledgerTransactionId: transaction.id },
    });
  } catch (error) {
    await prisma.selfServiceInstantContent.deleteMany({ where: { id: item.id, ledgerTransactionId: null } });
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") redirect(destination(kind, { error: "credits" }));
    throw error;
  }

  try {
    const generatedText = await generateInstantSelfServiceText({
      kind,
      clientName: membership.client.name,
      platform,
      sourceText,
      rating,
      brandContext: await getClientBrandContext(membership.client.id),
    });
    await prisma.selfServiceInstantContent.update({
      where: { id: item.id },
      data: { generatedText, status: "ready", errorMessage: null },
    });
    redirect(destination(kind, { result: item.id }));
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    console.error("Instant self-service generation failed", error);
    await prisma.selfServiceInstantContent.update({
      where: { id: item.id },
      data: { status: "failed", errorMessage: "Генерация временно остановилась. Кредит сохранён за задачей — повтор бесплатный." },
    });
    redirect(destination(kind, { result: item.id, error: "generation" }));
  }
}

export async function retrySelfServiceInstantContent(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app");
  const id = String(formData.get("id") ?? "");
  const membership = await currentWorkspace(email);
  if (!membership) redirect("/start");
  const item = await prisma.selfServiceInstantContent.findFirst({
    where: { id, clientId: membership.client.id },
  });
  if (!item) redirect("/app");

  try {
    const generatedText = await generateInstantSelfServiceText({
      kind: item.kind === "yandex_review_reply" ? "yandex_review_reply" : "quick_post",
      clientName: membership.client.name,
      platform: item.platform,
      sourceText: item.sourceText,
      rating: item.rating,
      brandContext: await getClientBrandContext(membership.client.id),
    });
    await prisma.selfServiceInstantContent.update({ where: { id }, data: { generatedText, status: "ready", errorMessage: null } });
    redirect(destination(item.kind, { result: id }));
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    await prisma.selfServiceInstantContent.update({ where: { id }, data: { status: "failed", errorMessage: "Пока не получилось продолжить. Попробуйте после восстановления AI-лимита." } });
    redirect(destination(item.kind, { result: id, error: "generation" }));
  }
}
