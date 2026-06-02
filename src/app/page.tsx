import {
  addClientBrief,
  approveDraft,
  approveCreativeVariant,
  createClientPortalLink,
  createCreativeAssetBrief,
  createClient,
  deleteCreativeVariant,
  generateBlueprint,
  generateContentDraftForItem,
  regenerateContentDraftForItem,
  generateCreativeAssetBriefForPublication,
  generateCreativeVisualVariantForAsset,
  generateMonthlyPlan,
  markDraftReadyToSchedule,
  markCreativeVariantNeedsReview,
  markCreativeVariantQualityFailed,
  markCreativeVariantQualityPassed,
  markScheduledPublicationNeedsAssets,
  markScheduledPublicationReady,
  markScheduledPublicationScheduled,
  markScheduledPublicationSkipped,
  prepareMonthAutopilot,
  regenerateCreativeAssetBrief,
  rejectDraft,
  rejectCreativeVariant,
  requestDraftChanges,
  revokeClientPortalLink,
  scheduleContentDraft,
  sendDraftToClient,
  submitDraftForReview,
  unschedulePublication,
  updateClientBrief,
  updateCreativeAssetBrief,
  updateCreativeAssetStatus,
  updatePublicationText,
  updateScheduledPublication,
} from "@/app/actions";
import { ClientPortalView } from "@/app/client-portal-view";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { getAutopilotTextBatchLimit } from "@/lib/autopilot";
import { getTextModelSettings } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  view?: string;
  blueprint?: string;
  plan?: string;
  client?: string;
  error?: string;
  notice?: string;
  portalLink?: string;
}>;

const workspaceViews = [
  "overview",
  "clients",
  "client_setup",
  "approvals",
  "calendar",
  "drafts",
  "assets",
  "client_portal",
  "reports",
  "settings",
] as const;

type WorkspaceView = (typeof workspaceViews)[number];

type WorkspaceContext = {
  blueprint?: string;
  plan?: string;
  client?: string;
};

function getActiveView(params: { view?: string }): WorkspaceView {
  return workspaceViews.includes(params.view as WorkspaceView) ? (params.view as WorkspaceView) : "overview";
}

function workspaceHref(view: WorkspaceView, context: WorkspaceContext = {}) {
  const searchParams = new URLSearchParams({ view });

  if (context.blueprint) searchParams.set("blueprint", context.blueprint);
  if (context.plan) searchParams.set("plan", context.plan);
  if (context.client) searchParams.set("client", context.client);

  return `/?${searchParams.toString()}`;
}

const viewTitles: Record<WorkspaceView, string> = {
  overview: "Обзор",
  clients: "Клиенты",
  client_setup: "Настройка клиента",
  approvals: "Согласования",
  calendar: "Календарь",
  drafts: "Материалы",
  assets: "Креативы",
  client_portal: "Клиентский календарь",
  reports: "Отчёты",
  settings: "Настройки",
};

const navigationGroups = [
  {
    label: "Работа",
    items: [
      { label: "Обзор", view: "overview" as const, glyph: "О" },
      { label: "Клиенты", view: "clients" as const, glyph: "К" },
      { label: "Настройка клиента", view: "client_setup" as const, glyph: "Н" },
      { label: "Календарь", view: "calendar" as const, glyph: "К" },
      { label: "Клиентский вид", view: "client_portal" as const, glyph: "В" },
    ],
  },
  {
    label: "Проверка",
    items: [
      { label: "Согласования", view: "approvals" as const, glyph: "С" },
      { label: "Материалы", view: "drafts" as const, glyph: "М" },
      { label: "Креативы", view: "assets" as const, glyph: "К" },
    ],
  },
  {
    label: "Система",
    items: [
      { label: "Отчёты", view: "reports" as const, glyph: "О" },
      { label: "Настройки", view: "settings" as const, glyph: "Н" },
    ],
  },
];

const pageBackgroundClass = "min-h-screen bg-[#f6f6f3] text-stone-900";
const panelClass = "rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,36,38,0.04)]";
const cardHeaderClass = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
const mutedTextClass = "text-sm leading-6 text-stone-500";
const sectionClass = `${panelClass} mt-7 scroll-mt-24 p-5 sm:p-6`;
const twoColumnLayoutClass = "grid gap-5 xl:grid-cols-2";
const compactGridClass = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
const inputClass =
  "rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const primaryButtonClass =
  "rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600";
const secondaryButtonClass =
  "rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-wait disabled:text-stone-400";
const destructiveButtonClass =
  "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:cursor-wait disabled:text-rose-400";

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-stone-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p> : null}
    </div>
  );
}

function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "teal" | "amber" | "rose" | "green";
}) {
  const tones = {
    neutral: "border-stone-200 bg-stone-50 text-stone-600",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function operationalStatusTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  if (["approved", "ready", "ready_to_schedule", "passed", "published"].includes(status)) return "green";
  if (["needs_review", "needs_assets", "needed", "needs_manual_review", "sent_to_client", "in_production"].includes(status)) return "amber";
  if (["rejected", "failed", "blocked", "client_changes_requested"].includes(status)) return "rose";
  if (["generated", "scheduled", "brief_ready", "planned"].includes(status)) return "teal";
  return "neutral";
}

function ConnectionBadge({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-stone-500">
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "stone",
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  tone?: "stone" | "teal" | "amber" | "rose";
}) {
  const tones = {
    stone: "border-stone-200 bg-white",
    teal: "border-teal-200 bg-teal-50/70",
    amber: "border-amber-200 bg-amber-50/70",
    rose: "border-rose-200 bg-rose-50/70",
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-stone-500">{detail}</p> : null}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50/70 p-5 text-sm leading-6 text-stone-500">
      {children}
    </div>
  );
}

function JsonDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-lg border border-stone-200 bg-stone-50/60">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-stone-700">{title}</summary>
      <pre className="max-h-80 overflow-auto border-t border-stone-200 bg-stone-950 p-4 text-xs leading-5 text-stone-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function StringList({
  items,
  emptyText,
  tone = "neutral",
}: {
  items: string[];
  emptyText: string;
  tone?: "neutral" | "amber" | "rose";
}) {
  const tones = {
    neutral: "border-stone-200 bg-stone-50 text-stone-700",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  };

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">{emptyText}</p>;
  }

  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item} className={`rounded-md border px-3 py-2 text-sm leading-6 ${tones[tone]}`}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function PreviewCard({ title, copy, glyph }: { title: string; copy: string; glyph: string }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-sm font-bold text-teal-800">
          {glyph}
        </div>
        <div>
          <h3 className="font-semibold text-stone-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-500">{copy}</p>
        </div>
      </div>
    </article>
  );
}

type CalendarPreviewItem = {
  id: string;
  plannedDate: string;
  week: string | null;
  platformName: string;
  format: string;
  topic: string;
  status: string;
  approvalRequired: boolean;
  campaignTheme: string | null;
  channelRole: string | null;
  sequenceReason: string | null;
  contentDraft: {
    id: string;
    status: string;
    draftTitle: string;
    draftBody: string;
    riskLevel: string;
  } | null;
};

function groupCalendarItems(items: CalendarPreviewItem[]) {
  const groups = new Map<string, CalendarPreviewItem[]>();

  for (const item of items) {
    const group = item.week?.trim() || item.plannedDate;
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }

  return Array.from(groups, ([label, groupedItems]) => ({
    label,
    items: groupedItems,
  }));
}

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    active: "Активно",
    planned: "Запланировано",
    open: "Открыто",
    draft: "Текст готов",
    needs_review: "Требует проверки",
    sent_to_client: "У клиента",
    client_changes_requested: "Запрошены правки",
    approved: "Согласовано",
    rejected: "Отклонено",
    ready_to_schedule: "Готово к планированию",
    created: "Создано",
    submitted_for_review: "Отправлено на проверку",
    changes_requested: "Запрошены правки",
    marked_ready_to_schedule: "Готово к планированию",
    request_more_brief_data: "Запросить дополнительные данные для брифа",
    approve_blueprint: "Согласовать Blueprint",
    connect_integrations: "Подключить интеграции",
    generate_monthly_plan: "Сгенерировать месячный план",
    low: "низкий",
    medium: "средний",
    high: "высокий",
    manual: "вручную",
    api: "API",
    semi_auto: "частично автоматически",
    unsupported: "не поддерживается",
    needs_verification: "нужно проверить",
    scheduled: "Запланировано",
    needs_assets: "Нужны материалы",
    ready: "Готово",
    published: "Опубликовано",
    skipped: "Пропущено",
    failed: "Ошибка",
    automation_later: "Автоматизация позже",
    needed: "Нужно",
    brief_ready: "ТЗ готово",
    in_production: "В работе",
    visual: "Визуал",
    video: "Видео",
    carousel: "Карусель",
    story: "Сторис",
    cover: "Обложка",
    review_response_visual: "Визуал для ответа на отзыв",
    other: "Другое",
    generated: "Сгенерировано",
    openai: "OpenAI",
    google_later: "Google позже",
    image_text: "Текст в изображении",
    overlay_later: "Текст добавим позже",
    no_text: "Без текста",
    unchecked: "Не проверено",
    passed: "Качество ок",
    needs_manual_review: "Нужна ручная проверка",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function formatDraftStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Текст готов",
    needs_review: "Требует проверки",
    sent_to_client: "У клиента",
    client_changes_requested: "Запрошены правки",
    approved: "Согласовано",
    rejected: "Отклонено",
    ready_to_schedule: "Готово к планированию",
  };

  return labels[status] ?? formatStatus(status);
}

function formatMaterialTextStatus(draft?: { status: string } | null) {
  if (!draft) return "Текст не создан";

  const labels: Record<string, string> = {
    draft: "Текст готов",
    needs_review: "На проверке",
    sent_to_client: "У клиента",
    client_changes_requested: "Запрошены правки",
    approved: "Согласован",
    rejected: "Отклонён",
    ready_to_schedule: "Согласован",
  };

  return labels[draft.status] ?? formatDraftStatus(draft.status);
}

function materialTextStatusTone(draft?: { status: string } | null): "neutral" | "teal" | "amber" | "rose" | "green" {
  if (!draft) return "neutral";
  if (draft.status === "draft") return "teal";
  return draftStatusTone(draft.status);
}

function formatReviewActor(actorType: string) {
  const labels: Record<string, string> = {
    client: "Клиент",
    manager: "Менеджер",
    system: "Система",
  };

  return labels[actorType] ?? actorType;
}

function formatReviewAction(action: string) {
  const labels: Record<string, string> = {
    created: "Текст создан",
    submitted_for_review: "Отправлен на проверку",
    sent_to_client: "Отправлен клиенту",
    changes_requested: "Запрошены правки",
    approved: "Согласован",
    rejected: "Отклонён",
    marked_ready_to_schedule: "Готов к планированию",
    comment_added: "Добавлен комментарий",
    text_updated: "Текст обновлён",
  };

  return labels[action] ?? formatStatus(action);
}

function draftStatusTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  return operationalStatusTone(status);
}

type DraftReviewEventPreview = {
  id: string;
  actorType: string;
  action: string;
  comment: string | null;
  createdAt: Date;
};

type DraftQueueItem = {
  id: string;
  platformName: string;
  format: string;
  topic: string;
  draftTitle: string;
  draftBody: string;
  status: string;
  riskLevel: string;
  approvalRequired: boolean;
  autopublishEligible: boolean;
  reviewEvents: DraftReviewEventPreview[];
};

type ScheduledPublicationPreview = {
  id: string;
  contentDraftId: string;
  plannedContentItemId: string;
  platformName: string;
  format: string;
  topic: string;
  scheduledDate: string;
  scheduledTime: string | null;
  timezone: string | null;
  status: string;
  publishMode: string;
  notes: string | null;
  contentDraft: {
    draftTitle: string;
  };
  creativeAssets: Array<{
    id: string;
    assetType: string;
    title: string;
    brief: string;
    status: string;
    source: string;
    generatedVariants: GeneratedCreativeVariantPreview[];
  }>;
};

type MaterialPlannedItem = {
  id: string;
  plannedDate: string;
  week: string | null;
  platformName: string;
  format: string;
  topic: string;
  goal: string;
  contentDraft: DraftQueueItem | null;
};

type GeneratedCreativeVariantPreview = {
  id: string;
  variantTitle: string;
  prompt: string;
  revisedPrompt: string | null;
  imageBase64: string;
  mimeType: string;
  status: string;
  source: string;
  provider: string;
  model: string | null;
  quality: string | null;
  size: string | null;
  textMode: string | null;
  qualityStatus: string;
  qualityNotes: string | null;
  notes: string | null;
};

type CreativeAssetPreview = {
  id: string;
  scheduledPublicationId: string;
  assetType: string;
  title: string;
  brief: string;
  formatRequirements: string | null;
  textOnAsset: string | null;
  references: string | null;
  status: string;
  source: string;
  approvalRequired: boolean;
  notes: string | null;
  scheduledPublication: {
    platformName: string;
    format: string;
    topic: string;
    scheduledDate: string;
    scheduledTime: string | null;
  };
  contentDraft: {
    draftTitle: string;
  };
  generatedVariants: GeneratedCreativeVariantPreview[];
};

type GenerationJobPreview = {
  id: string;
  plannedContentItemId: string | null;
  creativeAssetId: string | null;
  jobType: string;
  status: string;
  title: string;
  message: string | null;
  errorMessage: string | null;
  resultSummary: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

function formatGenerationJobType(jobType: string) {
  const labels: Record<string, string> = {
    prepare_month_texts: "Автоподготовка месяца",
    generate_publication_text: "Текст публикации",
    regenerate_publication_text: "Обновление текста",
    generate_creative_brief: "ТЗ на креатив",
    regenerate_creative_brief: "Обновление ТЗ",
    generate_visual: "Премиум-визуал",
    regenerate_visual: "Новый вариант визуала",
  };

  return labels[jobType] ?? formatStatus(jobType);
}

function formatGenerationJobStatus(status: string) {
  const labels: Record<string, string> = {
    queued: "В очереди",
    running: "Выполняется",
    completed: "Готово",
    failed: "Ошибка",
  };

  return labels[status] ?? formatStatus(status);
}

function generationJobTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  if (status === "running") return "teal";
  if (status === "queued") return "amber";
  if (status === "completed") return "green";
  if (status === "failed") return "rose";
  return "neutral";
}

function generationJobSummary(job: GenerationJobPreview) {
  return job.errorMessage || job.resultSummary || job.message || "Статус задачи сохранён.";
}

function GenerationJobIndicator({ job, compact = false }: { job?: GenerationJobPreview; compact?: boolean }) {
  if (!job) return null;

  const prefix =
    job.status === "running"
      ? "Сейчас выполняется"
      : job.status === "failed"
        ? "Последняя генерация завершилась ошибкой"
        : job.status === "completed"
          ? "Последняя генерация выполнена"
          : "Задача добавлена в очередь";

  return (
    <div className={`rounded-md border px-3 py-2 ${job.status === "failed" ? "border-rose-200 bg-rose-50" : "border-stone-200 bg-stone-50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={generationJobTone(job.status)}>{formatGenerationJobStatus(job.status)}</StatusBadge>
        <p className="text-xs font-bold text-stone-700">{prefix}: {formatGenerationJobType(job.jobType)}</p>
      </div>
      {!compact ? <p className="mt-1 text-xs leading-5 text-stone-500">{generationJobSummary(job)}</p> : null}
    </div>
  );
}

function GenerationJobsPanel({ jobs }: { jobs: GenerationJobPreview[] }) {
  return (
    <article className={`${panelClass} mt-5 p-5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">AI production</p>
          <h3 className="mt-1 text-lg font-semibold text-stone-950">Производственные задачи</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Здесь отображаются генерации текстов, ТЗ и визуалов. Полноценная фоновая очередь будет добавлена позже.
          </p>
        </div>
        <StatusBadge tone={jobs.some((job) => job.status === "running") ? "teal" : "neutral"}>{jobs.length} задач</StatusBadge>
      </div>
      <div className="mt-4 grid gap-2">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-md border border-stone-200 bg-stone-50/70 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={generationJobTone(job.status)}>{formatGenerationJobStatus(job.status)}</StatusBadge>
                  <StatusBadge>{formatGenerationJobType(job.jobType)}</StatusBadge>
                </div>
                <p className="mt-2 text-sm font-semibold text-stone-900">{job.title}</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">{generationJobSummary(job)}</p>
              </div>
              <p className="text-xs font-semibold text-stone-400">
                {job.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
          </div>
        ))}
        {jobs.length === 0 ? <EmptyState>Пока нет производственных задач.</EmptyState> : null}
      </div>
    </article>
  );
}

const draftStatusGroups = [
  { status: "needs_review", label: "Требует проверки менеджера" },
  { status: "sent_to_client", label: "Ждём клиента" },
  { status: "client_changes_requested", label: "Запрошены правки" },
  { status: "approved", label: "Согласовано" },
  { status: "ready_to_schedule", label: "Готово к планированию" },
  { status: "rejected", label: "Отклонено" },
  { status: "draft", label: "Тексты готовы" },
];

function groupDraftsByStatus(items: Array<{ contentDraft: DraftQueueItem | null }>) {
  const drafts = items.flatMap((item) => (item.contentDraft ? [item.contentDraft] : []));

  return draftStatusGroups.map((group) => ({
    ...group,
    drafts: drafts.filter((draft) => draft.status === group.status),
  }));
}

function DraftWorkflowForm({
  action,
  contentDraftId,
  actorType = "manager",
  label,
  pendingLabel,
  commentPlaceholder,
  returnView,
  tone = "secondary",
}: {
  action: (formData: FormData) => void | Promise<void>;
  contentDraftId: string;
  actorType?: "manager" | "client";
  label: string;
  pendingLabel: string;
  commentPlaceholder?: string;
  returnView?: "drafts";
  tone?: "primary" | "secondary" | "danger";
}) {
  const tones = {
    primary: "bg-stone-950 text-white hover:bg-stone-800 disabled:bg-stone-400",
    secondary: "border border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50 disabled:text-stone-400",
    danger: destructiveButtonClass,
  };

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="contentDraftId" value={contentDraftId} />
      <input type="hidden" name="actorType" value={actorType} />
      {returnView ? <input type="hidden" name="returnView" value={returnView} /> : null}
      {commentPlaceholder ? (
        <input
          type="text"
          name="comment"
          placeholder={commentPlaceholder}
          className="min-w-44 flex-1 rounded-md border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      ) : null}
      <PendingSubmitButton
        pendingLabel={pendingLabel}
        className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold transition disabled:cursor-wait ${tones[tone]}`}
      >
        {label}
      </PendingSubmitButton>
    </form>
  );
}

function DraftWorkflowControls({ draft, calendarHref, returnView }: { draft: DraftQueueItem; calendarHref: string; returnView?: "drafts" }) {
  if (draft.status === "ready_to_schedule") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="green">Готово к планированию</StatusBadge>
        <a href={calendarHref} className="text-xs font-bold text-teal-700 transition hover:text-teal-900">
          Перейти к планированию
        </a>
      </div>
    );
  }

  if (draft.status === "rejected") {
    return <StatusBadge tone="rose">Отклонено</StatusBadge>;
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {draft.status === "draft" || draft.status === "client_changes_requested" ? (
          <DraftWorkflowForm
            action={submitDraftForReview}
            contentDraftId={draft.id}
            label="Отправить на проверку"
            pendingLabel="Отправляем..."
            returnView={returnView}
            tone="primary"
          />
        ) : null}
        {draft.status === "draft" || draft.status === "needs_review" || draft.status === "client_changes_requested" ? (
          <DraftWorkflowForm
            action={sendDraftToClient}
            contentDraftId={draft.id}
            label="Отправить клиенту"
            pendingLabel="Отправляем..."
            returnView={returnView}
          />
        ) : null}
        {draft.status === "draft" || draft.status === "needs_review" ? (
          <DraftWorkflowForm
            action={approveDraft}
            contentDraftId={draft.id}
            label="Согласовать внутри"
            pendingLabel="Согласовываем..."
            returnView={returnView}
          />
        ) : null}
        {draft.status === "sent_to_client" ? (
          <DraftWorkflowForm
            action={approveDraft}
            contentDraftId={draft.id}
            actorType="client"
            label="Клиент согласовал"
            pendingLabel="Согласовываем..."
            returnView={returnView}
            tone="primary"
          />
        ) : null}
        {draft.status === "approved" ? (
          <DraftWorkflowForm
            action={markDraftReadyToSchedule}
            contentDraftId={draft.id}
            label="Готово к планированию"
            pendingLabel="Обновляем..."
            returnView={returnView}
            tone="primary"
          />
        ) : null}
      </div>
      {draft.status === "needs_review" || draft.status === "sent_to_client" ? (
        <DraftWorkflowForm
          action={requestDraftChanges}
          contentDraftId={draft.id}
          actorType={draft.status === "sent_to_client" ? "client" : "manager"}
          label={draft.status === "sent_to_client" ? "Клиент запросил правки" : "Запросить правки"}
          pendingLabel="Обновляем..."
          commentPlaceholder="Комментарий к правкам, если нужен"
          returnView={returnView}
        />
      ) : null}
      {draft.status !== "approved" ? (
        <DraftWorkflowForm
          action={rejectDraft}
          contentDraftId={draft.id}
          actorType={draft.status === "sent_to_client" ? "client" : "manager"}
          label="Отклонить"
          pendingLabel="Отклоняем..."
          commentPlaceholder="Комментарий к отклонению, если нужен"
          returnView={returnView}
          tone="danger"
        />
      ) : null}
    </div>
  );
}

function ReviewEventTimeline({ events }: { events: DraftReviewEventPreview[] }) {
  return (
    <details className="rounded-md border border-stone-200 bg-stone-50/70">
      <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">
        История согласования ({events.length})
      </summary>
      <div className="grid gap-2 border-t border-stone-200 px-3 py-3">
        {events.length > 0 ? (
          events.map((event) => (
            <div key={event.id} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-500">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-stone-700">{formatReviewAction(event.action)}</span>
                <span>{event.createdAt.toISOString().replace("T", " ").slice(0, 16)}</span>
              </div>
              <p className="mt-1">Участник: {formatReviewActor(event.actorType)}</p>
              {event.comment ? <p className="mt-1 text-stone-700">{event.comment}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-xs text-stone-400">История согласования пока пуста.</p>
        )}
      </div>
    </details>
  );
}

function ReviewQueue({ groups, calendarHref }: { groups: ReturnType<typeof groupDraftsByStatus>; calendarHref: string }) {
  const draftCount = groups.reduce((total, group) => total + group.drafts.length, 0);

  return (
    <section id="review-queue" className={sectionClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Процесс согласования</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Очередь согласований</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Здесь тексты публикаций проходят проверку менеджера, согласование с клиентом и подготовку к планированию.
          </p>
        </div>
        <StatusBadge tone={draftCount > 0 ? "teal" : "neutral"}>{draftCount} материалов</StatusBadge>
      </div>

      {draftCount > 0 ? (
        <div className="mt-5 grid gap-4">
          {groups.filter((group) => group.drafts.length > 0).map((group) => (
            <div key={group.status}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-stone-950">{group.label}</h3>
                <StatusBadge tone={draftStatusTone(group.status)}>{group.drafts.length}</StatusBadge>
              </div>
              <div className="mt-2 grid gap-3 xl:grid-cols-2">
                {group.drafts.map((draft) => {
                  const latestEvent = draft.reviewEvents.at(-1);

                  return (
                    <article key={draft.id} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50/50 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-teal-700">{draft.platformName} &middot; {draft.format}</p>
                          <h4 className="mt-2 line-clamp-2 font-semibold leading-6 text-stone-950">{draft.draftTitle}</h4>
                          <p className="mt-1 line-clamp-1 text-xs leading-5 text-stone-400">{draft.topic}</p>
                        </div>
                        <StatusBadge tone={draftStatusTone(draft.status)}>{formatDraftStatus(draft.status)}</StatusBadge>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-stone-500">
                        Риск: <span className="font-semibold text-stone-700">{formatStatus(draft.riskLevel)}</span>
                        {draft.approvalRequired ? " · нужно согласование" : " · согласование необязательно"}
                      </p>
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">{draft.draftBody}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-bold text-teal-700">Показать текст</summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-md border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-600">{draft.draftBody}</p>
                      </details>
                      {latestEvent ? (
                        <p className="mt-3 line-clamp-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-500">
                          Последнее событие: <span className="font-bold text-stone-700">{formatReviewAction(latestEvent.action)}</span>. Участник: {formatReviewActor(latestEvent.actorType)}
                          {latestEvent.comment ? ` - ${latestEvent.comment}` : ""}
                        </p>
                      ) : null}
                      <div className="mt-3">
                        <ReviewEventTimeline events={draft.reviewEvents} />
                      </div>
                      <div className="mt-3 border-t border-stone-200 pt-3">
                        <DraftWorkflowControls draft={draft} calendarHref={calendarHref} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState>Сгенерируйте тексты публикаций из запланированных материалов, чтобы запустить процесс согласования.</EmptyState>
        </div>
      )}
    </section>
  );
}

function scheduledPublicationTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  return operationalStatusTone(status);
}

function ScheduledPublicationAction({
  action,
  publicationId,
  children,
  tone = "neutral",
}: {
  action: (formData: FormData) => Promise<void>;
  publicationId: string;
  children: React.ReactNode;
  tone?: "neutral" | "teal" | "amber" | "rose" | "green";
}) {
  const tones = {
    neutral: "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
    teal: "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100",
    amber: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
    rose: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  };

  return (
    <form action={action}>
      <input type="hidden" name="scheduledPublicationId" value={publicationId} />
      <PendingSubmitButton
        pendingLabel="Обновляем..."
        className={`rounded-md border px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${tones[tone]}`}
      >
        {children}
      </PendingSubmitButton>
    </form>
  );
}

function SchedulingLayer({
  drafts,
  publications,
  assetsHref,
  draftsHref,
}: {
  drafts: DraftQueueItem[];
  publications: ScheduledPublicationPreview[];
  assetsHref: string;
  draftsHref: string;
}) {
  const scheduledDraftIds = new Set(publications.map((publication) => publication.contentDraftId));
  const availableDrafts = drafts.filter(
    (draft) =>
      (draft.status === "approved" || draft.status === "ready_to_schedule") &&
      !scheduledDraftIds.has(draft.id),
  );

  return (
    <section id="scheduling" className={sectionClass}>
      <div className={cardHeaderClass}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Внутреннее планирование</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Планирование публикаций</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Согласованные материалы можно поставить в ручной план публикаций. Внешние площадки и автоматическая отправка пока не подключены.
          </p>
        </div>
        <StatusBadge tone={publications.length > 0 ? "teal" : "neutral"}>{publications.length} запланировано</StatusBadge>
      </div>

      <div className={`mt-5 ${twoColumnLayoutClass}`}>
        <div>
          <h3 className="text-sm font-semibold text-stone-950">Готовы к планированию</h3>
          <div className="mt-3 grid gap-3">
            {availableDrafts.map((draft) => (
              <article key={draft.id} className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-teal-700">{draft.platformName} &middot; {draft.format}</p>
                    <h4 className="mt-2 font-semibold leading-6 text-stone-950">{draft.draftTitle}</h4>
                    <p className="mt-1 text-xs leading-5 text-stone-400">{draft.topic}</p>
                  </div>
                  <StatusBadge tone={draftStatusTone(draft.status)}>{formatDraftStatus(draft.status)}</StatusBadge>
                </div>
                <form action={scheduleContentDraft} className="mt-4 grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="contentDraftId" value={draft.id} />
                  <label className="grid gap-1 text-xs font-bold text-stone-600">
                    Дата публикации
                    <input type="date" name="scheduledDate" required className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-stone-600">
                    Время
                    <input type="time" name="scheduledTime" className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-stone-600 sm:col-span-2">
                    Заметка
                    <input type="text" name="notes" placeholder="Необязательно" className={inputClass} />
                  </label>
                  <div className="sm:col-span-2">
                    <PendingSubmitButton pendingLabel="Планируем..." className={primaryButtonClass}>
                      Запланировать
                    </PendingSubmitButton>
                  </div>
                </form>
              </article>
            ))}
            {availableDrafts.length === 0 ? (
              <EmptyState>Согласуйте материалы и отметьте их готовыми к планированию. После этого здесь появится форма публикации.</EmptyState>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-stone-950">Запланированные публикации</h3>
          <div className="mt-3 grid gap-3">
            {publications.map((publication) => (
              <article key={publication.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-teal-700">{publication.platformName} &middot; {publication.format}</p>
                    <h4 className="mt-2 font-semibold leading-6 text-stone-950">{publication.contentDraft.draftTitle}</h4>
                    <p className="mt-1 text-xs leading-5 text-stone-400">{publication.topic}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge tone={scheduledPublicationTone(publication.status)}>{formatStatus(publication.status)}</StatusBadge>
                    <StatusBadge>{formatStatus(publication.publishMode)}</StatusBadge>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-800">
                  {publication.scheduledDate}
                  {publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={materialTextStatusTone(drafts.find((draft) => draft.id === publication.contentDraftId))}>
                    {formatMaterialTextStatus(drafts.find((draft) => draft.id === publication.contentDraftId))}
                  </StatusBadge>
                  <a href={draftsHref} className="text-xs font-bold text-teal-800 transition hover:text-teal-950">
                    Открыть материал
                  </a>
                  <form action={regenerateContentDraftForItem}>
                    <input type="hidden" name="plannedContentItemId" value={publication.plannedContentItemId} />
                    <PendingSubmitButton pendingLabel="Обновляем текст..." className="text-xs font-bold text-stone-600 transition hover:text-stone-950">
                      Перегенерировать текст
                    </PendingSubmitButton>
                  </form>
                </div>
                {publication.timezone ? <p className="mt-1 text-xs text-stone-400">{publication.timezone}</p> : null}
                {publication.notes ? <p className="mt-3 line-clamp-2 rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-600">{publication.notes}</p> : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {publication.creativeAssets.length > 0 ? (
                    <>
                      <StatusBadge tone="teal">{formatStatus(publication.creativeAssets[0].assetType)}</StatusBadge>
                      <StatusBadge tone={creativeAssetTone(publication.creativeAssets[0].status)}>
                        {formatStatus(publication.creativeAssets[0].status)}
                      </StatusBadge>
                      <CreativeAssetSourceBadge source={publication.creativeAssets[0].source} />
                      {publication.creativeAssets[0].generatedVariants.some((variant) => variant.status === "approved") ? (
                        <StatusBadge tone="green">Визуал согласован</StatusBadge>
                      ) : publication.creativeAssets[0].generatedVariants.length > 0 ? (
                        <StatusBadge tone="teal">Визуал создан</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">ТЗ есть, визуал не создан</StatusBadge>
                      )}
                      <a href={assetsHref} className="inline-flex items-center text-xs font-bold text-teal-800 transition hover:text-teal-950">
                        Открыть ТЗ
                      </a>
                    </>
                  ) : (
                    <StatusBadge tone="amber">Нет ТЗ на креатив</StatusBadge>
                  )}
                </div>
                {publication.status === "needs_assets" && publication.creativeAssets.length === 0 ? (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                    Нужно создать или сгенерировать ТЗ перед производством визуала.
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {publication.status !== "ready" ? (
                    <ScheduledPublicationAction action={markScheduledPublicationReady} publicationId={publication.id} tone="green">
                      Готово
                    </ScheduledPublicationAction>
                  ) : (
                    <StatusBadge tone="green">Готово к размещению</StatusBadge>
                  )}
                  <a href={assetsHref} className="inline-flex items-center text-xs font-bold text-teal-800 transition hover:text-teal-950">
                    Открыть креативы
                  </a>
                </div>

                <details className="mt-3 rounded-md border border-stone-200 bg-stone-50/70">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">Управление публикацией</summary>
                  <form action={updateScheduledPublication} className="grid gap-2 border-t border-stone-200 p-3 sm:grid-cols-2">
                    <input type="hidden" name="scheduledPublicationId" value={publication.id} />
                    <label className="grid gap-1 text-xs font-bold text-stone-600">
                      Дата публикации
                      <input type="date" name="scheduledDate" required defaultValue={publication.scheduledDate} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-stone-600">
                      Время
                      <input type="time" name="scheduledTime" defaultValue={publication.scheduledTime ?? ""} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-stone-600 sm:col-span-2">
                      Заметка
                      <input type="text" name="notes" defaultValue={publication.notes ?? ""} className={inputClass} />
                    </label>
                    <PendingSubmitButton pendingLabel="Сохраняем..." className={`${secondaryButtonClass} sm:col-span-2`}>
                      Сохранить изменения
                    </PendingSubmitButton>
                  </form>
                  <div className="flex flex-wrap gap-2 border-t border-stone-200 p-3">
                    {publication.status !== "needs_assets" ? (
                      <ScheduledPublicationAction action={markScheduledPublicationNeedsAssets} publicationId={publication.id} tone="amber">
                        Нужен визуал
                      </ScheduledPublicationAction>
                    ) : null}
                    {publication.status !== "scheduled" ? (
                      <ScheduledPublicationAction action={markScheduledPublicationScheduled} publicationId={publication.id} tone="teal">
                        Запланировано
                      </ScheduledPublicationAction>
                    ) : null}
                    {publication.status !== "skipped" ? (
                      <ScheduledPublicationAction action={markScheduledPublicationSkipped} publicationId={publication.id}>
                        Пропустить
                      </ScheduledPublicationAction>
                    ) : null}
                    <ScheduledPublicationAction action={unschedulePublication} publicationId={publication.id} tone="rose">
                      Снять с расписания
                    </ScheduledPublicationAction>
                  </div>
                </details>
              </article>
            ))}
            {publications.length === 0 ? (
              <EmptyState>Запланированных публикаций пока нет. Выберите согласованный материал слева и укажите дату.</EmptyState>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

const creativeAssetTypes = [
  "visual",
  "video",
  "carousel",
  "story",
  "cover",
  "review_response_visual",
  "other",
];

const creativeAssetStatusOptions = [
  "needed",
  "brief_ready",
  "in_production",
  "needs_review",
  "approved",
  "rejected",
];

function creativeAssetTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  return operationalStatusTone(status);
}

function CreativeAssetSourceBadge({ source, compact = false }: { source: string; compact?: boolean }) {
  return (
    <StatusBadge tone={source === "ai" ? "teal" : "neutral"}>
      {source === "ai" ? "AI-ТЗ" : compact ? "Вручную" : "Создано вручную"}
    </StatusBadge>
  );
}

function CreativeAssetStatusAction({
  assetId,
  status,
}: {
  assetId: string;
  status: string;
}) {
  return (
    <form action={updateCreativeAssetStatus}>
      <input type="hidden" name="creativeAssetId" value={assetId} />
      <input type="hidden" name="status" value={status} />
      <PendingSubmitButton
        pendingLabel="Обновляем..."
        className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900 disabled:cursor-wait disabled:opacity-60"
      >
        {formatStatus(status)}
      </PendingSubmitButton>
    </form>
  );
}

function creativeVariantTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  return operationalStatusTone(status);
}

function creativeVariantQualityTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  return operationalStatusTone(status);
}

function CreativeVariantAction({
  action,
  variantId,
  children,
  returnView,
  tone = "neutral",
}: {
  action: (formData: FormData) => Promise<void>;
  variantId: string;
  children: React.ReactNode;
  returnView?: "drafts";
  tone?: "neutral" | "teal" | "amber" | "rose" | "green";
}) {
  const tones = {
    neutral: "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
    teal: "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100",
    amber: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
    rose: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  };

  return (
    <form action={action}>
      <input type="hidden" name="creativeVariantId" value={variantId} />
      {returnView ? <input type="hidden" name="returnView" value={returnView} /> : null}
      <PendingSubmitButton
        pendingLabel="Обновляем..."
        className={`rounded-md border px-2.5 py-1.5 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${tones[tone]}`}
      >
        {children}
      </PendingSubmitButton>
    </form>
  );
}

function CreativeAssetVisualStatus({ variants }: { variants: GeneratedCreativeVariantPreview[] }) {
  if (variants.some((variant) => variant.status === "approved")) {
    return <StatusBadge tone="green">Визуал согласован</StatusBadge>;
  }

  if (variants.length > 0) {
    return <StatusBadge tone="teal">Есть варианты визуала</StatusBadge>;
  }

  return <StatusBadge tone="neutral">Визуал не создан</StatusBadge>;
}

function CreativeAssetLayer({
  publications,
  assets,
  jobs,
}: {
  publications: ScheduledPublicationPreview[];
  assets: CreativeAssetPreview[];
  jobs: GenerationJobPreview[];
}) {
  const publicationsNeedingBrief = publications.filter(
    (publication) =>
      (publication.status === "needs_assets" || suggestsVisualAsset(publication.format)) &&
      publication.creativeAssets.length === 0,
  );

  return (
    <section id="assets" className={sectionClass}>
      <div className={cardHeaderClass}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Производство визуалов</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Креативные материалы</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Создавайте ТЗ на визуалы и видео для публикаций, отслеживайте подготовку и согласование материалов внутри команды.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={publicationsNeedingBrief.length > 0 ? "amber" : "green"}>
            {publicationsNeedingBrief.length} ждут ТЗ
          </StatusBadge>
          <StatusBadge tone="teal">{assets.length} материалов</StatusBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h3 className="text-sm font-semibold text-stone-950">Нужно подготовить ТЗ</h3>
          <div className="mt-3 grid gap-3">
            {publicationsNeedingBrief.map((publication) => (
              <article key={publication.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-teal-700">{publication.platformName} &middot; {publication.format}</p>
                    <h4 className="mt-2 font-semibold leading-6 text-stone-950">{publication.topic}</h4>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Текст публикации: {publication.contentDraft.draftTitle}</p>
                  </div>
                  <StatusBadge tone="amber">
                    {publication.scheduledDate}{publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}
                  </StatusBadge>
                </div>
                <div className="mt-4 rounded-lg border border-teal-300 bg-teal-50 p-4 shadow-[0_4px_12px_rgba(13,148,136,0.08)]">
                  <p className="text-sm font-semibold text-teal-950">Нет ТЗ на креатив</p>
                  <p className="mt-2 text-sm leading-6 text-teal-800">
                    Можно сгенерировать ТЗ через AI на основе текста, площадки, формата и темы публикации.
                  </p>
                  <form action={generateCreativeAssetBriefForPublication} className="mt-3">
                    <input type="hidden" name="scheduledPublicationId" value={publication.id} />
                    <PendingSubmitButton pendingLabel="Генерируем ТЗ..." className={`${primaryButtonClass} w-full justify-center py-3 text-sm`}>
                      Сгенерировать ТЗ через AI
                    </PendingSubmitButton>
                  </form>
                </div>
                <details className="mt-3 rounded-md border border-stone-200 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-600">Или заполнить ТЗ вручную</summary>
                  <form action={createCreativeAssetBrief} className="grid gap-2 border-t border-stone-200 p-3 sm:grid-cols-2">
                    <input type="hidden" name="scheduledPublicationId" value={publication.id} />
                    <label className="grid gap-1 text-xs font-bold text-stone-600">
                      Тип материала
                      <select name="assetType" className={inputClass} defaultValue="visual">
                        {creativeAssetTypes.map((type) => (
                          <option key={type} value={type}>{formatStatus(type)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-stone-600">
                      Название ТЗ
                      <input type="text" name="title" required className={inputClass} placeholder="Например: обложка для публикации" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-stone-600 sm:col-span-2">
                      Описание ТЗ
                      <textarea name="brief" required rows={4} className={inputClass} placeholder="Что нужно показать, настроение, ключевой акцент" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-stone-600">
                      Требования к формату
                      <input type="text" name="formatRequirements" className={inputClass} placeholder="Размер, ориентация, длительность" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-stone-600">
                      Текст на материале
                      <input type="text" name="textOnAsset" className={inputClass} placeholder="Необязательно" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-stone-600">
                      Референсы
                      <input type="text" name="references" className={inputClass} placeholder="Ссылки или описание примеров" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-stone-600">
                      Заметка
                      <input type="text" name="notes" className={inputClass} placeholder="Необязательно" />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-600 sm:col-span-2">
                      <input type="checkbox" name="approvalRequired" className="h-4 w-4 rounded border-stone-300 accent-teal-700" />
                      Требуется согласование
                    </label>
                    <div className="sm:col-span-2">
                      <PendingSubmitButton pendingLabel="Создаём ТЗ..." className={secondaryButtonClass}>
                        Создать ТЗ вручную
                      </PendingSubmitButton>
                    </div>
                  </form>
                </details>
              </article>
            ))}
            {publicationsNeedingBrief.length === 0 ? (
              <EmptyState>
                <p className="font-semibold text-stone-700">Все публикации уже имеют ТЗ на креатив.</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Новые задачи появятся здесь, когда публикация будет отмечена как «Нужен визуал» и у неё ещё не будет ТЗ.
                </p>
              </EmptyState>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-stone-950">Материалы в производстве</h3>
          <div className="mt-3 grid gap-3">
            {assets.map((asset) => (
              <article key={asset.id} className="min-w-0 rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge tone="teal">{formatStatus(asset.assetType)}</StatusBadge>
                      <StatusBadge>{asset.scheduledPublication.platformName} &middot; {asset.scheduledPublication.format}</StatusBadge>
                      <CreativeAssetSourceBadge source={asset.source} />
                    </div>
                    <h4 className="mt-3 font-semibold leading-6 text-stone-950">{asset.title}</h4>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{asset.scheduledPublication.topic}</p>
                  </div>
                  <StatusBadge tone={creativeAssetTone(asset.status)}>{formatStatus(asset.status)}</StatusBadge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-stone-700">{asset.brief}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {asset.approvalRequired ? <StatusBadge tone="amber">Нужно согласование</StatusBadge> : null}
                  <StatusBadge>{asset.scheduledPublication.scheduledDate}{asset.scheduledPublication.scheduledTime ? `, ${asset.scheduledPublication.scheduledTime}` : ""}</StatusBadge>
                  <CreativeAssetVisualStatus variants={asset.generatedVariants} />
                </div>
                <div className="mt-3">
                  <GenerationJobIndicator job={jobs.find((job) => job.creativeAssetId === asset.id)} />
                </div>
                <details className="mt-3 rounded-md border border-stone-200 bg-stone-50/70">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">Открыть производство и ТЗ</summary>
                  <div className="border-t border-stone-200 p-3">
                <div className="grid gap-2 text-xs leading-5 text-stone-600">
                  {asset.formatRequirements ? <p><span className="font-bold text-stone-800">Формат:</span> {asset.formatRequirements}</p> : null}
                  {asset.textOnAsset ? <p><span className="font-bold text-stone-800">Текст:</span> {asset.textOnAsset}</p> : null}
                  {asset.references ? <p><span className="font-bold text-stone-800">Референсы:</span> {asset.references}</p> : null}
                  {asset.notes ? <p><span className="font-bold text-stone-800">Заметка:</span> {asset.notes}</p> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {creativeAssetStatusOptions.map((status) =>
                    status === asset.status ? null : (
                      <CreativeAssetStatusAction key={status} assetId={asset.id} status={status} />
                    ),
                  )}
                </div>
                <div className="mt-3 rounded-md border border-teal-200 bg-teal-50/70 p-3">
                  <p className="text-xs font-bold text-teal-950">Обновить ТЗ через AI</p>
                  <p className="mt-1 text-xs leading-5 text-teal-800">
                    AI пересоберёт ТЗ по текущему тексту, площадке и публикации. Старое ТЗ будет заменено.
                  </p>
                  <form action={regenerateCreativeAssetBrief} className="mt-3">
                    <input type="hidden" name="creativeAssetId" value={asset.id} />
                    <PendingSubmitButton pendingLabel="Перегенерируем..." className={secondaryButtonClass}>
                      Перегенерировать ТЗ через AI
                    </PendingSubmitButton>
                  </form>
                </div>
                <details className="mt-3 rounded-md border border-stone-200 bg-stone-50/70">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">Изменить ТЗ</summary>
                  <form action={updateCreativeAssetBrief} className="grid gap-2 border-t border-stone-200 p-3">
                    <input type="hidden" name="creativeAssetId" value={asset.id} />
                    <input type="text" name="title" required defaultValue={asset.title} className={inputClass} />
                    <textarea name="brief" required rows={4} defaultValue={asset.brief} className={inputClass} />
                    <input type="text" name="formatRequirements" defaultValue={asset.formatRequirements ?? ""} className={inputClass} placeholder="Требования к формату" />
                    <input type="text" name="textOnAsset" defaultValue={asset.textOnAsset ?? ""} className={inputClass} placeholder="Текст на материале" />
                    <input type="text" name="references" defaultValue={asset.references ?? ""} className={inputClass} placeholder="Референсы" />
                    <input type="text" name="notes" defaultValue={asset.notes ?? ""} className={inputClass} placeholder="Заметка" />
                    <PendingSubmitButton pendingLabel="Сохраняем..." className={secondaryButtonClass}>
                      Сохранить изменения
                    </PendingSubmitButton>
                  </form>
                </details>
                <div className="mt-4 border-t border-stone-200 pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">Сгенерированные визуалы</p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        Premium Visual Engine создаёт клиентские варианты через OpenAI API и может расходовать кредиты.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-teal-700">
                        Генерация может занять 30–90 секунд. Задача появится в производственных задачах.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-stone-400">
                        Сейчас используется OpenAI. Поддержка Nano Banana / Gemini Image будет добавлена отдельным провайдером.
                      </p>
                    </div>
                    {asset.generatedVariants.length > 0 ? (
                      <form action={generateCreativeVisualVariantForAsset}>
                        <input type="hidden" name="creativeAssetId" value={asset.id} />
                        <PendingSubmitButton pendingLabel="Генерируем визуал..." className={primaryButtonClass}>
                          Сгенерировать ещё вариант
                        </PendingSubmitButton>
                      </form>
                    ) : null}
                  </div>

                  {asset.generatedVariants.length > 0 ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {asset.generatedVariants.map((variant) => (
                        <article key={variant.id} className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50/60">
                          <img
                            src={`data:${variant.mimeType};base64,${variant.imageBase64}`}
                            alt={variant.variantTitle}
                            className="aspect-square max-h-80 w-full bg-stone-100 object-contain"
                          />
                          <div className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge tone={creativeVariantTone(variant.status)}>{formatStatus(variant.status)}</StatusBadge>
                              <StatusBadge tone={creativeVariantQualityTone(variant.qualityStatus)}>{formatStatus(variant.qualityStatus)}</StatusBadge>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-stone-900">{variant.variantTitle}</p>
                            {variant.notes ? <p className="mt-2 text-xs leading-5 text-stone-500">{variant.notes}</p> : null}
                            <details className="mt-3 rounded-md border border-stone-200 bg-white">
                              <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-600">Технически</summary>
                              <p className="border-t border-stone-200 px-3 py-2 text-[11px] leading-5 text-stone-500">
                                {formatStatus(variant.provider)}
                                {variant.model ? ` · ${variant.model}` : ""}
                                {variant.quality ? ` · ${variant.quality}` : ""}
                                {variant.size ? ` · ${variant.size}` : ""}
                                {variant.textMode ? ` · ${formatStatus(variant.textMode)}` : ""}
                              </p>
                            </details>
                            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                              Перед отправкой клиенту проверьте текст, лица, руки, логотипы и медицинские утверждения.
                            </p>
                            {variant.qualityNotes ? (
                              <p className="mt-2 text-xs leading-5 text-stone-500"><span className="font-bold text-stone-700">Проверка качества:</span> {variant.qualityNotes}</p>
                            ) : null}
                            <details className="mt-3 rounded-md border border-stone-200 bg-white">
                              <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">Показать prompt</summary>
                              <div className="grid gap-2 border-t border-stone-200 p-3 text-xs leading-5 text-stone-600">
                                <p>{variant.prompt}</p>
                                {variant.revisedPrompt ? (
                                  <p><span className="font-bold text-stone-800">Уточнённый prompt:</span> {variant.revisedPrompt}</p>
                                ) : null}
                              </div>
                            </details>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {variant.status !== "needs_review" ? (
                                <CreativeVariantAction action={markCreativeVariantNeedsReview} variantId={variant.id} tone="amber">
                                  На проверку
                                </CreativeVariantAction>
                              ) : null}
                              {variant.status !== "approved" ? (
                                <CreativeVariantAction action={approveCreativeVariant} variantId={variant.id} tone="green">
                                  Согласовать
                                </CreativeVariantAction>
                              ) : null}
                              {variant.status !== "rejected" ? (
                                <CreativeVariantAction action={rejectCreativeVariant} variantId={variant.id} tone="rose">
                                  Отклонить
                                </CreativeVariantAction>
                              ) : null}
                            </div>
                            <details className="mt-3 rounded-md border border-stone-200 bg-white">
                              <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">Дополнительные действия</summary>
                              <div className="grid gap-3 border-t border-stone-200 p-3">
                                <p className="text-xs font-bold text-stone-700">Ручная проверка качества</p>
                                <div className="flex flex-wrap gap-2">
                                  <CreativeVariantAction action={markCreativeVariantQualityPassed} variantId={variant.id} tone="green">
                                    Качество ок
                                  </CreativeVariantAction>
                                  <CreativeVariantAction action={deleteCreativeVariant} variantId={variant.id}>
                                    Удалить
                                  </CreativeVariantAction>
                                  <form action={markCreativeVariantQualityFailed} className="flex min-w-0 flex-1 flex-wrap gap-2">
                                    <input type="hidden" name="creativeVariantId" value={variant.id} />
                                    <input
                                      type="text"
                                      name="qualityNotes"
                                      className="min-w-44 flex-1 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-teal-500"
                                      placeholder="Комментарий к проблеме, необязательно"
                                    />
                                    <PendingSubmitButton pendingLabel="Сохраняем..." className={destructiveButtonClass}>
                                      Есть проблемы
                                    </PendingSubmitButton>
                                  </form>
                                </div>
                              </div>
                            </details>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-teal-300 bg-teal-50/70 p-4">
                      <p className="text-sm font-semibold text-teal-950">Пока нет сгенерированных визуалов.</p>
                      <p className="mt-1 text-xs leading-5 text-teal-800">
                        Premium Visual Engine создаст первый вариант по текущему ТЗ. Генерация использует OpenAI API и может расходовать кредиты.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-teal-700">
                        Сейчас используется OpenAI. Поддержка Nano Banana / Gemini Image будет добавлена отдельным провайдером.
                      </p>
                      <form action={generateCreativeVisualVariantForAsset} className="mt-3">
                        <input type="hidden" name="creativeAssetId" value={asset.id} />
                        <PendingSubmitButton pendingLabel="Генерируем визуал..." className={`${primaryButtonClass} w-full justify-center py-3`}>
                          Сгенерировать премиум-визуал
                        </PendingSubmitButton>
                      </form>
                    </div>
                  )}
                </div>
                  </div>
                </details>
              </article>
            ))}
            {assets.length === 0 ? (
              <EmptyState>ТЗ на креативные материалы пока не созданы. Выберите публикацию слева и зафиксируйте требования к визуалу или видео.</EmptyState>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function suggestsVisualAsset(format: string) {
  return ["visual", "video", "reel", "story", "image", "photo", "carousel", "short"].some((token) =>
    format.toLowerCase().includes(token),
  );
}

function WorkspaceSwitcher({
  activeView,
  links,
}: {
  activeView: WorkspaceView;
  links: Record<WorkspaceView, string>;
}) {
  const items = [
    { label: "Обзор", view: "overview" as const },
    { label: "Согласования", view: "approvals" as const },
    { label: "Календарь", view: "calendar" as const },
    { label: "Материалы", view: "drafts" as const },
    { label: "Креативы", view: "assets" as const },
    { label: "Клиентский вид", view: "client_portal" as const },
  ];

  return (
    <nav aria-label="Рабочие зоны" className="mt-5 overflow-x-auto rounded-lg border border-stone-200 bg-white p-1.5 shadow-[0_1px_2px_rgba(28,36,38,0.04)]">
      <div className="flex min-w-max gap-1">
        {items.map((item) => (
          <a
            key={item.view}
            href={links[item.view]}
            className={`rounded-md px-3 py-2 text-xs font-bold transition ${
              item.view === activeView ? "bg-teal-800 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function OverviewPreviews({
  drafts,
  publications,
  assets,
  jobs,
  links,
}: {
  drafts: DraftQueueItem[];
  publications: ScheduledPublicationPreview[];
  assets: CreativeAssetPreview[];
  jobs: GenerationJobPreview[];
  links: Record<WorkspaceView, string>;
}) {
  const reviewDrafts = drafts.filter((draft) => ["draft", "needs_review", "sent_to_client", "client_changes_requested"].includes(draft.status)).slice(0, 3);
  const calendarPublications = publications.slice(0, 3);
  const creativeAssets = assets.filter((asset) => asset.status !== "approved").slice(0, 3);
  const productionJobs = jobs.filter((job) => ["running", "failed"].includes(job.status)).slice(0, 3);

  return (
    <section className={`mt-7 ${compactGridClass}`}>
      <article className={`${panelClass} min-w-0 p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">Согласования</p>
            <h3 className="mt-1 font-semibold text-stone-950">Короткая очередь</h3>
          </div>
          <StatusBadge tone={reviewDrafts.length > 0 ? "amber" : "green"}>{reviewDrafts.length}</StatusBadge>
        </div>
        <div className="mt-3 grid gap-2">
          {reviewDrafts.map((draft) => (
            <div key={draft.id} className="min-w-0 rounded-md border border-stone-200 bg-stone-50/70 p-3">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-teal-700">{draft.platformName} &middot; {draft.format}</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-stone-900">{draft.draftTitle}</p>
              <p className="mt-1 text-xs text-stone-500">{formatDraftStatus(draft.status)}</p>
            </div>
          ))}
          {reviewDrafts.length === 0 ? <p className={mutedTextClass}>Нет материалов, требующих внимания.</p> : null}
        </div>
        <a href={links.approvals} className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950">Открыть согласования</a>
      </article>

      <article className={`${panelClass} min-w-0 p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">Календарь</p>
            <h3 className="mt-1 font-semibold text-stone-950">Ближайшие публикации</h3>
          </div>
          <StatusBadge tone="teal">{calendarPublications.length}</StatusBadge>
        </div>
        <div className="mt-3 grid gap-2">
          {calendarPublications.map((publication) => (
            <div key={publication.id} className="min-w-0 rounded-md border border-stone-200 bg-stone-50/70 p-3">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-teal-700">{publication.scheduledDate}{publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-stone-900">{publication.topic}</p>
              <p className="mt-1 text-xs text-stone-500">{publication.platformName} &middot; {formatStatus(publication.status)}</p>
            </div>
          ))}
          {calendarPublications.length === 0 ? <p className={mutedTextClass}>Публикации с датой пока не запланированы.</p> : null}
        </div>
        <a href={links.calendar} className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950">Открыть календарь</a>
      </article>

      <article className={`${panelClass} min-w-0 p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">Креативы</p>
            <h3 className="mt-1 font-semibold text-stone-950">Материалы в работе</h3>
          </div>
          <StatusBadge tone={creativeAssets.length > 0 ? "amber" : "green"}>{creativeAssets.length}</StatusBadge>
        </div>
        <div className="mt-3 grid gap-2">
          {creativeAssets.map((asset) => (
            <div key={asset.id} className="min-w-0 rounded-md border border-stone-200 bg-stone-50/70 p-3">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-teal-700">{asset.scheduledPublication.platformName} &middot; {formatStatus(asset.assetType)}</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-stone-900">{asset.title}</p>
              <p className="mt-1 text-xs text-stone-500">{formatStatus(asset.status)}</p>
            </div>
          ))}
          {creativeAssets.length === 0 ? <p className={mutedTextClass}>Нет креативов, требующих внимания.</p> : null}
        </div>
        <a href={links.assets} className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950">Открыть креативы</a>
      </article>

      <article className={`${panelClass} min-w-0 p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">AI production</p>
            <h3 className="mt-1 font-semibold text-stone-950">Производственные задачи</h3>
          </div>
          <StatusBadge tone={productionJobs.some((job) => job.status === "failed") ? "rose" : productionJobs.length > 0 ? "teal" : "green"}>
            {productionJobs.length}
          </StatusBadge>
        </div>
        <div className="mt-3 grid gap-2">
          {productionJobs.map((job) => (
            <GenerationJobIndicator key={job.id} job={job} compact />
          ))}
          {productionJobs.length === 0 ? <p className={mutedTextClass}>Нет активных или проблемных генераций.</p> : null}
        </div>
        <a href={links.drafts} className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950">Открыть материалы</a>
      </article>
    </section>
  );
}

function WorkspaceViewHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold text-stone-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}

type MaterialNextStepKind =
  | "generate_text"
  | "review_text"
  | "schedule"
  | "generate_brief"
  | "generate_visual"
  | "check_visual"
  | "approve_visual"
  | "ready";

function materialNextStep(item: MaterialPlannedItem, publication?: ScheduledPublicationPreview) {
  const draft = item.contentDraft;
  const asset = publication?.creativeAssets[0];
  const variants = asset?.generatedVariants ?? [];

  if (!draft) {
    return { kind: "generate_text" as const, label: "Сгенерируйте текст публикации" };
  }

  if (!["approved", "ready_to_schedule"].includes(draft.status)) {
    return { kind: "review_text" as const, label: "Проверьте и согласуйте текст публикации" };
  }

  if (!publication) {
    return { kind: "schedule" as const, label: "Запланируйте публикацию" };
  }

  if (!asset) {
    return { kind: "generate_brief" as const, label: "Сгенерируйте ТЗ на креатив" };
  }

  if (variants.length === 0) {
    return { kind: "generate_visual" as const, label: "Сгенерируйте премиум-визуал" };
  }

  if (!variants.some((variant) => variant.qualityStatus === "passed")) {
    return { kind: "check_visual" as const, label: "Проверьте качество визуала" };
  }

  if (!variants.some((variant) => variant.status === "approved")) {
    return { kind: "approve_visual" as const, label: "Согласуйте выбранный визуал" };
  }

  return { kind: "ready" as const, label: "Материал готов к клиентскому согласованию или публикации" };
}

function MaterialPrimaryAction({
  item,
  publication,
  approvalsHref,
  calendarHref,
  assetsHref,
}: {
  item: MaterialPlannedItem;
  publication?: ScheduledPublicationPreview;
  approvalsHref: string;
  calendarHref: string;
  assetsHref: string;
}) {
  const nextStep = materialNextStep(item, publication);
  const asset = publication?.creativeAssets[0];

  if (nextStep.kind === "generate_text") {
    return (
      <form action={generateContentDraftForItem}>
        <input type="hidden" name="plannedContentItemId" value={item.id} />
        <PendingSubmitButton pendingLabel="Генерируем текст..." className={primaryButtonClass}>
          Сгенерировать текст публикации
        </PendingSubmitButton>
      </form>
    );
  }

  if (nextStep.kind === "review_text") {
    return <a href={approvalsHref} className={primaryButtonClass}>Открыть согласование текста</a>;
  }

  if (nextStep.kind === "schedule") {
    return <a href={calendarHref} className={primaryButtonClass}>Открыть планирование публикации</a>;
  }

  if (nextStep.kind === "generate_brief" && publication) {
    return (
      <form action={generateCreativeAssetBriefForPublication}>
        <input type="hidden" name="scheduledPublicationId" value={publication.id} />
        <input type="hidden" name="returnView" value="drafts" />
        <PendingSubmitButton pendingLabel="Генерируем ТЗ..." className={primaryButtonClass}>
          Сгенерировать ТЗ через AI
        </PendingSubmitButton>
      </form>
    );
  }

  if (nextStep.kind === "generate_visual" && asset) {
    return (
      <form action={generateCreativeVisualVariantForAsset}>
        <input type="hidden" name="creativeAssetId" value={asset.id} />
        <input type="hidden" name="returnView" value="drafts" />
        <PendingSubmitButton pendingLabel="Генерируем визуал..." className={primaryButtonClass}>
          Сгенерировать премиум-визуал
        </PendingSubmitButton>
      </form>
    );
  }

  if (nextStep.kind === "ready") {
    return <a href={approvalsHref} className={secondaryButtonClass}>Открыть согласования</a>;
  }

  return <a href={assetsHref} className={primaryButtonClass}>Открыть проверку визуала</a>;
}

function DraftsView({
  items,
  publications,
  jobs,
  monthlyPlanId,
  blueprintId,
  approvalsHref,
  calendarHref,
  assetsHref,
  clientPortalHref,
}: {
  items: MaterialPlannedItem[];
  publications: ScheduledPublicationPreview[];
  jobs: GenerationJobPreview[];
  monthlyPlanId?: string;
  blueprintId?: string;
  approvalsHref: string;
  calendarHref: string;
  assetsHref: string;
  clientPortalHref: string;
}) {
  const totalMaterialsCount = items.length;
  const textsCreatedCount = items.filter((item) => item.contentDraft).length;
  const missingTextsCount = totalMaterialsCount - textsCreatedCount;
  const approvedTextsCount = items.filter((item) => item.contentDraft && ["approved", "ready_to_schedule"].includes(item.contentDraft.status)).length;
  const scheduledCount = publications.length;
  const missingBriefsCount = publications.filter((publication) => publication.creativeAssets.length === 0).length;
  const missingVisualsCount = publications.filter((publication) =>
    publication.creativeAssets.some((asset) => asset.generatedVariants.length === 0),
  ).length;
  const allTextsReady = totalMaterialsCount > 0 && missingTextsCount === 0;
  const autopilotBatchLimit = getAutopilotTextBatchLimit();

  return (
    <section>
      <WorkspaceViewHeader
        eyebrow="Контент-производство"
        title="Материалы публикаций"
        description="Каждая публикация собрана в одной рабочей карточке: текст, согласование, дата, ТЗ и визуал. Начните со следующего рекомендованного действия."
      />
      <div className="mt-4">
        <a href={clientPortalHref} className={secondaryButtonClass}>Открыть клиентский вид</a>
      </div>
      <article className={`${panelClass} mt-5 overflow-hidden border-teal-200`}>
        <div className="grid gap-5 bg-teal-50/60 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Production Autopilot</p>
            <h3 className="mt-1 text-lg font-semibold text-stone-950">Автоподготовка месяца</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              Система создаст недостающие тексты публикаций для текущего месячного плана. ТЗ, визуалы и согласования останутся под контролем менеджера.
            </p>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              За один запуск готовится до {autopilotBatchLimit} материалов, чтобы не перегружать генерацию.
            </p>
          </div>
          {missingTextsCount > 0 && monthlyPlanId ? (
            <form action={prepareMonthAutopilot}>
              <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
              {blueprintId ? <input type="hidden" name="blueprintId" value={blueprintId} /> : null}
              <PendingSubmitButton pendingLabel="Готовим материалы..." className={primaryButtonClass}>
                Подготовить месяц
              </PendingSubmitButton>
            </form>
          ) : (
            <StatusBadge tone={allTextsReady ? "green" : "neutral"}>{allTextsReady ? "Тексты готовы" : "Нужен месячный план"}</StatusBadge>
          )}
        </div>
      </article>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <MetricCard label="Всего материалов" value={totalMaterialsCount} detail="В текущем плане" />
        <MetricCard label="Тексты созданы" value={textsCreatedCount} detail="Можно проверять" tone="teal" />
        <MetricCard label="Тексты не созданы" value={missingTextsCount} detail="Подготовит автопилот" tone={missingTextsCount > 0 ? "amber" : "stone"} />
        <MetricCard label="Согласованы" value={approvedTextsCount} detail="Текст прошёл проверку" />
        <MetricCard label="Запланированы" value={scheduledCount} detail="Есть дата публикации" tone="teal" />
        <MetricCard label="Нужны ТЗ" value={missingBriefsCount} detail="После планирования" tone={missingBriefsCount > 0 ? "amber" : "stone"} />
        <MetricCard label="Нужны визуалы" value={missingVisualsCount} detail="ТЗ уже подготовлено" tone={missingVisualsCount > 0 ? "amber" : "stone"} />
      </div>
      <GenerationJobsPanel jobs={jobs} />
      {allTextsReady ? (
        <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm leading-6 text-teal-900">
          <span className="font-semibold">Все тексты созданы.</span> Откройте материал, чтобы редактировать, согласовать или подготовить визуал.
        </div>
      ) : null}
      <div className="mt-5 grid gap-4">
        {items.map((item) => {
          const draft = item.contentDraft;
          const publication = publications.find((candidate) => candidate.plannedContentItemId === item.id);
          const asset = publication?.creativeAssets[0];
          const nextStep = materialNextStep(item, publication);
          const latestEvent = draft?.reviewEvents.at(-1);
          const latestJob = jobs.find((job) => job.plannedContentItemId === item.id);
          const latestVisualJob = asset
            ? jobs.find((job) => job.creativeAssetId === asset.id && ["generate_visual", "regenerate_visual"].includes(job.jobType))
            : undefined;

          return (
            <article id={`material-${item.id}`} key={item.id} className={`${panelClass} min-w-0 scroll-mt-24 p-4 sm:p-5`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge tone="teal">{item.platformName}</StatusBadge>
                    <StatusBadge>{item.format}</StatusBadge>
                    <StatusBadge>{publication ? `${publication.scheduledDate}${publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}` : item.week || item.plannedDate}</StatusBadge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold leading-7 text-stone-950">{item.topic}</h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">{item.goal}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone={materialTextStatusTone(draft)}>{formatMaterialTextStatus(draft)}</StatusBadge>
                  {publication ? <StatusBadge tone={scheduledPublicationTone(publication.status)}>{formatStatus(publication.status)}</StatusBadge> : <StatusBadge>Нет даты</StatusBadge>}
                  {asset ? <CreativeAssetVisualStatus variants={asset.generatedVariants} /> : <StatusBadge tone="neutral">Визуал не создан</StatusBadge>}
                </div>
              </div>
              {latestJob ? <div className="mt-3"><GenerationJobIndicator job={latestJob} /></div> : null}

              <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/70 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">Следующий шаг</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-teal-950">{nextStep.label}</p>
                <div className="mt-3">
                  <MaterialPrimaryAction item={item} publication={publication} approvalsHref={approvalsHref} calendarHref={calendarHref} assetsHref={assetsHref} />
                </div>
              </div>

              <details
                id={`material-details-${item.id}`}
                open={["review_text", "schedule", "check_visual", "approve_visual"].includes(nextStep.kind)}
                className="mt-4 rounded-lg border border-stone-200 bg-stone-50/70"
              >
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-stone-800">Открыть материал</summary>
                <div className="grid gap-5 border-t border-stone-200 p-4">
                  <section>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-stone-950">Текст публикации</h4>
                      {draft ? <StatusBadge tone={draftStatusTone(draft.status)}>{formatDraftStatus(draft.status)}</StatusBadge> : <StatusBadge>Не создан</StatusBadge>}
                    </div>
                    {draft ? (
                      <>
                        <form action={updatePublicationText} className="mt-3 grid gap-2">
                          <input type="hidden" name="contentDraftId" value={draft.id} />
                          <label className="grid gap-1 text-xs font-bold text-stone-600">
                            Заголовок
                            <input type="text" name="draftTitle" required defaultValue={draft.draftTitle} className={inputClass} />
                          </label>
                          <label className="grid gap-1 text-xs font-bold text-stone-600">
                            Текст публикации
                            <textarea name="draftBody" required rows={8} defaultValue={draft.draftBody} className={inputClass} />
                          </label>
                          <label className="grid gap-1 text-xs font-bold text-stone-600">
                            Комментарий к правке
                            <input type="text" name="comment" className={inputClass} placeholder="Необязательно" />
                          </label>
                          <p className="text-xs leading-5 text-stone-500">Если текст уже был согласован, после правки он снова вернётся на проверку.</p>
                          <div className="flex flex-wrap gap-2">
                            <PendingSubmitButton pendingLabel="Сохраняем правки..." className={primaryButtonClass}>Сохранить правки</PendingSubmitButton>
                          </div>
                        </form>
                        <form action={regenerateContentDraftForItem} className="mt-3">
                          <input type="hidden" name="plannedContentItemId" value={item.id} />
                          <PendingSubmitButton pendingLabel="Перегенерируем текст..." className={secondaryButtonClass}>
                            Перегенерировать текст через AI
                          </PendingSubmitButton>
                        </form>
                        {latestEvent ? (
                          <p className="mt-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-500">
                            Последнее событие: <span className="font-bold text-stone-700">{formatReviewAction(latestEvent.action)}</span> · {formatReviewActor(latestEvent.actorType)}
                          </p>
                        ) : null}
                        <div className="mt-3"><ReviewEventTimeline events={draft.reviewEvents} /></div>
                        <div className="mt-3 border-t border-stone-200 pt-3">
                          <DraftWorkflowControls draft={draft} calendarHref={calendarHref} returnView="drafts" />
                        </div>
                      </>
                    ) : (
                      <form action={generateContentDraftForItem} className="mt-3">
                        <input type="hidden" name="plannedContentItemId" value={item.id} />
                        <PendingSubmitButton pendingLabel="Генерируем текст..." className={primaryButtonClass}>
                          Сгенерировать текст публикации
                        </PendingSubmitButton>
                      </form>
                    )}
                  </section>

                  <section id={`schedule-${item.id}`} className="border-t border-stone-200 pt-4">
                    <h4 className="text-sm font-semibold text-stone-950">Календарь публикации</h4>
                    {publication ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge tone={scheduledPublicationTone(publication.status)}>{formatStatus(publication.status)}</StatusBadge>
                        <StatusBadge>{publication.scheduledDate}{publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}</StatusBadge>
                        <a href={calendarHref} className="text-xs font-bold text-teal-800 transition hover:text-teal-950">Открыть календарь</a>
                      </div>
                    ) : draft && ["approved", "ready_to_schedule"].includes(draft.status) ? (
                      <form action={scheduleContentDraft} className="mt-3 grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="contentDraftId" value={draft.id} />
                        <input type="hidden" name="returnView" value="drafts" />
                        <label className="grid gap-1 text-xs font-bold text-stone-600">Дата<input type="date" name="scheduledDate" required className={inputClass} /></label>
                        <label className="grid gap-1 text-xs font-bold text-stone-600">Время<input type="time" name="scheduledTime" className={inputClass} /></label>
                        <label className="grid gap-1 text-xs font-bold text-stone-600 sm:col-span-2">Заметка<input type="text" name="notes" className={inputClass} placeholder="Необязательно" /></label>
                        <PendingSubmitButton pendingLabel="Планируем..." className={`${primaryButtonClass} sm:col-span-2`}>Запланировать</PendingSubmitButton>
                      </form>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-stone-500">Сначала согласуйте текст публикации. После этого появится форма планирования.</p>
                    )}
                  </section>

                  <section className="border-t border-stone-200 pt-4">
                    <h4 className="text-sm font-semibold text-stone-950">Креатив и визуал</h4>
                    {!publication ? (
                      <p className="mt-2 text-sm leading-6 text-stone-500">Сначала запланируйте публикацию, чтобы создать ТЗ и визуал. Визуал появится после планирования публикации.</p>
                    ) : !asset ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                        <p className="text-sm font-semibold text-amber-950">Нет ТЗ на креатив</p>
                        <p className="mt-1 text-xs leading-5 text-amber-800">AI соберёт ТЗ по тексту, площадке, формату и теме публикации.</p>
                        <form action={generateCreativeAssetBriefForPublication} className="mt-3">
                          <input type="hidden" name="scheduledPublicationId" value={publication.id} />
                          <input type="hidden" name="returnView" value="drafts" />
                          <PendingSubmitButton pendingLabel="Генерируем ТЗ..." className={primaryButtonClass}>Сгенерировать ТЗ через AI</PendingSubmitButton>
                        </form>
                        <a href={assetsHref} className="mt-3 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950">Создать ТЗ вручную</a>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone="teal">{formatStatus(asset.assetType)}</StatusBadge>
                          <CreativeAssetSourceBadge source={asset.source} />
                          <StatusBadge tone={creativeAssetTone(asset.status)}>{formatStatus(asset.status)}</StatusBadge>
                        </div>
                        <p className="mt-3 font-semibold text-stone-900">{asset.title}</p>
                        <p className="mt-1 line-clamp-3 text-sm leading-6 text-stone-600">{asset.brief}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <form action={regenerateCreativeAssetBrief}>
                            <input type="hidden" name="creativeAssetId" value={asset.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <PendingSubmitButton pendingLabel="Перегенерируем ТЗ..." className={secondaryButtonClass}>Перегенерировать ТЗ через AI</PendingSubmitButton>
                          </form>
                          <a href={assetsHref} className={secondaryButtonClass}>Открыть полное ТЗ</a>
                        </div>
                        <div id={`visuals-${asset.id}`} className="mt-4 border-t border-stone-200 pt-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-stone-950">Варианты визуала</p>
                            <form action={generateCreativeVisualVariantForAsset}>
                              <input type="hidden" name="creativeAssetId" value={asset.id} />
                              <input type="hidden" name="returnView" value="drafts" />
                              <PendingSubmitButton pendingLabel="Генерируем визуал..." className={primaryButtonClass}>
                                {asset.generatedVariants.length > 0 ? "Сгенерировать ещё вариант" : "Сгенерировать премиум-визуал"}
                              </PendingSubmitButton>
                            </form>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-teal-700">
                            Генерация может занять 30–90 секунд. Задача появится в производственных задачах.
                          </p>
                          {latestVisualJob ? <div className="mt-3"><GenerationJobIndicator job={latestVisualJob} /></div> : null}
                          {asset.generatedVariants.length > 0 ? (
                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                              {asset.generatedVariants.map((variant) => (
                                <article key={variant.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                                  <img src={`data:${variant.mimeType};base64,${variant.imageBase64}`} alt={variant.variantTitle} className="aspect-square max-h-72 w-full bg-stone-100 object-contain" />
                                  <div className="p-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      <StatusBadge tone={creativeVariantTone(variant.status)}>{formatStatus(variant.status)}</StatusBadge>
                                      <StatusBadge tone={creativeVariantQualityTone(variant.qualityStatus)}>{formatStatus(variant.qualityStatus)}</StatusBadge>
                                    </div>
                                    <p className="mt-2 text-sm font-semibold text-stone-900">{variant.variantTitle}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <CreativeVariantAction action={markCreativeVariantQualityPassed} variantId={variant.id} returnView="drafts" tone="green">Качество ок</CreativeVariantAction>
                                      <CreativeVariantAction action={approveCreativeVariant} variantId={variant.id} returnView="drafts" tone="green">Согласовать</CreativeVariantAction>
                                      <CreativeVariantAction action={rejectCreativeVariant} variantId={variant.id} returnView="drafts" tone="rose">Отклонить</CreativeVariantAction>
                                    </div>
                                    <form action={markCreativeVariantQualityFailed} className="mt-2 flex min-w-0 flex-wrap gap-2">
                                      <input type="hidden" name="creativeVariantId" value={variant.id} />
                                      <input type="hidden" name="returnView" value="drafts" />
                                      <input type="text" name="qualityNotes" className="min-w-44 flex-1 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-teal-500" placeholder="Комментарий к проблеме" />
                                      <PendingSubmitButton pendingLabel="Сохраняем..." className={destructiveButtonClass}>Есть проблемы</PendingSubmitButton>
                                    </form>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm leading-6 text-stone-500">Визуал пока не создан. Запустите Premium Visual Engine для первого варианта.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </details>
            </article>
          );
        })}
        {items.length === 0 ? <EmptyState>Сгенерируйте месячный план, чтобы публикационные материалы появились в этом разделе.</EmptyState> : null}
      </div>
    </section>
  );
}

function OperationsOverview({
  progress,
  attentionCount,
  draftCount,
  integrationTaskCount,
  creativeAssetAttentionCount,
}: {
  progress: number;
  attentionCount: number;
  draftCount: number;
  integrationTaskCount: number;
  creativeAssetAttentionCount: number;
}) {
  return (
    <article className={`${panelClass} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Операционный обзор</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Состояние работы на месяц</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Рабочий индикатор прогресса: готовность текстов, нагрузка на согласование и состояние интеграций.
          </p>
        </div>
        <StatusBadge tone={integrationTaskCount > 0 ? "amber" : "green"}>
          {integrationTaskCount > 0 ? "Нужно настроить доступы" : "Всё по плану"}
        </StatusBadge>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="text-5xl font-semibold text-stone-950">{progress}%</p>
          <p className="mt-2 text-sm font-semibold text-stone-700">Готовность производства</p>
          <p className="mt-1 text-xs leading-5 text-stone-400">Тексты подготовлены относительно материалов в календаре.</p>
        </div>
        <div>
          <div className="flex h-44 items-end gap-3 rounded-lg border border-stone-200 bg-stone-50 px-5 pb-4 pt-6">
            {[
              { label: "План", value: 100, tone: "bg-teal-500" },
              { label: "Тексты", value: Math.max(progress, 10), tone: "bg-sky-500" },
              { label: "Проверка", value: attentionCount > 0 ? 58 : 20, tone: "bg-amber-400" },
              { label: "Готово", value: integrationTaskCount > 0 ? 22 : Math.max(progress - 12, 10), tone: "bg-emerald-500" },
            ].map((bar) => (
              <div key={bar.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                <div className={`w-full max-w-14 rounded-t-md ${bar.tone}`} style={{ height: `${bar.value}%` }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-stone-400">{bar.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />По плану</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-sky-500" />В работе</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />Есть риск</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-500" />Заблокировано</span>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Готовые тексты" value={draftCount} detail="Можно проверять" tone="teal" />
        <MetricCard label="Требует внимания" value={attentionCount} detail="Нагрузка на согласование" tone="amber" />
        <MetricCard label="Задачи по интеграциям" value={integrationTaskCount} detail="До запуска" tone={integrationTaskCount > 0 ? "rose" : "stone"} />
        <MetricCard label="Нужны визуалы" value={creativeAssetAttentionCount} detail="ТЗ и материалы в работе" tone={creativeAssetAttentionCount > 0 ? "amber" : "stone"} />
      </div>
    </article>
  );
}

function ClientPortalLinksPanel({
  blueprintId,
  monthlyPlanId,
  links,
  newPortalLink,
}: {
  blueprintId?: string;
  monthlyPlanId?: string;
  links: Array<{
    id: string;
    tokenPrefix: string;
    label: string | null;
    status: string;
    createdAt: Date;
    lastOpenedAt: Date | null;
  }>;
  newPortalLink?: string;
}) {
  return (
    <section className="mb-5 rounded-lg border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(28,36,38,0.04)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Доступ для клиента</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">Клиентская ссылка</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Ссылка открывает только клиентский календарь выбранного месячного плана. Менеджерская панель недоступна.
          </p>
        </div>
        {monthlyPlanId && blueprintId ? (
          <form action={createClientPortalLink} className="grid w-full gap-2 sm:max-w-sm">
            <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
            <input type="hidden" name="blueprintId" value={blueprintId} />
            <input name="label" className={inputClass} placeholder="Название ссылки, например Основная" />
            <PendingSubmitButton pendingLabel="Создаём ссылку..." className={primaryButtonClass}>Создать клиентскую ссылку</PendingSubmitButton>
          </form>
        ) : (
          <StatusBadge tone="amber">Выберите месячный план</StatusBadge>
        )}
      </div>

      {newPortalLink ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-900">Скопируйте ссылку для клиента</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">Эта ссылка показана после создания. Сырой токен не хранится в базе.</p>
          <input readOnly value={newPortalLink} className={`${inputClass} mt-3 font-mono text-xs`} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {links.map((link) => (
          <article key={link.id} className="flex flex-col gap-3 rounded-md border border-stone-200 bg-stone-50/60 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-stone-900">{link.label || "Клиентская ссылка"}</p>
                <StatusBadge tone={link.status === "active" ? "green" : "neutral"}>{link.status === "active" ? "Активна" : "Отключена"}</StatusBadge>
                <StatusBadge>{link.tokenPrefix}...</StatusBadge>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                Создана: {link.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                {" · "}
                Последнее открытие: {link.lastOpenedAt ? link.lastOpenedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "ещё не открывали"}
              </p>
            </div>
            {link.status === "active" ? (
              <form action={revokeClientPortalLink}>
                <input type="hidden" name="portalLinkId" value={link.id} />
                <PendingSubmitButton pendingLabel="Отключаем..." className={secondaryButtonClass}>Отключить ссылку</PendingSubmitButton>
              </form>
            ) : null}
          </article>
        ))}
        {links.length === 0 ? <EmptyState>Для этого месячного плана ещё нет клиентских ссылок.</EmptyState> : null}
      </div>
    </section>
  );
}

function ContentItemAction({ item, draftsHref }: { item: CalendarPreviewItem; draftsHref: string }) {
  return item.contentDraft ? (
    <div className="flex flex-wrap gap-2">
      <a
        href={draftsHref}
        className="inline-flex rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 transition hover:bg-teal-100"
      >
        Открыть материал
      </a>
      <form action={regenerateContentDraftForItem}>
        <input type="hidden" name="plannedContentItemId" value={item.id} />
        <PendingSubmitButton
          pendingLabel="Обновляем текст..."
          className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 transition hover:bg-stone-50"
        >
          Перегенерировать текст
        </PendingSubmitButton>
      </form>
    </div>
  ) : (
    <form action={generateContentDraftForItem}>
      <input type="hidden" name="plannedContentItemId" value={item.id} />
      <PendingSubmitButton
        pendingLabel="Генерируем текст..."
        className="rounded-md bg-stone-950 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:bg-stone-400"
      >
        Сгенерировать текст
      </PendingSubmitButton>
    </form>
  );
}

function ScheduledPublicationCalendar({
  publications,
}: {
  publications: ScheduledPublicationPreview[];
}) {
  return (
    <div className="bg-stone-50/50 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Операционный календарь</p>
          <h3 className="mt-1 text-lg font-semibold text-stone-950">Публикации с подтверждённой датой</h3>
        </div>
        <p className="text-xs leading-5 text-stone-500">Плановые материалы скрыты, пока есть рабочее расписание.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {publications.map((publication) => {
          const asset = publication.creativeAssets[0];

          return (
            <article
              key={publication.id}
              className="rounded-lg border border-teal-200 bg-white p-4 shadow-[0_4px_12px_rgba(13,148,136,0.08)]"
            >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge tone="teal">{publication.platformName}</StatusBadge>
                <StatusBadge>{publication.format}</StatusBadge>
              </div>
              <StatusBadge tone={scheduledPublicationTone(publication.status)}>{formatStatus(publication.status)}</StatusBadge>
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.08em] text-teal-700">
              {publication.scheduledDate}
              {publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}
            </p>
            <h4 className="mt-2 text-sm font-semibold leading-6 text-stone-950">{publication.topic}</h4>
            <p className="mt-2 text-xs leading-5 text-stone-500">Текст публикации: {publication.contentDraft.draftTitle}</p>
            {publication.notes ? (
              <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
                {publication.notes}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge>{formatStatus(publication.publishMode)}</StatusBadge>
              {publication.timezone ? <StatusBadge>{publication.timezone}</StatusBadge> : null}
              {asset ? (
                <>
                  <StatusBadge tone="teal">{formatStatus(asset.assetType)}</StatusBadge>
                  <StatusBadge tone={creativeAssetTone(asset.status)}>{formatStatus(asset.status)}</StatusBadge>
                  <CreativeAssetSourceBadge source={asset.source} compact />
                  {asset.generatedVariants.some((variant) => variant.status === "approved") ? (
                    <StatusBadge tone="green">Визуал согласован</StatusBadge>
                  ) : asset.generatedVariants.length > 0 ? (
                    <StatusBadge tone="teal">Визуал создан</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">ТЗ есть, визуал не создан</StatusBadge>
                  )}
                </>
              ) : publication.status === "needs_assets" ? (
                <StatusBadge tone="amber">Нет ТЗ на креатив</StatusBadge>
              ) : null}
            </div>
            <a
              href="#scheduling"
              className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950"
            >
              Управлять публикацией
            </a>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ContentCalendar({
  groups,
  publications,
  month,
  blueprintId,
  generationBlocked,
  draftsHref,
  clientSetupHref,
}: {
  groups: ReturnType<typeof groupCalendarItems>;
  publications: ScheduledPublicationPreview[];
  month: string;
  blueprintId?: string;
  generationBlocked: boolean;
  draftsHref: string;
  clientSetupHref: string;
}) {
  const items = groups.flatMap((group) => group.items);
  const inspectorItem = items[0];
  const scheduledByItemId = new Map(
    publications.map((publication) => [publication.plannedContentItemId, publication]),
  );
  const inspectorPublication = inspectorItem ? scheduledByItemId.get(inspectorItem.id) : null;
  const scheduledCount = publications.filter((publication) => publication.status === "scheduled").length;
  const needsAssetsCount = publications.filter((publication) => publication.status === "needs_assets").length;
  const readyCount = publications.filter((publication) => publication.status === "ready").length;
  const skippedCount = publications.filter((publication) => publication.status === "skipped").length;

  return (
    <section id="calendar" className={`${panelClass} scroll-mt-24 overflow-hidden`}>
      <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Рабочее пространство</p>
            <h2 className="mt-1 text-2xl font-semibold text-stone-950">Контент-календарь</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Центр управления планом, текстами, согласованиями и будущими публикациями.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass}>Все клиенты</button>
            <button type="button" className={secondaryButtonClass}>Все площадки</button>
            <button type="button" className={secondaryButtonClass}>Неделя</button>
            <StatusBadge tone="teal">{month}</StatusBadge>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Запланировано" value={scheduledCount} detail="Публикации с датой" tone="teal" />
          <MetricCard label="Нужны материалы" value={needsAssetsCount} detail="Нужно подготовить визуал" tone="amber" />
          <MetricCard label="Готово" value={readyCount} detail="Можно размещать вручную" />
          <MetricCard label="Пропущено" value={skippedCount} detail="Снято с текущей работы" />
        </div>
      </div>

      {publications.length > 0 ? (
        <ScheduledPublicationCalendar publications={publications} />
      ) : groups.length > 0 ? (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-x-auto bg-stone-50/50 p-4">
            <div className="grid min-w-[920px] grid-cols-4 gap-3">
              {groups.map((group) => (
                <article key={group.label} className="rounded-lg border border-stone-200 bg-stone-100/70 p-3">
                  <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">{group.label}</p>
                      <p className="mt-1 text-xs text-stone-400">{group.items.length} материалов</p>
                    </div>
                    <StatusBadge>{group.items.length}</StatusBadge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {group.items.map((item) => {
                      const scheduledPublication = scheduledByItemId.get(item.id);

                      return (
                      <div key={item.id} className="rounded-md border border-stone-200 bg-white p-3 shadow-[0_1px_2px_rgba(28,36,38,0.04)]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone="teal">{item.platformName}</StatusBadge>
                          <StatusBadge>{item.format}</StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-stone-400">{item.plannedDate}</p>
                        {scheduledPublication ? (
                          <p className="mt-1 text-xs font-bold text-teal-700">
                            Публикация: {scheduledPublication.scheduledDate}
                            {scheduledPublication.scheduledTime ? `, ${scheduledPublication.scheduledTime}` : ""}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm font-semibold leading-5 text-stone-900">{item.topic}</p>
                        {suggestsVisualAsset(item.format) ? (
                          <div className="mt-3 flex h-16 items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">
                            Визуал / видео
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {scheduledPublication ? (
                            <StatusBadge tone={scheduledPublicationTone(scheduledPublication.status)}>{formatStatus(scheduledPublication.status)}</StatusBadge>
                          ) : (
                            <StatusBadge tone={item.status === "planned" ? "teal" : "amber"}>{formatStatus(item.status)}</StatusBadge>
                          )}
                          {item.approvalRequired ? <StatusBadge tone="amber">Нужно проверить</StatusBadge> : null}
                          <StatusBadge tone={materialTextStatusTone(item.contentDraft)}>{formatMaterialTextStatus(item.contentDraft)}</StatusBadge>
                        </div>
                        <div className="mt-3 border-t border-stone-100 pt-3">
                          <ContentItemAction item={item} draftsHref={draftsHref} />
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="border-t border-stone-200 bg-white p-5 xl:border-l xl:border-t-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Карточка материала</p>
            {inspectorItem ? (
              <div className="mt-4">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone="teal">{inspectorItem.platformName}</StatusBadge>
                  <StatusBadge>{inspectorItem.format}</StatusBadge>
                </div>
                <h3 className="mt-3 text-lg font-semibold leading-7 text-stone-950">{inspectorItem.topic}</h3>
                <p className="mt-1 text-xs font-semibold text-stone-400">{inspectorItem.plannedDate}</p>
                {inspectorPublication ? (
                  <p className="mt-1 text-xs font-bold text-teal-700">
                    Публикация: {inspectorPublication.scheduledDate}
                    {inspectorPublication.scheduledTime ? `, ${inspectorPublication.scheduledTime}` : ""}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {inspectorPublication ? (
                    <StatusBadge tone={scheduledPublicationTone(inspectorPublication.status)}>{formatStatus(inspectorPublication.status)}</StatusBadge>
                  ) : (
                    <StatusBadge tone="teal">{formatStatus(inspectorItem.status)}</StatusBadge>
                  )}
                  {inspectorItem.approvalRequired ? <StatusBadge tone="amber">Нужно проверить</StatusBadge> : <StatusBadge tone="green">Проверка необязательна</StatusBadge>}
                </div>
                <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">
                  Превью визуала
                </div>
                <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-bold text-stone-700">Текст публикации</p>
                  <p className="mt-2 line-clamp-5 text-xs leading-5 text-stone-500">
                    {inspectorItem.contentDraft?.draftBody || "Сгенерируйте текст, чтобы подготовить материал к проверке менеджером."}
                  </p>
                </div>
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-900">Согласование</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    {inspectorItem.approvalRequired ? "Перед планированием материал должен проверить человек." : "Для материала действует политика проверки из Blueprint."}
                  </p>
                </div>
                <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 p-3">
                  <p className="text-xs font-bold text-teal-900">Рекомендация AI</p>
                  <p className="mt-1 text-xs leading-5 text-teal-800">Сохраните естественную подачу для площадки и проверьте фактические детали перед согласованием.</p>
                </div>
                <div className="mt-3 rounded-md border border-stone-200 p-3">
                  <p className="text-xs font-bold text-stone-700">Путь материала</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">Текст &rarr; Проверка &rarr; Согласование &rarr; Планирование</p>
                </div>
                <div className="mt-4 grid gap-2">
                  <ContentItemAction item={inspectorItem} draftsHref={draftsHref} />
                  <button type="button" disabled className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400">Отправить клиенту</button>
                  <button type="button" disabled className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400">Согласовать и запланировать</button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-stone-500">Детали материала появятся после генерации первого месячного плана.</p>
            )}
          </aside>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="rounded-lg border border-dashed border-teal-300 bg-teal-50/70 p-6">
            <p className="text-sm font-semibold text-teal-950">Контент-календарь готов к первому плану.</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-800">
              Сгенерируйте месячный план, чтобы заполнить недели, очередь согласований и карточки материалов.
            </p>
            {blueprintId ? (
              <form action={generateMonthlyPlan} className="mt-4">
                <input type="hidden" name="blueprintId" value={blueprintId} />
                <PendingSubmitButton pendingLabel="Генерируем месячный план..." disabled={generationBlocked} className={primaryButtonClass}>
                  Сгенерировать месячный план
                </PendingSubmitButton>
              </form>
            ) : (
              <a href={clientSetupHref} className="mt-4 inline-flex text-sm font-bold text-teal-800 transition hover:text-teal-950">
                Начать с настройки клиента
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const activeView = getActiveView(params);
  const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
  const textModelSettings = getTextModelSettings();
  const autopilotTextBatchLimit = getAutopilotTextBatchLimit();
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

  const [clients, selectedBlueprint] = await Promise.all([
    isProductionBuild
      ? []
      : prisma.client.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            briefs: {
              orderBy: { createdAt: "desc" },
              include: { blueprint: true },
            },
            blueprints: {
              orderBy: { createdAt: "desc" },
            },
          },
        }),
    !isProductionBuild && params.blueprint
      ? prisma.clientPresenceBlueprint.findUnique({
          where: { id: params.blueprint },
          include: {
            client: true,
            brief: true,
            selectedModules: true,
            platformRecommendations: true,
            automationPlans: true,
            riskRules: true,
            monthlyPlans: {
              orderBy: { createdAt: "desc" },
              include: {
                modules: true,
                platforms: true,
                plannedContentItems: {
                  include: {
                    contentDraft: {
                      include: {
                        reviewEvents: {
                          orderBy: { createdAt: "asc" },
                        },
                      },
                    },
                  },
                },
                managerTasks: true,
                clientPortalLinks: {
                  orderBy: { createdAt: "desc" },
                },
                generationJobs: {
                  orderBy: { createdAt: "desc" },
                  take: 30,
                },
                creativeAssets: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    scheduledPublication: true,
                    contentDraft: true,
                    generatedVariants: {
                      orderBy: { createdAt: "desc" },
                    },
                  },
                },
                scheduledPublications: {
                  orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
                  include: {
                    contentDraft: true,
                    plannedContentItem: true,
                    creativeAssets: {
                      include: {
                        generatedVariants: {
                          orderBy: { createdAt: "desc" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : null,
  ]);

  const latestBlueprint =
    selectedBlueprint ??
    (clients[0]?.blueprints[0]
      ? await prisma.clientPresenceBlueprint.findUnique({
          where: { id: clients[0].blueprints[0].id },
          include: {
            client: true,
            brief: true,
            selectedModules: true,
            platformRecommendations: true,
            automationPlans: true,
            riskRules: true,
            monthlyPlans: {
              orderBy: { createdAt: "desc" },
              include: {
                modules: true,
                platforms: true,
                plannedContentItems: {
                  include: {
                    contentDraft: {
                      include: {
                        reviewEvents: {
                          orderBy: { createdAt: "asc" },
                        },
                      },
                    },
                  },
                },
                managerTasks: true,
                clientPortalLinks: {
                  orderBy: { createdAt: "desc" },
                },
                generationJobs: {
                  orderBy: { createdAt: "desc" },
                  take: 30,
                },
                creativeAssets: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    scheduledPublication: true,
                    contentDraft: true,
                    generatedVariants: {
                      orderBy: { createdAt: "desc" },
                    },
                  },
                },
                scheduledPublications: {
                  orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
                  include: {
                    contentDraft: true,
                    plannedContentItem: true,
                    creativeAssets: {
                      include: {
                        generatedVariants: {
                          orderBy: { createdAt: "desc" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : null);

  const currentMonthlyPlan =
    latestBlueprint?.monthlyPlans.find((plan) => plan.month === currentMonth()) ?? null;
  const selectedMonthlyPlan =
    latestBlueprint?.monthlyPlans.find((plan) => plan.id === params.plan) ??
    currentMonthlyPlan ??
    latestBlueprint?.monthlyPlans[0] ??
    null;
  const draftCount =
    selectedMonthlyPlan?.plannedContentItems.filter((item) => item.contentDraft).length ?? 0;
  const calendarGroups = groupCalendarItems(selectedMonthlyPlan?.plannedContentItems ?? []);
  const reviewQueueGroups = groupDraftsByStatus(selectedMonthlyPlan?.plannedContentItems ?? []);
  const contentDrafts = reviewQueueGroups.flatMap((group) => group.drafts);
  const needsManagerReviewCount =
    contentDrafts.filter((draft) => draft.status === "draft" || draft.status === "needs_review").length;
  const waitingForClientCount =
    contentDrafts.filter((draft) => draft.status === "sent_to_client").length;
  const changesRequestedCount =
    contentDrafts.filter((draft) => draft.status === "client_changes_requested").length;
  const approvedDraftCount =
    contentDrafts.filter((draft) => draft.status === "approved").length;
  const readyToScheduleCount =
    contentDrafts.filter((draft) => draft.status === "ready_to_schedule").length;
  const approvalQueueCount = needsManagerReviewCount + waitingForClientCount + changesRequestedCount;
  const integrationTaskCount =
    selectedMonthlyPlan?.managerTasks.filter((task) =>
      ["integration", "connect", "credential", "access", "permission", "auth", "интеграц", "подключ", "доступ"].some(
        (token) => `${task.title} ${task.description}`.toLowerCase().includes(token),
      ),
    ).length ?? 0;
  const plannedContentCount = selectedMonthlyPlan?.plannedContentItems.length ?? 0;
  const productionProgress =
    plannedContentCount > 0 ? Math.round((draftCount / plannedContentCount) * 100) : 0;
  const missingTextCount = Math.max(plannedContentCount - draftCount, 0);
  const creativeAssets = selectedMonthlyPlan?.creativeAssets ?? [];
  const generationJobs = selectedMonthlyPlan?.generationJobs ?? [];
  const creativeAssetAttentionCount =
    creativeAssets.filter((asset) => ["needed", "brief_ready", "in_production", "needs_review"].includes(asset.status)).length +
    (selectedMonthlyPlan?.scheduledPublications.filter(
      (publication) => publication.status === "needs_assets" && publication.creativeAssets.length === 0,
    ).length ?? 0);
  const missingVisualCount =
    selectedMonthlyPlan?.scheduledPublications.filter((publication) =>
      publication.creativeAssets.length === 0 ||
      publication.creativeAssets.some((asset) => asset.generatedVariants.length === 0),
    ).length ?? 0;
  const workspaceContext = {
    blueprint: latestBlueprint?.id ?? params.blueprint,
    plan: selectedMonthlyPlan?.id ?? params.plan,
    client: params.client ?? latestBlueprint?.clientId,
  };
  const workspaceLinks = Object.fromEntries(
    workspaceViews.map((view) => [view, workspaceHref(view, workspaceContext)]),
  ) as Record<WorkspaceView, string>;

  return (
    <div className={pageBackgroundClass}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-stone-200 bg-[#f8f8f5] text-stone-700 lg:flex lg:flex-col">
        <div className="border-b border-stone-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-sm font-bold text-white">
              AP
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-950">Adaptive Presence</p>
              <p className="mt-0.5 text-xs text-stone-500">OS by Creative</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5">
          <div className="grid gap-5">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">{group.label}</p>
                <div className="mt-2 grid gap-1">
                  {group.items.map((item) => (
                    <a
                      key={item.label}
                      href={workspaceLinks[item.view]}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                        item.view === activeView
                          ? "border border-stone-200 bg-white font-semibold text-stone-950 shadow-[0_1px_2px_rgba(28,36,38,0.04)]"
                          : "text-stone-500 hover:bg-white hover:text-stone-950"
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-stone-200 bg-white text-[10px] font-bold text-stone-600">
                        {item.glyph}
                      </span>
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div id="settings" className="grid gap-3 border-t border-stone-200 px-4 py-4">
          <div className="rounded-md border border-stone-200 bg-white p-3">
            <p className="text-xs font-semibold text-stone-800">AI-помощник</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">Помощь по клиентам и текущим задачам.</p>
          </div>
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-800 text-xs font-bold text-white">M</div>
            <div>
              <p className="text-xs font-semibold text-stone-700">Профиль менеджера</p>
              <p className="mt-0.5 text-[11px] text-stone-400">Операционная команда Creative</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 xl:px-9">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#172226] text-xs font-bold text-white lg:hidden">
                AP
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold text-stone-950">{viewTitles[activeView]}</h1>
                  <StatusBadge tone="teal">Adaptive Presence OS</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs font-medium text-stone-400">by Creative</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {activeView === "client_portal" ? (
                <StatusBadge tone="teal">Предпросмотр для клиента</StatusBadge>
              ) : (
                <>
                  <div className="hidden flex-wrap items-center gap-3 xl:flex">
                    <ConnectionBadge label={process.env.OPENAI_API_KEY ? "OpenAI подключен" : "Нужно настроить OpenAI"} active={Boolean(process.env.OPENAI_API_KEY)} />
                    <ConnectionBadge label="Neon подключен" />
                    <ConnectionBadge label={process.env.VERCEL ? "Онлайн" : "Локально"} />
                  </div>
                  <input
                    aria-label="Поиск по рабочему пространству"
                    className="w-64 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 outline-none placeholder:text-stone-400 focus:border-teal-500"
                    placeholder="Клиенты, материалы, события..."
                  />
                  <button type="button" aria-label="Уведомления" className="relative flex h-9 w-9 items-center justify-center rounded-md border border-stone-200 bg-white text-xs font-bold text-stone-600">
                    N
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] text-white">{approvalQueueCount}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="px-5 py-6 sm:px-7 xl:px-9">
          <div className="mx-auto max-w-[1680px]">
            {params.error ? (
              <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                {params.error}
              </div>
            ) : null}
            {params.notice ? (
              <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                {params.notice}
              </div>
            ) : null}

            <WorkspaceSwitcher activeView={activeView} links={workspaceLinks} />

            {activeView === "overview" ? (
              <>
            <section id="overview" className="scroll-mt-24">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Рабочее пространство</p>
                  <h2 className="mt-2 text-3xl font-semibold text-stone-950">Центр управления присутствием</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                    Превращайте бриф клиента в исполнимый Blueprint, месячный операционный план и готовые к проверке
                    материалы.
                  </p>
                </div>
              <p className="text-xs font-semibold text-stone-400">Текущий цикл: {currentMonth()}</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Требует проверки" value={needsManagerReviewCount} detail="Материалы во внутренней очереди" tone="amber" />
                <MetricCard label="У клиента" value={waitingForClientCount} detail="Согласование с клиентом" tone="teal" />
                <MetricCard label="Согласовано" value={approvedDraftCount} detail="Можно перейти к планированию" />
                <MetricCard label="Готово к планированию" value={readyToScheduleCount} detail="Публикации пока не подключены" tone="teal" />
              </div>
              {selectedMonthlyPlan && (missingTextCount > 0 || missingVisualCount > 0) ? (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-teal-950">
                      {missingTextCount > 0 ? "Есть материалы без текста" : "Тексты готовы, осталось подготовить визуалы"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-teal-800">
                      {missingTextCount > 0
                        ? `${missingTextCount} материалов ждут автоподготовки или ручной генерации текста.`
                        : `${missingVisualCount} публикаций ждут ТЗ или визуал.`}
                    </p>
                  </div>
                  <a href={workspaceLinks.drafts} className={primaryButtonClass}>Открыть материалы</a>
                </div>
              ) : null}
            </section>

            <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <OperationsOverview
                progress={productionProgress}
                attentionCount={approvalQueueCount}
                draftCount={draftCount}
                integrationTaskCount={integrationTaskCount}
                creativeAssetAttentionCount={creativeAssetAttentionCount}
              />
              <article className={`${panelClass} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Клиент в работе</p>
                  <StatusBadge tone={latestBlueprint ? "green" : "amber"}>{latestBlueprint ? "Активен" : "Нужна настройка"}</StatusBadge>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-stone-950">{latestBlueprint?.client.name ?? "Клиент не выбран"}</h2>
                <p className="mt-1 text-xs font-semibold text-stone-400">{latestBlueprint?.client.industry ?? "Выберите или создайте клиента, чтобы начать."}</p>
                <div className="mt-5 grid gap-2">
                  <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                    <p className="text-xs font-bold text-stone-700">Blueprint</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{latestBlueprint ? `${latestBlueprint.confidenceScore}% уверенности` : "Не сгенерирован"}</p>
                  </div>
                  <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                    <p className="text-xs font-bold text-stone-700">Месячный план</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{selectedMonthlyPlan ? `${plannedContentCount} материалов в календаре` : "Не сгенерирован"}</p>
                  </div>
                  <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                    <p className="text-xs font-bold text-stone-700">Следующий рекомендуемый шаг</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{latestBlueprint ? formatStatus(latestBlueprint.nextRecommendedAction) : "Создать бриф клиента"}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3">
                  <p className="text-xs font-bold text-teal-900">Подсказка AI</p>
                  <p className="mt-1 text-xs leading-5 text-teal-800">
                    {latestBlueprint ? "Сохраняйте фокус на качестве проверки и естественной подаче для каждой площадки." : "AI-слой активируется после генерации Blueprint."}
                  </p>
                </div>
                {selectedMonthlyPlan ? (
                  <a href={workspaceLinks.client_portal} className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950">
                    Посмотреть клиентский календарь
                  </a>
                ) : null}
              </article>
            </section>

            <section id="approvals" className="mt-7 grid scroll-mt-24 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <article className={`${panelClass} p-5 sm:p-6`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Сегодня / текущий фокус</p>
                    <h2 className="mt-1 text-xl font-semibold text-stone-950">Требует внимания сегодня</h2>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Рабочая очередь на основе Blueprint клиента и текущего месячного плана.
                    </p>
                  </div>
                  <StatusBadge tone={approvalQueueCount + integrationTaskCount > 0 ? "amber" : "green"}>
                    {approvalQueueCount + integrationTaskCount > 0 ? "Есть задачи" : "Всё спокойно"}
                  </StatusBadge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold text-amber-900">Требует проверки</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{needsManagerReviewCount}</p>
                  </div>
                  <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                    <p className="text-xs font-bold text-teal-900">У клиента</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{waitingForClientCount}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-bold text-stone-700">Согласовано</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{approvedDraftCount}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-bold text-emerald-900">Готово к планированию</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{readyToScheduleCount}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-400">Следующий шаг по Blueprint</p>
                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {latestBlueprint ? formatStatus(latestBlueprint.nextRecommendedAction) : "Создайте бриф клиента и сгенерируйте Blueprint."}
                  </p>
                </div>
              </article>

              <article className={`${panelClass} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Статус месячного плана</p>
                  {selectedMonthlyPlan ? <StatusBadge tone="green">{formatStatus(selectedMonthlyPlan.status)}</StatusBadge> : <StatusBadge tone="amber">Не сгенерирован</StatusBadge>}
                </div>
                {selectedMonthlyPlan ? (
                  <div className="mt-4">
                    <p className="text-2xl font-semibold text-stone-950">{selectedMonthlyPlan.month}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">{selectedMonthlyPlan.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge tone="teal">{selectedMonthlyPlan.totalPlannedUnits} материалов в плане</StatusBadge>
                      <StatusBadge>{selectedMonthlyPlan.plannedContentItems.length} материалов в календаре</StatusBadge>
                    </div>
                    <a href={workspaceLinks.client_setup} className="mt-4 inline-flex text-sm font-bold text-teal-700 transition hover:text-teal-900">
                      Открыть настройку клиента
                    </a>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm leading-6 text-stone-500">
                      Сгенерируйте месячный операционный план, чтобы активировать календарь и очередь материалов.
                    </p>
                    <a href={workspaceLinks.calendar} className="mt-4 inline-flex text-sm font-bold text-teal-700 transition hover:text-teal-900">
                      Открыть настройку календаря
                    </a>
                  </div>
                )}
              </article>
            </section>

            <OverviewPreviews
              drafts={contentDrafts}
              publications={selectedMonthlyPlan?.scheduledPublications ?? []}
              assets={creativeAssets}
              jobs={generationJobs}
              links={workspaceLinks}
            />
              </>
            ) : null}

            {activeView === "approvals" ? (
              <>
                <WorkspaceViewHeader
                  eyebrow="Проверка материалов"
                  title="Согласования"
                  description="Полная рабочая очередь для менеджера: внутренняя проверка, отправка клиенту, комментарии и подготовка к планированию."
                />
                <ReviewQueue groups={reviewQueueGroups} calendarHref={workspaceLinks.calendar} />
              </>
            ) : null}

            {activeView === "calendar" ? (
              <>
                <WorkspaceViewHeader
                  eyebrow="Контент-операции"
                  title="Календарь"
                  description="Планируйте согласованные публикации, управляйте датами и отслеживайте состояние материалов в одном рабочем экране."
                />
                <SchedulingLayer
                  drafts={contentDrafts}
                  publications={selectedMonthlyPlan?.scheduledPublications ?? []}
                  assetsHref={workspaceLinks.assets}
                  draftsHref={workspaceLinks.drafts}
                />
                <section className="mt-7">
                  <ContentCalendar
                    groups={calendarGroups}
                    publications={selectedMonthlyPlan?.scheduledPublications ?? []}
                    month={selectedMonthlyPlan?.month ?? currentMonth()}
                    blueprintId={latestBlueprint?.id}
                    generationBlocked={latestBlueprint?.nextRecommendedAction === "request_more_brief_data"}
                    draftsHref={workspaceLinks.drafts}
                    clientSetupHref={workspaceLinks.client_setup}
                  />
                </section>
              </>
            ) : null}

            {activeView === "assets" ? (
              <>
                <WorkspaceViewHeader
                  eyebrow="Creative production"
                  title="Креативы"
                  description="Рабочая зона AI-ТЗ, премиум-визуалов и ручной проверки качества. Основные действия генерации всегда остаются на виду."
                />
                <CreativeAssetLayer
                  publications={selectedMonthlyPlan?.scheduledPublications ?? []}
                  assets={creativeAssets}
                  jobs={generationJobs}
                />
              </>
            ) : null}

            {activeView === "drafts" ? (
              <DraftsView
                items={selectedMonthlyPlan?.plannedContentItems ?? []}
                publications={selectedMonthlyPlan?.scheduledPublications ?? []}
                jobs={generationJobs}
                monthlyPlanId={selectedMonthlyPlan?.id}
                blueprintId={latestBlueprint?.id}
                approvalsHref={workspaceLinks.approvals}
                calendarHref={workspaceLinks.calendar}
                assetsHref={workspaceLinks.assets}
                clientPortalHref={workspaceLinks.client_portal}
              />
            ) : null}

            {activeView === "client_portal" ? (
              <>
                <ClientPortalLinksPanel
                  blueprintId={latestBlueprint?.id}
                  monthlyPlanId={selectedMonthlyPlan?.id}
                  links={selectedMonthlyPlan?.clientPortalLinks ?? []}
                  newPortalLink={params.portalLink}
                />
                <ClientPortalView
                  clientName={latestBlueprint?.client.name}
                  month={selectedMonthlyPlan?.month}
                  items={selectedMonthlyPlan?.plannedContentItems ?? []}
                  publications={selectedMonthlyPlan?.scheduledPublications ?? []}
                  showPreviewNotice
                />
              </>
            ) : null}

            {activeView === "clients" ? (
              <section>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <WorkspaceViewHeader
                    eyebrow="Клиентская база"
                    title="Клиенты"
                    description="Выберите клиента для работы или откройте настройку, чтобы добавить новый бриф и собрать операционную конфигурацию."
                  />
                  <a href={workspaceLinks.client_setup} className={primaryButtonClass}>Создать клиента</a>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {clients.map((client) => {
                    const clientBlueprint = client.blueprints[0];
                    const clientBrief = client.briefs[0];

                    return (
                      <article key={client.id} className={`${panelClass} min-w-0 p-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-stone-950">{client.name}</h3>
                            <p className="mt-1 text-xs text-stone-500">{client.industry || "Сфера бизнеса не указана"}</p>
                          </div>
                          <StatusBadge tone={clientBlueprint ? "green" : clientBrief ? "amber" : "neutral"}>
                            {clientBlueprint ? "Blueprint готов" : clientBrief ? "Есть бриф" : "Нужен бриф"}
                          </StatusBadge>
                        </div>
                        <div className="mt-4 grid gap-2 text-xs leading-5 text-stone-500">
                          <p>Брифов: <span className="font-semibold text-stone-700">{client.briefs.length}</span></p>
                          <p>Blueprint: <span className="font-semibold text-stone-700">{clientBlueprint ? "сгенерирован" : "не сгенерирован"}</span></p>
                        </div>
                        <a
                          href={workspaceHref("client_setup", { ...workspaceContext, client: client.id, blueprint: clientBlueprint?.id })}
                          className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950"
                        >
                          Открыть настройку клиента
                        </a>
                      </article>
                    );
                  })}
                  {clients.length === 0 ? <EmptyState>Клиентов пока нет. Создайте первого клиента в отдельном экране настройки.</EmptyState> : null}
                </div>
              </section>
            ) : null}

            {activeView === "client_setup" ? (
            <section id="clients" className="scroll-mt-24">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Настройка клиента</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-950">Операционная конфигурация клиента</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                  Здесь находятся настройки подключения и подробные операционные данные. Ежедневная работа остаётся в командном центре и контент-календаре выше.
                </p>
              </div>
              <div className="mt-5 grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="grid min-w-0 gap-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Подключение и бриф</p>
                  <p className="mt-1 text-sm leading-6 text-stone-500">Дополнительные инструменты для добавления клиента и обновления брифа.</p>
                </div>
                <section className={`${panelClass} p-5`}>
                  <SectionTitle eyebrow="Новый клиент" title="Создать клиента" />
                  <form action={createClient} className="mt-5 grid gap-3">
                    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                      Название
                      <input name="name" required className={inputClass} placeholder="Клиника Север" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                      Сайт
                      <input name="website" className={inputClass} placeholder="https://example.com" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                      Сфера бизнеса
                      <input name="industry" className={inputClass} placeholder="Медицина" />
                    </label>
                    <PendingSubmitButton pendingLabel="Создаём..." className={primaryButtonClass}>
                      Создать клиента
                    </PendingSubmitButton>
                  </form>
                </section>

                <section className={`${panelClass} p-5`}>
                  <SectionTitle eyebrow="Исходные данные" title="Добавить бриф" />
                  {clients.length > 0 ? (
                    <form action={addClientBrief} className="mt-5 grid gap-3">
                      <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                        Клиент
                        <select name="clientId" required className={inputClass}>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                        Бриф клиента
                        <textarea
                          name="rawBrief"
                          required
                          rows={7}
                          className={`${inputClass} resize-y`}
                          placeholder="Цели, аудитория, текущие площадки, ограничения, риски бренда, ресурсы команды..."
                        />
                      </label>
                      <PendingSubmitButton pendingLabel="Сохраняем..." className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:bg-teal-400">
                        Сохранить бриф
                      </PendingSubmitButton>
                    </form>
                  ) : (
                    <div className="mt-5">
                      <EmptyState>Сначала создайте клиента, затем добавьте бриф.</EmptyState>
                    </div>
                  )}
                </section>

                <section className={`${panelClass} p-5`}>
                  <SectionTitle eyebrow="Очередь Blueprint" title="Сохранённые брифы" />
                  <div className="mt-5 grid gap-3">
                    {clients.flatMap((client) =>
                      client.briefs.map((brief) => (
                        <article key={brief.id} className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-stone-950">{client.name}</p>
                              <p className="mt-1 line-clamp-3 text-xs leading-5 text-stone-500">{brief.rawBrief}</p>
                            </div>
                            <StatusBadge tone={brief.blueprint ? "green" : "amber"}>
                              {brief.blueprint ? "Сгенерирован" : "Готов"}
                            </StatusBadge>
                          </div>
                          <details className="mt-3 border-t border-stone-200 pt-3">
                            <summary className="cursor-pointer text-xs font-bold text-stone-600">Редактировать бриф</summary>
                            <form action={updateClientBrief} className="mt-3 grid gap-3">
                              <input type="hidden" name="briefId" value={brief.id} />
                              <textarea name="rawBrief" required rows={6} defaultValue={brief.rawBrief} className={`${inputClass} resize-y text-xs`} />
                              {brief.blueprint ? (
                                <p className="text-xs leading-5 text-stone-500">
                                  После сохранения текущий Blueprint будет удалён, чтобы его можно было сгенерировать заново из обновлённого брифа.
                                </p>
                              ) : null}
                              <PendingSubmitButton pendingLabel="Сохраняем..." className={secondaryButtonClass}>
                                Сохранить изменения
                              </PendingSubmitButton>
                            </form>
                          </details>
                          <form action={generateBlueprint} className="mt-3">
                            <input type="hidden" name="briefId" value={brief.id} />
                            <PendingSubmitButton
                              pendingLabel={brief.blueprint ? "Открываем Blueprint..." : "Генерируем Blueprint..."}
                              className="w-full rounded-md bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:bg-amber-300"
                            >
                              {brief.blueprint ? "Открыть Blueprint" : "Сгенерировать Blueprint"}
                            </PendingSubmitButton>
                          </form>
                        </article>
                      )),
                    )}
                    {clients.every((client) => client.briefs.length === 0) ? (
                      <EmptyState>Сохранённых брифов пока нет.</EmptyState>
                    ) : null}
                  </div>
                </section>
              </aside>

              <div className="min-w-0 space-y-6">
                <section id="blueprints" className={`${panelClass} scroll-mt-24 p-5 sm:p-6`}>
                  <SectionTitle
                    eyebrow="Blueprint клиента"
                    title="Операционная система клиента"
                    description="Blueprint — стратегическая конфигурация клиента, которая превращает исходные данные в исполнимую систему."
                  />
                  {latestBlueprint ? (
                    <div className="mt-6 grid gap-6">
                      <div className="grid gap-5 border-b border-stone-200 pb-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone="green">Blueprint активен</StatusBadge>
                            <StatusBadge>{latestBlueprint.client.industry || "Сфера бизнеса не указана"}</StatusBadge>
                          </div>
                          <p className="mt-5 text-sm font-semibold text-teal-700">{latestBlueprint.client.name}</p>
                          <h3 className="mt-2 max-w-4xl text-2xl font-semibold leading-9 text-stone-950">
                            {latestBlueprint.clientSummary}
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <MetricCard label="Уверенность" value={`${latestBlueprint.confidenceScore}%`} tone="teal" />
                          <MetricCard label="Материалов в месяц" value={`${latestBlueprint.totalContentUnitsMin}-${latestBlueprint.totalContentUnitsMax}`} />
                          <MetricCard label="Согласование" value={latestBlueprint.approvalMode} />
                          <MetricCard label="Внимание менеджера" value={latestBlueprint.managerAttentionLevel} tone="amber" />
                        </div>
                      </div>

                      <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Следующий операционный слой</p>
                            <h4 className="mt-1 font-semibold text-stone-950">Месячный операционный план</h4>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
                              Плановый слой для модулей, площадок, ритма публикаций, согласований, интеграций и задач. Это ещё не генерация финального контента.
                            </p>
                          </div>
                          {currentMonthlyPlan ? (
                            <a href={`/?blueprint=${latestBlueprint.id}&plan=${currentMonthlyPlan.id}#monthly-plan`} className={secondaryButtonClass}>
                              Открыть текущий план
                            </a>
                          ) : (
                            <form action={generateMonthlyPlan}>
                              <input type="hidden" name="blueprintId" value={latestBlueprint.id} />
                              <PendingSubmitButton pendingLabel="Генерируем месячный план..." disabled={latestBlueprint.nextRecommendedAction === "request_more_brief_data"} className={primaryButtonClass}>
                                Сгенерировать месячный план
                              </PendingSubmitButton>
                            </form>
                          )}
                        </div>
                        {currentMonthlyPlan ? (
                          <p className="mt-3 text-xs font-semibold text-teal-800">
                            Месячный операционный план за {currentMonthlyPlan.month} уже существует. Текущий план показан ниже.
                          </p>
                        ) : null}
                        {latestBlueprint.nextRecommendedAction === "request_more_brief_data" ? (
                          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
                            Месячный план нельзя сгенерировать, пока не заполнены недостающие данные брифа.
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                          <h4 className="text-sm font-semibold text-stone-950">Бизнес-цели</h4>
                          <div className="mt-3">
                            <StringList items={latestBlueprint.businessGoals as string[]} emptyText="Бизнес-цели пока не указаны." />
                          </div>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Следующий шаг</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-stone-900">{formatStatus(latestBlueprint.nextRecommendedAction)}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-semibold text-stone-950">Недостающие данные брифа</h4>
                          <div className="mt-3">
                            <StringList items={latestBlueprint.missingBriefFields as string[]} emptyText="В брифе достаточно данных." tone="rose" />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-stone-950">Допущения</h4>
                          <div className="mt-3">
                            <StringList items={latestBlueprint.assumptions as string[]} emptyText="Допущений нет." tone="amber" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-stone-950">Рекомендации по площадкам</h4>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {latestBlueprint.platformRecommendations.map((platform) => (
                            <article key={platform.id} className="rounded-lg border border-stone-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h5 className="font-semibold text-stone-950">{platform.platformName}</h5>
                                  <p className="mt-1 text-xs font-medium text-stone-500">{platform.suggestedFrequency}</p>
                                </div>
                                <StatusBadge tone={platform.recommendation === "recommended" ? "green" : "rose"}>
                                  {platform.recommendation === "recommended" ? "Рекомендовано" : "Не рекомендовано"}
                                </StatusBadge>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <StatusBadge tone="teal">{platform.platformType}</StatusBadge>
                                <StatusBadge tone="amber">{formatStatus(platform.priority)}</StatusBadge>
                                <StatusBadge>{formatStatus(platform.automationStatus)}</StatusBadge>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-stone-600">{platform.rationale}</p>
                              <details className="mt-3 border-t border-stone-100 pt-3">
                                <summary className="cursor-pointer text-xs font-bold text-stone-500">Доступы и форматы</summary>
                                <div className="mt-2 grid gap-1 text-xs leading-5 text-stone-500">
                                  <p><span className="font-semibold text-stone-700">Учётные данные:</span> {Array.isArray(platform.requiredCredentials) ? platform.requiredCredentials.join(", ") || "Не нужны" : "Не нужны"}</p>
                                  <p><span className="font-semibold text-stone-700">Права доступа:</span> {Array.isArray(platform.permissionsNeeded) ? platform.permissionsNeeded.join(", ") || "Не нужны" : "Не нужны"}</p>
                                  <p><span className="font-semibold text-stone-700">Форматы:</span> {Array.isArray(platform.contentFormats) ? platform.contentFormats.join(", ") || "Не указаны" : "Не указаны"}</p>
                                </div>
                              </details>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-stone-950">Выбранные модули</h4>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {latestBlueprint.selectedModules.map((module) => (
                            <article key={module.id} className="rounded-lg border border-stone-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h5 className="font-semibold text-stone-950">{module.name}</h5>
                                  <p className="mt-1 text-xs font-bold text-teal-700">{module.moduleType}</p>
                                </div>
                                <StatusBadge tone="amber">{formatStatus(module.priority)}</StatusBadge>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-stone-600">{module.purpose}</p>
                              <div className="mt-3">
                                <JsonDetails title="Объём модуля" value={module.monthlyContentScope} />
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-semibold text-stone-950">План автоматизации</h4>
                          <div className="mt-3 grid gap-3">
                            {latestBlueprint.automationPlans.map((automation) => (
                              <article key={automation.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
                                <h5 className="font-semibold text-stone-950">{automation.name}</h5>
                                <p className="mt-2 leading-6 text-stone-500">{automation.trigger}</p>
                                <p className="mt-2 leading-6 text-stone-700">{automation.action}</p>
                                <p className="mt-2 text-xs leading-5 text-stone-400">{automation.humanCheckpoint}</p>
                              </article>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-stone-950">Правила управления рисками</h4>
                          <div className="mt-3 grid gap-3">
                            {latestBlueprint.riskRules.map((rule) => (
                              <article key={rule.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <h5 className="font-semibold text-stone-950">{rule.ruleName}</h5>
                                  <StatusBadge tone="rose">{formatStatus(rule.severity)}</StatusBadge>
                                </div>
                                <p className="mt-2 leading-6 text-stone-500">{rule.riskDescription}</p>
                                <p className="mt-2 leading-6 text-stone-700">{rule.preventionAction}</p>
                              </article>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <JsonDetails title="Рекомендуемый объём контента на месяц" value={latestBlueprint.recommendedMonthlyContentScope} />
                        <JsonDetails title="Частота публикаций" value={latestBlueprint.publishingFrequency} />
                        <JsonDetails title="Требования к интеграциям" value={latestBlueprint.integrationRequirements} />
                        <JsonDetails title="Политика проверки человеком" value={latestBlueprint.humanReviewPolicy} />
                        <JsonDetails title="Нерекомендованные площадки" value={latestBlueprint.notRecommendedPlatforms} />
                        <JsonDetails title="Исходный структурированный Blueprint" value={latestBlueprint.rawBlueprintJson} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <EmptyState>Сгенерируйте Blueprint из сохранённого брифа, чтобы открыть рабочее пространство.</EmptyState>
                    </div>
                  )}
                </section>

                {selectedMonthlyPlan ? (
                  <section id="monthly-plan" className={`${panelClass} scroll-mt-24 p-5 sm:p-6`}>
                    <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Месячный операционный план</p>
                        <h2 className="mt-1 text-2xl font-semibold text-stone-950">{selectedMonthlyPlan.month}</h2>
                        <p className="mt-3 max-w-4xl text-sm leading-6 text-stone-500">{selectedMonthlyPlan.summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone="green">{formatStatus(selectedMonthlyPlan.status)}</StatusBadge>
                        <StatusBadge tone="teal">{selectedMonthlyPlan.totalPlannedUnits} материалов в плане</StatusBadge>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                        <p className="text-xs font-bold text-stone-700">Стратегия согласования</p>
                        <p className="mt-2 text-sm leading-6 text-stone-500">{selectedMonthlyPlan.approvalStrategy}</p>
                      </div>
                      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                        <p className="text-xs font-bold text-stone-700">Стратегия автопубликации</p>
                        <p className="mt-2 text-sm leading-6 text-stone-500">{selectedMonthlyPlan.autopublishStrategy}</p>
                      </div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                        <p className="text-xs font-bold text-rose-800">Сводка рисков</p>
                        <p className="mt-2 text-sm leading-6 text-rose-700">{selectedMonthlyPlan.riskSummary}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-semibold text-stone-950">Активные модули</h3>
                        <div className="mt-3 grid gap-3">
                          {selectedMonthlyPlan.modules.map((module) => (
                            <article key={module.id} className="rounded-lg border border-stone-200 p-4 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-stone-950">{module.name}</p>
                                  <p className="mt-1 text-xs font-bold text-teal-700">{module.moduleType}</p>
                                </div>
                                <StatusBadge tone="amber">{module.plannedUnitsMin}-{module.plannedUnitsMax} материалов</StatusBadge>
                              </div>
                              <p className="mt-2 leading-6 text-stone-500">{module.rationale}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-stone-950">Выбранные площадки</h3>
                        <div className="mt-3 grid gap-3">
                          {selectedMonthlyPlan.platforms.map((platform) => (
                            <article key={platform.id} className="rounded-lg border border-stone-200 p-4 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-stone-950">{platform.platformName}</p>
                                  <p className="mt-1 text-xs font-bold text-teal-700">{platform.platformType} &middot; {formatStatus(platform.automationStatus)}</p>
                                </div>
                                {platform.requiresIntegrationBeforeLaunch ? <StatusBadge tone="rose">Нужна интеграция</StatusBadge> : <StatusBadge tone="green">Готово</StatusBadge>}
                              </div>
                              <p className="mt-2 leading-6 text-stone-500">{platform.plannedCadence}</p>
                              <p className="mt-2 text-xs text-stone-400">{Array.isArray(platform.contentFormats) ? platform.contentFormats.join(", ") : ""}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-7">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-stone-950">Обзор кампании по неделям</h3>
                          <p className="mt-1 text-sm leading-6 text-stone-500">
                            Стратегическая последовательность календаря: темы, роли площадок и задача каждого материала.
                          </p>
                        </div>
                        <StatusBadge tone="teal">{calendarGroups.length} групп в календаре</StatusBadge>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {calendarGroups.map((group) => (
                          <article key={group.label} className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-stone-950">{group.label}</p>
                                <p className="mt-1 text-xs leading-5 text-stone-500">
                                  {Array.from(new Set(group.items.map((item) => item.campaignTheme).filter(Boolean))).join(", ") || "Сквозная тема для нескольких площадок"}
                                </p>
                              </div>
                              <StatusBadge>{group.items.length} материалов</StatusBadge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5 border-y border-stone-200 py-2">
                              {Array.from(new Set(group.items.map((item) => item.platformName))).map((platform) => (
                                <StatusBadge key={platform} tone="teal">{platform}</StatusBadge>
                              ))}
                            </div>
                            <div className="mt-3 grid gap-3">
                              {group.items.map((item) => (
                                <div key={item.id} className="rounded-md border border-stone-200 bg-white p-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    <StatusBadge tone="teal">{item.platformName}</StatusBadge>
                                    <StatusBadge>{item.format}</StatusBadge>
                                    {item.campaignTheme ? <StatusBadge tone="amber">{item.campaignTheme}</StatusBadge> : null}
                                  </div>
                                  <p className="mt-2 text-sm font-semibold leading-5 text-stone-900">{item.topic}</p>
                                  <div className="mt-2 grid gap-1 text-xs leading-5 text-stone-500">
                                    {item.channelRole ? <p><span className="font-bold text-stone-700">Роль:</span> {item.channelRole}</p> : null}
                                    {item.sequenceReason ? <p className="line-clamp-2"><span className="font-bold text-stone-700">Последовательность:</span> {item.sequenceReason}</p> : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className="mt-7">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-stone-950">Запланированные материалы</h3>
                          <p className="mt-1 text-sm leading-6 text-stone-500">Материалы для разных площадок готовы к последовательной генерации текстов публикаций.</p>
                        </div>
                        <StatusBadge>{selectedMonthlyPlan.plannedContentItems.length} материалов</StatusBadge>
                      </div>
                      <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200">
                        <table className="min-w-[1180px] border-collapse text-left text-sm">
                          <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.1em] text-stone-500">
                            <tr>
                              <th className="px-3 py-3">Ритм</th>
                              <th className="px-3 py-3">Площадка</th>
                              <th className="px-3 py-3">Формат</th>
                              <th className="px-3 py-3">Тема и материал</th>
                              <th className="px-3 py-3">Роль площадки</th>
                              <th className="px-3 py-3">Цель</th>
                              <th className="px-3 py-3">Проверка</th>
                              <th className="px-3 py-3">Текст публикации</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200 bg-white">
                            {selectedMonthlyPlan.plannedContentItems.map((item) => (
                              <tr key={item.id} className="align-top transition hover:bg-stone-50/70">
                                <td className="px-3 py-3 text-stone-700">
                                  <p className="font-semibold">{item.plannedDate}</p>
                                  {item.week ? <p className="mt-1 text-xs text-stone-400">{item.week}</p> : null}
                                </td>
                                <td className="px-3 py-3">
                                  <p className="font-semibold text-stone-900">{item.platformName}</p>
                                  <p className="mt-1 text-xs text-stone-400">{item.moduleType}</p>
                                </td>
                                <td className="px-3 py-3 text-stone-600">{item.format}</td>
                                <td className="max-w-72 px-3 py-3">
                                  {item.campaignTheme ? <p className="text-xs font-bold text-teal-700">{item.campaignTheme}</p> : null}
                                  <p className="mt-1 font-semibold text-stone-900">{item.topic}</p>
                                  {item.sequenceReason ? <p className="mt-1 text-xs leading-5 text-stone-400">{item.sequenceReason}</p> : null}
                                </td>
                                <td className="max-w-52 px-3 py-3 text-stone-600">{item.channelRole || "-"}</td>
                                <td className="max-w-52 px-3 py-3 text-stone-500">{item.goal}</td>
                                <td className="px-3 py-3">
                                  <div className="grid gap-1">
                                    <StatusBadge tone={item.approvalRequired ? "amber" : "green"}>{item.approvalRequired ? "Нужно согласование" : "Без согласования"}</StatusBadge>
                                    <StatusBadge tone={item.autopublishEligible ? "green" : "neutral"}>{item.autopublishEligible ? "Автопубликация" : "Вручную"}</StatusBadge>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  {item.contentDraft ? (
                                    <div className="grid gap-2">
                                      <StatusBadge tone={materialTextStatusTone(item.contentDraft)}>{formatMaterialTextStatus(item.contentDraft)}</StatusBadge>
                                      <a href={workspaceLinks.drafts} className="inline-flex rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-100">
                                        Открыть материал
                                      </a>
                                      <form action={regenerateContentDraftForItem}>
                                        <input type="hidden" name="plannedContentItemId" value={item.id} />
                                        <PendingSubmitButton pendingLabel="Обновляем текст..." className="whitespace-nowrap text-xs font-bold text-stone-600 transition hover:text-stone-950">
                                          Перегенерировать текст
                                        </PendingSubmitButton>
                                      </form>
                                    </div>
                                  ) : (
                                    <form action={generateContentDraftForItem}>
                                      <input type="hidden" name="plannedContentItemId" value={item.id} />
                                      <PendingSubmitButton pendingLabel="Генерируем текст..." className="whitespace-nowrap rounded-md bg-stone-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:bg-stone-400">
                                        Сгенерировать текст
                                      </PendingSubmitButton>
                                    </form>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-7">
                      <h3 className="text-sm font-semibold text-stone-950">Задачи менеджера</h3>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {selectedMonthlyPlan.managerTasks.map((task) => (
                          <article key={task.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-stone-950">{task.title}</p>
                                <p className="mt-1 leading-6 text-stone-500">{task.description}</p>
                              </div>
                              <StatusBadge tone={task.priority === "high" ? "rose" : "neutral"}>{formatStatus(task.priority)}</StatusBadge>
                            </div>
                            <p className="mt-3 text-xs font-semibold text-stone-400">Срок: {task.dueDate} &middot; {formatStatus(task.status)}</p>
                          </article>
                        ))}
                        {selectedMonthlyPlan.managerTasks.length === 0 ? <EmptyState>В этом месячном плане нет задач для менеджера.</EmptyState> : null}
                      </div>
                    </div>

                    <div className="mt-6">
                      <JsonDetails title="Исходный структурированный месячный план" value={selectedMonthlyPlan.rawPlanJson} />
                    </div>
                  </section>
                ) : null}

              </div>
              </div>
            </section>
            ) : null}

            {activeView === "reports" ? (
              <section>
                <WorkspaceViewHeader
                  eyebrow="Аналитика"
                  title="Отчёты"
                  description="Отчёты будут собраны из календаря, согласований и публикаций. Сейчас раздел показывает направление следующего операционного слоя."
                />
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <PreviewCard title="Операционный отчёт" glyph="О" copy="Здесь появится сводка по плану, готовности материалов, согласованиям и выполненным публикациям." />
                  <PreviewCard title="Лента событий" glyph="С" copy="Здесь появятся новые отзывы, комментарии, согласования клиента, результаты публикаций и предложенные AI действия." />
                </div>
              </section>
            ) : null}

            {activeView === "settings" ? (
              <section>
                <WorkspaceViewHeader
                  eyebrow="Система"
                  title="Настройки"
                  description="Техническая информация рабочего окружения без секретов и токенов доступа."
                />
                <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">OpenAI</p>
                    <h3 className="mt-2 font-semibold text-stone-950">{process.env.OPENAI_API_KEY ? "Подключен" : "Нужно настроить"}</h3>
                    <dl className="mt-3 space-y-2 text-sm leading-5">
                      {[
                        ["Стратегия", textModelSettings.strategyModel],
                        ["Месячный план", textModelSettings.monthlyPlanModel],
                        ["Тексты публикаций", textModelSettings.contentModel],
                        ["ТЗ на креатив", textModelSettings.creativeBriefModel],
                        ["Быстрые задачи", textModelSettings.fastModel],
                      ].map(([label, model]) => (
                        <div className="flex items-start justify-between gap-3" key={label}>
                          <dt className="text-stone-500">{label}</dt>
                          <dd className="text-right font-semibold text-stone-800">{model}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-4 border-t border-stone-200 pt-3 text-xs leading-5 text-stone-500">
                      Модели можно переопределить через переменные окружения Vercel.
                    </p>
                    {textModelSettings.legacyModelUsed ? (
                      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                        Сейчас используется совместимый fallback OPENAI_MODEL. Добавьте новые TEXT_MODEL_* переменные в Vercel для раздельной настройки задач.
                      </p>
                    ) : null}
                  </article>
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">База данных</p>
                    <h3 className="mt-2 font-semibold text-stone-950">Neon подключен</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">PostgreSQL используется для операционных данных и сохранённых материалов.</p>
                  </article>
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Visual Engine</p>
                    <h3 className="mt-2 font-semibold text-stone-950">{process.env.VISUAL_PROVIDER || "openai"}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      {process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"} &middot; {process.env.OPENAI_IMAGE_QUALITY || "high"} &middot; {process.env.VISUAL_TEXT_MODE || "image_text"}
                    </p>
                  </article>
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Production Autopilot</p>
                    <h3 className="mt-2 font-semibold text-stone-950">До {autopilotTextBatchLimit} текстов за запуск</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Лимит автоподготовки месяца задаётся переменной AUTOPILOT_TEXT_BATCH_LIMIT. Если переменная не указана, используется значение 5.
                    </p>
                  </article>
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Public app URL</p>
                    <h3 className="mt-2 break-all font-semibold text-stone-950">{publicAppUrl || "Не задан"}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      {publicAppUrl
                        ? "Клиентские ссылки используют стабильный публичный адрес приложения."
                        : "Не задан. Клиентские ссылки могут использовать текущий Vercel host."}
                    </p>
                  </article>
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Generation Jobs</p>
                    <h3 className="mt-2 font-semibold text-stone-950">MVP-режим</h3>
                    <p className="mt-2 text-sm font-semibold text-amber-800">Фоновая очередь: не подключена</p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Долгие генерации сохраняют статус задачи, но полноценный background worker будет добавлен позже.
                    </p>
                  </article>
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
