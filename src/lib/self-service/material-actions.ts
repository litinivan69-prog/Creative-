"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  if (item.contentDraft) {
    const telegram = /telegram|телег/i.test(item.contentDraft.platformName);
    await prisma.contentDraft.update({
      where: { id: item.contentDraft.id },
      data: {
        draftBody: body,
        ...(telegram ? { telegramBody: body } : {}),
        status: "draft",
      },
    });
  } else {
    const article = await prisma.article.findFirst({
      where: { plannedContentItemId: item.id, clientId },
      select: { id: true },
    });
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
