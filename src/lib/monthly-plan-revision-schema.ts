import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);
const optionalText = z.string().trim().optional();

export const MonthlyPlanRevisionProposalSchema = z.object({
  summary: nonEmptyText,
  removeItems: z.array(z.object({
    plannedContentItemId: nonEmptyText,
    reason: nonEmptyText,
  })).default([]),
  updateItems: z.array(z.object({
    plannedContentItemId: nonEmptyText,
    platform: nonEmptyText,
    format: nonEmptyText,
    topic: nonEmptyText,
    angle: optionalText,
    reason: nonEmptyText,
  })).default([]),
  addItems: z.array(z.object({
    platform: nonEmptyText,
    format: nonEmptyText,
    topic: nonEmptyText,
    angle: optionalText,
    week: z.number().int().min(1).max(5),
    reason: nonEmptyText,
  })).default([]),
  protectedItems: z.array(z.object({
    plannedContentItemId: nonEmptyText,
    reason: nonEmptyText,
  })).default([]),
});

export type MonthlyPlanRevisionProposal = z.infer<typeof MonthlyPlanRevisionProposalSchema>;

