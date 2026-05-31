CREATE TABLE "ContentDraft" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "blueprintId" TEXT NOT NULL,
  "monthlyPlanId" TEXT NOT NULL,
  "plannedContentItemId" TEXT NOT NULL,
  "platformName" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "draftTitle" TEXT NOT NULL,
  "draftBody" TEXT NOT NULL,
  "draftNotes" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL,
  "approvalRequired" BOOLEAN NOT NULL,
  "autopublishEligible" BOOLEAN NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentDraft_plannedContentItemId_key" ON "ContentDraft"("plannedContentItemId");
CREATE INDEX "ContentDraft_clientId_idx" ON "ContentDraft"("clientId");
CREATE INDEX "ContentDraft_blueprintId_idx" ON "ContentDraft"("blueprintId");
CREATE INDEX "ContentDraft_monthlyPlanId_idx" ON "ContentDraft"("monthlyPlanId");

ALTER TABLE "ContentDraft"
ADD CONSTRAINT "ContentDraft_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentDraft"
ADD CONSTRAINT "ContentDraft_blueprintId_fkey"
FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentDraft"
ADD CONSTRAINT "ContentDraft_monthlyPlanId_fkey"
FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentDraft"
ADD CONSTRAINT "ContentDraft_plannedContentItemId_fkey"
FOREIGN KEY ("plannedContentItemId") REFERENCES "PlannedContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
