-- CreateTable
CREATE TABLE "MonthProductionRun" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "monthlyPlanId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "currentStage" TEXT NOT NULL DEFAULT 'planning',
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "failedTasks" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthProductionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthProductionTask" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "monthlyPlanId" TEXT NOT NULL,
    "plannedContentItemId" TEXT,
    "contentDraftId" TEXT,
    "creativeAssetId" TEXT,
    "stage" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "title" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthProductionRun_clientId_idx" ON "MonthProductionRun"("clientId");
CREATE INDEX "MonthProductionRun_blueprintId_idx" ON "MonthProductionRun"("blueprintId");
CREATE INDEX "MonthProductionRun_monthlyPlanId_idx" ON "MonthProductionRun"("monthlyPlanId");
CREATE INDEX "MonthProductionRun_status_idx" ON "MonthProductionRun"("status");
CREATE INDEX "MonthProductionRun_currentStage_idx" ON "MonthProductionRun"("currentStage");
CREATE INDEX "MonthProductionRun_createdAt_idx" ON "MonthProductionRun"("createdAt");

-- CreateIndex
CREATE INDEX "MonthProductionTask_productionRunId_idx" ON "MonthProductionTask"("productionRunId");
CREATE INDEX "MonthProductionTask_monthlyPlanId_idx" ON "MonthProductionTask"("monthlyPlanId");
CREATE INDEX "MonthProductionTask_plannedContentItemId_idx" ON "MonthProductionTask"("plannedContentItemId");
CREATE INDEX "MonthProductionTask_creativeAssetId_idx" ON "MonthProductionTask"("creativeAssetId");
CREATE INDEX "MonthProductionTask_status_idx" ON "MonthProductionTask"("status");
CREATE INDEX "MonthProductionTask_stage_idx" ON "MonthProductionTask"("stage");
CREATE INDEX "MonthProductionTask_taskType_idx" ON "MonthProductionTask"("taskType");
CREATE INDEX "MonthProductionTask_createdAt_idx" ON "MonthProductionTask"("createdAt");

-- AddForeignKey
ALTER TABLE "MonthProductionRun" ADD CONSTRAINT "MonthProductionRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthProductionRun" ADD CONSTRAINT "MonthProductionRun_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthProductionRun" ADD CONSTRAINT "MonthProductionRun_monthlyPlanId_fkey" FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthProductionTask" ADD CONSTRAINT "MonthProductionTask_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "MonthProductionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthProductionTask" ADD CONSTRAINT "MonthProductionTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthProductionTask" ADD CONSTRAINT "MonthProductionTask_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthProductionTask" ADD CONSTRAINT "MonthProductionTask_monthlyPlanId_fkey" FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthProductionTask" ADD CONSTRAINT "MonthProductionTask_plannedContentItemId_fkey" FOREIGN KEY ("plannedContentItemId") REFERENCES "PlannedContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthProductionTask" ADD CONSTRAINT "MonthProductionTask_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthProductionTask" ADD CONSTRAINT "MonthProductionTask_creativeAssetId_fkey" FOREIGN KEY ("creativeAssetId") REFERENCES "CreativeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
