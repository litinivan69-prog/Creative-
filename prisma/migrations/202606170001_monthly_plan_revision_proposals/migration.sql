CREATE TABLE "MonthlyPlanRevisionProposal" (
  "id" TEXT NOT NULL,
  "monthlyPlanId" TEXT NOT NULL,
  "instruction" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "proposedChanges" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MonthlyPlanRevisionProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonthlyPlanRevisionProposal_monthlyPlanId_idx" ON "MonthlyPlanRevisionProposal"("monthlyPlanId");
CREATE INDEX "MonthlyPlanRevisionProposal_status_idx" ON "MonthlyPlanRevisionProposal"("status");

ALTER TABLE "MonthlyPlanRevisionProposal"
ADD CONSTRAINT "MonthlyPlanRevisionProposal_monthlyPlanId_fkey"
FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
