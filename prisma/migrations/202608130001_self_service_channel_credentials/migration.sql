-- Per-brand encrypted social credentials for self-service publishing.
-- Additive only: existing agency channels and global integration settings keep working.

ALTER TABLE "ClientChannel"
  ADD COLUMN IF NOT EXISTS "credentialEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "credentialHint" TEXT,
  ADD COLUMN IF NOT EXISTS "autopublishEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "connectedAt" TIMESTAMP(3);
