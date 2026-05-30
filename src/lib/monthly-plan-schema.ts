import { z } from "zod";
import {
  AutomationStatusSchema,
  ModuleTypeSchema,
  PlatformTypeSchema,
  PrioritySchema,
} from "@/lib/blueprint-schema";

const nonEmptyText = z.string().trim().min(1);
const nonNegativeInt = z.number().int().min(0);
const stringList = z.array(nonEmptyText);
const dateOrCadenceMarker = z.string().trim().min(1).max(120);

export const MonthlyPlanStatusSchema = z.enum(["draft", "ready_for_approval", "blocked"]);
export const PlannedContentStatusSchema = z.enum(["planned", "blocked"]);
export const ManagerTaskStatusSchema = z.enum(["open", "done", "blocked"]);

export const MonthlyPlanModuleSchema = z.object({
  moduleType: ModuleTypeSchema,
  name: nonEmptyText,
  priority: PrioritySchema,
  plannedUnitsMin: nonNegativeInt,
  plannedUnitsMax: nonNegativeInt,
  rationale: nonEmptyText,
});

export const MonthlyPlanPlatformSchema = z.object({
  platformName: nonEmptyText,
  platformType: PlatformTypeSchema,
  automationStatus: AutomationStatusSchema,
  plannedCadence: nonEmptyText,
  contentFormats: stringList,
  requiresIntegrationBeforeLaunch: z.boolean(),
  rationale: nonEmptyText,
});

export const PlannedContentItemSchema = z.object({
  moduleType: ModuleTypeSchema,
  platformName: nonEmptyText,
  format: nonEmptyText,
  topic: nonEmptyText.describe("Planning topic only. Do not generate final copy."),
  goal: nonEmptyText,
  plannedDate: dateOrCadenceMarker,
  approvalRequired: z.boolean(),
  autopublishEligible: z.boolean(),
  requiredInputs: stringList,
  status: PlannedContentStatusSchema,
});

export const ManagerTaskSchema = z.object({
  title: nonEmptyText,
  description: nonEmptyText,
  priority: PrioritySchema,
  dueDate: dateOrCadenceMarker,
  status: ManagerTaskStatusSchema,
});

export const MonthlyOperatingPlanSchema = z.object({
  month: nonEmptyText.describe("YYYY-MM"),
  status: MonthlyPlanStatusSchema,
  summary: nonEmptyText,
  totalPlannedUnits: nonNegativeInt,
  approvalStrategy: nonEmptyText,
  autopublishStrategy: nonEmptyText,
  riskSummary: nonEmptyText,
  activeModules: z.array(MonthlyPlanModuleSchema).min(1),
  selectedPlatforms: z.array(MonthlyPlanPlatformSchema).min(1),
  plannedContentItems: z.array(PlannedContentItemSchema),
  managerTasks: z.array(ManagerTaskSchema),
});

export type MonthlyOperatingPlan = z.infer<typeof MonthlyOperatingPlanSchema>;

export type MonthlyPlanValidationContext = {
  selectedModuleTypes: string[];
  recommendedPlatformNames: string[];
  humanReviewPolicy: {
    canAutopublish: string[];
    requiresApproval: string[];
    defaultMode?: string;
  };
  integrationRequirements: Array<{
    platformName: string;
    required: boolean;
  }>;
  riskRules: Array<{
    severity: string;
    approvalRequired: boolean;
  }>;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizedSet(values: string[]) {
  return new Set(values.map(normalize));
}

function matchesPolicyToken(item: z.infer<typeof PlannedContentItemSchema>, token: string) {
  const normalizedToken = normalize(token);
  return [
    item.moduleType,
    item.platformName,
    item.format,
    `${item.moduleType}:${item.format}`,
    `${item.platformName}:${item.format}`,
  ]
    .map(normalize)
    .includes(normalizedToken);
}

function hasIntegrationTask(plan: MonthlyOperatingPlan, platformName: string) {
  const normalizedPlatform = normalize(platformName);
  return plan.managerTasks.some((task) => {
    const text = normalize(`${task.title} ${task.description}`);
    return (
      text.includes(normalizedPlatform) &&
      ["integration", "connect", "credential", "auth", "access", "permission"].some((keyword) =>
        text.includes(keyword),
      )
    );
  });
}

export function validateMonthlyPlanForBlueprint(
  input: unknown,
  context: MonthlyPlanValidationContext,
): MonthlyOperatingPlan {
  const plan = MonthlyOperatingPlanSchema.parse(input);

  if (plan.totalPlannedUnits !== plan.plannedContentItems.length) {
    throw new Error("totalPlannedUnits must match plannedContentItems count.");
  }

  const allowedModules = normalizedSet(context.selectedModuleTypes);
  const allowedPlatforms = normalizedSet(context.recommendedPlatformNames);

  for (const module of plan.activeModules) {
    if (!allowedModules.has(normalize(module.moduleType))) {
      throw new Error(`Monthly plan uses module not selected in Blueprint: ${module.moduleType}.`);
    }

    if (module.plannedUnitsMax < module.plannedUnitsMin) {
      throw new Error(`Monthly module max is lower than min for ${module.moduleType}.`);
    }
  }

  for (const platform of plan.selectedPlatforms) {
    if (!allowedPlatforms.has(normalize(platform.platformName))) {
      throw new Error(`Monthly plan uses platform not recommended in Blueprint: ${platform.platformName}.`);
    }
  }

  const autopublishTokens = context.humanReviewPolicy.canAutopublish;
  const requiresApprovalTokens = context.humanReviewPolicy.requiresApproval;
  const highApprovalRisk = context.riskRules.some(
    (rule) => rule.approvalRequired && rule.severity === "high",
  );

  for (const item of plan.plannedContentItems) {
    if (!allowedModules.has(normalize(item.moduleType))) {
      throw new Error(`Planned content uses module not selected in Blueprint: ${item.moduleType}.`);
    }

    if (!allowedPlatforms.has(normalize(item.platformName))) {
      throw new Error(`Planned content uses platform not recommended in Blueprint: ${item.platformName}.`);
    }

    const canAutopublish = autopublishTokens.some((token) => matchesPolicyToken(item, token));
    if (item.autopublishEligible && !canAutopublish) {
      throw new Error(`Autopublish eligibility violates humanReviewPolicy for ${item.topic}.`);
    }

    const mustApprove =
      highApprovalRisk || requiresApprovalTokens.some((token) => matchesPolicyToken(item, token));
    if (mustApprove && !item.approvalRequired) {
      throw new Error(`Approval is required by Blueprint policy for ${item.topic}.`);
    }
  }

  const requiredIntegrations = context.integrationRequirements.filter((integration) => integration.required);
  for (const integration of requiredIntegrations) {
    const selectedPlatform = plan.selectedPlatforms.find(
      (platform) => normalize(platform.platformName) === normalize(integration.platformName),
    );

    if (selectedPlatform && !selectedPlatform.requiresIntegrationBeforeLaunch) {
      throw new Error(`Required integration must be marked before launch for ${integration.platformName}.`);
    }

    if (selectedPlatform && !hasIntegrationTask(plan, integration.platformName)) {
      throw new Error(`Missing manager integration task for ${integration.platformName}.`);
    }
  }

  return plan;
}
