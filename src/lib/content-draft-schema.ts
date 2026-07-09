import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const ContentDraftStatusSchema = z.enum([
  "draft",
  "needs_review",
  "sent_to_client",
  "client_changes_requested",
  "approved",
  "rejected",
  "ready_to_schedule",
]);
export const ContentDraftRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const ContentDraftSchema = z.object({
  draftTitle: nonEmptyText,
  draftBody: nonEmptyText,
  telegramBody: z
    .string()
    .trim()
    .nullable()
    .describe(
      "Самостоятельная версия поста для Telegram: до 900 символов, завершённая мысль, без обрывов. Тот же язык и тон, что и draftBody.",
    ),
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

const TELEGRAM_BODY_LIMIT = 1024;

/** Clamps the generated Telegram version to the caption limit at a word boundary. */
export function clampTelegramBody(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (text.length <= TELEGRAM_BODY_LIMIT) return text;
  const slice = text.slice(0, TELEGRAM_BODY_LIMIT - 1);
  const lastBreak = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
  const cut = lastBreak > TELEGRAM_BODY_LIMIT * 0.6 ? slice.slice(0, lastBreak) : slice;
  return `${cut.trimEnd()}…`;
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
    telegramBody: clampTelegramBody(draft.telegramBody),
    status: needsReview ? "needs_review" : "draft",
    approvalRequired: needsReview,
    autopublishEligible:
      !needsReview &&
      context.plannedItemAutopublishEligible &&
      draft.autopublishEligible,
  };
}
