-- Article engine foundation (additive, idempotent — safe on shared Neon across branch deploys)

CREATE TABLE IF NOT EXISTS "Article" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "blueprintId" TEXT,
    "monthlyPlanId" TEXT,
    "plannedContentItemId" TEXT,
    "title" TEXT NOT NULL,
    "angle" TEXT,
    "geoFocus" TEXT,
    "targetQueries" JSONB NOT NULL DEFAULT '[]',
    "briefJson" JSONB,
    "bodyMarkdown" TEXT NOT NULL DEFAULT '',
    "faq" JSONB NOT NULL DEFAULT '[]',
    "schemaJsonLd" JSONB,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "images" JSONB NOT NULL DEFAULT '[]',
    "calloutNotes" JSONB NOT NULL DEFAULT '[]',
    "wordCount" INTEGER,
    "model" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "platformTarget" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'brief',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Article_clientId_idx" ON "Article"("clientId");
CREATE INDEX IF NOT EXISTS "Article_monthlyPlanId_idx" ON "Article"("monthlyPlanId");
CREATE INDEX IF NOT EXISTS "Article_status_idx" ON "Article"("status");
CREATE INDEX IF NOT EXISTS "Article_createdAt_idx" ON "Article"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Article_clientId_fkey'
    ) THEN
        ALTER TABLE "Article"
            ADD CONSTRAINT "Article_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
