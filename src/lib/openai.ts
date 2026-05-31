import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  ClientPresenceBlueprintSchema,
  validateBlueprintForPersistence,
} from "@/lib/blueprint-schema";
import { ContentDraftSchema } from "@/lib/content-draft-schema";
import { CreativeAssetBriefSchema } from "@/lib/creative-asset-schema";
import { MonthlyOperatingPlanSchema } from "@/lib/monthly-plan-schema";

const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

export async function generateClientPresenceBlueprint(input: {
  clientName: string;
  website?: string | null;
  industry?: string | null;
  rawBrief: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model,
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
  blueprint: unknown;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model,
    input: [
      {
        role: "system",
        content:
          'You convert an approved Client Presence Blueprint into a concrete Monthly Operating Plan. This is not content generation: do not write full posts, articles, emails, captions, or final copy. Generate only structured operational planning data: modules, platforms, themes, formats, planned content items, cadence, approval needs, autopublish eligibility, integrations, manager tasks, and risks. Do not hardcode fixed deliverables or fixed platforms. Use the Blueprint monthly scope, selected modules, recommended platforms, humanReviewPolicy, integrationRequirements, riskRules, confidenceScore, and nextRecommendedAction. plannedContentItems may ONLY use platformName values that exist in Blueprint recommendedPlatforms and the explicit Allowed platform names list. Every plannedContentItem.platformName must exactly match one of the allowed names. Do not introduce Website, Blog, YouTube, Maps, Telegram, VK, or any other platform unless it is present in Blueprint recommendedPlatforms. Platform role guidance is explanatory only and does not authorize adding new platforms. If a useful platform is missing from Blueprint recommendedPlatforms, do not use it in plannedContentItems; mention it only as a managerTask recommendation if relevant. If any Blueprint integrationRequirements item has required=true and the platform is used in selectedPlatforms or plannedContentItems, create a managerTask for that platform. The task title and description must include the exact platformName and words such as integration, connect, access, credentials, and permissions. Do not block planning because integrations are missing; create manager tasks instead. Build the month as a cross-channel calendar using only allowed platforms. Do not group all plannedContentItems by platform. Spread allowed platforms across the month. For each week, combine several relevant allowed platforms when available and give the week a communication theme. Each platform should play a different role. Avoid publishing the same idea in the same wording everywhere. Adapt one strategic theme into platform-native formats. Planned content items should feel like an orchestrated marketing system, not a list of deliverables. Unless the Blueprint strongly requires otherwise, avoid more than 2 consecutive plannedContentItems with the same platformName. plannedDate should preferably use week-based cadence markers: "week 1", "week 2", "week 3", or "week 4". For every plannedContentItem, explain why the item exists in the sequence using sequenceReason. Populate week, campaignTheme, contentPillar, channelRole, and sequenceReason when useful. Platform role guidance: VK is for broader explanation, community, educational content, and social proof. Telegram is for short alive trust-building notes, behind-the-scenes, founder or expert voice, and quick practical insights. Yandex Maps, maps, and directory platforms are for reputation, reviews, local trust, FAQ, and service clarity. Website and blog are for deeper expertise, search-oriented explanation, and long-form trust. Video and social short-form are for attention, simple explanation, and emotional hooks. plannedDate and dueDate must be either YYYY-MM-DD or simple English cadence markers such as "week 1", "week 2", "early month", "before launch", or "after approval". totalPlannedUnits means the total planned monthly content units. plannedContentItems contains the concrete planned items actually listed. Prefer generating a complete list when possible. totalPlannedUnits must never be lower than plannedContentItems.length. Never set autopublishEligible=true for healthcare, medical, legal, financial, regulated, reputation-sensitive, or safety-related content unless the Blueprint explicitly allows it. If unsure, set autopublishEligible=false and approvalRequired=true. For medical or clinic content, default to approvalRequired=true. Return only schema-valid structured data.',
      },
      {
        role: "user",
        content: [
          `Client name: ${input.clientName}`,
          `Planning month: ${input.month}`,
          "Allowed platform names:",
          input.allowedPlatformNames.map((platformName) => `- ${platformName}`).join("\n"),
          "Use only the exact allowed platform names above for every plannedContentItem.platformName.",
          "Client Presence Blueprint JSON:",
          JSON.stringify(input.blueprint, null, 2),
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
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model,
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
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.parse({
    model,
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
