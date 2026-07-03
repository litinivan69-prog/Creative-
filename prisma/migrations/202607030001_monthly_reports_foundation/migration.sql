-- Monthly reports foundation.
-- Additive only: new optional columns on ScheduledPublication + new PublicationMetric table (manual entry now, n8n later).

-- AlterTable
ALTER TABLE "ScheduledPublication" ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "publishStatus" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PublicationMetric" (
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

-- CreateIndex
CREATE INDEX "PublicationMetric_scheduledPublicationId_idx" ON "PublicationMetric"("scheduledPublicationId");

-- CreateIndex
CREATE INDEX "PublicationMetric_clientId_idx" ON "PublicationMetric"("clientId");

-- CreateIndex
CREATE INDEX "PublicationMetric_monthlyPlanId_idx" ON "PublicationMetric"("monthlyPlanId");

-- CreateIndex
CREATE INDEX "PublicationMetric_platformName_idx" ON "PublicationMetric"("platformName");

-- CreateIndex
CREATE INDEX "PublicationMetric_capturedAt_idx" ON "PublicationMetric"("capturedAt");

-- AddForeignKey
ALTER TABLE "PublicationMetric" ADD CONSTRAINT "PublicationMetric_scheduledPublicationId_fkey" FOREIGN KEY ("scheduledPublicationId") REFERENCES "ScheduledPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

