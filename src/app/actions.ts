"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import {
  generateClientPresenceBlueprint,
  generateContentDraft,
  generateCreativeAssetBrief,
  generateCreativeVisualVariant,
  generateMonthlyOperatingPlan,
} from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { validateBlueprintForPersistence } from "@/lib/blueprint-schema";
import {
  isSensitiveContent,
  validateContentDraftForPersistence,
} from "@/lib/content-draft-schema";
import { CreativeAssetBriefSchema } from "@/lib/creative-asset-schema";
import { validateMonthlyPlanForBlueprint } from "@/lib/monthly-plan-schema";
import { getAutopilotTextBatchLimit } from "@/lib/autopilot";
import {
  createGenerationJob,
  markGenerationJobCompleted,
  markGenerationJobFailedSafely,
  markGenerationJobRunning,
} from "@/lib/generation-jobs";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

type WorkspaceView = "overview" | "clients" | "client_setup" | "approvals" | "calendar" | "drafts" | "assets";

function workspaceLocation(
  view: WorkspaceView,
  options: {
    blueprintId?: string;
    planId?: string;
    error?: string;
    notice?: string;
  } = {},
) {
  const searchParams = new URLSearchParams({ view });

  if (options.blueprintId) searchParams.set("blueprint", options.blueprintId);
  if (options.planId) searchParams.set("plan", options.planId);
  if (options.error) searchParams.set("error", options.error);
  if (options.notice) searchParams.set("notice", options.notice);

  return `/?${searchParams.toString()}`;
}

function errorRedirect(message: string, view: WorkspaceView = "overview"): never {
  redirect(workspaceLocation(view, { error: message }));
}

function blueprintErrorRedirect(blueprintId: string, message: string, view: WorkspaceView = "client_setup"): never {
  redirect(workspaceLocation(view, { blueprintId, error: message }));
}

function monthlyPlanErrorRedirect(
  blueprintId: string,
  planId: string,
  message: string,
  view: WorkspaceView = "calendar",
): never {
  redirect(workspaceLocation(view, { blueprintId, planId, error: message }));
}

type DraftWorkflowStatus =
  | "draft"
  | "needs_review"
  | "sent_to_client"
  | "client_changes_requested"
  | "approved"
  | "rejected"
  | "ready_to_schedule";

type DraftReviewAction =
  | "submitted_for_review"
  | "sent_to_client"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "marked_ready_to_schedule"
  | "text_updated";

const creativeAssetStatuses = [
  "needed",
  "brief_ready",
  "in_production",
  "needs_review",
  "approved",
  "rejected",
] as const;

type CreativeAssetStatus = (typeof creativeAssetStatuses)[number];

const creativeVariantStatuses = [
  "generated",
  "needs_review",
  "approved",
  "rejected",
] as const;

type CreativeVariantStatus = (typeof creativeVariantStatuses)[number];

type CreativeAssetGenerationContext = {
  client: {
    name: string;
    industry: string | null;
  };
  blueprint: {
    clientSummary: string;
    approvalMode: string;
    managerAttentionLevel: string;
    humanReviewPolicy: Prisma.JsonValue;
    riskRules: Array<{
      ruleName: string;
      riskDescription: string;
      preventionAction: string;
      severity: string;
      approvalRequired: boolean;
    }>;
  };
  monthlyPlan: {
    summary: string;
  };
  plannedContentItem: unknown;
  contentDraft: {
    draftTitle: string;
    draftBody: string;
    draftNotes: Prisma.JsonValue;
    riskLevel: string;
    approvalRequired: boolean;
  };
  platformName: string;
  format: string;
  topic: string;
  scheduledDate: string;
  scheduledTime: string | null;
  notes: string | null;
};

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

function draftReviewActor(formData: FormData) {
  return formText(formData, "actorType") === "client" ? "client" : "manager";
}

function returnViewFromForm(formData: FormData, fallback: WorkspaceView) {
  return formText(formData, "returnView") === "drafts" ? "drafts" : fallback;
}

async function generateCreativeAssetBriefFromContext(context: CreativeAssetGenerationContext) {
  const generated = await generateCreativeAssetBrief({
    clientName: context.client.name,
    clientIndustry: context.client.industry,
    blueprintSummary: context.blueprint.clientSummary,
    blueprintContext: {
      clientSummary: context.blueprint.clientSummary,
      approvalMode: context.blueprint.approvalMode,
      managerAttentionLevel: context.blueprint.managerAttentionLevel,
      humanReviewPolicy: context.blueprint.humanReviewPolicy,
      riskRules: context.blueprint.riskRules,
    },
    monthlyPlanSummary: context.monthlyPlan.summary,
    scheduledPublication: {
      platformName: context.platformName,
      format: context.format,
      topic: context.topic,
      scheduledDate: context.scheduledDate,
      scheduledTime: context.scheduledTime,
      notes: context.notes,
    },
    plannedContentItem: context.plannedContentItem,
    contentDraft: {
      draftTitle: context.contentDraft.draftTitle,
      draftBody: context.contentDraft.draftBody,
      draftNotes: context.contentDraft.draftNotes,
      riskLevel: context.contentDraft.riskLevel,
      approvalRequired: context.contentDraft.approvalRequired,
    },
    platformName: context.platformName,
    format: context.format,
    topic: context.topic,
  });

  return CreativeAssetBriefSchema.parse(generated);
}

async function updateDraftWorkflow(
  formData: FormData,
  update: {
    status: DraftWorkflowStatus;
    action: DraftReviewAction;
    notice: string;
  },
) {
  const contentDraftId = formText(formData, "contentDraftId");
  const comment = formText(formData, "comment");

  if (!contentDraftId) {
    errorRedirect("Не выбран материал.");
  }

  const draft = await prisma.contentDraft.findUnique({
    where: { id: contentDraftId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!draft) {
    errorRedirect("Материал не найден.");
  }

  await prisma.$transaction([
    prisma.contentDraft.update({
      where: { id: draft.id },
      data: { status: update.status },
    }),
    prisma.contentDraftReviewEvent.create({
      data: {
        contentDraftId: draft.id,
        actorType: draftReviewActor(formData),
        action: update.action,
        comment: comment || null,
      },
    }),
  ]);

  revalidatePath("/");
  redirect(workspaceLocation(returnViewFromForm(formData, "approvals"), { blueprintId: draft.blueprintId, planId: draft.monthlyPlanId, notice: update.notice }));
}

export async function createClient(formData: FormData) {
  const name = formText(formData, "name");
  const website = formText(formData, "website");
  const industry = formText(formData, "industry");

  if (!name) {
    throw new Error("Укажите название клиента.");
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
    throw new Error("Выберите клиента и добавьте бриф.");
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
    errorRedirect("Добавьте текст брифа.");
  }

  const existingBrief = await prisma.clientBrief.findUnique({
    where: { id: briefId },
    include: { blueprint: true },
  });

  if (!existingBrief) {
    errorRedirect("Бриф не найден.");
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
  redirect(workspaceLocation("client_setup", { notice: "Бриф обновлён. Когда будете готовы, сгенерируйте новый Blueprint." }));
}

export async function generateBlueprint(formData: FormData) {
  const briefId = formText(formData, "briefId");

  const brief = await prisma.clientBrief.findUnique({
    where: { id: briefId },
    include: { client: true, blueprint: true },
  });

  if (!brief) {
    throw new Error("Бриф не найден.");
  }

  if (brief.blueprint) {
    redirect(workspaceLocation("client_setup", { blueprintId: brief.blueprint.id }));
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
        : "OpenAI не смог обработать бриф. Проверьте данные и попробуйте ещё раз.";
    errorRedirect(`Не удалось сгенерировать Blueprint: ${message}`);
  }

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", { blueprintId: createdId }));
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
    errorRedirect("Blueprint не найден.");
  }

  if (blueprint.nextRecommendedAction === "request_more_brief_data") {
    blueprintErrorRedirect(
      blueprint.id,
      "Сначала добавьте недостающие данные в бриф. После этого можно будет сгенерировать месячный план.",
    );
  }

  const month = currentMonth();
  const existingPlan = blueprint.monthlyPlans.find((plan) => plan.month === month);

  if (existingPlan) {
    redirect(workspaceLocation("client_setup", { blueprintId: blueprint.id, planId: existingPlan.id, notice: "Месячный план за этот период уже существует." }));
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
        : "Не удалось сгенерировать месячный план. Проверьте Blueprint и попробуйте ещё раз.";
    blueprintErrorRedirect(blueprint.id, `Не удалось сгенерировать месячный план: ${message}`);
  }

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", { blueprintId: blueprint.id, planId: createdId }));
}

type ContentTextGenerationResult = {
  status: "created" | "updated" | "skipped" | "failed";
  plannedContentItemId: string;
  contentDraftId?: string;
  blueprintId?: string;
  monthlyPlanId?: string;
  message: string;
};

async function generateContentTextForPlannedItem(
  plannedContentItemId: string,
  options: {
    replaceExisting: boolean;
    createReviewEvent: boolean;
    generationJobType?: "generate_publication_text" | "regenerate_publication_text";
  },
): Promise<ContentTextGenerationResult> {
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
    return {
      status: "failed",
      plannedContentItemId,
      message: "Запланированный материал не найден.",
    };
  }

  const plan = item.monthlyPlan;
  const blueprint = plan.blueprint;
  const resultContext = {
    plannedContentItemId: item.id,
    blueprintId: blueprint.id,
    monthlyPlanId: plan.id,
  };

  if (item.contentDraft && !options.replaceExisting) {
    return {
      ...resultContext,
      status: "skipped",
      contentDraftId: item.contentDraft.id,
      message: "Текст для этого материала уже создан.",
    };
  }

  if (!item.contentDraft && options.replaceExisting) {
    return {
      ...resultContext,
      status: "failed",
      message: "Сначала сгенерируйте текст материала.",
    };
  }

  let generationJobId: string | undefined;

  try {
    if (options.generationJobType) {
      const generationJob = await createGenerationJob({
        clientId: plan.clientId,
        blueprintId: plan.blueprintId,
        monthlyPlanId: plan.id,
        plannedContentItemId: item.id,
        contentDraftId: item.contentDraft?.id,
        jobType: options.generationJobType,
        title: options.replaceExisting ? "Перегенерация текста публикации" : "Генерация текста публикации",
      });
      generationJobId = generationJob.id;
      await markGenerationJobRunning(generationJob.id, "AI готовит текст публикации.");
    }

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

    const draftData = {
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
    };

    const existingContentDraft = item.contentDraft;

    if (existingContentDraft) {
      const updatedDraft = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.contentDraft.update({
          where: { id: existingContentDraft.id },
          data: draftData,
        });

        if (options.createReviewEvent) {
          await transaction.contentDraftReviewEvent.create({
            data: {
              contentDraftId: existingContentDraft.id,
              actorType: "system",
              action: "created",
              comment: "AI обновил текст материала.",
            },
          });
        }

        return updated;
      });

      if (generationJobId) {
        await markGenerationJobCompleted(generationJobId, "Текст публикации обновлён.", {
          contentDraftId: updatedDraft.id,
        });
      }

      return {
        ...resultContext,
        status: "updated",
        contentDraftId: updatedDraft.id,
        message: "AI обновил текст публикации.",
      };
    } else {
      const createdDraft = await prisma.contentDraft.create({
        data: {
          clientId: plan.clientId,
          blueprintId: plan.blueprintId,
          monthlyPlanId: plan.id,
          plannedContentItemId: item.id,
          ...draftData,
          ...(options.createReviewEvent
            ? {
                reviewEvents: {
                  create: {
                    actorType: "system",
                    action: "created",
                  },
                },
              }
            : {}),
        },
      });

      if (generationJobId) {
        await markGenerationJobCompleted(generationJobId, "Текст публикации сгенерирован.", {
          contentDraftId: createdDraft.id,
        });
      }

      return {
        ...resultContext,
        status: "created",
        contentDraftId: createdDraft.id,
        message: "Текст публикации сгенерирован и готов к проверке менеджером.",
      };
    }
  } catch {
    const message = "Не удалось сгенерировать текст публикации. Проверьте настройки AI и попробуйте ещё раз.";
    await markGenerationJobFailedSafely(generationJobId, message);
    return {
      ...resultContext,
      status: "failed",
      message,
    };
  }
}

async function generateContentTextForItem(formData: FormData, replaceExisting: boolean) {
  const plannedContentItemId = formText(formData, "plannedContentItemId");
  const result = await generateContentTextForPlannedItem(plannedContentItemId, {
    replaceExisting,
    createReviewEvent: true,
    generationJobType: replaceExisting ? "regenerate_publication_text" : "generate_publication_text",
  });

  if (!result.blueprintId || !result.monthlyPlanId) {
    errorRedirect(result.message, "drafts");
  }

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: result.blueprintId,
    planId: result.monthlyPlanId,
    ...(result.status === "failed" ? { error: result.message } : { notice: result.message }),
  }));
}

export async function generateContentDraftForItem(formData: FormData) {
  await generateContentTextForItem(formData, false);
}

export async function regenerateContentDraftForItem(formData: FormData) {
  await generateContentTextForItem(formData, true);
}

export async function prepareMonthAutopilot(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");

  if (!monthlyPlanId) {
    errorRedirect("Не выбран месячный план для автоподготовки.", "drafts");
  }

  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      client: true,
      blueprint: true,
      plannedContentItems: {
        include: {
          contentDraft: true,
        },
      },
      contentDrafts: true,
      scheduledPublications: true,
      creativeAssets: {
        include: {
          generatedVariants: true,
        },
      },
    },
  });

  if (!plan) {
    errorRedirect("Месячный план для автоподготовки не найден.", "drafts");
  }

  const generationJob = await createGenerationJob({
    clientId: plan.clientId,
    blueprintId: plan.blueprintId,
    monthlyPlanId: plan.id,
    jobType: "prepare_month_texts",
    title: "Автоподготовка текстов месяца",
  });
  await markGenerationJobRunning(generationJob.id, "AI готовит недостающие тексты публикаций.");

  let notice: string;
  let hasItemFailures = false;

  try {
    const missingTextItems = plan.plannedContentItems.filter((item) => !item.contentDraft);
    const textBatch = missingTextItems.slice(0, getAutopilotTextBatchLimit());
    const existingTextsCount = plan.plannedContentItems.length - missingTextItems.length;
    const results: ContentTextGenerationResult[] = [];

    for (const item of textBatch) {
      results.push(
        await generateContentTextForPlannedItem(item.id, {
          replaceExisting: false,
          createReviewEvent: true,
        }),
      );
    }

    const createdTextsCount = results.filter((result) => result.status === "created").length;
    const newlySkippedTextsCount = results.filter((result) => result.status === "skipped").length;
    const skippedTextsCount = existingTextsCount + newlySkippedTextsCount;
    const failedTextsCount = results.filter((result) => result.status === "failed").length;
    const remainingMissingTextsCount = missingTextItems.length - createdTextsCount - newlySkippedTextsCount;
    hasItemFailures = failedTextsCount > 0;
    notice = `Автоподготовка месяца завершена: создано ${createdTextsCount} текстов, ${skippedTextsCount} уже были готовы.`;

    if (remainingMissingTextsCount > 0) {
      notice = `Создано ${createdTextsCount} текстов. Осталось подготовить ещё ${remainingMissingTextsCount} материалов. Запустите автоподготовку ещё раз, чтобы продолжить.`;
    }

    if (hasItemFailures) {
      notice = `Автоподготовка выполнена частично: создано ${createdTextsCount} текстов, ${skippedTextsCount} уже были готовы. Не удалось подготовить ${failedTextsCount}. Осталось ${remainingMissingTextsCount} материалов. Проверьте карточки материалов.`;
    }

    await markGenerationJobCompleted(
      generationJob.id,
      `Создано ${createdTextsCount} текстов, пропущено ${skippedTextsCount}, ошибок ${failedTextsCount}.`,
    );
  } catch {
    const message = "Не удалось завершить автоподготовку месяца. Проверьте настройки AI и попробуйте ещё раз.";
    await markGenerationJobFailedSafely(generationJob.id, message);
    monthlyPlanErrorRedirect(plan.blueprintId, plan.id, message, "drafts");
  }

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: plan.blueprintId,
    planId: plan.id,
    ...(hasItemFailures ? { error: notice } : { notice }),
  }));
}

export async function updatePublicationText(formData: FormData) {
  const contentDraftId = formText(formData, "contentDraftId");
  const draftTitle = formText(formData, "draftTitle");
  const draftBody = formText(formData, "draftBody");
  const comment = formText(formData, "comment");

  if (!contentDraftId) {
    errorRedirect("Не выбран материал.", "drafts");
  }

  const draft = await prisma.contentDraft.findUnique({
    where: { id: contentDraftId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!draft) {
    errorRedirect("Материал не найден.", "drafts");
  }

  if (!draftTitle || !draftBody) {
    monthlyPlanErrorRedirect(draft.blueprintId, draft.monthlyPlanId, "Укажите заголовок и текст публикации.", "drafts");
  }

  await prisma.$transaction([
    prisma.contentDraft.update({
      where: { id: draft.id },
      data: {
        draftTitle,
        draftBody,
        status: "needs_review",
      },
    }),
    prisma.contentDraftReviewEvent.create({
      data: {
        contentDraftId: draft.id,
        actorType: "manager",
        action: "text_updated",
        comment: comment || "Текст публикации обновлён менеджером.",
      },
    }),
  ]);

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: draft.blueprintId,
    planId: draft.monthlyPlanId,
    notice: "Текст публикации обновлён и отправлен на проверку.",
  }));
}

export async function submitDraftForReview(formData: FormData) {
  await updateDraftWorkflow(formData, {
    status: "needs_review",
    action: "submitted_for_review",
    notice: "Текст публикации отправлен на проверку.",
  });
}

export async function sendDraftToClient(formData: FormData) {
  await updateDraftWorkflow(formData, {
    status: "sent_to_client",
    action: "sent_to_client",
    notice: "Материал отмечен как отправленный клиенту.",
  });
}

export async function requestDraftChanges(formData: FormData) {
  await updateDraftWorkflow(formData, {
    status: "client_changes_requested",
    action: "changes_requested",
    notice: "Для материала запрошены правки.",
  });
}

export async function approveDraft(formData: FormData) {
  await updateDraftWorkflow(formData, {
    status: "approved",
    action: "approved",
    notice: "Материал согласован.",
  });
}

export async function rejectDraft(formData: FormData) {
  await updateDraftWorkflow(formData, {
    status: "rejected",
    action: "rejected",
    notice: "Материал отклонён.",
  });
}

export async function markDraftReadyToSchedule(formData: FormData) {
  await updateDraftWorkflow(formData, {
    status: "ready_to_schedule",
    action: "marked_ready_to_schedule",
    notice: "Материал готов к планированию.",
  });
}

export async function scheduleContentDraft(formData: FormData) {
  const contentDraftId = formText(formData, "contentDraftId");
  const scheduledDate = formText(formData, "scheduledDate");
  const scheduledTime = formText(formData, "scheduledTime");
  const timezone = formText(formData, "timezone");
  const notes = formText(formData, "notes");

  if (!contentDraftId) {
    errorRedirect("Не выбран материал для планирования.");
  }

  if (!scheduledDate) {
    errorRedirect("Укажите дату публикации.");
  }

  const draft = await prisma.contentDraft.findUnique({
    where: { id: contentDraftId },
    include: {
      client: true,
      blueprint: true,
      monthlyPlan: true,
      plannedContentItem: true,
    },
  });

  if (!draft) {
    errorRedirect("Материал не найден.");
  }

  if (draft.status !== "approved" && draft.status !== "ready_to_schedule") {
    monthlyPlanErrorRedirect(
      draft.blueprintId,
      draft.monthlyPlanId,
      "Сначала согласуйте материал перед планированием публикации.",
      returnViewFromForm(formData, "calendar"),
    );
  }

  const existingPublication = await prisma.scheduledPublication.findFirst({
    where: { contentDraftId: draft.id },
  });

  if (existingPublication) {
    redirect(workspaceLocation(returnViewFromForm(formData, "calendar"), { blueprintId: draft.blueprintId, planId: draft.monthlyPlanId, notice: "Для этого материала публикация уже запланирована." }));
  }

  await prisma.scheduledPublication.create({
    data: {
      clientId: draft.clientId,
      blueprintId: draft.blueprintId,
      monthlyPlanId: draft.monthlyPlanId,
      plannedContentItemId: draft.plannedContentItemId,
      contentDraftId: draft.id,
      platformName: draft.platformName,
      format: draft.format,
      topic: draft.topic,
      scheduledDate,
      scheduledTime: scheduledTime || null,
      timezone: timezone || null,
      status: "scheduled",
      publishMode: "manual",
      notes: notes || null,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation(returnViewFromForm(formData, "calendar"), { blueprintId: draft.blueprintId, planId: draft.monthlyPlanId, notice: "Публикация запланирована." }));
}

async function updateScheduledPublicationStatus(
  formData: FormData,
  status: "scheduled" | "needs_assets" | "ready" | "skipped",
  notice: string,
) {
  const scheduledPublicationId = formText(formData, "scheduledPublicationId");

  if (!scheduledPublicationId) {
    errorRedirect("Не выбрана запланированная публикация.");
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!publication) {
    errorRedirect("Запланированная публикация не найдена.");
  }

  await prisma.scheduledPublication.update({
    where: { id: publication.id },
    data: { status },
  });

  revalidatePath("/");
  redirect(workspaceLocation("calendar", { blueprintId: publication.blueprintId, planId: publication.monthlyPlanId, notice }));
}

export async function updateScheduledPublication(formData: FormData) {
  const scheduledPublicationId = formText(formData, "scheduledPublicationId");
  const scheduledDate = formText(formData, "scheduledDate");
  const scheduledTime = formText(formData, "scheduledTime");
  const notes = formText(formData, "notes");

  if (!scheduledPublicationId) {
    errorRedirect("Не выбрана запланированная публикация.");
  }

  if (!scheduledDate) {
    errorRedirect("Укажите дату публикации.");
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!publication) {
    errorRedirect("Запланированная публикация не найдена.");
  }

  await prisma.scheduledPublication.update({
    where: { id: publication.id },
    data: {
      scheduledDate,
      scheduledTime: scheduledTime || null,
      notes: notes || null,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation("calendar", { blueprintId: publication.blueprintId, planId: publication.monthlyPlanId, notice: "Параметры публикации обновлены." }));
}

export async function markScheduledPublicationNeedsAssets(formData: FormData) {
  await updateScheduledPublicationStatus(formData, "needs_assets", "Для публикации отмечена необходимость подготовить материалы.");
}

export async function markScheduledPublicationScheduled(formData: FormData) {
  await updateScheduledPublicationStatus(formData, "scheduled", "Публикация отмечена как запланированная.");
}

export async function markScheduledPublicationReady(formData: FormData) {
  await updateScheduledPublicationStatus(formData, "ready", "Публикация готова к ручному размещению.");
}

export async function markScheduledPublicationSkipped(formData: FormData) {
  await updateScheduledPublicationStatus(formData, "skipped", "Публикация отмечена как пропущенная.");
}

export async function unschedulePublication(formData: FormData) {
  const scheduledPublicationId = formText(formData, "scheduledPublicationId");

  if (!scheduledPublicationId) {
    errorRedirect("Не выбрана запланированная публикация.");
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!publication) {
    errorRedirect("Запланированная публикация не найдена.");
  }

  await prisma.scheduledPublication.delete({
    where: { id: publication.id },
  });

  revalidatePath("/");
  redirect(workspaceLocation("calendar", { blueprintId: publication.blueprintId, planId: publication.monthlyPlanId, notice: "Публикация снята с расписания." }));
}

export async function createCreativeAssetBrief(formData: FormData) {
  const scheduledPublicationId = formText(formData, "scheduledPublicationId");
  const assetType = formText(formData, "assetType");
  const title = formText(formData, "title");
  const brief = formText(formData, "brief");
  const formatRequirements = formText(formData, "formatRequirements");
  const textOnAsset = formText(formData, "textOnAsset");
  const references = formText(formData, "references");
  const notes = formText(formData, "notes");
  const approvalRequired = formData.get("approvalRequired") === "on";

  if (!scheduledPublicationId) {
    errorRedirect("Не выбрана публикация для создания ТЗ.");
  }

  if (!assetType || !title || !brief) {
    errorRedirect("Укажите тип материала, название и описание ТЗ.");
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    include: {
      client: true,
      blueprint: true,
      monthlyPlan: true,
      plannedContentItem: true,
      contentDraft: true,
    },
  });

  if (!publication) {
    errorRedirect("Запланированная публикация не найдена.");
  }

  await prisma.$transaction([
    prisma.creativeAsset.create({
      data: {
        clientId: publication.clientId,
        blueprintId: publication.blueprintId,
        monthlyPlanId: publication.monthlyPlanId,
        plannedContentItemId: publication.plannedContentItemId,
        contentDraftId: publication.contentDraftId,
        scheduledPublicationId: publication.id,
        assetType,
        title,
        brief,
        formatRequirements: formatRequirements || null,
        textOnAsset: textOnAsset || null,
        references: references || null,
        status: "needed",
        source: "manual",
        approvalRequired,
        notes: notes || null,
      },
    }),
    ...(publication.status === "scheduled"
      ? [
          prisma.scheduledPublication.update({
            where: { id: publication.id },
            data: { status: "needs_assets" },
          }),
        ]
      : []),
  ]);

  revalidatePath("/");
  redirect(workspaceLocation("assets", { blueprintId: publication.blueprintId, planId: publication.monthlyPlanId, notice: "ТЗ на креативный материал создано." }));
}

export async function generateCreativeAssetBriefForPublication(formData: FormData) {
  const scheduledPublicationId = formText(formData, "scheduledPublicationId");

  if (!scheduledPublicationId) {
    errorRedirect("Не выбрана публикация для генерации ТЗ.");
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    include: {
      client: true,
      blueprint: {
        include: {
          riskRules: true,
        },
      },
      monthlyPlan: true,
      plannedContentItem: true,
      contentDraft: true,
      creativeAssets: true,
    },
  });

  if (!publication) {
    errorRedirect("Запланированная публикация не найдена.");
  }

  if (publication.creativeAssets.length > 0) {
    redirect(workspaceLocation(returnViewFromForm(formData, "assets"), { blueprintId: publication.blueprintId, planId: publication.monthlyPlanId, notice: "Для этой публикации уже есть ТЗ на креатив." }));
  }

  const generationJob = await createGenerationJob({
    clientId: publication.clientId,
    blueprintId: publication.blueprintId,
    monthlyPlanId: publication.monthlyPlanId,
    plannedContentItemId: publication.plannedContentItemId,
    contentDraftId: publication.contentDraftId,
    scheduledPublicationId: publication.id,
    jobType: "generate_creative_brief",
    title: "Генерация ТЗ на креатив",
  });

  try {
    await markGenerationJobRunning(generationJob.id, "AI готовит ТЗ на креатив.");
    const brief = await generateCreativeAssetBriefFromContext(publication);

    const createdAsset = await prisma.$transaction(async (transaction) => {
      const asset = await transaction.creativeAsset.create({
        data: {
          clientId: publication.clientId,
          blueprintId: publication.blueprintId,
          monthlyPlanId: publication.monthlyPlanId,
          plannedContentItemId: publication.plannedContentItemId,
          contentDraftId: publication.contentDraftId,
          scheduledPublicationId: publication.id,
          assetType: brief.assetType,
          title: brief.title,
          brief: brief.brief,
          formatRequirements: brief.formatRequirements,
          textOnAsset: brief.textOnAsset || null,
          references: brief.references,
          status: "brief_ready",
          source: "ai",
          approvalRequired: brief.approvalRequired,
          notes: brief.notes,
        },
      });

      if (publication.status === "scheduled") {
        await transaction.scheduledPublication.update({
          where: { id: publication.id },
          data: { status: "needs_assets" },
        });
      }

      return asset;
    });

    await markGenerationJobCompleted(generationJob.id, "ТЗ на креатив сгенерировано.", {
      creativeAssetId: createdAsset.id,
    });
  } catch {
    const message = "Не удалось сгенерировать ТЗ на креатив. Проверьте настройки AI и попробуйте ещё раз.";
    await markGenerationJobFailedSafely(generationJob.id, message);
    monthlyPlanErrorRedirect(
      publication.blueprintId,
      publication.monthlyPlanId,
      message,
      returnViewFromForm(formData, "assets"),
    );
  }

  revalidatePath("/");
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), { blueprintId: publication.blueprintId, planId: publication.monthlyPlanId, notice: "AI сгенерировал ТЗ на креативный материал." }));
}

export async function regenerateCreativeAssetBrief(formData: FormData) {
  const creativeAssetId = formText(formData, "creativeAssetId");

  if (!creativeAssetId) {
    errorRedirect("Не выбран креативный материал для перегенерации.");
  }

  const asset = await prisma.creativeAsset.findUnique({
    where: { id: creativeAssetId },
    include: {
      scheduledPublication: true,
      client: true,
      blueprint: {
        include: {
          riskRules: true,
        },
      },
      monthlyPlan: true,
      plannedContentItem: true,
      contentDraft: true,
    },
  });

  if (!asset) {
    errorRedirect("Креативный материал не найден.");
  }

  const generationJob = await createGenerationJob({
    clientId: asset.clientId,
    blueprintId: asset.blueprintId,
    monthlyPlanId: asset.monthlyPlanId,
    plannedContentItemId: asset.plannedContentItemId,
    contentDraftId: asset.contentDraftId,
    scheduledPublicationId: asset.scheduledPublicationId,
    creativeAssetId: asset.id,
    jobType: "regenerate_creative_brief",
    title: "Перегенерация ТЗ на креатив",
  });

  try {
    await markGenerationJobRunning(generationJob.id, "AI обновляет ТЗ на креатив.");
    const brief = await generateCreativeAssetBriefFromContext({
      ...asset.scheduledPublication,
      client: asset.client,
      blueprint: asset.blueprint,
      monthlyPlan: asset.monthlyPlan,
      plannedContentItem: asset.plannedContentItem,
      contentDraft: asset.contentDraft,
    });

    await prisma.creativeAsset.update({
      where: { id: asset.id },
      data: {
        assetType: brief.assetType,
        title: brief.title,
        brief: brief.brief,
        formatRequirements: brief.formatRequirements,
        textOnAsset: brief.textOnAsset || null,
        references: brief.references,
        status: "brief_ready",
        source: "ai",
        approvalRequired: brief.approvalRequired,
        notes: brief.notes,
      },
    });

    await markGenerationJobCompleted(generationJob.id, "ТЗ на креатив обновлено.", {
      creativeAssetId: asset.id,
    });
  } catch {
    const message = "Не удалось обновить ТЗ на креатив. Проверьте настройки AI и попробуйте ещё раз.";
    await markGenerationJobFailedSafely(generationJob.id, message);
    monthlyPlanErrorRedirect(
      asset.blueprintId,
      asset.monthlyPlanId,
      message,
      returnViewFromForm(formData, "assets"),
    );
  }

  revalidatePath("/");
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), { blueprintId: asset.blueprintId, planId: asset.monthlyPlanId, notice: "AI обновил ТЗ на креативный материал." }));
}

export async function updateCreativeAssetStatus(formData: FormData) {
  const creativeAssetId = formText(formData, "creativeAssetId");
  const status = formText(formData, "status");

  if (!creativeAssetId) {
    errorRedirect("Не выбран креативный материал.");
  }

  if (!creativeAssetStatuses.includes(status as CreativeAssetStatus)) {
    errorRedirect("Выбран недопустимый статус креативного материала.");
  }

  const asset = await prisma.creativeAsset.findUnique({
    where: { id: creativeAssetId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!asset) {
    errorRedirect("Креативный материал не найден.");
  }

  await prisma.creativeAsset.update({
    where: { id: asset.id },
    data: { status },
  });

  revalidatePath("/");
  redirect(workspaceLocation("assets", { blueprintId: asset.blueprintId, planId: asset.monthlyPlanId, notice: "Статус креативного материала обновлён." }));
}

export async function updateCreativeAssetBrief(formData: FormData) {
  const creativeAssetId = formText(formData, "creativeAssetId");
  const title = formText(formData, "title");
  const brief = formText(formData, "brief");
  const formatRequirements = formText(formData, "formatRequirements");
  const textOnAsset = formText(formData, "textOnAsset");
  const references = formText(formData, "references");
  const notes = formText(formData, "notes");

  if (!creativeAssetId) {
    errorRedirect("Не выбран креативный материал.");
  }

  if (!title || !brief) {
    errorRedirect("Укажите название и описание ТЗ.");
  }

  const asset = await prisma.creativeAsset.findUnique({
    where: { id: creativeAssetId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!asset) {
    errorRedirect("Креативный материал не найден.");
  }

  await prisma.creativeAsset.update({
    where: { id: asset.id },
    data: {
      title,
      brief,
      formatRequirements: formatRequirements || null,
      textOnAsset: textOnAsset || null,
      references: references || null,
      notes: notes || null,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation("assets", { blueprintId: asset.blueprintId, planId: asset.monthlyPlanId, notice: "ТЗ на креативный материал обновлено." }));
}

export async function generateCreativeVisualVariantForAsset(formData: FormData) {
  const creativeAssetId = formText(formData, "creativeAssetId");

  if (!creativeAssetId) {
    errorRedirect("Не выбран креативный материал для генерации визуала.");
  }

  const asset = await prisma.creativeAsset.findUnique({
    where: { id: creativeAssetId },
    include: {
      client: true,
      blueprint: true,
      monthlyPlan: true,
      plannedContentItem: true,
      contentDraft: true,
      scheduledPublication: true,
      generatedVariants: true,
    },
  });

  if (!asset) {
    errorRedirect("Креативный материал не найден.");
  }

  const generationJob = await createGenerationJob({
    clientId: asset.clientId,
    blueprintId: asset.blueprintId,
    monthlyPlanId: asset.monthlyPlanId,
    plannedContentItemId: asset.plannedContentItemId,
    contentDraftId: asset.contentDraftId,
    scheduledPublicationId: asset.scheduledPublicationId,
    creativeAssetId: asset.id,
    jobType: asset.generatedVariants.length > 0 ? "regenerate_visual" : "generate_visual",
    title: asset.generatedVariants.length > 0 ? "Генерация нового варианта визуала" : "Генерация премиум-визуала",
  });

  try {
    await markGenerationJobRunning(generationJob.id, "Premium Visual Engine создаёт вариант визуала.");
    const variant = await generateCreativeVisualVariant({
      clientName: asset.client.name,
      clientIndustry: asset.client.industry,
      creativeAsset: {
        assetType: asset.assetType,
        title: asset.title,
        brief: asset.brief,
        formatRequirements: asset.formatRequirements,
        textOnAsset: asset.textOnAsset,
        references: asset.references,
        notes: asset.notes,
      },
      scheduledPublication: {
        platformName: asset.scheduledPublication.platformName,
        format: asset.scheduledPublication.format,
        topic: asset.scheduledPublication.topic,
        scheduledDate: asset.scheduledPublication.scheduledDate,
        scheduledTime: asset.scheduledPublication.scheduledTime,
      },
      contentDraft: {
        draftTitle: asset.contentDraft.draftTitle,
        draftBody: asset.contentDraft.draftBody,
        riskLevel: asset.contentDraft.riskLevel,
        approvalRequired: asset.contentDraft.approvalRequired,
      },
    });

    const createdVariant = await prisma.generatedCreativeVariant.create({
      data: {
        clientId: asset.clientId,
        blueprintId: asset.blueprintId,
        monthlyPlanId: asset.monthlyPlanId,
        plannedContentItemId: asset.plannedContentItemId,
        contentDraftId: asset.contentDraftId,
        scheduledPublicationId: asset.scheduledPublicationId,
        creativeAssetId: asset.id,
        variantTitle: `Вариант визуала: ${asset.title}`,
        prompt: variant.prompt,
        revisedPrompt: variant.revisedPrompt,
        imageBase64: variant.imageBase64,
        mimeType: variant.mimeType,
        status: "generated",
        source: variant.provider,
        provider: variant.provider,
        model: variant.model,
        quality: variant.quality,
        size: variant.size,
        textMode: variant.textMode,
        qualityStatus: "needs_manual_review",
        qualityNotes: "Проверьте читаемость текста, лица, руки, медицинские утверждения и соответствие ТЗ.",
        notes: null,
      },
    });

    await markGenerationJobCompleted(generationJob.id, "Визуал сгенерирован.", {
      generatedCreativeVariantId: createdVariant.id,
    });
  } catch {
    const message = "Не удалось сгенерировать визуал. Проверьте настройки визуального движка и попробуйте ещё раз.";
    await markGenerationJobFailedSafely(generationJob.id, message);
    monthlyPlanErrorRedirect(
      asset.blueprintId,
      asset.monthlyPlanId,
      message,
      returnViewFromForm(formData, "assets"),
    );
  }

  revalidatePath("/");
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), { blueprintId: asset.blueprintId, planId: asset.monthlyPlanId, notice: "AI сгенерировал визуал." }));
}

async function updateCreativeVariantStatus(
  formData: FormData,
  status: CreativeVariantStatus,
  notice: string,
) {
  const creativeVariantId = formText(formData, "creativeVariantId");

  if (!creativeVariantId) {
    errorRedirect("Не выбран вариант визуала.");
  }

  const variant = await prisma.generatedCreativeVariant.findUnique({
    where: { id: creativeVariantId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
      creativeAssetId: true,
    },
  });

  if (!variant) {
    errorRedirect("Вариант визуала не найден.");
  }

  if (!creativeVariantStatuses.includes(status)) {
    errorRedirect("Выбран недопустимый статус варианта визуала.");
  }

  if (status === "approved") {
    await prisma.$transaction([
      prisma.generatedCreativeVariant.update({
        where: { id: variant.id },
        data: { status },
      }),
      prisma.creativeAsset.update({
        where: { id: variant.creativeAssetId },
        data: { status: "approved" },
      }),
    ]);
  } else {
    await prisma.generatedCreativeVariant.update({
      where: { id: variant.id },
      data: { status },
    });
  }

  revalidatePath("/");
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), { blueprintId: variant.blueprintId, planId: variant.monthlyPlanId, notice }));
}

export async function markCreativeVariantNeedsReview(formData: FormData) {
  await updateCreativeVariantStatus(formData, "needs_review", "Вариант визуала отправлен на проверку.");
}

export async function approveCreativeVariant(formData: FormData) {
  await updateCreativeVariantStatus(formData, "approved", "Вариант визуала согласован.");
}

export async function rejectCreativeVariant(formData: FormData) {
  await updateCreativeVariantStatus(formData, "rejected", "Вариант визуала отклонён.");
}

export async function deleteCreativeVariant(formData: FormData) {
  const creativeVariantId = formText(formData, "creativeVariantId");

  if (!creativeVariantId) {
    errorRedirect("Не выбран вариант визуала.");
  }

  const variant = await prisma.generatedCreativeVariant.findUnique({
    where: { id: creativeVariantId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!variant) {
    errorRedirect("Вариант визуала не найден.");
  }

  await prisma.generatedCreativeVariant.delete({
    where: { id: variant.id },
  });

  revalidatePath("/");
  redirect(workspaceLocation("assets", { blueprintId: variant.blueprintId, planId: variant.monthlyPlanId, notice: "Вариант визуала удалён." }));
}

async function updateCreativeVariantQuality(
  formData: FormData,
  qualityStatus: "passed" | "failed",
  notice: string,
) {
  const creativeVariantId = formText(formData, "creativeVariantId");
  const qualityNotes = formText(formData, "qualityNotes");

  if (!creativeVariantId) {
    errorRedirect("Не выбран вариант визуала.");
  }

  const variant = await prisma.generatedCreativeVariant.findUnique({
    where: { id: creativeVariantId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!variant) {
    errorRedirect("Вариант визуала не найден.");
  }

  await prisma.generatedCreativeVariant.update({
    where: { id: variant.id },
    data: {
      qualityStatus,
      qualityNotes: qualityNotes || null,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), { blueprintId: variant.blueprintId, planId: variant.monthlyPlanId, notice }));
}

export async function markCreativeVariantQualityPassed(formData: FormData) {
  await updateCreativeVariantQuality(formData, "passed", "Качество варианта визуала подтверждено.");
}

export async function markCreativeVariantQualityFailed(formData: FormData) {
  await updateCreativeVariantQuality(formData, "failed", "Для варианта визуала отмечены проблемы качества.");
}
