-- Support multiple brands per user without changing existing memberships.
DROP INDEX IF EXISTS "WorkspaceMembership_userId_key";
CREATE UNIQUE INDEX "WorkspaceMembership_userId_clientId_key" ON "WorkspaceMembership"("userId", "clientId");

-- Extend subscriptions and payments with credit-package metadata.
ALTER TABLE "Subscription"
  ADD COLUMN "billingCycleMonths" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "creditsPerCycle" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "BillingPayment"
  ADD COLUMN "purchaseKind" TEXT NOT NULL DEFAULT 'subscription',
  ADD COLUMN "planCode" TEXT,
  ADD COLUMN "durationMonths" INTEGER,
  ADD COLUMN "creditsGranted" INTEGER NOT NULL DEFAULT 0;

-- One wallet per brand. Every balance change is mirrored by an immutable ledger row.
CREATE TABLE "CreditWallet" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "lifetimeGranted" INTEGER NOT NULL DEFAULT 0,
  "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SelfServiceContentOrder" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "month" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "configuration" JSONB NOT NULL,
  "estimatedCredits" INTEGER NOT NULL DEFAULT 0,
  "chargedCredits" INTEGER NOT NULL DEFAULT 0,
  "ledgerTransactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SelfServiceContentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditWallet_clientId_key" ON "CreditWallet"("clientId");
CREATE INDEX "CreditWallet_balance_idx" ON "CreditWallet"("balance");
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");
CREATE INDEX "CreditTransaction_clientId_createdAt_idx" ON "CreditTransaction"("clientId", "createdAt");
CREATE INDEX "CreditTransaction_walletId_createdAt_idx" ON "CreditTransaction"("walletId", "createdAt");
CREATE INDEX "CreditTransaction_kind_idx" ON "CreditTransaction"("kind");
CREATE INDEX "CreditTransaction_referenceType_referenceId_idx" ON "CreditTransaction"("referenceType", "referenceId");
CREATE UNIQUE INDEX "SelfServiceContentOrder_ledgerTransactionId_key" ON "SelfServiceContentOrder"("ledgerTransactionId");
CREATE INDEX "SelfServiceContentOrder_clientId_createdAt_idx" ON "SelfServiceContentOrder"("clientId", "createdAt");
CREATE INDEX "SelfServiceContentOrder_clientId_month_idx" ON "SelfServiceContentOrder"("clientId", "month");
CREATE INDEX "SelfServiceContentOrder_status_idx" ON "SelfServiceContentOrder"("status");

ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SelfServiceContentOrder" ADD CONSTRAINT "SelfServiceContentOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
