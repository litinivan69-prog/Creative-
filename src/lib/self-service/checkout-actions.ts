"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSubscriptionPurchase, resolveTopUpPurchase } from "@/lib/self-service/credit-catalog";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import {
  createYooKassaPayment,
  isYooKassaConfigured,
} from "@/lib/yookassa";

export async function beginSelfServiceCheckout(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/subscribe");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true },
  });
  if (!membership) redirect("/start");
  if (!isYooKassaConfigured()) redirect("/app/subscribe?error=checkout_unavailable");

  const purchaseKind = String(formData.get("purchaseKind") ?? "subscription");
  const purchase = purchaseKind === "top_up"
    ? resolveTopUpPurchase(String(formData.get("topUpCode") ?? ""))
    : resolveSubscriptionPurchase(
        String(formData.get("planCode") ?? ""),
        Number(formData.get("durationMonths")),
      );
  if (!purchase) redirect("/app/subscribe?error=invalid_purchase");

  const recentThreshold = new Date(Date.now() - 30 * 60 * 1000);
  const existingPayment = await prisma.billingPayment.findFirst({
    where: {
      clientId: membership.clientId,
      provider: "yookassa",
      purchaseKind: purchase.purchaseKind,
      planCode: purchase.planCode,
      durationMonths: purchase.durationMonths,
      amountMinor: purchase.amountMinor,
      creditsGranted: purchase.credits,
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
      amountMinor: purchase.amountMinor,
      currency: "RUB",
      purchaseKind: purchase.purchaseKind,
      planCode: purchase.planCode,
      durationMonths: purchase.durationMonths,
      creditsGranted: purchase.credits,
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
      amountMinor: purchase.amountMinor,
      description: purchase.description,
      purchaseKind: purchase.purchaseKind,
      planCode: purchase.planCode,
      durationMonths: purchase.durationMonths,
      credits: purchase.credits,
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
