-- Allow multiple monthly plan versions for the same blueprint/month.
ALTER TABLE "MonthlyOperatingPlan" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MonthlyOperatingPlan" DROP CONSTRAINT IF EXISTS "MonthlyOperatingPlan_blueprintId_month_key";
CREATE INDEX "MonthlyOperatingPlan_month_idx" ON "MonthlyOperatingPlan"("month");
CREATE INDEX "MonthlyOperatingPlan_blueprintId_month_idx" ON "MonthlyOperatingPlan"("blueprintId", "month");
