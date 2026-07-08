-- Telegram autopost foundation.
-- Additive + idempotent: platform-owned integration settings (bot token lives in DB,
-- entered via the app settings UI) and a per-client channel registry for routing.

-- CreateTable: IntegrationSetting (key/value store for integration secrets & config)
CREATE TABLE IF NOT EXISTS "IntegrationSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationSetting_key_key" ON "IntegrationSetting"("key");

-- CreateTable: ClientChannel (client channel registry, filled during brief/onboarding)
CREATE TABLE IF NOT EXISTS "ClientChannel" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'telegram',
    "channelId" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientChannel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientChannel_clientId_idx" ON "ClientChannel"("clientId");
CREATE INDEX IF NOT EXISTS "ClientChannel_platform_idx" ON "ClientChannel"("platform");
CREATE INDEX IF NOT EXISTS "ClientChannel_status_idx" ON "ClientChannel"("status");

-- AddForeignKey (only when absent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClientChannel_clientId_fkey'
  ) THEN
    ALTER TABLE "ClientChannel"
      ADD CONSTRAINT "ClientChannel_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
