"use client";

import { useEffect, useState } from "react";
import {
  approveDraft,
  approveDraftFromPortal,
  requestDraftChanges,
  requestDraftChangesFromPortal,
} from "@/app/actions";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { getGeneratedVariantImageSrc } from "@/lib/generated-visuals";

type ClientPortalStatus = "in_progress" | "ready_for_review" | "awaiting_approval" | "approved" | "changes_requested";

type ClientPortalVariant = {
  id: string;
  imageUrl: string | null;
  mimeType: string;
  storageProvider: string;
  fileSize: number | null;
  status: string;
  qualityStatus: string;
  variantTitle: string;
  createdAt: Date;
};

type ClientPortalReviewEvent = {
  id: string;
  actorType: string;
  action: string;
  comment: string | null;
  createdAt: Date;
};

export type ClientPortalItem = {
  id: string;
  plannedDate: string;
  week: string | null;
  platformName: string;
  format: string;
  topic: string;
  goal?: string | null;
  campaignTheme?: string | null;
  contentPillar?: string | null;
  channelRole?: string | null;
  contentDraft: {
    id: string;
    status: string;
    draftTitle: string;
    draftBody: string;
    reviewEvents?: ClientPortalReviewEvent[];
  } | null;
};

export type ClientPortalPublication = {
  plannedContentItemId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  notes: string | null;
  creativeAssets: Array<{
    id?: string;
    assetType?: string;
    title?: string;
    status?: string;
    notes?: string | null;
    generatedVariants: ClientPortalVariant[];
  }>;
};

type ClientPortalMaterial = {
  item: ClientPortalItem;
  publication?: ClientPortalPublication;
  status: ClientPortalStatus;
  visualAssets: ClientPortalPublication["creativeAssets"];
  thumbnail?: ClientPortalVariant;
  groupLabel: string;
  dateLabel: string;
  isCarousel: boolean;
  readySlides: number;
  totalSlides: number;
};

const inputClass =
  "w-full rounded-[22px] border border-slate-200/70 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100/80";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(124,58,237,0.20)] transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50/70 disabled:cursor-not-allowed disabled:opacity-60";
const ghostButtonClass =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900";
const surfaceClass =
  "rounded-[28px] border border-white/70 bg-white/90 shadow-[0_22px_70px_rgba(88,75,135,0.075)]";

function PortalStatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "violet" | "amber" | "rose" | "green";
}) {
  const tones = {
    neutral: "border-slate-200/70 bg-slate-50/80 text-slate-500",
    violet: "border-violet-200/80 bg-violet-50/80 text-violet-700",
    amber: "border-amber-200/80 bg-amber-50/80 text-amber-800",
    rose: "border-rose-200/80 bg-rose-50/80 text-rose-700",
    green: "border-violet-200/80 bg-violet-50/80 text-violet-700",
  };

  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function useCountUp(value: number) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || value <= 0) {
      setDisplay(value);
      return;
    }

    const duration = 750;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return display;
}

function PortalMetric({
  label,
  value,
  helper,
  progress,
  tone = "neutral",
  index = 0,
}: {
  label: string;
  value: number;
  helper: string;
  progress: number;
  tone?: "neutral" | "violet" | "amber";
  index?: number;
}) {
  const display = useCountUp(value);
  const bar = tone === "amber" ? "bg-amber-400" : "bg-violet-500";
  const width = Math.max(4, Math.min(progress, 100));

  return (
    <article
      className="ap-rise group rounded-[24px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_58px_rgba(88,75,135,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_72px_rgba(88,75,135,0.10)]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <p className="text-[34px] font-semibold leading-none tracking-tight text-slate-950 tabular-nums">{display}</p>
      <p className="mt-2 text-sm font-semibold text-slate-700">{label}</p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`ap-grow h-full origin-left rounded-full ${bar}`}
          style={{ width: `${width}%`, animationDelay: `${index * 70 + 120}ms` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{helper}</p>
    </article>
  );
}

function formatMonthLabel(month?: string) {
  if (!month) return "Месячный пакет";

  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);

  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date).replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Без даты";

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

function formatClientPortalStatus(status: ClientPortalStatus) {
  const labels: Record<ClientPortalStatus, string> = {
    in_progress: "В работе",
    ready_for_review: "Готово",
    awaiting_approval: "Требует решения",
    approved: "Согласовано",
    changes_requested: "Нужны правки",
  };

  return labels[status];
}

function clientPortalStatusTone(status: ClientPortalStatus): "neutral" | "violet" | "amber" | "rose" | "green" {
  if (status === "approved") return "green";
  if (status === "changes_requested") return "rose";
  if (status === "awaiting_approval") return "amber";
  if (status === "ready_for_review") return "violet";
  return "neutral";
}

function formatReviewAction(action: string) {
  const labels: Record<string, string> = {
    created: "создано",
    submitted_for_review: "отправлено на проверку",
    sent_to_client: "отправлено клиенту",
    changes_requested: "запрошены правки",
    approved: "согласовано",
    rejected: "отклонено",
    marked_ready_to_schedule: "готово к планированию",
    comment_added: "добавлен комментарий",
    text_updated: "текст обновлён",
  };

  return labels[action] ?? action.replaceAll("_", " ");
}

function formatReviewActor(actorType: string) {
  if (actorType === "client") return "Клиент";
  if (actorType === "system") return "Adaptive Presence OS";

  return "Creative Command";
}

function formatClientCalendarGroup(label: string) {
  const normalized = label.trim().toLowerCase().replaceAll("-", " ").replaceAll("_", " ");
  const weekMatch = normalized.match(/^week\s*(\d+)$/);

  return weekMatch ? `Неделя ${weekMatch[1]}` : label || "Без даты";
}

function suggestsVisualAsset(format: string) {
  return /(visual|video|carousel|story|cover|reel|short|image|photo|визуал|видео|карусел|сторис|облож|рилс|фото|карточ)/i.test(format);
}

function activeVisualAssets(publication?: ClientPortalPublication) {
  const assets = publication?.creativeAssets ?? [];
  const slides = assets.filter((asset) => asset.assetType === "carousel_slide");

  if (slides.length > 0) return slides;

  return assets.filter((asset) => !asset.notes?.includes("legacyCombinedCarouselAsset=true"));
}

function isCarouselMaterial(material: Pick<ClientPortalMaterial, "visualAssets">, item?: ClientPortalItem) {
  return material.visualAssets.some((asset) => asset.assetType === "carousel_slide") ||
    /(карус|carousel|карточ|слайд|multi[- ]?slide)/i.test(`${item?.format ?? ""} ${item?.topic ?? ""}`);
}

function getCarouselSlides(publication?: ClientPortalPublication) {
  return activeVisualAssets(publication).filter((asset) => asset.assetType === "carousel_slide");
}

function visualForAsset(asset?: ClientPortalPublication["creativeAssets"][number]) {
  const variants = asset?.generatedVariants ?? [];

  return variants.find((variant) => variant.status === "approved") ?? variants[0];
}

function getMaterialThumbnail(publication?: ClientPortalPublication) {
  const assets = activeVisualAssets(publication);
  const firstSlide = getCarouselSlides(publication)[0];

  return visualForAsset(firstSlide) ?? visualForAsset(assets[0]);
}

function getClientPortalStatus(item: ClientPortalItem, publication?: ClientPortalPublication): ClientPortalStatus {
  const draftStatus = item.contentDraft?.status;
  const visual = getMaterialThumbnail(publication);
  const visualRequired = suggestsVisualAsset(item.format) || publication?.status === "needs_assets";

  if (!item.contentDraft) return "in_progress";
  if (draftStatus === "client_changes_requested" || draftStatus === "rejected") return "changes_requested";
  if (draftStatus === "sent_to_client") return "awaiting_approval";
  if (visualRequired && !visual) return "in_progress";
  if (["approved", "ready_to_schedule"].includes(draftStatus ?? "")) return "approved";
  if (draftStatus === "needs_review" || draftStatus === "draft") return "ready_for_review";

  return "in_progress";
}

function calculateClientPortalStats(materials: ClientPortalMaterial[]) {
  return {
    total: materials.length,
    ready: materials.filter((material) => material.status === "approved" || material.status === "ready_for_review").length,
    needsDecision: materials.filter((material) => material.status === "awaiting_approval" || material.status === "changes_requested").length,
    inProgress: materials.filter((material) => material.status === "in_progress").length,
  };
}

function selectDefaultMaterial(materials: ClientPortalMaterial[]) {
  return materials.find((material) => material.status === "awaiting_approval" || material.status === "changes_requested") ??
    materials.find((material) => material.status === "ready_for_review") ??
    materials[0];
}

function buildCalendarDays(month?: string, materials: ClientPortalMaterial[] = []) {
  const match = month?.match(/^(\d{4})-(\d{2})$/);
  const today = new Date();
  const year = match ? Number(match[1]) : today.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : today.getMonth();
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingDays = (first.getDay() + 6) % 7;
  const materialByDay = new Map<number, ClientPortalMaterial[]>();

  for (const material of materials) {
    const rawDate = material.publication?.scheduledDate || material.item.plannedDate;
    const date = new Date(`${rawDate}T12:00:00`);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== monthIndex) continue;

    const dayMaterials = materialByDay.get(date.getDate()) ?? [];
    dayMaterials.push(material);
    materialByDay.set(date.getDate(), dayMaterials);
  }

  return [
    ...Array.from({ length: leadingDays }, (_, index) => ({ key: `blank-${index}`, day: null, materials: [] as ClientPortalMaterial[] })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;

      return { key: `day-${day}`, day, materials: materialByDay.get(day) ?? [] };
    }),
  ];
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

function PortalImage({ variant, alt, className }: { variant?: ClientPortalVariant; alt: string; className: string }) {
  const src = variant ? getGeneratedVariantImageSrc(variant) : null;

  if (src) {
    return <img src={src} alt={alt} className={className} />;
  }

  if (variant && variant.storageProvider !== "vercel_blob") {
    return (
      <div className={`${className} grid place-items-center bg-amber-50 p-4 text-center text-xs font-semibold leading-5 text-amber-800`}>
        Старый визуал хранится в базе. Новый вариант появится после подготовки.
      </div>
    );
  }

  return (
    <div className={`${className} grid place-items-center bg-slate-50 p-4 text-center text-xs font-semibold leading-5 text-slate-400`}>
      Визуал появится после подготовки.
    </div>
  );
}

function PortalTinyThumbnail({ material }: { material: ClientPortalMaterial }) {
  const src = material.thumbnail ? getGeneratedVariantImageSrc(material.thumbnail) : null;

  if (src) {
    return <img src={src} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />;
  }

  return <span className="h-2 w-2 shrink-0 rounded-full bg-violet-300" />;
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
  const materials: ClientPortalMaterial[] = items.map((item) => {
    const publication = publications.find((candidate) => candidate.plannedContentItemId === item.id);
    const visualAssets = activeVisualAssets(publication);
    const thumbnail = getMaterialThumbnail(publication);
    const slides = getCarouselSlides(publication);
    const totalSlides = slides.length > 0 ? slides.length : visualAssets.length;
    const readySlides = visualAssets.filter((asset) => Boolean(visualForAsset(asset))).length;
    const status = getClientPortalStatus(item, publication);
    const dateLabel = formatDateLabel(publication?.scheduledDate || item.plannedDate);

    return {
      item,
      publication,
      status,
      visualAssets,
      thumbnail,
      dateLabel,
      groupLabel: formatClientCalendarGroup(publication?.scheduledDate || item.week || item.plannedDate || "Без даты"),
      isCarousel: slides.length > 0 || /(карус|carousel|карточ|слайд)/i.test(`${item.format} ${item.topic}`),
      readySlides,
      totalSlides,
    };
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textExpanded, setTextExpanded] = useState(false);
  const handleSelectMaterial = (id: string) => {
    setSelectedId(id);
    setTextExpanded(false);
  };
  const fallbackMaterial = selectDefaultMaterial(materials);
  const selectedMaterial =
    materials.find((material) => material.item.id === selectedId) ?? fallbackMaterial;
  const selectedDraft = selectedMaterial?.item.contentDraft;
  const selectedEvents = selectedDraft?.reviewEvents ?? [];
  const stats = calculateClientPortalStats(materials);
  const calendarDays = buildCalendarDays(month, materials);
  const monthLabel = formatMonthLabel(month);
  const progress = stats.total > 0 ? Math.round((stats.ready / stats.total) * 100) : 0;
  const commentCount = selectedEvents.filter((event) => event.comment).length;
  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  if (!month) {
    return (
      <main className="min-h-screen bg-[#f7f5fb] bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.15),transparent_34%)] p-6">
        <section className="mx-auto max-w-3xl rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(88,75,135,0.10)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Adaptive Presence OS · by Creative Command</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Клиентский пакет ещё собирается</h1>
          {showPreviewNotice ? (
            <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-900">
              Это предварительный клиентский вид. Публичный доступ и авторизация будут добавлены позже.
            </div>
          ) : null}
          <p className="mt-4 text-sm leading-6 text-slate-500">Выберите месячный план, чтобы посмотреть календарь, материалы и правки.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f5fb] bg-[radial-gradient(circle_at_26%_-10%,rgba(139,92,246,0.16),transparent_34%),radial-gradient(circle_at_92%_6%,rgba(196,181,253,0.12),transparent_28%)] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r border-white/70 bg-white/60 px-5 py-6 backdrop-blur-xl">
          <div className="rounded-[24px] border border-white/80 bg-white/82 p-5 shadow-[0_18px_60px_rgba(88,75,135,0.055)]">
            <p className="text-lg font-semibold tracking-tight text-slate-950">Adaptive Presence OS</p>
            <p className="mt-1 text-xs font-semibold text-violet-700">by Creative Command</p>
          </div>
          <nav className="mt-6 grid gap-1.5">
            {["Обзор", "Календарь", "Материалы", "Правки", "Файлы"].map((item, index) => (
              <a
                key={item}
                href={`#${["overview", "calendar", "materials", "revisions", "files"][index]}`}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-white/80 hover:text-violet-700"
              >
                {item}
              </a>
            ))}
          </nav>
          <div className="mt-6 rounded-[24px] border border-white/80 bg-white/70 p-5">
            <p className="font-semibold text-slate-950">Нужна помощь?</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Напишите нам — мы на связи.</p>
            <a href="mailto:hello@creative-command.local" className={`${secondaryButtonClass} mt-4 w-full`}>Написать</a>
          </div>
          <div className="mt-auto pt-8 text-xs leading-5 text-slate-400">
            <p className="font-semibold text-slate-500">Creative Command</p>
            <p>Ваш продакшн-партнёр</p>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          {showPreviewNotice ? (
            <div className="mb-4 rounded-2xl border border-violet-200 bg-white/80 px-4 py-3 text-sm leading-6 text-violet-900 shadow-[0_12px_40px_rgba(88,75,135,0.06)]">
              Это предварительный клиентский вид. Публичный доступ и авторизация будут добавлены позже.
            </div>
          ) : null}
          {notice ? <div className="mb-4 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-800">{notice}</div> : null}
          {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div> : null}

          <header id="overview" className={`${surfaceClass} p-5 backdrop-blur-xl`}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">Месячный пакет</span>
                  <span className="text-xs font-semibold text-slate-400">{monthLabel}</span>
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{clientName || "Клиент"}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Календарь, тексты, визуалы и решения по материалам месяца в одном спокойном пространстве.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className={secondaryButtonClass}>Скачать пакет месяца</button>
                <div className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(124,58,237,0.25)]">
                  {(clientName || "C").slice(0, 1).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PortalMetric label="Материалов всего" value={stats.total} helper="В плане на месяц" progress={100} index={0} />
            <PortalMetric label="Готово" value={stats.ready} helper={`${progress}% пакета готово`} progress={progress} tone="violet" index={1} />
            <PortalMetric label="Требуют решения" value={stats.needsDecision} helper="Правки или подтверждение" progress={stats.total ? (stats.needsDecision / stats.total) * 100 : 0} tone={stats.needsDecision > 0 ? "amber" : "neutral"} index={2} />
            <PortalMetric label="В работе" value={stats.inProgress} helper="Команда готовит материалы" progress={stats.total ? (stats.inProgress / stats.total) * 100 : 0} index={3} />
          </section>

          <section className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)_320px]">
            <article id="calendar" className={`${surfaceClass} min-w-0 p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600">Календарь</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{monthLabel}</h2>
                </div>
                <span className="text-xs font-semibold text-slate-400">{stats.total} материалов</span>
              </div>
              <div className="mt-6 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-slate-400">
                {weekDays.map((day) => <div key={day}>{day}</div>)}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const firstMaterial = day.materials[0];
                  const selected = Boolean(selectedMaterial && firstMaterial?.item.id === selectedMaterial.item.id);

                  return (
                    <div
                      key={day.key}
                      className={`min-h-[92px] rounded-[20px] border p-2.5 transition ${
                        day.day
                          ? selected
                            ? "border-violet-200 bg-violet-50/80 shadow-[0_14px_34px_rgba(124,58,237,0.10)]"
                            : "border-transparent bg-slate-50/70 hover:bg-white"
                          : "border-transparent"
                      }`}
                    >
                      {day.day ? (
                        <>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-slate-500">{day.day}</span>
                            {day.materials.length > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> : null}
                          </div>
                          <div className="mt-2 grid gap-1.5">
                            {day.materials.slice(0, 2).map((material) => (
                              <div
                                key={material.item.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleSelectMaterial(material.item.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleSelectMaterial(material.item.id);
                                  }
                                }}
                                className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white/80 px-1.5 py-1 text-left shadow-[0_8px_18px_rgba(88,75,135,0.04)] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-violet-200"
                              >
                                <PortalTinyThumbnail material={material} />
                                <div className="min-w-0">
                                  <p className="truncate text-[10px] font-semibold text-slate-600">{material.item.platformName}</p>
                                  <p className="truncate text-[10px] text-slate-400">{material.item.topic}</p>
                                </div>
                              </div>
                            ))}
                            {day.materials.length > 2 ? <p className="text-[10px] font-semibold text-violet-600">+{day.materials.length - 2}</p> : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>

            <article id="materials" className={`${surfaceClass} min-w-0 overflow-hidden p-5`}>
              {selectedMaterial ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {selectedMaterial.dateLabel} · {selectedMaterial.item.platformName}
                      </p>
                      <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-slate-950">{selectedMaterial.item.topic}</h2>
                    </div>
                    <PortalStatusBadge tone={clientPortalStatusTone(selectedMaterial.status)}>
                      {formatClientPortalStatus(selectedMaterial.status)}
                    </PortalStatusBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {selectedMaterial.item.goal || selectedMaterial.item.campaignTheme || selectedMaterial.item.contentPillar || "Материал из месячного пакета присутствия бренда."}
                  </p>

                  <section className="mt-6 rounded-[26px] bg-[#f8f7fb] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-950">Текст для публикации</p>
                      {selectedDraft?.draftBody ? (
                        <button
                          type="button"
                          onClick={() => setTextExpanded((value) => !value)}
                          className="cursor-pointer rounded-full px-2 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                          aria-expanded={textExpanded}
                        >
                          {textExpanded ? "Свернуть" : "Показать полностью"}
                        </button>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-slate-900">{selectedDraft?.draftTitle || selectedMaterial.item.topic}</h3>
                    <p id="full-text" className={`mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 ${textExpanded ? "" : "max-h-72 overflow-hidden"}`}>
                      {selectedDraft?.draftBody || "Материал ещё готовится. Текст появится после подготовки командой Creative Command."}
                    </p>
                  </section>

                  <section className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-950">Визуалы</p>
                      {selectedMaterial.isCarousel ? (
                        <span className="text-xs font-semibold text-violet-700">Карусель · {selectedMaterial.readySlides}/{selectedMaterial.totalSlides || 1}</span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">{selectedMaterial.thumbnail ? "Визуал готов" : "Готовится"}</span>
                      )}
                    </div>
                    {selectedMaterial.visualAssets.length > 1 ? (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {selectedMaterial.visualAssets.slice(0, 4).map((asset, index) => (
                          <div key={asset.id ?? index} className={`overflow-hidden rounded-[22px] border ${index === 0 ? "border-violet-200 bg-violet-50 shadow-[0_16px_38px_rgba(124,58,237,0.12)]" : "border-white bg-white shadow-[0_12px_30px_rgba(88,75,135,0.06)]"}`}>
                            <PortalImage variant={visualForAsset(asset)} alt={asset.title || `Слайд ${index + 1}`} className="aspect-square w-full object-cover" />
                            <p className="px-3 py-2 text-[11px] font-semibold text-slate-500">Карточка {index + 1}/{selectedMaterial.totalSlides}</p>
                          </div>
                        ))}
                        {selectedMaterial.visualAssets.length > 4 ? (
                          <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700">
                            +{selectedMaterial.visualAssets.length - 4} слайда
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-3 overflow-hidden rounded-[26px] border border-white bg-white shadow-[0_18px_48px_rgba(88,75,135,0.08)]">
                        <PortalImage variant={selectedMaterial.thumbnail} alt={selectedMaterial.item.topic} className="aspect-[16/10] w-full object-cover" />
                      </div>
                    )}
                  </section>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <a href="#revisions" className={primaryButtonClass}>Оставить правку</a>
                    {selectedDraft ? (
                      <form action={portalToken ? approveDraftFromPortal : approveDraft}>
                        <PortalActionFields contentDraftId={selectedDraft.id} portalToken={portalToken} />
                        <PendingSubmitButton pendingLabel="Подтверждаем..." className={secondaryButtonClass}>Подтвердить</PendingSubmitButton>
                      </form>
                    ) : null}
                    <a href="#full-text" className={ghostButtonClass}>Открыть материал</a>
                  </div>
                </>
              ) : (
                <div className="grid min-h-[460px] place-items-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-center">
                  <div>
                    <p className="font-semibold text-slate-900">Пакет месяца ещё собирается</p>
                    <p className="mt-2 text-sm text-slate-500">Материалы появятся здесь после подготовки.</p>
                  </div>
                </div>
              )}
            </article>

            <aside className={`${surfaceClass} min-w-0 p-4`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-950">Материалы месяца</h2>
                <button className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">Фильтры</button>
              </div>
              <div className="mt-4 grid max-h-[720px] gap-3 overflow-y-auto pr-1">
                {materials.map((material) => {
                  const src = material.thumbnail ? getGeneratedVariantImageSrc(material.thumbnail) : null;
                  const selected = selectedMaterial?.item.id === material.item.id;

                  return (
                    <article
                      key={material.item.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={() => handleSelectMaterial(material.item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectMaterial(material.item.id);
                        }
                      }}
                      className={`min-w-0 cursor-pointer rounded-[22px] border p-3 outline-none transition focus-visible:ring-4 focus-visible:ring-violet-100 ${selected ? "border-violet-200 bg-violet-50/70 shadow-[0_14px_34px_rgba(124,58,237,0.10)]" : "border-transparent bg-slate-50/70 hover:bg-white"}`}
                    >
                      <div className="flex min-w-0 gap-3">
                        {src ? (
                          <img src={src} alt={material.item.topic} className="h-14 w-14 shrink-0 rounded-[18px] object-cover" />
                        ) : (
                          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-white text-[10px] font-semibold text-slate-400">Soon</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-slate-400">{material.dateLabel} · {material.item.platformName}</p>
                          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{material.item.topic}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{material.item.contentDraft?.draftBody || "Материал готовится."}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-semibold ${material.status === "awaiting_approval" ? "text-amber-700" : "text-slate-400"}`}>
                          {formatClientPortalStatus(material.status)}
                        </span>
                        {material.isCarousel ? <span className="text-[11px] font-semibold text-violet-600">Карусель · {material.totalSlides}</span> : null}
                      </div>
                    </article>
                  );
                })}
                {materials.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                    Материалы месяца ещё готовятся.
                  </div>
                ) : null}
              </div>
            </aside>
          </section>

          <section id="revisions" className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <article className={`${surfaceClass} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600">Комментарии / Правки</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Обсуждение материала</h2>
                </div>
                <span className="text-xs font-semibold text-slate-400">{commentCount} комментариев</span>
              </div>
              <div className="mt-5 grid gap-3">
                {selectedEvents.filter((event) => event.comment).slice(-4).map((event) => (
                  <div key={event.id} className="flex gap-3 rounded-[22px] bg-slate-50/70 p-4">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${event.actorType === "client" ? "bg-violet-100 text-violet-700" : "bg-white text-slate-500"}`}>
                      {formatReviewActor(event.actorType).slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-950">{formatReviewActor(event.actorType)}</p>
                        <span className="text-xs font-semibold text-slate-400">{formatReviewAction(event.action)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{event.comment}</p>
                    </div>
                  </div>
                ))}
                {selectedEvents.filter((event) => event.comment).length === 0 ? (
                  <p className="rounded-[22px] bg-slate-50/70 p-5 text-sm text-slate-500">Комментариев пока нет.</p>
                ) : null}
              </div>
            </article>

            <article className={`${surfaceClass} p-5`}>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">Решение по материалу</h2>
              {!selectedDraft ? (
                <p className="mt-4 rounded-[22px] bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-500">
                  Материал ещё готовится. Согласование появится после подготовки текста и визуала.
                </p>
              ) : selectedMaterial?.status === "approved" ? (
                <p className="mt-4 rounded-[22px] bg-violet-50 px-4 py-3 text-sm font-semibold leading-6 text-violet-800">Материал согласован.</p>
              ) : selectedMaterial?.status === "changes_requested" ? (
                <p className="mt-4 rounded-[22px] bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">Правки отправлены команде.</p>
              ) : selectedMaterial?.status === "awaiting_approval" || selectedMaterial?.status === "ready_for_review" ? (
                <div className="mt-4 grid gap-3">
                  <form action={portalToken ? requestDraftChangesFromPortal : requestDraftChanges} className="grid gap-3">
                    <PortalActionFields contentDraftId={selectedDraft.id} portalToken={portalToken} />
                    <textarea name="comment" rows={5} className={inputClass} placeholder="Напишите комментарий или предложите правку..." />
                    <PendingSubmitButton pendingLabel="Отправляем правку..." className={primaryButtonClass}>Оставить правку</PendingSubmitButton>
                  </form>
                  <form action={portalToken ? approveDraftFromPortal : approveDraft}>
                    <PortalActionFields contentDraftId={selectedDraft.id} portalToken={portalToken} />
                    <textarea name="comment" rows={2} className={`${inputClass} mb-3`} placeholder="Комментарий к подтверждению, необязательно" />
                    <PendingSubmitButton pendingLabel="Подтверждаем..." className={`${secondaryButtonClass} w-full`}>Подтвердить материал</PendingSubmitButton>
                  </form>
                </div>
              ) : (
                <p className="mt-4 rounded-[22px] bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-500">
                  Материал ещё готовится. Согласование появится после подготовки текста и визуала.
                </p>
              )}
            </article>
          </section>

          <section id="files" className="mt-5 rounded-[28px] border border-white/70 bg-white/65 p-5 shadow-[0_20px_60px_rgba(88,75,135,0.045)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Файлы</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Пакет месяца</h2>
              </div>
              <p className="text-sm text-slate-500">Экспорт материалов и финальный архив будут доступны после согласования пакета.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
