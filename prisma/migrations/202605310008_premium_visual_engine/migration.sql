-- AlterTable
ALTER TABLE "GeneratedCreativeVariant"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN "model" TEXT,
ADD COLUMN "quality" TEXT,
ADD COLUMN "size" TEXT,
ADD COLUMN "textMode" TEXT,
ADD COLUMN "qualityStatus" TEXT NOT NULL DEFAULT 'unchecked',
ADD COLUMN "qualityNotes" TEXT;
