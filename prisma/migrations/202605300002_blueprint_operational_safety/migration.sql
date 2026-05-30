ALTER TABLE "ClientPresenceBlueprint"
ADD COLUMN "missingBriefFields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "assumptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "confidenceScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextRecommendedAction" TEXT NOT NULL DEFAULT 'request_more_brief_data';
