-- CreateTable
CREATE TABLE "ContentDraftReviewEvent" (
    "id" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentDraftReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentDraftReviewEvent_contentDraftId_idx" ON "ContentDraftReviewEvent"("contentDraftId");

-- AddForeignKey
ALTER TABLE "ContentDraftReviewEvent" ADD CONSTRAINT "ContentDraftReviewEvent_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
