import OpenAI from "openai";

const configuredBaseUrl = process.env.AI_BASE_URL?.trim();

export function aiApiKey() {
  return process.env.AI_API_KEY?.trim()
    || process.env.TIMEWEB_AI_TOKEN?.trim()
    || process.env.OPENAI_API_KEY?.trim()
    || "";
}

export function aiProviderAvailable() {
  return Boolean(aiApiKey());
}

export function createAiClient() {
  const apiKey = aiApiKey();
  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey,
    ...(configuredBaseUrl ? { baseURL: configuredBaseUrl } : {}),
  });
}

/**
 * Timeweb AI Gateway exposes provider-qualified model ids such as
 * `openai/gpt-5.6-terra`. Direct OpenAI keeps the original model id.
 */
export function resolveAiModel(model: string) {
  if (model.includes("/")) return model;

  const explicitPrefix = process.env.AI_MODEL_PREFIX?.trim();
  if (explicitPrefix) {
    return `${explicitPrefix.replace(/\/+$/, "")}/${model}`;
  }

  if (configuredBaseUrl?.includes("api.timeweb.ai")) {
    return `openai/${model}`;
  }

  return model;
}

export function isUnsupportedAiRegionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const details = `${error.name} ${error.message} ${JSON.stringify(error)}`.toLowerCase();
  return details.includes("unsupported_country_region_territory")
    || details.includes("country, region, or territory not supported");
}
