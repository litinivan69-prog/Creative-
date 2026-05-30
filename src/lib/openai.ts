import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  ClientPresenceBlueprintSchema,
  validateBlueprintForPersistence,
} from "@/lib/blueprint-schema";

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
