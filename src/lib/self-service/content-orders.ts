import { z } from "zod";
import { CREDIT_PRODUCTS } from "@/lib/self-service/credit-catalog";

export const SELF_SERVICE_CONTENT_ORDER_FIELDS = [
  "vkPosts",
  "telegramPosts",
  "okPosts",
  "dzenArticles",
  "vcruArticles",
  "carousels",
  "quickAnnouncements",
  "reviewReplies",
] as const;

export const SelfServiceContentOrderConfigurationSchema = z.object({
  vkPosts: z.number().int().min(0).max(100),
  telegramPosts: z.number().int().min(0).max(100),
  okPosts: z.number().int().min(0).max(100).default(0),
  dzenArticles: z.number().int().min(0).max(20),
  vcruArticles: z.number().int().min(0).max(20),
  carousels: z.number().int().min(0).max(30),
  carouselPlatform: z.enum(["vk", "telegram", "both"]).default("vk"),
  quickAnnouncements: z.number().int().min(0).max(100),
  reviewReplies: z.number().int().min(0).max(100),
});

export type SelfServiceContentOrderConfiguration = z.infer<typeof SelfServiceContentOrderConfigurationSchema>;

export function contentOrderConfigurationFromFormData(formData: FormData) {
  return SelfServiceContentOrderConfigurationSchema.parse({
    ...Object.fromEntries(SELF_SERVICE_CONTENT_ORDER_FIELDS.map((field) => [field, Number(formData.get(field) ?? 0)])),
    carouselPlatform: formData.get("carouselPlatform") ?? "vk",
  });
}

export function parseSelfServiceContentOrderConfiguration(value: unknown) {
  return SelfServiceContentOrderConfigurationSchema.parse(value);
}

export function estimateContentOrderCredits(configuration: SelfServiceContentOrderConfiguration) {
  return configuration.vkPosts * CREDIT_PRODUCTS.visual_post.credits
    + configuration.telegramPosts * CREDIT_PRODUCTS.visual_post.credits
    + configuration.okPosts * CREDIT_PRODUCTS.visual_post.credits
    + configuration.dzenArticles * CREDIT_PRODUCTS.article_with_cover.credits
    + configuration.vcruArticles * CREDIT_PRODUCTS.article_with_cover.credits
    + configuration.carousels * CREDIT_PRODUCTS.carousel.credits
    + configuration.quickAnnouncements * CREDIT_PRODUCTS.quick_announcement.credits
    + configuration.reviewReplies * CREDIT_PRODUCTS.review_reply.credits;
}

export function contentOrderFormatIds(configuration: SelfServiceContentOrderConfiguration) {
  return [
    configuration.vkPosts > 0 || (configuration.carousels > 0 && ["vk", "both"].includes(configuration.carouselPlatform)) ? "vk_post" : null,
    configuration.telegramPosts > 0 || configuration.quickAnnouncements > 0 || configuration.reviewReplies > 0 || (configuration.carousels > 0 && ["telegram", "both"].includes(configuration.carouselPlatform)) ? "telegram_post" : null,
    configuration.okPosts > 0 ? "ok_post" : null,
    configuration.dzenArticles > 0 ? "dzen_article" : null,
    configuration.vcruArticles > 0 ? "vcru_article" : null,
    configuration.quickAnnouncements > 0 ? "quick_announcement" : null,
    configuration.reviewReplies > 0 ? "review_reply" : null,
  ].filter((value): value is string => Boolean(value));
}
