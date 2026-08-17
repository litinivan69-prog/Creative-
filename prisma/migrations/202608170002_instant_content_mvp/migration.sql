CREATE TABLE "SelfServiceInstantContent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "platform" TEXT,
    "sourceText" TEXT NOT NULL,
    "rating" INTEGER,
    "generatedText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "errorMessage" TEXT,
    "chargedCredits" INTEGER NOT NULL DEFAULT 0,
    "ledgerTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfServiceInstantContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SelfServiceInstantContent_ledgerTransactionId_key" ON "SelfServiceInstantContent"("ledgerTransactionId");
CREATE INDEX "SelfServiceInstantContent_clientId_createdAt_idx" ON "SelfServiceInstantContent"("clientId", "createdAt");
CREATE INDEX "SelfServiceInstantContent_clientId_kind_createdAt_idx" ON "SelfServiceInstantContent"("clientId", "kind", "createdAt");
CREATE INDEX "SelfServiceInstantContent_status_idx" ON "SelfServiceInstantContent"("status");

ALTER TABLE "SelfServiceInstantContent" ADD CONSTRAINT "SelfServiceInstantContent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
