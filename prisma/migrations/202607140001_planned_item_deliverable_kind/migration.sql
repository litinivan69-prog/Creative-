-- Unified month, stage A: planned items carry a deliverable kind ("post" | "article").
-- Additive + idempotent: safe on shared Neon across branch deploys.

ALTER TABLE "PlannedContentItem"
    ADD COLUMN IF NOT EXISTS "deliverableKind" TEXT NOT NULL DEFAULT 'post';
