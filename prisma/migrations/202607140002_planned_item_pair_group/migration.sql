-- Unified month, stage B: VK+TG paired planned items share a pairGroupId.
-- Additive + idempotent: safe on shared Neon across branch deploys.

ALTER TABLE "PlannedContentItem"
    ADD COLUMN IF NOT EXISTS "pairGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "PlannedContentItem_pairGroupId_idx" ON "PlannedContentItem"("pairGroupId");
