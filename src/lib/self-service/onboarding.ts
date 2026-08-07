import { z } from "zod";

export const SELF_SERVICE_ONBOARDING_COOKIE = "ap_onboarding";
export const SELF_SERVICE_AUTH_REDIRECT_COOKIE = "ap_auth_redirect";

const trimmed = (max: number) => z.string().trim().max(max);

export const SelfServiceOnboardingSchema = z.object({
  selection: z.object({
    formatIds: z.array(z.enum(["vk_post", "telegram_post", "dzen_article", "vcru_article", "quick_announcement", "review_reply"])).min(1),
    postRhythmId: z.enum(["calm", "regular"]),
    articleRhythmId: z.enum(["none", "one", "two"]),
  }),
  brief: z.object({
    brandName: trimmed(160).min(1),
    website: trimmed(500),
    businessDescription: trimmed(3000).min(1),
    priorityOffer: trimmed(3000).min(1),
    audience: trimmed(3000).min(1),
    tone: trimmed(300).min(1),
    keyMessage: trimmed(2000),
    restrictions: trimmed(3000),
    monthGoal: trimmed(2000),
    monthTopics: trimmed(3000),
  }),
});

export type SelfServiceOnboarding = z.infer<typeof SelfServiceOnboardingSchema>;

export function selfServiceOnboardingFromFormData(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  return SelfServiceOnboardingSchema.parse({
    selection: {
      formatIds: text("formatIds").split(",").map((value) => value.trim()).filter(Boolean),
      postRhythmId: text("postRhythmId"),
      articleRhythmId: text("articleRhythmId"),
    },
    brief: {
      brandName: text("brandName"),
      website: text("website"),
      businessDescription: text("businessDescription"),
      priorityOffer: text("priorityOffer"),
      audience: text("audience"),
      tone: text("tone"),
      keyMessage: text("keyMessage"),
      restrictions: text("restrictions"),
      monthGoal: text("monthGoal"),
      monthTopics: text("monthTopics"),
    },
  });
}

export function onboardingRawBrief(input: SelfServiceOnboarding) {
  const { brief, selection } = input;

  return [
    `Компания: ${brief.brandName}`,
    brief.website ? `Сайт: ${brief.website}` : "",
    `Чем занимается: ${brief.businessDescription}`,
    `Приоритетный продукт или услуга: ${brief.priorityOffer}`,
    `Целевая аудитория: ${brief.audience}`,
    `Тон бренда: ${brief.tone}`,
    brief.keyMessage ? `Главная мысль бренда: ${brief.keyMessage}` : "",
    brief.restrictions ? `Ограничения и запретные темы: ${brief.restrictions}` : "",
    brief.monthGoal ? `Цель ближайшего месяца: ${brief.monthGoal}` : "",
    brief.monthTopics ? `Обязательные темы ближайшего месяца: ${brief.monthTopics}` : "",
    `Выбранные форматы: ${selection.formatIds.join(", ")}`,
    `Ритм постов: ${selection.postRhythmId}`,
    `Ритм статей: ${selection.articleRhythmId}`,
  ]
    .filter(Boolean)
    .join("\n");
}
