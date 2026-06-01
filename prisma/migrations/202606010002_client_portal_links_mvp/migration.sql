-- CreateTable
CREATE TABLE "ClientPortalLink" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "monthlyPlanId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalLink_tokenHash_key" ON "ClientPortalLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientPortalLink_clientId_idx" ON "ClientPortalLink"("clientId");

-- CreateIndex
CREATE INDEX "ClientPortalLink_monthlyPlanId_idx" ON "ClientPortalLink"("monthlyPlanId");

-- CreateIndex
CREATE INDEX "ClientPortalLink_status_idx" ON "ClientPortalLink"("status");

-- CreateIndex
CREATE INDEX "ClientPortalLink_createdAt_idx" ON "ClientPortalLink"("createdAt");

-- AddForeignKey
ALTER TABLE "ClientPortalLink" ADD CONSTRAINT "ClientPortalLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalLink" ADD CONSTRAINT "ClientPortalLink_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalLink" ADD CONSTRAINT "ClientPortalLink_monthlyPlanId_fkey" FOREIGN KEY ("monthlyPlanId") REFERENCES "MonthlyOperatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
