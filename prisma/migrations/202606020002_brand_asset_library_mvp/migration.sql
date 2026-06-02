-- CreateTable
CREATE TABLE "ClientBrandProfile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "toneOfVoice" TEXT,
    "keyMessages" TEXT,
    "targetAudienceNotes" TEXT,
    "brandColors" TEXT,
    "fonts" TEXT,
    "visualStyle" TEXT,
    "forbiddenTopics" TEXT,
    "requiredDisclaimers" TEXT,
    "legalNotes" TEXT,
    "productServiceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientBrandProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientBrandAsset" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "storageKey" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'vercel_blob',
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "textContent" TEXT,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientBrandAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientBrandProfile_clientId_key" ON "ClientBrandProfile"("clientId");
CREATE INDEX "ClientBrandAsset_clientId_idx" ON "ClientBrandAsset"("clientId");
CREATE INDEX "ClientBrandAsset_assetType_idx" ON "ClientBrandAsset"("assetType");
CREATE INDEX "ClientBrandAsset_status_idx" ON "ClientBrandAsset"("status");
CREATE INDEX "ClientBrandAsset_createdAt_idx" ON "ClientBrandAsset"("createdAt");

ALTER TABLE "ClientBrandProfile" ADD CONSTRAINT "ClientBrandProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientBrandAsset" ADD CONSTRAINT "ClientBrandAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
