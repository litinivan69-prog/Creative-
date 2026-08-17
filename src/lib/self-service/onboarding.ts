import { z } from "zod";

export const SELF_SERVICE_ONBOARDING_COOKIE = "ap_onboarding";
export const SELF_SERVICE_AUTH_REDIRECT_COOKIE = "ap_auth_redirect";

const trimmed = (max: number) => z.string().trim().max(max);
const socialPlatforms = ["telegram", "vk", "ok", "instagram", "dzen", "vcru"] as const;

export const SelfServiceOnboardingSchema = z.object({
  selection: z.object({
    formatIds: z.array(z.enum(["vk_post", "telegram_post", "ok_post", "dzen_article", "vcru_article", "quick_announcement", "review_reply"])).min(1),
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
    telegramUrl: trimmed(500).optional().default(""),
    vkUrl: trimmed(500).optional().default(""),
    okUrl: trimmed(500).optional().default(""),
    instagramUrl: trimmed(500).optional().default(""),
    dzenUrl: trimmed(500).optional().default(""),
    vcruUrl: trimmed(500).optional().default(""),
    otherSocialUrls: trimmed(2000).optional().default(""),
    starterKitPlatformIds: z.array(z.enum(socialPlatforms)).optional().default([]),
    brandColors: trimmed(1000).optional().default(""),
    fonts: trimmed(1000).optional().default(""),
    visualStyle: trimmed(3000).optional().default(""),
    likedVisualReferences: trimmed(3000).optional().default(""),
    dislikedVisualReferences: trimmed(3000).optional().default(""),
    logoUrl: trimmed(500).optional().default(""),
    brandbookUrl: trimmed(500).optional().default(""),
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
      telegramUrl: text("telegramUrl"),
      vkUrl: text("vkUrl"),
      okUrl: text("okUrl"),
      instagramUrl: text("instagramUrl"),
      dzenUrl: text("dzenUrl"),
      vcruUrl: text("vcruUrl"),
      otherSocialUrls: text("otherSocialUrls"),
      starterKitPlatformIds: formData.getAll("starterKitPlatformIds").map(String),
      brandColors: text("brandColors"),
      fonts: text("fonts"),
      visualStyle: text("visualStyle"),
      likedVisualReferences: text("likedVisualReferences"),
      dislikedVisualReferences: text("dislikedVisualReferences"),
      logoUrl: text("logoUrl"),
      brandbookUrl: text("brandbookUrl"),
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
    brief.telegramUrl ? `Telegram: ${brief.telegramUrl}` : "",
    brief.vkUrl ? `VK: ${brief.vkUrl}` : "",
    brief.okUrl ? `Одноклассники: ${brief.okUrl}` : "",
    brief.instagramUrl ? `Instagram: ${brief.instagramUrl}` : "",
    brief.dzenUrl ? `Дзен: ${brief.dzenUrl}` : "",
    brief.vcruUrl ? `VC.ru: ${brief.vcruUrl}` : "",
    brief.otherSocialUrls ? `Другие площадки: ${brief.otherSocialUrls}` : "",
    brief.starterKitPlatformIds.length
      ? `Нужно стартовое оформление площадок: ${brief.starterKitPlatformIds.join(", ")}`
      : "",
    brief.brandColors ? `Фирменные цвета: ${brief.brandColors}` : "",
    brief.fonts ? `Фирменные шрифты: ${brief.fonts}` : "",
    brief.visualStyle ? `Визуальный стиль: ${brief.visualStyle}` : "",
    brief.likedVisualReferences ? `Нравятся визуальные референсы: ${brief.likedVisualReferences}` : "",
    brief.dislikedVisualReferences ? `Не нравятся визуальные референсы: ${brief.dislikedVisualReferences}` : "",
    brief.logoUrl ? `Логотип: ${brief.logoUrl}` : "",
    brief.brandbookUrl ? `Брендбук: ${brief.brandbookUrl}` : "",
    `Выбранные форматы: ${selection.formatIds.join(", ")}`,
    `Ритм постов: ${selection.postRhythmId}`,
    `Ритм статей: ${selection.articleRhythmId}`,
  ]
    .filter(Boolean)
    .join("\n");
}
