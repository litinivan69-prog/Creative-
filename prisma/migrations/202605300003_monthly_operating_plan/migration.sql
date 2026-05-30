CREATE TABLE "MonthlyOperatingPlan" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "blueprintId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "totalPlannedUnits" INTEGER NOT NULL,
  "approvalStrategy" TEXT NOT NULL,
  "autopublishStrategy" TEXT NOT NULL,
  "riskSummary" TEXT NOT NULL,
  "rawPlanJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MonthlyOperatingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyPlanModule" (
  "id" TEXT NOT NULL,
  "monthlyPlanId" TEXT NOT NULL,
  "moduleType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "plannedUnitsMin" INTEGER NOT NULL,
  "plannedUnitsMax" INTEGER NOT NULL,
  "rationale" TEXT NOT NULL,

  CONSTRAINT "MonthlyPlanModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyPlanPlatform" (
  "id" TEXT NOT NULL,
  "monthlyPlanId" TEXT NOT NULL,
  "platformName" TEXT NOT NULL,
  "platformType" TEXT NOT NULL,
  "automationStatus" TEXT NOT NULL,
  "plannedCadence" TEXT NOT NULL,
  "contentFormats" JSONB NOT NULL DEFAULT '[]',
  "requiresIntegrationBeforeLaunch" BOOLEAN NOT NULL,
  "rationale" TEXT NOT NULL,

  CONSTRAINT "MonthlyPlanPlatform_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlannedContentItem" (
  "id" TEXT NOT NULL,
  "monthlyPlanId" TEXT NOT NULL,
  "moduleType" TEXT NOT NULL,
  "platformName" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "plannedDate" TEXT NOT NULL,
  "approvalRequired" BOOLEAN NOT NULL,
  "autopublishEligible" BOOLEAN NOT NULL,
  "requiredInputs" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL,

  CONSTRAINT "PlannedContentItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagerTask" (
  "id" TEXT NOT NULL,
  "monthlyPlanId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,

  CONSTRAINT "ManagerTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonthlyOperatingPlan_clientId_idx" ON "MonthlyOperatingPlan"("clientId");
CREATE INDEX "MonthlyOperatingPlan_blueprintId_idx" ON "MonthlyOperatingPlan"("blueprintId");
CREATE INDEX "MonthlyPlanModule_monthlyPlanId_idx" ON "MonthlyPlanModule"("monthlyPlanId");
CREATE INDEX "MonthlyPlanPlatform_monthlyPlanId_idx" ON "MonthlyPlanPlatform"("monthlyPlanId");
CREATE INDEX "PlannedContentItem_monthlyPlanId_idx" ON "PlannedContentItem"("monthlyPlanId");
CREATE INDEX "ManagerTask_monthlyPlanId_idx" ON "ManagerTask"("monthlyPlanId");

ALTER TABLE "MonthlyOperatingPlan"
ADD CONSTRAINT "MonthlyOperatingPlan_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyOperatingPlan"
ADD CONSTRAINT "MonthlyOperatingPlan_blueprintId_fkey"
FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyPlanModule"
ADD CONSTRAINT "MonthlyPlanModule_monthlyPlanId_fkey"
FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyPlanPlatform"
ADD CONSTRAINT "MonthlyPlanPlatform_monthlyPlanId_fkey"
FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlannedContentItem"
ADD CONSTRAINT "PlannedContentItem_monthlyPlanId_fkey"
FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagerTask"
ADD CONSTRAINT "ManagerTask_monthlyPlanId_fkey"
FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
