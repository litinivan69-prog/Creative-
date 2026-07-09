-- Telegram-length post text produced by the content generator.
-- Additive + idempotent.

ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "telegramBody" TEXT;
