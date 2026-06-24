import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  ClientPresenceBlueprintSchema,
  validateBlueprintForPersistence,
} from "@/lib/blueprint-schema";
import { ContentDraftSchema } from "@/lib/content-draft-schema";
import { CreativeAssetBriefSchema } from "@/lib/creative-asset-schema";
import { MonthlyOperatingPlanSchema } from "@/lib/monthly-plan-schema";
import { MonthlyPlanRevisionProposalSchema } from "@/lib/monthly-plan-revision-schema";
import type { MonthlyProductionScope } from "@/lib/production-scope";

const legacyModel = process.env.OPENAI_MODEL;

export const TEXT_MODEL_DEFAULT = process.env.TEXT_MODEL_DEFAULT ?? legacyModel ?? "gpt-5.4";
export const TEXT_MODEL_PREMIUM = process.env.TEXT_MODEL_PREMIUM ?? process.env.TEXT_MODEL_DEFAULT ?? legacyModel ?? "gpt-5.5";
export const TEXT_MODEL_FAST = process.env.TEXT_MODEL_FAST ?? legacyModel ?? "gpt-5.4-mini";
export const TEXT_MODEL_STRATEGY = process.env.TEXT_MODEL_STRATEGY ?? TEXT_MODEL_PREMIUM;
export const TEXT_MODEL_MONTHLY_PLAN = process.env.TEXT_MODEL_MONTHLY_PLAN ?? TEXT_MODEL_PREMIUM;
export const TEXT_MODEL_CONTENT = process.env.TEXT_MODEL_CONTENT ?? TEXT_MODEL_DEFAULT;
export const TEXT_MODEL_CREATIVE_BRIEF = process.env.TEXT_MODEL_CREATIVE_BRIEF ?? TEXT_MODEL_DEFAULT;

const textModelTasks = ["strategy", "monthly_plan", "content_draft", "creative_brief", "fast"] as const;
type TextModelTask = (typeof textModelTasks)[number];

export function getTextModelForTask(task: TextModelTask) {
  switch (task) {
    case "strategy":
      return TEXT_MODEL_STRATEGY;
    case "monthly_plan":
      return TEXT_MODEL_MONTHLY_PLAN;
    case "content_draft":
      return TEXT_MODEL_CONTENT;
    case "creative_brief":
      return TEXT_MODEL_CREATIVE_BRIEF;
    case "fast":
      return TEXT_MODEL_FAST;
  }
}

export function getTextModelSettings() {
  const defaultUsesLegacy = Boolean(legacyModel && !process.env.TEXT_MODEL_DEFAULT);
  const premiumUsesLegacy = Boolean(legacyModel && !process.env.TEXT_MODEL_PREMIUM && !process.env.TEXT_MODEL_DEFAULT);
  const fastUsesLegacy = Boolean(legacyModel && !process.env.TEXT_MODEL_FAST);

  return {
    strategyModel: getTextModelForTask("strategy"),
    monthlyPlanModel: getTextModelForTask("monthly_plan"),
    contentModel: getTextModelForTask("content_draft"),
    creativeBriefModel: getTextModelForTask("creative_brief"),
    fastModel: getTextModelForTask("fast"),
    legacyModelUsed:
      (!process.env.TEXT_MODEL_STRATEGY && premiumUsesLegacy) ||
      (!process.env.TEXT_MODEL_MONTHLY_PLAN && premiumUsesLegacy) ||
      (!process.env.TEXT_MODEL_CONTENT && defaultUsesLegacy) ||
      (!process.env.TEXT_MODEL_CREATIVE_BRIEF && defaultUsesLegacy) ||
      fastUsesLegacy,
  };
}

const imageModel = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";

const visualProviders = ["openai", "google_later"] as const;
type VisualProvider = (typeof visualProviders)[number];

const visualTextModes = ["image_text", "overlay_later", "no_text"] as const;
type VisualTextMode = (typeof visualTextModes)[number];

const imageQualities = ["low", "medium", "high", "auto"] as const;
type ImageQuality = (typeof imageQualities)[number];

const imageSizes = ["auto", "1024x1024", "1536x1024", "1024x1536"] as const;
type ImageSize = (typeof imageSizes)[number];

const reasoningEfforts = ["low", "medium", "high"] as const;
type ReasoningEffort = (typeof reasoningEfforts)[number];

function configuredValue<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const visualProvider = configuredValue(process.env.VISUAL_PROVIDER, visualProviders, "openai");
const visualTextMode = configuredValue(process.env.VISUAL_TEXT_MODE, visualTextModes, "image_text");
const imageQuality = configuredValue(process.env.OPENAI_IMAGE_QUALITY, imageQualities, "high");
const imageSize = configuredValue(process.env.OPENAI_IMAGE_SIZE ?? "auto", imageSizes, "1024x1024");

function supportsReasoningEffort(model: string) {
  return /^gpt-5(?:[.-]|$)/i.test(model) || /^o\d/i.test(model);
}

function getTextReasoningForTask(task: TextModelTask) {
  const model = getTextModelForTask(task);

  if (!supportsReasoningEffort(model)) {
    return {};
  }

  let effort: ReasoningEffort;

  switch (task) {
    case "strategy":
    case "monthly_plan":
      effort = configuredValue(process.env.TEXT_REASONING_EFFORT_STRATEGY, reasoningEfforts, "medium");
      break;
    case "content_draft":
      effort = configuredValue(process.env.TEXT_REASONING_EFFORT_CONTENT, reasoningEfforts, "low");
      break;
    case "creative_brief":
      effort = configuredValue(process.env.TEXT_REASONING_EFFORT_CREATIVE, reasoningEfforts, "medium");
      break;
    case "fast":
      effort = "low";
      break;
  }

  return { reasoning: { effort } };
}

export async function generateClientPresenceBlueprint(input: {
  clientName: string;
  website?: string | null;
  industry?: string | null;
  rawBrief: string;
  brandContext?: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model: getTextModelForTask("strategy"),
    ...getTextReasoningForTask("strategy"),
    input: [
      {
        role: "system",
        content:
          "You design adaptive AI-powered digital presence systems for businesses. Generate a custom Client Presence Blueprint from the brief. The Blueprint must be an executable product configuration, not only a strategic explanation. All volume, platform, automation, integration, and review decisions must be machine-readable. Do not use fixed deliverable packages, do not assume a fixed platform list, and make every platform/module recommendation traceable to the brief. Do not invent missing details. If the brief is incomplete, list missingBriefFields and assumptions explicitly. confidenceScore must reflect how reliable the Blueprint is based on the brief, from 0 to 100. nextRecommendedAction must guide the manager to the next operational step. Return only schema-valid structured data.",
      },
      {
        role: "user",
        content: [
          `Client name: ${input.clientName}`,
          `Website: ${input.website || "Not provided"}`,
          `Industry: ${input.industry || "Not provided"}`,
          "Raw brief:",
          input.rawBrief,
          "Brand context / Контекст бренда клиента:",
          input.brandContext || "Not provided",
        ].join("\n"),
      },
    ],
    text: {
      format: zodTextFormat(ClientPresenceBlueprintSchema, "client_presence_blueprint"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a parseable blueprint.");
  }

  return validateBlueprintForPersistence(response.output_parsed);
}

export async function generateMonthlyOperatingPlan(input: {
  clientName: string;
  month: string;
  allowedPlatformNames: string[];
  productionScope?: MonthlyProductionScope;
  blueprint: unknown;
  brandContext?: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model: getTextModelForTask("monthly_plan"),
    ...getTextReasoningForTask("monthly_plan"),
    input: [
      {
        role: "system",
        content:
          'You convert an approved Client Presence Blueprint into a concrete Monthly Operating Plan. This is not content generation: do not write full posts, articles, emails, captions, or final copy. Generate only structured operational planning data: modules, platforms, themes, formats, planned content items, cadence, approval needs, autopublish eligibility, integrations, manager tasks, and risks. Behave like a senior marketing strategist working inside a strict production scope. If a deliverable is not explicitly allowed by the production scope, do not create it. Use only productionScope.allowedPlatforms and productionScope.allowedDeliverables. Never create anything from productionScope.forbiddenDeliverables. Do not invent platforms, formats, advertising mockups, marketplace seller/admin tasks, site/landing work, email campaigns, or generic promotional assets unless explicitly allowed. If scope is insufficient, create a clear managerTask instead of inventing deliverables. Use productionScope.cadenceRules and productionScope.strategicThemes when planning topics. Yandex Maps or review channels are reputation/responding channels: do not treat review replies as normal scheduled posts unless the scope explicitly asks for scheduled reputation content; create manager tasks for manual review import if needed. Use the Blueprint monthly scope, selected modules, recommended platforms, humanReviewPolicy, integrationRequirements, riskRules, confidenceScore, and nextRecommendedAction. plannedContentItems may ONLY use platformName values that exist in Blueprint recommendedPlatforms, the explicit Allowed platform names list, and productionScope.allowedPlatforms. Every plannedContentItem.platformName must exactly match one of the allowed names. Avoid operationally vague channels unless the client brief explicitly requires them for the current month. For marketplaces, generate content only if marketplace cards, product-card updates, or marketplace content are part of the current scope. Do not add marketplace seller/admin work just because a marketplace exists. Produce concrete usable publication topics, not abstract operational placeholders. Platform role guidance is explanatory only and does not authorize adding new platforms. If a useful platform is missing from the allowed lists, do not use it in plannedContentItems; mention it only as a managerTask recommendation if relevant. If any Blueprint integrationRequirements item has required=true and the platform is used in selectedPlatforms or plannedContentItems, create a managerTask for that platform. The task title and description must include the exact platformName and words such as integration, connect, access, credentials, and permissions. Do not block planning because integrations are missing; create manager tasks instead. Build the month as a cross-channel calendar using only allowed platforms. Do not group all plannedContentItems by platform. Spread allowed platforms across the month. For each week, combine several relevant allowed platforms when available and give the week a communication theme. Each platform should play a different role. Avoid publishing the same idea in the same wording everywhere. Adapt one strategic theme into platform-native formats. Planned content items should feel like an orchestrated marketing system, not a list of deliverables. Unless the Blueprint strongly requires otherwise, avoid more than 2 consecutive plannedContentItems with the same platformName. Every plannedContentItem.plannedDate must be an exact YYYY-MM-DD date inside the selected planning month. Do not return vague values such as "week 1", "week 2", "early month", "mid month", "late month", "after approval", or "as needed" as plannedDate. Use week only as additional grouping metadata, not as the publication date. Distribute exact plannedDate values across the month like a senior content planner. For every plannedContentItem, explain why the item exists in the sequence using sequenceReason. Populate week, campaignTheme, contentPillar, channelRole, and sequenceReason when useful. dueDate for managerTasks may be YYYY-MM-DD or simple English cadence markers such as "before launch" or "after approval"; plannedDate for content items must always be YYYY-MM-DD. totalPlannedUnits means the total planned monthly content units. plannedContentItems contains the concrete planned items actually listed. Prefer generating a complete list when possible. totalPlannedUnits must never be lower than plannedContentItems.length. Never set autopublishEligible=true for healthcare, medical, legal, financial, regulated, reputation-sensitive, or safety-related content unless the Blueprint explicitly allows it. If unsure, set autopublishEligible=false and approvalRequired=true. For medical or clinic content, default to approvalRequired=true. Return only schema-valid structured data.',
      },
      {
        role: "user",
        content: [
          `Client name: ${input.clientName}`,
          `Planning month: ${input.month}`,
          `Every plannedContentItem.plannedDate must be an exact date within ${input.month} in YYYY-MM-DD format.`,
          "Allowed platform names:",
          input.allowedPlatformNames.map((platformName) => `- ${platformName}`).join("\n"),
          "Use only the exact allowed platform names above for every plannedContentItem.platformName.",
          "Strict production scope JSON:",
          JSON.stringify(input.productionScope ?? null, null, 2),
          "If a platform or deliverable is not explicitly allowed in productionScope, do not create it. If a forbiddenDeliverables item is relevant, avoid it and create a managerTask instead.",
          "Client Presence Blueprint JSON:",
          JSON.stringify(input.blueprint, null, 2),
          "Brand context / Контекст бренда клиента:",
          input.brandContext || "Not provided",
        ].join("\n"),
      },
    ],
    text: {
      format: zodTextFormat(MonthlyOperatingPlanSchema, "monthly_operating_plan"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a parseable monthly operating plan.");
  }

  return response.output_parsed;
}

export async function generateMonthlyPlanRevisionProposal(input: {
  clientName: string;
  instruction: string;
  monthlyPlan: unknown;
  blueprint: unknown;
  brandContext?: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model: getTextModelForTask("monthly_plan"),
    ...getTextReasoningForTask("monthly_plan"),
    input: [
      {
        role: "system",
        content:
          "You are a senior marketing operations copilot for an agency manager. Revise an existing Monthly Operating Plan by returning a structured revision proposal that the product may apply with server-side safety rules. Return structured JSON with summary, removeItems, updateItems, addItems, and protectedItems. Return all top-level arrays even when empty. Do not omit fields. For every updateItems and addItems object, return angle as a string; if there is no angle, return an empty string. Use only plannedContentItemId values from the provided plan for remove/update/protected items. Do not remove or update approved, client-approved, sent-to-client, ready-to-schedule, published, creative-asset, or generated-visual items. If an item should not be touched, list it under protectedItems with a reason. Prefer replacing abstract or operationally wrong items with concrete usable publication topics. Preserve brand context. Keep proposed additions realistic and platform-native. Explain what will change in the summary. Return only schema-valid structured data.",
      },
      {
        role: "user",
        content: [
          `Client name: ${input.clientName}`,
          "Manager instruction:",
          input.instruction,
          "Current monthly plan JSON:",
          JSON.stringify(input.monthlyPlan, null, 2),
          "Client Blueprint context JSON:",
          JSON.stringify(input.blueprint, null, 2),
          "Brand context / Контекст бренда клиента:",
          input.brandContext || "Not provided",
        ].join("\n"),
      },
    ],
    text: {
      format: zodTextFormat(MonthlyPlanRevisionProposalSchema, "monthly_plan_revision_proposal"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a parseable monthly plan revision proposal.");
  }

  return response.output_parsed;
}

export async function generateContentDraft(input: {
  clientName: string;
  blueprintSummary: string;
  monthlyPlanSummary: string;
  plannedContentItem: unknown;
  approvalStrategy: string;
  riskSummary: string;
  platform: string;
  format: string;
  topic: string;
  goal: string;
  brandContext?: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model: getTextModelForTask("content_draft"),
    ...getTextReasoningForTask("content_draft"),
    input: [
      {
        role: "system",
        content:
          "Generate exactly one safe content draft for one planned content item. Respect the requested platform, format, topic, and goal. The result is a manager-review draft only: do not publish anything. Do not make medical, legal, financial, safety, or guaranteed claims. Do not invent factual claims, prices, doctors, licenses, cases, certifications, or guarantees. For healthcare, clinic, safety, reputation-sensitive, regulated, medical, legal, or financial content, set approvalRequired=true, autopublishEligible=false, and status=needs_review. If unsure, set approvalRequired=true, autopublishEligible=false, and status=needs_review. The draft must be useful, safe, and ready for manager review. Return only schema-valid structured data.",
      },
      {
        role: "user",
        content: [
          `Client name: ${input.clientName}`,
          `Blueprint summary: ${input.blueprintSummary}`,
          `Monthly plan summary: ${input.monthlyPlanSummary}`,
          `Approval strategy: ${input.approvalStrategy}`,
          `Risk summary: ${input.riskSummary}`,
          `Platform: ${input.platform}`,
          `Format: ${input.format}`,
          `Topic: ${input.topic}`,
          `Goal: ${input.goal}`,
          "Planned content item JSON:",
          JSON.stringify(input.plannedContentItem, null, 2),
          "Brand context / Контекст бренда клиента:",
          input.brandContext || "Not provided",
        ].join("\n"),
      },
    ],
    text: {
      format: zodTextFormat(ContentDraftSchema, "content_draft"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a parseable content draft.");
  }

  return response.output_parsed;
}

export async function generateCreativeAssetBrief(input: {
  clientName: string;
  clientIndustry?: string | null;
  blueprintSummary: string;
  blueprintContext: unknown;
  monthlyPlanSummary: string;
  scheduledPublication: unknown;
  plannedContentItem: unknown;
  contentDraft: unknown;
  platformName: string;
  format: string;
  topic: string;
  brandContext?: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model: getTextModelForTask("creative_brief"),
    ...getTextReasoningForTask("creative_brief"),
    input: [
      {
        role: "system",
        content:
          'Create exactly one practical creative asset brief for one scheduled publication. Think like a senior art director and SMM strategist working for the Russian market. Return every user-facing text field in natural Russian. Adapt the brief to the exact platform, format, topic, content draft, client context, Blueprint review policy, and risk requirements. Consider channel-native behavior for VK, Telegram, Яндекс Карты, websites, and other Russian-market surfaces when those platforms are present. The brief must explain the visual idea, composition, mood, and what a designer or future AI image/video tool should create. Include practical formatRequirements with dimensions, aspect ratio, duration, or platform requirements when inferable. Keep textOnAsset short and exact; use an empty string when no text should appear on the visual. references must describe a visual reference direction, not external URLs. Avoid text-heavy visuals unless the format requires them. Do not invent facts, certifications, prices, people, licenses, cases, guarantees, or unsupported before/after claims. Avoid unsafe medical, legal, financial, or reputation-sensitive promises. approvalRequired should usually be true for client-facing visual assets and must be true when the context is regulated, sensitive, or uncertain. This sprint creates only a structured brief: do not generate an image, video, design file, or publication. Return only schema-valid structured JSON.',
      },
      {
        role: "user",
        content: [
          `Client name: ${input.clientName}`,
          `Client industry: ${input.clientIndustry || "Not provided"}`,
          `Blueprint summary: ${input.blueprintSummary}`,
          `Monthly plan summary: ${input.monthlyPlanSummary}`,
          `Platform: ${input.platformName}`,
          `Format: ${input.format}`,
          `Topic: ${input.topic}`,
          "Relevant Blueprint JSON:",
          JSON.stringify(input.blueprintContext, null, 2),
          "Scheduled publication JSON:",
          JSON.stringify(input.scheduledPublication, null, 2),
          "Planned content item JSON:",
          JSON.stringify(input.plannedContentItem, null, 2),
          "Content draft JSON:",
          JSON.stringify(input.contentDraft, null, 2),
          "Brand context / Контекст бренда клиента:",
          input.brandContext || "Not provided",
        ].join("\n"),
      },
    ],
    text: {
      format: zodTextFormat(CreativeAssetBriefSchema, "creative_asset_brief"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The model did not return a parseable creative asset brief.");
  }

  return response.output_parsed;
}

type CreativeVisualVariantInput = {
  clientName: string;
  clientIndustry?: string | null;
  creativeAsset: {
    assetType: string;
    title: string;
    brief: string;
    formatRequirements?: string | null;
    textOnAsset?: string | null;
    references?: string | null;
    notes?: string | null;
  };
  scheduledPublication: {
    platformName: string;
    format: string;
    topic: string;
    scheduledDate: string;
    scheduledTime?: string | null;
  };
  contentDraft: {
    draftTitle: string;
    draftBody: string;
    riskLevel: string;
    approvalRequired: boolean;
  };
  brandContext?: string;
};

function textRenderingInstruction(input: CreativeVisualVariantInput, mode: VisualTextMode) {
  if (mode === "image_text" && input.creativeAsset.textOnAsset) {
    return [
      `Render only this exact short Russian text inside the image: "${input.creativeAsset.textOnAsset}".`,
      "Use clean premium typography. Preserve every Cyrillic letter exactly. Add no extra text, labels, captions, or invented words.",
    ].join(" ");
  }

  if (mode === "overlay_later" && input.creativeAsset.textOnAsset) {
    return [
      "Do not render any text inside the image. Leave clean negative space for a later design overlay.",
      `The future overlay copy will be: "${input.creativeAsset.textOnAsset}".`,
    ].join(" ");
  }

  return "Do not render any text, letters, captions, labels, watermarks, signage, or logos inside the image.";
}

function premiumVisualPrompt(input: CreativeVisualVariantInput, textMode: VisualTextMode) {
  return [
    "Create one premium client-facing social media visual. Act as a senior art director, advertising photographer, and SMM designer.",
    `Client: ${input.clientName}.`,
    `Industry: ${input.clientIndustry || "not provided"}.`,
    `Platform: ${input.scheduledPublication.platformName}.`,
    `Publication format: ${input.scheduledPublication.format}.`,
    `Publication topic: ${input.scheduledPublication.topic}.`,
    `Creative asset type: ${input.creativeAsset.assetType}.`,
    `Creative brief title: ${input.creativeAsset.title}.`,
    `Creative brief: ${input.creativeAsset.brief}`,
    input.creativeAsset.formatRequirements
      ? `Format requirements: ${input.creativeAsset.formatRequirements}`
      : null,
    input.creativeAsset.references
      ? `Reference direction: ${input.creativeAsset.references}`
      : null,
    input.creativeAsset.notes
      ? `Brand and safety notes: ${input.creativeAsset.notes}`
      : null,
    input.brandContext ? `Brand context / Контекст бренда клиента:\n${input.brandContext}` : null,
    `Draft title: ${input.contentDraft.draftTitle}.`,
    `Draft context: ${input.contentDraft.draftBody}`,
    "Produce a realistic premium advertising photograph or high-end editorial visual appropriate to the asset type. Use an intentional focal point, clean composition, restrained color discipline, thoughtful lighting, and platform-native framing.",
    "Avoid cheap stock-photo aesthetics, generic AI poster composition, decorative clutter, fake clinic or company names, fake logos, fake text, fake certificates, fake reviews, unsupported medical claims, guarantees, before-and-after comparisons, and unrealistic treatment or business results.",
    "Do not invent a logo. If logo is needed, leave clean space for logo placement unless real logo integration is available.",
    "When people appear, render natural anatomy, credible hands, expressive but realistic faces, and professional context. Do not depict misleading procedures or outcomes.",
    textRenderingInstruction(input, textMode),
    input.contentDraft.riskLevel !== "low" || input.contentDraft.approvalRequired
      ? "Use a conservative, factual, calm, non-misleading visual direction suitable for mandatory human review."
      : null,
    "Generate exactly one finished visual. Do not add an explanation.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateVisualWithOpenAI(input: CreativeVisualVariantInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = premiumVisualPrompt(input, visualTextMode);

  let selectedSize: ImageSize = imageSize;
  let response;

  try {
    response = await openai.images.generate({
      model: imageModel,
      prompt,
      n: 1,
      size: selectedSize,
      quality: imageQuality,
      output_format: "png",
    });
  } catch (error) {
    if (selectedSize !== "auto") {
      throw error;
    }

    selectedSize = "1024x1024";
    response = await openai.images.generate({
      model: imageModel,
      prompt,
      n: 1,
      size: selectedSize,
      quality: imageQuality,
      output_format: "png",
    });
  }

  const image = response.data?.[0];

  if (!image?.b64_json) {
    throw new Error("The image model did not return image data.");
  }

  return {
    prompt,
    revisedPrompt: image.revised_prompt ?? null,
    imageBase64: image.b64_json,
    mimeType: "image/png",
    provider: "openai",
    model: imageModel,
    quality: imageQuality,
    size: selectedSize,
    textMode: visualTextMode,
  };
}

export async function generateCreativeVisualVariant(input: CreativeVisualVariantInput) {
  if (visualProvider === "openai") {
    return generateVisualWithOpenAI(input);
  }

  // TODO: Google Nano Banana / Gemini Image provider will be added after API credentials and SDK choice are confirmed.
  throw new Error(`Visual provider is not implemented yet: ${visualProvider satisfies VisualProvider}.`);
}
