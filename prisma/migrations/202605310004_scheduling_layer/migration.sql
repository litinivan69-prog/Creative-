-- CreateTable
CREATE TABLE "ScheduledPublication" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "monthlyPlanId" TEXT NOT NULL,
    "plannedContentItemId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "platformName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "scheduledTime" TEXT,
    "timezone" TEXT,
    "status" TEXT NOT NULL,
    "publishMode" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPublication_clientId_idx" ON "ScheduledPublication"("clientId");

-- CreateIndex
CREATE INDEX "ScheduledPublication_monthlyPlanId_idx" ON "ScheduledPublication"("monthlyPlanId");

-- CreateIndex
CREATE INDEX "ScheduledPublication_contentDraftId_idx" ON "ScheduledPublication"("contentDraftId");

-- CreateIndex
CREATE INDEX "ScheduledPublication_status_idx" ON "ScheduledPublication"("status");

-- AddForeignKey
ALTER TABLE "ScheduledPublication" ADD CONSTRAINT "ScheduledPublication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPublication" ADD CONSTRAINT "ScheduledPublication_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPublication" ADD CONSTRAINT "ScheduledPublication_monthlyPlanId_fkey" FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPublication" ADD CONSTRAINT "ScheduledPublication_plannedContentItemId_fkey" FOREIGN KEY ("plannedContentItemId") REFERENCES "PlannedContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPublication" ADD CONSTRAINT "ScheduledPublication_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
