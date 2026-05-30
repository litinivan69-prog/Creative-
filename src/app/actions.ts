"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { generateClientPresenceBlueprint } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { validateBlueprintForPersistence } from "@/lib/blueprint-schema";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorRedirect(message: string): never {
  redirect(`/?error=${encodeURIComponent(message)}`);
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
