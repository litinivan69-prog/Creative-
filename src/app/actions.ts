"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import {
  generateClientPresenceBlueprint,
  generateContentDraft,
  generateCreativeAssetBrief,
  generateCreativeVisualVariant,
  generateMonthlyOperatingPlan,
  generateMonthlyPlanRevisionProposal,
} from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { validateBlueprintForPersistence } from "@/lib/blueprint-schema";
import {
  isSensitiveContent,
  validateContentDraftForPersistence,
} from "@/lib/content-draft-schema";
import { CreativeAssetBriefSchema } from "@/lib/creative-asset-schema";
import { normalizeMonthlyPlanDates, parseExactPlanDate } from "@/lib/monthly-plan-dates";
import { validateMonthlyPlanForBlueprint } from "@/lib/monthly-plan-schema";
import { MonthlyPlanRevisionProposalSchema } from "@/lib/monthly-plan-revision-schema";
import { getAutopilotTextBatchLimit } from "@/lib/autopilot";
import {
  createGenerationJob,
  markGenerationJobCompleted,
  markGenerationJobFailedSafely,
  markGenerationJobRunning,
} from "@/lib/generation-jobs";
import {
  generatePortalToken,
  hashPortalToken,
  tokenPrefix,
} from "@/lib/client-portal-links";
import { storeGeneratedVisual } from "@/lib/visual-storage";
import { storeClientBrandAssetFile } from "@/lib/brand-asset-storage";
import { getClientBrandContext } from "@/lib/brand-context";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

type WorkspaceView = "overview" | "clients" | "client_setup" | "approvals" | "calendar" | "drafts" | "assets" | "brand_assets" | "client_portal" | "settings";

function workspaceLocation(
  view: WorkspaceView,
  options: {
    blueprintId?: string;
    planId?: string;
    clientId?: string;
    setupStep?: string;
    brandStep?: string;
    calendarDate?: string;
    calendarView?: string;
    error?: string;
    filter?: string;
    materialId?: string;
    notice?: string;
    portalLink?: string;
  } = {},
) {
  const searchParams = new URLSearchParams({ view });

  if (options.blueprintId) searchParams.set("blueprint", options.blueprintId);
  if (options.planId) searchParams.set("plan", options.planId);
  if (options.clientId) searchParams.set("client", options.clientId);
  if (options.setupStep) searchParams.set("setupStep", options.setupStep);
  if (options.brandStep) searchParams.set("brandStep", options.brandStep);
  if (options.calendarView && options.calendarView !== "month") searchParams.set("calendarView", options.calendarView);
  if (options.calendarDate) searchParams.set("calendarDate", options.calendarDate);
  if (options.filter && options.filter !== "all") searchParams.set("filter", options.filter);
  if (options.materialId) searchParams.set("materialId", options.materialId);
  if (options.error) searchParams.set("error", options.error);
  if (options.notice) searchParams.set("notice", options.notice);
  if (options.portalLink) searchParams.set("portalLink", options.portalLink);

  return `/?${searchParams.toString()}`;
}

function portalLocation(token: string, options: { error?: string; notice?: string } = {}) {
  const searchParams = new URLSearchParams();

  if (options.error) searchParams.set("error", options.error);
  if (options.notice) searchParams.set("notice", options.notice);

  const query = searchParams.toString();

  return `/portal/${encodeURIComponent(token)}${query ? `?${query}` : ""}`;
}

function portalErrorRedirect(token: string, message: string): never {
  redirect(portalLocation(token || "invalid", { error: message }));
}

async function absolutePortalUrl(token: string) {
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  const path = portalLocation(token);

  if (publicAppUrl) {
    return `${publicAppUrl}${path}`;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  return host ? `${protocol}://${host}${path}` : path;
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

const MAX_BRAND_ASSET_FILE_SIZE = 20 * 1024 * 1024;
const supportedBrandAssetMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

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
    id: string;
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
  const returnView = formText(formData, "returnView");

  return returnView === "drafts" || returnView === "client_portal" ? returnView : fallback;
}

async function generateCreativeAssetBriefFromContext(context: CreativeAssetGenerationContext) {
  const brandContext = await getClientBrandContext(context.client.id);
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
    brandContext,
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

async function updateDraftWorkflowFromPortal(
  formData: FormData,
  update: {
    status: DraftWorkflowStatus;
    action: DraftReviewAction;
    notice: string;
  },
) {
  const token = formText(formData, "token");
  const contentDraftId = formText(formData, "contentDraftId");
  const comment = formText(formData, "comment");

  if (!token || !contentDraftId) {
    portalErrorRedirect(token, "Не удалось определить материал для согласования.");
  }

  const portalLink = await prisma.clientPortalLink.findUnique({
    where: { tokenHash: hashPortalToken(token) },
    select: {
      monthlyPlanId: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!portalLink || portalLink.status !== "active") {
    portalErrorRedirect(token, "Ссылка недействительна или была отключена.");
  }

  if (portalLink.expiresAt && portalLink.expiresAt < new Date()) {
    portalErrorRedirect(token, "Срок действия ссылки истёк.");
  }

  const draft = await prisma.contentDraft.findUnique({
    where: { id: contentDraftId },
    select: {
      id: true,
      monthlyPlanId: true,
    },
  });

  if (!draft || draft.monthlyPlanId !== portalLink.monthlyPlanId) {
    portalErrorRedirect(token, "Материал не найден в доступном клиентском календаре.");
  }

  await prisma.$transaction([
    prisma.contentDraft.update({
      where: { id: draft.id },
      data: { status: update.status },
    }),
    prisma.contentDraftReviewEvent.create({
      data: {
        contentDraftId: draft.id,
        actorType: "client",
        action: update.action,
        comment: comment || null,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath(portalLocation(token));
  redirect(portalLocation(token, { notice: update.notice }));
}

export async function createClientPortalLink(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");
  const blueprintId = formText(formData, "blueprintId");
  const label = formText(formData, "label");

  if (!monthlyPlanId || !blueprintId) {
    errorRedirect("Выберите месячный план для создания клиентской ссылки.", "client_portal");
  }

  const monthlyPlan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    select: {
      id: true,
      clientId: true,
      blueprintId: true,
    },
  });

  if (!monthlyPlan || monthlyPlan.blueprintId !== blueprintId) {
    errorRedirect("Месячный план для клиентской ссылки не найден.", "client_portal");
  }

  const token = generatePortalToken();

  await prisma.clientPortalLink.create({
    data: {
      clientId: monthlyPlan.clientId,
      blueprintId: monthlyPlan.blueprintId,
      monthlyPlanId: monthlyPlan.id,
      tokenHash: hashPortalToken(token),
      tokenPrefix: tokenPrefix(token),
      label: label || null,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation("client_portal", {
    blueprintId: monthlyPlan.blueprintId,
    planId: monthlyPlan.id,
    notice: "Клиентская ссылка создана.",
    portalLink: await absolutePortalUrl(token),
  }));
}

export async function revokeClientPortalLink(formData: FormData) {
  const portalLinkId = formText(formData, "portalLinkId");

  if (!portalLinkId) {
    errorRedirect("Клиентская ссылка не выбрана.", "client_portal");
  }

  const portalLink = await prisma.clientPortalLink.findUnique({
    where: { id: portalLinkId },
    select: {
      id: true,
      blueprintId: true,
      monthlyPlanId: true,
    },
  });

  if (!portalLink) {
    errorRedirect("Клиентская ссылка не найдена.", "client_portal");
  }

  await prisma.clientPortalLink.update({
    where: { id: portalLink.id },
    data: { status: "revoked" },
  });

  revalidatePath("/");
  redirect(workspaceLocation("client_portal", {
    blueprintId: portalLink.blueprintId,
    planId: portalLink.monthlyPlanId,
    notice: "Клиентская ссылка отключена.",
  }));
}

export async function createClient(formData: FormData) {
  const name = formText(formData, "name");
  const website = formText(formData, "website");
  const industry = formText(formData, "industry");

  if (!name) {
    throw new Error("Укажите название клиента.");
  }

  const client = await prisma.client.create({
    data: {
      name,
      website: website || null,
      industry: industry || null,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", { clientId: client.id, setupStep: "brief", notice: "Клиент создан. Теперь добавьте бриф." }));
}

export async function updateClientBrandProfile(formData: FormData) {
  const clientId = formText(formData, "clientId");
  if (!clientId) errorRedirect("Выберите клиента.", "brand_assets");

  const fields = ["toneOfVoice", "keyMessages", "targetAudienceNotes", "brandColors", "fonts", "visualStyle", "forbiddenTopics", "requiredDisclaimers", "legalNotes", "productServiceNotes"] as const;
  const data = Object.fromEntries(fields.map((field) => [field, formText(formData, field) || null]));

  await prisma.clientBrandProfile.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
  });

  revalidatePath("/");
  redirect(workspaceLocation("brand_assets", { clientId, brandStep: "materials", notice: "Профиль бренда обновлён." }));
}

export async function createClientBrandAsset(formData: FormData) {
  const clientId = formText(formData, "clientId");
  const assetType = formText(formData, "assetType");
  const title = formText(formData, "title");
  const file = formData.get("file");

  if (!clientId || !assetType || !title) errorRedirect("Укажите клиента, тип и название материала.", "brand_assets");

  const hasFile = file instanceof File && file.size > 0;

  if (hasFile && file.size > MAX_BRAND_ASSET_FILE_SIZE) {
    redirect(workspaceLocation("brand_assets", {
      clientId,
      brandStep: "materials",
      error: "Файл слишком большой. Максимальный размер для MVP — 20 МБ.",
    }));
  }

  if (hasFile && !supportedBrandAssetMimeTypes.has(file.type)) {
    redirect(workspaceLocation("brand_assets", {
      clientId,
      brandStep: "materials",
      error: "Этот формат пока не поддерживается. Загрузите PDF, PNG, JPG или WEBP.",
    }));
  }

  let uploaded: Awaited<ReturnType<typeof storeClientBrandAssetFile>> = null;

  if (hasFile) {
    try {
      uploaded = await storeClientBrandAssetFile({ file, clientId, assetType });
    } catch (error) {
      console.error("Brand asset upload failed", error);
      redirect(workspaceLocation("brand_assets", {
        clientId,
        brandStep: "materials",
        error: "Не удалось загрузить файл. Попробуйте ещё раз или добавьте материал без файла.",
      }));
    }
  }

  if (hasFile && !uploaded) {
    redirect(workspaceLocation("brand_assets", {
      clientId,
      brandStep: "materials",
      error: "Для загрузки файла подключите Vercel Blob. Пока можно добавить ссылку или текстовое описание.",
    }));
  }

  await prisma.clientBrandAsset.create({
    data: {
      clientId,
      assetType,
      title,
      description: formText(formData, "description") || null,
      sourceUrl: formText(formData, "sourceUrl") || null,
      textContent: formText(formData, "textContent") || null,
      ...uploaded,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation("brand_assets", { clientId, brandStep: "materials", notice: "Материал бренда добавлен." }));
}

export async function archiveClientBrandAsset(formData: FormData) {
  const brandAssetId = formText(formData, "brandAssetId");
  const brandStep = formText(formData, "brandStep") || "review";
  if (!brandAssetId) errorRedirect("Материал бренда не выбран.", "brand_assets");

  const asset = await prisma.clientBrandAsset.findUnique({ where: { id: brandAssetId }, select: { id: true, clientId: true } });
  if (!asset) errorRedirect("Материал бренда не найден.", "brand_assets");

  await prisma.clientBrandAsset.update({ where: { id: asset.id }, data: { status: "archived" } });
  revalidatePath("/");
  redirect(workspaceLocation("brand_assets", { clientId: asset.clientId, brandStep, notice: "Материал бренда скрыт." }));
}

export async function addClientBrief(formData: FormData) {
  const clientId = formText(formData, "clientId");
  const rawBrief = formText(formData, "rawBrief");

  if (!clientId || !rawBrief) {
    throw new Error("Выберите клиента и добавьте бриф.");
  }

  const brief = await prisma.clientBrief.create({
    data: {
      clientId,
      rawBrief,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", { clientId: brief.clientId, setupStep: "blueprint", notice: "Бриф сохранён. Теперь можно сгенерировать Blueprint." }));
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
  redirect(workspaceLocation("client_setup", { clientId: existingBrief.clientId, setupStep: "blueprint", notice: "Бриф обновлён. Когда будете готовы, сгенерируйте новый Blueprint." }));
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
    redirect(workspaceLocation("client_setup", { blueprintId: brief.blueprint.id, clientId: brief.clientId, setupStep: "monthly_plan" }));
  }

  let createdId: string;

  try {
    const generated = await generateClientPresenceBlueprint({
      clientName: brief.client.name,
      website: brief.client.website,
      industry: brief.client.industry,
      rawBrief: brief.rawBrief,
      brandContext: await getClientBrandContext(brief.clientId),
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
  redirect(workspaceLocation("client_setup", { blueprintId: createdId, clientId: brief.clientId, setupStep: "monthly_plan", notice: "Blueprint сгенерирован. Следующий шаг — месячный план." }));
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
    redirect(workspaceLocation("client_setup", { blueprintId: blueprint.id, planId: existingPlan.id, clientId: blueprint.clientId, setupStep: "brand", notice: "Месячный план за этот период уже существует." }));
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
  let textPreparationNotice = "";

  try {
    const generated = await generateMonthlyOperatingPlan({
      clientName: blueprint.client.name,
      month,
      allowedPlatformNames: recommendedPlatforms.map((platform) => platform.platformName),
      blueprint: blueprintPayload,
      brandContext: await getClientBrandContext(blueprint.clientId),
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
    normalizeMonthlyPlanDates(plan.plannedContentItems, plan.month);

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
    const textPreparation = await prepareMissingTextsForMonthlyPlan(created.id);
    textPreparationNotice = textPreparation.notice;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось сгенерировать месячный план. Проверьте Blueprint и попробуйте ещё раз.";
    blueprintErrorRedirect(blueprint.id, `Не удалось сгенерировать месячный план: ${message}`);
  }

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", {
    blueprintId: blueprint.id,
    planId: createdId,
    clientId: blueprint.clientId,
    setupStep: "brand",
    notice: `Месячный план сгенерирован. ${textPreparationNotice || "Тексты будут подготовлены в Materials."} Теперь заполните библиотеку бренда.`,
  }));
}

export async function autoScheduleMonthlyPlanDates(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");
  const calendarView = formText(formData, "calendarView");
  const calendarDate = formText(formData, "calendarDate");
  const filter = formText(formData, "filter");

  if (!monthlyPlanId) {
    errorRedirect("Месячный план не выбран.", "calendar");
  }

  const monthlyPlan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    select: {
      id: true,
      month: true,
      blueprintId: true,
      clientId: true,
      plannedContentItems: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          plannedDate: true,
          week: true,
          platformName: true,
          format: true,
          scheduledPublications: {
            where: {
              status: { not: "published" },
            },
            orderBy: { createdAt: "desc" },
            select: {
              scheduledDate: true,
            },
          },
        },
      },
    },
  });

  if (!monthlyPlan) {
    errorRedirect("Месячный план не найден.", "calendar");
  }

  const items = monthlyPlan.plannedContentItems.map((item) => {
    const existingScheduledDate = item.scheduledPublications
      .map((publication) => parseExactPlanDate(publication.scheduledDate))
      .find((date): date is string => Boolean(date));

    return {
      id: item.id,
      plannedDate: parseExactPlanDate(item.plannedDate) ? item.plannedDate : existingScheduledDate ?? item.plannedDate,
      week: item.week,
      platformName: item.platformName,
      format: item.format,
    };
  });
  const datesBefore = new Map(monthlyPlan.plannedContentItems.map((item) => [item.id, item.plannedDate]));
  normalizeMonthlyPlanDates(items, monthlyPlan.month);
  const changedItems = items.filter((item) => datesBefore.get(item.id) !== item.plannedDate);

  if (changedItems.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const item of changedItems) {
        await tx.plannedContentItem.update({
          where: { id: item.id },
          data: {
            plannedDate: item.plannedDate,
            week: item.week,
          },
        });

        await tx.scheduledPublication.updateMany({
          where: {
            plannedContentItemId: item.id,
            status: { not: "published" },
          },
          data: {
            scheduledDate: item.plannedDate,
          },
        });
      }
    });
  }

  revalidatePath("/");
  redirect(workspaceLocation("calendar", {
    blueprintId: monthlyPlan.blueprintId,
    planId: monthlyPlan.id,
    clientId: monthlyPlan.clientId,
    calendarDate: calendarDate || undefined,
    calendarView: calendarView || undefined,
    filter: filter || undefined,
    notice: changedItems.length > 0
      ? `Даты расставлены: ${changedItems.length} материалов добавлено в календарь.`
      : "Все материалы уже стоят на точных датах.",
  }));
}

function planItemProtectionReason(item: {
  status?: string;
  contentDraft: { status: string } | null;
  scheduledPublications: Array<{ status: string }>;
  creativeAssets: Array<{ generatedVariants: unknown[] }>;
  generatedCreativeVariants: unknown[];
}) {
  if (item.status && ["approved", "agreed", "client_approved", "ready_to_schedule"].includes(item.status)) {
    return "Материал уже согласован.";
  }

  if (item.contentDraft && ["approved", "ready_to_schedule", "sent_to_client", "client_approved"].includes(item.contentDraft.status)) {
    return "Материал уже согласован или отправлен клиенту.";
  }

  if (item.scheduledPublications.some((publication) => publication.status === "published")) {
    return "Публикация уже опубликована.";
  }

  if (item.generatedCreativeVariants.length > 0 || item.creativeAssets.some((asset) => asset.generatedVariants.length > 0)) {
    return "Для материала уже есть сгенерированный визуал.";
  }

  if (item.creativeAssets.length > 0) {
    return "Для материала уже есть ТЗ или креатив.";
  }

  return null;
}

const manualPlanProtectedMessage = "Материал уже находится в работе или согласован. Сначала снимите его с согласования или создайте новую версию.";

function optionalPlanText(formData: FormData, key: string) {
  const value = formText(formData, key);
  return value || null;
}

async function loadPlannedContentItemForManualEdit(plannedContentItemId: string) {
  return prisma.plannedContentItem.findUnique({
    where: { id: plannedContentItemId },
    include: {
      monthlyPlan: {
        select: {
          id: true,
          blueprintId: true,
          totalPlannedUnits: true,
          modules: {
            take: 1,
            orderBy: { id: "asc" },
          },
        },
      },
      contentDraft: {
        select: {
          id: true,
          status: true,
        },
      },
      scheduledPublications: {
        select: {
          id: true,
          status: true,
        },
      },
      creativeAssets: {
        include: {
          generatedVariants: {
            select: { id: true },
          },
        },
      },
      generatedCreativeVariants: {
        select: { id: true },
      },
    },
  });
}

export async function createPlannedContentItemManual(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");
  const platformName = formText(formData, "platformName");
  const format = formText(formData, "format");
  const topic = formText(formData, "topic");
  const goal = formText(formData, "goal");
  const week = optionalPlanText(formData, "week");
  const plannedDate = formText(formData, "plannedDate") || week || "week 1";

  if (!monthlyPlanId || !platformName || !format || !topic || !goal) {
    monthlyPlanErrorRedirect("", monthlyPlanId, "Заполните площадку, формат, тему и цель материала.", "drafts");
  }

  const monthlyPlan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      modules: {
        take: 1,
        orderBy: { id: "asc" },
      },
    },
  });

  if (!monthlyPlan) {
    errorRedirect("Месячный план не найден.", "drafts");
  }

  await prisma.plannedContentItem.create({
    data: {
      monthlyPlanId: monthlyPlan.id,
      moduleType: monthlyPlan.modules[0]?.moduleType ?? "custom",
      platformName,
      format,
      topic,
      goal,
      week,
      plannedDate,
      campaignTheme: optionalPlanText(formData, "campaignTheme"),
      contentPillar: optionalPlanText(formData, "contentPillar"),
      channelRole: optionalPlanText(formData, "channelRole"),
      sequenceReason: optionalPlanText(formData, "sequenceReason"),
      approvalRequired: true,
      autopublishEligible: false,
      requiredInputs: [],
      status: "planned",
    },
  });

  const updatedItemCount = await prisma.plannedContentItem.count({ where: { monthlyPlanId: monthlyPlan.id } });
  await prisma.monthlyOperatingPlan.update({
    where: { id: monthlyPlan.id },
    data: { totalPlannedUnits: Math.max(monthlyPlan.totalPlannedUnits, updatedItemCount) },
  });

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: monthlyPlan.blueprintId,
    planId: monthlyPlan.id,
    notice: "Материал добавлен в месячный план.",
  }));
}

export async function updatePlannedContentItemManual(formData: FormData) {
  const plannedContentItemId = formText(formData, "plannedContentItemId");
  const platformName = formText(formData, "platformName");
  const format = formText(formData, "format");
  const topic = formText(formData, "topic");
  const goal = formText(formData, "goal");
  const week = optionalPlanText(formData, "week");
  const plannedDate = formText(formData, "plannedDate") || week || "week 1";

  if (!plannedContentItemId || !platformName || !format || !topic || !goal) {
    errorRedirect("Заполните площадку, формат, тему и цель материала.", "drafts");
  }

  const item = await loadPlannedContentItemForManualEdit(plannedContentItemId);

  if (!item) {
    errorRedirect("Материал месячного плана не найден.", "drafts");
  }

  const protectionReason = planItemProtectionReason(item);
  if (protectionReason) {
    monthlyPlanErrorRedirect(item.monthlyPlan.blueprintId, item.monthlyPlanId, manualPlanProtectedMessage, "drafts");
  }

  await prisma.$transaction(async (tx) => {
    await tx.plannedContentItem.update({
      where: { id: item.id },
      data: {
        platformName,
        format,
        topic,
        goal,
        week,
        plannedDate,
        campaignTheme: optionalPlanText(formData, "campaignTheme"),
        contentPillar: optionalPlanText(formData, "contentPillar"),
        channelRole: optionalPlanText(formData, "channelRole"),
        sequenceReason: optionalPlanText(formData, "sequenceReason"),
        status: "planned",
      },
    });

    if (item.contentDraft) {
      await tx.contentDraft.update({
        where: { id: item.contentDraft.id },
        data: {
          platformName,
          format,
          topic,
          goal,
          status: "needs_review",
        },
      });
    }

    await tx.scheduledPublication.updateMany({
      where: {
        plannedContentItemId: item.id,
        status: { not: "published" },
      },
      data: {
        platformName,
        format,
        topic,
        scheduledDate: plannedDate,
        status: "scheduled",
      },
    });
  });

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: item.monthlyPlan.blueprintId,
    planId: item.monthlyPlanId,
    notice: "Изменения материала сохранены. Календарь обновится после перезагрузки.",
  }));
}

export async function deletePlannedContentItemManual(formData: FormData) {
  const plannedContentItemId = formText(formData, "plannedContentItemId");

  if (!plannedContentItemId) {
    errorRedirect("Материал месячного плана не выбран.", "drafts");
  }

  const item = await loadPlannedContentItemForManualEdit(plannedContentItemId);

  if (!item) {
    errorRedirect("Материал месячного плана не найден.", "drafts");
  }

  const protectionReason = planItemProtectionReason(item);
  if (protectionReason) {
    monthlyPlanErrorRedirect(item.monthlyPlan.blueprintId, item.monthlyPlanId, manualPlanProtectedMessage, "drafts");
  }

  await prisma.$transaction(async (tx) => {
    if (item.contentDraft) {
      await tx.contentDraft.delete({ where: { id: item.contentDraft.id } });
    }

    await tx.scheduledPublication.deleteMany({
      where: {
        plannedContentItemId: item.id,
        status: { not: "published" },
      },
    });
    await tx.plannedContentItem.delete({ where: { id: item.id } });
  });

  const updatedItemCount = await prisma.plannedContentItem.count({ where: { monthlyPlanId: item.monthlyPlanId } });
  await prisma.monthlyOperatingPlan.update({
    where: { id: item.monthlyPlanId },
    data: { totalPlannedUnits: updatedItemCount },
  });

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: item.monthlyPlan.blueprintId,
    planId: item.monthlyPlanId,
    notice: "Материал удалён из месячного плана.",
  }));
}

export async function duplicatePlannedContentItemManual(formData: FormData) {
  const plannedContentItemId = formText(formData, "plannedContentItemId");

  if (!plannedContentItemId) {
    errorRedirect("Материал месячного плана не выбран.", "drafts");
  }

  const item = await loadPlannedContentItemForManualEdit(plannedContentItemId);

  if (!item) {
    errorRedirect("Материал месячного плана не найден.", "drafts");
  }

  await prisma.plannedContentItem.create({
    data: {
      monthlyPlanId: item.monthlyPlanId,
      moduleType: item.moduleType,
      platformName: item.platformName,
      format: item.format,
      topic: `${item.topic} копия`,
      goal: item.goal,
      plannedDate: item.plannedDate,
      week: item.week,
      campaignTheme: item.campaignTheme,
      contentPillar: item.contentPillar,
      channelRole: item.channelRole,
      sequenceReason: item.sequenceReason,
      approvalRequired: true,
      autopublishEligible: false,
      requiredInputs: [],
      status: "planned",
    },
  });

  const updatedItemCount = await prisma.plannedContentItem.count({ where: { monthlyPlanId: item.monthlyPlanId } });
  await prisma.monthlyOperatingPlan.update({
    where: { id: item.monthlyPlanId },
    data: { totalPlannedUnits: Math.max(item.monthlyPlan.totalPlannedUnits, updatedItemCount) },
  });

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: item.monthlyPlan.blueprintId,
    planId: item.monthlyPlanId,
    notice: "Материал продублирован в месячном плане.",
  }));
}

async function applyMonthlyPlanRevisionProposalById(proposalId: string) {
  const proposal = await prisma.monthlyPlanRevisionProposal.findUnique({
    where: { id: proposalId },
    include: {
      monthlyPlan: {
        include: {
          modules: true,
          plannedContentItems: {
            include: {
              contentDraft: {
                select: {
                  id: true,
                  status: true,
                },
              },
              scheduledPublications: {
                select: {
                  id: true,
                  status: true,
                },
              },
              creativeAssets: {
                include: {
                  generatedVariants: {
                    select: { id: true },
                  },
                },
              },
              generatedCreativeVariants: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!proposal) {
    throw new Error("Предложение правок не найдено.");
  }

  if (!["draft", "applied_candidate"].includes(proposal.status)) {
    throw new Error("Это предложение уже обработано.");
  }

  const changes = MonthlyPlanRevisionProposalSchema.parse(proposal.proposedChanges);
  const itemsById = new Map(proposal.monthlyPlan.plannedContentItems.map((item) => [item.id, item]));
  const fallbackModule = proposal.monthlyPlan.modules[0];
  let removed = 0;
  let updated = 0;
  let added = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const change of changes.removeItems) {
      const item = itemsById.get(change.plannedContentItemId);
      if (!item || planItemProtectionReason(item)) {
        skipped += 1;
        continue;
      }

      if (item.contentDraft) {
        await tx.contentDraft.delete({ where: { id: item.contentDraft.id } });
      }

      await tx.scheduledPublication.deleteMany({
        where: {
          plannedContentItemId: item.id,
          status: { not: "published" },
        },
      });
      await tx.plannedContentItem.delete({ where: { id: item.id } });
      removed += 1;
    }

    for (const change of changes.updateItems) {
      const item = itemsById.get(change.plannedContentItemId);
      if (!item || planItemProtectionReason(item)) {
        skipped += 1;
        continue;
      }

      const nextGoal = change.angle || item.goal;
      await tx.plannedContentItem.update({
        where: { id: item.id },
        data: {
          platformName: change.platform,
          format: change.format,
          topic: change.topic,
          goal: nextGoal,
          campaignTheme: change.angle || item.campaignTheme,
          contentPillar: change.angle || item.contentPillar,
          channelRole: change.angle || item.channelRole,
          sequenceReason: change.reason,
          status: "planned",
        },
      });

      if (item.contentDraft) {
        await tx.contentDraft.update({
          where: { id: item.contentDraft.id },
          data: {
            platformName: change.platform,
            format: change.format,
            topic: change.topic,
            goal: nextGoal,
            status: "needs_review",
          },
        });
      }

      await tx.scheduledPublication.updateMany({
        where: {
          plannedContentItemId: item.id,
          status: { not: "published" },
        },
        data: {
          platformName: change.platform,
          format: change.format,
          topic: change.topic,
          status: "scheduled",
        },
      });

      updated += 1;
    }

    for (const change of changes.addItems) {
      await tx.plannedContentItem.create({
        data: {
          monthlyPlanId: proposal.monthlyPlanId,
          moduleType: fallbackModule?.moduleType ?? "custom",
          platformName: change.platform,
          format: change.format,
          topic: change.topic,
          goal: change.angle || change.reason,
          plannedDate: `week ${change.week}`,
          week: `week ${change.week}`,
          campaignTheme: change.angle || null,
          contentPillar: change.angle || null,
          channelRole: change.angle || null,
          sequenceReason: change.reason,
          approvalRequired: true,
          autopublishEligible: false,
          requiredInputs: [],
          status: "planned",
        },
      });
      added += 1;
    }

    await tx.monthlyPlanRevisionProposal.update({
      where: { id: proposal.id },
      data: { status: "applied" },
    });
  });

  const updatedItemCount = await prisma.plannedContentItem.count({
    where: { monthlyPlanId: proposal.monthlyPlanId },
  });
  await prisma.monthlyOperatingPlan.update({
    where: { id: proposal.monthlyPlanId },
    data: { totalPlannedUnits: Math.max(proposal.monthlyPlan.totalPlannedUnits - removed + added, updatedItemCount) },
  });

  return {
    blueprintId: proposal.monthlyPlan.blueprintId,
    monthlyPlanId: proposal.monthlyPlanId,
    added,
    updated,
    removed,
    protectedCount: skipped + changes.protectedItems.length,
  };
}

export async function proposeMonthlyPlanRevision(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");
  const instruction = formText(formData, "instruction");

  if (!monthlyPlanId || !instruction) {
    monthlyPlanErrorRedirect("", monthlyPlanId, "Опишите, что нужно изменить в месячном плане.", "drafts");
  }

  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      client: true,
      blueprint: {
        include: {
          selectedModules: true,
          platformRecommendations: true,
          riskRules: true,
        },
      },
      modules: true,
      platforms: true,
      plannedContentItems: {
        include: {
          contentDraft: true,
          scheduledPublications: true,
          creativeAssets: {
            include: {
              generatedVariants: {
                select: { id: true },
              },
            },
          },
          generatedCreativeVariants: {
            select: { id: true },
          },
        },
      },
      contentDrafts: true,
      scheduledPublications: true,
      creativeAssets: true,
    },
  });

  if (!plan) {
    errorRedirect("Месячный план не найден.", "drafts");
  }

  let redirectTarget = "";

  try {
    const planContext = {
      id: plan.id,
      month: plan.month,
      summary: plan.summary,
      totalPlannedUnits: plan.totalPlannedUnits,
      platforms: plan.platforms,
      modules: plan.modules,
      plannedContentItems: plan.plannedContentItems.map((item) => {
        const protectionReason = planItemProtectionReason(item);

        return {
          id: item.id,
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
          status: item.status,
          contentDraftStatus: item.contentDraft?.status ?? null,
          scheduledPublicationsCount: item.scheduledPublications.length,
          creativeAssetsCount: item.creativeAssets.length,
          generatedVisualsCount:
            item.generatedCreativeVariants.length +
            item.creativeAssets.reduce((count, asset) => count + asset.generatedVariants.length, 0),
          protected: Boolean(protectionReason),
          protectionReason,
        };
      }),
    };
    const blueprintContext = {
      id: plan.blueprint.id,
      clientSummary: plan.blueprint.clientSummary,
      recommendedPlatforms: plan.blueprint.platformRecommendations.filter((platform) => platform.recommendation === "recommended"),
      selectedModules: plan.blueprint.selectedModules,
      riskRules: plan.blueprint.riskRules,
    };
    const generated = await generateMonthlyPlanRevisionProposal({
      clientName: plan.client.name,
      instruction,
      monthlyPlan: planContext,
      blueprint: blueprintContext,
      brandContext: await getClientBrandContext(plan.clientId),
    });
    const proposal = MonthlyPlanRevisionProposalSchema.parse(generated);

    await prisma.monthlyPlanRevisionProposal.create({
      data: {
        monthlyPlanId: plan.id,
        instruction,
        summary: proposal.summary,
        proposedChanges: proposal as unknown as Prisma.InputJsonValue,
        status: "draft",
      },
    });

    revalidatePath("/");
    redirectTarget = workspaceLocation("drafts", {
      blueprintId: plan.blueprintId,
      planId: plan.id,
      notice: "AI предложил правки плана. Проверьте их перед применением.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подготовить предложение по правкам.";
    monthlyPlanErrorRedirect(plan.blueprintId, plan.id, `Не удалось предложить правки плана: ${message}`, "drafts");
  }

  redirect(redirectTarget);
}

export async function reviseMonthlyPlanWithCopilot(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");
  const instruction = formText(formData, "instruction");

  if (!monthlyPlanId || !instruction) {
    monthlyPlanErrorRedirect("", monthlyPlanId, "Опишите, что нужно изменить в месячном плане.", "drafts");
  }

  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      client: true,
      blueprint: {
        include: {
          selectedModules: true,
          platformRecommendations: true,
          riskRules: true,
        },
      },
      modules: true,
      platforms: true,
      plannedContentItems: {
        include: {
          contentDraft: {
            select: {
              id: true,
              status: true,
            },
          },
          scheduledPublications: {
            select: {
              id: true,
              status: true,
            },
          },
          creativeAssets: {
            include: {
              generatedVariants: {
                select: { id: true },
              },
            },
          },
          generatedCreativeVariants: {
            select: { id: true },
          },
        },
      },
      contentDrafts: true,
      scheduledPublications: true,
      creativeAssets: true,
    },
  });

  if (!plan) {
    errorRedirect("Месячный план не найден.", "drafts");
  }

  let redirectTarget = "";
  let createdProposalId: string | null = null;

  try {
    const planContext = {
      id: plan.id,
      month: plan.month,
      summary: plan.summary,
      totalPlannedUnits: plan.totalPlannedUnits,
      platforms: plan.platforms,
      modules: plan.modules,
      plannedContentItems: plan.plannedContentItems.map((item) => {
        const protectionReason = planItemProtectionReason(item);

        return {
          id: item.id,
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
          status: item.status,
          contentDraftStatus: item.contentDraft?.status ?? null,
          scheduledPublicationsCount: item.scheduledPublications.length,
          creativeAssetsCount: item.creativeAssets.length,
          generatedVisualsCount:
            item.generatedCreativeVariants.length +
            item.creativeAssets.reduce((count, asset) => count + asset.generatedVariants.length, 0),
          protected: Boolean(protectionReason),
          protectionReason,
        };
      }),
    };
    const blueprintContext = {
      id: plan.blueprint.id,
      clientSummary: plan.blueprint.clientSummary,
      recommendedPlatforms: plan.blueprint.platformRecommendations.filter((platform) => platform.recommendation === "recommended"),
      selectedModules: plan.blueprint.selectedModules,
      riskRules: plan.blueprint.riskRules,
    };
    const generated = await generateMonthlyPlanRevisionProposal({
      clientName: plan.client.name,
      instruction,
      monthlyPlan: planContext,
      blueprint: blueprintContext,
      brandContext: await getClientBrandContext(plan.clientId),
    });
    const generatedProposal = MonthlyPlanRevisionProposalSchema.parse(generated);

    const proposal = await prisma.monthlyPlanRevisionProposal.create({
      data: {
        monthlyPlanId: plan.id,
        instruction,
        summary: generatedProposal.summary,
        proposedChanges: generatedProposal as unknown as Prisma.InputJsonValue,
        status: "applied_candidate",
      },
    });
    createdProposalId = proposal.id;

    const result = await applyMonthlyPlanRevisionProposalById(proposal.id);

    revalidatePath("/");
    redirectTarget = workspaceLocation("drafts", {
      blueprintId: result.blueprintId,
      planId: result.monthlyPlanId,
      notice: `План обновлён: добавлено ${result.added}, обновлено ${result.updated}, удалено ${result.removed}, защищено и не тронуто ${result.protectedCount}.`,
    });
  } catch (error) {
    if (createdProposalId) {
      await prisma.monthlyPlanRevisionProposal.update({
        where: { id: createdProposalId },
        data: { status: "draft" },
      });
    }
    const message = error instanceof Error ? error.message : "Не удалось обновить месячный план.";
    monthlyPlanErrorRedirect(plan.blueprintId, plan.id, `Не удалось исправить план: ${message}`, "drafts");
  }

  redirect(redirectTarget);
}

export async function applyMonthlyPlanRevisionProposal(formData: FormData) {
  const proposalId = formText(formData, "proposalId");

  if (!proposalId) {
    errorRedirect("Предложение правок не выбрано.", "drafts");
  }

  const proposalMeta = await prisma.monthlyPlanRevisionProposal.findUnique({
    where: { id: proposalId },
    include: {
      monthlyPlan: {
        select: {
          blueprintId: true,
        },
      },
    },
  });

  if (!proposalMeta) {
    errorRedirect("Предложение правок не найдено.", "drafts");
  }

  if (proposalMeta.status !== "draft") {
    redirect(workspaceLocation("drafts", {
      blueprintId: proposalMeta.monthlyPlan.blueprintId,
      planId: proposalMeta.monthlyPlanId,
      error: "Это предложение уже обработано.",
    }));
  }

  let result;
  try {
    result = await applyMonthlyPlanRevisionProposalById(proposalMeta.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось применить правки плана.";
    monthlyPlanErrorRedirect(proposalMeta.monthlyPlan.blueprintId, proposalMeta.monthlyPlanId, `Не удалось применить правки плана: ${message}`, "drafts");
  }

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: result.blueprintId,
    planId: result.monthlyPlanId,
    notice: `Правки плана применены. Добавлено: ${result.added}, обновлено: ${result.updated}, удалено: ${result.removed}, защищено и не тронуто: ${result.protectedCount}.`,
  }));
}

export async function rejectMonthlyPlanRevisionProposal(formData: FormData) {
  const proposalId = formText(formData, "proposalId");

  if (!proposalId) {
    errorRedirect("Предложение правок не выбрано.", "drafts");
  }

  const proposal = await prisma.monthlyPlanRevisionProposal.findUnique({
    where: { id: proposalId },
    include: {
      monthlyPlan: {
        select: {
          blueprintId: true,
        },
      },
    },
  });

  if (!proposal) {
    errorRedirect("Предложение правок не найдено.", "drafts");
  }

  await prisma.monthlyPlanRevisionProposal.update({
    where: { id: proposal.id },
    data: { status: "rejected" },
  });

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: proposal.monthlyPlan.blueprintId,
    planId: proposal.monthlyPlanId,
    notice: "Предложение отклонено.",
  }));
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
      brandContext: await getClientBrandContext(plan.clientId),
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
    materialId: plannedContentItemId,
    ...(result.status === "failed" ? { error: result.message } : { notice: result.message }),
  }));
}

export async function generateContentDraftForItem(formData: FormData) {
  await generateContentTextForItem(formData, false);
}

export async function regenerateContentDraftForItem(formData: FormData) {
  await generateContentTextForItem(formData, true);
}

export async function clearLegacyBase64ForBlobVariants() {
  const result = await prisma.generatedCreativeVariant.updateMany({
    where: {
      imageUrl: {
        not: null,
      },
      imageBase64: {
        not: null,
      },
    },
    data: {
      imageBase64: null,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation("settings", {
    notice: `Legacy base64 у Blob-визуалов очищен. Обновлено записей: ${result.count}.`,
  }));
}

async function prepareMissingTextsForMonthlyPlan(monthlyPlanId: string) {
  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      plannedContentItems: {
        include: {
          contentDraft: true,
        },
      },
    },
  });

  if (!plan) {
    return {
      blueprintId: "",
      monthlyPlanId,
      notice: "Месячный план для подготовки текстов не найден.",
      hasFailures: true,
    };
  }

  const generationJob = await createGenerationJob({
    clientId: plan.clientId,
    blueprintId: plan.blueprintId,
    monthlyPlanId: plan.id,
    jobType: "prepare_month_texts",
    title: "Подготовка текстов месяца",
  });
  await markGenerationJobRunning(generationJob.id, "AI готовит недостающие тексты публикаций.");

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
    let notice = `Тексты подготовлены: ${createdTextsCount + skippedTextsCount} из ${plan.plannedContentItems.length}.`;

    if (remainingMissingTextsCount > 0) {
      notice = `Тексты подготовлены: ${createdTextsCount + skippedTextsCount} из ${plan.plannedContentItems.length}. Осталось ${remainingMissingTextsCount}; нажмите «Подготовить тексты» в Materials, чтобы продолжить.`;
    }

    if (failedTextsCount > 0) {
      notice = `Тексты подготовлены: ${createdTextsCount + skippedTextsCount} из ${plan.plannedContentItems.length}. Не удалось подготовить ${failedTextsCount} текстов. Повторите подготовку в Materials.`;
    }

    await markGenerationJobCompleted(
      generationJob.id,
      `Создано ${createdTextsCount} текстов, пропущено ${skippedTextsCount}, ошибок ${failedTextsCount}.`,
    );

    return {
      blueprintId: plan.blueprintId,
      monthlyPlanId: plan.id,
      notice,
      hasFailures: failedTextsCount > 0,
    };
  } catch {
    const message = "Не удалось автоматически подготовить тексты месяца. Повторите подготовку в Materials.";
    await markGenerationJobFailedSafely(generationJob.id, message);

    return {
      blueprintId: plan.blueprintId,
      monthlyPlanId: plan.id,
      notice: message,
      hasFailures: true,
    };
  }
}

export async function prepareMonthAutopilot(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");

  if (!monthlyPlanId) {
    errorRedirect("Не выбран месячный план для автоподготовки.", "drafts");
  }

  const result = await prepareMissingTextsForMonthlyPlan(monthlyPlanId);

  if (!result.blueprintId) {
    errorRedirect(result.notice, "drafts");
  }

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: result.blueprintId,
    planId: result.monthlyPlanId,
    ...(result.hasFailures ? { error: result.notice } : { notice: result.notice }),
  }));
}

export async function prepareMonthCreativeBriefs(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");

  if (!monthlyPlanId) {
    errorRedirect("Не выбран месячный план для подготовки ТЗ.", "drafts");
  }

  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      scheduledPublications: {
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
      },
    },
  });

  if (!plan) {
    errorRedirect("Месячный план для подготовки ТЗ не найден.", "drafts");
  }

  const candidates = plan.scheduledPublications
    .filter((publication) => publication.contentDraft && publication.creativeAssets.length === 0)
    .slice(0, 3);
  let createdCount = 0;
  let failedCount = 0;
  const skippedCount = plan.scheduledPublications.length - candidates.length;

  for (const publication of candidates) {
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
      createdCount += 1;
    } catch {
      failedCount += 1;
      await markGenerationJobFailedSafely(generationJob.id, "Не удалось сгенерировать ТЗ на креатив.");
    }
  }

  const remainingCount = plan.scheduledPublications.filter(
    (publication) => publication.contentDraft && publication.creativeAssets.length === 0,
  ).length - createdCount;
  const notice = `Подготовлено ${createdCount} ТЗ, пропущено ${Math.max(skippedCount, 0)}. Осталось ${Math.max(remainingCount, 0)}.`;

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: plan.blueprintId,
    planId: plan.id,
    ...(failedCount > 0 ? { error: `${notice} Ошибок: ${failedCount}.` } : { notice }),
  }));
}

async function generateVisualForCreativeAssetId(creativeAssetId: string) {
  const asset = await prisma.creativeAsset.findUnique({
    where: { id: creativeAssetId },
    include: {
      client: true,
      blueprint: true,
      monthlyPlan: true,
      plannedContentItem: true,
      contentDraft: true,
      scheduledPublication: true,
      generatedVariants: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!asset) {
    return {
      status: "failed" as const,
      message: "Креативный материал не найден.",
    };
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
      brandContext: await getClientBrandContext(asset.clientId),
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
    const storedVisual = await storeGeneratedVisual({
      imageBase64: variant.imageBase64,
      mimeType: variant.mimeType,
      clientId: asset.clientId,
      monthlyPlanId: asset.monthlyPlanId,
      creativeAssetId: asset.id,
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
        imageBase64: storedVisual.storageProvider === "database_base64" ? storedVisual.imageBase64 : null,
        imageUrl: storedVisual.storageProvider === "vercel_blob" ? storedVisual.imageUrl : null,
        storageKey: storedVisual.storageProvider === "vercel_blob" ? storedVisual.storageKey : null,
        storageProvider: storedVisual.storageProvider,
        fileSize: storedVisual.fileSize,
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

    await markGenerationJobCompleted(
      generationJob.id,
      storedVisual.storageProvider === "vercel_blob"
        ? "Визуал сгенерирован и сохранён в хранилище."
        : "Визуал сгенерирован и временно сохранён в базе.",
      {
        generatedCreativeVariantId: createdVariant.id,
      },
    );

    return {
      status: "created" as const,
      message: "AI сгенерировал визуал.",
      blueprintId: asset.blueprintId,
      monthlyPlanId: asset.monthlyPlanId,
    };
  } catch {
    const message = "Не удалось сгенерировать визуал. Проверьте настройки визуального движка и попробуйте ещё раз.";
    await markGenerationJobFailedSafely(generationJob.id, message);
    return {
      status: "failed" as const,
      message,
      blueprintId: asset.blueprintId,
      monthlyPlanId: asset.monthlyPlanId,
    };
  }
}

export async function prepareMonthVisuals(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");

  if (!monthlyPlanId) {
    errorRedirect("Не выбран месячный план для подготовки визуалов.", "drafts");
  }

  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      creativeAssets: {
        include: {
          generatedVariants: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!plan) {
    errorRedirect("Месячный план для подготовки визуалов не найден.", "drafts");
  }

  const candidates = plan.creativeAssets.filter((asset) => asset.generatedVariants.length === 0).slice(0, 1);
  const results = [];

  for (const asset of candidates) {
    results.push(await generateVisualForCreativeAssetId(asset.id));
  }

  const createdCount = results.filter((result) => result.status === "created").length;
  const failedCount = results.filter((result) => result.status === "failed").length;
  const remainingCount = Math.max(0, plan.creativeAssets.filter((asset) => asset.generatedVariants.length === 0).length - createdCount);
  const notice = `Подготовлено ${createdCount} визуалов. Осталось ${remainingCount}. В MVP визуалы готовятся по одному за запуск.`;

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: plan.blueprintId,
    planId: plan.id,
    ...(failedCount > 0 ? { error: `${notice} Ошибок: ${failedCount}.` } : { notice }),
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
      plannedContentItemId: true,
    },
  });

  if (!draft) {
    errorRedirect("Материал не найден.", "drafts");
  }

  if (!draftTitle || !draftBody) {
    redirect(workspaceLocation("drafts", {
      blueprintId: draft.blueprintId,
      planId: draft.monthlyPlanId,
      materialId: draft.plannedContentItemId,
      error: "Укажите заголовок и текст публикации.",
    }));
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
    materialId: draft.plannedContentItemId,
    notice: "Текст сохранён.",
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
    notice: draftReviewActor(formData) === "client" ? "Правки по материалу отправлены." : "Для материала запрошены правки.",
  });
}

export async function approveDraft(formData: FormData) {
  await updateDraftWorkflow(formData, {
    status: "approved",
    action: "approved",
    notice: "Материал согласован.",
  });
}

export async function approveDraftFromPortal(formData: FormData) {
  await updateDraftWorkflowFromPortal(formData, {
    status: "approved",
    action: "approved",
    notice: "Материал согласован.",
  });
}

export async function requestDraftChangesFromPortal(formData: FormData) {
  await updateDraftWorkflowFromPortal(formData, {
    status: "client_changes_requested",
    action: "changes_requested",
    notice: "Правки по материалу отправлены.",
  });
}

export async function rejectDraft(formData: FormData) {
  await updateDraftWorkflow(formData, {
    status: "rejected",
    action: "rejected",
    notice: "Материал отклонён.",
  });
}

export async function addDraftManagerComment(formData: FormData) {
  const contentDraftId = formText(formData, "contentDraftId");
  const comment = formText(formData, "comment");

  if (!contentDraftId) {
    errorRedirect("Не выбран материал.", "approvals");
  }

  if (!comment) {
    errorRedirect("Напишите ответ клиенту.", "approvals");
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
    errorRedirect("Материал не найден.", "approvals");
  }

  await prisma.contentDraftReviewEvent.create({
    data: {
      contentDraftId: draft.id,
      actorType: "manager",
      action: "comment_added",
      comment,
    },
  });

  revalidatePath("/");
  redirect(workspaceLocation("approvals", {
    blueprintId: draft.blueprintId,
    planId: draft.monthlyPlanId,
    notice: "Ответ по правке сохранён.",
  }));
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
  redirect(workspaceLocation(returnViewFromForm(formData, "calendar"), {
    blueprintId: draft.blueprintId,
    planId: draft.monthlyPlanId,
    materialId: draft.plannedContentItemId,
    notice: "Для этого материала публикация уже запланирована.",
  }));
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
  redirect(workspaceLocation(returnViewFromForm(formData, "calendar"), {
    blueprintId: draft.blueprintId,
    planId: draft.monthlyPlanId,
    materialId: draft.plannedContentItemId,
    notice: "Публикация запланирована.",
  }));
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
      plannedContentItemId: true,
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
  redirect(workspaceLocation(returnViewFromForm(formData, "calendar"), {
    blueprintId: publication.blueprintId,
    planId: publication.monthlyPlanId,
    materialId: publication.plannedContentItemId,
    notice,
  }));
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
    redirect(workspaceLocation(returnViewFromForm(formData, "assets"), {
      blueprintId: publication.blueprintId,
      planId: publication.monthlyPlanId,
      materialId: publication.plannedContentItemId,
      notice: "Для этой публикации уже есть ТЗ на креатив.",
    }));
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
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), {
    blueprintId: publication.blueprintId,
    planId: publication.monthlyPlanId,
    materialId: publication.plannedContentItemId,
    notice: "AI сгенерировал ТЗ на креативный материал.",
  }));
}

export async function generateCreativeBriefForSelectedMaterial(formData: FormData) {
  const plannedContentItemId = formText(formData, "plannedContentItemId");

  if (!plannedContentItemId) {
    errorRedirect("Не выбран материал для генерации ТЗ.", "drafts");
  }

  const item = await prisma.plannedContentItem.findUnique({
    where: { id: plannedContentItemId },
    include: {
      contentDraft: true,
      creativeAssets: true,
      monthlyPlan: {
        include: {
          client: true,
          blueprint: {
            include: {
              riskRules: true,
            },
          },
        },
      },
      scheduledPublications: {
        orderBy: { createdAt: "desc" },
        include: {
          creativeAssets: true,
        },
      },
    },
  });

  if (!item) {
    errorRedirect("Материал не найден.", "drafts");
  }

  const plan = item.monthlyPlan;
  const returnLocation = (options: { error?: string; notice?: string }) =>
    workspaceLocation("drafts", {
      blueprintId: plan.blueprintId,
      planId: plan.id,
      materialId: item.id,
      ...options,
    });

  if (!item.contentDraft) {
    redirect(returnLocation({ error: "Сначала подготовьте текст." }));
  }

  if (item.creativeAssets.length > 0 || item.scheduledPublications.some((publication) => publication.creativeAssets.length > 0)) {
    redirect(returnLocation({ notice: "Для этого материала уже есть ТЗ на креатив." }));
  }

  let publicationId = item.scheduledPublications[0]?.id;

  if (!publicationId) {
    const publication = await prisma.scheduledPublication.create({
      data: {
        clientId: plan.clientId,
        blueprintId: plan.blueprintId,
        monthlyPlanId: plan.id,
        plannedContentItemId: item.id,
        contentDraftId: item.contentDraft.id,
        platformName: item.platformName,
        format: item.format,
        topic: item.topic,
        scheduledDate: item.plannedDate || item.week || "after approval",
        scheduledTime: null,
        timezone: null,
        status: "needs_assets",
        publishMode: "manual",
        notes: "Служебная публикация для подготовки ТЗ и визуала в Materials Studio.",
      },
    });
    publicationId = publication.id;
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: publicationId },
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
    redirect(returnLocation({ error: "Не удалось подготовить публикацию для генерации ТЗ." }));
  }

  if (publication.creativeAssets.length > 0) {
    redirect(returnLocation({ notice: "Для этого материала уже есть ТЗ на креатив." }));
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
    redirect(returnLocation({ error: message }));
  }

  revalidatePath("/");
  redirect(returnLocation({ notice: "AI сгенерировал ТЗ на креативный материал." }));
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
      plannedContentItemId: true,
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
      plannedContentItemId: true,
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
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), {
    blueprintId: asset.blueprintId,
    planId: asset.monthlyPlanId,
    materialId: asset.plannedContentItemId,
    notice: "ТЗ на креативный материал обновлено.",
  }));
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
      generatedVariants: {
        select: {
          id: true,
        },
      },
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
      brandContext: await getClientBrandContext(asset.clientId),
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
    const storedVisual = await storeGeneratedVisual({
      imageBase64: variant.imageBase64,
      mimeType: variant.mimeType,
      clientId: asset.clientId,
      monthlyPlanId: asset.monthlyPlanId,
      creativeAssetId: asset.id,
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
        imageBase64: storedVisual.storageProvider === "database_base64" ? storedVisual.imageBase64 : null,
        imageUrl: storedVisual.storageProvider === "vercel_blob" ? storedVisual.imageUrl : null,
        storageKey: storedVisual.storageProvider === "vercel_blob" ? storedVisual.storageKey : null,
        storageProvider: storedVisual.storageProvider,
        fileSize: storedVisual.fileSize,
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

    await markGenerationJobCompleted(
      generationJob.id,
      storedVisual.storageProvider === "vercel_blob"
        ? "Визуал сгенерирован и сохранён в хранилище."
        : "Визуал сгенерирован и временно сохранён в базе.",
      {
        generatedCreativeVariantId: createdVariant.id,
      },
    );
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
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), {
    blueprintId: asset.blueprintId,
    planId: asset.monthlyPlanId,
    materialId: asset.plannedContentItemId,
    notice: "AI сгенерировал визуал.",
  }));
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
      plannedContentItemId: true,
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
  redirect(workspaceLocation(returnViewFromForm(formData, "assets"), {
    blueprintId: variant.blueprintId,
    planId: variant.monthlyPlanId,
    materialId: variant.plannedContentItemId,
    notice,
  }));
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
