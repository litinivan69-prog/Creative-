import {
  addClientBrief,
  approveDraft,
  createCreativeAssetBrief,
  createClient,
  generateBlueprint,
  generateContentDraftForItem,
  generateMonthlyPlan,
  markDraftReadyToSchedule,
  markScheduledPublicationNeedsAssets,
  markScheduledPublicationReady,
  markScheduledPublicationScheduled,
  markScheduledPublicationSkipped,
  rejectDraft,
  requestDraftChanges,
  scheduleContentDraft,
  sendDraftToClient,
  submitDraftForReview,
  unschedulePublication,
  updateClientBrief,
  updateCreativeAssetBrief,
  updateCreativeAssetStatus,
  updateScheduledPublication,
} from "@/app/actions";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  blueprint?: string;
  plan?: string;
  error?: string;
  notice?: string;
}>;

const navigationGroups = [
  {
    label: "Работа",
    items: [
      { label: "Обзор", href: "#overview", glyph: "О" },
      { label: "Клиенты", href: "#clients", glyph: "К" },
      { label: "Календарь", href: "#calendar", glyph: "К" },
    ],
  },
  {
    label: "Проверка",
    items: [
      { label: "Согласования", href: "#approvals", glyph: "С" },
      { label: "Черновики", href: "#drafts", glyph: "Ч" },
      { label: "События", href: "#events", glyph: "С" },
    ],
  },
  {
    label: "Система",
    items: [
      { label: "Отчёты", href: "#reports", glyph: "О" },
      { label: "Настройки", href: "#settings", glyph: "Н" },
    ],
  },
];

const panelClass = "rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,36,38,0.04)]";
const inputClass =
  "rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const primaryButtonClass =
  "rounded-md bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600";
const secondaryButtonClass =
  "rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-wait disabled:text-stone-400";

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
    draft: "Черновик",
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
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function formatDraftStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Черновик",
    needs_review: "Требует проверки",
    sent_to_client: "У клиента",
    client_changes_requested: "Запрошены правки",
    approved: "Согласовано",
    rejected: "Отклонено",
    ready_to_schedule: "Готово к планированию",
  };

  return labels[status] ?? formatStatus(status);
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
    created: "Черновик создан",
    submitted_for_review: "Отправлен на проверку",
    sent_to_client: "Отправлен клиенту",
    changes_requested: "Запрошены правки",
    approved: "Согласован",
    rejected: "Отклонён",
    marked_ready_to_schedule: "Готов к планированию",
    comment_added: "Добавлен комментарий",
  };

  return labels[action] ?? formatStatus(action);
}

function draftStatusTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  const tones: Record<string, "neutral" | "teal" | "amber" | "rose" | "green"> = {
    draft: "neutral",
    needs_review: "amber",
    sent_to_client: "teal",
    client_changes_requested: "rose",
    approved: "green",
    rejected: "rose",
    ready_to_schedule: "green",
  };

  return tones[status] ?? "neutral";
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
    status: string;
  }>;
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
};

const draftStatusGroups = [
  { status: "needs_review", label: "Требует проверки менеджера" },
  { status: "sent_to_client", label: "Ждём клиента" },
  { status: "client_changes_requested", label: "Запрошены правки" },
  { status: "approved", label: "Согласовано" },
  { status: "ready_to_schedule", label: "Готово к планированию" },
  { status: "rejected", label: "Отклонено" },
  { status: "draft", label: "Черновики" },
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
  tone = "secondary",
}: {
  action: (formData: FormData) => void | Promise<void>;
  contentDraftId: string;
  actorType?: "manager" | "client";
  label: string;
  pendingLabel: string;
  commentPlaceholder?: string;
  tone?: "primary" | "secondary" | "danger";
}) {
  const tones = {
    primary: "bg-stone-950 text-white hover:bg-stone-800 disabled:bg-stone-400",
    secondary: "border border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50 disabled:text-stone-400",
    danger: "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 disabled:text-rose-400",
  };

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="contentDraftId" value={contentDraftId} />
      <input type="hidden" name="actorType" value={actorType} />
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

function DraftWorkflowControls({ draft }: { draft: DraftQueueItem }) {
  if (draft.status === "ready_to_schedule") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="green">Готово к планированию</StatusBadge>
        <a href="#scheduling" className="text-xs font-bold text-teal-700 transition hover:text-teal-900">
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
            tone="primary"
          />
        ) : null}
        {draft.status === "draft" || draft.status === "needs_review" || draft.status === "client_changes_requested" ? (
          <DraftWorkflowForm
            action={sendDraftToClient}
            contentDraftId={draft.id}
            label="Отправить клиенту"
            pendingLabel="Отправляем..."
          />
        ) : null}
        {draft.status === "draft" || draft.status === "needs_review" ? (
          <DraftWorkflowForm
            action={approveDraft}
            contentDraftId={draft.id}
            label="Согласовать внутри"
            pendingLabel="Согласовываем..."
          />
        ) : null}
        {draft.status === "sent_to_client" ? (
          <DraftWorkflowForm
            action={approveDraft}
            contentDraftId={draft.id}
            actorType="client"
            label="Клиент согласовал"
            pendingLabel="Согласовываем..."
            tone="primary"
          />
        ) : null}
        {draft.status === "approved" ? (
          <DraftWorkflowForm
            action={markDraftReadyToSchedule}
            contentDraftId={draft.id}
            label="Готово к планированию"
            pendingLabel="Обновляем..."
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

function ReviewQueue({ groups }: { groups: ReturnType<typeof groupDraftsByStatus> }) {
  const draftCount = groups.reduce((total, group) => total + group.drafts.length, 0);

  return (
    <section id="review-queue" className={`${panelClass} mt-7 scroll-mt-24 p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Процесс согласования</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Очередь согласований</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Здесь черновики проходят проверку менеджера, согласование с клиентом и подготовку к планированию.
          </p>
        </div>
        <StatusBadge tone={draftCount > 0 ? "teal" : "neutral"}>{draftCount} черновиков</StatusBadge>
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
                    <article key={draft.id} className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-teal-700">{draft.platformName} &middot; {draft.format}</p>
                          <h4 className="mt-2 font-semibold leading-6 text-stone-950">{draft.draftTitle}</h4>
                          <p className="mt-1 text-xs leading-5 text-stone-400">{draft.topic}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge tone={draftStatusTone(draft.status)}>{formatDraftStatus(draft.status)}</StatusBadge>
                          <StatusBadge tone={draft.riskLevel === "high" ? "rose" : draft.riskLevel === "medium" ? "amber" : "green"}>Риск: {formatStatus(draft.riskLevel)}</StatusBadge>
                          {draft.approvalRequired ? <StatusBadge tone="amber">Нужно согласование</StatusBadge> : null}
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">{draft.draftBody}</p>
                      {latestEvent ? (
                        <p className="mt-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-500">
                          Последнее событие: <span className="font-bold text-stone-700">{formatReviewAction(latestEvent.action)}</span>. Участник: {formatReviewActor(latestEvent.actorType)}
                          {latestEvent.comment ? ` - ${latestEvent.comment}` : ""}
                        </p>
                      ) : null}
                      <div className="mt-3">
                        <ReviewEventTimeline events={draft.reviewEvents} />
                      </div>
                      <div className="mt-3 border-t border-stone-200 pt-3">
                        <DraftWorkflowControls draft={draft} />
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
          <EmptyState>Сгенерируйте черновики из запланированных материалов, чтобы запустить процесс согласования.</EmptyState>
        </div>
      )}
    </section>
  );
}

function scheduledPublicationTone(status: string): "neutral" | "teal" | "amber" | "rose" | "green" {
  const tones: Record<string, "neutral" | "teal" | "amber" | "rose" | "green"> = {
    scheduled: "teal",
    needs_assets: "amber",
    ready: "green",
    published: "green",
    skipped: "neutral",
    failed: "rose",
  };

  return tones[status] ?? "neutral";
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
}: {
  drafts: DraftQueueItem[];
  publications: ScheduledPublicationPreview[];
}) {
  const scheduledDraftIds = new Set(publications.map((publication) => publication.contentDraftId));
  const availableDrafts = drafts.filter(
    (draft) =>
      (draft.status === "approved" || draft.status === "ready_to_schedule") &&
      !scheduledDraftIds.has(draft.id),
  );

  return (
    <section id="scheduling" className={`${panelClass} mt-7 scroll-mt-24 p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Внутреннее планирование</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Планирование публикаций</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Согласованные черновики можно поставить в ручной план публикаций. Внешние площадки и автоматическая отправка пока не подключены.
          </p>
        </div>
        <StatusBadge tone={publications.length > 0 ? "teal" : "neutral"}>{publications.length} запланировано</StatusBadge>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
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
              <EmptyState>Согласуйте черновики и отметьте их готовыми к планированию. После этого здесь появится форма публикации.</EmptyState>
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
                {publication.timezone ? <p className="mt-1 text-xs text-stone-400">{publication.timezone}</p> : null}
                {publication.notes ? <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-600">{publication.notes}</p> : null}

                <details className="mt-3 rounded-md border border-stone-200 bg-stone-50/70">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">Изменить дату, время или заметку</summary>
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
                </details>

                <div className="mt-3 flex flex-wrap gap-2">
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
                  {publication.status !== "ready" ? (
                    <ScheduledPublicationAction action={markScheduledPublicationReady} publicationId={publication.id} tone="green">
                      Готово
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
              </article>
            ))}
            {publications.length === 0 ? (
              <EmptyState>Запланированных публикаций пока нет. Выберите согласованный черновик слева и укажите дату.</EmptyState>
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
  const tones: Record<string, "neutral" | "teal" | "amber" | "rose" | "green"> = {
    needed: "amber",
    brief_ready: "teal",
    in_production: "teal",
    needs_review: "amber",
    approved: "green",
    rejected: "rose",
  };

  return tones[status] ?? "neutral";
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

function CreativeAssetLayer({
  publications,
  assets,
}: {
  publications: ScheduledPublicationPreview[];
  assets: CreativeAssetPreview[];
}) {
  const publicationsNeedingBrief = publications.filter(
    (publication) =>
      (publication.status === "needs_assets" || suggestsVisualAsset(publication.format)) &&
      publication.creativeAssets.length === 0,
  );

  return (
    <section id="assets" className={`${panelClass} mt-7 scroll-mt-24 p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-stone-950">Нужно подготовить ТЗ</h3>
          <div className="mt-3 grid gap-3">
            {publicationsNeedingBrief.map((publication) => (
              <article key={publication.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-teal-700">{publication.platformName} &middot; {publication.format}</p>
                    <h4 className="mt-2 font-semibold leading-6 text-stone-950">{publication.topic}</h4>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Черновик: {publication.contentDraft.draftTitle}</p>
                  </div>
                  <StatusBadge tone="amber">
                    {publication.scheduledDate}{publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}
                  </StatusBadge>
                </div>
                <form action={createCreativeAssetBrief} className="mt-4 grid gap-2 sm:grid-cols-2">
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
                    <PendingSubmitButton pendingLabel="Создаём ТЗ..." className={primaryButtonClass}>
                      Создать ТЗ на визуал
                    </PendingSubmitButton>
                  </div>
                </form>
              </article>
            ))}
            {publicationsNeedingBrief.length === 0 ? (
              <EmptyState>Публикаций без ТЗ на визуал сейчас нет. Новые задачи появятся здесь после планирования материалов.</EmptyState>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-stone-950">Материалы в производстве</h3>
          <div className="mt-3 grid gap-3">
            {assets.map((asset) => (
              <article key={asset.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge tone="teal">{formatStatus(asset.assetType)}</StatusBadge>
                      <StatusBadge>{asset.scheduledPublication.platformName} &middot; {asset.scheduledPublication.format}</StatusBadge>
                    </div>
                    <h4 className="mt-3 font-semibold leading-6 text-stone-950">{asset.title}</h4>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{asset.scheduledPublication.topic}</p>
                  </div>
                  <StatusBadge tone={creativeAssetTone(asset.status)}>{formatStatus(asset.status)}</StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700">{asset.brief}</p>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-stone-600">
                  {asset.formatRequirements ? <p><span className="font-bold text-stone-800">Формат:</span> {asset.formatRequirements}</p> : null}
                  {asset.textOnAsset ? <p><span className="font-bold text-stone-800">Текст:</span> {asset.textOnAsset}</p> : null}
                  {asset.references ? <p><span className="font-bold text-stone-800">Референсы:</span> {asset.references}</p> : null}
                  {asset.notes ? <p><span className="font-bold text-stone-800">Заметка:</span> {asset.notes}</p> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {asset.approvalRequired ? <StatusBadge tone="amber">Нужно согласование</StatusBadge> : <StatusBadge>Согласование необязательно</StatusBadge>}
                  <StatusBadge>{asset.scheduledPublication.scheduledDate}{asset.scheduledPublication.scheduledTime ? `, ${asset.scheduledPublication.scheduledTime}` : ""}</StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {creativeAssetStatusOptions.map((status) =>
                    status === asset.status ? null : (
                      <CreativeAssetStatusAction key={status} assetId={asset.id} status={status} />
                    ),
                  )}
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
            Рабочий индикатор прогресса: готовность черновиков, нагрузка на согласование и состояние интеграций.
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
          <p className="mt-1 text-xs leading-5 text-stone-400">Черновики подготовлены относительно материалов в календаре.</p>
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
        <MetricCard label="Готовые черновики" value={draftCount} detail="Можно проверять" tone="teal" />
        <MetricCard label="Требует внимания" value={attentionCount} detail="Нагрузка на согласование" tone="amber" />
        <MetricCard label="Задачи по интеграциям" value={integrationTaskCount} detail="До запуска" tone={integrationTaskCount > 0 ? "rose" : "stone"} />
        <MetricCard label="Нужны визуалы" value={creativeAssetAttentionCount} detail="ТЗ и материалы в работе" tone={creativeAssetAttentionCount > 0 ? "amber" : "stone"} />
      </div>
    </article>
  );
}

function ClientPortalPreview({
  clientName,
  approvalCount,
  weeklyCount,
  selectedItem,
}: {
  clientName: string;
  approvalCount: number;
  weeklyCount: number;
  selectedItem?: CalendarPreviewItem;
}) {
  const timeline = ["Планирование", "Подготовка контента", "Согласования", "Публикации", "Отчётность"];

  return (
    <section className={`${panelClass} overflow-hidden`}>
      <div className="border-b border-stone-200 bg-[#f8fbfa] px-5 py-5 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Вид клиента</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-950">Здравствуйте, {clientName}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          Будущий кабинет клиента: простой экран для согласований и контроля прогресса на базе той же операционной системы.
        </p>
      </div>
      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h3 className="text-sm font-semibold text-stone-950">Что требует вашего внимания</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Ждут согласования" value={approvalCount} tone="amber" />
            <MetricCard label="В плане на неделю" value={weeklyCount} tone="teal" />
            <MetricCard label="Опубликовано за месяц" value="-" detail="Появится позже" />
            <MetricCard label="Новые отзывы" value="-" detail="События появятся позже" />
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-stone-950">Этапы месяца</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {timeline.map((stage, index) => (
                <div key={stage} className={`rounded-md border px-3 py-3 ${index < 3 ? "border-teal-200 bg-teal-50" : "border-stone-200 bg-stone-50"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">0{index + 1}</p>
                  <p className="mt-2 text-xs font-semibold text-stone-700">{stage}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(28,36,38,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-stone-700">Карточка согласования</p>
            <StatusBadge tone="amber">Предпросмотр</StatusBadge>
          </div>
          {selectedItem ? (
            <>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <StatusBadge tone="teal">{selectedItem.platformName}</StatusBadge>
                <StatusBadge>{selectedItem.format}</StatusBadge>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-stone-900">{selectedItem.topic}</p>
              <div className="mt-3 flex h-24 items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">
                Превью визуала
              </div>
              <p className="mt-3 line-clamp-4 text-xs leading-5 text-stone-500">
                {selectedItem.contentDraft?.draftBody || "Здесь появится текст черновика для простого и понятного согласования с клиентом."}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-stone-500">Здесь появится следующий материал, готовый к согласованию.</p>
          )}
          <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
            <p className="text-xs font-bold text-stone-700">Комментарии</p>
            <p className="mt-1 text-xs leading-5 text-stone-400">Здесь появится обсуждение клиента и менеджера.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400">Запросить правки</button>
            <button type="button" disabled className="rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white opacity-60">Согласовать</button>
          </div>
        </article>
      </div>
    </section>
  );
}

function ContentItemAction({ item }: { item: CalendarPreviewItem }) {
  return item.contentDraft ? (
    <a
      href={`#draft-${item.contentDraft.id}`}
      className="inline-flex rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 transition hover:bg-teal-100"
    >
      Проверить черновик
    </a>
  ) : (
    <form action={generateContentDraftForItem}>
      <input type="hidden" name="plannedContentItemId" value={item.id} />
      <PendingSubmitButton
        pendingLabel="Генерируем..."
        className="rounded-md bg-stone-950 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:bg-stone-400"
      >
        Сгенерировать черновик
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
            <p className="mt-2 text-xs leading-5 text-stone-500">Черновик: {publication.contentDraft.draftTitle}</p>
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
                </>
              ) : publication.status === "needs_assets" ? (
                <StatusBadge tone="amber">Нужно ТЗ на визуал</StatusBadge>
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
}: {
  groups: ReturnType<typeof groupCalendarItems>;
  publications: ScheduledPublicationPreview[];
  month: string;
  blueprintId?: string;
  generationBlocked: boolean;
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
              Центр управления планом, черновиками, согласованиями и будущими публикациями.
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
                          {item.contentDraft ? <StatusBadge tone="green">Черновик готов</StatusBadge> : null}
                        </div>
                        <div className="mt-3 border-t border-stone-100 pt-3">
                          <ContentItemAction item={item} />
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
                  <p className="text-xs font-bold text-stone-700">Превью черновика</p>
                  <p className="mt-2 line-clamp-5 text-xs leading-5 text-stone-500">
                    {inspectorItem.contentDraft?.draftBody || "Сгенерируйте черновик, чтобы подготовить текст материала к проверке менеджером."}
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
                  <p className="mt-1 text-xs leading-5 text-stone-500">Черновик &rarr; Проверка &rarr; Согласование &rarr; Планирование</p>
                </div>
                <div className="mt-4 grid gap-2">
                  <ContentItemAction item={inspectorItem} />
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
              <a href="#clients" className="mt-4 inline-flex text-sm font-bold text-teal-800 transition hover:text-teal-950">
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
  const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

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
                creativeAssets: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    scheduledPublication: true,
                    contentDraft: true,
                  },
                },
                scheduledPublications: {
                  orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
                  include: {
                    contentDraft: true,
                    plannedContentItem: true,
                    creativeAssets: true,
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
                creativeAssets: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    scheduledPublication: true,
                    contentDraft: true,
                  },
                },
                scheduledPublications: {
                  orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
                  include: {
                    contentDraft: true,
                    plannedContentItem: true,
                    creativeAssets: true,
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
  const firstCalendarGroup = calendarGroups[0];
  const plannedContentCount = selectedMonthlyPlan?.plannedContentItems.length ?? 0;
  const productionProgress =
    plannedContentCount > 0 ? Math.round((draftCount / plannedContentCount) * 100) : 0;
  const selectedInspectorItem = selectedMonthlyPlan?.plannedContentItems[0];
  const creativeAssets = selectedMonthlyPlan?.creativeAssets ?? [];
  const creativeAssetAttentionCount =
    creativeAssets.filter((asset) => ["needed", "brief_ready", "in_production", "needs_review"].includes(asset.status)).length +
    (selectedMonthlyPlan?.scheduledPublications.filter(
      (publication) => publication.status === "needs_assets" && publication.creativeAssets.length === 0,
    ).length ?? 0);

  return (
    <div className="min-h-screen bg-[#f4f5f2] text-stone-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-stone-800 bg-[#172226] text-stone-200 lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-sm font-bold text-white">
              AP
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Adaptive Presence</p>
              <p className="mt-0.5 text-xs text-stone-400">OS by Creative</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5">
          <div className="grid gap-5">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">{group.label}</p>
                <div className="mt-2 grid gap-1">
                  {group.items.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                        item.label === "Обзор"
                          ? "bg-white/10 font-semibold text-white"
                          : "text-stone-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-white/15 text-[10px] font-bold">
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

        <div id="settings" className="grid gap-3 border-t border-white/10 px-4 py-4">
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <p className="text-xs font-semibold text-white">AI-помощник</p>
            <p className="mt-1 text-xs leading-5 text-stone-400">Помощь по клиентам и текущим задачам.</p>
          </div>
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white">M</div>
            <div>
              <p className="text-xs font-semibold text-stone-200">Профиль менеджера</p>
              <p className="mt-0.5 text-[11px] text-stone-500">Операционная команда Creative</p>
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
                  <h1 className="text-base font-semibold text-stone-950">Панель менеджера</h1>
                  <StatusBadge tone="teal">Adaptive Presence OS</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs font-medium text-stone-400">by Creative</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden flex-wrap items-center gap-3 xl:flex">
                <ConnectionBadge label={process.env.OPENAI_API_KEY ? "OpenAI подключен" : "Нужно настроить OpenAI"} active={Boolean(process.env.OPENAI_API_KEY)} />
                <ConnectionBadge label="Neon подключен" />
                <ConnectionBadge label={process.env.VERCEL ? "Онлайн" : "Локально"} />
              </div>
              <input
                aria-label="Поиск по рабочему пространству"
                className="w-64 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 outline-none placeholder:text-stone-400 focus:border-teal-500"
                placeholder="Клиенты, черновики, события..."
              />
              <button type="button" aria-label="Уведомления" className="relative flex h-9 w-9 items-center justify-center rounded-md border border-stone-200 bg-white text-xs font-bold text-stone-600">
                N
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] text-white">{approvalQueueCount}</span>
              </button>
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

            <section id="overview" className="scroll-mt-24">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Рабочее пространство</p>
                  <h2 className="mt-2 text-3xl font-semibold text-stone-950">Центр управления присутствием</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                    Превращайте бриф клиента в исполнимый Blueprint, месячный операционный план и готовые к проверке
                    черновики.
                  </p>
                </div>
                <p className="text-xs font-semibold text-stone-400">Текущий цикл: {currentMonth()}</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Требует проверки" value={needsManagerReviewCount} detail="Черновики во внутренней очереди" tone="amber" />
                <MetricCard label="У клиента" value={waitingForClientCount} detail="Согласование с клиентом" tone="teal" />
                <MetricCard label="Согласовано" value={approvedDraftCount} detail="Можно перейти к планированию" />
                <MetricCard label="Готово к планированию" value={readyToScheduleCount} detail="Публикации пока не подключены" tone="teal" />
              </div>
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
                    <a href="#monthly-plan" className="mt-4 inline-flex text-sm font-bold text-teal-700 transition hover:text-teal-900">
                      Открыть месячный план
                    </a>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm leading-6 text-stone-500">
                      Сгенерируйте месячный операционный план, чтобы активировать календарь и очередь черновиков.
                    </p>
                    <a href="#calendar" className="mt-4 inline-flex text-sm font-bold text-teal-700 transition hover:text-teal-900">
                      Открыть настройку календаря
                    </a>
                  </div>
                )}
              </article>
            </section>

            <ReviewQueue groups={reviewQueueGroups} />

            <SchedulingLayer
              drafts={contentDrafts}
              publications={selectedMonthlyPlan?.scheduledPublications ?? []}
            />

            <CreativeAssetLayer
              publications={selectedMonthlyPlan?.scheduledPublications ?? []}
              assets={creativeAssets}
            />

            <section className="mt-7">
              <ContentCalendar
                groups={calendarGroups}
                publications={selectedMonthlyPlan?.scheduledPublications ?? []}
                month={selectedMonthlyPlan?.month ?? currentMonth()}
                blueprintId={latestBlueprint?.id}
                generationBlocked={latestBlueprint?.nextRecommendedAction === "request_more_brief_data"}
              />
            </section>

            <div className="mt-7">
              <ClientPortalPreview
                clientName={latestBlueprint?.client.name ?? "ваш бизнес"}
                approvalCount={approvalQueueCount}
                weeklyCount={firstCalendarGroup?.items.length ?? 0}
                selectedItem={selectedInspectorItem}
              />
            </div>

            <section id="clients" className="mt-10 scroll-mt-24">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Настройка клиента</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-950">Операционная конфигурация клиента</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                  Здесь находятся настройки подключения и подробные операционные данные. Ежедневная работа остаётся в командном центре и контент-календаре выше.
                </p>
              </div>
              <div className="mt-5 grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="grid gap-5 xl:sticky xl:top-24">
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
                          <p className="mt-1 text-sm leading-6 text-stone-500">Материалы для разных площадок готовы к последовательной генерации черновиков.</p>
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
                              <th className="px-3 py-3">Черновик</th>
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
                                    <a href={`#draft-${item.contentDraft.id}`} className="inline-flex rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-100">
                                      Черновик готов
                                    </a>
                                  ) : (
                                    <form action={generateContentDraftForItem}>
                                      <input type="hidden" name="plannedContentItemId" value={item.id} />
                                      <PendingSubmitButton pendingLabel="Генерируем черновик..." className="whitespace-nowrap rounded-md bg-stone-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:bg-stone-400">
                                        Сгенерировать черновик
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

                    <div id="drafts" className="mt-7 scroll-mt-24">
                      <h3 className="text-sm font-semibold text-stone-950">Проверка черновиков</h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500">Черновики генерируются по одному материалу и проходят проверку менеджера. Ничего не публикуется автоматически.</p>
                      <div className="mt-3 grid gap-3">
                        {selectedMonthlyPlan.plannedContentItems.filter((item) => item.contentDraft).map((item) => {
                          const draft = item.contentDraft!;
                          return (
                            <article id={`draft-${draft.id}`} key={draft.id} className="scroll-mt-24 rounded-lg border border-stone-200 bg-white p-5">
                              <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 text-[9px] font-bold uppercase tracking-[0.1em] text-stone-400">
                                    Визуал
                                  </div>
                                  <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-teal-700">{draft.platformName} &middot; {draft.format}</p>
                                  <h4 className="mt-2 text-lg font-semibold text-stone-950">{draft.draftTitle}</h4>
                                  <p className="mt-1 text-xs text-stone-400">{draft.topic}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <StatusBadge tone={draftStatusTone(draft.status)}>{formatDraftStatus(draft.status)}</StatusBadge>
                                  <StatusBadge tone={draft.riskLevel === "high" ? "rose" : draft.riskLevel === "medium" ? "amber" : "green"}>риск: {formatStatus(draft.riskLevel)}</StatusBadge>
                                </div>
                              </div>
                              <div className="mt-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-400">Превью текста</p>
                                <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-7 text-stone-700">{draft.draftBody}</p>
                                <details className="mt-3">
                                  <summary className="cursor-pointer text-xs font-bold text-teal-700">Открыть полный черновик</summary>
                                  <p className="mt-3 whitespace-pre-wrap rounded-md border border-stone-200 bg-stone-50 p-3 text-sm leading-7 text-stone-700">{draft.draftBody}</p>
                                </details>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                                <StatusBadge tone={draft.approvalRequired ? "amber" : "green"}>Согласование: {draft.approvalRequired ? "обязательно" : "не требуется"}</StatusBadge>
                                <StatusBadge tone={draft.autopublishEligible ? "green" : "neutral"}>Автопубликация: {draft.autopublishEligible ? "доступна" : "нет"}</StatusBadge>
                              </div>
                              <div className="mt-4">
                                <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Заметки к черновику</p>
                                {Array.isArray(draft.draftNotes) && draft.draftNotes.length > 0 ? (
                                  <ul className="mt-2 grid gap-2">
                                    {draft.draftNotes.map((note) => <li key={String(note)} className="rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-600">{String(note)}</li>)}
                                  </ul>
                                ) : <p className="mt-2 text-sm text-stone-400">Заметок к черновику нет.</p>}
                              </div>
                              <div className="mt-4">
                                <ReviewEventTimeline events={draft.reviewEvents} />
                              </div>
                              <a href="#review-queue" className="mt-4 inline-flex text-xs font-bold text-teal-700 transition hover:text-teal-900">
                                Открыть действия в очереди согласований
                              </a>
                            </article>
                          );
                        })}
                        {selectedMonthlyPlan.plannedContentItems.every((item) => !item.contentDraft) ? (
                          <EmptyState>
                            Сгенерируйте черновики из запланированных материалов, чтобы запустить процесс согласования.
                          </EmptyState>
                        ) : null}
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

                <div id="reports" className="grid scroll-mt-24 gap-4 lg:grid-cols-2">
                  <div className="scroll-mt-24">
                    <PreviewCard title="Операционный календарь" glyph="К" copy="Здесь появятся запланированные материалы, черновики, согласования, визуалы, видео и статусы публикаций." />
                  </div>
                  <div id="events" className="scroll-mt-24">
                    <PreviewCard title="Лента событий" glyph="С" copy="Здесь появятся новые отзывы, комментарии, согласования клиента, результаты публикаций и предложенные AI действия." />
                  </div>
                </div>
              </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
