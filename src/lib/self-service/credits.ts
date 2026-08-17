import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TRIAL_CREDITS } from "@/lib/self-service/credit-catalog";

export * from "@/lib/self-service/credit-catalog";

export async function ensureCreditWallet(clientId: string) {
  return prisma.creditWallet.upsert({
    where: { clientId },
    create: { clientId },
    update: {},
  });
}

export async function grantTrialCredits(clientId: string) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.upsert({
      where: { clientId },
      create: { clientId },
      update: {},
    });
    const idempotencyKey = `trial:${clientId}`;
    const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const updatedWallet = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: TRIAL_CREDITS },
        lifetimeGranted: { increment: TRIAL_CREDITS },
      },
    });

    return tx.creditTransaction.create({
      data: {
        clientId,
        walletId: wallet.id,
        amount: TRIAL_CREDITS,
        balanceAfter: updatedWallet.balance,
        kind: "trial_grant",
        description: "Пробные кредиты для знакомства с платформой",
        idempotencyKey,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function spendCredits(input: {
  clientId: string;
  credits: number;
  description: string;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
}) {
  if (!Number.isInteger(input.credits) || input.credits <= 0) throw new Error("INVALID_CREDIT_AMOUNT");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;

    const wallet = await tx.creditWallet.findUnique({ where: { clientId: input.clientId } });
    if (!wallet || wallet.balance < input.credits) throw new Error("INSUFFICIENT_CREDITS");

    const updatedWallet = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: input.credits },
        lifetimeSpent: { increment: input.credits },
      },
    });

    return tx.creditTransaction.create({
      data: {
        clientId: input.clientId,
        walletId: wallet.id,
        amount: -input.credits,
        balanceAfter: updatedWallet.balance,
        kind: "spend",
        description: input.description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
