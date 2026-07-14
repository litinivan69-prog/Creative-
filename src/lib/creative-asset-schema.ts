import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const CreativeAssetTypeSchema = z.enum([
  "visual",
  "video",
  "carousel",
  "carousel_slide",
  "story",
  "cover",
  "review_response_visual",
  "other",
]);

export const CreativeAssetBriefSchema = z.object({
  assetType: CreativeAssetTypeSchema,
  title: nonEmptyText.max(160),
  brief: nonEmptyText.max(4000),
  formatRequirements: nonEmptyText.max(1000),
  textOnAsset: z.string().trim().max(1000),
  references: nonEmptyText.max(1500),
  approvalRequired: z.boolean(),
  notes: nonEmptyText.max(1500),
});

export type CreativeAssetBrief = z.infer<typeof CreativeAssetBriefSchema>;

// «карточка 1/4», «слайд 2 из 6», «card 3/5», «Что будет в канале · карточка 1» и т.п.
const CAROUSEL_SLIDE_LABEL_SOURCE =
  "[ \\t]*[·•|,;:\\-–—(\\[]*[ \\t]*(?:карточка|карточки|слайд|card|slide)[ \\t]*№?[ \\t]*\\d{1,2}[ \\t]*(?:(?:\\/|из|of)[ \\t]*\\d{1,2})?[ \\t]*[)\\]]?";

/**
 * Slide index is service metadata: it must never appear in post text or be
 * rendered on a visual. Strips «карточка X/Y»-style labels and tidies up
 * leftover separators. Idempotent; clean text passes through untouched
 * (including newlines and markdown lists).
 */
export function stripCarouselSlideLabel(value: string): string {
  if (!new RegExp(CAROUSEL_SLIDE_LABEL_SOURCE, "i").test(value)) return value;

  return value
    .replace(new RegExp(CAROUSEL_SLIDE_LABEL_SOURCE, "gi"), " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t·•|,;:\-–—]+/, "")
    .replace(/[ \t·•|,;:\-–—]+$/, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}
