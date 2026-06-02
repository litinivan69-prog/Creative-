-- AlterTable
ALTER TABLE "GeneratedCreativeVariant"
ALTER COLUMN "imageBase64" DROP NOT NULL,
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'database_base64',
ADD COLUMN "fileSize" INTEGER;

-- CreateIndex
CREATE INDEX "GeneratedCreativeVariant_storageProvider_idx" ON "GeneratedCreativeVariant"("storageProvider");
