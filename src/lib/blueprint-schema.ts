import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);
const nonNegativeInt = z.number().int().min(0);

export const PrioritySchema = z.enum(["low", "medium", "high"]);

export const ModuleTypeSchema = z.enum([
  "social_content",
  "expert_articles",
  "faq_knowledge_base",
  "case_builder",
  "review_replies",
  "business_cards_audit",
  "email_content",
  "telegram_funnel",
  "lead_magnets",
  "founder_voice",
  "competitor_monitoring",
  "monthly_report",
  "custom",
]);

export const PlatformTypeSchema = z.enum([
  "social",
  "blog",
  "messenger",
  "website",
  "review",
  "business_card",
  "email",
  "crm",
  "other",
]);

export const AutomationStatusSchema = z.enum([
  "api",
  "semi_auto",
  "manual",
  "unsupported",
  "needs_verification",
]);

const BasePlatformRecommendationSchema = z.object({
  platformName: nonEmptyText.describe("A platform, channel, or owned media surface inferred from the brief."),
  platformType: PlatformTypeSchema,
  priority: PrioritySchema,
  automationStatus: AutomationStatusSchema,
  requiredCredentials: z.array(nonEmptyText),
  permissionsNeeded: z.array(nonEmptyText),
  contentFormats: z.array(nonEmptyText),
  rationale: nonEmptyText,
  contentRole: nonEmptyText,
  suggestedFrequency: nonEmptyText.describe("Natural language cadence. Avoid fixed deliverable packages."),
  automationOpportunity: nonEmptyText,
});

export const RecommendedPlatformSchema = BasePlatformRecommendationSchema.extend({
  recommendation: z.literal("recommended"),
});

export const NotRecommendedPlatformSchema = BasePlatformRecommendationSchema.extend({
  recommendation: z.literal("not_recommended"),
});

export const PresenceModuleSchema = z.object({
  moduleType: ModuleTypeSchema,
  name: nonEmptyText.describe("A human-readable module title."),
  purpose: nonEmptyText,
  rationale: nonEmptyText,
  priority: PrioritySchema,
  monthlyContentScope: z.object({
    unitType: nonEmptyText,
    minPerMonth: nonNegativeInt,
    maxPerMonth: nonNegativeInt,
    reasoning: nonEmptyText,
  }),
});

export const MonthlyScopeByModuleSchema = z.object({
  moduleType: ModuleTypeSchema,
  unitType: nonEmptyText,
  minPerMonth: nonNegativeInt,
  maxPerMonth: nonNegativeInt,
  priority: PrioritySchema,
  reasoning: nonEmptyText,
});

export const RecommendedMonthlyContentScopeSchema = z.object({
  totalContentUnitsMin: nonNegativeInt,
  totalContentUnitsMax: nonNegativeInt,
  scopeByModule: z.array(MonthlyScopeByModuleSchema).min(1),
});

export const IntegrationRequirementSchema = z.object({
  platformName: nonEmptyText,
  required: z.boolean(),
  authMethod: nonEmptyText,
  requiredCredentials: z.array(nonEmptyText),
  permissionsNeeded: z.array(nonEmptyText),
  implementationPriority: PrioritySchema,
  notes: nonEmptyText,
});

export const HumanReviewPolicySchema = z.object({
  defaultMode: z.enum(["manual", "assisted", "guardrailed_auto"]),
  alwaysReview: z.array(nonEmptyText),
  canAutopublish: z.boolean(),
  escalationTriggers: z.array(nonEmptyText),
  maxRevisionLoops: z.number().int().min(0).max(10),
});

export const AutomationPlanSchema = z.object({
  name: nonEmptyText,
  trigger: nonEmptyText,
  action: nonEmptyText,
  humanCheckpoint: nonEmptyText,
  toolCategory: nonEmptyText,
  priority: PrioritySchema,
});

export const RiskRuleSchema = z.object({
  ruleName: nonEmptyText,
  riskDescription: nonEmptyText,
  preventionAction: nonEmptyText,
  severity: PrioritySchema,
  approvalRequired: z.boolean(),
});

export const ClientPresenceBlueprintSchema = z.object({
  clientSummary: nonEmptyText,
  businessGoals: z.array(nonEmptyText).min(1),
  recommendedPlatforms: z.array(RecommendedPlatformSchema).min(1),
  notRecommendedPlatforms: z.array(NotRecommendedPlatformSchema).min(1),
  selectedModules: z.array(PresenceModuleSchema).min(1),
  recommendedMonthlyContentScope: RecommendedMonthlyContentScopeSchema,
  publishingFrequency: z.object({
    narrative: nonEmptyText,
    cadenceByPlatform: z.array(
      z.object({
        platformName: nonEmptyText,
        cadence: nonEmptyText,
        reasoning: nonEmptyText,
      }),
    ).min(1),
  }),
  integrationRequirements: z.array(IntegrationRequirementSchema).min(1),
  automationPlan: z.array(AutomationPlanSchema).min(1),
  riskRules: z.array(RiskRuleSchema).min(1),
  humanReviewPolicy: HumanReviewPolicySchema,
  approvalMode: z.enum(["manual", "assisted", "guardrailed_auto"]),
  managerAttentionLevel: PrioritySchema,
});

export type ClientPresenceBlueprint = z.infer<typeof ClientPresenceBlueprintSchema>;

export function validateBlueprintForPersistence(input: unknown): ClientPresenceBlueprint {
  const blueprint = ClientPresenceBlueprintSchema.parse(input);

  if (
    blueprint.recommendedMonthlyContentScope.totalContentUnitsMax <
    blueprint.recommendedMonthlyContentScope.totalContentUnitsMin
  ) {
    throw new Error("Monthly content scope maximum cannot be lower than minimum.");
  }

  for (const scope of blueprint.recommendedMonthlyContentScope.scopeByModule) {
    if (scope.maxPerMonth < scope.minPerMonth) {
      throw new Error(`Monthly scope maximum cannot be lower than minimum for ${scope.moduleType}.`);
    }
  }

  for (const module of blueprint.selectedModules) {
    if (module.monthlyContentScope.maxPerMonth < module.monthlyContentScope.minPerMonth) {
      throw new Error(`Module scope maximum cannot be lower than minimum for ${module.moduleType}.`);
    }
  }

  const recommendedNames = new Set(
    blueprint.recommendedPlatforms.map((platform) => platform.platformName.trim().toLowerCase()),
  );

  const overlap = blueprint.notRecommendedPlatforms.some((platform) =>
    recommendedNames.has(platform.platformName.trim().toLowerCase()),
  );

  if (overlap) {
    throw new Error("A platform cannot be both recommended and not recommended in one blueprint.");
  }

  if (blueprint.humanReviewPolicy.defaultMode !== blueprint.approvalMode) {
    throw new Error("Human review defaultMode must match the blueprint approvalMode.");
  }

  return blueprint;
}
