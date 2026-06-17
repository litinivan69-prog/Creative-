import { z } from "zod";

const text = z.string().trim();
const nonEmptyText = z.string().trim().min(1);

export const MonthlyPlanRevisionProposalSchema = z.object({
  summary: nonEmptyText,
  removeItems: z.array(z.object({
    plannedContentItemId: nonEmptyText,
    reason: nonEmptyText,
  })),
  updateItems: z.array(z.object({
    plannedContentItemId: nonEmptyText,
    platform: nonEmptyText,
    format: nonEmptyText,
    topic: nonEmptyText,
    angle: text,
    reason: nonEmptyText,
  })),
  addItems: z.array(z.object({
    platform: nonEmptyText,
    format: nonEmptyText,
    topic: nonEmptyText,
    angle: text,
    week: z.number().int().min(1).max(5),
    reason: nonEmptyText,
  })),
  protectedItems: z.array(z.object({
    plannedContentItemId: nonEmptyText,
    reason: nonEmptyText,
  })),
});

export type MonthlyPlanRevisionProposal = z.infer<typeof MonthlyPlanRevisionProposalSchema>;
