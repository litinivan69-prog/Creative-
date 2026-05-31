"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import {
  generateClientPresenceBlueprint,
  generateContentDraft,
  generateMonthlyOperatingPlan,
} from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { validateBlueprintForPersistence } from "@/lib/blueprint-schema";
import {
  isSensitiveContent,
  validateContentDraftForPersistence,
} from "@/lib/content-draft-schema";
import { validateMonthlyPlanForBlueprint } from "@/lib/monthly-plan-schema";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorRedirect(message: string): never {
  redirect(`/?error=${encodeURIComponent(message)}`);
}

function blueprintErrorRedirect(blueprintId: string, message: string): never {
  redirect(`/?blueprint=${blueprintId}&error=${encodeURIComponent(message)}`);
}

function monthlyPlanErrorRedirect(blueprintId: string, planId: string, message: string): never {
  redirect(`/?blueprint=${blueprintId}&plan=${planId}&error=${encodeURIComponent(message)}`);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function createClient(formData: FormData) {
  const name = formText(formData, "name");
  const website = formText(formData, "website");
  const industry = formText(formData, "industry");

  if (!name) {
    throw new Error("Client name is required.");
  }

  await prisma.client.create({
    data: {
      name,
      website: website || null,
      industry: industry || null,
    },
  });

  revalidatePath("/");
}

export async function addClientBrief(formData: FormData) {
  const clientId = formText(formData, "clientId");
  const rawBrief = formText(formData, "rawBrief");

  if (!clientId || !rawBrief) {
    throw new Error("Client and brief are required.");
  }

  await prisma.clientBrief.create({
    data: {
      clientId,
      rawBrief,
    },
  });

  revalidatePath("/");
}

export async function updateClientBrief(formData: FormData) {
  const briefId = formText(formData, "briefId");
  const rawBrief = formText(formData, "rawBrief");

  if (!briefId || !rawBrief) {
    errorRedirect("Brief text is required.");
  }

  const existingBrief = await prisma.clientBrief.findUnique({
    where: { id: briefId },
    include: { blueprint: true },
  });

  if (!existingBrief) {
    errorRedirect("Brief not found.");
  }

  await prisma.$transaction(async (tx) => {
    if (existingBrief.blueprint) {
      await tx.clientPresenceBlueprint.delete({
        where: { id: existingBrief.blueprint.id },
      });
    }

    await tx.clientBrief.update({
      where: { id: briefId },
      data: { rawBrief },
    });
  });

  revalidatePath("/");
  redirect("/?notice=Brief%20updated.%20Generate%20a%20fresh%20blueprint%20when%20ready.");
}

export async function generateBlueprint(formData: FormData) {
  const briefId = formText(formData, "briefId");

  const brief = await prisma.clientBrief.findUnique({
    where: { id: briefId },
    include: { client: true, blueprint: true },
  });

  if (!brief) {
    throw new Error("Brief not found.");
  }

  if (brief.blueprint) {
    redirect(`/?blueprint=${brief.blueprint.id}`);
  }

  let createdId: string;

  try {
    const generated = await generateClientPresenceBlueprint({
      clientName: brief.client.name,
      website: brief.client.website,
      industry: brief.client.industry,
      rawBrief: brief.rawBrief,
    });

    const blueprint = validateBlueprintForPersistence(generated);

    const created = await prisma.clientPresenceBlueprint.create({
      data: {
        clientId: brief.clientId,
        briefId: brief.id,
        clientSummary: blueprint.clientSummary,
        businessGoals: blueprint.businessGoals,
        missingBriefFields: blueprint.missingBriefFields,
        assumptions: blueprint.assumptions,
        confidenceScore: blueprint.confidenceScore,
        nextRecommendedAction: blueprint.nextRecommendedAction,
        notRecommendedPlatforms: blueprint.notRecommendedPlatforms,
        recommendedMonthlyContentScope: blueprint.recommendedMonthlyContentScope,
        totalContentUnitsMin: blueprint.recommendedMonthlyContentScope.totalContentUnitsMin,
        totalContentUnitsMax: blueprint.recommendedMonthlyContentScope.totalContentUnitsMax,
        publishingFrequency: blueprint.publishingFrequency,
        integrationRequirements: blueprint.integrationRequirements,
        humanReviewPolicy: blueprint.humanReviewPolicy,
        approvalMode: blueprint.approvalMode,
        managerAttentionLevel: blueprint.managerAttentionLevel,
        rawBlueprintJson: blueprint as unknown as Prisma.InputJsonValue,
        selectedModules: {
          create: blueprint.selectedModules.map((module) => ({
            moduleType: module.moduleType,
            name: module.name,
            purpose: module.purpose,
            rationale: module.rationale,
            priority: module.priority,
            monthlyContentScope: module.monthlyContentScope as unknown as Prisma.InputJsonValue,
          })),
        },
        platformRecommendations: {
          create: [...blueprint.recommendedPlatforms, ...blueprint.notRecommendedPlatforms].map(
            (platform) => ({
              platformName: platform.platformName,
              platformType: platform.platformType,
              recommendation: platform.recommendation,
              priority: platform.priority,
              automationStatus: platform.automationStatus,
              requiredCredentials: platform.requiredCredentials,
              permissionsNeeded: platform.permissionsNeeded,
              contentFormats: platform.contentFormats,
              rationale: platform.rationale,
              contentRole: platform.contentRole,
              suggestedFrequency: platform.suggestedFrequency,
              automationOpportunity: platform.automationOpportunity,
            }),
          ),
        },
        automationPlans: {
          create: blueprint.automationPlan.map((automation) => ({
            name: automation.name,
            trigger: automation.trigger,
            action: automation.action,
            humanCheckpoint: automation.humanCheckpoint,
            toolCategory: automation.toolCategory,
            priority: automation.priority,
          })),
        },
        riskRules: {
          create: blueprint.riskRules.map((rule) => ({
            ruleName: rule.ruleName,
            riskDescription: rule.riskDescription,
            preventionAction: rule.preventionAction,
            severity: rule.severity,
            approvalRequired: rule.approvalRequired,
          })),
        },
      },
    });

    createdId = created.id;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "OpenAI generation failed. Check the brief and try again.";
    errorRedirect(`Blueprint generation failed: ${message}`);
  }

  revalidatePath("/");
  redirect(`/?blueprint=${createdId}`);
}

export async function generateMonthlyPlan(formData: FormData) {
  const blueprintId = formText(formData, "blueprintId");

  const blueprint = await prisma.clientPresenceBlueprint.findUnique({
    where: { id: blueprintId },
    include: {
      client: true,
      selectedModules: true,
      platformRecommendations: true,
      riskRules: true,
      monthlyPlans: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!blueprint) {
    errorRedirect("Blueprint not found.");
  }

  if (blueprint.nextRecommendedAction === "request_more_brief_data") {
    blueprintErrorRedirect(
      blueprint.id,
      "Monthly plan generation is blocked because this Blueprint needs more brief data first.",
    );
  }

  const month = currentMonth();
  const existingPlan = blueprint.monthlyPlans.find((plan) => plan.month === month);

  if (existingPlan) {
    redirect(`/?blueprint=${blueprint.id}&plan=${existingPlan.id}&notice=${encodeURIComponent("Monthly plan already exists for this month.")}`);
  }

  const recommendedPlatforms = blueprint.platformRecommendations.filter(
    (platform) => platform.recommendation === "recommended",
  );

  const humanReviewPolicy = jsonObject(blueprint.humanReviewPolicy) as {
    canAutopublish?: unknown;
    requiresApproval?: unknown;
    defaultMode?: string;
  };

  const integrationRequirements = jsonArray(blueprint.integrationRequirements)
    .filter((item): item is { platformName?: unknown; required?: unknown } => Boolean(item))
    .map((item) => ({
      platformName: typeof item.platformName === "string" ? item.platformName : "",
      required: item.required === true,
    }))
    .filter((item) => item.platformName);

  const blueprintPayload = {
    id: blueprint.id,
    clientSummary: blueprint.clientSummary,
    businessGoals: blueprint.businessGoals,
    confidenceScore: blueprint.confidenceScore,
    nextRecommendedAction: blueprint.nextRecommendedAction,
    selectedModules: blueprint.selectedModules,
    recommendedPlatforms,
    recommendedMonthlyContentScope: blueprint.recommendedMonthlyContentScope,
    publishingFrequency: blueprint.publishingFrequency,
    integrationRequirements: blueprint.integrationRequirements,
    humanReviewPolicy: blueprint.humanReviewPolicy,
    riskRules: blueprint.riskRules,
  };

  let createdId: string;

  try {
    const generated = await generateMonthlyOperatingPlan({
      clientName: blueprint.client.name,
      month,
      allowedPlatformNames: recommendedPlatforms.map((platform) => platform.platformName),
      blueprint: blueprintPayload,
    });

    const plan = validateMonthlyPlanForBlueprint(generated, {
      selectedModuleTypes: blueprint.selectedModules.map((module) => module.moduleType),
      recommendedPlatformNames: recommendedPlatforms.map((platform) => platform.platformName),
      humanReviewPolicy: {
        defaultMode: humanReviewPolicy.defaultMode,
        canAutopublish: stringArray(humanReviewPolicy.canAutopublish),
        requiresApproval: stringArray(humanReviewPolicy.requiresApproval),
      },
      integrationRequirements,
      riskRules: blueprint.riskRules.map((rule) => ({
        severity: rule.severity,
        approvalRequired: rule.approvalRequired,
      })),
    });

    const created = await prisma.monthlyOperatingPlan.create({
      data: {
        clientId: blueprint.clientId,
        blueprintId: blueprint.id,
        month: plan.month,
        status: plan.status,
        summary: plan.summary,
        totalPlannedUnits: plan.totalPlannedUnits,
        approvalStrategy: plan.approvalStrategy,
        autopublishStrategy: plan.autopublishStrategy,
        riskSummary: plan.riskSummary,
        rawPlanJson: plan as unknown as Prisma.InputJsonValue,
        modules: {
          create: plan.activeModules.map((module) => ({
            moduleType: module.moduleType,
            name: module.name,
            priority: module.priority,
            plannedUnitsMin: module.plannedUnitsMin,
            plannedUnitsMax: module.plannedUnitsMax,
            rationale: module.rationale,
          })),
        },
        platforms: {
          create: plan.selectedPlatforms.map((platform) => ({
            platformName: platform.platformName,
            platformType: platform.platformType,
            automationStatus: platform.automationStatus,
            plannedCadence: platform.plannedCadence,
            contentFormats: platform.contentFormats,
            requiresIntegrationBeforeLaunch: platform.requiresIntegrationBeforeLaunch,
            rationale: platform.rationale,
          })),
        },
        plannedContentItems: {
          create: plan.plannedContentItems.map((item) => ({
            moduleType: item.moduleType,
            platformName: item.platformName,
            format: item.format,
            topic: item.topic,
            goal: item.goal,
            plannedDate: item.plannedDate,
            week: item.week,
            campaignTheme: item.campaignTheme,
            contentPillar: item.contentPillar,
            channelRole: item.channelRole,
            sequenceReason: item.sequenceReason,
            approvalRequired: item.approvalRequired,
            autopublishEligible: item.autopublishEligible,
            requiredInputs: item.requiredInputs,
            status: item.status,
          })),
        },
        managerTasks: {
          create: plan.managerTasks.map((task) => ({
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate,
            status: task.status,
          })),
        },
      },
    });

    createdId = created.id;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Monthly plan generation failed. Check the Blueprint and try again.";
    blueprintErrorRedirect(blueprint.id, `Monthly plan generation failed: ${message}`);
  }

  revalidatePath("/");
  redirect(`/?blueprint=${blueprint.id}&plan=${createdId}`);
}

export async function generateContentDraftForItem(formData: FormData) {
  const plannedContentItemId = formText(formData, "plannedContentItemId");

  const item = await prisma.plannedContentItem.findUnique({
    where: { id: plannedContentItemId },
    include: {
      contentDraft: true,
      monthlyPlan: {
        include: {
          client: true,
          blueprint: true,
        },
      },
    },
  });

  if (!item) {
    errorRedirect("Planned content item not found.");
  }

  const plan = item.monthlyPlan;
  const blueprint = plan.blueprint;

  if (item.contentDraft) {
    redirect(
      `/?blueprint=${blueprint.id}&plan=${plan.id}&notice=${encodeURIComponent("A draft already exists for this planned content item.")}#drafts`,
    );
  }

  try {
    const generated = await generateContentDraft({
      clientName: plan.client.name,
      blueprintSummary: blueprint.clientSummary,
      monthlyPlanSummary: plan.summary,
      plannedContentItem: {
        moduleType: item.moduleType,
        platformName: item.platformName,
        format: item.format,
        topic: item.topic,
        goal: item.goal,
        plannedDate: item.plannedDate,
        approvalRequired: item.approvalRequired,
        autopublishEligible: item.autopublishEligible,
        requiredInputs: item.requiredInputs,
        status: item.status,
      },
      approvalStrategy: plan.approvalStrategy,
      riskSummary: plan.riskSummary,
      platform: item.platformName,
      format: item.format,
      topic: item.topic,
      goal: item.goal,
    });

    const draft = validateContentDraftForPersistence(generated, {
      plannedItemApprovalRequired: item.approvalRequired,
      plannedItemAutopublishEligible: item.autopublishEligible,
      sensitiveContent: isSensitiveContent([
        plan.client.industry,
        blueprint.clientSummary,
        plan.riskSummary,
        item.topic,
        item.goal,
        generated.draftTitle,
        generated.draftBody,
      ]),
    });

    await prisma.contentDraft.create({
      data: {
        clientId: plan.clientId,
        blueprintId: plan.blueprintId,
        monthlyPlanId: plan.id,
        plannedContentItemId: item.id,
        platformName: item.platformName,
        format: item.format,
        topic: item.topic,
        goal: item.goal,
        draftTitle: draft.draftTitle,
        draftBody: draft.draftBody,
        draftNotes: draft.draftNotes,
        status: draft.status,
        approvalRequired: draft.approvalRequired,
        autopublishEligible: draft.autopublishEligible,
        riskLevel: draft.riskLevel,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Draft generation failed. Check the planned content item and try again.";
    monthlyPlanErrorRedirect(blueprint.id, plan.id, `Content draft generation failed: ${message}`);
  }

  revalidatePath("/");
  redirect(
    `/?blueprint=${blueprint.id}&plan=${plan.id}&notice=${encodeURIComponent("Content draft generated for manager review.")}#drafts`,
  );
}
