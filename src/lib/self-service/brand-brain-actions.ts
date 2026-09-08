"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { storeClientBrandAssetFile } from "@/lib/brand-asset-storage";
import { BRAND_BRAIN_QUESTIONS } from "@/lib/self-service/brand-brain";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

async function activeClientId() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true },
  });
  return membership?.clientId ?? null;
}

export async function answerBrandBrainQuestion(formData: FormData) {
  const clientId = await activeClientId();
  if (!clientId) redirect("/sign-in?callbackUrl=/app/brand-brain");
  const questionKey = String(formData.get("questionKey") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const question = BRAND_BRAIN_QUESTIONS.find((item) => item.key === questionKey);
  if (!question || answer.length < 2 || answer.length > 5_000) redirect("/app/brand-brain?error=answer");

  await prisma.$transaction(async (tx) => {
    await tx.clientBrandAsset.create({
      data: {
        clientId,
        assetType: "brand_knowledge",
        title: question.text,
        description: `brand_brain:${question.key}:answer`,
        textContent: answer,
        storageProvider: "database_text",
      },
    });
    const profileUpdate = question.key === "difference"
      ? { keyMessages: answer }
      : question.key === "current_focus"
        ? { productServiceNotes: answer }
        : question.key === "restrictions"
          ? { forbiddenTopics: answer }
          : {};
    await tx.clientBrandProfile.upsert({
      where: { clientId },
      create: { clientId, ...profileUpdate },
      update: profileUpdate,
    });
  });
  revalidatePath("/app/brand-brain");
  revalidatePath("/app");
  redirect("/app/brand-brain?notice=saved");
}

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf", "text/plain"]);

export async function addBrandBrainFile(formData: FormData) {
  const clientId = await activeClientId();
  if (!clientId) redirect("/sign-in?callbackUrl=/app/brand-brain");
  const file = formData.get("file");
  const assetType = String(formData.get("assetType") ?? "photo");
  if (!(file instanceof File) || !file.size || file.size > 15 * 1024 * 1024 || !ALLOWED_TYPES.has(file.type)) {
    redirect("/app/brand-brain?error=file");
  }
  const safeType = new Set(["logo", "photo", "brandbook", "old_post", "reference"]).has(assetType) ? assetType : "reference";
  const stored = await storeClientBrandAssetFile({ file, clientId, assetType: safeType });
  if (!stored) redirect("/app/brand-brain?error=file");
  await prisma.clientBrandAsset.create({
    data: { clientId, assetType: safeType, title: file.name, ...stored },
  });
  revalidatePath("/app/brand-brain");
  redirect("/app/brand-brain?notice=file_saved");
}
