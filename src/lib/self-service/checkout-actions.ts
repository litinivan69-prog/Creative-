"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasSelfServicePaidAccess } from "@/lib/self-service/subscription";
import {
  createYooKassaPayment,
  isYooKassaConfigured,
  SELF_SERVICE_PRICE_MINOR,
} from "@/lib/yookassa";

export async function beginSelfServiceCheckout() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/subscribe");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    include: { client: { select: { subscription: true } } },
  });
  if (!membership) redirect("/start");
  if (hasSelfServicePaidAccess(membership.client.subscription)) redirect("/app/month");
  if (!isYooKassaConfigured()) redirect("/app/subscribe?error=checkout_unavailable");

  const recentThreshold = new Date(Date.now() - 30 * 60 * 1000);
  const existingPayment = await prisma.billingPayment.findFirst({
    where: {
      clientId: membership.clientId,
      provider: "yookassa",
      status: { in: ["creating", "pending", "waiting_for_capture"] },
      confirmationUrl: { not: null },
      createdAt: { gt: recentThreshold },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existingPayment?.confirmationUrl) redirect(existingPayment.confirmationUrl);

  const idempotencyKey = randomUUID();
  const localPayment = await prisma.billingPayment.create({
    data: {
      clientId: membership.clientId,
      idempotencyKey,
      amountMinor: SELF_SERVICE_PRICE_MINOR,
      currency: "RUB",
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "");
  if (!appUrl) {
    await prisma.billingPayment.update({ where: { id: localPayment.id }, data: { status: "configuration_failed" } });
    redirect("/app/subscribe?error=checkout_unavailable");
  }

  let confirmationUrl: string;
  try {
    const payment = await createYooKassaPayment({
      billingPaymentId: localPayment.id,
      clientId: membership.clientId,
      idempotencyKey,
      email,
      returnUrl: `${appUrl}/app/subscribe/return?payment=${encodeURIComponent(localPayment.id)}`,
    });
    const providerConfirmationUrl = payment.confirmation?.confirmation_url;
    if (!providerConfirmationUrl) throw new Error("YOOKASSA_CONFIRMATION_URL_MISSING");
    confirmationUrl = providerConfirmationUrl;

    await prisma.billingPayment.update({
      where: { id: localPayment.id },
      data: {
        providerPaymentId: payment.id,
        status: payment.status,
        confirmationUrl: providerConfirmationUrl,
        rawPayload: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          metadata: payment.metadata ?? {},
        },
      },
    });
  } catch (error) {
    console.error("YooKassa checkout creation failed", error instanceof Error ? error.message : "unknown error");
    await prisma.billingPayment.update({ where: { id: localPayment.id }, data: { status: "failed" } });
    redirect("/app/subscribe?error=payment_failed");
  }

  redirect(confirmationUrl);
}
