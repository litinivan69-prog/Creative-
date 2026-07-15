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

// ─── Cadence limits («вк и тг 3 поста в неделю», «статьи 4 в месяц») ────────

export type CadenceLimits = {
  articlesPerMonth: number | null;
  postsPerWeek: {
    vk: number | null;
    tg: number | null;
    other: number | null;
  };
};

export type CadencePlatformClass = "vk" | "tg" | "other";

export function cadencePlatformClass(platformName: string): CadencePlatformClass {
  const text = normalizeScopeToken(platformName);
  if (/telegram|телег|(^|[^а-яa-z])тг([^а-яa-z]|$)/.test(text)) return "tg";
  if (/vkontakte|вконтакте|(^|[^a-z])vk([^a-z]|$)|(^|[^а-яa-z])вк([^а-яa-z]|$)/.test(text)) return "vk";
  return "other";
}

/**
 * Parses free-form cadence rules from the month scope. Understands per-week
 * post limits (optionally scoped to VK/TG) and per-month article counts.
 */
export function parseCadenceLimits(cadenceRules: string[]): CadenceLimits {
  const limits: CadenceLimits = {
    articlesPerMonth: null,
    postsPerWeek: { vk: null, tg: null, other: null },
  };

  const applyPostLimit = (key: CadencePlatformClass, value: number) => {
    const current = limits.postsPerWeek[key];
    limits.postsPerWeek[key] = current === null ? value : Math.min(current, value);
  };

  for (const rule of cadenceRules) {
    const text = normalizeScopeToken(rule);
    const numberMatch = text.match(/\d+/);
    if (!numberMatch) continue;
    const value = Math.max(0, Number(numberMatch[0]));

    const mentionsArticle = /стать|статей|статьи|article/.test(text);
    const perWeek = /недел|week/.test(text);
    const perMonth = /месяц|month/.test(text);

    if (mentionsArticle && !perWeek) {
      limits.articlesPerMonth = limits.articlesPerMonth === null ? value : Math.min(limits.articlesPerMonth, value);
      continue;
    }

    if (!perWeek && !perMonth) continue;
    if (mentionsArticle) continue;

    // Weekly post limit; "N в месяц" for posts converts to a weekly ceiling.
    const weeklyValue = perWeek ? value : Math.max(1, Math.ceil(value / 4));
    const mentionsVk = /vkontakte|вконтакте|(^|[^a-z])vk([^a-z]|$)|(^|[^а-яa-z])вк([^а-яa-z]|$)/.test(text);
    const mentionsTg = /telegram|телег|(^|[^а-яa-z])тг([^а-яa-z]|$)/.test(text);

    if (mentionsVk) applyPostLimit("vk", weeklyValue);
    if (mentionsTg) applyPostLimit("tg", weeklyValue);
    if (!mentionsVk && !mentionsTg) {
      applyPostLimit("vk", weeklyValue);
      applyPostLimit("tg", weeklyValue);
      applyPostLimit("other", weeklyValue);
    }
  }

  return limits;
}

type CadencePlanItem = {
  platformName: string;
  plannedDate: string;
  pairGroupId?: string | null;
};

function weekOfMonthKey(plannedDate: string) {
  const parsed = parseExactPlanDate(plannedDate);
  if (!parsed) return plannedDate || "floating";
  const day = Number(plannedDate.slice(8, 10));
  return `${plannedDate.slice(0, 7)}-w${Math.min(4, Math.floor((day - 1) / 7) + 1)}`;
}

/**
 * Enforces weekly post limits per platform after VK+TG pairing.
 * Works in pair units: a unit is kept only if every item in it fits its
 * platform's weekly budget, so pairs are never half-dropped.
 */
export function enforceCadenceOnPlannedItems<T extends CadencePlanItem>(
  items: T[],
  limits: CadenceLimits,
): { kept: T[]; removedCount: number } {
  const hasAnyLimit = Object.values(limits.postsPerWeek).some((value) => value !== null);
  if (!hasAnyLimit) return { kept: items, removedCount: 0 };

  const units = new Map<string, T[]>();
  const order: string[] = [];
  items.forEach((item, index) => {
    const key = item.pairGroupId ?? `single-${index}`;
    if (!units.has(key)) {
      units.set(key, []);
      order.push(key);
    }
    units.get(key)!.push(item);
  });

  const sortedKeys = order.sort((left, right) => {
    const leftDate = units.get(left)![0]?.plannedDate ?? "";
    const rightDate = units.get(right)![0]?.plannedDate ?? "";
    return leftDate.localeCompare(rightDate);
  });

  const counts = new Map<string, number>();
  const kept: T[] = [];
  let removedCount = 0;

  for (const key of sortedKeys) {
    const unit = units.get(key)!;
    const slots = unit.map((item) => ({
      countKey: `${cadencePlatformClass(item.platformName)}:${weekOfMonthKey(item.plannedDate)}`,
      limit: limits.postsPerWeek[cadencePlatformClass(item.platformName)],
    }));
    const fits = slots.every((slot) => slot.limit === null || (counts.get(slot.countKey) ?? 0) < slot.limit);

    if (fits) {
      for (const slot of slots) {
        counts.set(slot.countKey, (counts.get(slot.countKey) ?? 0) + 1);
      }
      kept.push(...unit);
    } else {
      removedCount += unit.length;
    }
  }

  return { kept, removedCount };
}
