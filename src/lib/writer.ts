import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";
import { TEXT_MODEL_PREMIUM } from "@/lib/openai";

export type WriterProvider = "openai" | "anthropic";

export const ARTICLE_MODEL_ANTHROPIC = process.env.ARTICLE_MODEL_ANTHROPIC ?? "claude-opus-4-8";
export const ARTICLE_MODEL_OPENAI = process.env.ARTICLE_MODEL_OPENAI ?? TEXT_MODEL_PREMIUM;

export function anthropicAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function openaiAvailable() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type ResolvedWriter = { provider: WriterProvider; model: string };

/**
 * Articles default to Claude when ANTHROPIC_API_KEY is set, otherwise the strong GPT model.
 * An explicit request for an unavailable provider falls back instead of failing.
 */
export function resolveWriter(requested?: string | null): ResolvedWriter {
  const wantsAnthropic = requested === "anthropic" || (!requested && anthropicAvailable());

  if (wantsAnthropic && anthropicAvailable()) {
    return { provider: "anthropic", model: ARTICLE_MODEL_ANTHROPIC };
  }

  if (openaiAvailable()) {
    return { provider: "openai", model: ARTICLE_MODEL_OPENAI };
  }

  if (anthropicAvailable()) {
    return { provider: "anthropic", model: ARTICLE_MODEL_ANTHROPIC };
  }

  throw new WriterUnavailableError();
}

export class WriterUnavailableError extends Error {
  constructor() {
    super("Не настроен ни один AI-провайдер для статей. Добавьте ANTHROPIC_API_KEY или OPENAI_API_KEY.");
    this.name = "WriterUnavailableError";
  }
}

type WriterTextInput = {
  writer: ResolvedWriter;
  system: string;
  prompt: string;
  maxTokens?: number;
};

type WriterJsonInput<T> = WriterTextInput & {
  schema: ZodType<T>;
  schemaName: string;
  /** Compact human-readable shape description, used for providers without native structured outputs. */
  jsonSpec: string;
};

export async function writerText(input: WriterTextInput): Promise<string> {
  if (input.writer.provider === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = client.messages.stream({
      model: input.writer.model,
      max_tokens: input.maxTokens ?? 32000,
      thinking: { type: "adaptive" },
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });
    const message = await stream.finalMessage();
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) {
      throw new Error("Модель не вернула текст.");
    }
    return text;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: input.writer.model,
    input: [
      { role: "system", content: input.system },
      { role: "user", content: input.prompt },
    ],
  });
  const text = response.output_text?.trim();
  if (!text) {
    throw new Error("Модель не вернула текст.");
  }
  return text;
}

function extractJsonPayload(raw: string): string {
  const withoutFences = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  if (withoutFences.startsWith("{") || withoutFences.startsWith("[")) {
    return withoutFences;
  }
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return withoutFences.slice(start, end + 1);
  }
  return withoutFences;
}

export async function writerJson<T>(input: WriterJsonInput<T>): Promise<T> {
  if (input.writer.provider === "anthropic") {
    const text = await writerText({
      writer: input.writer,
      maxTokens: input.maxTokens ?? 16000,
      system: [
        input.system,
        `Ответ верни строго одним JSON-объектом "${input.schemaName}" без markdown-ограждений и пояснений.`,
        "Точная форма JSON:",
        input.jsonSpec,
      ].join("\n"),
      prompt: input.prompt,
    });
    try {
      return input.schema.parse(JSON.parse(extractJsonPayload(text)));
    } catch (error) {
      console.error("Anthropic JSON parse failed", error);
      throw new Error("Модель не вернула структурированный ответ.");
    }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: input.writer.model,
    input: [
      { role: "system", content: input.system },
      { role: "user", content: input.prompt },
    ],
    text: {
      format: zodTextFormat(input.schema, input.schemaName),
    },
  });
  if (!response.output_parsed) {
    throw new Error("Модель не вернула структурированный ответ.");
  }
  return response.output_parsed;
}
