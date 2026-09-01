"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import {
  generateClientPresenceBlueprint,
  generateContentDraft,
  generateCreativeAssetBrief,
  generateCreativeVisualVariant,
  generateMonthlyOperatingPlan,
  generateMonthlyPlanRevisionProposal,
} from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { emitIntegrationEvent } from "@/lib/integration-events";
import {
  TELEGRAM_BOT_TOKEN_KEY,
  TELEGRAM_BOT_USERNAME_KEY,
  getIntegrationSetting,
  getTelegramBotToken,
  setIntegrationSetting,
  verifyTelegramBotToken,
  verifyTelegramChannel,
} from "@/lib/telegram";
import { publishScheduledPublication } from "@/lib/telegram-publish";
import { collectPublicationMetrics } from "@/lib/metrics-collect";
import { VK_ACCESS_TOKEN_KEY, VK_ACCOUNT_LABEL_KEY, verifyVkGroup, verifyVkToken } from "@/lib/vk";
import { validateBlueprintForPersistence } from "@/lib/blueprint-schema";
import {
  cleanVisibleContentText,
  isSensitiveContent,
  validateContentDraftForPersistence,
} from "@/lib/content-draft-schema";
import { CreativeAssetBriefSchema, stripCarouselSlideLabel } from "@/lib/creative-asset-schema";
import { normalizeMonthlyPlanDates, parseExactPlanDate } from "@/lib/monthly-plan-dates";
import { validateMonthlyPlanForBlueprint } from "@/lib/monthly-plan-schema";
import { MonthlyPlanRevisionProposalSchema } from "@/lib/monthly-plan-revision-schema";
import {
  enforceCadenceOnPlannedItems,
  enforceProductionScope,
  buildProductionScope,
  normalizeScopeToken,
  parseCadenceLimits,
  productionScopeFromFormData,
  type MonthlyProductionScope,
} from "@/lib/production-scope";
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
import { storeGeoReportFile } from "@/lib/geo-storage";
import { extractGeoAudit, type GeoAuditExtraction } from "@/lib/geo-pptx-extract";
import { getClientBrandContext, getClientVisualBranding } from "@/lib/brand-context";
import { runArticlePipeline, runArticleForPlannedItem } from "@/lib/article-engine";
import { hasSelfServicePaidAccess } from "@/lib/self-service/subscription";
import {
  contentOrderFormatIds,
  parseSelfServiceContentOrderConfiguration,
  type SelfServiceContentOrderConfiguration,
} from "@/lib/self-service/content-orders";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function formInt(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(/\s/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

type WorkspaceView = "overview" | "clients" | "client_setup" | "approvals" | "calendar" | "drafts" | "assets" | "brand_assets" | "client_portal" | "articles" | "geo" | "reports" | "settings";

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
    productionRunId?: string;
    articleId?: string;
    brandField?: string;
    geoAuditId?: string;
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
  if (options.productionRunId) searchParams.set("productionRunId", options.productionRunId);
  if (options.articleId) searchParams.set("article", options.articleId);
  if (options.brandField) searchParams.set("brandField", options.brandField);
  if (options.geoAuditId) searchParams.set("audit", options.geoAuditId);

  return `/manager?${searchParams.toString()}`;
}

function jsonInput(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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

function carouselSlideCountFromText(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  const carouselMentioned = [
    "карус",
    "carousel",
    "multi-slide",
    "multi slide",
    "карточ",
    "серия карточек",
    "слайд",
  ].some((token) => text.includes(token));

  if (!carouselMentioned) return 1;

  const numericMatch = text.match(/(?:^|\D)([2-8])(?:\s+[a-zа-яё-]+){0,3}\s+(?:карточ|слайд|slide|card)/i);
  if (numericMatch?.[1]) return Number(numericMatch[1]);

  const wordCounts: Array<[string, number]> = [
    ["две", 2],
    ["три", 3],
    ["четыр", 4],
    ["пять", 5],
    ["шесть", 6],
    ["two", 2],
    ["three", 3],
    ["four", 4],
    ["five", 5],
    ["six", 6],
  ];
  const wordMatch = wordCounts.find(([word]) => text.includes(word));

  return wordMatch?.[1] ?? 4;
}

function isCarouselCreativeBrief(
  brief: { assetType: string; title: string; brief: string; formatRequirements: string; textOnAsset: string; notes: string },
  context: { format: string; topic: string },
) {
  return carouselSlideCountFromText(
    brief.assetType,
    brief.title,
    brief.brief,
    brief.formatRequirements,
    brief.textOnAsset,
    brief.notes,
    context.format,
    context.topic,
  ) > 1;
}

function creativeAssetCreateInputsFromBrief(
  publication: {
    clientId: string;
    blueprintId: string;
    monthlyPlanId: string;
    plannedContentItemId: string;
    contentDraftId: string;
    id: string;
    format: string;
    topic: string;
  },
  brief: {
    assetType: string;
    title: string;
    brief: string;
    formatRequirements: string;
    textOnAsset: string;
    references: string;
    approvalRequired: boolean;
    notes: string;
  },
  options: {
    status?: CreativeAssetStatus;
    source?: "ai" | "manual";
  } = {},
) {
  const slideCount = carouselSlideCountFromText(
    brief.assetType,
    brief.title,
    brief.brief,
    brief.formatRequirements,
    brief.textOnAsset,
    publication.format,
    publication.topic,
  );

  const base = {
    clientId: publication.clientId,
    blueprintId: publication.blueprintId,
    monthlyPlanId: publication.monthlyPlanId,
    plannedContentItemId: publication.plannedContentItemId,
    contentDraftId: publication.contentDraftId,
    scheduledPublicationId: publication.id,
    status: options.status ?? "brief_ready",
    source: options.source ?? "ai",
    approvalRequired: brief.approvalRequired,
  };

  if (slideCount <= 1 || !isCarouselCreativeBrief(brief, publication)) {
    return [{
      ...base,
      assetType: brief.assetType,
      title: brief.title,
      brief: brief.brief,
      formatRequirements: brief.formatRequirements,
      textOnAsset: brief.textOnAsset || null,
      references: brief.references,
      notes: brief.notes,
    }];
  }

  return Array.from({ length: slideCount }, (_, index) => {
    const slideNumber = index + 1;

    return {
      ...base,
      assetType: "carousel_slide",
      title: `Карточка ${slideNumber} / ${slideCount}: ${brief.title}`,
      brief: [
        `Это отдельная карточка ${slideNumber} из ${slideCount} для карусели.`,
        "Сгенерируй только эту карточку, не весь набор и не коллаж.",
        brief.brief,
      ].join("\n"),
      formatRequirements: `${brief.formatRequirements}\nКарусель: отдельная карточка ${slideNumber}/${slideCount}. Не объединять карточки в один визуал. Номер карточки — служебная метадата: не наносить его на визуал и не добавлять в текст.`,
      // Slide index is service metadata — the visible text carries only real content.
      textOnAsset: stripCarouselSlideLabel(brief.textOnAsset) || null,
      references: brief.references,
      notes: `${brief.notes}\nslideNumber=${slideNumber}; slideCount=${slideCount}`,
    };
  });
}

function isLegacyCombinedCarouselAsset(asset: { notes: string | null }) {
  return Boolean(asset.notes?.includes("legacyCombinedCarouselAsset=true"));
}

function carouselSlideCreateInputsFromAsset(asset: {
  clientId: string;
  blueprintId: string;
  monthlyPlanId: string;
  plannedContentItemId: string;
  contentDraftId: string;
  scheduledPublicationId: string;
  assetType: string;
  title: string;
  brief: string;
  formatRequirements: string | null;
  textOnAsset: string | null;
  references: string | null;
  status: string;
  source: string;
  approvalRequired: boolean;
  notes: string | null;
  scheduledPublication: {
    id: string;
    clientId: string;
    blueprintId: string;
    monthlyPlanId: string;
    plannedContentItemId: string;
    contentDraftId: string;
    format: string;
    topic: string;
  };
}) {
  return creativeAssetCreateInputsFromBrief(
    {
      clientId: asset.clientId,
      blueprintId: asset.blueprintId,
      monthlyPlanId: asset.monthlyPlanId,
      plannedContentItemId: asset.plannedContentItemId,
      contentDraftId: asset.contentDraftId,
      id: asset.scheduledPublicationId,
      format: asset.scheduledPublication.format,
      topic: asset.scheduledPublication.topic,
    },
    {
      assetType: asset.assetType,
      title: asset.title,
      brief: asset.brief,
      formatRequirements: asset.formatRequirements ?? "",
      textOnAsset: asset.textOnAsset ?? "",
      references: asset.references ?? "",
      approvalRequired: asset.approvalRequired,
      notes: asset.notes ?? "",
    },
    {
      status: creativeAssetStatuses.includes(asset.status as CreativeAssetStatus) ? asset.status as CreativeAssetStatus : "brief_ready",
      source: asset.source === "manual" ? "manual" : "ai",
    },
  ).filter((input) => input.assetType === "carousel_slide");
}

async function splitCreativeAssetIntoCarouselSlides(creativeAssetId: string) {
  const asset = await prisma.creativeAsset.findUnique({
    where: { id: creativeAssetId },
    include: {
      scheduledPublication: true,
      generatedVariants: {
        select: { id: true },
      },
    },
  });

  if (!asset) {
    return {
      status: "failed" as const,
      message: "Креативный материал не найден.",
      createdSlideAssetIds: [],
    };
  }

  if (asset.assetType === "carousel_slide") {
    return {
      status: "skipped" as const,
      message: "Это уже отдельная карточка карусели.",
      createdSlideAssetIds: [],
      blueprintId: asset.blueprintId,
      monthlyPlanId: asset.monthlyPlanId,
      plannedContentItemId: asset.plannedContentItemId,
    };
  }

  const existingSlides = await prisma.creativeAsset.findMany({
    where: {
      scheduledPublicationId: asset.scheduledPublicationId,
      plannedContentItemId: asset.plannedContentItemId,
      assetType: "carousel_slide",
    },
    select: {
      id: true,
    },
  });

  if (existingSlides.length > 0) {
    return {
      status: "skipped" as const,
      message: `Карусель уже пересобрана: ${existingSlides.length} карточки.`,
      createdSlideAssetIds: [],
      blueprintId: asset.blueprintId,
      monthlyPlanId: asset.monthlyPlanId,
      plannedContentItemId: asset.plannedContentItemId,
    };
  }

  const slideInputs = carouselSlideCreateInputsFromAsset(asset);

  if (slideInputs.length <= 1) {
    return {
      status: "failed" as const,
      message: "В этом ТЗ не найдено требование к нескольким карточкам.",
      createdSlideAssetIds: [],
      blueprintId: asset.blueprintId,
      monthlyPlanId: asset.monthlyPlanId,
      plannedContentItemId: asset.plannedContentItemId,
    };
  }

  const createdSlideAssetIds = await prisma.$transaction(async (transaction) => {
    const ids: string[] = [];

    for (const slideInput of slideInputs) {
      const slide = await transaction.creativeAsset.create({ data: slideInput });
      ids.push(slide.id);
    }

    await transaction.creativeAsset.update({
      where: { id: asset.id },
      data: {
        status: "rejected",
        notes: [
          asset.notes,
          `legacyCombinedCarouselAsset=true; replacedByCarouselSlidesAt=${new Date().toISOString()}; slideCount=${slideInputs.length}`,
        ].filter(Boolean).join("\n"),
      },
    });

    return ids;
  });

  return {
    status: "created" as const,
    message: `Карусель пересобрана: создано ${slideInputs.length} отдельных карточек.`,
    createdSlideAssetIds,
    blueprintId: asset.blueprintId,
    monthlyPlanId: asset.monthlyPlanId,
    plannedContentItemId: asset.plannedContentItemId,
  };
}

function creativeAssetNeedsCarouselSplit(asset: {
  assetType: string;
  title: string;
  brief: string;
  formatRequirements: string | null;
  textOnAsset: string | null;
  notes: string | null;
  scheduledPublication: {
    format: string;
    topic: string;
  };
}) {
  if (asset.assetType === "carousel_slide" || isLegacyCombinedCarouselAsset(asset)) return false;

  return carouselSlideCountFromText(
    asset.assetType,
    asset.title,
    asset.brief,
    asset.formatRequirements,
    asset.textOnAsset,
    asset.notes,
    asset.scheduledPublication.format,
    asset.scheduledPublication.topic,
  ) > 1;
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

const AUTOPUBLISH_SETTING_KEY = "autopublish_on_client_approval";

/**
 * Auto-publish after client approval: only when the manager enabled the toggle
 * AND the draft is autopublish-eligible (risk gates from generation stay in force).
 * Returns a replacement notice, or null when nothing was published.
 */
async function maybeAutopublishAfterApproval(contentDraftId: string): Promise<string | null> {
  try {
    const enabled = (await getIntegrationSetting(AUTOPUBLISH_SETTING_KEY)) === "true";
    if (!enabled) return null;

    const draft = await prisma.contentDraft.findUnique({
      where: { id: contentDraftId },
      select: {
        autopublishEligible: true,
        scheduledPublications: { select: { id: true }, take: 1 },
      },
    });

    if (!draft?.autopublishEligible) return null;
    const publicationId = draft.scheduledPublications[0]?.id;
    if (!publicationId) return null;

    const outcome = await publishScheduledPublication(publicationId);
    if (outcome.ok) {
      const platforms = outcome.results.filter((r) => r.ok).map((r) => (r.platform === "vk" ? "VK" : "Telegram"));
      return `Материал согласован и опубликован: ${platforms.join(" + ")}.`;
    }
    return "Материал согласован. Автопубликация не удалась — команда опубликует вручную.";
  } catch {
    return null;
  }
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

  let notice = update.notice;
  if (update.status === "approved") {
    notice = (await maybeAutopublishAfterApproval(draft.id)) ?? update.notice;
  }

  revalidatePath("/");
  revalidatePath(portalLocation(token));
  redirect(portalLocation(token, { notice }));
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

async function nextTestClientName(baseName: string) {
  const testBase = `${baseName} · test`;
  const existing = await prisma.client.findMany({
    where: {
      name: {
        startsWith: testBase,
      },
    },
    select: { name: true },
  });
  const names = new Set(existing.map((client) => client.name));
  if (!names.has(testBase)) return testBase;

  let index = 2;
  while (names.has(`${testBase} ${index}`)) index += 1;
  return `${testBase} ${index}`;
}

export async function duplicateClientForTesting(formData: FormData) {
  const clientId = formText(formData, "clientId");
  if (!clientId) errorRedirect("Выберите клиента для тестовой копии.", "clients");

  const source = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      briefs: {
        orderBy: { createdAt: "desc" },
        include: {
          blueprint: {
            include: {
              selectedModules: true,
              platformRecommendations: true,
              automationPlans: true,
              riskRules: true,
            },
          },
        },
      },
      brandProfile: true,
      brandAssets: {
        where: { status: { not: "archived" } },
      },
      monthlyPlans: {
        orderBy: { createdAt: "desc" },
        select: { rawPlanJson: true },
      },
    },
  });

  if (!source) errorRedirect("Клиент для копирования не найден.", "clients");

  const latestBrief = source.briefs[0];
  const sourceBlueprint = latestBrief?.blueprint;
  const copiedProductionScope = source.monthlyPlans
    .map((plan) => productionScopeFromRawPlanJson(plan.rawPlanJson))
    .find((scope): scope is MonthlyProductionScope => Boolean(scope));
  const testName = await nextTestClientName(source.name);

  const created = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: testName,
        website: source.website,
        industry: source.industry,
      },
    });

    let brief = null;
    if (latestBrief) {
      brief = await tx.clientBrief.create({
        data: {
          clientId: client.id,
          rawBrief: latestBrief.rawBrief,
        },
      });
    }

    if (brief && sourceBlueprint) {
      await tx.clientPresenceBlueprint.create({
        data: {
          clientId: client.id,
          briefId: brief.id,
          clientSummary: sourceBlueprint.clientSummary,
          businessGoals: jsonInput(sourceBlueprint.businessGoals),
          missingBriefFields: jsonInput(sourceBlueprint.missingBriefFields),
          assumptions: jsonInput(sourceBlueprint.assumptions),
          confidenceScore: sourceBlueprint.confidenceScore,
          nextRecommendedAction: sourceBlueprint.nextRecommendedAction,
          notRecommendedPlatforms: jsonInput(sourceBlueprint.notRecommendedPlatforms),
          recommendedMonthlyContentScope: jsonInput(sourceBlueprint.recommendedMonthlyContentScope),
          totalContentUnitsMin: sourceBlueprint.totalContentUnitsMin,
          totalContentUnitsMax: sourceBlueprint.totalContentUnitsMax,
          publishingFrequency: jsonInput(sourceBlueprint.publishingFrequency),
          integrationRequirements: jsonInput(sourceBlueprint.integrationRequirements),
          humanReviewPolicy: jsonInput(sourceBlueprint.humanReviewPolicy),
          approvalMode: sourceBlueprint.approvalMode,
          managerAttentionLevel: sourceBlueprint.managerAttentionLevel,
          rawBlueprintJson: jsonInput(copiedProductionScope
            ? { ...jsonObject(sourceBlueprint.rawBlueprintJson), productionScope: copiedProductionScope }
            : sourceBlueprint.rawBlueprintJson),
          selectedModules: {
            create: sourceBlueprint.selectedModules.map((module) => ({
              moduleType: module.moduleType,
              name: module.name,
              purpose: module.purpose,
              rationale: module.rationale,
              priority: module.priority,
              monthlyContentScope: jsonInput(module.monthlyContentScope),
            })),
          },
          platformRecommendations: {
            create: sourceBlueprint.platformRecommendations.map((platform) => ({
              platformName: platform.platformName,
              platformType: platform.platformType,
              recommendation: platform.recommendation,
              priority: platform.priority,
              automationStatus: platform.automationStatus,
              requiredCredentials: jsonInput(platform.requiredCredentials),
              permissionsNeeded: jsonInput(platform.permissionsNeeded),
              contentFormats: jsonInput(platform.contentFormats),
              rationale: platform.rationale,
              contentRole: platform.contentRole,
              suggestedFrequency: platform.suggestedFrequency,
              automationOpportunity: platform.automationOpportunity,
            })),
          },
          automationPlans: {
            create: sourceBlueprint.automationPlans.map((plan) => ({
              name: plan.name,
              trigger: plan.trigger,
              action: plan.action,
              humanCheckpoint: plan.humanCheckpoint,
              toolCategory: plan.toolCategory,
              priority: plan.priority,
            })),
          },
          riskRules: {
            create: sourceBlueprint.riskRules.map((rule) => ({
              ruleName: rule.ruleName,
              riskDescription: rule.riskDescription,
              preventionAction: rule.preventionAction,
              severity: rule.severity,
              approvalRequired: rule.approvalRequired,
            })),
          },
        },
      });
    }

    if (source.brandProfile) {
      await tx.clientBrandProfile.create({
        data: {
          clientId: client.id,
          toneOfVoice: source.brandProfile.toneOfVoice,
          keyMessages: source.brandProfile.keyMessages,
          targetAudienceNotes: source.brandProfile.targetAudienceNotes,
          brandColors: source.brandProfile.brandColors,
          fonts: source.brandProfile.fonts,
          visualStyle: source.brandProfile.visualStyle,
          forbiddenTopics: source.brandProfile.forbiddenTopics,
          requiredDisclaimers: source.brandProfile.requiredDisclaimers,
          legalNotes: source.brandProfile.legalNotes,
          productServiceNotes: source.brandProfile.productServiceNotes,
        },
      });
    }

    if (source.brandAssets.length > 0) {
      await tx.clientBrandAsset.createMany({
        data: source.brandAssets.map((asset) => ({
          clientId: client.id,
          assetType: asset.assetType,
          title: asset.title,
          description: asset.description,
          fileUrl: asset.fileUrl,
          storageKey: asset.storageKey,
          storageProvider: asset.storageProvider,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          textContent: asset.textContent,
          sourceUrl: asset.sourceUrl,
          status: asset.status,
        })),
      });
    }

    return client;
  });

  const copiedBlueprint = await prisma.clientPresenceBlueprint.findFirst({
    where: { clientId: created.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", {
    clientId: created.id,
    blueprintId: copiedBlueprint?.id,
    setupStep: copiedBlueprint ? "monthly_plan" : latestBrief ? "blueprint" : "brief",
    notice: "Тестовая копия клиента создана.",
  }));
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

const brandWizardFields = [
  "toneOfVoice",
  "targetAudienceNotes",
  "keyMessages",
  "brandColors",
  "fonts",
  "visualStyle",
  "productServiceNotes",
  "forbiddenTopics",
  "requiredDisclaimers",
  "legalNotes",
] as const;

/**
 * Onboarding brand wizard: saves ONE ClientBrandProfile field per submit and
 * moves to the next block, staying inside the guided wizard. Idempotent upsert;
 * other fields are never touched, so the profile can be edited later as usual.
 */
export async function saveBrandWizardField(formData: FormData) {
  const clientId = formText(formData, "clientId");
  const field = formText(formData, "field");
  const value = formText(formData, "value");
  const nextField = formText(formData, "nextField");
  const blueprintId = formText(formData, "blueprintId") || undefined;
  const planId = formText(formData, "planId") || undefined;

  if (!clientId) {
    errorRedirect("Клиент не выбран.", "client_setup");
  }
  if (!brandWizardFields.includes(field as (typeof brandWizardFields)[number])) {
    errorRedirect("Неизвестное поле бренда.", "client_setup");
  }

  await prisma.clientBrandProfile.upsert({
    where: { clientId },
    create: { clientId, [field]: value || null },
    update: { [field]: value || null },
  });

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", {
    clientId,
    blueprintId,
    planId,
    setupStep: "brand",
    brandField: nextField || undefined,
  }));
}

export async function createClientBrandAsset(formData: FormData) {
  const clientId = formText(formData, "clientId");
  const assetType = formText(formData, "assetType");
  const title = formText(formData, "title");
  const file = formData.get("file");
  // The onboarding wizard uploads the logo in place — keep the manager inside it.
  const fromWizard = formText(formData, "returnTo") === "wizard";
  const wizardBlueprintId = formText(formData, "blueprintId") || undefined;
  const wizardPlanId = formText(formData, "planId") || undefined;
  const assetOutcome = (outcome: { notice?: string; error?: string }) =>
    fromWizard
      ? workspaceLocation("client_setup", {
          clientId,
          blueprintId: wizardBlueprintId,
          planId: wizardPlanId,
          setupStep: "brand",
          brandField: "assets",
          ...outcome,
        })
      : workspaceLocation("brand_assets", { clientId, brandStep: "materials", ...outcome });

  if (!clientId || !assetType || !title) errorRedirect("Укажите клиента, тип и название материала.", "brand_assets");

  const hasFile = file instanceof File && file.size > 0;

  if (hasFile && file.size > MAX_BRAND_ASSET_FILE_SIZE) {
    redirect(assetOutcome({ error: "Файл слишком большой. Максимальный размер для MVP — 20 МБ." }));
  }

  if (hasFile && !supportedBrandAssetMimeTypes.has(file.type)) {
    redirect(assetOutcome({ error: "Этот формат пока не поддерживается. Загрузите PDF, PNG, JPG или WEBP." }));
  }

  let uploaded: Awaited<ReturnType<typeof storeClientBrandAssetFile>> = null;

  if (hasFile) {
    try {
      uploaded = await storeClientBrandAssetFile({ file, clientId, assetType });
    } catch (error) {
      console.error("Brand asset upload failed", error);
      redirect(assetOutcome({ error: "Не удалось загрузить файл. Попробуйте ещё раз или добавьте материал без файла." }));
    }
  }

  if (hasFile && !uploaded) {
    redirect(assetOutcome({ error: "Для загрузки файла подключите Vercel Blob. Пока можно добавить ссылку или текстовое описание." }));
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
  redirect(assetOutcome({ notice: "Материал бренда добавлен." }));
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

async function ensureBlueprintForBrief(briefId: string) {
  const brief = await prisma.clientBrief.findUnique({
    where: { id: briefId },
    include: { client: true, blueprint: true },
  });

  if (!brief) {
    throw new Error("Бриф не найден.");
  }

  if (brief.blueprint) {
    return { blueprintId: brief.blueprint.id, clientId: brief.clientId, created: false };
  }

  const generated = await generateClientPresenceBlueprint({
    clientName: brief.client.name,
    website: brief.client.website,
    industry: brief.client.industry,
    rawBrief: brief.rawBrief,
    brandContext: await getClientBrandContext(brief.clientId),
  });

  const blueprint = validateBlueprintForPersistence(generated);

  try {
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

    return { blueprintId: created.id, clientId: brief.clientId, created: true };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      const existing = await prisma.clientPresenceBlueprint.findUnique({
        where: { briefId: brief.id },
        select: { id: true },
      });
      if (existing) return { blueprintId: existing.id, clientId: brief.clientId, created: false };
    }
    throw error;
  }
}

export async function generateBlueprint(formData: FormData) {
  const briefId = formText(formData, "briefId");
  let result: Awaited<ReturnType<typeof ensureBlueprintForBrief>>;

  try {
    result = await ensureBlueprintForBrief(briefId);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "OpenAI не смог обработать бриф. Проверьте данные и попробуйте ещё раз.";
    errorRedirect(`Не удалось сгенерировать Blueprint: ${message}`);
  }

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", {
    blueprintId: result.blueprintId,
    clientId: result.clientId,
    setupStep: "monthly_plan",
    notice: result.created ? "Blueprint сгенерирован. Следующий шаг — месячный план." : undefined,
  }));
}

const ARTICLE_ITEM_PLATFORM_NAME = "Сайт / Блог";

function isTelegramPlatformName(name: string) {
  return /telegram|телег/i.test(name);
}

function isVkPlatformName(name: string) {
  return /(\bvk\b|vkontakte|вконтакте|(^|\s)вк(\s|$))/i.test(name);
}

type PairablePlanItem = {
  moduleType: string;
  platformName: string;
  format: string;
  topic: string;
  goal: string;
  plannedDate: string;
  week?: string | null;
  campaignTheme?: string | null;
  contentPillar?: string | null;
  channelRole?: string | null;
  sequenceReason?: string | null;
  approvalRequired: boolean;
  autopublishEligible: boolean;
  requiredInputs?: unknown;
  status: string;
};

/**
 * One content idea → a VK+Telegram pair: same topic and date, platform-native
 * formats, shared pairGroupId. Items already covered on both platforms are
 * linked instead of duplicated. Non-VK/TG items pass through untouched.
 */
function pairVkTgPlanItems<T extends PairablePlanItem>(
  items: T[],
  allowedPlatformNames: string[],
): Array<T & { pairGroupId: string | null }> {
  const tgPlatform = allowedPlatformNames.find(isTelegramPlatformName);
  const vkPlatform = allowedPlatformNames.find(isVkPlatformName);

  if (!tgPlatform || !vkPlatform) {
    return items.map((item) => ({ ...item, pairGroupId: null }));
  }

  const topicKey = (topic: string) => topic.trim().toLowerCase().replace(/\s+/g, " ");
  const result: Array<T & { pairGroupId: string | null }> = [];
  const used = new Set<number>();

  items.forEach((item, index) => {
    if (used.has(index)) return;

    const itemIsTg = isTelegramPlatformName(item.platformName);
    const itemIsVk = !itemIsTg && isVkPlatformName(item.platformName);

    // Articles are a standalone deliverable — never duplicated across VK+TG.
    if ((!itemIsTg && !itemIsVk) || isArticleLikePlanItem(item)) {
      result.push({ ...item, pairGroupId: null });
      return;
    }

    const counterpartIndex = items.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        !used.has(candidateIndex) &&
        !isArticleLikePlanItem(candidate) &&
        topicKey(candidate.topic) === topicKey(item.topic) &&
        (itemIsTg ? isVkPlatformName(candidate.platformName) : isTelegramPlatformName(candidate.platformName)),
    );

    const pairGroupId = crypto.randomUUID();
    used.add(index);

    if (counterpartIndex >= 0) {
      used.add(counterpartIndex);
      const counterpart = items[counterpartIndex];
      result.push(
        { ...item, pairGroupId },
        { ...counterpart, plannedDate: item.plannedDate, pairGroupId },
      );
      return;
    }

    const cloneIsTg = itemIsVk;
    result.push(
      { ...item, pairGroupId },
      {
        ...item,
        platformName: cloneIsTg ? tgPlatform : vkPlatform,
        format: cloneIsTg
          ? "пост Telegram (короткий, с разметкой)"
          : "пост VK (расширенный текст, хэштеги)",
        sequenceReason: "Парная публикация VK+Telegram: одна идея, две площадки.",
        pairGroupId,
      },
    );
  });

  return result;
}

function exactSelfServiceContentMix<T extends PairablePlanItem>(
  sourceItems: T[],
  configuration: SelfServiceContentOrderConfiguration,
  allowedPlatformNames: string[],
  month: string,
  strategicThemes: string[],
): Array<T & { pairGroupId: string | null }> {
  const vk = allowedPlatformNames.find(isVkPlatformName);
  const telegram = allowedPlatformNames.find(isTelegramPlatformName);
  const ok = allowedPlatformNames.find((name) => /однокласс|ok\.ru|(^|\s)ок(\s|$)/i.test(name));
  const dzen = allowedPlatformNames.find((name) => /дзен|dzen/i.test(name));
  const vcru = allowedPlatformNames.find((name) => /vc\.ru|виси/i.test(name));
  const targets = [
    { count: configuration.vkPosts, platform: vk, format: "пост VK с визуалом", label: "Пост VK", goal: "Регулярное присутствие и вовлечение аудитории" },
    { count: configuration.telegramPosts, platform: telegram, format: "пост Telegram с визуалом", label: "Пост Telegram", goal: "Нативное общение с аудиторией канала" },
    { count: configuration.okPosts, platform: ok, format: "пост Одноклассники с визуалом", label: "Пост Одноклассники", goal: "Понятное и доверительное общение с аудиторией Одноклассников" },
    { count: configuration.dzenArticles, platform: dzen, format: "экспертная статья Дзен с обложкой", label: "Статья Дзен", goal: "Экспертность и органический охват" },
    { count: configuration.vcruArticles, platform: vcru, format: "деловая статья VC.ru с обложкой", label: "Статья VC.ru", goal: "Экспертность и доверие деловой аудитории" },
    { count: configuration.carousels, platform: configuration.carouselPlatform === "both" && vk && telegram ? "VK + Telegram" : configuration.carouselPlatform === "telegram" ? (telegram ?? vk) : (vk ?? telegram), format: "карусель из 4 отдельных слайдов", label: "Карусель", goal: "Наглядно раскрыть тему в четырёх карточках" },
    { count: configuration.quickAnnouncements, platform: telegram ?? vk, format: "короткий анонс", label: "Анонс", goal: "Быстро сообщить важную новость или предложение" },
    { count: configuration.reviewReplies, platform: telegram ?? vk, format: "ответ на отзыв", label: "Ответ на отзыв", goal: "Подготовить корректный ответ в тоне бренда" },
  ].filter((target) => target.count > 0 && target.platform);

  const requestedTotal = targets.reduce((sum, target) => sum + target.count, 0);
  if (requestedTotal === 0) return [];
  const monthMatch = month.match(/^(\d{4})-(\d{2})$/);
  const daysInMonth = monthMatch
    ? new Date(Number(monthMatch[1]), Number(monthMatch[2]), 0).getDate()
    : 28;
  const weekdays = Array.from({ length: daysInMonth }, (_, index) => index + 1).filter((day) => {
    if (!monthMatch) return true;
    const weekday = new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, day).getDay();
    return weekday !== 0 && weekday !== 6;
  });
  const candidateDays = requestedTotal <= weekdays.length ? weekdays : Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const scheduledTargets = Array.from({ length: Math.max(...targets.map((target) => target.count)) }, (_, round) =>
    targets.flatMap((target) => round < target.count ? [{ target, targetIndex: round }] : []),
  ).flat();

  return scheduledTargets.map(({ target, targetIndex }, globalIndex) => {
    const samePlatform = sourceItems.filter((item) => item.platformName === target.platform);
    const base = samePlatform[targetIndex % Math.max(1, samePlatform.length)] ?? sourceItems[globalIndex % sourceItems.length];
    if (!base) throw new Error("Не удалось подготовить темы для выбранного набора.");
    const candidateIndex = Math.min(candidateDays.length - 1, Math.floor(((globalIndex + 0.5) * candidateDays.length) / requestedTotal));
    const day = candidateDays[candidateIndex];
    const theme = strategicThemes[targetIndex % Math.max(1, strategicThemes.length)];
    const useSourceTopic = targetIndex < samePlatform.length;
    return {
      ...base,
      moduleType: /статья/i.test(target.format) ? "expert_articles" : "content_production",
      platformName: target.platform!,
      format: target.format,
      topic: useSourceTopic ? base.topic : `${target.label} №${targetIndex + 1}${theme ? `: ${theme}` : ""}`,
      goal: target.goal,
      plannedDate: `${month}-${String(day).padStart(2, "0")}`,
      week: `Неделя ${Math.min(5, Math.floor((day - 1) / 7) + 1)}`,
      sequenceReason: `Материал входит в подтверждённый пользователем набор: ${target.label}. Площадки чередуются, а даты распределены по рабочим дням месяца.`,
      approvalRequired: true,
      autopublishEligible: !/статья|отзыв/i.test(target.format),
      pairGroupId: null,
      status: "planned",
    };
  });
}

/**
 * Detects article deliverables the plan model produced on its own (Дзен/blog
 * items with an article format). They must go through the full article engine,
 * not the lightweight post-text generator.
 */
function isArticleLikePlanItem(item: { moduleType?: string | null; format: string; topic: string }) {
  const formatText = `${item.moduleType ?? ""} ${item.format}`.toLowerCase();
  if (/статья|статьи|статей|статью|article|лонгрид|long-?read/.test(formatText)) return true;
  return /^экспертная статья/i.test(item.topic.trim());
}

function resolveArticlesPerMonth(formData: FormData) {
  const fromForm = formInt(formData, "articlesPerMonth");
  if (fromForm !== null) return Math.min(10, fromForm);
  const fromEnv = Number(process.env.ARTICLES_PER_MONTH ?? "");
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return Math.min(10, Math.round(fromEnv));
  return 4;
}

function articleItemInputs(input: {
  month: string;
  count: number;
  themes: string[];
}): Array<{
  moduleType: string;
  platformName: string;
  format: string;
  topic: string;
  goal: string;
  plannedDate: string;
  deliverableKind: string;
  approvalRequired: boolean;
  autopublishEligible: boolean;
  status: string;
}> {
  if (input.count <= 0) return [];

  const match = input.month.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : new Date().getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const themes = input.themes.map((theme) => theme.trim()).filter(Boolean);

  return Array.from({ length: input.count }, (_, index) => {
    const day = Math.min(daysInMonth, Math.max(1, Math.round((daysInMonth * (index + 1)) / (input.count + 1))));
    const theme = themes[index % Math.max(1, themes.length)];
    return {
      moduleType: "expert_articles",
      platformName: ARTICLE_ITEM_PLATFORM_NAME,
      format: "экспертная статья",
      topic: theme ? `Экспертная статья: ${theme}` : `Экспертная статья месяца №${index + 1}`,
      goal: "GEO: закрепить экспертность бренда в ответах нейросетей и поисковой выдаче",
      plannedDate: `${input.month}-${String(day).padStart(2, "0")}`,
      deliverableKind: "article",
      approvalRequired: true,
      autopublishEligible: false,
      status: "planned",
    };
  });
}

async function ensureArticleItemsForPlan(monthlyPlanId: string, requestedCount: number) {
  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    select: {
      id: true,
      month: true,
      totalPlannedUnits: true,
      rawPlanJson: true,
      plannedContentItems: {
        select: {
          id: true,
          deliverableKind: true,
          moduleType: true,
          format: true,
          topic: true,
          campaignTheme: true,
          contentPillar: true,
        },
      },
    },
  });

  if (!plan) return 0;

  // Normalize article-like items the plan model produced itself: they must be
  // driven by the article engine, not the post-text generator. Idempotent.
  const itemsToNormalize = plan.plannedContentItems.filter(
    (item) => item.deliverableKind !== "article" && isArticleLikePlanItem(item),
  );
  if (itemsToNormalize.length > 0) {
    await prisma.plannedContentItem.updateMany({
      where: { id: { in: itemsToNormalize.map((item) => item.id) } },
      data: { deliverableKind: "article", pairGroupId: null },
    });
  }

  const scope = productionScopeFromRawPlanJson(plan.rawPlanJson);
  // Cadence rule «статьи N в месяц» wins over the form/env default.
  const cadenceArticles = scope ? parseCadenceLimits(scope.cadenceRules).articlesPerMonth : null;
  const effectiveCount = cadenceArticles ?? requestedCount;

  const existingArticles =
    plan.plannedContentItems.filter((item) => item.deliverableKind === "article").length + itemsToNormalize.length;
  const missing = Math.max(0, effectiveCount - existingArticles);
  if (missing === 0) return 0;

  const themes = Array.from(
    new Set([
      ...(scope?.strategicThemes ?? []),
      ...plan.plannedContentItems.map((item) => item.campaignTheme ?? ""),
      ...plan.plannedContentItems.map((item) => item.contentPillar ?? ""),
    ].map((theme) => theme.trim()).filter(Boolean)),
  );

  const inputs = articleItemInputs({ month: plan.month, count: missing, themes });

  await prisma.plannedContentItem.createMany({
    data: inputs.map((item) => ({ ...item, monthlyPlanId: plan.id })),
  });
  await prisma.monthlyOperatingPlan.update({
    where: { id: plan.id },
    data: { totalPlannedUnits: plan.totalPlannedUnits + missing },
  });

  return missing;
}

async function createMonthlyPlanForBlueprint(
  blueprintId: string,
  formData: FormData,
  options: {
    forceNewVersion?: boolean;
    prepareTextsAfterCreate?: boolean;
    productionScopeOverride?: MonthlyProductionScope;
    throwOnError?: boolean;
    exactContentMix?: SelfServiceContentOrderConfiguration;
  } = {},
) {
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

  // nextRecommendedAction === "request_more_brief_data" is the strategy's ADVICE
  // that the brief looks thin (and can be stale after a hung generation).
  // It must not hard-block the month: the UI shows a soft warning and the
  // manager decides — so no server-side rejection here.

  const month = currentMonth();
  const existingPlan = blueprint.monthlyPlans.find(
    (plan) => plan.month === month && !["archived", "replaced"].includes(plan.status),
  );

  if (existingPlan && !options.forceNewVersion) {
    return {
      blueprintId: blueprint.id,
      monthlyPlanId: existingPlan.id,
      clientId: blueprint.clientId,
      created: false,
      notice: "Месячный план за этот период уже существует.",
    };
  }

  const recommendedPlatforms = blueprint.platformRecommendations.filter(
    (platform) => platform.recommendation === "recommended",
  );
  const recommendedScope = jsonObject(blueprint.recommendedMonthlyContentScope) as {
    scopeByModule?: Array<{ unitType?: unknown }>;
  };
  const hasScopeInput = [
    "scopeAllowedPlatforms",
    "scopeAllowedDeliverables",
    "scopeForbiddenDeliverables",
    "scopeCadenceRules",
    "scopeStrategicThemes",
    "scopeReputationTasks",
  ].some((key) => Boolean(formText(formData, key)));
  const formProductionScope = productionScopeFromFormData(formData, {
      recommendedPlatforms,
      scopeByModule: Array.isArray(recommendedScope.scopeByModule) ? recommendedScope.scopeByModule : [],
    });
  const productionScope = options.productionScopeOverride ??
    (hasScopeInput ? formProductionScope : productionScopeFromRawPlanJson(blueprint.rawBlueprintJson) ?? formProductionScope);
  const allowedPlatformNames = recommendedPlatforms
    .map((platform) => platform.platformName)
    .filter((platformName) => productionScope.allowedPlatforms.length === 0 ||
      productionScope.allowedPlatforms.map(normalizeScopeToken).includes(normalizeScopeToken(platformName)));

  if (allowedPlatformNames.length === 0) {
    if (options.throwOnError) {
      throw new Error("Не удалось подобрать площадки для контент-набора. Обновите бриф и попробуйте ещё раз.");
    }
    blueprintErrorRedirect(blueprint.id, "Scope месяца не содержит ни одной разрешённой площадки из Blueprint.");
  }

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
    const nextVersion = options.forceNewVersion
      ? Math.max(0, ...blueprint.monthlyPlans.filter((plan) => plan.month === month).map((plan) => plan.version)) + 1
      : 1;

    if (options.forceNewVersion) {
      await prisma.monthlyOperatingPlan.updateMany({
        where: {
          blueprintId: blueprint.id,
          month,
          status: { notIn: ["archived", "replaced"] },
        },
        data: { status: "replaced" },
      });
    }

    const generated = await generateMonthlyOperatingPlan({
      clientName: blueprint.client.name,
      month,
      allowedPlatformNames,
      productionScope,
      blueprint: blueprintPayload,
      brandContext: await getClientBrandContext(blueprint.clientId),
    });

    const plan = validateMonthlyPlanForBlueprint(generated, {
      selectedModuleTypes: blueprint.selectedModules.map((module) => module.moduleType),
      recommendedPlatformNames: allowedPlatformNames,
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
    const scopeGuardrails = enforceProductionScope(plan, productionScope);
    normalizeMonthlyPlanDates(plan.plannedContentItems, plan.month);
    const pairedContentItems = options.exactContentMix
      ? exactSelfServiceContentMix(plan.plannedContentItems, options.exactContentMix, allowedPlatformNames, plan.month, productionScope.strategicThemes)
      : pairVkTgPlanItems(plan.plannedContentItems, allowedPlatformNames);
    const cadenceLimits = parseCadenceLimits(productionScope.cadenceRules);
    const cadenceResult = options.exactContentMix
      ? { kept: pairedContentItems, removedCount: 0 }
      : enforceCadenceOnPlannedItems(pairedContentItems, cadenceLimits);
    const finalContentItems = cadenceResult.kept;
    if (finalContentItems.length === 0) {
      throw new Error("Правила частоты из scope не оставили ни одного материала. Ослабьте «Частоту» и попробуйте снова.");
    }
    const totalPlannedUnitsWithPairs = finalContentItems.length;

    const created = await prisma.monthlyOperatingPlan.create({
      data: {
        clientId: blueprint.clientId,
        blueprintId: blueprint.id,
        month: plan.month,
        version: nextVersion,
        status: plan.status,
        summary: plan.summary,
        totalPlannedUnits: totalPlannedUnitsWithPairs,
        approvalStrategy: plan.approvalStrategy,
        autopublishStrategy: plan.autopublishStrategy,
        riskSummary: plan.riskSummary,
        rawPlanJson: {
          ...plan,
          productionScope,
          scopeGuardrails: {
            removedReasons: scopeGuardrails.removedReasons,
            cadenceTrimmedItems: cadenceResult.removedCount,
          },
        } as unknown as Prisma.InputJsonValue,
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
          create: finalContentItems.map((item) => ({
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
            pairGroupId: item.pairGroupId,
            // Model-planned articles go through the full article engine, not post texts.
            deliverableKind: isArticleLikePlanItem(item) ? "article" : "post",
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
    if (!options.exactContentMix) {
      await ensureArticleItemsForPlan(created.id, resolveArticlesPerMonth(formData));
    }
    // Channels the client decided to create from scratch get their Launch Kit tasks.
    await ensureLaunchKitTasksForPlan(created.id, blueprint.clientId).catch((error) => {
      console.error("Failed to ensure Launch Kit tasks", error);
    });
    if (options.prepareTextsAfterCreate !== false) {
      const textPreparation = await prepareMissingTextsForMonthlyPlan(created.id);
      textPreparationNotice = textPreparation.notice;
    }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      const existing = await prisma.monthlyOperatingPlan.findFirst({
        where: {
          blueprintId: blueprint.id,
          month,
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        return {
          blueprintId: blueprint.id,
          monthlyPlanId: existing.id,
          clientId: blueprint.clientId,
          created: false,
          notice: "Месячный план уже существует. Открыли текущий месяц.",
        };
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "Не удалось сгенерировать месячный план. Проверьте Blueprint и попробуйте ещё раз.";
    if (options.throwOnError) throw new Error(message);
    blueprintErrorRedirect(blueprint.id, `Не удалось сгенерировать месячный план: ${message}`);
  }

  return {
    blueprintId: blueprint.id,
    monthlyPlanId: createdId,
    clientId: blueprint.clientId,
    created: true,
    notice: `${options.forceNewVersion ? "Месяц пересобран." : "Месячный план сгенерирован."} ${textPreparationNotice || "Тексты будут подготовлены в Materials."}`,
  };
}

export async function generateMonthlyPlan(formData: FormData) {
  const blueprintId = formText(formData, "blueprintId");
  // Heavy work is split: this request only creates the plan; texts, briefs,
  // visuals and articles go to the production queue and run in background batches.
  const result = await createMonthlyPlanForBlueprint(blueprintId, formData, {
    prepareTextsAfterCreate: false,
  });

  if (result.created) {
    try {
      await createMonthProductionRun(result.monthlyPlanId);
    } catch (error) {
      // The plan is saved; the queue can always be (re)created from Materials.
      console.error("Failed to enqueue month production after plan creation", error);
    }
  }

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", {
    blueprintId: result.blueprintId,
    planId: result.monthlyPlanId,
    clientId: result.clientId,
    setupStep: "brand",
    notice: `${result.notice} Материалы месяца готовятся в фоне — прогресс виден на экране «Материалы». Теперь заполните библиотеку бренда.`,
  }));
}

const SELF_SERVICE_PLATFORM_SPECS = [
  { id: "vk_post", name: "VK", match: /(\bvk\b|vkontakte|вконтакте|(^|\s)вк(\s|$))/i, type: "social", formats: ["пост VK"] },
  { id: "telegram_post", name: "Telegram", match: /telegram|телег/i, type: "messenger", formats: ["пост Telegram"] },
  { id: "ok_post", name: "Одноклассники", match: /однокласс|ok\.ru|(^|\s)ок(\s|$)/i, type: "social", formats: ["пост Одноклассники"] },
  { id: "dzen_article", name: "Дзен", match: /дзен|dzen/i, type: "publishing", formats: ["статья Дзен"] },
  { id: "vcru_article", name: "VC.ru", match: /vc\.ru|виси/i, type: "publishing", formats: ["статья VC.ru"] },
] as const;

function selfServiceBriefSetting(rawBrief: string, label: string) {
  const line = rawBrief.split(/\r?\n/).find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line?.slice(line.indexOf(":") + 1).trim() ?? "";
}

function selfServiceFormatIds(rawBrief: string) {
  const selected = selfServiceBriefSetting(rawBrief, "Выбранные форматы")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const known = new Set(SELF_SERVICE_PLATFORM_SPECS.map((item) => item.id));
  const valid = selected.filter((item) => known.has(item as (typeof SELF_SERVICE_PLATFORM_SPECS)[number]["id"]));
  return valid.length > 0 ? valid : SELF_SERVICE_PLATFORM_SPECS.map((item) => item.id);
}

function selfServicePostFrequency(rawBrief: string) {
  return selfServiceBriefSetting(rawBrief, "Ритм постов") === "calm" ? 1 : 2;
}

function selfServiceArticleFrequency(rawBrief: string) {
  const value = selfServiceBriefSetting(rawBrief, "Ритм статей");
  if (value === "none") return 0;
  if (value === "one") return 1;
  return 2;
}

async function ensureSelfServicePlatformRecommendations(blueprintId: string, formatIds: string[]) {
  const recommendations = await prisma.platformRecommendation.findMany({ where: { blueprintId } });
  const selectedSpecs = SELF_SERVICE_PLATFORM_SPECS.filter((spec) => formatIds.includes(spec.id));

  for (const spec of selectedSpecs) {
    const existing = recommendations.find((item) => spec.match.test(item.platformName));
    if (existing) {
      if (existing.recommendation !== "recommended") {
        await prisma.platformRecommendation.update({
          where: { id: existing.id },
          data: { recommendation: "recommended", priority: "high" },
        });
      }
      continue;
    }

    await prisma.platformRecommendation.create({
      data: {
        blueprintId,
        platformName: spec.name,
        platformType: spec.type,
        recommendation: "recommended",
        priority: "high",
        automationStatus: "manual_ready",
        requiredCredentials: [],
        permissionsNeeded: [],
        contentFormats: spec.formats,
        rationale: "Площадка выбрана пользователем в self-service onboarding.",
        contentRole: spec.id.includes("article") ? "Экспертные материалы и поисковая видимость" : "Регулярное присутствие бренда",
        suggestedFrequency: spec.id.includes("article") ? "1–2 материала в месяц" : "1–2 темы в неделю",
        automationOpportunity: "Подготовка контента внутри Adaptive Presence",
      },
    });
  }

  const refreshed = await prisma.platformRecommendation.findMany({
    where: { blueprintId, recommendation: "recommended" },
    select: { platformName: true },
  });

  return selectedSpecs.flatMap((spec) => {
    const platform = refreshed.find((item) => spec.match.test(item.platformName));
    return platform ? [platform.platformName] : [];
  });
}

async function currentSelfServiceWorkspace() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;

  return prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    include: {
      client: {
        include: {
          subscription: true,
          contentOrders: {
            where: { month: currentMonth(), status: { in: ["confirmed", "processing"] } },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
          briefs: { orderBy: { createdAt: "desc" }, take: 1, include: { blueprint: true } },
          monthlyPlans: {
            where: { month: currentMonth(), status: { notIn: ["archived", "replaced"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

export async function startSelfServiceMonth() {
  const membership = await currentSelfServiceWorkspace();
  if (!membership) redirect("/sign-in?callbackUrl=/app/month");
  if (membership.client.monthlyPlans[0]) redirect("/app/month?notice=month_exists");
  if (!hasSelfServicePaidAccess(membership.client.subscription) && !membership.client.contentOrders[0]) {
    redirect("/app/plan-builder");
  }

  const brief = membership.client.briefs[0];
  if (!brief) redirect("/start?error=onboarding_missing");

  try {
    await ensureBlueprintForBrief(brief.id);
  } catch (error) {
    console.error("Self-service blueprint generation failed", error);
    redirect("/app/month?error=blueprint_failed");
  }

  revalidatePath("/app/month");
  redirect("/app/month?autostart=1");
}

export async function continueSelfServiceMonth() {
  const membership = await currentSelfServiceWorkspace();
  if (!membership) return { ok: false as const, message: "Сессия завершилась. Войдите ещё раз." };

  const existingPlan = membership.client.monthlyPlans[0];
  const contentOrder = membership.client.contentOrders[0] ?? null;
  if (existingPlan) {
    const run = await createMonthProductionRun(existingPlan.id);
    if (contentOrder) {
      await prisma.selfServiceContentOrder.update({ where: { id: contentOrder.id }, data: { status: "processing" } });
    }
    return { ok: true as const, monthlyPlanId: existingPlan.id, productionRunId: run.id };
  }

  if (!hasSelfServicePaidAccess(membership.client.subscription) && !contentOrder) {
    return { ok: false as const, message: "Сначала соберите набор и подтвердите его кредитами." };
  }

  const brief = membership.client.briefs[0];
  if (!brief) return { ok: false as const, message: "Не удалось найти бриф бренда. Вернитесь к короткой настройке." };
  let blueprintId = brief.blueprint?.id;
  if (!blueprintId) {
    try {
      blueprintId = (await ensureBlueprintForBrief(brief.id)).blueprintId;
    } catch (error) {
      console.error("Self-service blueprint generation failed", error);
      return { ok: false as const, message: "Не удалось подготовить профиль бренда с первого раза. Кредиты сохранены за заказом — можно повторить безопасно." };
    }
  }

  try {
    const configuration = contentOrder ? parseSelfServiceContentOrderConfiguration(contentOrder.configuration) : null;
    const formatIds = configuration ? contentOrderFormatIds(configuration) : selfServiceFormatIds(brief.rawBrief);
    const allowedPlatforms = await ensureSelfServicePlatformRecommendations(blueprintId, formatIds);
    const postsPerWeek = selfServicePostFrequency(brief.rawBrief);
    const articlesPerMonth = selfServiceArticleFrequency(brief.rawBrief);
    const strategicThemes = [
      selfServiceBriefSetting(brief.rawBrief, "Цель ближайшего месяца"),
      selfServiceBriefSetting(brief.rawBrief, "Обязательные темы ближайшего месяца"),
    ].filter(Boolean);
    const scope = buildProductionScope({
      allowedPlatforms,
      allowedDeliverables: configuration
        ? ["пост", "статья", "article", "post", "визуал", "карусель", "анонс", "ответ на отзыв"]
        : ["пост", "статья", "article", "post", "визуал"],
      cadenceRules: configuration ? [
        `Создать ровно ${configuration.vkPosts} постов VK за месяц`,
        `Создать ровно ${configuration.telegramPosts} постов Telegram за месяц`,
        `Создать ровно ${configuration.okPosts} постов Одноклассники за месяц`,
        `Создать ровно ${configuration.dzenArticles} статей Дзен за месяц`,
        `Создать ровно ${configuration.vcruArticles} статей VC.ru за месяц`,
        `Создать ровно ${configuration.carousels} каруселей по 4 слайда`,
        `Создать ровно ${configuration.quickAnnouncements} коротких анонсов`,
        `Создать ровно ${configuration.reviewReplies} ответов на отзывы`,
      ] : [
          `VK: ${postsPerWeek} поста в неделю`,
          `Telegram: ${postsPerWeek} поста в неделю`,
          `Статьи: ${articlesPerMonth} в месяц`,
        ],
      strategicThemes,
    });
    const generationForm = new FormData();
    generationForm.set("articlesPerMonth", String(configuration ? configuration.dzenArticles + configuration.vcruArticles : articlesPerMonth));
    const result = await createMonthlyPlanForBlueprint(blueprintId, generationForm, {
      prepareTextsAfterCreate: false,
      productionScopeOverride: scope,
      throwOnError: true,
      exactContentMix: configuration ?? undefined,
    });
    const run = await createMonthProductionRun(result.monthlyPlanId);
    if (contentOrder) {
      await prisma.selfServiceContentOrder.update({ where: { id: contentOrder.id }, data: { status: "processing" } });
    }
    revalidatePath("/app");
    revalidatePath("/app/month");
    return { ok: true as const, monthlyPlanId: result.monthlyPlanId, productionRunId: run.id };
  } catch (error) {
    console.error("Self-service month generation failed", error);
    return {
      ok: false as const,
      message: "Не удалось собрать месяц с первого раза. Ваш бриф сохранён — можно безопасно повторить.",
    };
  }
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

  if (item.deliverableKind === "article") {
    return {
      ...resultContext,
      status: "skipped",
      message: "Это статья: её готовит движок статей, отдельный текст поста не нужен.",
    };
  }

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
      telegramBody: draft.telegramBody,
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
    const postItems = plan.plannedContentItems.filter((item) => item.deliverableKind !== "article");
    const missingTextItems = postItems.filter((item) => !item.contentDraft);
    const textBatch = missingTextItems.slice(0, getAutopilotTextBatchLimit());
    const existingTextsCount = postItems.length - missingTextItems.length;
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
    let notice = `Тексты подготовлены: ${createdTextsCount + skippedTextsCount} из ${postItems.length}.`;

    if (remainingMissingTextsCount > 0) {
      notice = `Тексты подготовлены: ${createdTextsCount + skippedTextsCount} из ${postItems.length}. Осталось ${remainingMissingTextsCount}; нажмите «Подготовить тексты» в Materials, чтобы продолжить.`;
    }

    if (failedTextsCount > 0) {
      notice = `Тексты подготовлены: ${createdTextsCount + skippedTextsCount} из ${postItems.length}. Не удалось подготовить ${failedTextsCount} текстов. Повторите подготовку в Materials.`;
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

async function ensureScheduledPublicationsForMonthlyPlan(monthlyPlanId: string) {
  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      plannedContentItems: {
        include: {
          contentDraft: true,
          scheduledPublications: {
            where: {
              status: { not: "published" },
            },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!plan) {
    return {
      blueprintId: "",
      monthlyPlanId,
      createdCount: 0,
      skippedCount: 0,
      notice: "Месячный план для календаря не найден.",
      hasFailures: true,
    };
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const item of plan.plannedContentItems) {
    if (!item.contentDraft || item.scheduledPublications.length > 0) {
      skippedCount += 1;
      continue;
    }

    await prisma.scheduledPublication.create({
      data: {
        clientId: plan.clientId,
        blueprintId: plan.blueprintId,
        monthlyPlanId: plan.id,
        plannedContentItemId: item.id,
        contentDraftId: item.contentDraft.id,
        platformName: item.platformName,
        format: item.format,
        topic: item.topic,
        scheduledDate: item.plannedDate,
        scheduledTime: null,
        timezone: null,
        status: "scheduled",
        publishMode: "manual",
        notes: null,
      },
    });
    createdCount += 1;
  }

  return {
    blueprintId: plan.blueprintId,
    monthlyPlanId: plan.id,
    createdCount,
    skippedCount,
    notice: createdCount > 0
      ? `Календарь заполнен: ${createdCount} материалов поставлено в расписание.`
      : "Все материалы уже есть в календаре.",
    hasFailures: false,
  };
}

async function normalizeDatesForMonthlyPlan(monthlyPlanId: string) {
  const monthlyPlan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    select: {
      id: true,
      month: true,
      blueprintId: true,
      plannedContentItems: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          plannedDate: true,
          week: true,
          platformName: true,
          format: true,
        },
      },
    },
  });

  if (!monthlyPlan) {
    return {
      blueprintId: "",
      monthlyPlanId,
      changedCount: 0,
      notice: "Месячный план для расстановки дат не найден.",
      hasFailures: true,
    };
  }

  const items = monthlyPlan.plannedContentItems.map((item) => ({ ...item }));
  const datesBefore = new Map(items.map((item) => [item.id, item.plannedDate]));
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

  return {
    blueprintId: monthlyPlan.blueprintId,
    monthlyPlanId: monthlyPlan.id,
    changedCount: changedItems.length,
    notice: changedItems.length > 0
      ? `Даты расставлены: ${changedItems.length} материалов.`
      : "Даты уже расставлены.",
    hasFailures: false,
  };
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

async function prepareMissingCreativeBriefsForMonthlyPlan(monthlyPlanId: string) {
  const schedulePreparation = await ensureScheduledPublicationsForMonthlyPlan(monthlyPlanId);
  if (schedulePreparation.hasFailures) {
    return schedulePreparation;
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
    return {
      blueprintId: "",
      monthlyPlanId,
      notice: "Месячный план для подготовки ТЗ не найден.",
      hasFailures: true,
    };
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
      const assetInputs = creativeAssetCreateInputsFromBrief(publication, brief);
      const createdAsset = await prisma.$transaction(async (transaction) => {
        const assets = [];
        for (const assetInput of assetInputs) {
          assets.push(await transaction.creativeAsset.create({ data: assetInput }));
        }

        if (publication.status === "scheduled") {
          await transaction.scheduledPublication.update({
            where: { id: publication.id },
            data: { status: "needs_assets" },
          });
        }

        return assets[0];
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

  return {
    blueprintId: plan.blueprintId,
    monthlyPlanId: plan.id,
    notice,
    hasFailures: failedCount > 0,
  };
}

export async function prepareMonthCreativeBriefs(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");

  if (!monthlyPlanId) {
    errorRedirect("Не выбран месячный план для подготовки ТЗ.", "drafts");
  }

  const result = await prepareMissingCreativeBriefsForMonthlyPlan(monthlyPlanId);

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

const BRAND_REQUIRED_FOR_VISUALS_MESSAGE =
  "Сначала заполните бренд клиента (профиль и логотип в разделе «Бренд») — без него визуалы получаются нефирменными. Заполните бренд и повторите генерацию.";

/** Visuals are brand-driven: without a brand profile we pause instead of generating generic art. */
async function brandReadyForVisuals(clientId: string) {
  const profile = await prisma.clientBrandProfile
    .findUnique({ where: { clientId }, select: { id: true } })
    .catch(() => null);
  return Boolean(profile);
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

  if (!(await brandReadyForVisuals(asset.clientId))) {
    return {
      status: "failed" as const,
      message: BRAND_REQUIRED_FOR_VISUALS_MESSAGE,
    };
  }

  if (creativeAssetNeedsCarouselSplit(asset)) {
    const splitResult = await splitCreativeAssetIntoCarouselSlides(asset.id);

    return {
      status: splitResult.status === "created" || splitResult.status === "skipped" ? "split" as const : "failed" as const,
      message: splitResult.message,
      blueprintId: asset.blueprintId,
      monthlyPlanId: asset.monthlyPlanId,
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
    const visualBranding = await getClientVisualBranding(asset.clientId);
    const variant = await generateCreativeVisualVariant({
      clientName: asset.client.name,
      clientIndustry: asset.client.industry,
      brandContext: await getClientBrandContext(asset.clientId),
      brandLogoUrl: visualBranding.logoUrl,
      brandTypography: visualBranding.typography,
      creativeAsset: {
        assetType: asset.assetType,
        // Slide index («Карточка 1 / 4») is a UI badge only — never send it to the visual engine.
        title: stripCarouselSlideLabel(asset.title),
        brief: asset.brief,
        formatRequirements: asset.formatRequirements,
        textOnAsset: asset.textOnAsset ? stripCarouselSlideLabel(asset.textOnAsset) || null : asset.textOnAsset,
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
        inputTokens: variant.inputTokens,
        outputTokens: variant.outputTokens,
        totalTokens: variant.totalTokens,
        estimatedCostUsd: variant.estimatedCostUsd,
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

async function prepareMissingVisualsForMonthlyPlan(monthlyPlanId: string) {
  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      plannedContentItems: {
        include: {
          creativeAssets: {
            include: {
              generatedVariants: {
                select: { id: true },
              },
            },
          },
        },
      },
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
    return {
      blueprintId: "",
      monthlyPlanId,
      notice: "Месячный план для подготовки визуалов не найден.",
      hasFailures: true,
    };
  }

  const requiredAssets = plan.plannedContentItems.flatMap((item) => {
    const carouselSlideAssets = item.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");

    return carouselSlideAssets.length > 0
      ? carouselSlideAssets
      : item.creativeAssets.filter((asset) => !isLegacyCombinedCarouselAsset(asset));
  });
  const candidates = requiredAssets.filter((asset) => asset.generatedVariants.length === 0).slice(0, 1);
  const results = [];

  for (const asset of candidates) {
    results.push(await generateVisualForCreativeAssetId(asset.id));
  }

  const createdCount = results.filter((result) => result.status === "created").length;
  const failedCount = results.filter((result) => result.status === "failed").length;
  const remainingCount = Math.max(0, requiredAssets.filter((asset) => asset.generatedVariants.length === 0).length - createdCount);
  const notice = `Подготовлено ${createdCount} визуалов. Осталось ${remainingCount}. В MVP визуалы готовятся по одному за запуск.`;

  return {
    blueprintId: plan.blueprintId,
    monthlyPlanId: plan.id,
    notice,
    hasFailures: failedCount > 0,
  };
}

export async function prepareMonthVisuals(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");

  if (!monthlyPlanId) {
    errorRedirect("Не выбран месячный план для подготовки визуалов.", "drafts");
  }

  const planForBrandCheck = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    select: { clientId: true, blueprintId: true },
  });
  if (planForBrandCheck && !(await brandReadyForVisuals(planForBrandCheck.clientId))) {
    redirect(workspaceLocation("drafts", {
      blueprintId: planForBrandCheck.blueprintId,
      planId: monthlyPlanId,
      error: BRAND_REQUIRED_FOR_VISUALS_MESSAGE,
    }));
  }

  const result = await prepareMissingVisualsForMonthlyPlan(monthlyPlanId);

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

const monthProductionStageOrder = ["planning", "dates", "texts", "briefs", "visuals", "articles", "quality_check", "done"];
const staleProductionTaskMs = 1000 * 60 * 15;

function productionStageRank(stage: string) {
  const index = monthProductionStageOrder.indexOf(stage);
  return index === -1 ? monthProductionStageOrder.length : index;
}

async function refreshMonthProductionRunCounters(productionRunId: string) {
  const tasks = await prisma.monthProductionTask.findMany({
    where: { productionRunId },
    select: { status: true, stage: true },
  });
  const currentRun = await prisma.monthProductionRun.findUnique({
    where: { id: productionRunId },
    select: { status: true },
  });
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const failedTasks = tasks.filter((task) => task.status === "failed").length;
  const runningTask = tasks.find((task) => task.status === "running");
  const nextQueuedTask = [...tasks]
    .filter((task) => task.status === "queued")
    .sort((left, right) => productionStageRank(left.stage) - productionStageRank(right.stage))[0];
  const allDone = tasks.length > 0 && completedTasks + failedTasks === tasks.length;
  const currentStage = allDone ? "done" : runningTask?.stage ?? nextQueuedTask?.stage ?? "done";
  const status = allDone
    ? failedTasks > 0 ? "completed_with_errors" : "completed"
    : currentRun?.status === "paused"
      ? "paused"
      : runningTask || nextQueuedTask ? "running" : "queued";

  return prisma.monthProductionRun.update({
    where: { id: productionRunId },
    data: {
      status,
      currentStage,
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      completedAt: allDone ? new Date() : null,
    },
  });
}

async function monthProductionProgressSnapshot(productionRunId: string) {
  const run = await prisma.monthProductionRun.findUnique({
    where: { id: productionRunId },
    include: {
      tasks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          plannedContentItemId: true,
          stage: true,
          taskType: true,
          status: true,
          title: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });

  if (!run) {
    return {
      ok: false,
      status: "missing",
      message: "Production run не найден.",
      percent: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      currentStage: "planning",
      hasQueuedTasks: false,
    };
  }

  const percent = run.totalTasks > 0
    ? Math.floor(((run.completedTasks + run.failedTasks) / run.totalTasks) * 100)
    : 0;
  const currentTask = run.tasks.find((task) => task.status === "running") ??
    run.tasks.find((task) => task.status === "queued") ??
    null;

  return {
    ok: true,
    id: run.id,
    status: run.status,
    message: run.errorMessage,
    percent,
    totalTasks: run.totalTasks,
    completedTasks: run.completedTasks,
    failedTasks: run.failedTasks,
    currentStage: run.currentStage,
    currentTask: currentTask
      ? {
          id: currentTask.id,
          title: currentTask.title,
          taskType: currentTask.taskType,
          stage: currentTask.stage,
          status: currentTask.status,
        }
      : null,
    hasQueuedTasks: run.tasks.some((task) => task.status === "queued"),
  };
}

async function markStaleProductionTasksRecoverable(productionRunId: string) {
  const staleBefore = new Date(Date.now() - staleProductionTaskMs);
  await prisma.monthProductionTask.updateMany({
    where: {
      productionRunId,
      status: "running",
      startedAt: { lt: staleBefore },
    },
    data: {
      status: "failed",
      errorMessage: "Подготовка заняла слишком много времени. Можно продолжить с места остановки.",
      completedAt: new Date(),
    },
  });
}

async function ensureMissingMonthProductionTasks(monthlyPlanId: string, productionRunId: string) {
  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      plannedContentItems: {
        include: {
          contentDraft: true,
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
  });

  if (!plan) {
    errorRedirect("Месячный план для подготовки не найден.", "drafts");
  }

  const existingTasks = await prisma.monthProductionTask.findMany({
    where: { productionRunId },
    select: {
      plannedContentItemId: true,
      creativeAssetId: true,
      taskType: true,
    },
  });
  const existingTaskKeys = new Set(
    existingTasks.map((task) => `${task.taskType}:${task.plannedContentItemId ?? "month"}:${task.creativeAssetId ?? "none"}`),
  );
  const hasTask = (taskType: string, plannedContentItemId?: string | null, creativeAssetId?: string | null) =>
    existingTaskKeys.has(`${taskType}:${plannedContentItemId ?? "month"}:${creativeAssetId ?? "none"}`);

  const planArticles = await prisma.article.findMany({
    where: { monthlyPlanId, plannedContentItemId: { not: null } },
    select: { plannedContentItemId: true, stage: true, status: true },
  });
  const articleByItemId = new Map(planArticles.map((article) => [article.plannedContentItemId, article]));

  // Older plans may still carry model-planned articles marked as posts —
  // normalize them here so the queue never sends an article through the
  // lightweight post-text path. Idempotent, usually a no-op.
  const itemsToNormalize = plan.plannedContentItems.filter(
    (item) => item.deliverableKind !== "article" && isArticleLikePlanItem(item),
  );
  if (itemsToNormalize.length > 0) {
    await prisma.plannedContentItem.updateMany({
      where: { id: { in: itemsToNormalize.map((item) => item.id) } },
      data: { deliverableKind: "article", pairGroupId: null },
    });
  }
  const normalizedItemIds = new Set(itemsToNormalize.map((item) => item.id));

  const tasks: Prisma.MonthProductionTaskCreateManyInput[] = [];
  for (const item of plan.plannedContentItems) {
    if (item.deliverableKind === "article" || normalizedItemIds.has(item.id)) {
      const article = articleByItemId.get(item.id);
      const articleDone = article?.stage === "done" && article.status !== "failed";
      if (!articleDone && !hasTask("generate_article", item.id)) {
        tasks.push({
          productionRunId,
          clientId: plan.clientId,
          blueprintId: plan.blueprintId,
          monthlyPlanId: plan.id,
          plannedContentItemId: item.id,
          stage: "articles",
          taskType: "generate_article",
          title: `Статья: ${item.topic}`,
        });
      }
      continue;
    }

    if (!item.contentDraft && !hasTask("generate_text", item.id)) {
      tasks.push({
        productionRunId,
        clientId: plan.clientId,
        blueprintId: plan.blueprintId,
        monthlyPlanId: plan.id,
        plannedContentItemId: item.id,
        stage: "texts",
        taskType: "generate_text",
        title: `Текст: ${item.topic}`,
      });
    }

    const requiresVisual = !/короткий анонс|ответ на отзыв/i.test(item.format);
    if (requiresVisual && item.creativeAssets.length === 0 && !hasTask("generate_brief", item.id)) {
      tasks.push({
        productionRunId,
        clientId: plan.clientId,
        blueprintId: plan.blueprintId,
        monthlyPlanId: plan.id,
        plannedContentItemId: item.id,
        stage: "briefs",
        taskType: "generate_brief",
        title: `ТЗ: ${item.topic}`,
      });
    }

    const carouselSlideAssets = item.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");
    const assetsForVisualTasks = carouselSlideAssets.length > 0
      ? carouselSlideAssets
      : item.creativeAssets.filter((asset) => !isLegacyCombinedCarouselAsset(asset));

    for (const asset of requiresVisual ? assetsForVisualTasks : []) {
      if (asset.generatedVariants.length === 0 && !hasTask("generate_visual", item.id, asset.id)) {
        tasks.push({
          productionRunId,
          clientId: plan.clientId,
          blueprintId: plan.blueprintId,
          monthlyPlanId: plan.id,
          plannedContentItemId: item.id,
          creativeAssetId: asset.id,
          stage: "visuals",
          taskType: "generate_visual",
          title: `Визуал: ${asset.title}`,
        });
      }
    }
  }

  if (!hasTask("quality_check", null, null)) {
    tasks.push({
      productionRunId,
      clientId: plan.clientId,
      blueprintId: plan.blueprintId,
      monthlyPlanId: plan.id,
      stage: "quality_check",
      taskType: "quality_check",
      title: "AI-проверка месячного пакета",
    });
  }

  if (tasks.length > 0) {
    await prisma.monthProductionTask.createMany({ data: tasks });
  }

  return refreshMonthProductionRunCounters(productionRunId);
}

async function createMonthProductionRun(monthlyPlanId: string) {
  let run = await prisma.monthProductionRun.findFirst({
    where: { monthlyPlanId },
    orderBy: { createdAt: "desc" },
  });

  if (!run) {
    const plan = await prisma.monthlyOperatingPlan.findUnique({
      where: { id: monthlyPlanId },
      select: {
        id: true,
        clientId: true,
        blueprintId: true,
      },
    });

    if (!plan) {
      errorRedirect("Месячный план для подготовки не найден.", "drafts");
    }

    run = await prisma.monthProductionRun.create({
      data: {
        clientId: plan.clientId,
        blueprintId: plan.blueprintId,
        monthlyPlanId: plan.id,
        status: "queued",
        currentStage: "texts",
      },
    });
  }

  await markStaleProductionTasksRecoverable(run.id);
  return ensureMissingMonthProductionTasks(monthlyPlanId, run.id);
}

async function enqueueMonthProductionAfterCarouselSplit(monthlyPlanId: string) {
  let run = await createMonthProductionRun(monthlyPlanId);
  const queuedVisualTasks = await prisma.monthProductionTask.count({
    where: {
      productionRunId: run.id,
      taskType: "generate_visual",
      status: "queued",
    },
  });

  if (queuedVisualTasks > 0 && ["completed", "completed_with_errors", "paused"].includes(run.status)) {
    await prisma.monthProductionRun.update({
      where: { id: run.id },
      data: {
        status: "queued",
        currentStage: "visuals",
        errorMessage: null,
        completedAt: null,
      },
    });
    run = await refreshMonthProductionRunCounters(run.id);
  }

  return {
    run,
    queuedVisualTasks,
  };
}

function productionScopeFromRawPlanJson(value: Prisma.JsonValue): MonthlyProductionScope | undefined {
  const raw = jsonObject(value) as { productionScope?: unknown };
  const scope = raw.productionScope && typeof raw.productionScope === "object" && !Array.isArray(raw.productionScope)
    ? raw.productionScope as Record<string, unknown>
    : null;

  if (!scope) return undefined;

  return {
    allowedPlatforms: stringArray(scope.allowedPlatforms),
    allowedDeliverables: stringArray(scope.allowedDeliverables),
    forbiddenDeliverables: stringArray(scope.forbiddenDeliverables),
    cadenceRules: stringArray(scope.cadenceRules),
    strategicThemes: stringArray(scope.strategicThemes),
    reputationTasks: stringArray(scope.reputationTasks),
  };
}

export async function rebuildMonthProduction(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");
  if (!monthlyPlanId) errorRedirect("Выберите месяц для пересборки.", "drafts");

  const currentPlan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    select: {
      id: true,
      blueprintId: true,
      rawPlanJson: true,
    },
  });

  if (!currentPlan) errorRedirect("Текущий месячный план не найден.", "drafts");

  const created = await createMonthlyPlanForBlueprint(currentPlan.blueprintId, formData, {
    forceNewVersion: true,
    prepareTextsAfterCreate: false,
    productionScopeOverride: productionScopeFromRawPlanJson(currentPlan.rawPlanJson),
  });
  await normalizeDatesForMonthlyPlan(created.monthlyPlanId);
  const run = await createMonthProductionRun(created.monthlyPlanId);

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: created.blueprintId,
    planId: created.monthlyPlanId,
    notice: `Месяц пересобран как новая версия. Текущий план сохранён как предыдущая версия. Run: ${run.id}.`,
  }));
}

export async function resetTestMonthProduction(formData: FormData) {
  const monthlyPlanId = formText(formData, "monthlyPlanId");
  if (!monthlyPlanId) errorRedirect("Выберите тестовый месяц для пересборки.", "drafts");

  const plan = await prisma.monthlyOperatingPlan.findUnique({
    where: { id: monthlyPlanId },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  if (!plan) errorRedirect("Тестовый месячный план не найден.", "drafts");
  if (!/\btest\b|· test/i.test(plan.client.name)) {
    errorRedirect("Очистка и пересборка доступна только для тестовых копий клиента.", "drafts");
  }

  const blueprintId = plan.blueprintId;
  const productionScope = productionScopeFromRawPlanJson(plan.rawPlanJson);

  await prisma.monthlyOperatingPlan.delete({ where: { id: plan.id } });

  const created = await createMonthlyPlanForBlueprint(blueprintId, formData, {
    prepareTextsAfterCreate: false,
    productionScopeOverride: productionScope,
  });
  await normalizeDatesForMonthlyPlan(created.monthlyPlanId);
  const run = await createMonthProductionRun(created.monthlyPlanId);

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: created.blueprintId,
    planId: created.monthlyPlanId,
    clientId: plan.clientId,
    productionRunId: run.id,
    notice: "Тестовый месяц очищен и собран заново. Подготовка поставлена в очередь.",
  }));
}

async function scheduledPublicationForProductionItem(plannedContentItemId: string) {
  const item = await prisma.plannedContentItem.findUnique({
    where: { id: plannedContentItemId },
    include: {
      contentDraft: true,
      scheduledPublications: {
        orderBy: { createdAt: "desc" },
        include: {
          client: true,
          blueprint: { include: { riskRules: true } },
          monthlyPlan: true,
          plannedContentItem: true,
          contentDraft: true,
          creativeAssets: true,
        },
      },
      monthlyPlan: true,
    },
  });

  if (!item?.contentDraft) {
    throw new Error("Сначала нужен текст материала.");
  }

  const existing = item.scheduledPublications[0];
  if (existing) return existing;

  const publication = await prisma.scheduledPublication.create({
    data: {
      clientId: item.monthlyPlan.clientId,
      blueprintId: item.monthlyPlan.blueprintId,
      monthlyPlanId: item.monthlyPlanId,
      plannedContentItemId: item.id,
      contentDraftId: item.contentDraft.id,
      platformName: item.platformName,
      format: item.format,
      topic: item.topic,
      scheduledDate: item.plannedDate,
      scheduledTime: null,
      timezone: null,
      status: "scheduled",
      publishMode: "manual",
      notes: null,
    },
  });

  const loaded = await prisma.scheduledPublication.findUnique({
    where: { id: publication.id },
    include: {
      client: true,
      blueprint: { include: { riskRules: true } },
      monthlyPlan: true,
      plannedContentItem: true,
      contentDraft: true,
      creativeAssets: true,
    },
  });

  if (!loaded) {
    throw new Error("Не удалось подготовить календарную публикацию.");
  }

  return loaded;
}

async function processMonthProductionTask(taskId: string) {
  const claimed = await prisma.monthProductionTask.updateMany({
    where: { id: taskId, status: "queued" },
    data: { status: "running", startedAt: new Date(), errorMessage: null },
  });

  if (claimed.count === 0) {
    return;
  }

  const task = await prisma.monthProductionTask.findUnique({ where: { id: taskId } });
  if (!task) return;

  try {
    if (task.taskType === "generate_text") {
      if (!task.plannedContentItemId) throw new Error("Материал для текста не найден.");
      const result = await generateContentTextForPlannedItem(task.plannedContentItemId, {
        replaceExisting: false,
        createReviewEvent: true,
        generationJobType: "generate_publication_text",
      });
      if (result.status === "failed") throw new Error(result.message);
      await prisma.monthProductionTask.update({
        where: { id: task.id },
        data: { status: "completed", contentDraftId: result.contentDraftId, completedAt: new Date() },
      });
      return;
    }

    if (task.taskType === "generate_brief") {
      if (!task.plannedContentItemId) throw new Error("Материал для ТЗ не найден.");
      const existingAsset = await prisma.creativeAsset.findFirst({
        where: { plannedContentItemId: task.plannedContentItemId },
        select: { id: true },
      });
      if (existingAsset) {
        await prisma.monthProductionTask.update({
          where: { id: task.id },
          data: { status: "completed", creativeAssetId: existingAsset.id, completedAt: new Date() },
        });
        return;
      }

      const publication = await scheduledPublicationForProductionItem(task.plannedContentItemId);
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
      await markGenerationJobRunning(generationJob.id, "AI готовит ТЗ на креатив.");
      const brief = await generateCreativeAssetBriefFromContext(publication);
      const assetInputs = creativeAssetCreateInputsFromBrief(publication, brief);
      const asset = await prisma.$transaction(async (transaction) => {
        const assets = [];
        for (const assetInput of assetInputs) {
          assets.push(await transaction.creativeAsset.create({ data: assetInput }));
        }

        if (publication.status === "scheduled") {
          await transaction.scheduledPublication.update({
            where: { id: publication.id },
            data: { status: "needs_assets" },
          });
        }

        return assets[0];
      });
      await markGenerationJobCompleted(generationJob.id, "ТЗ на креатив сгенерировано.", { creativeAssetId: asset.id });
      await prisma.monthProductionTask.update({
        where: { id: task.id },
        data: { status: "completed", creativeAssetId: asset.id, completedAt: new Date() },
      });
      return;
    }

    if (task.taskType === "generate_article") {
      if (!task.plannedContentItemId) throw new Error("Материал для статьи не найден.");
      const result = await runArticleForPlannedItem(task.plannedContentItemId);
      if (!result.ok) throw new Error(result.error);
      if (!result.done) {
        await prisma.monthProductionTask.update({
          where: { id: task.id },
          data: { status: "queued", startedAt: null, completedAt: null, errorMessage: null },
        });
        return;
      }
      await prisma.monthProductionTask.update({
        where: { id: task.id },
        data: { status: "completed", completedAt: new Date() },
      });
      return;
    }

    if (task.taskType === "generate_visual") {
      if (!task.plannedContentItemId) throw new Error("Материал для визуала не найден.");
      const selfServiceSubscription = await prisma.subscription.findUnique({
        where: { clientId: task.clientId },
        select: { id: true },
      });
      if (selfServiceSubscription) {
        const configuredBudget = Number(process.env.SELF_SERVICE_MONTH_VISUAL_BUDGET_USD ?? "3");
        const visualBudgetUsd = Number.isFinite(configuredBudget) && configuredBudget > 0 ? configuredBudget : 3;
        const usage = await prisma.generatedCreativeVariant.aggregate({
          where: { monthlyPlanId: task.monthlyPlanId },
          _sum: { estimatedCostUsd: true },
        });
        if ((usage._sum.estimatedCostUsd ?? 0) >= visualBudgetUsd) {
          throw new Error(`AI-бюджет визуалов на месяц достиг лимита $${visualBudgetUsd.toFixed(2)}. Уже созданные материалы сохранены.`);
        }
      }
      const asset = await prisma.creativeAsset.findFirst({
        where: task.creativeAssetId
          ? { id: task.creativeAssetId }
          : {
              plannedContentItemId: task.plannedContentItemId,
              generatedVariants: { none: {} },
            },
        include: { generatedVariants: { select: { id: true } } },
        orderBy: { createdAt: "asc" },
      });
      if (!asset) throw new Error("Сначала нужно ТЗ на креатив.");
      if (asset.generatedVariants.length > 0) {
        await prisma.monthProductionTask.update({
          where: { id: task.id },
          data: { status: "completed", creativeAssetId: asset.id, completedAt: new Date() },
        });
        return;
      }
      const result = await generateVisualForCreativeAssetId(asset.id);
      if (result.status === "failed") throw new Error(result.message);
      await prisma.monthProductionTask.update({
        where: { id: task.id },
        data: { status: "completed", creativeAssetId: asset.id, completedAt: new Date() },
      });
      return;
    }

    await prisma.monthProductionTask.update({
      where: { id: task.id },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch (error) {
    const message = friendlyProductionErrorMessage(error);
    await prisma.monthProductionTask.update({
      where: { id: task.id },
      data: { status: "failed", errorMessage: message, completedAt: new Date() },
    });
    if (isCriticalProductionErrorMessage(message)) {
      await prisma.monthProductionRun.update({
        where: { id: task.productionRunId },
        data: {
          status: "paused",
          currentStage: task.stage,
          errorMessage: message,
        },
      });
    }
  }
}

function productionRunNotice(run: Awaited<ReturnType<typeof refreshMonthProductionRunCounters>>) {
  if (run.status === "completed") return "Подготовка месяца завершена. Открыли текущий месяц.";
  if (run.status === "completed_with_errors") return "Подготовка месяца остановилась с ошибками. Уже созданные материалы сохранены, ошибки можно повторить.";
  if (run.status === "running") return "Подготовка уже идёт. Открыли прогресс месяца.";
  if (run.status === "paused") return "Подготовка месяца на паузе. Можно продолжить с места остановки.";
  return "Подготовка месяца поставлена в очередь. Готовые материалы будут появляться постепенно.";
}

function friendlyProductionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (lower.includes("quota") || lower.includes("rate limit") || lower.includes("insufficient_quota")) {
    return "Не хватает API-лимита OpenAI. Подготовка остановлена, уже созданные материалы сохранены.";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("504")) {
    return "Подготовка заняла слишком много времени. Можно продолжить с места остановки.";
  }
  if (isPrismaUniqueConstraintError(error) || lower.includes("unique constraint")) {
    return "Месячный план уже существует. Открыли текущий месяц.";
  }

  return message || "Не удалось выполнить задачу производства. Уже созданные материалы сохранены.";
}

function isCriticalProductionErrorMessage(message: string) {
  const lower = message.toLowerCase();

  return lower.includes("api-лимит") ||
    lower.includes("ai-бюджет") ||
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("rate limit") ||
    lower.includes("insufficient_quota");
}

export async function prepareOrContinueMonthProduction(formData: FormData) {
  let monthlyPlanId = formText(formData, "monthlyPlanId");
  let blueprintId = formText(formData, "blueprintId");
  const clientId = formText(formData, "clientId");

  if (!monthlyPlanId) {
    if (!blueprintId) {
      errorRedirect("Выберите Blueprint или месячный план для подготовки месяца.", "drafts");
    }

    const created = await createMonthlyPlanForBlueprint(blueprintId, formData, {
      prepareTextsAfterCreate: false,
    });
    monthlyPlanId = created.monthlyPlanId;
    blueprintId = created.blueprintId;
  } else if (!blueprintId) {
    const plan = await prisma.monthlyOperatingPlan.findUnique({
      where: { id: monthlyPlanId },
      select: { blueprintId: true },
    });
    if (!plan) {
      errorRedirect("Месячный план для подготовки не найден.", "drafts");
    }
    blueprintId = plan.blueprintId;
  }

  // Unified month: older plans created before the article track get their articles here too.
  await ensureArticleItemsForPlan(monthlyPlanId, resolveArticlesPerMonth(formData));
  await normalizeDatesForMonthlyPlan(monthlyPlanId);
  const run = await createMonthProductionRun(monthlyPlanId);

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId,
    planId: monthlyPlanId,
    clientId,
    productionRunId: run.id,
    notice: productionRunNotice(run),
  }));
}

export async function prepareMonthProductionEngine(formData: FormData) {
  return prepareOrContinueMonthProduction(formData);
}

async function processNextMonthProductionBatchInternal(productionRunId: string) {
  if (!productionRunId) {
    return {
      ok: false,
      status: "missing",
      message: "Production run не выбран.",
      percent: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      currentStage: "planning",
      hasQueuedTasks: false,
    };
  }

  const run = await prisma.monthProductionRun.findUnique({ where: { id: productionRunId } });
  if (!run) return monthProductionProgressSnapshot(productionRunId);

  if (["completed", "completed_with_errors", "paused"].includes(run.status)) {
    return monthProductionProgressSnapshot(run.id);
  }

  await prisma.monthProductionRun.update({
    where: { id: run.id },
    data: { status: "running", errorMessage: null, startedAt: run.startedAt ?? new Date() },
  });
  await markStaleProductionTasksRecoverable(run.id);
  await ensureMissingMonthProductionTasks(run.monthlyPlanId, run.id);

  const queuedTasks = await prisma.monthProductionTask.findMany({
    where: { productionRunId: run.id, status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  const nextStage = queuedTasks.sort((left, right) => productionStageRank(left.stage) - productionStageRank(right.stage))[0]?.stage;
  const batchSize = nextStage === "texts" ? 3 : nextStage === "briefs" ? 2 : 1;
  const batch = queuedTasks
    .filter((task) => task.stage === nextStage)
    .slice(0, batchSize);

  for (const task of batch) {
    await processMonthProductionTask(task.id);
    const currentRun = await prisma.monthProductionRun.findUnique({
      where: { id: run.id },
      select: { status: true },
    });
    if (currentRun?.status === "paused") {
      await refreshMonthProductionRunCounters(run.id);
      return monthProductionProgressSnapshot(run.id);
    }
  }

  await ensureMissingMonthProductionTasks(run.monthlyPlanId, run.id);
  await refreshMonthProductionRunCounters(run.id);

  return monthProductionProgressSnapshot(run.id);
}

export async function processNextMonthProductionBatch(productionRunId: string) {
  const snapshot = await processNextMonthProductionBatchInternal(productionRunId);
  revalidatePath("/");

  return snapshot;
}

export async function processNextSelfServiceProductionBatch(productionRunId: string) {
  const membership = await currentSelfServiceWorkspace();
  if (!membership) return { ok: false as const, message: "Сессия завершилась. Войдите ещё раз." };

  const run = await prisma.monthProductionRun.findUnique({
    where: { id: productionRunId },
    select: { clientId: true, monthlyPlan: { select: { month: true } } },
  });
  if (!run || run.clientId !== membership.clientId) {
    return { ok: false as const, message: "Подготовка этого месяца недоступна." };
  }

  const snapshot = await processNextMonthProductionBatchInternal(productionRunId);
  if (snapshot.status === "completed" || snapshot.status === "completed_with_errors") {
    await prisma.selfServiceContentOrder.updateMany({
      where: { clientId: run.clientId, month: run.monthlyPlan.month, status: "processing" },
      data: { status: snapshot.status === "completed" ? "completed" : "completed_with_errors" },
    });
  }
  revalidatePath("/app");
  revalidatePath("/app/month");
  return snapshot;
}

export async function processNextMonthProductionTasks(formData: FormData) {
  const productionRunId = formText(formData, "productionRunId");
  if (!productionRunId) errorRedirect("Production run не выбран.", "drafts");

  const run = await prisma.monthProductionRun.findUnique({ where: { id: productionRunId } });
  if (!run) errorRedirect("Production run не найден.", "drafts");

  const updatedRun = await processNextMonthProductionBatchInternal(run.id);

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: run.blueprintId,
    planId: run.monthlyPlanId,
    ...(updatedRun.status === "completed" || updatedRun.status === "completed_with_errors"
      ? { notice: updatedRun.status === "completed" ? "Подготовка месяца завершена." : "Подготовка месяца завершена с ошибками. Ошибки можно повторить." }
      : { notice: `Подготовка месяца продолжается автоматически: ${updatedRun.completedTasks}/${updatedRun.totalTasks} задач готово.` }),
  }));
}

export async function retryFailedProductionTasks(formData: FormData) {
  const productionRunId = formText(formData, "productionRunId");
  if (!productionRunId) errorRedirect("Production run не выбран.", "drafts");

  const run = await prisma.monthProductionRun.findUnique({ where: { id: productionRunId } });
  if (!run) errorRedirect("Production run не найден.", "drafts");

  await prisma.monthProductionTask.updateMany({
    where: { productionRunId, status: "failed" },
    data: { status: "queued", errorMessage: null, startedAt: null, completedAt: null },
  });
  await refreshMonthProductionRunCounters(productionRunId);

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: run.blueprintId,
    planId: run.monthlyPlanId,
    notice: "Ошибки возвращены в очередь. Подготовка продолжится автоматически, пока открыт экран месяца.",
  }));
}

export async function retryMaterialProductionStep(formData: FormData) {
  const plannedContentItemId = formText(formData, "plannedContentItemId");
  const step = formText(formData, "step");
  if (!plannedContentItemId || !["generate_text", "generate_brief", "generate_visual", "generate_article"].includes(step)) {
    errorRedirect("Не выбрана задача для повтора.", "drafts");
  }

  const latestTask = await prisma.monthProductionTask.findFirst({
    where: { plannedContentItemId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestTask) errorRedirect("Для материала ещё нет production run.", "drafts");

  const existingRetry = await prisma.monthProductionTask.findFirst({
    where: {
      productionRunId: latestTask.productionRunId,
      plannedContentItemId,
      taskType: step,
      status: { in: ["queued", "running"] },
    },
    select: { id: true },
  });

  if (existingRetry) {
    redirect(workspaceLocation("drafts", {
      blueprintId: latestTask.blueprintId,
      planId: latestTask.monthlyPlanId,
      materialId: plannedContentItemId,
      notice: "Этот шаг уже стоит в очереди подготовки.",
    }));
  }

  await prisma.monthProductionTask.create({
    data: {
      productionRunId: latestTask.productionRunId,
      clientId: latestTask.clientId,
      blueprintId: latestTask.blueprintId,
      monthlyPlanId: latestTask.monthlyPlanId,
      plannedContentItemId,
      stage: step === "generate_text" ? "texts" : step === "generate_brief" ? "briefs" : step === "generate_article" ? "articles" : "visuals",
      taskType: step,
      title: `Повтор: ${step}`,
    },
  });
  await refreshMonthProductionRunCounters(latestTask.productionRunId);

  revalidatePath("/");
  redirect(workspaceLocation("drafts", {
    blueprintId: latestTask.blueprintId,
    planId: latestTask.monthlyPlanId,
    materialId: plannedContentItemId,
    notice: "Задача добавлена в очередь повторной подготовки.",
  }));
}

export async function updatePublicationText(formData: FormData) {
  const contentDraftId = formText(formData, "contentDraftId");
  // Slide index («карточка 1/4») is service metadata — strip it even from manual edits.
  const draftTitle = cleanVisibleContentText(stripCarouselSlideLabel(formText(formData, "draftTitle")));
  const draftBody = cleanVisibleContentText(stripCarouselSlideLabel(formText(formData, "draftBody")));
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
        // Manual edit invalidates the generated Telegram version; publish falls
        // back to a trimmed caption until the text is regenerated.
        telegramBody: null,
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

export async function markPublicationPublishedManual(formData: FormData) {
  const scheduledPublicationId = formText(formData, "scheduledPublicationId");
  const externalUrl = formText(formData, "externalUrl");
  const publishedAtRaw = formText(formData, "publishedAt");

  if (!scheduledPublicationId) {
    errorRedirect("Не выбрана публикация.", "reports");
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: { id: true, blueprintId: true, monthlyPlanId: true, publishedAt: true },
  });

  if (!publication) {
    errorRedirect("Публикация не найдена.", "reports");
  }

  const parsedDate = publishedAtRaw ? new Date(`${publishedAtRaw}T12:00:00`) : null;
  const publishedAt =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate
      : publication.publishedAt ?? new Date();

  try {
    await prisma.scheduledPublication.update({
      where: { id: publication.id },
      data: {
        publishStatus: "published",
        publishedAt,
        externalUrl: externalUrl || null,
      },
    });
  } catch {
    errorRedirect("Не удалось сохранить отметку о публикации. Попробуйте ещё раз.", "reports");
  }

  revalidatePath("/");
  redirect(
    workspaceLocation("reports", {
      blueprintId: publication.blueprintId,
      planId: publication.monthlyPlanId,
      notice: "Публикация отмечена как опубликованная.",
    }),
  );
}

export async function upsertPublicationMetric(formData: FormData) {
  const scheduledPublicationId = formText(formData, "scheduledPublicationId");

  if (!scheduledPublicationId) {
    errorRedirect("Не выбрана публикация.", "reports");
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: {
      id: true,
      blueprintId: true,
      clientId: true,
      monthlyPlanId: true,
      plannedContentItemId: true,
      platformName: true,
    },
  });

  if (!publication) {
    errorRedirect("Публикация не найдена.", "reports");
  }

  const metrics = {
    likes: formInt(formData, "likes"),
    comments: formInt(formData, "comments"),
    shares: formInt(formData, "shares"),
    reach: formInt(formData, "reach"),
    views: formInt(formData, "views"),
    saves: formInt(formData, "saves"),
    clicks: formInt(formData, "clicks"),
  };

  try {
    const existing = await prisma.publicationMetric.findFirst({
      where: { scheduledPublicationId: publication.id, source: "manual" },
      orderBy: { capturedAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      await prisma.publicationMetric.update({
        where: { id: existing.id },
        data: { ...metrics, platformName: publication.platformName, capturedAt: new Date() },
      });
    } else {
      await prisma.publicationMetric.create({
        data: {
          scheduledPublicationId: publication.id,
          plannedContentItemId: publication.plannedContentItemId,
          clientId: publication.clientId,
          monthlyPlanId: publication.monthlyPlanId,
          platformName: publication.platformName,
          source: "manual",
          ...metrics,
        },
      });
    }
  } catch {
    errorRedirect("Не удалось сохранить метрики. Попробуйте ещё раз.", "reports");
  }

  revalidatePath("/");
  redirect(
    workspaceLocation("reports", {
      blueprintId: publication.blueprintId,
      planId: publication.monthlyPlanId,
      notice: "Метрики публикации сохранены.",
    }),
  );
}

export async function testN8nConnection() {
  const created = await emitIntegrationEvent("connection_test", {
    relatedType: "System",
    payload: { source: "manager_settings", triggeredAt: new Date().toISOString() },
  });

  revalidatePath("/");

  if (!created) {
    redirect(workspaceLocation("settings", { error: "Не удалось создать тестовое событие. Попробуйте ещё раз." }));
  }

  const event = await prisma.integrationEvent
    .findUnique({ where: { id: created.id }, select: { status: true, errorMessage: true } })
    .catch(() => null);

  if (event?.status === "sent") {
    redirect(workspaceLocation("settings", { notice: "Связь с n8n работает: тестовое событие доставлено." }));
  }

  if (event?.status === "failed") {
    redirect(
      workspaceLocation("settings", {
        error: "n8n не ответил на тестовое событие. Проверьте адрес вебхука и что workflow активен.",
      }),
    );
  }

  redirect(
    workspaceLocation("settings", {
      notice: "Тестовое событие поставлено в очередь. Задайте N8N_WEBHOOK_URL в Vercel, чтобы события уходили в n8n.",
    }),
  );
}

export async function saveTelegramBotToken(formData: FormData) {
  const token = formText(formData, "botToken");

  if (!token) {
    errorRedirect("Вставьте токен бота из @BotFather.", "settings");
  }

  const check = await verifyTelegramBotToken(token);
  if (!check.ok) {
    errorRedirect("Telegram не принял токен. Проверьте, что скопировали его целиком.", "settings");
  }

  try {
    await setIntegrationSetting(TELEGRAM_BOT_TOKEN_KEY, token);
    if (check.username) {
      await setIntegrationSetting(TELEGRAM_BOT_USERNAME_KEY, check.username);
    }
  } catch {
    errorRedirect("Не удалось сохранить токен. Попробуйте ещё раз.", "settings");
  }

  revalidatePath("/");
  redirect(workspaceLocation("settings", { notice: `Бот подключён: @${check.username ?? "bot"}.` }));
}

export async function toggleAutopublishOnApproval(formData: FormData) {
  const enable = formText(formData, "enable") === "true";

  try {
    await setIntegrationSetting(AUTOPUBLISH_SETTING_KEY, enable ? "true" : "false");
  } catch {
    errorRedirect("Не удалось сохранить настройку.", "settings");
  }

  revalidatePath("/");
  redirect(
    workspaceLocation("settings", {
      notice: enable
        ? "Автопубликация включена: согласованные клиентом материалы будут публиковаться сами (только с допуском autopublish)."
        : "Автопубликация выключена — публикация только вручную.",
    }),
  );
}

export async function collectMetricsNow() {
  const summary = await collectPublicationMetrics().catch(() => null);

  revalidatePath("/");

  if (!summary) {
    redirect(workspaceLocation("reports", { error: "Не удалось собрать метрики. Попробуйте ещё раз." }));
  }

  redirect(
    workspaceLocation("reports", {
      notice: `Метрики обновлены: VK ${summary.vkCollected}, Telegram ${summary.telegramCollected}${summary.skipped ? `, пропущено ${summary.skipped}` : ""}.`,
    }),
  );
}

export async function saveVkToken(formData: FormData) {
  const token = formText(formData, "vkToken");

  if (!token) {
    errorRedirect("Вставьте токен VK (права: wall, photos, groups, offline).", "settings");
  }

  const check = await verifyVkToken(token);
  if (!check.ok) {
    errorRedirect(check.error ?? "VK не принял токен.", "settings");
  }

  try {
    await setIntegrationSetting(VK_ACCESS_TOKEN_KEY, token);
    if (check.label) {
      await setIntegrationSetting(VK_ACCOUNT_LABEL_KEY, check.label);
    }
  } catch {
    errorRedirect("Не удалось сохранить токен. Попробуйте ещё раз.", "settings");
  }

  revalidatePath("/");
  redirect(workspaceLocation("settings", { notice: `VK подключён: ${check.label ?? "аккаунт"}.` }));
}

export async function addClientChannel(formData: FormData) {
  const clientId = formText(formData, "clientId");
  const channelId = formText(formData, "channelId");
  const title = formText(formData, "title");
  const platform = formText(formData, "platform") === "vk" ? "vk" : "telegram";

  if (!clientId) {
    errorRedirect("Не выбран клиент.", "settings");
  }
  if (!channelId) {
    errorRedirect("Укажите адрес канала или сообщества.", "settings");
  }

  let canonicalChannelId = channelId;
  let resolvedTitle = title;

  if (platform === "vk") {
    const vkToken = await getIntegrationSetting(VK_ACCESS_TOKEN_KEY);
    if (!vkToken) {
      errorRedirect("Сначала подключите VK в настройках.", "settings");
    }
    const check = await verifyVkGroup(vkToken, channelId);
    if (!check.ok || !check.groupId) {
      errorRedirect(check.error ?? "VK-сообщество не найдено.", "settings");
    }
    canonicalChannelId = String(check.groupId);
    resolvedTitle = title || check.title || "";
  } else {
    const token = await getTelegramBotToken();
    if (!token) {
      errorRedirect("Сначала подключите Telegram-бота в настройках.", "settings");
    }
    const check = await verifyTelegramChannel(token, channelId);
    if (!check.ok) {
      errorRedirect(check.error ?? "Бот не видит канал.", "settings");
    }
    resolvedTitle = title || check.chat?.title || "";
  }

  try {
    const existing = await prisma.clientChannel.findFirst({
      where: { clientId, platform, channelId: canonicalChannelId },
      select: { id: true },
    });

    if (existing) {
      await prisma.clientChannel.update({
        where: { id: existing.id },
        data: { status: "active", title: resolvedTitle || null },
      });
    } else {
      await prisma.clientChannel.create({
        data: {
          clientId,
          platform,
          channelId: canonicalChannelId,
          title: resolvedTitle || null,
        },
      });
    }
  } catch {
    errorRedirect("Не удалось сохранить канал. Попробуйте ещё раз.", "settings");
  }

  revalidatePath("/");
  redirect(workspaceLocation("settings", { clientId, notice: `Канал «${resolvedTitle || canonicalChannelId}» подключён.` }));
}

export async function archiveClientChannel(formData: FormData) {
  const channelRecordId = formText(formData, "channelRecordId");

  if (!channelRecordId) {
    errorRedirect("Канал не найден.", "settings");
  }

  try {
    await prisma.clientChannel.update({
      where: { id: channelRecordId },
      data: { status: "archived" },
    });
  } catch {
    errorRedirect("Не удалось отключить канал.", "settings");
  }

  revalidatePath("/");
  redirect(workspaceLocation("settings", { notice: "Канал отключён." }));
}

export async function publishPublicationToTelegram(formData: FormData) {
  const scheduledPublicationId = formText(formData, "scheduledPublicationId");

  if (!scheduledPublicationId) {
    errorRedirect("Не выбрана публикация.", "reports");
  }

  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: { blueprintId: true, monthlyPlanId: true },
  });

  if (!publication) {
    errorRedirect("Публикация не найдена.", "reports");
  }

  const backTo = { blueprintId: publication.blueprintId, planId: publication.monthlyPlanId };
  const outcome = await publishScheduledPublication(scheduledPublicationId);

  revalidatePath("/");

  if (!outcome.ok) {
    redirect(workspaceLocation("reports", { ...backTo, error: `Telegram: ${outcome.error}` }));
  }

  if (outcome.alreadyPublished) {
    redirect(workspaceLocation("reports", { ...backTo, notice: "Материал уже опубликован — повторная отправка не требуется." }));
  }

  redirect(workspaceLocation("reports", { ...backTo, notice: `Опубликовано в Telegram: ${outcome.url}` }));
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

  const assetInputs = creativeAssetCreateInputsFromBrief(
    {
      clientId: publication.clientId,
      blueprintId: publication.blueprintId,
      monthlyPlanId: publication.monthlyPlanId,
      plannedContentItemId: publication.plannedContentItemId,
      contentDraftId: publication.contentDraftId,
      id: publication.id,
      format: publication.format,
      topic: publication.topic,
    },
    {
      assetType,
      title,
      brief,
      formatRequirements,
      textOnAsset,
      references,
      approvalRequired,
      notes,
    },
    {
      status: "needed",
      source: "manual",
    },
  );

  await prisma.$transaction(async (transaction) => {
    for (const assetInput of assetInputs) {
      await transaction.creativeAsset.create({ data: assetInput });
    }

    if (publication.status === "scheduled") {
      await transaction.scheduledPublication.update({
        where: { id: publication.id },
        data: { status: "needs_assets" },
      });
    }
  });

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
      const assetInputs = creativeAssetCreateInputsFromBrief(publication, brief);

      const createdAsset = await prisma.$transaction(async (transaction) => {
        const assets = [];
        for (const assetInput of assetInputs) {
          assets.push(await transaction.creativeAsset.create({ data: assetInput }));
        }

        if (publication.status === "scheduled") {
          await transaction.scheduledPublication.update({
          where: { id: publication.id },
          data: { status: "needs_assets" },
          });
        }

        return assets[0];
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
    const assetInputs = creativeAssetCreateInputsFromBrief(publication, brief);

    const createdAsset = await prisma.$transaction(async (transaction) => {
      const assets = [];
      for (const assetInput of assetInputs) {
        assets.push(await transaction.creativeAsset.create({ data: assetInput }));
      }

      if (publication.status === "scheduled") {
        await transaction.scheduledPublication.update({
          where: { id: publication.id },
          data: { status: "needs_assets" },
        });
      }

      return assets[0];
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

  if (creativeAssetNeedsCarouselSplit(asset)) {
    const splitResult = await splitCreativeAssetIntoCarouselSlides(asset.id);
    const production = splitResult.monthlyPlanId
      ? await enqueueMonthProductionAfterCarouselSplit(splitResult.monthlyPlanId)
      : null;
    const notice = splitResult.status === "created"
      ? `Карусель пересобрана. Визуалы карточек добавлены в очередь. Добавили ${production?.queuedVisualTasks ?? 0} карточек в очередь визуалов.`
      : splitResult.message;

    revalidatePath("/");
    redirect(workspaceLocation(returnViewFromForm(formData, "assets"), {
      blueprintId: asset.blueprintId,
      planId: asset.monthlyPlanId,
      materialId: asset.plannedContentItemId,
      productionRunId: production?.run.id,
      ...(splitResult.status === "failed" ? { error: notice } : { notice }),
    }));
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

export async function rebuildCreativeAssetAsCarousel(formData: FormData) {
  const creativeAssetId = formText(formData, "creativeAssetId");

  if (!creativeAssetId) {
    errorRedirect("Не выбран креативный материал для пересборки.");
  }

  const splitResult = await splitCreativeAssetIntoCarouselSlides(creativeAssetId);

  if (!splitResult.blueprintId || !splitResult.monthlyPlanId) {
    errorRedirect(splitResult.message, "drafts");
  }

  if (splitResult.status === "failed") {
    revalidatePath("/");
    redirect(workspaceLocation(returnViewFromForm(formData, "drafts"), {
      blueprintId: splitResult.blueprintId,
      planId: splitResult.monthlyPlanId,
      materialId: splitResult.plannedContentItemId,
      error: splitResult.message,
    }));
  }

  const production = await enqueueMonthProductionAfterCarouselSplit(splitResult.monthlyPlanId);
  const notice = splitResult.status === "created"
    ? `Карусель пересобрана. Визуалы карточек добавлены в очередь. Добавили ${production.queuedVisualTasks} карточек в очередь визуалов.`
    : "Карусель уже пересобрана.";

  revalidatePath("/");
  redirect(workspaceLocation(returnViewFromForm(formData, "drafts"), {
    blueprintId: splitResult.blueprintId,
    planId: splitResult.monthlyPlanId,
    materialId: splitResult.plannedContentItemId,
    productionRunId: production.run.id,
    notice,
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

  if (!(await brandReadyForVisuals(asset.clientId))) {
    redirect(workspaceLocation(returnViewFromForm(formData, "assets"), {
      blueprintId: asset.blueprintId,
      planId: asset.monthlyPlanId,
      error: BRAND_REQUIRED_FOR_VISUALS_MESSAGE,
    }));
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
    const visualBranding = await getClientVisualBranding(asset.clientId);
    const variant = await generateCreativeVisualVariant({
      clientName: asset.client.name,
      clientIndustry: asset.client.industry,
      brandContext: await getClientBrandContext(asset.clientId),
      brandLogoUrl: visualBranding.logoUrl,
      brandTypography: visualBranding.typography,
      creativeAsset: {
        assetType: asset.assetType,
        // Slide index («Карточка 1 / 4») is a UI badge only — never send it to the visual engine.
        title: stripCarouselSlideLabel(asset.title),
        brief: asset.brief,
        formatRequirements: asset.formatRequirements,
        textOnAsset: asset.textOnAsset ? stripCarouselSlideLabel(asset.textOnAsset) || null : asset.textOnAsset,
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
        inputTokens: variant.inputTokens,
        outputTokens: variant.outputTokens,
        totalTokens: variant.totalTokens,
        estimatedCostUsd: variant.estimatedCostUsd,
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

// ─── Article engine ─────────────────────────────────────────────────────────

function articleRedirect(
  articleId: string | null,
  clientId: string | null,
  outcome: { error?: string; notice?: string },
): never {
  revalidatePath("/");
  redirect(
    workspaceLocation("articles", {
      articleId: articleId ?? undefined,
      clientId: clientId ?? undefined,
      ...outcome,
    }),
  );
}

export async function createArticleAction(formData: FormData) {
  const clientId = formText(formData, "clientId");
  const topic = formText(formData, "topic");
  const angle = formText(formData, "angle");
  const geoFocus = formText(formData, "geoFocus");
  const platformTarget = formText(formData, "platformTarget");
  const provider = formText(formData, "provider");

  if (!clientId) {
    errorRedirect("Выберите клиента для статьи.", "articles");
  }

  if (!topic) {
    articleRedirect(null, clientId, { error: "Укажите тему статьи." });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) {
    errorRedirect("Клиент не найден.", "articles");
  }

  const article = await prisma.article.create({
    data: {
      clientId,
      title: topic,
      angle: angle || null,
      geoFocus: geoFocus || null,
      platformTarget: platformTarget || null,
      provider: provider === "anthropic" || provider === "openai" ? provider : "",
      stage: "brief",
      status: "generating",
    },
  });

  const outcome = await runArticlePipeline(article.id);

  articleRedirect(article.id, clientId, outcome.ok
    ? { notice: "Статья готова: все проходы движка выполнены." }
    : { error: outcome.error });
}

export async function continueArticleAction(formData: FormData) {
  const articleId = formText(formData, "articleId");

  if (!articleId) {
    errorRedirect("Не выбрана статья.", "articles");
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { clientId: true },
  });

  if (!article) {
    errorRedirect("Статья не найдена.", "articles");
  }

  const outcome = await runArticlePipeline(articleId);

  articleRedirect(articleId, article.clientId, outcome.ok
    ? { notice: "Статья готова: все проходы движка выполнены." }
    : { error: outcome.error });
}

export async function regenerateArticleAction(formData: FormData) {
  const articleId = formText(formData, "articleId");
  const provider = formText(formData, "provider");

  if (!articleId) {
    errorRedirect("Не выбрана статья.", "articles");
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { clientId: true },
  });

  if (!article) {
    errorRedirect("Статья не найдена.", "articles");
  }

  await prisma.article.update({
    where: { id: articleId },
    data: {
      stage: "brief",
      status: "generating",
      errorMessage: null,
      briefJson: Prisma.DbNull,
      bodyMarkdown: "",
      faq: [],
      sources: [],
      images: [],
      calloutNotes: [],
      schemaJsonLd: Prisma.DbNull,
      metaTitle: null,
      metaDescription: null,
      wordCount: null,
      ...(provider === "anthropic" || provider === "openai" ? { provider } : {}),
    },
  });

  const outcome = await runArticlePipeline(articleId);

  articleRedirect(articleId, article.clientId, outcome.ok
    ? { notice: "Статья перегенерирована." }
    : { error: outcome.error });
}

export async function archiveArticleAction(formData: FormData) {
  const articleId = formText(formData, "articleId");

  if (!articleId) {
    errorRedirect("Не выбрана статья.", "articles");
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { clientId: true },
  });

  if (!article) {
    errorRedirect("Статья не найдена.", "articles");
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { status: "archived" },
  });

  articleRedirect(null, article.clientId, { notice: "Статья перенесена в архив." })
}

// ─── Onboarding: channels questionnaire ─────────────────────────────────────

const ONBOARDING_CHANNEL_PLATFORMS = ["vk", "telegram", "zen"] as const;

const channelPlatformLabels: Record<(typeof ONBOARDING_CHANNEL_PLATFORMS)[number], string> = {
  vk: "VK",
  telegram: "Telegram",
  zen: "Дзен",
};

/**
 * Creates Launch Kit manager tasks (cover + avatar) for channels the client
 * decided to create from scratch. Idempotent per plan+platform.
 */
async function ensureLaunchKitTasksForPlan(monthlyPlanId: string, clientId: string) {
  const toCreate = await prisma.clientChannel.findMany({
    where: { clientId, status: "to_create" },
    select: { platform: true },
  });
  if (toCreate.length === 0) return;

  const existingTasks = await prisma.managerTask.findMany({
    where: { monthlyPlanId, title: { startsWith: "Launch Kit" } },
    select: { title: true },
  });
  const existingTitles = new Set(existingTasks.map((task) => task.title));

  const tasks = toCreate
    .map((channel) => {
      const label = channelPlatformLabels[channel.platform as keyof typeof channelPlatformLabels] ?? channel.platform;
      return {
        monthlyPlanId,
        title: `Launch Kit: завести канал ${label}`,
        description: `Клиент решил завести ${label} с нуля: создать канал, оформить обложку и аватар в фирменном стиле, затем подключить в Настройки → Каналы клиента.`,
        priority: "high",
        dueDate: "before launch",
        status: "open",
      };
    })
    .filter((task) => !existingTitles.has(task.title));

  if (tasks.length > 0) {
    await prisma.managerTask.createMany({ data: tasks });
  }
}

export async function saveOnboardingChannels(formData: FormData) {
  const clientId = formText(formData, "clientId");
  const blueprintId = formText(formData, "blueprintId") || undefined;
  const planId = formText(formData, "planId") || undefined;

  if (!clientId) {
    errorRedirect("Клиент не выбран.", "client_setup");
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) {
    errorRedirect("Клиент не найден.", "client_setup");
  }

  for (const platform of ONBOARDING_CHANNEL_PLATFORMS) {
    const mode = formText(formData, `channel_${platform}_mode`);
    const link = formText(formData, `channel_${platform}_link`);

    const activeChannel = await prisma.clientChannel.findFirst({
      where: { clientId, platform, status: "active" },
      select: { id: true },
    });
    const draftChannel = await prisma.clientChannel.findFirst({
      where: { clientId, platform, status: { in: ["pending_connect", "to_create"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (activeChannel) {
      // Already connected for real publishing — the questionnaire never downgrades it.
      continue;
    }

    if (mode === "have" && link) {
      if (draftChannel) {
        await prisma.clientChannel.update({
          where: { id: draftChannel.id },
          data: { channelId: link, status: "pending_connect", title: null },
        });
      } else {
        await prisma.clientChannel.create({
          data: { clientId, platform, channelId: link, status: "pending_connect" },
        });
      }
    } else if (mode === "create") {
      if (draftChannel) {
        await prisma.clientChannel.update({
          where: { id: draftChannel.id },
          data: { channelId: "new", status: "to_create" },
        });
      } else {
        await prisma.clientChannel.create({
          data: { clientId, platform, channelId: "new", status: "to_create" },
        });
      }
    } else if (draftChannel) {
      await prisma.clientChannel.delete({ where: { id: draftChannel.id } });
    }
  }

  const plan = planId
    ? await prisma.monthlyOperatingPlan.findUnique({ where: { id: planId }, select: { id: true } })
    : await prisma.monthlyOperatingPlan.findFirst({
        where: { clientId, status: { notIn: ["archived", "replaced"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
  if (plan) {
    await ensureLaunchKitTasksForPlan(plan.id, clientId);
  }

  revalidatePath("/");
  redirect(workspaceLocation("client_setup", {
    clientId,
    blueprintId,
    planId,
    setupStep: "monthly_plan",
    notice: "Каналы сохранены: подключим при публикации, а для новых добавили Launch Kit в задачи.",
  }));
}

// ─── GEO audit: input (upload + best-effort extract) & source-of-truth form ──

const MAX_GEO_REPORT_FILE_SIZE = 40 * 1024 * 1024;

function jsonArrayFromForm<T>(formData: FormData, key: string): T[] {
  const raw = formText(formData, key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function geoChildrenFromExtraction(extraction: GeoAuditExtraction) {
  return {
    engineResults: extraction.engines.map((entry) => ({
      engine: entry.engine,
      mentions: entry.mentions,
      spontaneous: entry.spontaneous,
    })),
    competitors: extraction.competitors.map((entry) => ({
      name: entry.name,
      mentions: entry.mentions,
      sharePercent: entry.sharePercent,
      note: null as string | null,
    })),
    sources: extraction.sources.map((domain) => ({ domain, citations: null as number | null })),
    growthPoints: extraction.growthPoints.map((entry) => ({
      area: entry.area,
      citations: entry.citations,
      note: null as string | null,
    })),
  };
}

export async function uploadGeoAudit(formData: FormData) {
  const clientId = formText(formData, "clientId");
  if (!clientId) errorRedirect("Выберите клиента для GEO-аудита.", "geo");

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) errorRedirect("Клиент не найден.", "geo");

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (hasFile && file.size > MAX_GEO_REPORT_FILE_SIZE) {
    redirect(workspaceLocation("geo", { clientId, error: "Файл слишком большой. Максимум для GEO-отчёта — 40 МБ." }));
  }
  if (hasFile && !/\.pptx$/i.test(file.name) && !file.type.includes("presentation")) {
    redirect(workspaceLocation("geo", { clientId, error: "Загрузите PPTX-отчёт GEO-аудита." }));
  }

  let extraction: GeoAuditExtraction | null = null;
  let stored: Awaited<ReturnType<typeof storeGeoReportFile>> = null;

  if (hasFile) {
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      extraction = await extractGeoAudit(buffer);
    } catch (error) {
      console.error("GEO PPTX extraction failed", error);
      extraction = null;
    }
    try {
      stored = await storeGeoReportFile({ file, clientId });
    } catch (error) {
      console.error("GEO report upload failed", error);
      stored = null;
    }
  }

  const now = new Date();
  const auditDate = extraction?.auditDateISO ? new Date(extraction.auditDateISO) : now;
  const periodLabel = extraction?.periodLabel ?? new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(now);
  const children = extraction ? geoChildrenFromExtraction(extraction) : { engineResults: [], competitors: [], sources: [], growthPoints: [] };

  const created = await prisma.geoAudit.create({
    data: {
      clientId,
      auditDate,
      periodLabel,
      presenceIndex: extraction?.presenceIndex ?? 0,
      sovScore: extraction?.sovScore ?? 0,
      sovMax: extraction?.sovMax ?? 40,
      positionScore: extraction?.positionScore ?? 0,
      positionMax: extraction?.positionMax ?? 25,
      toneScore: extraction?.toneScore ?? 0,
      toneMax: extraction?.toneMax ?? 20,
      accuracyScore: extraction?.accuracyScore ?? 0,
      accuracyMax: extraction?.accuracyMax ?? 15,
      sovPercent: extraction?.sovPercent ?? 0,
      mentionPercent: extraction?.mentionPercent ?? 0,
      queriesTotal: extraction?.queriesTotal ?? 0,
      queriesCategorical: extraction?.queriesCategorical ?? 0,
      queriesBrand: extraction?.queriesBrand ?? 0,
      reportFileUrl: stored?.reportFileUrl ?? null,
      reportStorageKey: stored?.reportStorageKey ?? null,
      engineResults: { create: children.engineResults },
      competitors: { create: children.competitors },
      sources: { create: children.sources },
      growthPoints: { create: children.growthPoints },
    },
    select: { id: true },
  });

  revalidatePath("/");
  const notice = !hasFile
    ? "Пустой аудит создан. Заполните метрики вручную и сохраните."
    : extraction?.matched
      ? "Отчёт загружен, ключевые числа распознаны. Проверьте и подтвердите форму."
      : "Отчёт загружен. Авто-распознавание не сработало — заполните метрики вручную.";
  redirect(workspaceLocation("geo", { clientId, geoAuditId: created.id, notice }));
}

export async function updateGeoAudit(formData: FormData) {
  const geoAuditId = formText(formData, "geoAuditId");
  if (!geoAuditId) errorRedirect("Не выбран аудит.", "geo");

  const audit = await prisma.geoAudit.findUnique({ where: { id: geoAuditId }, select: { id: true, clientId: true } });
  if (!audit) errorRedirect("Аудит не найден.", "geo");

  const auditDateRaw = formText(formData, "auditDate");
  const parsedDate = auditDateRaw ? new Date(auditDateRaw) : null;

  const engineResults = jsonArrayFromForm<{ engine?: string; mentions?: unknown; spontaneous?: unknown }>(formData, "engineResults")
    .filter((entry) => typeof entry.engine === "string" && entry.engine.trim())
    .map((entry) => ({
      engine: String(entry.engine).trim(),
      mentions: Math.max(0, Math.round(Number(entry.mentions) || 0)),
      spontaneous: Math.max(0, Math.round(Number(entry.spontaneous) || 0)),
    }));
  const competitors = jsonArrayFromForm<{ name?: string; mentions?: unknown; sharePercent?: unknown; note?: string }>(formData, "competitors")
    .filter((entry) => typeof entry.name === "string" && entry.name.trim())
    .map((entry) => ({
      name: String(entry.name).trim(),
      mentions: Math.max(0, Math.round(Number(entry.mentions) || 0)),
      sharePercent: Number.isFinite(Number(entry.sharePercent)) && String(entry.sharePercent ?? "") !== "" ? Number(entry.sharePercent) : null,
      note: entry.note ? String(entry.note).trim() : null,
    }));
  const sources = jsonArrayFromForm<{ domain?: string; citations?: unknown }>(formData, "sources")
    .filter((entry) => typeof entry.domain === "string" && entry.domain.trim())
    .map((entry) => ({
      domain: String(entry.domain).trim(),
      citations: Number.isFinite(Number(entry.citations)) && String(entry.citations ?? "") !== "" ? Math.round(Number(entry.citations)) : null,
    }));
  const growthPoints = jsonArrayFromForm<{ area?: string; citations?: unknown; note?: string }>(formData, "growthPoints")
    .filter((entry) => typeof entry.area === "string" && entry.area.trim())
    .map((entry) => ({
      area: String(entry.area).trim(),
      citations: Number.isFinite(Number(entry.citations)) && String(entry.citations ?? "") !== "" ? Math.round(Number(entry.citations)) : null,
      note: entry.note ? String(entry.note).trim() : null,
    }));

  await prisma.$transaction([
    prisma.geoEngineResult.deleteMany({ where: { geoAuditId } }),
    prisma.geoCompetitor.deleteMany({ where: { geoAuditId } }),
    prisma.geoSource.deleteMany({ where: { geoAuditId } }),
    prisma.geoGrowthPoint.deleteMany({ where: { geoAuditId } }),
    prisma.geoAudit.update({
      where: { id: geoAuditId },
      data: {
        auditDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
        periodLabel: formText(formData, "periodLabel") || "Период",
        presenceIndex: Math.max(0, Math.min(100, formInt(formData, "presenceIndex") ?? 0)),
        sovScore: formInt(formData, "sovScore") ?? 0,
        sovMax: formInt(formData, "sovMax") ?? 40,
        positionScore: formInt(formData, "positionScore") ?? 0,
        positionMax: formInt(formData, "positionMax") ?? 25,
        toneScore: formInt(formData, "toneScore") ?? 0,
        toneMax: formInt(formData, "toneMax") ?? 20,
        accuracyScore: formInt(formData, "accuracyScore") ?? 0,
        accuracyMax: formInt(formData, "accuracyMax") ?? 15,
        sovPercent: Number(formText(formData, "sovPercent").replace(",", ".")) || 0,
        mentionPercent: Number(formText(formData, "mentionPercent").replace(",", ".")) || 0,
        queriesTotal: formInt(formData, "queriesTotal") ?? 0,
        queriesCategorical: formInt(formData, "queriesCategorical") ?? 0,
        queriesBrand: formInt(formData, "queriesBrand") ?? 0,
        notes: formText(formData, "notes") || null,
        engineResults: { create: engineResults },
        competitors: { create: competitors },
        sources: { create: sources },
        growthPoints: { create: growthPoints },
      },
    }),
  ]);

  revalidatePath("/");
  redirect(workspaceLocation("geo", { clientId: audit.clientId, geoAuditId, notice: "GEO-аудит сохранён." }));
}

export async function deleteGeoAudit(formData: FormData) {
  const geoAuditId = formText(formData, "geoAuditId");
  if (!geoAuditId) errorRedirect("Не выбран аудит.", "geo");

  const audit = await prisma.geoAudit.findUnique({ where: { id: geoAuditId }, select: { clientId: true } });
  if (!audit) errorRedirect("Аудит не найден.", "geo");

  await prisma.geoAudit.delete({ where: { id: geoAuditId } });

  revalidatePath("/");
  redirect(workspaceLocation("geo", { clientId: audit.clientId, notice: "GEO-аудит удалён." }));
}
