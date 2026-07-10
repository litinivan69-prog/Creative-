-- Cross-posting: one result row per platform for a publication.
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS "PublicationResult" (
    "id" TEXT NOT NULL,
    "scheduledPublicationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelRecordId" TEXT,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "imagesSent" INTEGER NOT NULL DEFAULT 0,
    "textTruncated" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicationResult_scheduledPublicationId_platform_key" ON "PublicationResult"("scheduledPublicationId", "platform");
CREATE INDEX IF NOT EXISTS "PublicationResult_clientId_idx" ON "PublicationResult"("clientId");
CREATE INDEX IF NOT EXISTS "PublicationResult_platform_idx" ON "PublicationResult"("platform");
CREATE INDEX IF NOT EXISTS "PublicationResult_publishedAt_idx" ON "PublicationResult"("publishedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PublicationResult_scheduledPublicationId_fkey'
  ) THEN
    ALTER TABLE "PublicationResult"
      ADD CONSTRAINT "PublicationResult_scheduledPublicationId_fkey"
      FOREIGN KEY ("scheduledPublicationId") REFERENCES "ScheduledPublication"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
