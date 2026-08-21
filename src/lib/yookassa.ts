import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
const YOOKASSA_API_URL = "https://api.yookassa.ru/v3";

type YooKassaPayment = {
  id: string;
  status: string;
  paid?: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type?: string; confirmation_url?: string };
  payment_method?: { id?: string; saved?: boolean };
  metadata?: Record<string, string>;
  captured_at?: string;
  created_at?: string;
};

function credentials() {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim();
  if (!shopId || !secretKey) return null;
  return { shopId, secretKey };
}

export function isYooKassaConfigured() {
  return Boolean(credentials());
}

function authorizationHeader(config: { shopId: string; secretKey: string }) {
  return `Basic ${Buffer.from(`${config.shopId}:${config.secretKey}`).toString("base64")}`;
}

async function yooKassaRequest(path: string, init: RequestInit = {}) {
  const config = credentials();
  if (!config) throw new Error("YOOKASSA_NOT_CONFIGURED");

  const response = await fetch(`${YOOKASSA_API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: authorizationHeader(config),
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) throw new Error(`YOOKASSA_API_${response.status}`);
  return response.json() as Promise<YooKassaPayment>;
}

export async function createYooKassaPayment(input: {
  billingPaymentId: string;
  clientId: string;
  idempotencyKey: string;
  email: string;
  returnUrl: string;
  amountMinor: number;
  description: string;
  purchaseKind: string;
  planCode: string;
  durationMonths: number | null;
  credits: number;
}) {
  const amountValue = (input.amountMinor / 100).toFixed(2);
  const receiptVatCode = process.env.YOOKASSA_VAT_CODE?.trim();
  const receipt = receiptVatCode
    ? {
        customer: { email: input.email },
        items: [{
          description: input.description.slice(0, 128),
          quantity: "1.00",
          amount: { value: amountValue, currency: "RUB" },
          vat_code: Number(receiptVatCode),
          payment_mode: "full_payment",
          payment_subject: "service",
        }],
      }
    : undefined;

  return yooKassaRequest("/payments", {
    method: "POST",
    headers: { "Idempotence-Key": input.idempotencyKey },
    body: JSON.stringify({
      amount: { value: amountValue, currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: input.returnUrl },
      description: input.description.slice(0, 128),
      metadata: {
        billingPaymentId: input.billingPaymentId,
        clientId: input.clientId,
        purchaseKind: input.purchaseKind,
        planCode: input.planCode,
        durationMonths: String(input.durationMonths ?? 0),
        credits: String(input.credits),
      },
      ...(receipt ? { receipt } : {}),
    }),
  });
}

export function getYooKassaPayment(providerPaymentId: string) {
  return yooKassaRequest(`/payments/${encodeURIComponent(providerPaymentId)}`);
}

function nextPeriodEnd(currentPeriodEnd: Date | null, months: number) {
  const now = new Date();
  const base = currentPeriodEnd && currentPeriodEnd > now ? new Date(currentPeriodEnd) : now;
  base.setUTCMonth(base.getUTCMonth() + months);
  return { startsAt: now, endsAt: base };
}

function paymentAuditPayload(payment: YooKassaPayment) {
  return {
    id: payment.id,
    status: payment.status,
    paid: Boolean(payment.paid),
    amount: payment.amount,
    metadata: payment.metadata ?? {},
    capturedAt: payment.captured_at ?? null,
    createdAt: payment.created_at ?? null,
  };
}

export async function syncYooKassaPayment(providerPaymentId: string) {
  const payment = await getYooKassaPayment(providerPaymentId);
  const localPayment = await prisma.billingPayment.findUnique({
    where: { providerPaymentId: payment.id },
    include: { client: { select: { subscription: true } } },
  });
  if (!localPayment) return { status: "unknown" as const };
  if (localPayment.status === "succeeded" && localPayment.creditsGranted > 0) {
    return { status: "succeeded" as const, clientId: localPayment.clientId };
  }

  const metadataMatches = payment.metadata?.billingPaymentId === localPayment.id
    && payment.metadata?.clientId === localPayment.clientId
    && payment.metadata?.purchaseKind === localPayment.purchaseKind
    && payment.metadata?.planCode === localPayment.planCode
    && Number(payment.metadata?.credits) === localPayment.creditsGranted;
  const amountMatches = payment.amount.currency === localPayment.currency
    && Math.round(Number(payment.amount.value) * 100) === localPayment.amountMinor;

  if (!metadataMatches || !amountMatches) {
    await prisma.billingPayment.update({
      where: { id: localPayment.id },
      data: { status: "verification_failed" },
    });
    return { status: "verification_failed" as const };
  }

  if (payment.status === "succeeded" && payment.paid) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.billingPayment.findUnique({ where: { id: localPayment.id } });
      if (!current || (current.status === "succeeded" && current.creditsGranted > 0)) return;

      const creditsToGrant = current.creditsGranted;
      if (!Number.isInteger(creditsToGrant) || creditsToGrant <= 0) {
        throw new Error("INVALID_PAYMENT_CREDITS");
      }

      const wallet = await tx.creditWallet.upsert({
        where: { clientId: current.clientId },
        create: { clientId: current.clientId },
        update: {},
      });
      const creditKey = `payment:${current.id}`;
      const existingGrant = await tx.creditTransaction.findUnique({ where: { idempotencyKey: creditKey } });
      if (!existingGrant) {
        const updatedWallet = await tx.creditWallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: creditsToGrant },
            lifetimeGranted: { increment: creditsToGrant },
          },
        });
        await tx.creditTransaction.create({
          data: {
            clientId: current.clientId,
            walletId: wallet.id,
            amount: creditsToGrant,
            balanceAfter: updatedWallet.balance,
            kind: current.purchaseKind === "top_up" ? "top_up" : "subscription_grant",
            description: current.purchaseKind === "top_up" ? "Пополнение кредитов" : "Кредиты по тарифу",
            referenceType: "billing_payment",
            referenceId: current.id,
            idempotencyKey: creditKey,
          },
        });
      }

      if (current.purchaseKind === "subscription") {
        const durationMonths = current.durationMonths ?? 1;
        const period = nextPeriodEnd(localPayment.client.subscription?.currentPeriodEnd ?? null, durationMonths);
        await tx.subscription.upsert({
          where: { clientId: current.clientId },
          create: {
            clientId: current.clientId,
            planCode: current.planCode ?? "start",
            status: "active",
            provider: "yookassa",
            currentPeriodStart: period.startsAt,
            currentPeriodEnd: period.endsAt,
            billingCycleMonths: durationMonths,
            creditsPerCycle: creditsToGrant,
          },
          update: {
            planCode: current.planCode ?? "start",
            status: "active",
            provider: "yookassa",
            currentPeriodStart: period.startsAt,
            currentPeriodEnd: period.endsAt,
            billingCycleMonths: durationMonths,
            creditsPerCycle: creditsToGrant,
            cancelAtPeriodEnd: false,
          },
        });
      }

      await tx.billingPayment.update({
        where: { id: current.id },
        data: {
          status: "succeeded",
          paidAt: payment.captured_at ? new Date(payment.captured_at) : new Date(),
          rawPayload: paymentAuditPayload(payment),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { status: "succeeded" as const, clientId: localPayment.clientId };
  }

  if (payment.status === "canceled") {
    await prisma.billingPayment.update({
      where: { id: localPayment.id },
      data: { status: "canceled", rawPayload: paymentAuditPayload(payment) },
    });
    return { status: "canceled" as const, clientId: localPayment.clientId };
  }

  await prisma.billingPayment.update({
    where: { id: localPayment.id },
    data: { status: payment.status, rawPayload: paymentAuditPayload(payment) },
  });
  return { status: "pending" as const, clientId: localPayment.clientId };
}
