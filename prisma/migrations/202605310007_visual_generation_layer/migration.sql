-- CreateTable
CREATE TABLE "GeneratedCreativeVariant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "monthlyPlanId" TEXT NOT NULL,
    "plannedContentItemId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "scheduledPublicationId" TEXT NOT NULL,
    "creativeAssetId" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "revisedPrompt" TEXT,
    "imageBase64" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'openai',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedCreativeVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedCreativeVariant_clientId_idx" ON "GeneratedCreativeVariant"("clientId");

-- CreateIndex
CREATE INDEX "GeneratedCreativeVariant_monthlyPlanId_idx" ON "GeneratedCreativeVariant"("monthlyPlanId");

-- CreateIndex
CREATE INDEX "GeneratedCreativeVariant_creativeAssetId_idx" ON "GeneratedCreativeVariant"("creativeAssetId");

-- CreateIndex
CREATE INDEX "GeneratedCreativeVariant_status_idx" ON "GeneratedCreativeVariant"("status");

-- AddForeignKey
ALTER TABLE "GeneratedCreativeVariant" ADD CONSTRAINT "GeneratedCreativeVariant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCreativeVariant" ADD CONSTRAINT "GeneratedCreativeVariant_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCreativeVariant" ADD CONSTRAINT "GeneratedCreativeVariant_monthlyPlanId_fkey" FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCreativeVariant" ADD CONSTRAINT "GeneratedCreativeVariant_plannedContentItemId_fkey" FOREIGN KEY ("plannedContentItemId") REFERENCES "PlannedContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCreativeVariant" ADD CONSTRAINT "GeneratedCreativeVariant_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCreativeVariant" ADD CONSTRAINT "GeneratedCreativeVariant_scheduledPublicationId_fkey" FOREIGN KEY ("scheduledPublicationId") REFERENCES "ScheduledPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCreativeVariant" ADD CONSTRAINT "GeneratedCreativeVariant_creativeAssetId_fkey" FOREIGN KEY ("creativeAssetId") REFERENCES "CreativeAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
