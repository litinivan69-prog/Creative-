import { prisma } from "@/lib/prisma";

export const SELF_SERVICE_PRICE_MINOR = 1_990_000;
export const SELF_SERVICE_PRICE_VALUE = "19900.00";
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
}) {
  const receiptVatCode = process.env.YOOKASSA_VAT_CODE?.trim();
  const receipt = receiptVatCode
    ? {
        customer: { email: input.email },
        items: [{
          description: "Adaptive Presence — доступ на 1 месяц",
          quantity: "1.00",
          amount: { value: SELF_SERVICE_PRICE_VALUE, currency: "RUB" },
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
      amount: { value: SELF_SERVICE_PRICE_VALUE, currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: input.returnUrl },
      description: "Adaptive Presence — доступ на 1 месяц",
      metadata: {
        billingPaymentId: input.billingPaymentId,
        clientId: input.clientId,
        planCode: "presence_monthly",
      },
      ...(receipt ? { receipt } : {}),
    }),
  });
}

export function getYooKassaPayment(providerPaymentId: string) {
  return yooKassaRequest(`/payments/${encodeURIComponent(providerPaymentId)}`);
}

function nextPeriodEnd(currentPeriodEnd: Date | null) {
  const now = new Date();
  const base = currentPeriodEnd && currentPeriodEnd > now ? new Date(currentPeriodEnd) : now;
  base.setUTCMonth(base.getUTCMonth() + 1);
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
  if (localPayment.status === "succeeded") {
    return { status: "succeeded" as const, clientId: localPayment.clientId };
  }

  const metadataMatches = payment.metadata?.billingPaymentId === localPayment.id
    && payment.metadata?.clientId === localPayment.clientId;
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
    const period = nextPeriodEnd(localPayment.client.subscription?.currentPeriodEnd ?? null);
    await prisma.$transaction([
      prisma.billingPayment.update({
        where: { id: localPayment.id },
        data: {
          status: "succeeded",
          paidAt: payment.captured_at ? new Date(payment.captured_at) : new Date(),
          rawPayload: paymentAuditPayload(payment),
        },
      }),
      prisma.subscription.upsert({
        where: { clientId: localPayment.clientId },
        create: {
          clientId: localPayment.clientId,
          planCode: "presence_monthly",
          status: "active",
          provider: "yookassa",
          currentPeriodStart: period.startsAt,
          currentPeriodEnd: period.endsAt,
        },
        update: {
          planCode: "presence_monthly",
          status: "active",
          provider: "yookassa",
          currentPeriodStart: period.startsAt,
          currentPeriodEnd: period.endsAt,
          cancelAtPeriodEnd: false,
        },
      }),
    ]);
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
