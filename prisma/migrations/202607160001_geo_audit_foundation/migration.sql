-- GEO audit foundation (additive, idempotent — safe on shared Neon across branch deploys)

CREATE TABLE IF NOT EXISTS "GeoAudit" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "presenceIndex" INTEGER NOT NULL DEFAULT 0,
    "sovScore" INTEGER NOT NULL DEFAULT 0,
    "sovMax" INTEGER NOT NULL DEFAULT 40,
    "positionScore" INTEGER NOT NULL DEFAULT 0,
    "positionMax" INTEGER NOT NULL DEFAULT 25,
    "toneScore" INTEGER NOT NULL DEFAULT 0,
    "toneMax" INTEGER NOT NULL DEFAULT 20,
    "accuracyScore" INTEGER NOT NULL DEFAULT 0,
    "accuracyMax" INTEGER NOT NULL DEFAULT 15,
    "sovPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mentionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queriesTotal" INTEGER NOT NULL DEFAULT 0,
    "queriesCategorical" INTEGER NOT NULL DEFAULT 0,
    "queriesBrand" INTEGER NOT NULL DEFAULT 0,
    "reportFileUrl" TEXT,
    "reportStorageKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeoAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GeoEngineResult" (
    "id" TEXT NOT NULL,
    "geoAuditId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "mentions" INTEGER NOT NULL DEFAULT 0,
    "spontaneous" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GeoEngineResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GeoCompetitor" (
    "id" TEXT NOT NULL,
    "geoAuditId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mentions" INTEGER NOT NULL DEFAULT 0,
    "sharePercent" DOUBLE PRECISION,
    "note" TEXT,
    CONSTRAINT "GeoCompetitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GeoSource" (
    "id" TEXT NOT NULL,
    "geoAuditId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "citations" INTEGER,
    CONSTRAINT "GeoSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GeoGrowthPoint" (
    "id" TEXT NOT NULL,
    "geoAuditId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "citations" INTEGER,
    "note" TEXT,
    CONSTRAINT "GeoGrowthPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GeoAudit_clientId_idx" ON "GeoAudit"("clientId");
CREATE INDEX IF NOT EXISTS "GeoAudit_auditDate_idx" ON "GeoAudit"("auditDate");
CREATE INDEX IF NOT EXISTS "GeoAudit_clientId_auditDate_idx" ON "GeoAudit"("clientId", "auditDate");
CREATE INDEX IF NOT EXISTS "GeoEngineResult_geoAuditId_idx" ON "GeoEngineResult"("geoAuditId");
CREATE INDEX IF NOT EXISTS "GeoCompetitor_geoAuditId_idx" ON "GeoCompetitor"("geoAuditId");
CREATE INDEX IF NOT EXISTS "GeoSource_geoAuditId_idx" ON "GeoSource"("geoAuditId");
CREATE INDEX IF NOT EXISTS "GeoGrowthPoint_geoAuditId_idx" ON "GeoGrowthPoint"("geoAuditId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeoAudit_clientId_fkey') THEN
        ALTER TABLE "GeoAudit" ADD CONSTRAINT "GeoAudit_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeoEngineResult_geoAuditId_fkey') THEN
        ALTER TABLE "GeoEngineResult" ADD CONSTRAINT "GeoEngineResult_geoAuditId_fkey"
            FOREIGN KEY ("geoAuditId") REFERENCES "GeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeoCompetitor_geoAuditId_fkey') THEN
        ALTER TABLE "GeoCompetitor" ADD CONSTRAINT "GeoCompetitor_geoAuditId_fkey"
            FOREIGN KEY ("geoAuditId") REFERENCES "GeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeoSource_geoAuditId_fkey') THEN
        ALTER TABLE "GeoSource" ADD CONSTRAINT "GeoSource_geoAuditId_fkey"
            FOREIGN KEY ("geoAuditId") REFERENCES "GeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeoGrowthPoint_geoAuditId_fkey') THEN
        ALTER TABLE "GeoGrowthPoint" ADD CONSTRAINT "GeoGrowthPoint_geoAuditId_fkey"
            FOREIGN KEY ("geoAuditId") REFERENCES "GeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
