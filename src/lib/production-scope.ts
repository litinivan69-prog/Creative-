import { parseExactPlanDate } from "@/lib/monthly-plan-dates";
import type { MonthlyOperatingPlan } from "@/lib/monthly-plan-schema";

export type MonthlyProductionScope = {
  allowedPlatforms: string[];
  allowedDeliverables: string[];
  forbiddenDeliverables: string[];
  cadenceRules: string[];
  strategicThemes: string[];
  reputationTasks: string[];
};

const defaultForbiddenDeliverables = [
  "рекламные макеты",
  "рекламный макет",
  "рекламные баннеры",
  "баннер",
  "лендинг",
  "landing",
  "сайт бренда",
  "сайт",
  "website",
  "ozon seller",
  "ozon",
  "wildberries",
  "email",
  "email campaign",
  "наружная реклама",
  "offline",
];

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function parseScopeList(value: string) {
  return unique(
    value
      .split(/\r?\n|,/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim()),
  );
}

export function normalizeScopeToken(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function includesToken(text: string, token: string) {
  const normalizedText = normalizeScopeToken(text);
  const normalizedToken = normalizeScopeToken(token);
  return Boolean(normalizedToken) && normalizedText.includes(normalizedToken);
}

function inferDeliverablesFromFormats(formats: unknown) {
  if (!Array.isArray(formats)) return [];
  return formats.filter((format): format is string => typeof format === "string");
}

export function buildProductionScope(input: {
  allowedPlatforms?: string[];
  allowedDeliverables?: string[];
  forbiddenDeliverables?: string[];
  cadenceRules?: string[];
  strategicThemes?: string[];
  reputationTasks?: string[];
  fallbackPlatforms?: string[];
  fallbackDeliverables?: string[];
}): MonthlyProductionScope {
  return {
    allowedPlatforms: unique(input.allowedPlatforms?.length ? input.allowedPlatforms : input.fallbackPlatforms ?? []),
    allowedDeliverables: unique(input.allowedDeliverables?.length ? input.allowedDeliverables : input.fallbackDeliverables ?? []),
    forbiddenDeliverables: unique([...(input.forbiddenDeliverables ?? []), ...defaultForbiddenDeliverables]),
    cadenceRules: unique(input.cadenceRules ?? []),
    strategicThemes: unique(input.strategicThemes ?? []),
    reputationTasks: unique(input.reputationTasks ?? []),
  };
}

export function productionScopeFromFormData(
  formData: FormData,
  fallback: {
    recommendedPlatforms: Array<{ platformName: string; contentFormats?: unknown }>;
    scopeByModule?: Array<{ unitType?: unknown }>;
  },
) {
  const fallbackDeliverables = unique([
    ...fallback.recommendedPlatforms.flatMap((platform) => inferDeliverablesFromFormats(platform.contentFormats)),
    ...(fallback.scopeByModule ?? []).flatMap((scope) => (typeof scope.unitType === "string" ? [scope.unitType] : [])),
    "post",
    "article",
    "visual",
    "review reply",
    "пост",
    "статья",
    "визуал",
    "ответ на отзыв",
  ]);

  return buildProductionScope({
    allowedPlatforms: parseScopeList(String(formData.get("scopeAllowedPlatforms") ?? "")),
    allowedDeliverables: parseScopeList(String(formData.get("scopeAllowedDeliverables") ?? "")),
    forbiddenDeliverables: parseScopeList(String(formData.get("scopeForbiddenDeliverables") ?? "")),
    cadenceRules: parseScopeList(String(formData.get("scopeCadenceRules") ?? "")),
    strategicThemes: parseScopeList(String(formData.get("scopeStrategicThemes") ?? "")),
    reputationTasks: parseScopeList(String(formData.get("scopeReputationTasks") ?? "")),
    fallbackPlatforms: fallback.recommendedPlatforms.map((platform) => platform.platformName),
    fallbackDeliverables,
  });
}

function itemText(item: { platformName: string; format: string; topic: string; goal: string }) {
  return [item.platformName, item.format, item.topic, item.goal].join(" ");
}

function deliverableAllowed(item: { format: string; topic: string; goal: string }, scope: MonthlyProductionScope) {
  if (scope.allowedDeliverables.length === 0) return true;
  const text = [item.format, item.topic, item.goal].join(" ");
  return scope.allowedDeliverables.some((deliverable) => includesToken(text, deliverable));
}

function forbiddenHit(text: string, forbiddenDeliverables: string[]) {
  return forbiddenDeliverables.find((deliverable) => includesToken(text, deliverable));
}

export function enforceProductionScope(plan: MonthlyOperatingPlan, scope: MonthlyProductionScope) {
  const allowedPlatformSet = new Set(scope.allowedPlatforms.map(normalizeScopeToken));
  const removedReasons: string[] = [];

  plan.selectedPlatforms = plan.selectedPlatforms.filter((platform) => {
    const allowed = allowedPlatformSet.size === 0 || allowedPlatformSet.has(normalizeScopeToken(platform.platformName));
    if (!allowed) removedReasons.push(`площадка ${platform.platformName} не входит в scope`);
    return allowed;
  });

  plan.plannedContentItems = plan.plannedContentItems.filter((item) => {
    if (allowedPlatformSet.size > 0 && !allowedPlatformSet.has(normalizeScopeToken(item.platformName))) {
      removedReasons.push(`материал «${item.topic}» использует площадку вне scope: ${item.platformName}`);
      return false;
    }

    const forbidden = forbiddenHit(itemText(item), scope.forbiddenDeliverables);
    if (forbidden) {
      removedReasons.push(`материал «${item.topic}» похож на запрещённое: ${forbidden}`);
      return false;
    }

    if (!deliverableAllowed(item, scope)) {
      removedReasons.push(`формат «${item.format}» не входит в разрешённые deliverables`);
      return false;
    }

    return true;
  });

  for (const item of plan.plannedContentItems) {
    if (!parseExactPlanDate(item.plannedDate)) {
      item.week = item.week || item.plannedDate;
    }
  }

  if (plan.plannedContentItems.length === 0) {
    throw new Error("AI вышел за рамки scope: не осталось разрешённых материалов для месячного плана.");
  }

  plan.totalPlannedUnits = Math.max(plan.totalPlannedUnits, plan.plannedContentItems.length);

  if (removedReasons.length > 0) {
    plan.managerTasks.push({
      title: "Проверить scope месяца",
      description: `AI предложил элементы вне scope; они были удалены перед сохранением: ${removedReasons.slice(0, 5).join("; ")}.`,
      priority: "high",
      dueDate: "before launch",
      status: "open",
    });
  }

  return { plan, removedReasons };
}
