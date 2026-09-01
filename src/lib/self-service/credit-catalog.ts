// Enough for a real trial: two posts with visuals and one article with a cover.
export const TRIAL_CREDITS = 9;
export const CREDIT_DISPLAY_MULTIPLIER = 100;

export function displayCredits(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value * CREDIT_DISPLAY_MULTIPLIER);
}

export const CREDIT_PRODUCTS = {
  text_post: { label: "Пост без визуала", credits: 1 },
  visual_post: { label: "Пост с визуалом", credits: 2 },
  article: { label: "Статья Дзен или VC.ru", credits: 4 },
  article_with_cover: { label: "Статья с обложкой", credits: 5 },
  carousel: { label: "Карусель из 4 слайдов", credits: 5 },
  carousel_extra_slide: { label: "Дополнительный слайд", credits: 1 },
  visual_revision: { label: "Правка визуала по комментарию", credits: 1 },
  quick_announcement: { label: "Быстрый анонс", credits: 1 },
  review_reply: { label: "Ответ на отзыв", credits: 1 },
} as const;

export type CreditProductCode = keyof typeof CREDIT_PRODUCTS;

export const CREDIT_PLANS = [
  { code: "start", name: "Старт", credits: 30, monthlyPriceMinor: 990_000, description: "Для регулярного контента одного бренда" },
  { code: "growth", name: "Рост", credits: 70, monthlyPriceMinor: 1_790_000, description: "Для регулярных постов, статей и каруселей", featured: true },
  { code: "pro", name: "Про", credits: 130, monthlyPriceMinor: 2_490_000, description: "Для активного месяца и нескольких форматов" },
] as const;

export type CreditPlanCode = (typeof CREDIT_PLANS)[number]["code"];
export type CreditTopUpCode = (typeof CREDIT_TOP_UPS)[number]["code"];

export const BILLING_DURATIONS = [
  { months: 1, label: "1 месяц", discountPercent: 0 },
  { months: 3, label: "3 месяца", discountPercent: 10 },
  { months: 6, label: "6 месяцев", discountPercent: 20 },
  { months: 12, label: "1 год", discountPercent: 35 },
] as const;

export const CREDIT_TOP_UPS = [
  { code: "credits_10", credits: 10, priceMinor: 349_000 },
  { code: "credits_30", credits: 30, priceMinor: 899_000 },
  { code: "credits_60", credits: 60, priceMinor: 1_590_000 },
] as const;

export function subscriptionPriceMinor(planCode: CreditPlanCode, months: number) {
  const plan = CREDIT_PLANS.find((candidate) => candidate.code === planCode);
  const duration = BILLING_DURATIONS.find((candidate) => candidate.months === months);
  if (!plan || !duration) throw new Error("UNKNOWN_CREDIT_PLAN");
  return Math.round(plan.monthlyPriceMinor * months * (1 - duration.discountPercent / 100));
}

export function resolveSubscriptionPurchase(planCode: string, months: number) {
  const plan = CREDIT_PLANS.find((candidate) => candidate.code === planCode);
  const duration = BILLING_DURATIONS.find((candidate) => candidate.months === months);
  if (!plan || !duration) return null;

  return {
    purchaseKind: "subscription" as const,
    planCode: plan.code,
    durationMonths: duration.months,
    amountMinor: subscriptionPriceMinor(plan.code, duration.months),
    credits: plan.credits * duration.months,
    description: `Adaptive Presence — тариф «${plan.name}» на ${duration.label.toLowerCase()}`,
  };
}

export function resolveTopUpPurchase(topUpCode: string) {
  const topUp = CREDIT_TOP_UPS.find((candidate) => candidate.code === topUpCode);
  if (!topUp) return null;

  return {
    purchaseKind: "top_up" as const,
    planCode: topUp.code,
    durationMonths: null,
    amountMinor: topUp.priceMinor,
    credits: topUp.credits,
    description: `Adaptive Presence — пополнение на ${displayCredits(topUp.credits)} кредитов`,
  };
}

export function formatRubles(amountMinor: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amountMinor / 100);
}
