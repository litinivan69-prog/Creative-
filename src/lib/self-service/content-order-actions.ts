"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spendCredits } from "@/lib/self-service/credits";
import {
  contentOrderConfigurationFromFormData,
  estimateContentOrderCredits,
} from "@/lib/self-service/content-orders";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

async function currentClientId(email: string) {
  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true },
  });
  if (!membership) redirect("/start");
  return membership.clientId;
}

async function upsertDraftContentOrder(clientId: string, formData: FormData) {
  const configuration = contentOrderConfigurationFromFormData(formData);
  const estimatedCredits = estimateContentOrderCredits(configuration);
  if (estimatedCredits <= 0) redirect("/app/plan-builder?error=empty");

  const month = new Date().toISOString().slice(0, 7);
  const existing = await prisma.selfServiceContentOrder.findFirst({
    where: { clientId, month, status: "draft" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  return existing
    ? prisma.selfServiceContentOrder.update({ where: { id: existing.id }, data: { configuration, estimatedCredits } })
    : prisma.selfServiceContentOrder.create({ data: { clientId, month, configuration, estimatedCredits } });
}

export async function saveSelfServiceContentOrder(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/plan-builder");

  const clientId = await currentClientId(email);
  await upsertDraftContentOrder(clientId, formData);

  redirect("/app/plan-builder?notice=saved");
}

export async function launchSelfServiceContentOrder(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/plan-builder");

  const clientId = await currentClientId(email);
  const month = new Date().toISOString().slice(0, 7);
  const existingPlan = await prisma.monthlyOperatingPlan.findFirst({
    where: { clientId, month, status: { notIn: ["archived", "replaced"] } },
    select: { id: true },
  });
  if (existingPlan) redirect("/app/month?notice=month_exists");
  const activeOrder = await prisma.selfServiceContentOrder.findFirst({
    where: { clientId, month, status: { in: ["confirmed", "processing"] } },
    select: { id: true },
  });
  if (activeOrder) redirect("/app/month?autostart=1&notice=order_confirmed");

  const order = await upsertDraftContentOrder(clientId, formData);
  try {
    const transaction = await spendCredits({
      clientId,
      credits: order.estimatedCredits,
      description: `Контент-набор на ${month}`,
      idempotencyKey: `content-order:${clientId}:${month}`,
      referenceType: "self_service_content_order",
      referenceId: order.id,
    });
    await prisma.selfServiceContentOrder.update({
      where: { id: order.id },
      data: { status: "confirmed", chargedCredits: Math.abs(transaction.amount), ledgerTransactionId: transaction.id },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      redirect("/app/plan-builder?error=credits");
    }
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      await prisma.selfServiceContentOrder.deleteMany({ where: { id: order.id, status: "draft" } });
      redirect("/app/month?autostart=1&notice=order_confirmed");
    }
    throw error;
  }

  redirect("/app/month?autostart=1&notice=order_confirmed");
}
