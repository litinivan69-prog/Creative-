-- Reliable delivery state for scheduled self-service publishing.

ALTER TABLE "ScheduledPublication"
  ADD COLUMN IF NOT EXISTS "publishErrorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "publishAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastPublishAttemptAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ScheduledPublication_publishStatus_idx"
  ON "ScheduledPublication"("publishStatus");
