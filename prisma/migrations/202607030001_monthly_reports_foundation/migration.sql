-- Monthly reports foundation.
-- Additive + idempotent: the shared Neon DB may already carry an earlier metrics
-- migration (different branch) with a stricter PublicationMetric shape, so every
-- statement is guarded and the table shape is reconciled to this branch.

-- AlterTable: publish tracking on ScheduledPublication
ALTER TABLE "ScheduledPublication" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;
ALTER TABLE "ScheduledPublication" ADD COLUMN IF NOT EXISTS "publishStatus" TEXT;
ALTER TABLE "ScheduledPublication" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- CreateTable: PublicationMetric (only when absent)
CREATE TABLE IF NOT EXISTS "PublicationMetric" (
    "id" TEXT NOT NULL,
    "scheduledPublicationId" TEXT,
    "plannedContentItemId" TEXT,
    "clientId" TEXT NOT NULL,
    "monthlyPlanId" TEXT NOT NULL,
    "platformName" TEXT NOT NULL,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "reach" INTEGER,
    "views" INTEGER,
    "saves" INTEGER,
    "clicks" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationMetric_pkey" PRIMARY KEY ("id")
);

-- Reconcile shape when the table pre-existed with the earlier definition
ALTER TABLE "PublicationMetric" ADD COLUMN IF NOT EXISTS "plannedContentItemId" TEXT;
ALTER TABLE "PublicationMetric" ALTER COLUMN "scheduledPublicationId" DROP NOT NULL;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "PublicationMetric_scheduledPublicationId_idx" ON "PublicationMetric"("scheduledPublicationId");
CREATE INDEX IF NOT EXISTS "PublicationMetric_clientId_idx" ON "PublicationMetric"("clientId");
CREATE INDEX IF NOT EXISTS "PublicationMetric_monthlyPlanId_idx" ON "PublicationMetric"("monthlyPlanId");
CREATE INDEX IF NOT EXISTS "PublicationMetric_platformName_idx" ON "PublicationMetric"("platformName");
CREATE INDEX IF NOT EXISTS "PublicationMetric_capturedAt_idx" ON "PublicationMetric"("capturedAt");

-- AddForeignKey (only when absent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PublicationMetric_scheduledPublicationId_fkey'
  ) THEN
    ALTER TABLE "PublicationMetric"
      ADD CONSTRAINT "PublicationMetric_scheduledPublicationId_fkey"
      FOREIGN KEY ("scheduledPublicationId") REFERENCES "ScheduledPublication"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
