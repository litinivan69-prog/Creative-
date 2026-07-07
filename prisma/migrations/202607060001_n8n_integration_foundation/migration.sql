-- n8n integration foundation.
-- Additive + idempotent: the shared Neon DB may already carry an earlier
-- IntegrationEvent (without attempts/sentAt) and the publication columns from
-- other branches, so every statement is guarded and the table shape reconciled.

-- AlterTable: external publish tracking on ScheduledPublication
ALTER TABLE "ScheduledPublication" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;
ALTER TABLE "ScheduledPublication" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "ScheduledPublication" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "ScheduledPublication" ADD COLUMN IF NOT EXISTS "publishStatus" TEXT;

-- CreateTable: IntegrationEvent (only when absent)
CREATE TABLE IF NOT EXISTS "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- Reconcile shape if the table pre-existed with the earlier definition
ALTER TABLE "IntegrationEvent" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IntegrationEvent" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "IntegrationEvent" ALTER COLUMN "status" SET DEFAULT 'queued';

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "IntegrationEvent_eventType_idx" ON "IntegrationEvent"("eventType");
CREATE INDEX IF NOT EXISTS "IntegrationEvent_status_idx" ON "IntegrationEvent"("status");
CREATE INDEX IF NOT EXISTS "IntegrationEvent_relatedId_idx" ON "IntegrationEvent"("relatedId");
CREATE INDEX IF NOT EXISTS "IntegrationEvent_createdAt_idx" ON "IntegrationEvent"("createdAt");
