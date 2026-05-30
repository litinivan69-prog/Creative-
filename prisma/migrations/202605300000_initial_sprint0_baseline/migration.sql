CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "website" TEXT,
  "industry" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientBrief" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "rawBrief" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPresenceBlueprint" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "clientSummary" TEXT NOT NULL,
  "businessGoals" JSONB NOT NULL,
  "notRecommendedPlatforms" JSONB NOT NULL,
  "recommendedMonthlyContentScope" JSONB NOT NULL,
  "publishingFrequency" JSONB NOT NULL,
  "approvalMode" TEXT NOT NULL,
  "managerAttentionLevel" TEXT NOT NULL,
  "rawBlueprintJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientPresenceBlueprint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PresenceModule" (
  "id" TEXT NOT NULL,
  "blueprintId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "monthlyContentScope" JSONB NOT NULL,

  CONSTRAINT "PresenceModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformRecommendation" (
  "id" TEXT NOT NULL,
  "blueprintId" TEXT NOT NULL,
  "platformName" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "contentRole" TEXT NOT NULL,
  "suggestedFrequency" TEXT NOT NULL,
  "automationOpportunity" TEXT NOT NULL,

  CONSTRAINT "PlatformRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationPlan" (
  "id" TEXT NOT NULL,
  "blueprintId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "humanCheckpoint" TEXT NOT NULL,
  "toolCategory" TEXT NOT NULL,
  "priority" TEXT NOT NULL,

  CONSTRAINT "AutomationPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskRule" (
  "id" TEXT NOT NULL,
  "blueprintId" TEXT NOT NULL,
  "ruleName" TEXT NOT NULL,
  "riskDescription" TEXT NOT NULL,
  "preventionAction" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "approvalRequired" BOOLEAN NOT NULL,

  CONSTRAINT "RiskRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPresenceBlueprint_briefId_key" ON "ClientPresenceBlueprint"("briefId");
CREATE INDEX "ClientBrief_clientId_idx" ON "ClientBrief"("clientId");
CREATE INDEX "ClientPresenceBlueprint_clientId_idx" ON "ClientPresenceBlueprint"("clientId");
CREATE INDEX "PresenceModule_blueprintId_idx" ON "PresenceModule"("blueprintId");
CREATE INDEX "PlatformRecommendation_blueprintId_idx" ON "PlatformRecommendation"("blueprintId");
CREATE INDEX "AutomationPlan_blueprintId_idx" ON "AutomationPlan"("blueprintId");
CREATE INDEX "RiskRule_blueprintId_idx" ON "RiskRule"("blueprintId");

ALTER TABLE "ClientBrief"
ADD CONSTRAINT "ClientBrief_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPresenceBlueprint"
ADD CONSTRAINT "ClientPresenceBlueprint_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPresenceBlueprint"
ADD CONSTRAINT "ClientPresenceBlueprint_briefId_fkey"
FOREIGN KEY ("briefId") REFERENCES "ClientBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PresenceModule"
ADD CONSTRAINT "PresenceModule_blueprintId_fkey"
FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformRecommendation"
ADD CONSTRAINT "PlatformRecommendation_blueprintId_fkey"
FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationPlan"
ADD CONSTRAINT "AutomationPlan_blueprintId_fkey"
FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskRule"
ADD CONSTRAINT "RiskRule_blueprintId_fkey"
FOREIGN KEY ("blueprintId") REFERENCES "ClientPresenceBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
