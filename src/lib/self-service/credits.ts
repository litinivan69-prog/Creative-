import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TRIAL_CREDITS } from "@/lib/self-service/credit-catalog";
import { clientHasUnlimitedCredits } from "@/lib/self-service/admin-access";

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
    if (existing) {
      if (existing.amount >= TRIAL_CREDITS) return existing;
      const upgradeKey = `trial:upgrade:${TRIAL_CREDITS}:${clientId}`;
      const existingUpgrade = await tx.creditTransaction.findUnique({ where: { idempotencyKey: upgradeKey } });
      if (existingUpgrade) return existingUpgrade;
      const difference = TRIAL_CREDITS - existing.amount;
      const upgradedWallet = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: difference }, lifetimeGranted: { increment: difference } },
      });
      return tx.creditTransaction.create({
        data: {
          clientId,
          walletId: wallet.id,
          amount: difference,
          balanceAfter: upgradedWallet.balance,
          kind: "trial_grant",
          description: "Дополнение пробных кредитов до полного тестового набора",
          idempotencyKey: upgradeKey,
        },
      });
    }

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
  const unlimited = await clientHasUnlimitedCredits(input.clientId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;

    const wallet = await tx.creditWallet.upsert({
      where: { clientId: input.clientId },
      create: { clientId: input.clientId },
      update: {},
    });
    if (!unlimited && wallet.balance < input.credits) throw new Error("INSUFFICIENT_CREDITS");

    if (unlimited) {
      return tx.creditTransaction.create({
        data: {
          clientId: input.clientId,
          walletId: wallet.id,
          amount: 0,
          balanceAfter: wallet.balance,
          kind: "admin_usage",
          description: `${input.description} · админский тест без списания`,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey: input.idempotencyKey,
        },
      });
    }

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
