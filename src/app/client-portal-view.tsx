import {
  approveDraft,
  approveDraftFromPortal,
  requestDraftChanges,
  requestDraftChangesFromPortal,
} from "@/app/actions";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { getGeneratedVariantImageSrc } from "@/lib/generated-visuals";

type ClientPortalStatus = "in_progress" | "ready_for_review" | "awaiting_approval" | "approved" | "changes_requested";

export type ClientPortalItem = {
  id: string;
  plannedDate: string;
  week: string | null;
  platformName: string;
  format: string;
  topic: string;
  contentDraft: {
    id: string;
    status: string;
    draftTitle: string;
    draftBody: string;
  } | null;
};

export type ClientPortalPublication = {
  plannedContentItemId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  notes: string | null;
  creativeAssets: Array<{
    generatedVariants: Array<{
      id: string;
      imageUrl: string | null;
      mimeType: string;
      storageProvider: string;
      fileSize: number | null;
      status: string;
      qualityStatus: string;
      variantTitle: string;
      createdAt: Date;
    }>;
  }>;
};

const inputClass =
  "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60";

function PortalStatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "teal" | "amber" | "rose" | "green";
}) {
  const tones = {
    neutral: "border-stone-200 bg-stone-50 text-stone-600",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

function PortalMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "teal" | "amber" | "rose";
}) {
  const tones = {
    neutral: "border-stone-200 bg-white",
    teal: "border-teal-200 bg-teal-50/50",
    amber: "border-amber-200 bg-amber-50/50",
    rose: "border-rose-200 bg-rose-50/50",
  };

  return (
    <div className={`rounded-md border p-3 ${tones[tone]}`}>
      <p className="text-2xl font-semibold text-stone-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-stone-500">{label}</p>
    </div>
  );
}

function formatClientPortalStatus(status: ClientPortalStatus) {
  const labels: Record<ClientPortalStatus, string> = {
    in_progress: "В работе",
    ready_for_review: "Готово к просмотру",
    awaiting_approval: "Ожидает согласования",
    approved: "Согласовано",
    changes_requested: "Нужны правки",
  };

  return labels[status];
}

function clientPortalStatusTone(status: ClientPortalStatus): "neutral" | "teal" | "amber" | "rose" | "green" {
  if (status === "approved") return "green";
  if (status === "changes_requested") return "rose";
  if (status === "awaiting_approval") return "amber";
  if (status === "ready_for_review") return "teal";
  return "neutral";
}

function formatClientCalendarGroup(label: string) {
  const normalized = label.trim().toLowerCase().replaceAll("-", " ").replaceAll("_", " ");
  const weekMatch = normalized.match(/^week\s*(\d+)$/);

  return weekMatch ? `Неделя ${weekMatch[1]}` : label || "Без даты";
}

function suggestsVisualAsset(format: string) {
  return /(visual|video|carousel|story|cover|reel|short|image|photo|визуал|видео|карусел|сторис|облож|рилс|фото)/i.test(format);
}

function getClientPortalVisual(publication?: ClientPortalPublication) {
  const variants = publication?.creativeAssets[0]?.generatedVariants ?? [];

  return variants.find((variant) => variant.status === "approved") ?? variants[0];
}

function getClientPortalStatus(item: ClientPortalItem, publication?: ClientPortalPublication): ClientPortalStatus {
  const draftStatus = item.contentDraft?.status;
  const visual = getClientPortalVisual(publication);
  const visualRequired = suggestsVisualAsset(item.format) || publication?.status === "needs_assets";

  if (!item.contentDraft) return "in_progress";
  if (draftStatus === "client_changes_requested" || draftStatus === "rejected") return "changes_requested";
  if (draftStatus === "sent_to_client") return "awaiting_approval";
  if (visualRequired && !visual) return "in_progress";
  if (["approved", "ready_to_schedule"].includes(draftStatus ?? "")) return "approved";
  if (draftStatus === "needs_review") return "ready_for_review";
  return "in_progress";
}

function PortalActionFields({ contentDraftId, portalToken }: { contentDraftId: string; portalToken?: string }) {
  return portalToken ? (
    <>
      <input type="hidden" name="token" value={portalToken} />
      <input type="hidden" name="contentDraftId" value={contentDraftId} />
    </>
  ) : (
    <>
      <input type="hidden" name="contentDraftId" value={contentDraftId} />
      <input type="hidden" name="actorType" value="client" />
      <input type="hidden" name="returnView" value="client_portal" />
    </>
  );
}

export function ClientPortalView({
  clientName,
  month,
  items,
  publications,
  portalToken,
  notice,
  error,
  showPreviewNotice = false,
}: {
  clientName?: string;
  month?: string;
  items: ClientPortalItem[];
  publications: ClientPortalPublication[];
  portalToken?: string;
  notice?: string;
  error?: string;
  showPreviewNotice?: boolean;
}) {
  if (!month) {
    return (
      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Клиентский портал</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950">Клиентский календарь</h1>
        {showPreviewNotice ? (
          <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-3 text-xs leading-5 text-teal-900">
            Это предварительный клиентский вид. Публичный доступ и авторизация будут добавлены позже.
          </div>
        ) : null}
        <p className="mt-2 text-sm leading-6 text-stone-500">Выберите месячный план, чтобы посмотреть клиентский календарь.</p>
      </section>
    );
  }

  const materials = items.map((item) => {
    const publication = publications.find((candidate) => candidate.plannedContentItemId === item.id);
    const status = getClientPortalStatus(item, publication);

    return {
      item,
      publication,
      status,
      visual: getClientPortalVisual(publication),
      groupLabel: formatClientCalendarGroup(publication?.scheduledDate || item.week || item.plannedDate || "Без даты"),
    };
  });
  const groupedMaterials = Array.from(
    materials.reduce((groups, material) => {
      groups.set(material.groupLabel, [...(groups.get(material.groupLabel) ?? []), material]);
      return groups;
    }, new Map<string, typeof materials>()),
    ([label, groupedItems]) => ({ label, items: groupedItems }),
  );
  const attentionMaterials = materials
    .filter(({ item, status, visual }) =>
      ["awaiting_approval", "changes_requested"].includes(status) ||
      ["draft", "needs_review"].includes(item.contentDraft?.status ?? "") ||
      Boolean(visual && visual.qualityStatus !== "passed"),
    )
    .slice(0, 5);
  const readyForReviewCount = materials.filter(({ status }) => ["ready_for_review", "awaiting_approval"].includes(status)).length;
  const approvedCount = materials.filter(({ status }) => status === "approved").length;
  const needsChangesCount = materials.filter(({ status }) => status === "changes_requested").length;
  const missingVisualCount = materials.filter(({ item, publication, visual }) =>
    (suggestsVisualAsset(item.format) || publication?.status === "needs_assets") && !visual,
  ).length;

  return (
    <section>
      {showPreviewNotice ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-3 text-xs leading-5 text-teal-900">
          Это предварительный клиентский вид. Публичный доступ и авторизация будут добавлены позже.
        </div>
      ) : null}
      {notice ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}
      {error ? <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div> : null}
      <div className={`${showPreviewNotice ? "mt-5" : ""} overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,36,38,0.04)]`}>
        <div className="border-b border-stone-200 bg-[#f8fbfa] px-5 py-6 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Adaptive Presence OS &middot; by Creative</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-stone-950">{clientName || "Клиентский календарь"}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">Календарь публикаций и материалы для понятного согласования.</p>
            </div>
            <PortalStatusBadge tone="teal">{month}</PortalStatusBadge>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <PortalMetric label="Материалов в плане" value={materials.length} />
            <PortalMetric label="Готово к просмотру" value={readyForReviewCount} tone="teal" />
            <PortalMetric label="Ожидает согласования" value={materials.filter(({ status }) => status === "awaiting_approval").length} tone="amber" />
            <PortalMetric label="Согласовано" value={approvedCount} />
            <PortalMetric label="Нужны правки" value={needsChangesCount} tone={needsChangesCount > 0 ? "rose" : "neutral"} />
            <PortalMetric label="Визуалы в работе" value={missingVisualCount} tone={missingVisualCount > 0 ? "amber" : "neutral"} />
          </div>

          <section className="mt-7 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700">Ваше внимание</p>
                <h3 className="mt-1 text-lg font-semibold text-stone-950">Требует внимания</h3>
              </div>
              <PortalStatusBadge tone={attentionMaterials.length > 0 ? "amber" : "green"}>{attentionMaterials.length}</PortalStatusBadge>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {attentionMaterials.map(({ item, status }) => (
                <div key={item.id} className="rounded-md border border-amber-200 bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <PortalStatusBadge tone="teal">{item.platformName}</PortalStatusBadge>
                    <PortalStatusBadge tone={clientPortalStatusTone(status)}>{formatClientPortalStatus(status)}</PortalStatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-900">{item.topic}</p>
                </div>
              ))}
              {attentionMaterials.length === 0 ? <p className="text-sm leading-6 text-stone-500">Сейчас нет материалов, требующих вашего внимания.</p> : null}
            </div>
          </section>

          <div className="mt-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Месячный план</p>
            <h3 className="mt-1 text-xl font-semibold text-stone-950">Календарь публикаций</h3>
            <div className="mt-4 grid gap-5">
              {groupedMaterials.map((group) => (
                <section key={group.label}>
                  <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-2">
                    <h4 className="font-semibold text-stone-900">{group.label}</h4>
                    <PortalStatusBadge>{group.items.length} материалов</PortalStatusBadge>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {group.items.map(({ item, publication, status, visual }) => (
                      <article key={item.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                        {visual && getGeneratedVariantImageSrc(visual) ? (
                          <img src={getGeneratedVariantImageSrc(visual) ?? ""} alt={item.topic} className="aspect-[16/8] max-h-52 w-full bg-stone-100 object-contain" />
                        ) : visual && visual.storageProvider !== "vercel_blob" ? (
                          <div className="flex h-28 items-center justify-center border-b border-dashed border-amber-200 bg-amber-50 px-4 text-center text-xs font-semibold leading-5 text-amber-900">
                            Старый визуал хранится в базе. Откройте полную карточку или сгенерируйте новый вариант.
                          </div>
                        ) : (
                          <div className="flex h-28 items-center justify-center border-b border-dashed border-stone-200 bg-stone-50 px-4 text-center text-xs font-semibold text-stone-400">
                            Визуал ещё готовится.
                          </div>
                        )}
                        <div className="p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <PortalStatusBadge tone="teal">{item.platformName}</PortalStatusBadge>
                            <PortalStatusBadge>{item.format}</PortalStatusBadge>
                            <PortalStatusBadge tone={clientPortalStatusTone(status)}>{formatClientPortalStatus(status)}</PortalStatusBadge>
                          </div>
                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.08em] text-stone-400">
                            {publication?.scheduledDate || item.week || item.plannedDate}
                            {publication?.scheduledTime ? `, ${publication.scheduledTime}` : ""}
                          </p>
                          <h5 className="mt-2 font-semibold leading-6 text-stone-950">{item.topic}</h5>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-500">{item.contentDraft?.draftBody || "Текст публикации ещё готовится."}</p>
                          <details className="mt-3 rounded-md border border-stone-200 bg-stone-50/70">
                            <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-teal-800">Открыть материал</summary>
                            <div className="border-t border-stone-200 p-3">
                              <p className="text-xs font-bold text-stone-500">Текст публикации</p>
                              <p className="mt-2 text-sm font-semibold leading-6 text-stone-900">{item.contentDraft?.draftTitle || item.topic}</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">{item.contentDraft?.draftBody || "Текст публикации ещё готовится."}</p>
                              {publication?.notes ? <p className="mt-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-500">{publication.notes}</p> : null}
                              <div className="mt-4 border-t border-stone-200 pt-4">
                                <p className="text-sm font-semibold text-stone-950">Решение по материалу</p>
                                {!item.contentDraft ? (
                                  <p className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">Материал ещё готовится. Согласование появится после подготовки текста и визуала.</p>
                                ) : status === "approved" ? (
                                  <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">Материал согласован.</p>
                                ) : status === "changes_requested" ? (
                                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">Правки отправлены команде.</p>
                                ) : status === "awaiting_approval" || status === "ready_for_review" ? (
                                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                    <form action={portalToken ? approveDraftFromPortal : approveDraft} className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                                      <PortalActionFields contentDraftId={item.contentDraft.id} portalToken={portalToken} />
                                      <label className="grid gap-1 text-xs font-bold text-stone-600">
                                        Комментарий
                                        <textarea name="comment" rows={3} className={inputClass} placeholder="Необязательно" />
                                      </label>
                                      <PendingSubmitButton pendingLabel="Согласовываем..." className={`${primaryButtonClass} mt-3 w-full`}>Согласовать</PendingSubmitButton>
                                    </form>
                                    <form action={portalToken ? requestDraftChangesFromPortal : requestDraftChanges} className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
                                      <PortalActionFields contentDraftId={item.contentDraft.id} portalToken={portalToken} />
                                      <label className="grid gap-1 text-xs font-bold text-stone-600">
                                        Что нужно изменить
                                        <textarea name="comment" rows={3} className={inputClass} placeholder="Опишите правки, если они нужны" />
                                      </label>
                                      <PendingSubmitButton pendingLabel="Отправляем правки..." className={`${secondaryButtonClass} mt-3 w-full`}>Запросить правки</PendingSubmitButton>
                                    </form>
                                  </div>
                                ) : (
                                  <p className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">Материал ещё готовится. Согласование появится после подготовки текста и визуала.</p>
                                )}
                              </div>
                            </div>
                          </details>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
              {groupedMaterials.length === 0 ? <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">Публикационные материалы для этого месяца ещё готовятся.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
