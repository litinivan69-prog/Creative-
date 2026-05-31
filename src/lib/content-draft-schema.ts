import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const ContentDraftStatusSchema = z.enum(["draft", "needs_review", "approved", "rejected"]);
export const ContentDraftRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const ContentDraftSchema = z.object({
  draftTitle: nonEmptyText,
  draftBody: nonEmptyText,
  draftNotes: z.array(nonEmptyText),
  status: ContentDraftStatusSchema,
  approvalRequired: z.boolean(),
  autopublishEligible: z.boolean(),
  riskLevel: ContentDraftRiskLevelSchema,
});

export type ContentDraft = z.infer<typeof ContentDraftSchema>;

export function isSensitiveContent(values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();

  return [
    "clinic",
    "healthcare",
    "medical",
    "doctor",
    "patient",
    "treatment",
    "diagnosis",
    "legal",
    "law",
    "financial",
    "finance",
    "investment",
    "regulated",
    "safety",
    "guarantee",
    "certification",
    "license",
  ].some((keyword) => text.includes(keyword));
}

export function validateContentDraftForPersistence(
  input: unknown,
  context: {
    plannedItemApprovalRequired: boolean;
    plannedItemAutopublishEligible: boolean;
    sensitiveContent: boolean;
  },
): ContentDraft {
  const draft = ContentDraftSchema.parse(input);
  const needsReview =
    context.sensitiveContent ||
    context.plannedItemApprovalRequired ||
    draft.approvalRequired ||
    draft.riskLevel !== "low";

  return {
    ...draft,
    status: needsReview ? "needs_review" : "draft",
    approvalRequired: needsReview,
    autopublishEligible:
      !needsReview &&
      context.plannedItemAutopublishEligible &&
      draft.autopublishEligible,
  };
}
