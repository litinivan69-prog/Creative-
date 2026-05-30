ALTER TABLE "ClientPresenceBlueprint"
ADD COLUMN "totalContentUnitsMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalContentUnitsMax" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "integrationRequirements" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "humanReviewPolicy" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "PresenceModule"
ADD COLUMN "moduleType" TEXT NOT NULL DEFAULT 'custom';

ALTER TABLE "PlatformRecommendation"
ADD COLUMN "platformType" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN "automationStatus" TEXT NOT NULL DEFAULT 'needs_verification',
ADD COLUMN "requiredCredentials" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "permissionsNeeded" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "contentFormats" JSONB NOT NULL DEFAULT '[]';
