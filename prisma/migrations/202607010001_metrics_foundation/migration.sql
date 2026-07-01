-- Publication metrics + integration event foundation.
-- Additive only: new optional columns on ScheduledPublication, new PublicationMetric and IntegrationEvent tables.

-- AlterTable
ALTER TABLE "ScheduledPublication" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "publishStatus" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PublicationMetric" (
    "id" TEXT NOT NULL,
    "scheduledPublicationId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "IntegrationEvent_eventType_idx" ON "IntegrationEvent"("eventType");

-- CreateIndex
CREATE INDEX "IntegrationEvent_status_idx" ON "IntegrationEvent"("status");

-- CreateIndex
CREATE INDEX "IntegrationEvent_createdAt_idx" ON "IntegrationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_relatedId_idx" ON "IntegrationEvent"("relatedId");

-- AddForeignKey
ALTER TABLE "PublicationMetric" ADD CONSTRAINT "PublicationMetric_scheduledPublicationId_fkey" FOREIGN KEY ("scheduledPublicationId") REFERENCES "ScheduledPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
