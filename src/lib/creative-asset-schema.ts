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
