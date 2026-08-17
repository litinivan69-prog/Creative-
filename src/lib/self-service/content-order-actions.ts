"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CREDIT_PRODUCTS } from "@/lib/self-service/credit-catalog";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

const fields = ["vkPosts", "telegramPosts", "dzenArticles", "vcruArticles", "carousels", "quickAnnouncements", "reviewReplies"] as const;
type OrderField = (typeof fields)[number];

function quantity(formData: FormData, field: OrderField) {
  const value = Number(formData.get(field) ?? 0);
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error("INVALID_CONTENT_QUANTITY");
  return value;
}

function estimateContentOrderCredits(configuration: Record<OrderField, number>) {
  return configuration.vkPosts * CREDIT_PRODUCTS.visual_post.credits
    + configuration.telegramPosts * CREDIT_PRODUCTS.visual_post.credits
    + configuration.dzenArticles * CREDIT_PRODUCTS.article_with_cover.credits
    + configuration.vcruArticles * CREDIT_PRODUCTS.article_with_cover.credits
    + configuration.carousels * CREDIT_PRODUCTS.carousel.credits
    + configuration.quickAnnouncements * CREDIT_PRODUCTS.quick_announcement.credits
    + configuration.reviewReplies * CREDIT_PRODUCTS.review_reply.credits;
}

export async function saveSelfServiceContentOrder(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/plan-builder");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true },
  });
  if (!membership) redirect("/start");

  const configuration = Object.fromEntries(fields.map((field) => [field, quantity(formData, field)])) as Record<OrderField, number>;
  const estimatedCredits = estimateContentOrderCredits(configuration);
  if (estimatedCredits <= 0) redirect("/app/plan-builder?error=empty");

  const month = new Date().toISOString().slice(0, 7);
  const existing = await prisma.selfServiceContentOrder.findFirst({
    where: { clientId: membership.clientId, month, status: "draft" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    await prisma.selfServiceContentOrder.update({
      where: { id: existing.id },
      data: { configuration, estimatedCredits },
    });
  } else {
    await prisma.selfServiceContentOrder.create({
      data: { clientId: membership.clientId, month, configuration, estimatedCredits },
    });
  }

  redirect("/app/plan-builder?notice=saved");
}
