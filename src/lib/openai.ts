import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  ClientPresenceBlueprintSchema,
  validateBlueprintForPersistence,
} from "@/lib/blueprint-schema";
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
          'You convert an approved Client Presence Blueprint into a concrete Monthly Operating Plan. This is not content generation: do not write full posts, articles, emails, captions, or final copy. Generate only structured operational planning data: modules, platforms, themes, formats, planned content items, cadence, approval needs, autopublish eligibility, integrations, manager tasks, and risks. Do not hardcode fixed deliverables or fixed platforms. Use the Blueprint monthly scope, selected modules, recommended platforms, humanReviewPolicy, integrationRequirements, riskRules, confidenceScore, and nextRecommendedAction. If integrations are required before launch, create manager tasks. plannedDate and dueDate must be either YYYY-MM-DD or simple English cadence markers such as "week 1", "week 2", "early month", "before launch", or "after approval". totalPlannedUnits means the total planned monthly content units. plannedContentItems contains the concrete planned items actually listed. Prefer generating a complete list when possible. totalPlannedUnits must never be lower than plannedContentItems.length. Never set autopublishEligible=true for healthcare, medical, legal, financial, regulated, reputation-sensitive, or safety-related content unless the Blueprint explicitly allows it. If unsure, set autopublishEligible=false and approvalRequired=true. For medical or clinic content, default to approvalRequired=true. Return only schema-valid structured data.',
      },
      {
        role: "user",
        content: [
          `Client name: ${input.clientName}`,
          `Planning month: ${input.month}`,
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
