ALTER TABLE "GeneratedCreativeVariant"
  ADD COLUMN IF NOT EXISTS "inputTokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "outputTokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER,
  ADD COLUMN IF NOT EXISTS "estimatedCostUsd" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "GeneratedCreativeVariant_monthlyPlanId_createdAt_idx"
  ON "GeneratedCreativeVariant"("monthlyPlanId", "createdAt");
