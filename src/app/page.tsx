import {
  addDraftManagerComment,
  addClientBrief,
  approveDraft,
  approveCreativeVariant,
  archiveClientBrandAsset,
  autoScheduleMonthlyPlanDates,
  clearLegacyBase64ForBlobVariants,
  createClientBrandAsset,
  createClientPortalLink,
  createCreativeAssetBrief,
  createClient,
  duplicateClientForTesting,
  createPlannedContentItemManual,
  deleteCreativeVariant,
  deletePlannedContentItemManual,
  duplicatePlannedContentItemManual,
  generateBlueprint,
  generateContentDraftForItem,
  regenerateContentDraftForItem,
  generateCreativeBriefForSelectedMaterial,
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
  prepareMonthCreativeBriefs,
  prepareMonthAutopilot,
  prepareOrContinueMonthProduction,
  prepareMonthVisuals,
  processNextMonthProductionTasks,
  proposeMonthlyPlanRevision,
  rebuildCreativeAssetAsCarousel,
  reviseMonthlyPlanWithCopilot,
  regenerateCreativeAssetBrief,
  markPublicationPublishedManual,
  publishPublicationToTelegram,
  saveTelegramBotToken,
  addClientChannel,
  archiveClientChannel,
  upsertPublicationMetric,
  rejectDraft,
  rejectCreativeVariant,
  rejectMonthlyPlanRevisionProposal,
  rebuildMonthProduction,
  resetTestMonthProduction,
  retryFailedProductionTasks,
  retryMaterialProductionStep,
  requestDraftChanges,
  revokeClientPortalLink,
  scheduleContentDraft,
  sendDraftToClient,
  submitDraftForReview,
  testN8nConnection,
  unschedulePublication,
  applyMonthlyPlanRevisionProposal,
  updateClientBrief,
  updateClientBrandProfile,
  updateCreativeAssetBrief,
  updateCreativeAssetStatus,
  updatePlannedContentItemManual,
  updatePublicationText,
  updateScheduledPublication,
} from "@/app/actions";
import { BrandAssetFileInput } from "@/app/brand-asset-file-input";
import { ClientPortalView } from "@/app/client-portal-view";
import {
  buildMonthlyReport,
  formatReportNumber,
  isPublicationPublished,
  type ReportPublicationInput,
} from "@/lib/report-metrics";
import { MonthProductionAutoRunner } from "@/app/month-production-auto-runner";
import {
  OverviewAttention,
  OverviewMetric,
  OverviewMiniCalendar,
  type OverviewCalendarItem,
} from "@/app/overview-widgets";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { getAutopilotTextBatchLimit } from "@/lib/autopilot";
import {
  formatGeneratedVisualFileSize,
  formatGeneratedVisualStorage,
  getGeneratedVariantImageSrc,
} from "@/lib/generated-visuals";
import { getTextModelSettings } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  view?: string;
  blueprint?: string;
  plan?: string;
  client?: string;
  calendarView?: string;
  calendarDate?: string;
  setupStep?: string;
  brandStep?: string;
  error?: string;
  notice?: string;
  portalLink?: string;
  material?: string;
  materialId?: string;
  filter?: string;
}>;

const workspaceViews = [
  "overview",
  "clients",
  "client_setup",
  "approvals",
  "calendar",
  "drafts",
  "assets",
  "brand_assets",
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

const setupSteps = ["create_client", "brief", "blueprint", "monthly_plan", "brand"] as const;
type SetupStep = (typeof setupSteps)[number];

const setupStepLabels: Record<SetupStep, string> = {
  create_client: "Клиент",
  brief: "Бриф",
  blueprint: "Blueprint",
  monthly_plan: "Месячный план",
  brand: "Бренд",
};

const brandSteps = ["profile", "materials", "review"] as const;
type BrandStep = (typeof brandSteps)[number];

const brandStepLabels: Record<BrandStep, string> = {
  profile: "Профиль бренда",
  materials: "Материалы",
  review: "Проверка",
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

function clientSetupHref(step: SetupStep, context: WorkspaceContext = {}) {
  const searchParams = new URLSearchParams({ view: "client_setup", setupStep: step });

  if (context.blueprint) searchParams.set("blueprint", context.blueprint);
  if (context.plan) searchParams.set("plan", context.plan);
  if (context.client) searchParams.set("client", context.client);

  return `/?${searchParams.toString()}`;
}

function brandAssetsHref(step: BrandStep, context: WorkspaceContext = {}) {
  const searchParams = new URLSearchParams({ view: "brand_assets", brandStep: step });

  if (context.blueprint) searchParams.set("blueprint", context.blueprint);
  if (context.plan) searchParams.set("plan", context.plan);
  if (context.client) searchParams.set("client", context.client);

  return `/?${searchParams.toString()}`;
}

const viewTitles: Record<WorkspaceView, string> = {
  overview: "Обзор",
  clients: "Клиенты",
  client_setup: "Настройка клиента",
  approvals: "Правки",
  calendar: "Календарь",
  drafts: "Материалы",
  assets: "Креативы",
  brand_assets: "Бренд",
  client_portal: "Клиентский календарь",
  reports: "Отчёты",
  settings: "Настройки",
};

const navigationGroups = [
  {
    label: "Главное",
    items: [
      { label: "Обзор", view: "overview" as const, icon: "overview" as const },
      { label: "Клиенты", view: "clients" as const, icon: "clients" as const },
    ],
  },
];

type SidebarIconName = "overview" | "clients" | "settings" | "profile" | "review" | "client" | "check" | "calendar" | "bell" | "brief" | "blueprint";

function SidebarIcon({ name, className = "h-4 w-4" }: { name: SidebarIconName; className?: string }) {
  const commonProps = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (name === "overview") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M4 13h6V4H4v9Z" />
        <path d="M14 20h6v-9h-6v9Z" />
        <path d="M4 20h6v-3H4v3Z" />
        <path d="M14 7h6V4h-6v3Z" />
      </svg>
    );
  }

  if (name === "clients") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4" />
        <path d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M21 18c0-1.9-1.3-3.5-3.1-3.9" />
        <path d="M16.5 4.4a3.2 3.2 0 0 1 0 6.2" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 0 1-2.98 2.98l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V21.3a2.1 2.1 0 0 1-4.2 0v-.04A1.8 1.8 0 0 0 8.4 19.6a1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 0 1-2.98-2.98l.04-.04A1.8 1.8 0 0 0 3.8 15a1.8 1.8 0 0 0-1.66-1.1H2.1a2.1 2.1 0 0 1 0-4.2h.04A1.8 1.8 0 0 0 3.8 8.6a1.8 1.8 0 0 0-.36-1.98l-.04-.04A2.1 2.1 0 0 1 6.38 3.6l.04.04a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 9.5 2.34V2.3a2.1 2.1 0 0 1 4.2 0v.04A1.8 1.8 0 0 0 14.8 4a1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 0 1 2.98 2.98l-.04.04A1.8 1.8 0 0 0 19.4 8.6a1.8 1.8 0 0 0 1.66 1.1h.04a2.1 2.1 0 0 1 0 4.2h-.04A1.8 1.8 0 0 0 19.4 15Z" />
      </svg>
    );
  }

  if (name === "review") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.7 2.9 16.5A2.3 2.3 0 0 0 4.9 20h14.2a2.3 2.3 0 0 0 2-3.5L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }

  if (name === "client") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M5 20c.5-3 3-5 7-5s6.5 2 7 5" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M7 3v4" />
        <path d="M17 3v4" />
        <path d="M4 9h16" />
        <path d="M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </svg>
    );
  }

  if (name === "brief") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
        <path d="M6 3h9l3 3v15H6V3Z" />
        <path d="M15 3v4h4" />
      </svg>
    );
  }

  if (name === "blueprint") {
    return (
      <svg aria-hidden="true" {...commonProps}>
        <path d="M4 5h7v7H4V5Z" />
        <path d="M13 5h7v4h-7V5Z" />
        <path d="M13 11h7v8h-7v-8Z" />
        <path d="M4 14h7v5H4v-5Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" {...commonProps}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4 20c0-3.1 2.7-5.5 6-5.5h4c3.3 0 6 2.4 6 5.5" />
    </svg>
  );
}

const pageBackgroundClass = "min-h-screen bg-[#f7f5fb] text-stone-900";
const panelClass = "rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,36,38,0.04)]";

function integrationStatusTone(status: string) {
  if (status === "failed") return "bg-rose-50 text-rose-700";
  if (status === "sent" || status === "processed") return "bg-violet-50 text-violet-700";
  return "bg-stone-100 text-stone-500";
}
const cardHeaderClass = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
const mutedTextClass = "text-sm leading-6 text-stone-500";
const sectionClass = `${panelClass} mt-7 scroll-mt-24 p-5 sm:p-6`;
const twoColumnLayoutClass = "grid gap-5 xl:grid-cols-2";
const compactGridClass = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
const inputClass =
  "rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const primaryButtonClass =
  "rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600";
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
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">{eyebrow}</p>
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
    teal: "border-violet-200 bg-violet-50 text-violet-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    green: "border-violet-200 bg-violet-50 text-violet-700",
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
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-violet-500" : "bg-slate-300"}`} />
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
    teal: "border-violet-200 bg-violet-50/70",
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

const overviewCardClass = "rounded-[22px] border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(88,75,135,0.055)]";
const overviewAccentTextClass = "text-violet-700";
const overviewAccentBgClass = "bg-violet-50 text-violet-700";

function OverviewMetricCard({
  label,
  value,
  detail,
  href,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  href: string;
  icon: SidebarIconName;
}) {
  return (
    <a href={href} className={`${overviewCardClass} group min-w-0 p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(88,75,135,0.1)]`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${overviewAccentBgClass}`}>
          <SidebarIcon name={icon} className="h-4 w-4" />
        </span>
        <span className="text-base text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-400">›</span>
      </div>
      <p className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 truncate text-xs text-slate-400">{detail}</p>
    </a>
  );
}

function OverviewProgressCard({
  progress,
  plannedContentCount,
  draftCount,
  approvalQueueCount,
  readyToScheduleCount,
  integrationTaskCount,
  draftsHref,
}: {
  progress: number;
  plannedContentCount: number;
  draftCount: number;
  approvalQueueCount: number;
  readyToScheduleCount: number;
  integrationTaskCount: number;
  draftsHref: string;
}) {
  const steps = [
    { label: "План", active: plannedContentCount > 0 },
    { label: "Тексты", active: draftCount > 0 },
    { label: "Проверка", active: approvalQueueCount > 0 || draftCount > 0 },
    { label: "Готово", active: readyToScheduleCount > 0 },
  ];

  return (
    <article className={`${overviewCardClass} p-4 lg:col-span-7 xl:col-span-7`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Состояние работы на месяц</h2>
          <p className="mt-1 text-xs text-slate-400">Готовность производства за текущий цикл.</p>
        </div>
        {integrationTaskCount > 0 ? (
          <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">Проверьте доступы</span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">Система готова</span>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[128px_minmax(0,1fr)] md:items-center">
        <div className="relative flex h-28 w-28 items-center justify-center justify-self-center rounded-full bg-violet-50">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(#7c3aed ${Math.max(progress, 2)}%, #ede9fe 0)`,
            }}
          />
          <div className="relative flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-2xl font-semibold tracking-tight text-slate-950">{progress}%</span>
            <span className="text-[11px] font-semibold text-slate-400">готовность</span>
          </div>
        </div>
        <div>
          <div className="grid grid-cols-4 gap-2">
            {steps.map((step) => (
              <div key={step.label} className={`rounded-2xl border px-2 py-2 text-center ${step.active ? "border-violet-200 bg-violet-50 text-violet-800" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                <p className="text-xs font-semibold">{step.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-600" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{plannedContentCount} материалов · {draftCount} текстов</p>
            <a href={draftsHref} className="rounded-full bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700">Открыть материалы</a>
          </div>
        </div>
      </div>
    </article>
  );
}

function OverviewClientCard({
  clientName,
  industry,
  confidenceScore,
  plannedContentCount,
  brandProfileReady,
  brandAssetsCount,
  clientHref,
  blueprintHref,
}: {
  clientName: string;
  industry: string;
  confidenceScore: number | null;
  plannedContentCount: number;
  brandProfileReady: boolean;
  brandAssetsCount: number;
  clientHref: string;
  blueprintHref: string;
}) {
  return (
    <article className={`${overviewCardClass} p-4 lg:col-span-5 xl:col-span-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">Клиент в работе</p>
          <h2 className="mt-2 truncate text-xl font-semibold text-slate-950">{clientName}</h2>
          <p className="mt-1 text-xs text-slate-400">{industry}</p>
        </div>
        <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">Клиент выбран</span>
      </div>
      <div className="mt-4 grid gap-2 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-400">Blueprint confidence</span>
          <span className="font-semibold text-slate-950">{confidenceScore ?? 0}%</span>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-400">Материалы в плане</span>
          <span className="font-semibold text-slate-950">{plannedContentCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Бренд</span>
          <span className="font-semibold text-slate-950">{brandProfileReady ? "готов" : `${brandAssetsCount} файлов`}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={clientHref} className="rounded-full bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700">Открыть клиента</a>
        <a href={blueprintHref} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700">Открыть Blueprint</a>
      </div>
    </article>
  );
}

function OverviewSmallCard({
  title,
  value,
  copy,
  href,
  action,
}: {
  title: string;
  value: React.ReactNode;
  copy: string;
  href: string;
  action: string;
}) {
  return (
    <article className={`${overviewCardClass} p-4 lg:col-span-4 xl:col-span-4`}>
      <p className="text-xs font-semibold text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-4 text-slate-500">{copy}</p>
      <a href={href} className={`mt-4 inline-flex text-xs font-semibold ${overviewAccentTextClass} transition hover:text-violet-900`}>{action}</a>
    </article>
  );
}

function OverviewDashboard({
  currentMonthLabel,
  workspaceLinks,
  latestBlueprint,
  needsManagerReviewCount,
  waitingForClientCount,
  approvedDraftCount,
  readyToScheduleCount,
  approvalQueueCount,
  integrationTaskCount,
  plannedContentCount,
  draftCount,
  productionProgress,
  missingTextCount,
  missingVisualCount,
  brandProfileReady,
  brandAssetsCount,
  generationJobs,
  month,
  calendarItems,
}: {
  currentMonthLabel: string;
  workspaceLinks: Record<WorkspaceView, string>;
  latestBlueprint: {
    confidenceScore: number;
    nextRecommendedAction: string;
    client: { name: string; industry: string | null };
  } | null;
  needsManagerReviewCount: number;
  waitingForClientCount: number;
  approvedDraftCount: number;
  readyToScheduleCount: number;
  approvalQueueCount: number;
  integrationTaskCount: number;
  plannedContentCount: number;
  draftCount: number;
  productionProgress: number;
  missingTextCount: number;
  missingVisualCount: number;
  brandProfileReady: boolean;
  brandAssetsCount: number;
  generationJobs: GenerationJobPreview[];
  month?: string;
  calendarItems: OverviewCalendarItem[];
}) {
  const clientName = latestBlueprint?.client.name ?? "Клиент";
  const attentionItems = [
    { label: "На проверке", count: needsManagerReviewCount, href: workspaceLinks.drafts },
    { label: "Правки клиента", count: waitingForClientCount, href: workspaceLinks.approvals },
    { label: "Заблокировано", count: integrationTaskCount, href: workspaceLinks.calendar },
    { label: "Нужны визуалы", count: missingVisualCount, href: workspaceLinks.drafts },
    { label: "Без текста", count: missingTextCount, href: workspaceLinks.drafts },
  ];
  const recentItems = [
    ...generationJobs.slice(0, 3).map((job) => ({
      title: formatGenerationJobType(job.jobType),
      meta: `${clientName} · ${formatGenerationJobStatus(job.status)}`,
      time: job.createdAt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
    })),
  ].slice(0, 3);

  return (
    <section id="overview" className="min-h-[calc(100vh-132px)] rounded-[28px] bg-[#f7f5fb] p-4 text-slate-900 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Обзор</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm">
              <SidebarIcon name="client" className="h-3.5 w-3.5 text-violet-700" />
              Клиент: {clientName}
            </span>
            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
              {currentMonthLabel}
            </span>
            <span className="text-sm text-slate-400">Adaptive Presence OS</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden min-w-72 items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 shadow-sm md:flex">
            Поиск по клиентам, материалам, событиям
          </div>
          <ConnectionBadge label="OpenAI" active />
          <ConnectionBadge label="Neon" active />
          <ConnectionBadge label="Онлайн" active />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
            <SidebarIcon name="profile" className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      <div className="mt-4">
        <OverviewAttention items={attentionItems} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric label="Материалов" value={plannedContentCount} detail="В месячном плане" href={workspaceLinks.drafts} icon={<SidebarIcon name="calendar" className="h-4 w-4" />} index={0} />
        <OverviewMetric label="Готово в пакет" value={readyToScheduleCount} detail={`${productionProgress}% готовности`} href={workspaceLinks.reports} icon={<SidebarIcon name="check" className="h-4 w-4" />} progress={productionProgress} index={1} />
        <OverviewMetric label="На проверке" value={needsManagerReviewCount} detail="Внутренняя очередь" href={workspaceLinks.drafts} icon={<SidebarIcon name="review" className="h-4 w-4" />} tone={needsManagerReviewCount > 0 ? "amber" : "neutral"} index={2} />
        <OverviewMetric label="Правки клиента" value={waitingForClientCount} detail="Нужно ответить" href={workspaceLinks.approvals} icon={<SidebarIcon name="client" className="h-4 w-4" />} tone={waitingForClientCount > 0 ? "amber" : "neutral"} index={3} />
      </div>

      <div className="mt-3 grid items-start gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <OverviewMiniCalendar month={month} items={calendarItems} calendarHref={workspaceLinks.calendar} />
        </div>
        <div className="grid content-start gap-3 lg:col-span-4">
          <OverviewClientCard
            clientName={latestBlueprint?.client.name ?? "Клиент не выбран"}
            industry={latestBlueprint?.client.industry ?? "Создайте клиента и Blueprint"}
            confidenceScore={latestBlueprint?.confidenceScore ?? null}
            plannedContentCount={plannedContentCount}
            brandProfileReady={brandProfileReady}
            brandAssetsCount={brandAssetsCount}
            clientHref={workspaceLinks.client_setup}
            blueprintHref={workspaceLinks.client_setup}
          />
          <article className={`${overviewCardClass} ap-rise p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-400">Активность</p>
              <a href={workspaceLinks.reports} className="text-xs font-semibold text-violet-700">Отчёт</a>
            </div>
            <div className="mt-3 grid gap-2">
              {recentItems.map((item) => (
                <div key={`${item.title}-${item.time}`} className="flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{item.title}</p>
                    <p className="truncate text-[11px] text-slate-400">{item.meta}</p>
                  </div>
                  <span className="text-[11px] text-slate-400">{item.time}</span>
                </div>
              ))}
              {recentItems.length === 0 ? <p className="text-xs leading-5 text-slate-400">Пока нет недавних событий.</p> : null}
            </div>
          </article>
        </div>
      </div>
    </section>
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

function groupCalendarItems<T extends CalendarPreviewItem>(items: T[]) {
  const groups = new Map<string, T[]>();

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
    sent_to_client: "В работе",
    client_changes_requested: "Запрошены правки",
    approved: "Готово в пакет",
    rejected: "Отклонено",
    ready_to_schedule: "Готово в пакет",
    created: "Создано",
    submitted_for_review: "Отправлено на проверку",
    changes_requested: "Запрошены правки",
    marked_ready_to_schedule: "Готово в пакет",
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
    brief_ready: "ТЗ собрано",
    in_production: "В работе",
    visual: "Визуал",
    video: "Видео",
    carousel: "Карусель",
    carousel_slide: "Карточка карусели",
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
    sent_to_client: "В работе",
    client_changes_requested: "Запрошены правки",
    approved: "Готово в пакет",
    rejected: "Отклонено",
    ready_to_schedule: "Готово в пакет",
  };

  return labels[status] ?? formatStatus(status);
}

function formatMaterialTextStatus(draft?: { status: string } | null) {
  if (!draft) return "Текст не создан";

  const labels: Record<string, string> = {
    draft: "Текст готов",
    needs_review: "На проверке",
    sent_to_client: "Есть правки",
    client_changes_requested: "Запрошены правки",
    approved: "Готово в пакет",
    rejected: "Отклонён",
    ready_to_schedule: "Готово в пакет",
  };

  return labels[draft.status] ?? formatDraftStatus(draft.status);
}

function materialTextStatusTone(draft?: { status: string } | null): "neutral" | "teal" | "amber" | "rose" | "green" {
  if (!draft) return "neutral";
  if (draft.status === "draft") return "teal";
  return draftStatusTone(draft.status);
}

function appendSearchParam(href: string, key: string, value: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${key}=${encodeURIComponent(value)}`;
}

function materialWorkspaceHref(draftsHref: string, itemId: string) {
  return appendSearchParam(draftsHref, "materialId", itemId);
}

function parseExactDate(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day ? date : null;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addCalendarDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addCalendarMonths(date: Date, amount: number) {
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const targetMonthLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    Math.min(date.getDate(), targetMonthLastDay),
  );
}

function shiftCalendarDate(date: Date, viewMode: string, direction: -1 | 1) {
  if (viewMode === "month") return addCalendarMonths(date, direction);
  if (viewMode === "week") return addCalendarDays(date, direction * 7);
  if (viewMode === "threeDays") return addCalendarDays(date, direction * 3);
  return addCalendarDays(date, direction);
}

function shortPlatformName(platform: string) {
  const normalized = platform.toLowerCase();
  if (normalized.includes("telegram") || normalized.includes("телег")) return "TG";
  if (normalized.includes("vk") || normalized.includes("вк")) return "VK";
  if (normalized.includes("дзен") || normalized.includes("zen")) return "Дзен";
  if (normalized.includes("email") || normalized.includes("почт")) return "Email";
  if (normalized.includes("ozon")) return "Ozon";
  if (normalized.includes("wildberries") || normalized.includes("wb")) return "WB";
  if (normalized.includes("статья") || normalized.includes("article") || normalized.includes("blog") || normalized.includes("сайт")) return "Article";
  return platform.slice(0, 8);
}

function materialNextActionLabel(item: { contentDraft: { status: string } | null }, publication?: { status: string; creativeAssets: Array<{ generatedVariants: GeneratedCreativeVariantPreview[] }> }) {
  const assets = publication?.creativeAssets ?? [];
  const draftStatus = item.contentDraft?.status;

  if (!item.contentDraft) return "Нужен текст";
  if (draftStatus === "client_changes_requested") return "Есть правки";
  if (draftStatus === "sent_to_client") return "На проверке";
  if (draftStatus === "approved") return "Готово в пакет";
  if (draftStatus === "ready_to_schedule" || publication?.status === "ready") return "В пакете";
  if (assets.length === 0) return "Нужно ТЗ";
  if (!assets.every(assetHasVisual)) return assets.length > 1 ? `Визуалы: ${assets.filter(assetHasVisual).length}/${assets.length}` : "Нужен визуал";
  if (draftStatus === "draft" || draftStatus === "needs_review") return "На проверке";
  return "Готово";
}

function assetHasVisual(asset: { generatedVariants: GeneratedCreativeVariantPreview[] }) {
  return asset.generatedVariants.length > 0;
}

type VisualAssetBase = {
  assetType?: string;
  title?: string;
  brief?: string;
  formatRequirements?: string | null;
  textOnAsset?: string | null;
  notes?: string | null;
  generatedVariants: GeneratedCreativeVariantPreview[];
};

function isLegacyCombinedCarouselAssetPreview(asset: { notes?: string | null }) {
  return Boolean(asset.notes?.includes("legacyCombinedCarouselAsset=true"));
}

function creativeAssetLooksLikeCarousel(
  asset: {
    assetType?: string;
    title?: string;
    brief?: string;
    formatRequirements?: string | null;
    textOnAsset?: string | null;
    notes?: string | null;
  },
  item?: { format?: string; topic?: string } | null,
) {
  if (asset.assetType === "carousel_slide" || isLegacyCombinedCarouselAssetPreview(asset)) return false;

  const text = [
    asset.assetType,
    asset.title,
    asset.brief,
    asset.formatRequirements,
    asset.textOnAsset,
    asset.notes,
    item?.format,
    item?.topic,
  ].filter(Boolean).join(" ").toLowerCase();

  return /(карус|carousel|multi[- ]?slide|карточ|слайд|серия карточек)/i.test(text);
}

function visualAssetsForMaterial<T extends VisualAssetBase>(
  item: { creativeAssets: T[] },
  publication?: { creativeAssets: T[] },
): T[] {
  const assets = publication?.creativeAssets.length ? publication.creativeAssets : item.creativeAssets;
  const slideAssets = assets.filter((asset) => asset.assetType === "carousel_slide");

  if (slideAssets.length > 0) return slideAssets;

  return assets.filter((asset) => !isLegacyCombinedCarouselAssetPreview(asset));
}

function visualProgressLabel(assets: Array<{ generatedVariants: GeneratedCreativeVariantPreview[] }>, fallbackVisuals: GeneratedCreativeVariantPreview[]) {
  if (assets.length > 1) {
    return `Визуалы: ${assets.filter(assetHasVisual).length}/${assets.length}`;
  }
  if (assets.length === 1) {
    return assetHasVisual(assets[0]) ? "Визуал готов" : "Нужен визуал";
  }
  return fallbackVisuals.length > 0 ? "Визуал готов" : "Нужен визуал";
}

function materialVisualComplete(
  item: { creativeAssets: Array<{ generatedVariants: GeneratedCreativeVariantPreview[] }>; generatedCreativeVariants: GeneratedCreativeVariantPreview[] },
  publication?: { creativeAssets: Array<{ generatedVariants: GeneratedCreativeVariantPreview[] }> },
) {
  const assets = visualAssetsForMaterial(item, publication);
  if (assets.length > 0) return assets.every(assetHasVisual);

  return item.generatedCreativeVariants.length > 0;
}

function nextActionBadgeClass(label: string) {
  if (["Согласовано", "Готово", "Готово в пакет", "В месячном пакете", "В пакете"].includes(label)) return "bg-violet-50 text-violet-700";
  if (["Нужен текст", "Нужно ТЗ", "Нужен визуал", "На проверке", "Проверить", "Есть правки"].includes(label)) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
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
    approved: "Готово в пакет",
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
  plannedContentItemId: string;
  platformName: string;
  format: string;
  topic: string;
  draftTitle: string;
  draftBody: string;
  updatedAt: Date;
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
  publishStatus: string | null;
  publishedAt: Date | null;
  externalUrl: string | null;
  metrics: Array<{
    likes: number | null;
    comments: number | null;
    shares: number | null;
    reach: number | null;
    views: number | null;
    saves: number | null;
    clicks: number | null;
  }>;
  contentDraft: {
    draftTitle: string;
  };
	  creativeAssets: Array<{
	    id: string;
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
  status: string;
  approvalRequired: boolean;
  campaignTheme: string | null;
  contentPillar: string | null;
  channelRole: string | null;
  sequenceReason: string | null;
  contentDraft: DraftQueueItem | null;
  creativeAssets: Array<{
    id: string;
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
    generatedVariants: GeneratedCreativeVariantPreview[];
  }>;
  generatedCreativeVariants: GeneratedCreativeVariantPreview[];
};

type MonthlyPlanRevisionProposalPreview = {
  id: string;
  instruction: string;
  summary: string;
  status: string;
  proposedChanges: unknown;
  createdAt: Date;
};

type RevisionChangeSet = {
  removeItems: Array<{ plannedContentItemId: string; reason: string }>;
  updateItems: Array<{ plannedContentItemId: string; platform: string; format: string; topic: string; angle: string; reason: string }>;
  addItems: Array<{ platform: string; format: string; topic: string; angle: string; week: number; reason: string }>;
  protectedItems: Array<{ plannedContentItemId: string; reason: string }>;
};

function revisionChangeSet(value: unknown): RevisionChangeSet {
  const object = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

  return {
    removeItems: Array.isArray(object.removeItems) ? object.removeItems as RevisionChangeSet["removeItems"] : [],
    updateItems: Array.isArray(object.updateItems) ? object.updateItems as RevisionChangeSet["updateItems"] : [],
    addItems: Array.isArray(object.addItems) ? object.addItems as RevisionChangeSet["addItems"] : [],
    protectedItems: Array.isArray(object.protectedItems) ? object.protectedItems as RevisionChangeSet["protectedItems"] : [],
  };
}

type GeneratedCreativeVariantPreview = {
  id: string;
  variantTitle: string;
  imageUrl: string | null;
  storageProvider: string;
  fileSize: number | null;
  mimeType: string;
  status: string;
  qualityStatus: string;
  createdAt: Date;
};

const generatedCreativeVariantPreviewSelect = {
  id: true,
  imageUrl: true,
  mimeType: true,
  storageProvider: true,
  fileSize: true,
  status: true,
  qualityStatus: true,
  variantTitle: true,
  createdAt: true,
} as const;

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

type MonthProductionTaskPreview = {
  id: string;
  plannedContentItemId: string | null;
  creativeAssetId: string | null;
  stage: string;
  taskType: string;
  status: string;
  title: string;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

type MonthProductionRunPreview = {
  id: string;
  status: string;
  currentStage: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  tasks: MonthProductionTaskPreview[];
};

type MonthProductionPlanState = {
  id?: string;
  blueprintId?: string;
  clientId?: string;
  totalPlannedUnits?: number;
  plannedItemsCount?: number;
  clientName?: string;
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

function formatProductionStage(stage: string) {
  const labels: Record<string, string> = {
    planning: "План",
    dates: "Даты",
    texts: "Тексты",
    briefs: "ТЗ",
    visuals: "Визуалы",
    quality_check: "AI-проверка",
    done: "Готово",
  };
  return labels[stage] ?? formatStatus(stage);
}

function formatProductionTaskType(taskType: string) {
  const labels: Record<string, string> = {
    generate_text: "Текст",
    generate_brief: "ТЗ",
    generate_visual: "Визуал",
    quality_check: "AI-проверка",
  };
  return labels[taskType] ?? formatStatus(taskType);
}

function formatSlideVisualTaskStatus(asset: { generatedVariants: GeneratedCreativeVariantPreview[] }, task?: MonthProductionTaskPreview) {
  if (asset.generatedVariants.length > 0) return "Готово";
  if (task?.status === "running") return "Генерируется";
  if (task?.status === "queued") return "В очереди";
  if (task?.status === "failed") return "Ошибка";
  return "Ждёт очереди";
}

function slideVisualTaskTone(asset: { generatedVariants: GeneratedCreativeVariantPreview[] }, task?: MonthProductionTaskPreview): "neutral" | "teal" | "amber" | "rose" | "green" {
  if (asset.generatedVariants.length > 0) return "green";
  if (task?.status === "running") return "teal";
  if (task?.status === "queued") return "amber";
  if (task?.status === "failed") return "rose";
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
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">AI production</p>
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

function productionRunState(run?: MonthProductionRunPreview) {
  if (!run) return "plan_created";
  if (run.status === "completed") return "production_completed";
  if (run.status === "paused") return "production_paused";
  if (run.failedTasks > 0 && run.completedTasks + run.failedTasks >= run.totalTasks) return "production_failed";
  if (run.status === "completed_with_errors") return "production_failed";
  if (run.status === "running" || run.status === "queued") return "production_running";
  return "production_partial";
}

function productionStateLabel(state: string) {
  const labels: Record<string, string> = {
    plan_created: "План создан",
    production_running: "Подготовка идёт",
    production_paused: "Подготовка остановлена",
    production_failed: "Есть ошибки",
    production_partial: "Можно продолжить",
    production_completed: "Готово к проверке",
  };

  return labels[state] ?? "Проверить состояние";
}

function MonthProductionRunPanel({ run, plan }: { run?: MonthProductionRunPreview; plan?: MonthProductionPlanState }) {
  const state = productionRunState(run);
  const plannedItemsCount = plan?.plannedItemsCount ?? 0;
  const expectedUnits = plan?.totalPlannedUnits ?? plannedItemsCount;
  const hasPlan = Boolean(plan?.id || plan?.blueprintId);
  const isTestClient = Boolean(plan?.clientName && /\btest\b|· test/i.test(plan.clientName));

  if (!run) {
    return (
      <section className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Подготовка месяца</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">{plan?.id ? "Месячный план найден" : "План ещё не создан"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {hasPlan
                ? `Материалов в плане: ${plannedItemsCount}. Запустите подготовку, чтобы поставить недостающие тексты, ТЗ и визуалы в очередь.`
                : "Нажмите «Подготовить месяц», чтобы создать план и очередь производства."}
            </p>
          </div>
          <StatusBadge tone="neutral">{plan?.id ? "plan_created" : "no_plan"}</StatusBadge>
        </div>
        {expectedUnits > plannedItemsCount ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            План содержит {plannedItemsCount} материалов из ожидаемых {expectedUnits}. Проверьте scope или пересоберите месяц.
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Материалов в плане: {plannedItemsCount}.</p>
        )}
        {hasPlan ? (
          <form action={prepareOrContinueMonthProduction} className="mt-4">
            {plan?.id ? <input type="hidden" name="monthlyPlanId" value={plan.id} /> : null}
            {plan?.blueprintId ? <input type="hidden" name="blueprintId" value={plan.blueprintId} /> : null}
            {plan?.clientId ? <input type="hidden" name="clientId" value={plan.clientId} /> : null}
            <PendingSubmitButton pendingLabel="Запускаем..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300">
              {plan?.id ? "Начать подготовку" : "Подготовить месяц"}
            </PendingSubmitButton>
          </form>
        ) : null}
      </section>
    );
  }

  const progress = run.totalTasks > 0 ? Math.round(((run.completedTasks + run.failedTasks) / run.totalTasks) * 100) : 0;
  const runningTask = run.tasks.find((task) => task.status === "running");
  const nextTask = runningTask ?? run.tasks.find((task) => task.status === "queued");
  const textTasks = run.tasks.filter((task) => task.taskType === "generate_text");
  const briefTasks = run.tasks.filter((task) => task.taskType === "generate_brief");
  const visualTasks = run.tasks.filter((task) => task.taskType === "generate_visual");
  const failedTasks = run.tasks.filter((task) => task.status === "failed");
  const hasQueuedTasks = run.tasks.some((task) => task.status === "queued");
  const autoRunning = ["queued", "running"].includes(run.status) && hasQueuedTasks && run.completedTasks + run.failedTasks < run.totalTasks;
  const canResume = run.status === "paused" && hasQueuedTasks;
  const stageCounts = (tasks: MonthProductionTaskPreview[]) => `${tasks.filter((task) => task.status === "completed").length}/${tasks.length}`;
  const stateTone = run.status === "completed"
    ? "green"
    : run.status === "paused" || run.failedTasks > 0
      ? "rose"
      : autoRunning
        ? "teal"
        : "neutral";

  return (
    <section className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Производство месяца</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Подготовка месяца · {progress}%</h3>
          <p className="mt-1 text-sm text-slate-500">
            Готовые материалы уже доступны. Если закрыть страницу, подготовка продолжится после возвращения.
          </p>
        </div>
        <StatusBadge tone={stateTone}>
          {productionStateLabel(state)}
        </StatusBadge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-950">План:</span> готов
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-950">Даты:</span> готово
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <MetricCard label="Тексты" value={stageCounts(textTasks)} detail="готово" />
        <MetricCard label="ТЗ" value={stageCounts(briefTasks)} detail="готово" />
        <MetricCard label="Визуалы" value={stageCounts(visualTasks)} detail="готово" />
        <MetricCard label="Ошибки" value={run.failedTasks} detail="повторяемо" tone={run.failedTasks > 0 ? "amber" : "teal"} />
      </div>
      {expectedUnits > plannedItemsCount ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          План содержит {plannedItemsCount} материалов из ожидаемых {expectedUnits}. Проверьте scope или пересоберите месяц.
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">План содержит {plannedItemsCount} материалов.</p>
      )}
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
        {nextTask ? (
          <p>Сейчас создаётся: <span className="font-semibold text-slate-950">{formatProductionTaskType(nextTask.taskType)}</span> · {nextTask.title}</p>
        ) : (
          <p>{run.failedTasks > 0 ? "Производство завершено с ошибками. Ошибки можно повторить." : "Месяц подготовлен."}</p>
        )}
        <p className="mt-1 text-xs font-semibold text-slate-400">Стадия: {formatProductionStage(run.currentStage)} · {run.completedTasks}/{run.totalTasks} задач готово</p>
      </div>
      <MonthProductionAutoRunner
        productionRunId={run.id}
        enabled={autoRunning}
        hasQueuedTasks={hasQueuedTasks}
        status={run.status}
        currentStage={run.currentStage}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {autoRunning ? (
          <button disabled className="rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
            Подготовка идёт...
          </button>
        ) : null}
        {canResume ? (
          <form action={processNextMonthProductionTasks}>
            <input type="hidden" name="productionRunId" value={run.id} />
            <PendingSubmitButton pendingLabel="Продолжаем..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
              Возобновить после остановки
            </PendingSubmitButton>
          </form>
        ) : null}
        {failedTasks.length > 0 ? (
          <form action={retryFailedProductionTasks}>
            <input type="hidden" name="productionRunId" value={run.id} />
            <PendingSubmitButton pendingLabel="Возвращаем ошибки..." className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100">
              Повторить ошибки
            </PendingSubmitButton>
          </form>
        ) : null}
        {isTestClient && plan?.id ? (
          <details className="rounded-full border border-rose-100 bg-white px-4 py-2 text-sm font-semibold text-rose-700">
            <summary className="cursor-pointer">Очистить тестовый месяц</summary>
            <form action={resetTestMonthProduction} className="absolute z-10 mt-3 grid w-[min(92vw,440px)] gap-3 rounded-2xl border border-rose-100 bg-white p-4 text-left text-sm shadow-[0_18px_50px_rgba(88,75,135,0.16)]">
              <input type="hidden" name="monthlyPlanId" value={plan.id} />
              <p className="font-semibold text-slate-950">Очистить и пересобрать тестовый месяц?</p>
              <p className="text-slate-500">Это удалит текущий тестовый месячный план и его production-данные, но не затронет оригинального клиента.</p>
              <PendingSubmitButton pendingLabel="Пересобираем..." className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700">
                Очистить и пересобрать
              </PendingSubmitButton>
            </form>
          </details>
        ) : null}
      </div>
    </section>
  );
}

const draftStatusGroups = [
  { status: "client_changes_requested", label: "Правки клиента" },
  { status: "needs_review", label: "На внутренней проверке" },
  { status: "draft", label: "Тексты готовы" },
  { status: "approved", label: "Готово в пакет" },
  { status: "ready_to_schedule", label: "В месячном пакете" },
  { status: "rejected", label: "Отклонено" },
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
          className="min-w-44 flex-1 rounded-md border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
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
        <StatusBadge tone="green">Готово в пакет</StatusBadge>
        <a href={calendarHref} className="text-xs font-bold text-violet-700 transition hover:text-violet-900">
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
            label="Оставить в правках"
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
            label="Готово в пакет"
            pendingLabel="Согласовываем..."
            returnView={returnView}
            tone="primary"
          />
        ) : null}
        {draft.status === "approved" ? (
          <DraftWorkflowForm
            action={markDraftReadyToSchedule}
            contentDraftId={draft.id}
            label="Готово в пакет"
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
        История правок ({events.length})
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
          <p className="text-xs text-stone-400">История правок пока пуста.</p>
        )}
      </div>
    </details>
  );
}

type ClientRevisionItem = {
  id: string;
  status: "new" | "in_progress" | "fixed" | "closed";
  statusLabel: string;
  draft: DraftQueueItem;
  materialId: string;
  platformName: string;
  format: string;
  topic: string;
  comment: string;
  createdAt: Date;
  event?: DraftReviewEventPreview;
};

function clientRevisionStatus(draft: DraftQueueItem): ClientRevisionItem["status"] {
  if (draft.status === "client_changes_requested") return "new";
  if (draft.status === "needs_review" || draft.status === "draft" || draft.status === "sent_to_client") return "in_progress";
  if (draft.status === "approved" || draft.status === "ready_to_schedule") return "fixed";
  return "closed";
}

function clientRevisionStatusLabel(status: ClientRevisionItem["status"]) {
  const labels: Record<ClientRevisionItem["status"], string> = {
    new: "Новый",
    in_progress: "В работе",
    fixed: "Исправлено",
    closed: "Закрыто",
  };

  return labels[status];
}

function clientRevisionTone(status: ClientRevisionItem["status"]): "neutral" | "teal" | "amber" | "rose" | "green" {
  if (status === "new") return "amber";
  if (status === "in_progress") return "teal";
  if (status === "fixed") return "green";
  return "neutral";
}

function buildClientRevisions(items: MaterialPlannedItem[]): ClientRevisionItem[] {
  return items.flatMap((item) => {
    const draft = item.contentDraft;
    if (!draft) return [];

    const clientEvents = draft.reviewEvents.filter(
      (event) =>
        event.actorType === "client" ||
        (event.action === "changes_requested" && Boolean(event.comment)),
    );
    const latestClientEvent = clientEvents.at(-1);

    if (!latestClientEvent && draft.status !== "client_changes_requested") return [];

    const status = clientRevisionStatus(draft);

    return [{
      id: latestClientEvent?.id ?? draft.id,
      status,
      statusLabel: clientRevisionStatusLabel(status),
      draft,
      materialId: item.id,
      platformName: item.platformName,
      format: item.format,
      topic: item.topic,
      comment: latestClientEvent?.comment || "Клиент запросил правки по материалу.",
      createdAt: latestClientEvent?.createdAt ?? new Date(),
      event: latestClientEvent,
    }];
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function ReviewQueue({ revisions, draftsHref }: { revisions: ClientRevisionItem[]; draftsHref: string }) {
  const openRevisionCount = revisions.filter((revision) => revision.status === "new" || revision.status === "in_progress").length;

  return (
    <section id="review-queue" className={sectionClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Комментарии клиента</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Правки</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Входящие комментарии и запросы клиента по месячному пакету. Обычная внутренняя подготовка материалов остаётся в Production Studio.
          </p>
        </div>
        <StatusBadge tone={openRevisionCount > 0 ? "amber" : "green"}>{openRevisionCount} открытых</StatusBadge>
      </div>

      {revisions.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {revisions.map((revision) => (
            <article key={revision.id} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.05)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={clientRevisionTone(revision.status)}>{revision.statusLabel}</StatusBadge>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{revision.platformName}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{revision.format}</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-slate-950">{revision.topic}</h3>
                  <p className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                    {revision.comment}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {revision.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                    {revision.event ? ` · ${formatReviewAction(revision.event.action)}` : ""}
                  </p>
                </div>
                <a href={materialWorkspaceHref(draftsHref, revision.materialId)} className="inline-flex justify-center rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
                  Открыть материал
                </a>
              </div>
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <form action={addDraftManagerComment} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="contentDraftId" value={revision.draft.id} />
                  <input type="text" name="comment" className={`${inputClass} flex-1`} placeholder="Ответ менеджера по правке" />
                  <PendingSubmitButton pendingLabel="Сохраняем..." className={secondaryButtonClass}>Ответить</PendingSubmitButton>
                </form>
                {revision.status === "new" || revision.status === "in_progress" ? (
                  <form action={submitDraftForReview}>
                    <input type="hidden" name="contentDraftId" value={revision.draft.id} />
                    <PendingSubmitButton pendingLabel="Обновляем..." className={secondaryButtonClass}>Отметить исправленным</PendingSubmitButton>
                  </form>
                ) : null}
              </div>
              <div className="mt-3">
                <ReviewEventTimeline events={revision.draft.reviewEvents} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState>Новых правок нет.</EmptyState>
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
    teal: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
    amber: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
    rose: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
    green: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
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
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Внутреннее планирование</p>
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
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-violet-700">{draft.platformName} &middot; {draft.format}</p>
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
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-violet-700">{publication.platformName} &middot; {publication.format}</p>
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
                  <a href={draftsHref} className="text-xs font-bold text-violet-800 transition hover:text-violet-950">
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
                      <a href={assetsHref} className="inline-flex items-center text-xs font-bold text-violet-800 transition hover:text-violet-950">
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
                  <a href={assetsHref} className="inline-flex items-center text-xs font-bold text-violet-800 transition hover:text-violet-950">
                    Открыть ТЗ и визуалы
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
  "carousel_slide",
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
        className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 disabled:cursor-wait disabled:opacity-60"
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
    teal: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
    amber: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
    rose: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
    green: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
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

function GeneratedVisualImage({
  variant,
  alt,
  className,
}: {
  variant: GeneratedCreativeVariantPreview;
  alt: string;
  className: string;
}) {
  const imageSrc = getGeneratedVariantImageSrc(variant);

  return imageSrc ? (
    <img src={imageSrc} alt={alt} className={className} />
  ) : variant.storageProvider !== "vercel_blob" ? (
    <div className={`flex items-center justify-center bg-amber-50 px-4 text-center text-xs font-semibold leading-5 text-amber-900 ${className}`}>
      Старый визуал хранится в базе. Откройте полную карточку или сгенерируйте новый вариант.
    </div>
  ) : (
    <div className={`flex items-center justify-center bg-stone-100 px-4 text-center text-xs font-semibold text-stone-400 ${className}`}>
      Изображение недоступно.
    </div>
  );
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
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Производство визуалов</p>
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
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-violet-700">{publication.platformName} &middot; {publication.format}</p>
                    <h4 className="mt-2 font-semibold leading-6 text-stone-950">{publication.topic}</h4>
                    <p className="mt-1 text-xs leading-5 text-stone-500">Текст публикации: {publication.contentDraft.draftTitle}</p>
                  </div>
                  <StatusBadge tone="amber">
                    {publication.scheduledDate}{publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}
                  </StatusBadge>
                </div>
                <div className="mt-4 rounded-lg border border-violet-300 bg-violet-50 p-4 shadow-[0_4px_12px_rgba(13,148,136,0.08)]">
                  <p className="text-sm font-semibold text-violet-950">Нет ТЗ на креатив</p>
                  <p className="mt-2 text-sm leading-6 text-violet-800">
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
                      <input type="checkbox" name="approvalRequired" className="h-4 w-4 rounded border-stone-300 accent-violet-700" />
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
                <div className="mt-3 rounded-md border border-violet-200 bg-violet-50/70 p-3">
                  <p className="text-xs font-bold text-violet-950">Обновить ТЗ через AI</p>
                  <p className="mt-1 text-xs leading-5 text-violet-800">
                    AI пересоберёт ТЗ по текущему тексту, площадке и публикации. Старое ТЗ будет заменено.
                  </p>
                  <form action={regenerateCreativeAssetBrief} className="mt-3">
                    <input type="hidden" name="creativeAssetId" value={asset.id} />
                    <PendingSubmitButton pendingLabel="Перегенерируем..." className={secondaryButtonClass}>
                      Перегенерировать ТЗ через AI
                    </PendingSubmitButton>
                  </form>
                </div>
                {creativeAssetLooksLikeCarousel(asset, asset.scheduledPublication) ? (
                  <div className="mt-3 rounded-md border border-violet-200 bg-white p-3">
                    <p className="text-xs font-bold text-violet-950">Это нужно собрать как отдельные карточки</p>
                    <p className="mt-1 text-xs leading-5 text-violet-800">
                      Старый общий визуал останется в истории, а система создаст отдельные ТЗ для каждой карточки карусели.
                    </p>
                    <form action={rebuildCreativeAssetAsCarousel} className="mt-3">
                      <input type="hidden" name="creativeAssetId" value={asset.id} />
                      <input type="hidden" name="returnView" value="assets" />
                      <PendingSubmitButton pendingLabel="Пересобираем..." className={primaryButtonClass}>
                        Пересобрать как карусель
                      </PendingSubmitButton>
                    </form>
                  </div>
                ) : null}
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
                      <p className="mt-1 text-xs leading-5 text-violet-700">
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
                          <GeneratedVisualImage
                            variant={variant}
                            alt={variant.variantTitle}
                            className="aspect-square max-h-80 w-full bg-stone-100 object-contain"
                          />
                          <div className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge tone={creativeVariantTone(variant.status)}>{formatStatus(variant.status)}</StatusBadge>
                              <StatusBadge tone={creativeVariantQualityTone(variant.qualityStatus)}>{formatStatus(variant.qualityStatus)}</StatusBadge>
                              <StatusBadge>{formatGeneratedVisualStorage(variant.storageProvider)}</StatusBadge>
                              {formatGeneratedVisualFileSize(variant.fileSize) ? <StatusBadge>{formatGeneratedVisualFileSize(variant.fileSize)}</StatusBadge> : null}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-stone-900">{variant.variantTitle}</p>
                            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                              Перед отправкой клиенту проверьте текст, лица, руки, логотипы и медицинские утверждения.
                            </p>
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
                                      className="min-w-44 flex-1 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-violet-500"
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
                    <div className="mt-3 rounded-lg border border-dashed border-violet-300 bg-violet-50/70 p-4">
                      <p className="text-sm font-semibold text-violet-950">Пока нет сгенерированных визуалов.</p>
                      <p className="mt-1 text-xs leading-5 text-violet-800">
                        Premium Visual Engine создаст первый вариант по текущему ТЗ. Генерация использует OpenAI API и может расходовать кредиты.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-violet-700">
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

function ReportPublicationRow({ publication }: { publication: ScheduledPublicationPreview }) {
  const metric = publication.metrics[0];
  const published = isPublicationPublished(publication);
  const publishedDate = publication.publishedAt
    ? new Date(publication.publishedAt).toISOString().slice(0, 10)
    : "";
  const metricFields: Array<[string, string, number | null]> = [
    ["likes", "Лайки", metric?.likes ?? null],
    ["comments", "Комментарии", metric?.comments ?? null],
    ["shares", "Репосты", metric?.shares ?? null],
    ["reach", "Охват", metric?.reach ?? null],
    ["views", "Просмотры", metric?.views ?? null],
    ["saves", "Сохранения", metric?.saves ?? null],
    ["clicks", "Переходы", metric?.clicks ?? null],
  ];

  return (
    <article className={`${panelClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-950">{publication.topic}</p>
          <p className="text-xs text-stone-400">{publication.platformName} · {publication.scheduledDate}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${published ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-500"}`}>
          {published ? "Опубликовано" : "Не опубликовано"}
        </span>
      </div>

      {!published ? (
        <form action={publishPublicationToTelegram} className="mt-3">
          <input type="hidden" name="scheduledPublicationId" value={publication.id} />
          <PendingSubmitButton
            pendingLabel="Публикуем в Telegram..."
            className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
          >
            Опубликовать в Telegram
          </PendingSubmitButton>
        </form>
      ) : null}

      <form action={markPublicationPublishedManual} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="scheduledPublicationId" value={publication.id} />
        <input type="date" name="publishedAt" defaultValue={publishedDate} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" />
        <input type="url" name="externalUrl" defaultValue={publication.externalUrl ?? ""} placeholder="Ссылка на пост" className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" />
        <button type="submit" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 transition hover:border-violet-200 hover:text-violet-700">Отметить вручную</button>
      </form>
      {publication.externalUrl ? (
        <a href={publication.externalUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-violet-700 hover:text-violet-900">Открыть пост ↗</a>
      ) : null}

      <form action={upsertPublicationMetric} className="mt-3 grid gap-2">
        <input type="hidden" name="scheduledPublicationId" value={publication.id} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {metricFields.map(([name, label, value]) => (
            <label key={name} className="grid gap-1">
              <span className="text-[11px] font-semibold text-stone-400">{label}</span>
              <input type="number" min="0" inputMode="numeric" name={name} defaultValue={value ?? ""} placeholder="—" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900" />
            </label>
          ))}
        </div>
        <div>
          <button type="submit" className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:border-violet-200 hover:text-violet-700">Сохранить метрики</button>
        </div>
      </form>
    </article>
  );
}

function MonthlyClientReport({
  clientName,
  month,
  items,
  publications,
  assets,
  jobs,
  draftsHref,
  downloadHref,
}: {
  clientName?: string;
  month?: string;
  items: MaterialPlannedItem[];
  publications: ScheduledPublicationPreview[];
  assets: CreativeAssetPreview[];
  jobs: GenerationJobPreview[];
  draftsHref: string;
  downloadHref?: string;
}) {
  if (!month) {
    return (
      <section>
        <WorkspaceViewHeader
          eyebrow="Отчётность"
          title="Отчёт по подготовке материалов"
          description="Сводка по текстам, визуалам, правкам клиента и календарю публикаций."
        />
        <div className="mt-5"><EmptyState>Выберите месячный план, чтобы собрать отчёт.</EmptyState></div>
      </section>
    );
  }

  const materials = items.map((item) => {
    const draft = item.contentDraft;
    const publication = publications.find((candidate) => candidate.plannedContentItemId === item.id);
    const asset = publication?.creativeAssets[0];
    const variants = asset?.generatedVariants ?? [];
    const visualRequired = suggestsVisualAsset(item.format) || publication?.status === "needs_assets";
    const visualPrepared = variants.length > 0;
    const visualQualityReady = variants.some((variant) => variant.qualityStatus === "passed");
    const approved = Boolean(draft && ["approved", "ready_to_schedule"].includes(draft.status));
    const needsChanges = Boolean(draft && ["client_changes_requested", "rejected"].includes(draft.status));
    const scheduled = Boolean(publication);
    const readyToPublish = approved && scheduled && (!visualRequired || visualPrepared) && (!visualRequired || visualQualityReady);
    let nextAction = "Готово";

    if (!draft) nextAction = "Подготовить текст";
    else if (!approved) nextAction = "Проверить и согласовать";
    else if (!publication) nextAction = "Запланировать";
    else if (visualRequired && !asset) nextAction = "Сгенерировать ТЗ";
    else if (visualRequired && !visualPrepared) nextAction = "Сгенерировать визуал";
    else if (visualRequired && !visualQualityReady) nextAction = "Проверить визуал";

    return {
      item,
      draft,
      publication,
      asset,
      variants,
      visualRequired,
      visualPrepared,
      visualQualityReady,
      approved,
      needsChanges,
      scheduled,
      readyToPublish,
      nextAction,
    };
  });
  const totalMaterials = materials.length;
  const textsPrepared = materials.filter(({ draft }) => draft).length;
  const visualsPrepared = materials.filter(({ visualPrepared }) => visualPrepared).length;
  const approvedMaterials = materials.filter(({ approved }) => approved).length;
  const changesNeeded = materials.filter(({ needsChanges }) => needsChanges).length;
  const scheduledMaterials = materials.filter(({ scheduled }) => scheduled).length;
  const readyToPublish = materials.filter(({ readyToPublish: ready }) => ready).length;
  const inProgress = materials.filter(({ readyToPublish: ready }) => !ready).length;
  const missingTexts = totalMaterials - textsPrepared;
  const missingVisuals = materials.filter(({ visualRequired, visualPrepared }) => visualRequired && !visualPrepared).length;
  const waitingForClient = materials.filter(({ draft }) => draft?.status === "sent_to_client").length;
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const runningJobs = jobs.filter((job) => job.status === "running");
  const generatedVariants = assets.flatMap((asset) => asset.generatedVariants);
  const blobVisuals = generatedVariants.filter((variant) => variant.storageProvider === "vercel_blob").length;
  const base64Visuals = generatedVariants.filter((variant) => variant.storageProvider !== "vercel_blob").length;
  const attentionItems = [
    ...materials
      .filter(({ nextAction }) => nextAction !== "Готово")
      .map(({ item, nextAction }) => ({
        id: item.id,
        topic: item.topic,
        problem: nextAction === "Подготовить текст"
          ? "Для материала ещё нет текста."
          : nextAction === "Проверить и согласовать"
            ? "Материал ждёт проверки или решения клиента."
            : nextAction === "Запланировать"
              ? "Готовый материал ещё не добавлен в календарь."
              : nextAction === "Сгенерировать ТЗ"
                ? "Для запланированного материала нет ТЗ на визуал."
                : nextAction === "Сгенерировать визуал"
                  ? "ТЗ готово, но визуал ещё не создан."
                  : "Визуал нужно проверить перед использованием.",
        nextAction,
      })),
    ...failedJobs.map((job) => ({
      id: `job-${job.id}`,
      topic: job.title,
      problem: job.errorMessage || "Производственная задача завершилась ошибкой.",
      nextAction: "Повторить генерацию",
    })),
  ].slice(0, 10);
  const clientNextStep = waitingForClient > 0
    ? "Проверить новые правки клиента."
    : changesNeeded > 0
      ? "Команда внесёт правки и подготовит обновлённые материалы."
      : "Команда продолжает подготовку материалов по календарю.";
  const reportInput: ReportPublicationInput[] = publications.map((pub) => ({
    id: pub.id,
    platformName: pub.platformName,
    topic: pub.topic,
    publishStatus: pub.publishStatus,
    publishedAt: pub.publishedAt,
    scheduledDate: pub.scheduledDate,
    metric: pub.metrics[0] ?? null,
  }));
  const report = buildMonthlyReport(reportInput);
  const reportKpiCards: Array<[string, number | null]> = [
    ["Охват", report.kpis.reach],
    ["Лайки", report.kpis.likes],
    ["Комментарии", report.kpis.comments],
    ["Переходы", report.kpis.clicks],
  ];

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <WorkspaceViewHeader
          eyebrow="Отчётность"
          title="Отчёт по подготовке материалов"
          description="Сводка по текстам, визуалам, правкам клиента и календарю публикаций."
        />
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="teal">MVP-отчёт</StatusBadge>
          <button type="button" disabled className={`${secondaryButtonClass} cursor-not-allowed opacity-60`}>Экспорт PDF позже</button>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-500">PDF-экспорт отчёта будет добавлен отдельным этапом.</p>

      <article className={`${panelClass} mt-5 overflow-hidden`}>
        <div className="border-b border-stone-200 bg-[#f8fbfa] p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">{clientName || "Клиент"}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-stone-950">{month}</h2>
            <StatusBadge tone="green">Сводка актуальна</StatusBadge>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="Всего материалов" value={totalMaterials} detail="В плане" />
          <MetricCard label="Тексты подготовлены" value={textsPrepared} detail="Есть текст" tone="teal" />
          <MetricCard label="Визуалы подготовлены" value={visualsPrepared} detail="Есть вариант" tone="teal" />
          <MetricCard label="Готово в пакет" value={approvedMaterials} detail="Можно двигать дальше" />
          <MetricCard label="Нужны правки" value={changesNeeded} detail="Вернулись в работу" tone={changesNeeded > 0 ? "amber" : "stone"} />
          <MetricCard label="Запланировано" value={scheduledMaterials} detail="Есть дата" tone="teal" />
          <MetricCard label="В работе" value={inProgress} detail="Есть следующий шаг" tone={inProgress > 0 ? "amber" : "stone"} />
          <MetricCard label="Готово к публикации" value={readyToPublish} detail="Проверено и запланировано" />
        </div>
      </article>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className={`${panelClass} p-5`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Краткий итог</p>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            За месяц запланировано {totalMaterials} материалов. Тексты подготовлены для {textsPrepared}, визуалы готовы для {visualsPrepared}, готово в пакет {approvedMaterials}.
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            Основные зоны внимания: {missingTexts} материалов без текста, {missingVisuals} материалов без визуала, {changesNeeded} материалов ждут правок.
          </p>
        </article>
        <article className={`${panelClass} p-5`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Клиентская сводка</p>
          <div className="mt-3 grid gap-1.5 text-sm leading-6 text-stone-700">
            <p>В этом месяце подготовлено: <span className="font-semibold">{textsPrepared} материалов.</span></p>
            <p>Готово в пакет: <span className="font-semibold">{approvedMaterials}.</span></p>
            <p>Ожидают вашего решения: <span className="font-semibold">{waitingForClient}.</span></p>
            <p>В работе у команды: <span className="font-semibold">{inProgress}.</span></p>
            <p className="mt-2 text-stone-500">Следующий шаг: {clientNextStep}</p>
          </div>
        </article>
      </div>

      <article className={`${panelClass} mt-5 overflow-hidden`}>
        <div className={cardHeaderClass}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Материалы</p>
            <h2 className="mt-1 text-xl font-semibold text-stone-950">Статус материалов</h2>
          </div>
        </div>
        <div className="grid gap-2 p-4">
          {materials.map(({ item, draft, publication, visualRequired, visualPrepared, approved, needsChanges, scheduled, nextAction }) => (
            <article key={item.id} className="grid gap-3 rounded-md border border-stone-200 bg-stone-50/50 p-3 lg:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(110px,0.65fr))_minmax(150px,0.9fr)] lg:items-center">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-violet-700">{publication?.scheduledDate || item.week || item.plannedDate} &middot; {item.platformName} &middot; {item.format}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-stone-900">{item.topic}</p>
              </div>
              <StatusBadge tone={draft ? "teal" : "neutral"}>{draft ? "Текст готов" : "Нет текста"}</StatusBadge>
              <StatusBadge tone={visualPrepared ? "green" : visualRequired ? "amber" : "neutral"}>
                {visualPrepared ? "Визуал готов" : visualRequired ? "Нет визуала" : "Не требуется / не определено"}
              </StatusBadge>
              <StatusBadge tone={approved ? "green" : needsChanges ? "rose" : draft?.status === "sent_to_client" ? "amber" : "neutral"}>
                {approved ? "Готово в пакет" : needsChanges ? "Нужны правки" : draft?.status === "sent_to_client" ? "В работе" : "В работе"}
              </StatusBadge>
              <StatusBadge tone={scheduled ? "teal" : "neutral"}>{scheduled ? "Запланировано" : "Не запланировано"}</StatusBadge>
              <p className="text-xs font-semibold leading-5 text-stone-600">{nextAction}</p>
            </article>
          ))}
        </div>
      </article>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className={`${panelClass} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">Рабочая очередь</p>
              <h2 className="mt-1 text-xl font-semibold text-stone-950">Требует внимания</h2>
            </div>
            <StatusBadge tone={attentionItems.length > 0 ? "amber" : "green"}>{attentionItems.length}</StatusBadge>
          </div>
          <div className="mt-4 grid gap-2">
            {attentionItems.map((attention) => (
              <div key={attention.id} className="rounded-md border border-stone-200 bg-stone-50/70 p-3">
                <p className="text-sm font-semibold text-stone-900">{attention.topic}</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">{attention.problem}</p>
                <p className="mt-2 text-xs font-bold text-violet-800">{attention.nextAction}</p>
              </div>
            ))}
            {attentionItems.length === 0 ? <p className={mutedTextClass}>Сейчас нет материалов, требующих внимания.</p> : null}
          </div>
          <a href={draftsHref} className="mt-4 inline-flex text-xs font-bold text-violet-800 transition hover:text-violet-950">Открыть материалы</a>
        </article>

        <article className={`${panelClass} p-5`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Для менеджера</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">Операционная сводка</h2>
          <div className="mt-4 grid gap-2 text-sm leading-6 text-stone-600">
            <p>Производственных задач: <span className="font-semibold text-stone-900">{jobs.length}</span></p>
            <p>Выполняются сейчас: <span className="font-semibold text-stone-900">{runningJobs.length}</span></p>
            <p>Завершились ошибкой: <span className="font-semibold text-stone-900">{failedJobs.length}</span></p>
            <p>Визуалы в Vercel Blob: <span className="font-semibold text-stone-900">{blobVisuals}</span></p>
            <p>Визуалы в Base64 MVP: <span className="font-semibold text-stone-900">{base64Visuals}</span></p>
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Результаты месяца</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-950">Отчёт по публикациям</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
              Запланировано {report.planned} · опубликовано {report.published} ({report.publishRate}%). Метрики вводятся вручную; позже их будет присылать n8n в те же поля.
            </p>
          </div>
          {downloadHref ? (
            <a href={downloadHref} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-700">
              Скачать отчёт за месяц
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {reportKpiCards.map(([label, value]) => (
            <article key={label} className={`${panelClass} p-4`}>
              <p className="text-2xl font-semibold tracking-tight text-stone-950 tabular-nums">{formatReportNumber(value)}</p>
              <p className="mt-1 text-sm font-semibold text-stone-600">{label}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-2">
          {publications.length > 0 ? (
            publications.map((publication) => <ReportPublicationRow key={publication.id} publication={publication} />)
          ) : (
            <EmptyState>Публикации появятся после планирования календаря.</EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}

const brandAssetTypes = [
  ["logo", "Логотип"], ["photo", "Фото"], ["brandbook", "Брендбук"], ["old_post", "Старый пост"],
  ["presentation", "Презентация"], ["product_photo", "Фото продукта"], ["team_photo", "Фото команды"],
  ["reference", "Референс"], ["document", "Документ"], ["other", "Другое"],
] as const;

function formatBrandAssetType(type: string) {
  return brandAssetTypes.find(([value]) => value === type)?.[1] ?? type;
}

function BrandAssetsView({ client, requestedStep, workspaceContext }: { client: {
  id: string;
  name: string;
  brandProfile: {
    toneOfVoice: string | null; keyMessages: string | null; targetAudienceNotes: string | null; brandColors: string | null;
    fonts: string | null; visualStyle: string | null; forbiddenTopics: string | null; requiredDisclaimers: string | null;
    legalNotes: string | null; productServiceNotes: string | null;
  } | null;
  brandAssets: Array<{ id: string; assetType: string; title: string; description: string | null; fileUrl: string | null; sourceUrl: string | null; textContent: string | null; fileSize: number | null; createdAt: Date }>;
} | null; requestedStep?: string; workspaceContext: WorkspaceContext }) {
  if (!client) {
    return (
      <section>
        <WorkspaceViewHeader eyebrow="Контекст клиента" title="Библиотека бренда" description="Материалы, стиль и ограничения клиента, которые AI использует при подготовке текстов, ТЗ и визуалов." />
        <div className="mt-5"><EmptyState>Выберите клиента, чтобы заполнить библиотеку бренда.</EmptyState></div>
      </section>
    );
  }

  const profile = client.brandProfile;
  const activeStep = brandSteps.includes(requestedStep as BrandStep)
    ? requestedStep as BrandStep
    : !profile
      ? "profile"
      : client.brandAssets.length === 0
        ? "materials"
        : "review";
  const context = { ...workspaceContext, client: client.id };
  const fields = [
    ["toneOfVoice", "Тональность"], ["keyMessages", "Ключевые сообщения"], ["targetAudienceNotes", "Целевая аудитория"],
    ["brandColors", "Цвета бренда"], ["fonts", "Шрифты"], ["visualStyle", "Визуальный стиль"],
    ["productServiceNotes", "Услуги / продукты"], ["forbiddenTopics", "Запрещённые темы и формулировки"],
    ["requiredDisclaimers", "Обязательные дисклеймеры"], ["legalNotes", "Юридические ограничения"],
  ] as const;
  const profileSummary = fields
    .map(([name, label]) => ({ label, value: profile?.[name] ?? "" }))
    .filter((item) => item.value.trim());
  const assetCounts = Array.from(
    client.brandAssets.reduce((counts, asset) => counts.set(asset.assetType, (counts.get(asset.assetType) ?? 0) + 1), new Map<string, number>()),
    ([assetType, count]) => ({ assetType, count }),
  );

  return (
    <section className="mx-auto max-w-6xl">
      <WorkspaceViewHeader eyebrow="Контекст клиента" title="Библиотека бренда" description="Материалы, стиль и ограничения клиента, которые AI использует при подготовке текстов, ТЗ и визуалов." />
      <p className="mt-3 text-sm font-semibold text-stone-700">{client.name}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {brandSteps.map((step, index) => (
          <a
            key={step}
            href={brandAssetsHref(step, context)}
            className={`rounded-lg border p-3 transition hover:border-violet-300 hover:bg-violet-50/50 ${
              step === activeStep ? "border-violet-300 bg-violet-50/70" : "border-stone-200 bg-white"
            }`}
          >
            <p className="text-xs font-bold text-stone-400">{index + 1}</p>
            <p className="mt-1 text-sm font-semibold text-stone-950">{brandStepLabels[step]}</p>
            <div className="mt-2">
              <StatusBadge tone={setupStepTone(step === "profile" ? "create_client" : step === "materials" ? "brief" : "blueprint", activeStep === "profile" ? "create_client" : activeStep === "materials" ? "brief" : "blueprint")}>
                {setupStepState(step === "profile" ? "create_client" : step === "materials" ? "brief" : "blueprint", activeStep === "profile" ? "create_client" : activeStep === "materials" ? "brief" : "blueprint")}
              </StatusBadge>
            </div>
          </a>
        ))}
      </div>

      {activeStep === "profile" ? (
        <article className={`${panelClass} mt-5 p-5 sm:p-6`}>
          <SectionTitle
            eyebrow="Шаг 1"
            title="Профиль бренда"
            description="Заполните базовый брендовый контекст. После сохранения можно будет добавить файлы и материалы."
          />
          <form action={updateClientBrandProfile} className="mt-5 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="clientId" value={client.id} />
            {fields.map(([name, label]) => (
              <label key={name} className="grid gap-1 text-xs font-bold text-stone-600">
                {label}
                <textarea name={name} defaultValue={profile?.[name] ?? ""} rows={3} className={inputClass} />
              </label>
            ))}
            <PendingSubmitButton pendingLabel="Сохраняем..." className={`${primaryButtonClass} md:col-span-2`}>Сохранить профиль бренда</PendingSubmitButton>
          </form>
        </article>
      ) : null}

      {activeStep === "materials" ? (
        <article className={`${panelClass} mt-5 p-5 sm:p-6`}>
          <SectionTitle
            eyebrow="Шаг 2"
            title="Добавить материалы бренда"
            description="Добавьте логотипы, брендбук, презентации, фото, старые посты и референсы. Можно добавить описание, ссылку или текст даже без файла."
          />
          <form action={createClientBrandAsset} className="mt-5 grid max-w-3xl gap-3">
            <input type="hidden" name="clientId" value={client.id} />
            <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
              Тип материала
              <select name="assetType" className={inputClass}>{brandAssetTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
              Название
              <input name="title" required className={inputClass} placeholder="Название материала" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
              Описание
              <textarea name="description" rows={2} className={inputClass} placeholder="Описание и заметки" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
              Ссылка на источник
              <input name="sourceUrl" type="url" className={inputClass} placeholder="Ссылка на источник, если есть" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
              Текст или выдержка
              <textarea name="textContent" rows={4} className={inputClass} placeholder="Можно добавить вручную даже без файла" />
            </label>
            <BrandAssetFileInput className={inputClass} />
            <PendingSubmitButton pendingLabel="Добавляем..." className={primaryButtonClass}>Добавить материал</PendingSubmitButton>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={brandAssetsHref("review", context)} className={secondaryButtonClass}>Перейти к проверке библиотеки</a>
            <a href={brandAssetsHref("profile", context)} className="inline-flex items-center text-sm font-bold text-violet-800 transition hover:text-violet-950">Вернуться к профилю бренда</a>
          </div>
        </article>
      ) : null}

      {activeStep === "review" ? (
        <section className="mt-5 grid gap-5">
          <article className={`${panelClass} p-5 sm:p-6`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <SectionTitle
                eyebrow="Шаг 3"
                title="Проверка библиотеки"
                description="Проверьте профиль бренда и активные материалы, которые будут использоваться как AI-контекст."
              />
              <div className="flex flex-wrap gap-2">
                <a href={brandAssetsHref("materials", context)} className={primaryButtonClass}>Добавить ещё материалы</a>
                <a href={brandAssetsHref("profile", context)} className={secondaryButtonClass}>Вернуться к профилю бренда</a>
              </div>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                <h3 className="text-sm font-semibold text-stone-950">Профиль бренда</h3>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-stone-600">
                  {profileSummary.map((item) => (
                    <p key={item.label}><span className="font-bold text-stone-800">{item.label}:</span> {item.value}</p>
                  ))}
                  {profileSummary.length === 0 ? <p className="text-stone-500">Профиль бренда пока не заполнен.</p> : null}
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                <h3 className="text-sm font-semibold text-stone-950">Материалы по типам</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {assetCounts.map((item) => (
                    <StatusBadge key={item.assetType} tone="teal">{formatBrandAssetType(item.assetType)}: {item.count}</StatusBadge>
                  ))}
                  {assetCounts.length === 0 ? <StatusBadge>Материалов нет</StatusBadge> : null}
                </div>
              </div>
            </div>
          </article>

          <article className={`${panelClass} p-5 sm:p-6`}>
            <h2 className="text-lg font-semibold text-stone-950">Активные материалы бренда</h2>
            <p className="mt-2 text-xs leading-5 text-stone-500">На этом этапе файлы сохраняются как материалы бренда. Автоматическое извлечение текста из документов и синхронизация с Google Drive появятся позже.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {client.brandAssets.map((asset) => (
                <article key={asset.id} className="rounded-md border border-stone-200 bg-stone-50/60 p-3">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge tone="teal">{formatBrandAssetType(asset.assetType)}</StatusBadge><p className="font-semibold text-stone-900">{asset.title}</p></div>
                  {asset.description ? <p className="mt-2 text-xs leading-5 text-stone-500">{asset.description}</p> : null}
                  {asset.textContent ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-stone-600">{asset.textContent}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-violet-800">
                    {asset.fileUrl ? <a href={asset.fileUrl} target="_blank" rel="noreferrer">Открыть файл</a> : null}
                    {asset.sourceUrl ? <a href={asset.sourceUrl} target="_blank" rel="noreferrer">Открыть источник</a> : null}
                    {asset.fileSize ? <span className="text-stone-400">{formatGeneratedVisualFileSize(asset.fileSize)}</span> : null}
                  </div>
                  <p className="mt-2 text-[11px] text-stone-400">{asset.createdAt.toLocaleDateString("ru-RU")}</p>
                  <form action={archiveClientBrandAsset} className="mt-3">
                    <input type="hidden" name="brandAssetId" value={asset.id} />
                    <input type="hidden" name="brandStep" value="review" />
                    <PendingSubmitButton pendingLabel="Скрываем..." className={secondaryButtonClass}>Скрыть</PendingSubmitButton>
                  </form>
                </article>
              ))}
              {client.brandAssets.length === 0 ? <EmptyState>Материалов бренда пока нет. Добавьте логотип, брендбук, PDF-гайд или референсы.</EmptyState> : null}
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}

function WorkspaceSwitcher({
  activeView,
  links,
  revisionCount = 0,
}: {
  activeView: WorkspaceView;
  links: Record<WorkspaceView, string>;
  revisionCount?: number;
}) {
  const items = [
    { label: "Обзор", view: "overview" as const },
    { label: "Правки", view: "approvals" as const },
    { label: "Календарь", view: "calendar" as const },
    { label: "Материалы", view: "drafts" as const },
    { label: "Бренд", view: "brand_assets" as const },
    { label: "Клиентский вид", view: "client_portal" as const },
    { label: "Отчёт", view: "reports" as const },
  ];

  return (
    <nav aria-label="Рабочие зоны" className="mb-4 overflow-x-auto border-b border-slate-200/80">
      <div className="flex min-w-max gap-1">
        {items.map((item) => (
          <a
            key={item.view}
            href={links[item.view]}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition ${
              item.view === activeView
                ? "border-violet-500 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{item.label}</span>
            {item.view === "approvals" && revisionCount > 0 ? (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{revisionCount}</span>
            ) : null}
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
  const reviewDrafts = drafts.filter((draft) => ["draft", "needs_review", "client_changes_requested"].includes(draft.status)).slice(0, 3);
  const calendarPublications = publications.slice(0, 3);
  const productionJobs = jobs.filter((job) => ["running", "failed"].includes(job.status)).slice(0, 3);

  return (
    <section className={`mt-7 ${compactGridClass}`}>
      <article className={`${panelClass} min-w-0 p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">Правки</p>
            <h3 className="mt-1 font-semibold text-stone-950">Клиентский inbox</h3>
          </div>
          <StatusBadge tone={reviewDrafts.length > 0 ? "amber" : "green"}>{reviewDrafts.length}</StatusBadge>
        </div>
        <div className="mt-3 grid gap-2">
          {reviewDrafts.map((draft) => (
            <div key={draft.id} className="min-w-0 rounded-md border border-stone-200 bg-stone-50/70 p-3">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-violet-700">{draft.platformName} &middot; {draft.format}</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-stone-900">{draft.draftTitle}</p>
              <p className="mt-1 text-xs text-stone-500">{formatDraftStatus(draft.status)}</p>
            </div>
          ))}
          {reviewDrafts.length === 0 ? <p className={mutedTextClass}>Нет материалов, требующих внимания.</p> : null}
        </div>
        <a href={links.approvals} className="mt-4 inline-flex text-xs font-bold text-violet-700 transition hover:text-violet-900">Открыть правки</a>
      </article>

      <article className={`${panelClass} min-w-0 p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">Календарь</p>
            <h3 className="mt-1 font-semibold text-stone-950">Ближайшие публикации</h3>
          </div>
          <StatusBadge tone="teal">{calendarPublications.length}</StatusBadge>
        </div>
        <div className="mt-3 grid gap-2">
          {calendarPublications.map((publication) => (
            <div key={publication.id} className="min-w-0 rounded-md border border-stone-200 bg-stone-50/70 p-3">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-violet-700">{publication.scheduledDate}{publication.scheduledTime ? `, ${publication.scheduledTime}` : ""}</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-stone-900">{publication.topic}</p>
              <p className="mt-1 text-xs text-stone-500">{publication.platformName} &middot; {formatStatus(publication.status)}</p>
            </div>
          ))}
          {calendarPublications.length === 0 ? <p className={mutedTextClass}>Публикации с датой пока не запланированы.</p> : null}
        </div>
        <a href={links.calendar} className="mt-4 inline-flex text-xs font-bold text-violet-700 transition hover:text-violet-900">Открыть календарь</a>
      </article>

      <article className={`${panelClass} min-w-0 p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">AI production</p>
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
        <a href={links.drafts} className="mt-4 inline-flex text-xs font-bold text-violet-800 transition hover:text-violet-950">Открыть материалы</a>
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
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">{eyebrow}</p>
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
  const asset = item.creativeAssets[0] ?? publication?.creativeAssets[0];
  const variants = asset?.generatedVariants.length ? asset.generatedVariants : item.generatedCreativeVariants;

  if (!draft) {
    return { kind: "generate_text" as const, label: "Сгенерируйте текст публикации" };
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

  if (!["approved", "ready_to_schedule"].includes(draft.status)) {
    return { kind: "review_text" as const, label: "Проверьте и согласуйте текст публикации" };
  }

  if (!publication) {
    return { kind: "schedule" as const, label: "Запланируйте публикацию" };
  }

  return { kind: "ready" as const, label: "Материал готов к месячному пакету" };
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
  const asset = item.creativeAssets[0] ?? publication?.creativeAssets[0];
  const primaryActionClass =
    "inline-flex w-full justify-center rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300";
  const secondaryActionClass =
    "inline-flex w-full justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700";

  if (nextStep.kind === "generate_text") {
    return (
      <form action={generateContentDraftForItem}>
        <input type="hidden" name="plannedContentItemId" value={item.id} />
        <PendingSubmitButton pendingLabel="Генерируем текст..." className={primaryActionClass}>
          Сгенерировать текст
        </PendingSubmitButton>
      </form>
    );
  }

  if (nextStep.kind === "review_text") {
    return <a href={approvalsHref} className={primaryActionClass}>Проверить текст</a>;
  }

  if (nextStep.kind === "schedule") {
    return <a href={calendarHref} className={primaryActionClass}>Запланировать</a>;
  }

  if (nextStep.kind === "generate_brief") {
    if (!publication) {
      return (
        <form action={generateCreativeBriefForSelectedMaterial}>
          <input type="hidden" name="plannedContentItemId" value={item.id} />
          <PendingSubmitButton pendingLabel="Генерируем ТЗ..." className={primaryActionClass}>
            Сгенерировать ТЗ
          </PendingSubmitButton>
        </form>
      );
    }

    return (
      <form action={generateCreativeAssetBriefForPublication}>
        <input type="hidden" name="scheduledPublicationId" value={publication.id} />
        <input type="hidden" name="returnView" value="drafts" />
        <PendingSubmitButton pendingLabel="Генерируем ТЗ..." className={primaryActionClass}>
          Сгенерировать ТЗ
        </PendingSubmitButton>
      </form>
    );
  }

  if (nextStep.kind === "generate_visual" && asset) {
    return (
      <form action={generateCreativeVisualVariantForAsset}>
        <input type="hidden" name="creativeAssetId" value={asset.id} />
        <input type="hidden" name="returnView" value="drafts" />
        <PendingSubmitButton pendingLabel="Генерируем визуал..." className={primaryActionClass}>
          Сгенерировать визуал
        </PendingSubmitButton>
      </form>
    );
  }

  if (nextStep.kind === "ready") {
    return <a href={approvalsHref} className={secondaryActionClass}>Открыть материал</a>;
  }

  return <a href={assetsHref} className={secondaryActionClass}>Проверить визуал</a>;
}

function MonthlyPlanRevisionCopilot({
  monthlyPlanId,
  proposal,
}: {
  monthlyPlanId?: string;
  proposal?: MonthlyPlanRevisionProposalPreview;
}) {
  const changes = proposal ? revisionChangeSet(proposal.proposedChanges) : null;
  const proposalIsDraft = proposal?.status === "draft";
  const proposalStatusLabel =
    proposal?.status === "applied"
      ? "Применено"
      : proposal?.status === "rejected"
        ? "Отклонено"
        : proposal?.status === "applied_candidate"
          ? "Применяется"
          : "Ждёт подтверждения";
  const proposalStatusTone =
    proposal?.status === "applied"
      ? "green"
      : proposal?.status === "rejected"
        ? "rose"
        : proposal?.status === "applied_candidate"
          ? "amber"
          : "teal";
  const examples = [
    "Убери Ozon Seller: карточки товаров уже готовы.",
    "Замени сайт на статьи для Дзена.",
    "Добавь больше материалов про SPF.",
    "Сделай темы менее абстрактными.",
    "Не трогай согласованные материалы.",
  ];

  return (
    <article className={`${panelClass} mt-5 overflow-hidden border-violet-200`}>
      <div className="grid gap-5 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">AI-помощник</p>
          <h3 className="mt-1 text-lg font-semibold text-stone-950">AI-помощник по плану</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Опишите, что нужно изменить. AI внесёт безопасные правки в план и календарь, не трогая согласованные материалы.
          </p>
          <form action={reviseMonthlyPlanWithCopilot} className="mt-4 grid gap-3">
            {monthlyPlanId ? <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} /> : null}
            <textarea
              name="instruction"
              required
              rows={5}
              disabled={!monthlyPlanId}
              className={`${inputClass} resize-y`}
              placeholder="Например: убери Ozon Seller и сайт, карточки товаров уже готовы. Замени их на VK, Telegram и статьи про SPF, Cleanical и снежный лотос. Согласованные материалы не трогай."
            />
            <PendingSubmitButton pendingLabel="Исправляем план..." disabled={!monthlyPlanId} className={primaryButtonClass}>
              Исправить план
            </PendingSubmitButton>
          </form>
          <details className="mt-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-stone-600">Только предложить без применения</summary>
            <form action={proposeMonthlyPlanRevision} className="mt-3 grid gap-3">
              {monthlyPlanId ? <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} /> : null}
              <textarea
                name="instruction"
                required
                rows={3}
                disabled={!monthlyPlanId}
                className={`${inputClass} resize-y bg-white`}
                placeholder="Опишите правку, которую нужно сначала посмотреть как предложение."
              />
              <PendingSubmitButton pendingLabel="Готовим предложение..." disabled={!monthlyPlanId} className={secondaryButtonClass}>
                Подготовить предложение
              </PendingSubmitButton>
            </form>
          </details>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs font-bold text-stone-700">Примеры для менеджера</p>
          <ul className="mt-3 grid gap-2 text-xs leading-5 text-stone-500">
            {examples.map((example) => (
              <li key={example} className="rounded-md border border-stone-200 bg-white px-3 py-2">{example}</li>
            ))}
          </ul>
        </div>
      </div>

      {proposal && changes ? (
        <div className="border-t border-violet-100 bg-violet-50/50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Предложенные правки</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-stone-950">{proposal.summary}</h4>
                <StatusBadge tone={proposalStatusTone}>{proposalStatusLabel}</StatusBadge>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500">Инструкция: {proposal.instruction}</p>
            </div>
            {proposalIsDraft ? (
              <div className="flex flex-wrap gap-2">
                <form action={applyMonthlyPlanRevisionProposal}>
                  <input type="hidden" name="proposalId" value={proposal.id} />
                  <PendingSubmitButton pendingLabel="Применяем..." className={primaryButtonClass}>Применить правки</PendingSubmitButton>
                </form>
                <form action={rejectMonthlyPlanRevisionProposal}>
                  <input type="hidden" name="proposalId" value={proposal.id} />
                  <PendingSubmitButton pendingLabel="Отклоняем..." className={secondaryButtonClass}>Отклонить</PendingSubmitButton>
                </form>
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-rose-200 bg-white p-4">
              <p className="text-sm font-semibold text-rose-900">Удалить</p>
              <div className="mt-3 grid gap-2">
                {changes.removeItems.map((item) => (
                  <p key={item.plannedContentItemId} className="text-xs leading-5 text-stone-600"><span className="font-bold">{item.plannedContentItemId}:</span> {item.reason}</p>
                ))}
                {changes.removeItems.length === 0 ? <p className="text-xs text-stone-400">Нет удалений.</p> : null}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white p-4">
              <p className="text-sm font-semibold text-amber-900">Обновить</p>
              <div className="mt-3 grid gap-2">
                {changes.updateItems.map((item) => (
                  <div key={item.plannedContentItemId} className="text-xs leading-5 text-stone-600">
                    <p className="font-bold text-stone-800">{item.platform} · {item.format}</p>
                    <p>{item.topic}</p>
                    {item.angle ? <p className="text-stone-500">Угол: {item.angle}</p> : null}
                    <p className="text-stone-400">{item.reason}</p>
                  </div>
                ))}
                {changes.updateItems.length === 0 ? <p className="text-xs text-stone-400">Нет обновлений.</p> : null}
              </div>
            </div>
            <div className="rounded-lg border border-violet-200 bg-white p-4">
              <p className="text-sm font-semibold text-violet-900">Добавить</p>
              <div className="mt-3 grid gap-2">
                {changes.addItems.map((item) => (
                  <div key={`${item.platform}-${item.topic}`} className="text-xs leading-5 text-stone-600">
                    <p className="font-bold text-stone-800">Неделя {item.week}: {item.platform} · {item.format}</p>
                    <p>{item.topic}</p>
                    {item.angle ? <p className="text-stone-500">Угол: {item.angle}</p> : null}
                    <p className="text-stone-400">{item.reason}</p>
                  </div>
                ))}
                {changes.addItems.length === 0 ? <p className="text-xs text-stone-400">Нет новых материалов.</p> : null}
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-sm font-semibold text-stone-900">Не трогать</p>
              <div className="mt-3 grid gap-2">
                {changes.protectedItems.map((item) => (
                  <p key={item.plannedContentItemId} className="text-xs leading-5 text-stone-600"><span className="font-bold">{item.plannedContentItemId}:</span> {item.reason}</p>
                ))}
                {changes.protectedItems.length === 0 ? <p className="text-xs text-stone-400">Защищённые материалы не указаны.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function manualPlanProtectionLabels(item: MaterialPlannedItem, publication?: ScheduledPublicationPreview) {
  const labels: Array<{ label: string; tone: "neutral" | "teal" | "amber" | "rose" | "green" }> = [];
  const draftStatus = item.contentDraft?.status;
  const hasGeneratedVisual =
    item.generatedCreativeVariants.length > 0 ||
    item.creativeAssets.some((asset) => asset.generatedVariants.length > 0);

  if (draftStatus && ["approved", "ready_to_schedule", "sent_to_client", "client_approved"].includes(draftStatus)) {
    labels.push({ label: "Готово в пакет", tone: "green" });
  } else if (draftStatus) {
    labels.push({ label: "В работе", tone: "amber" });
  }

  if (publication) {
    labels.push({ label: publication.status === "published" ? "Опубликовано" : "Запланировано", tone: publication.status === "published" ? "green" : "teal" });
  }

  if (hasGeneratedVisual) {
    labels.push({ label: "Есть визуал", tone: "teal" });
  } else if (item.creativeAssets.length > 0) {
    labels.push({ label: "Есть ТЗ", tone: "amber" });
  }

  if (labels.length === 0) {
    labels.push({ label: "Можно редактировать", tone: "green" });
  }

  return labels;
}

function ManualPlanFields({ item }: { item?: MaterialPlannedItem }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold text-stone-600">
        Площадка
        <input name="platformName" required defaultValue={item?.platformName ?? ""} className={inputClass} placeholder="VK, Telegram, Дзен..." />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600">
        Формат
        <input name="format" required defaultValue={item?.format ?? ""} className={inputClass} placeholder="пост, статья, карточка..." />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600 sm:col-span-2">
        Тема
        <input name="topic" required defaultValue={item?.topic ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600 sm:col-span-2">
        Цель
        <textarea name="goal" required rows={3} defaultValue={item?.goal ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600">
        Неделя
        <input name="week" defaultValue={item?.week ?? ""} className={inputClass} placeholder="week 1" />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600">
        Дата
        <input name="plannedDate" defaultValue={item?.plannedDate ?? ""} className={inputClass} placeholder="week 1 или YYYY-MM-DD" />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600">
        Кампания
        <input name="campaignTheme" defaultValue={item?.campaignTheme ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600">
        Контентный столп
        <input name="contentPillar" defaultValue={item?.contentPillar ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600">
        Роль канала
        <input name="channelRole" defaultValue={item?.channelRole ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1 text-xs font-bold text-stone-600">
        Причина
        <input name="sequenceReason" defaultValue={item?.sequenceReason ?? ""} className={inputClass} />
      </label>
    </div>
  );
}

function MonthScopeFields({
  defaultPlatforms = "VK\nTelegram\nДзен\nYandex Maps",
  compact = false,
}: {
  defaultPlatforms?: string;
  compact?: boolean;
}) {
  const textareaClass = `${inputClass} min-h-24 resize-y`;

  return (
    <section className={`rounded-2xl border border-violet-100 bg-violet-50/40 p-4 ${compact ? "text-xs" : ""}`}>
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Scope месяца</p>
        <p className="text-sm text-slate-500">AI будет работать только внутри этих площадок, форматов и запретов.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-bold text-slate-600">
          Активные каналы
          <textarea name="scopeAllowedPlatforms" rows={4} defaultValue={defaultPlatforms} className={textareaClass} />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-slate-600">
          Что делаем в этом месяце
          <textarea
            name="scopeAllowedDeliverables"
            rows={4}
            defaultValue={"VK post\nTelegram post\nДзен article\nPost visual\nArticle visual\nYandex Maps review reply draft"}
            className={textareaClass}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-slate-600">
          Что НЕ делаем
          <textarea
            name="scopeForbiddenDeliverables"
            rows={4}
            defaultValue={"рекламные макеты\nсайт бренда\nOzon Seller\nemail\nлендинг\nнаружная реклама"}
            className={textareaClass}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-slate-600">
          Темы месяца
          <textarea name="scopeStrategicThemes" rows={4} placeholder="Yuhan, Cleanical, SPF, чувствительная кожа..." className={textareaClass} />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-slate-600">
          Частота
          <textarea name="scopeCadenceRules" rows={3} placeholder="VK: 2 поста/неделю&#10;Telegram: 3 поста/неделю" className={textareaClass} />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-slate-600">
          Репутационные задачи
          <textarea name="scopeReputationTasks" rows={3} placeholder="Yandex Maps: ответы на новые отзывы при наличии текста отзыва" className={textareaClass} />
        </label>
      </div>
    </section>
  );
}

function ManualMonthlyPlanEditor({
  monthlyPlanId,
  items,
  publications,
}: {
  monthlyPlanId?: string;
  items: MaterialPlannedItem[];
  publications: ScheduledPublicationPreview[];
}) {
  return (
    <article className={`${panelClass} mt-5 overflow-hidden border-violet-200`}>
      <div className="grid gap-5 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Ручное управление планом</p>
          <h3 className="mt-1 text-lg font-semibold text-stone-950">Редактор месячного плана</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Исправьте площадки, темы и недели до запуска производства. Календарь и связанные рабочие записи обновятся после сохранения.
          </p>
        </div>
        <details className="rounded-lg border border-violet-200 bg-violet-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-violet-950">Добавить материал в план</summary>
          <form action={createPlannedContentItemManual} className="mt-4 grid gap-3">
            {monthlyPlanId ? <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} /> : null}
            <ManualPlanFields />
            <PendingSubmitButton pendingLabel="Добавляем..." disabled={!monthlyPlanId} className={primaryButtonClass}>
              Добавить материал в план
            </PendingSubmitButton>
          </form>
        </details>
      </div>

      <div className="border-t border-stone-200 bg-stone-50/60 p-4 sm:p-5">
        <div className="grid gap-3">
          {items.map((item) => {
            const publication = publications.find((candidate) => candidate.plannedContentItemId === item.id);
            const labels = manualPlanProtectionLabels(item, publication);

            return (
              <article key={item.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge tone="teal">{item.platformName}</StatusBadge>
                      <StatusBadge>{item.format}</StatusBadge>
                      <StatusBadge>{item.week || item.plannedDate}</StatusBadge>
                    </div>
                    <h4 className="mt-2 font-semibold leading-6 text-stone-950">{item.topic}</h4>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{item.goal}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((label) => (
                      <StatusBadge key={label.label} tone={label.tone}>{label.label}</StatusBadge>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <details className="w-full rounded-md border border-stone-200 bg-stone-50/80 lg:w-auto lg:min-w-[520px]">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">Изменить</summary>
                    <form action={updatePlannedContentItemManual} className="grid gap-3 border-t border-stone-200 p-3">
                      <input type="hidden" name="plannedContentItemId" value={item.id} />
                      <ManualPlanFields item={item} />
                      <div className="flex flex-wrap gap-2">
                        <PendingSubmitButton pendingLabel="Сохраняем..." className={primaryButtonClass}>
                          Сохранить изменения
                        </PendingSubmitButton>
                        <span className="inline-flex items-center text-xs font-semibold text-stone-400">Отмена: закройте блок “Изменить”</span>
                      </div>
                    </form>
                  </details>

                  <form action={duplicatePlannedContentItemManual}>
                    <input type="hidden" name="plannedContentItemId" value={item.id} />
                    <PendingSubmitButton pendingLabel="Дублируем..." className={secondaryButtonClass}>Дублировать</PendingSubmitButton>
                  </form>

                  <form action={deletePlannedContentItemManual}>
                    <input type="hidden" name="plannedContentItemId" value={item.id} />
                    <PendingSubmitButton pendingLabel="Удаляем..." className={destructiveButtonClass}>Удалить</PendingSubmitButton>
                  </form>
                </div>
              </article>
            );
          })}
          {items.length === 0 ? <EmptyState>В месячном плане пока нет материалов. Добавьте первый материал вручную.</EmptyState> : null}
        </div>
      </div>
    </article>
  );
}

function DraftsView({
  items,
  publications,
  jobs,
  productionRun,
  monthlyPlanId,
  blueprintId,
  clientName,
  month,
  planStatus,
  totalPlannedUnits,
  clientId,
  selectedMaterialId,
  activeFilter,
  approvalsHref,
  calendarHref,
  assetsHref,
  clientPortalHref,
  reportsHref,
  brandProfileReady,
  latestRevisionProposal,
}: {
  items: MaterialPlannedItem[];
  publications: ScheduledPublicationPreview[];
  jobs: GenerationJobPreview[];
  productionRun?: MonthProductionRunPreview;
  monthlyPlanId?: string;
  blueprintId?: string;
  clientName?: string;
  month?: string;
  planStatus?: string;
  totalPlannedUnits?: number;
  clientId?: string;
  selectedMaterialId?: string;
  activeFilter?: string;
  approvalsHref: string;
  calendarHref: string;
  assetsHref: string;
  clientPortalHref: string;
  reportsHref: string;
  brandProfileReady: boolean;
  latestRevisionProposal?: MonthlyPlanRevisionProposalPreview;
}) {
  const totalMaterialsCount = items.length;
  const textsCreatedCount = items.filter((item) => item.contentDraft).length;
  const missingTextsCount = totalMaterialsCount - textsCreatedCount;
  const briefsReadyCount = items.filter((item) => item.creativeAssets.length > 0).length;
  const publicationByItemId = new Map(publications.map((publication) => [publication.plannedContentItemId, publication]));
  const visualsReadyCount = items.filter((item) =>
    materialVisualComplete(item, publicationByItemId.get(item.id)),
  ).length;
  const readyForPackageCount = items.filter((item) => item.contentDraft?.status === "ready_to_schedule").length;
  const allTextsReady = totalMaterialsCount > 0 && missingTextsCount === 0;
  const autopilotBatchLimit = getAutopilotTextBatchLimit();
  const filters = [
    { id: "all", label: "Все" },
    { id: "missing_text", label: "Без текста" },
    { id: "missing_brief", label: "Без ТЗ" },
    { id: "missing_visual", label: "Без визуала" },
    { id: "review", label: "На внутренней проверке" },
    { id: "ready", label: "Готово" },
    { id: "package", label: "В месячном пакете" },
  ];
  const currentFilter = activeFilter && filters.some((filter) => filter.id === activeFilter) ? activeFilter : "all";
  const materialHref = (materialId?: string, filter = currentFilter) => {
    const searchParams = new URLSearchParams({ view: "drafts" });
    if (blueprintId) searchParams.set("blueprint", blueprintId);
    if (monthlyPlanId) searchParams.set("plan", monthlyPlanId);
    if (materialId) searchParams.set("materialId", materialId);
    if (filter !== "all") searchParams.set("filter", filter);
    return `/?${searchParams.toString()}`;
  };
  const productionTasksByItemId = new Map<string, MonthProductionTaskPreview[]>();
  for (const task of productionRun?.tasks ?? []) {
    if (!task.plannedContentItemId) continue;
    const tasks = productionTasksByItemId.get(task.plannedContentItemId) ?? [];
    tasks.push(task);
    productionTasksByItemId.set(task.plannedContentItemId, tasks);
  }
  const itemMatchesFilter = (item: MaterialPlannedItem) => {
    const publication = publicationByItemId.get(item.id);
    const assets = visualAssetsForMaterial(item, publication);
    const draftStatus = item.contentDraft?.status;

    if (currentFilter === "missing_text") return !item.contentDraft;
    if (currentFilter === "missing_brief") return Boolean(item.contentDraft) && assets.length === 0;
    if (currentFilter === "missing_visual") return assets.length > 0 && !materialVisualComplete(item, publication);
    if (currentFilter === "review") return draftStatus === "draft" || draftStatus === "needs_review";
    if (currentFilter === "ready") return draftStatus === "ready_to_schedule" || publication?.status === "ready";
    if (currentFilter === "package") return publication?.status === "ready";
    return true;
  };
  const visibleItems = items.filter(itemMatchesFilter);
  const selectedItem =
    visibleItems.find((item) => item.id === selectedMaterialId) ??
    items.find((item) => item.id === selectedMaterialId) ??
    visibleItems[0] ??
    items[0] ??
    null;
  const selectedPublication = selectedItem ? publicationByItemId.get(selectedItem.id) : undefined;
  const selectedAssets = selectedItem ? visualAssetsForMaterial(selectedItem, selectedPublication) : [];
  const selectedAsset = selectedAssets[0];
  const selectedVisual = selectedAssets.flatMap((asset) => asset.generatedVariants)[0] ?? selectedItem?.generatedCreativeVariants[0];
  const selectedClientRevision = selectedItem?.contentDraft?.reviewEvents
    .filter((event) => event.actorType === "client" || (event.action === "changes_requested" && Boolean(event.comment)))
    .at(-1);
  const selectedProductionTasks = selectedItem ? productionTasksByItemId.get(selectedItem.id) ?? [] : [];
  const selectedFailedProductionTasks = selectedProductionTasks.filter((task) => task.status === "failed");
  const selectedRunningProductionTask = selectedProductionTasks.find((task) => task.status === "running" || task.status === "queued");
  const packageReady = selectedItem?.contentDraft?.status === "ready_to_schedule" || selectedPublication?.status === "ready";
  const visualSource = selectedVisual ? getGeneratedVariantImageSrc(selectedVisual) : null;
  const statusForMaterial = (item: MaterialPlannedItem) => {
    const itemTasks = productionTasksByItemId.get(item.id) ?? [];
    const failedTask = itemTasks.find((task) => task.status === "failed");
    const runningTask = itemTasks.find((task) => task.status === "running" || task.status === "queued");
    const publication = publicationByItemId.get(item.id);
    const assets = visualAssetsForMaterial(item, publication);
    const hasVisual = materialVisualComplete(item, publication);
    const draftStatus = item.contentDraft?.status;

    if (failedTask) return "Ошибка";
    if (runningTask?.taskType === "generate_text") return runningTask.status === "running" ? "Текст создаётся" : "Текст в очереди";
    if (runningTask?.taskType === "generate_brief") return runningTask.status === "running" ? "ТЗ создаётся" : "ТЗ в очереди";
    if (runningTask?.taskType === "generate_visual") return runningTask.status === "running" ? "Визуал создаётся" : "Визуал в очереди";
    if (!item.contentDraft) return "Нужен текст";
    if (draftStatus === "client_changes_requested") return "Есть правки";
    if (assets.length === 0) return "Нужно ТЗ";
    if (!hasVisual) return "Нужен визуал";
    if (publication?.status === "ready") return "В месячном пакете";
    if (draftStatus === "ready_to_schedule") return "Готово в пакет";
    if (draftStatus === "draft" || draftStatus === "needs_review" || draftStatus === "client_changes_requested" || draftStatus === "sent_to_client") {
      return "Проверить";
    }
    return "Готово";
  };
  const selectedActionLabel = selectedItem ? statusForMaterial(selectedItem) : "";
  const purpleButtonClass = "rounded-full bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300";
  const softButtonClass = "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700";
  const renderMaterialListItem = (item: MaterialPlannedItem) => {
    const publication = publicationByItemId.get(item.id);
    const action = statusForMaterial(item);
    const active = selectedItem?.id === item.id;

    return (
      <a
        key={item.id}
        href={materialHref(item.id)}
        className={`block min-w-0 overflow-hidden rounded-2xl border p-3 text-left transition hover:border-violet-200 hover:bg-white ${
          active ? "border-violet-300 bg-violet-50/70 ring-2 ring-violet-100" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-medium text-slate-400">
            {publication?.scheduledDate ?? item.plannedDate ?? item.week ?? "без даты"} · {shortPlatformName(item.platformName)}
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${nextActionBadgeClass(action)}`}>{action}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{item.topic}</p>
        <p className="mt-1 truncate text-[11px] font-medium text-slate-400">{item.format}</p>
      </a>
    );
  };

  return (
    <section className="rounded-[28px] bg-[#f7f5fb] p-4 text-slate-900 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Production Studio</h2>
          <p className="mt-1 text-sm text-slate-500">
            {clientName ?? "Клиент не выбран"} · {month ?? "Месячный план не выбран"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">{planStatus ? formatStatus(planStatus) : "Нет плана"}</span>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${brandProfileReady ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
              {brandProfileReady ? "Бренд готов" : "Нужен бренд"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm">
            <summary className="cursor-pointer">Добавить материал</summary>
            <form action={createPlannedContentItemManual} className="absolute right-5 z-10 mt-3 grid w-[min(92vw,560px)] gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_18px_50px_rgba(88,75,135,0.16)]">
              {monthlyPlanId ? <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} /> : null}
              <ManualPlanFields />
              <PendingSubmitButton pendingLabel="Добавляем..." disabled={!monthlyPlanId} className="rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300">
                Добавить материал в план
              </PendingSubmitButton>
            </form>
          </details>
          <a href={reportsHref} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:text-violet-700">Месячный пакет</a>
        </div>
      </div>

      {!monthlyPlanId ? (
        <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
          Выберите месячный план, чтобы открыть материалы.
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
          В плане пока нет материалов. Добавьте первый материал или сгенерируйте месячный план.
        </div>
      ) : (
        <>
          <section className="mt-4 rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Подготовка месяца</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">Месячный пакет</h3>
              </div>
	              <div className="grid gap-2 sm:grid-cols-4 xl:min-w-[620px]">
	                <MetricCard label="Тексты" value={missingTextsCount === 0 ? "подготовлены" : `${missingTextsCount} ждут`} detail={missingTextsCount === 0 ? "готовы к проверке" : "нужно подготовить"} tone={missingTextsCount === 0 ? "teal" : "amber"} />
	                <MetricCard label="ТЗ" value={briefsReadyCount >= totalMaterialsCount ? "готовы" : `${Math.max(totalMaterialsCount - briefsReadyCount, 0)} осталось`} detail="креатив" />
	                <MetricCard label="Визуалы" value={visualsReadyCount >= briefsReadyCount && briefsReadyCount > 0 ? "готовы" : `${Math.max(briefsReadyCount - visualsReadyCount, 0)} в работе`} detail="производство" />
	                <MetricCard label="В пакет" value={`${readyForPackageCount}`} detail="готово" />
	              </div>
            </div>
	            <div className="mt-4 flex flex-wrap gap-2">
		              <details className="rounded-full border border-violet-100 bg-white px-3 py-2 text-xs font-semibold text-violet-700">
		                <summary className="cursor-pointer">Переделать месяц</summary>
		                <form action={rebuildMonthProduction} className="absolute z-10 mt-3 grid w-[min(92vw,440px)] gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm shadow-[0_18px_50px_rgba(88,75,135,0.16)]">
		                  <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
		                  <p className="font-semibold text-slate-950">Переделать месяц?</p>
		                  <p className="text-slate-500">Текущий план сохранится как предыдущая версия. Новый месяц будет собран заново по текущему scope.</p>
		                  <div className="flex flex-wrap gap-2">
		                    <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500">Отмена — закройте блок</span>
		                    <PendingSubmitButton pendingLabel="Пересобираем..." className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700">
		                      Переделать месяц
		                    </PendingSubmitButton>
		                  </div>
		                </form>
		              </details>
		              <details className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
		                <summary className="cursor-pointer">Ручное восстановление</summary>
		                <div className="absolute z-10 mt-3 grid w-[min(92vw,520px)] gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_18px_50px_rgba(88,75,135,0.16)]">
		                  <p className="text-sm font-semibold text-slate-950">Точечные действия</p>
		                  <p className="text-xs leading-5 text-slate-500">Используйте только если нужно восстановить отдельный слой. Основная подготовка месяца идёт через панель прогресса ниже.</p>
		                  <div className="flex flex-wrap gap-2">
		                    <form action={prepareMonthAutopilot}>
	                      <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
	                      {blueprintId ? <input type="hidden" name="blueprintId" value={blueprintId} /> : null}
                      <PendingSubmitButton pendingLabel="Готовим тексты..." disabled={missingTextsCount === 0} className={softButtonClass}>
                        Подготовить тексты
                      </PendingSubmitButton>
                    </form>
                    <form action={prepareMonthCreativeBriefs}>
                      <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
                      <PendingSubmitButton pendingLabel="Готовим ТЗ..." disabled={!allTextsReady || briefsReadyCount >= totalMaterialsCount} className={softButtonClass}>
                        Подготовить ТЗ
                      </PendingSubmitButton>
                    </form>
                    <form action={prepareMonthVisuals}>
                      <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
                      <PendingSubmitButton pendingLabel="Готовим визуал..." disabled={briefsReadyCount === 0 || visualsReadyCount >= briefsReadyCount} className={softButtonClass}>
                        Подготовить визуалы
                      </PendingSubmitButton>
                    </form>
		                  </div>
		                </div>
		              </details>
	              <a href={reportsHref} className={softButtonClass}>Собрать месячный пакет</a>
	            </div>
	          </section>

	          <div className="mt-4">
	            <MonthProductionRunPanel
	              run={productionRun}
	              plan={{
	                id: monthlyPlanId,
	                blueprintId,
	                clientId,
	                totalPlannedUnits,
	                plannedItemsCount: totalMaterialsCount,
	                clientName,
	              }}
	            />
	          </div>

	          <div className="mt-4 flex flex-wrap gap-1.5">
            {filters.map((filter) => (
              <a
                key={filter.id}
                href={materialHref(undefined, filter.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  currentFilter === filter.id ? "bg-violet-50 text-violet-700" : "bg-white text-slate-500 hover:text-violet-700"
                }`}
              >
                {filter.label}
              </a>
            ))}
          </div>

          <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px] 2xl:grid-cols-[300px_minmax(0,1fr)_320px]">
            <aside className="min-w-0 overflow-x-hidden rounded-[24px] border border-slate-200/80 bg-white p-3 shadow-[0_10px_28px_rgba(88,75,135,0.055)] xl:sticky xl:top-24 xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Материалы</h3>
                  <p className="text-xs text-slate-400">{visibleItems.length} в фильтре</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{items.length}</span>
              </div>
              <div className="grid gap-2">
                {visibleItems.map((item) => renderMaterialListItem(item))}
                {visibleItems.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">По этому фильтру материалов нет.</p>
                ) : null}
              </div>
            </aside>

            <article className="min-w-0 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
              {!selectedItem ? (
                <p className="text-sm leading-6 text-slate-500">Выберите материал слева, чтобы открыть единый редактор.</p>
              ) : (
                <div>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{selectedItem.platformName}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{selectedItem.format}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{selectedPublication?.scheduledDate ?? selectedItem.week ?? selectedItem.plannedDate}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold leading-7 text-slate-950">{selectedItem.topic}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{selectedItem.goal}</p>
                      {selectedClientRevision ? (
                        <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                          <span className="font-semibold">Есть правка: </span>
                          {selectedClientRevision.comment || "Клиент оставил комментарий к материалу."}
                        </div>
                      ) : null}
                    </div>
	                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${nextActionBadgeClass(selectedActionLabel)}`}>
	                      {selectedActionLabel}
	                    </span>
	                  </div>

	                  {selectedRunningProductionTask || selectedFailedProductionTasks.length > 0 ? (
	                    <div className={`mt-4 rounded-2xl border p-3 text-sm ${selectedFailedProductionTasks.length > 0 ? "border-rose-200 bg-rose-50 text-rose-900" : "border-violet-100 bg-violet-50 text-violet-900"}`}>
	                      {selectedRunningProductionTask ? (
	                        <p>
	                          {selectedRunningProductionTask.status === "running" ? "Сейчас выполняется" : "Ожидает в очереди"}:{" "}
	                          <span className="font-semibold">{formatProductionTaskType(selectedRunningProductionTask.taskType)}</span>
	                        </p>
	                      ) : null}
	                      {selectedFailedProductionTasks.map((task) => (
	                        <form key={task.id} action={retryMaterialProductionStep} className="mt-2 flex flex-wrap items-center gap-2">
	                          <input type="hidden" name="plannedContentItemId" value={selectedItem.id} />
	                          <input type="hidden" name="step" value={task.taskType} />
	                          <span className="text-xs font-semibold">{formatProductionTaskType(task.taskType)}: {task.errorMessage || "ошибка генерации"}</span>
	                          <PendingSubmitButton pendingLabel="Добавляем..." className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rose-700">
	                            Повторить шаг
	                          </PendingSubmitButton>
	                        </form>
	                      ))}
	                    </div>
	                  ) : null}

	                  <div className="mt-5 grid gap-4">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-base font-semibold text-slate-950">1. Текст публикации</h4>
                        {selectedItem.contentDraft ? <StatusBadge tone={materialTextStatusTone(selectedItem.contentDraft)}>{formatMaterialTextStatus(selectedItem.contentDraft)}</StatusBadge> : <StatusBadge>Текст не создан</StatusBadge>}
                      </div>
	                      {selectedItem.contentDraft ? (
	                        <>
	                          <form action={updatePublicationText} key={`${selectedItem.contentDraft.id}-${selectedItem.contentDraft.updatedAt.toISOString()}`} className="mt-4 grid gap-3">
	                            <input type="hidden" name="contentDraftId" value={selectedItem.contentDraft.id} />
	                            <input type="text" name="draftTitle" required defaultValue={selectedItem.contentDraft.draftTitle} className={inputClass} />
	                            <textarea name="draftBody" required rows={14} defaultValue={selectedItem.contentDraft.draftBody} className={`${inputClass} min-h-[360px] w-full resize-y overflow-x-hidden whitespace-pre-wrap break-words leading-6`} />
	                            <input type="text" name="comment" className={inputClass} placeholder="Комментарий к правке" />
	                            <div className="flex flex-wrap gap-2">
	                              <PendingSubmitButton pendingLabel="Сохраняем..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">Сохранить текст</PendingSubmitButton>
	                            </div>
	                          </form>
	                          <form action={regenerateContentDraftForItem} className="mt-2">
	                            <input type="hidden" name="plannedContentItemId" value={selectedItem.id} />
	                            <PendingSubmitButton pendingLabel="Перегенерируем..." className={softButtonClass}>Перегенерировать текст</PendingSubmitButton>
	                          </form>
	                        </>
	                      ) : (
                        <div className="mt-4 rounded-2xl bg-white p-4">
                          <p className="text-sm text-slate-500">Текст ещё не подготовлен.</p>
                          <form action={generateContentDraftForItem} className="mt-3">
                            <input type="hidden" name="plannedContentItemId" value={selectedItem.id} />
                            <PendingSubmitButton pendingLabel="Генерируем текст..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
                              Сгенерировать текст
                            </PendingSubmitButton>
                          </form>
                        </div>
                      )}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-base font-semibold text-slate-950">2. Креативное ТЗ</h4>
                        <StatusBadge tone={selectedAsset ? creativeAssetTone(selectedAsset.status) : "neutral"}>{selectedAsset ? formatStatus(selectedAsset.status) : "ТЗ не создано"}</StatusBadge>
                      </div>
                      {selectedAsset ? (
                        <>
                          <form action={updateCreativeAssetBrief} className="mt-4 grid gap-3">
                            <input type="hidden" name="creativeAssetId" value={selectedAsset.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <input type="text" name="title" required defaultValue={selectedAsset.title} className={inputClass} />
                            <textarea name="brief" required rows={8} defaultValue={selectedAsset.brief} className={`${inputClass} min-h-[220px] w-full resize-y overflow-x-hidden whitespace-pre-wrap break-words leading-6`} />
                            <textarea name="formatRequirements" rows={4} defaultValue={selectedAsset.formatRequirements ?? ""} className={`${inputClass} w-full resize-y overflow-x-hidden whitespace-pre-wrap break-words leading-6`} placeholder="Требования к формату" />
                            <textarea name="textOnAsset" rows={3} defaultValue={selectedAsset.textOnAsset ?? ""} className={`${inputClass} w-full resize-y overflow-x-hidden whitespace-pre-wrap break-words leading-6`} placeholder="Текст на визуале" />
                            <input type="text" name="references" defaultValue={selectedAsset.references ?? ""} className={inputClass} placeholder="Референсы" />
                            <input type="text" name="notes" defaultValue={selectedAsset.notes ?? ""} className={inputClass} placeholder="Заметки" />
                            <div className="flex flex-wrap gap-2">
                              <PendingSubmitButton pendingLabel="Сохраняем..." className={softButtonClass}>Сохранить ТЗ</PendingSubmitButton>
                            </div>
                          </form>
                          {creativeAssetLooksLikeCarousel(selectedAsset, selectedItem) ? (
                            <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                              <p className="text-sm font-semibold text-violet-950">Похоже, это карусель из нескольких карточек.</p>
                              <p className="mt-1 text-xs leading-5 text-violet-800">
                                Пересоберите ТЗ в отдельные карточки, чтобы AI не сделал один общий коллаж.
                              </p>
                              <form action={rebuildCreativeAssetAsCarousel} className="mt-3">
                                <input type="hidden" name="creativeAssetId" value={selectedAsset.id} />
                                <input type="hidden" name="returnView" value="drafts" />
                                <PendingSubmitButton pendingLabel="Пересобираем..." className={primaryButtonClass}>
                                  Пересобрать как карусель
                                </PendingSubmitButton>
                              </form>
                            </div>
                          ) : null}
                        </>
                      ) : selectedPublication ? (
                        <div className="mt-4 rounded-2xl bg-white p-4">
                          <p className="text-sm text-slate-500">ТЗ ещё не создано.</p>
                          <form action={generateCreativeAssetBriefForPublication} className="mt-3">
                            <input type="hidden" name="scheduledPublicationId" value={selectedPublication.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <PendingSubmitButton pendingLabel="Генерируем ТЗ..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
                              Сгенерировать ТЗ
                            </PendingSubmitButton>
                          </form>
                        </div>
                      ) : selectedItem.contentDraft ? (
                        <div className="mt-4 rounded-2xl bg-white p-4">
                          <p className="text-sm text-slate-500">Текст готов. Можно сразу подготовить ТЗ для визуала.</p>
                          <form action={generateCreativeBriefForSelectedMaterial} className="mt-3">
                            <input type="hidden" name="plannedContentItemId" value={selectedItem.id} />
                            <PendingSubmitButton pendingLabel="Генерируем ТЗ..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
                              Сгенерировать ТЗ
                            </PendingSubmitButton>
                          </form>
                        </div>
                      ) : (
                        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">Сначала подготовьте текст публикации.</p>
                      )}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-base font-semibold text-slate-950">3. Визуал</h4>
                        <StatusBadge tone={selectedVisual ? creativeVariantTone(selectedVisual.status) : "neutral"}>
                          {selectedAssets.length > 1 ? visualProgressLabel(selectedAssets, selectedItem.generatedCreativeVariants) : selectedVisual ? formatStatus(selectedVisual.status) : "Визуал не создан"}
                        </StatusBadge>
                      </div>
                      {selectedAssets.length > 1 ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {selectedAssets.map((asset, index) => {
                            const variant = asset.generatedVariants[0];
                            const visualTask = selectedProductionTasks.find(
                              (task) => task.taskType === "generate_visual" && task.creativeAssetId === asset.id,
                            );
                            const taskActive = visualTask?.status === "queued" || visualTask?.status === "running";

                            return (
                              <div key={asset.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-100 px-3 py-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-950">Карточка {index + 1}/{selectedAssets.length}</p>
                                      <p className="mt-0.5 truncate text-[11px] text-slate-400">{asset.title}</p>
                                    </div>
                                    <StatusBadge tone={slideVisualTaskTone(asset, visualTask)}>
                                      {formatSlideVisualTaskStatus(asset, visualTask)}
                                    </StatusBadge>
                                  </div>
                                </div>
                                {variant ? (
                                  <GeneratedVisualImage variant={variant} alt={variant.variantTitle} className="aspect-square w-full bg-slate-100 object-contain" />
                                ) : (
                                  <div className="grid aspect-square place-items-center bg-slate-50 p-4 text-center text-xs text-slate-400">
                                    Визуал для карточки ещё не создан.
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2 p-3">
                                  {taskActive ? (
                                    <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                                      Автоподготовка запущена
                                    </span>
                                  ) : (
                                    <form action={generateCreativeVisualVariantForAsset}>
                                      <input type="hidden" name="creativeAssetId" value={asset.id} />
                                      <input type="hidden" name="returnView" value="drafts" />
                                      <PendingSubmitButton pendingLabel="Генерируем..." className={softButtonClass}>
                                        {variant ? "Перегенерировать карточку" : visualTask?.status === "failed" ? "Повторить карточку" : "Сгенерировать карточку"}
                                      </PendingSubmitButton>
                                    </form>
                                  )}
                                  {variant ? (
                                    <form action={approveCreativeVariant}>
                                      <input type="hidden" name="creativeVariantId" value={variant.id} />
                                      <input type="hidden" name="returnView" value="drafts" />
                                      <PendingSubmitButton pendingLabel="Принимаем..." className={softButtonClass}>Принять</PendingSubmitButton>
                                    </form>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : selectedVisual ? (
                        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <GeneratedVisualImage variant={selectedVisual} alt={selectedVisual.variantTitle} className="aspect-video w-full bg-slate-100 object-contain" />
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                          Визуал ещё не создан.
                        </div>
                      )}
                      {selectedAssets.length <= 1 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedAsset ? (
                          <form action={generateCreativeVisualVariantForAsset}>
                            <input type="hidden" name="creativeAssetId" value={selectedAsset.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <PendingSubmitButton pendingLabel="Генерируем визуал..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
                              {selectedVisual ? "Перегенерировать" : "Сгенерировать визуал"}
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                        {selectedVisual ? (
                          <form action={approveCreativeVariant}>
                            <input type="hidden" name="creativeVariantId" value={selectedVisual.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <PendingSubmitButton pendingLabel="Принимаем..." className={softButtonClass}>Принять визуал</PendingSubmitButton>
                          </form>
                        ) : null}
                        {visualSource ? <a href={visualSource} target="_blank" rel="noreferrer" className={softButtonClass}>Открыть крупно</a> : null}
                      </div>
                      ) : null}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-base font-semibold text-slate-950">4. Готовность</h4>
                          <p className="mt-1 text-sm text-slate-500">Внутренняя готовность материала к месячному пакету.</p>
                        </div>
                        <StatusBadge tone={packageReady ? "green" : "teal"}>{packageReady ? "Готово в пакет" : "В работе"}</StatusBadge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedItem.contentDraft && ["draft", "needs_review"].includes(selectedItem.contentDraft.status) ? (
                          <form action={approveDraft}>
                            <input type="hidden" name="contentDraftId" value={selectedItem.contentDraft.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <PendingSubmitButton pendingLabel="Проверяем..." className={softButtonClass}>Внутренне проверено</PendingSubmitButton>
                          </form>
                        ) : null}
                        {selectedItem.contentDraft && selectedItem.contentDraft.status === "approved" ? (
                          <form action={markDraftReadyToSchedule}>
                            <input type="hidden" name="contentDraftId" value={selectedItem.contentDraft.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <PendingSubmitButton pendingLabel="Отмечаем..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
                              Отметить готовым
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                        {selectedPublication && selectedPublication.status !== "ready" ? (
                          <form action={markScheduledPublicationReady}>
                            <input type="hidden" name="scheduledPublicationId" value={selectedPublication.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <PendingSubmitButton pendingLabel="Добавляем..." className={softButtonClass}>Добавить в месячный пакет</PendingSubmitButton>
                          </form>
                        ) : null}
                        {!selectedPublication && selectedItem.contentDraft && ["approved", "ready_to_schedule"].includes(selectedItem.contentDraft.status) ? (
                          <form action={scheduleContentDraft} className="grid w-full gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_120px_auto]">
                            <input type="hidden" name="contentDraftId" value={selectedItem.contentDraft.id} />
                            <input type="hidden" name="returnView" value="drafts" />
                            <input type="date" name="scheduledDate" required defaultValue={parseExactDate(selectedItem.plannedDate) ? selectedItem.plannedDate : ""} className={inputClass} />
                            <input type="time" name="scheduledTime" className={inputClass} />
                            <PendingSubmitButton pendingLabel="Планируем..." className={softButtonClass}>Запланировать</PendingSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </section>
                  </div>
	                </div>
	              )}
            </article>

            <aside className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)] xl:sticky xl:top-24 xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto">
              {!selectedItem ? (
                <p className="text-sm text-slate-500">Выберите материал.</p>
              ) : (
                <div className="grid gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Preview / Actions</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950">{shortPlatformName(selectedItem.platformName)} · {selectedItem.format}</h3>
                    <p className="mt-1 text-xs text-slate-400">{selectedPublication?.scheduledDate ?? selectedItem.plannedDate}</p>
                  </div>
                  {selectedVisual ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <GeneratedVisualImage variant={selectedVisual} alt={selectedVisual.variantTitle} className="aspect-square w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
                      Визуал ещё не создан
                    </div>
                  )}
                  <MaterialPrimaryAction
                    item={selectedItem}
                    publication={selectedPublication}
                    approvalsHref={materialHref(selectedItem.id)}
                    calendarHref={calendarHref}
                    assetsHref={assetsHref}
                  />
                  <div className="grid gap-2 text-xs">
                    {[
                      ["Дата", selectedPublication?.scheduledDate ?? selectedItem.plannedDate],
                      ["Площадка", selectedItem.platformName],
                      ["Формат", selectedItem.format],
                      ["Пакет", packageReady ? "готов" : "в работе"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-400">{label}</span>
                        <span className="max-w-[160px] truncate text-right font-semibold text-slate-800">{value}</span>
                      </div>
                    ))}
                  </div>
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">Плановые поля</summary>
                    <form action={updatePlannedContentItemManual} className="mt-3 grid gap-3">
                      <input type="hidden" name="plannedContentItemId" value={selectedItem.id} />
                      <ManualPlanFields item={selectedItem} />
                      <PendingSubmitButton pendingLabel="Сохраняем..." className={softButtonClass}>Сохранить план</PendingSubmitButton>
                    </form>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={duplicatePlannedContentItemManual}>
                        <input type="hidden" name="plannedContentItemId" value={selectedItem.id} />
                        <PendingSubmitButton pendingLabel="Дублируем..." className={softButtonClass}>Дублировать</PendingSubmitButton>
                      </form>
                      <form action={deletePlannedContentItemManual}>
                        <input type="hidden" name="plannedContentItemId" value={selectedItem.id} />
                        <PendingSubmitButton pendingLabel="Удаляем..." className={destructiveButtonClass}>Удалить</PendingSubmitButton>
                      </form>
                    </div>
                  </details>
                </div>
              )}
            </aside>
          </div>

          <details className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Системные задачи</summary>
            <div className="mt-4 grid gap-4">
              <MonthlyPlanRevisionCopilot monthlyPlanId={monthlyPlanId} proposal={latestRevisionProposal} />
              <GenerationJobsPanel jobs={jobs} />
            </div>
          </details>
        </>
      )}
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
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Операционный обзор</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Состояние работы на месяц</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
	            Готовность производства, правки клиента и состояние интеграций.
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
              { label: "План", value: 100, tone: "bg-violet-500" },
              { label: "Тексты", value: Math.max(progress, 10), tone: "bg-sky-500" },
              { label: "Проверка", value: attentionCount > 0 ? 58 : 20, tone: "bg-amber-400" },
              { label: "Готово", value: integrationTaskCount > 0 ? 22 : Math.max(progress - 12, 10), tone: "bg-violet-500" },
            ].map((bar) => (
              <div key={bar.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                <div className={`w-full max-w-14 rounded-t-md ${bar.tone}`} style={{ height: `${bar.value}%` }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-stone-400">{bar.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-violet-500" />По плану</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-sky-500" />В работе</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />Есть риск</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-500" />Заблокировано</span>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Готовые тексты" value={draftCount} detail="Можно проверять" tone="teal" />
	        <MetricCard label="Требует внимания" value={attentionCount} detail="Проверка и правки" tone="amber" />
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
  reportsHref,
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
  reportsHref: string;
}) {
  return (
    <section className="mb-5 rounded-lg border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(28,36,38,0.04)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Доступ для клиента</p>
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
      <a href={reportsHref} className="mt-4 inline-flex text-xs font-bold text-violet-800 transition hover:text-violet-950">Открыть отчёт</a>

      {newPortalLink ? (
        <div className="mt-4 rounded-md border border-violet-200 bg-violet-50 p-3">
          <p className="text-sm font-semibold text-violet-900">Скопируйте ссылку для клиента</p>
          <p className="mt-1 text-xs leading-5 text-violet-800">Эта ссылка показана после создания. Сырой токен не хранится в базе.</p>
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
        href={materialWorkspaceHref(draftsHref, item.id)}
        className="inline-flex rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
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
        className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:bg-slate-300"
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
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Операционный календарь</p>
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
              className="rounded-lg border border-violet-200 bg-white p-4 shadow-[0_4px_12px_rgba(13,148,136,0.08)]"
            >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge tone="teal">{publication.platformName}</StatusBadge>
                <StatusBadge>{publication.format}</StatusBadge>
              </div>
              <StatusBadge tone={scheduledPublicationTone(publication.status)}>{formatStatus(publication.status)}</StatusBadge>
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.08em] text-violet-700">
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
              className="mt-4 inline-flex text-xs font-bold text-violet-800 transition hover:text-violet-950"
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
  monthlyPlanId,
  blueprintId,
  clientName,
  generationBlocked,
  draftsHref,
  clientSetupHref,
  activeFilter,
  activeCalendarView,
  activeCalendarDate,
}: {
  groups: Array<{ label: string; items: MaterialPlannedItem[] }>;
  publications: ScheduledPublicationPreview[];
  month: string;
  monthlyPlanId?: string;
  blueprintId?: string;
  clientName?: string;
  generationBlocked: boolean;
  draftsHref: string;
  clientSetupHref: string;
  activeFilter?: string;
  activeCalendarView?: string;
  activeCalendarDate?: string;
}) {
  const items = groups.flatMap((group) => group.items);
  const publicationByItemId = new Map(publications.map((publication) => [publication.plannedContentItemId, publication]));
  const filters = [
    { id: "all", label: "Все" },
    { id: "missing_text", label: "Без текста" },
    { id: "missing_visual", label: "Без визуала" },
    { id: "review", label: "На проверке" },
    { id: "revisions", label: "Есть правки" },
    { id: "ready", label: "Готово в пакет" },
    { id: "package", label: "В пакете" },
  ];
  const currentFilter = activeFilter && filters.some((filter) => filter.id === activeFilter) ? activeFilter : "all";
  const calendarViews = [
    { id: "month", label: "Месяц" },
    { id: "week", label: "Неделя" },
    { id: "threeDays", label: "3 дня" },
    { id: "day", label: "День" },
  ];
  const currentCalendarView = calendarViews.some((view) => view.id === activeCalendarView) ? activeCalendarView! : "month";
  const planMonthDate = parseExactDate(`${month}-01`) ?? new Date();
  const selectedDay = parseExactDate(activeCalendarDate ?? "") ?? planMonthDate;
  const calendarHref = (filter = currentFilter, viewMode = currentCalendarView, targetDate = selectedDay) => {
    const searchParams = new URLSearchParams({ view: "calendar" });
    if (blueprintId) searchParams.set("blueprint", blueprintId);
    if (monthlyPlanId) searchParams.set("plan", monthlyPlanId);
    if (filter !== "all") searchParams.set("filter", filter);
    if (viewMode !== "month") searchParams.set("calendarView", viewMode);
    searchParams.set("calendarDate", dateKey(targetDate));
    return `/?${searchParams.toString()}`;
  };
  const previousPeriodHref = calendarHref(currentFilter, currentCalendarView, shiftCalendarDate(selectedDay, currentCalendarView, -1));
  const nextPeriodHref = calendarHref(currentFilter, currentCalendarView, shiftCalendarDate(selectedDay, currentCalendarView, 1));
  const todayHref = calendarHref(currentFilter, currentCalendarView, new Date());
  const itemMatchesFilter = (item: MaterialPlannedItem) => {
    const publication = publicationByItemId.get(item.id);
    const draftStatus = item.contentDraft?.status;

    if (currentFilter === "missing_text") return !item.contentDraft;
    if (currentFilter === "missing_visual") return Boolean(publication) && !materialVisualComplete(item, publication);
    if (currentFilter === "review") return draftStatus === "draft" || draftStatus === "needs_review";
    if (currentFilter === "revisions") return draftStatus === "client_changes_requested";
    if (currentFilter === "ready") return draftStatus === "ready_to_schedule" || publication?.status === "ready";
    if (currentFilter === "package") return publication?.status === "ready";
    return true;
  };
  const visibleItems = items.filter(itemMatchesFilter);
  const calendarYear = selectedDay.getFullYear();
  const calendarMonth = selectedDay.getMonth();
  const calendarMonthLabel = selectedDay.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const monthStart = new Date(calendarYear, calendarMonth, 1);
  const monthEnd = new Date(calendarYear, calendarMonth + 1, 0);
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const calendarCells = Array.from({ length: Math.ceil((leadingDays + monthEnd.getDate()) / 7) * 7 }, (_, index) => (
    new Date(calendarYear, calendarMonth, index - leadingDays + 1)
  ));
  const exactDateItems = visibleItems.filter((item) => parseExactDate(publicationByItemId.get(item.id)?.scheduledDate ?? item.plannedDate));
  const floatingItems = visibleItems.filter((item) => !parseExactDate(publicationByItemId.get(item.id)?.scheduledDate ?? item.plannedDate));
  const hasVaguePlanDates = items.some((item) => !parseExactDate(item.plannedDate));
  const itemsByDate = new Map<string, MaterialPlannedItem[]>();
  for (const item of exactDateItems) {
    const exactDate = parseExactDate(publicationByItemId.get(item.id)?.scheduledDate ?? item.plannedDate);
    if (!exactDate) continue;
    const key = dateKey(exactDate);
    itemsByDate.set(key, [...(itemsByDate.get(key) ?? []), item]);
  }
  const floatingGroups = groupCalendarItems(floatingItems);
  const calendarWeekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const selectedWeekStart = new Date(selectedDay);
  selectedWeekStart.setDate(selectedDay.getDate() - ((selectedDay.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, index) => new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), selectedWeekStart.getDate() + index));
  const threeDays = Array.from({ length: 3 }, (_, index) => new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() + index));
  const dayList = [selectedDay];
  const rangeDays =
    currentCalendarView === "week" ? weekDays :
    currentCalendarView === "threeDays" ? threeDays :
    currentCalendarView === "day" ? dayList :
    [];
  const renderCalendarCard = (item: MaterialPlannedItem, compact = false) => {
    const publication = publicationByItemId.get(item.id);
    const assets = visualAssetsForMaterial(item, publication);
    const visual = assets.flatMap((asset) => asset.generatedVariants)[0] ?? item.generatedCreativeVariants[0];
    const slideCount = assets.length > 1 ? assets.length : 0;
    const action = materialNextActionLabel(item, publication);

    return (
      <a
        key={item.id}
        href={materialWorkspaceHref(draftsHref, item.id)}
        className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_4px_14px_rgba(88,75,135,0.045)] transition hover:border-violet-200 hover:shadow-[0_10px_26px_rgba(88,75,135,0.11)]"
      >
        {visual ? (
          <GeneratedVisualImage
            variant={visual}
            alt={visual.variantTitle}
            className={`${compact ? "h-16" : "h-20"} w-full bg-slate-100 object-cover`}
          />
        ) : (
          <div className={`${compact ? "h-16" : "h-20"} flex items-center justify-center bg-slate-50 px-3 text-center text-[11px] font-semibold text-slate-400`}>
            Нет визуала
          </div>
        )}
        <div className="p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{shortPlatformName(item.platformName)}</span>
            {slideCount > 1 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{slideCount} карточки</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${nextActionBadgeClass(action)}`}>{action}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-4 text-slate-950">{item.topic}</p>
          <span className="mt-2 inline-flex text-[10px] font-semibold text-violet-600 opacity-0 transition group-hover:opacity-100">Открыть материал</span>
        </div>
      </a>
    );
  };

  return (
    <section id="calendar" className="rounded-[28px] bg-[#f7f5fb] p-4 text-slate-900 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Календарь</h2>
          <p className="mt-1 text-sm text-slate-500">{clientName ?? "Клиент не выбран"} · {calendarMonthLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {monthlyPlanId && hasVaguePlanDates ? (
            <form action={autoScheduleMonthlyPlanDates}>
              <input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
              <input type="hidden" name="calendarView" value={currentCalendarView} />
              <input type="hidden" name="calendarDate" value={dateKey(selectedDay)} />
              <input type="hidden" name="filter" value={currentFilter} />
              <PendingSubmitButton pendingLabel="Расставляем даты..." className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300">
                Расставить даты
              </PendingSubmitButton>
            </form>
          ) : null}
          <div className="flex rounded-full bg-white p-1 shadow-sm">
            {calendarViews.map((viewMode) => (
              <a
                key={viewMode.id}
                href={calendarHref(currentFilter, viewMode.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  currentCalendarView === viewMode.id ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:text-violet-700"
                }`}
              >
                {viewMode.label}
              </a>
            ))}
          </div>
          <a href={previousPeriodHref} aria-label="Предыдущий период" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
            ←
          </a>
          <a href={todayHref} className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100">Сегодня</a>
          <a href={nextPeriodHref} aria-label="Следующий период" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
            →
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-1.5">
          {filters.map((filter) => (
            <a
              key={filter.id}
              href={calendarHref(filter.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                currentFilter === filter.id ? "bg-violet-50 text-violet-700" : "bg-white text-slate-500 hover:text-violet-700"
              }`}
            >
              {filter.label}
            </a>
          ))}
      </div>

      {items.length > 0 ? (
        <>
          <div className="mt-4 rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[1180px] rounded-[24px] border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold capitalize text-slate-950">{calendarMonthLabel}</h3>
                    <p className="text-xs font-semibold text-slate-400">{visibleItems.length} материалов в текущем фильтре</p>
                  </div>
                  <a href={draftsHref} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700">
                    Открыть материалы
                  </a>
                </div>
                {currentCalendarView === "month" ? (
                  <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200">
                    {calendarWeekdays.map((day) => (
                      <div key={day} className="bg-white px-2 py-2 text-center text-[11px] font-semibold text-slate-400">
                        {day}
                      </div>
                    ))}
                    {calendarCells.map((date) => {
                      const key = dateKey(date);
                      const dayItems = itemsByDate.get(key) ?? [];
                      const inMonth = date.getMonth() === calendarMonth;

                      return (
                        <div key={key} className={`min-h-[252px] bg-white p-2.5 ${inMonth ? "" : "opacity-45"}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className={`text-xs font-semibold ${inMonth ? "text-slate-700" : "text-slate-400"}`}>{date.getDate()}</span>
                            {dayItems.length > 0 ? <span className="text-[10px] font-semibold text-violet-500">{dayItems.length}</span> : null}
                          </div>
                          <div className="grid gap-2">
                            {dayItems.slice(0, 2).map((item) => renderCalendarCard(item, true))}
                            {dayItems.length > 2 ? (
                              <a href={materialWorkspaceHref(draftsHref, dayItems[2].id)} className="rounded-xl bg-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:text-violet-700">
                                + ещё {dayItems.length - 2}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200" style={{ gridTemplateColumns: `repeat(${rangeDays.length}, minmax(${currentCalendarView === "day" ? "560px" : "260px"}, 1fr))` }}>
                    {rangeDays.map((date) => {
                      const key = dateKey(date);
                      const dayItems = itemsByDate.get(key) ?? [];

                      return (
                        <section key={key} className="min-h-[560px] bg-white p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-400">{date.toLocaleDateString("ru-RU", { weekday: "short" })}</p>
                              <h4 className="text-base font-semibold text-slate-950">{date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</h4>
                            </div>
                            {dayItems.length > 0 ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{dayItems.length}</span> : null}
                          </div>
                          <div className={`grid gap-3 ${currentCalendarView === "day" ? "md:grid-cols-2" : ""}`}>
                            {dayItems.map((item) => renderCalendarCard(item))}
                            {dayItems.length === 0 ? (
                              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">На этот день материалов нет.</p>
                            ) : null}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {visibleItems.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                По этому фильтру материалов нет.
              </div>
            ) : null}
          </div>

          {floatingGroups.length > 0 ? (
            <section className="mt-4 rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Без точной даты</h3>
                  <p className="text-xs font-semibold text-slate-400">Материалы с недельной привязкой остаются отдельно.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{floatingItems.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {floatingGroups.map((group) => (
                  <div key={group.label} className="rounded-2xl bg-slate-50/80 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{group.label}</p>
                      <span className="text-[10px] font-semibold text-slate-400">{group.items.length}</span>
                    </div>
                    <div className="grid gap-2">
                      {group.items.map((item) => renderCalendarCard(item))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="mt-4 rounded-[24px] border border-violet-200 bg-white p-6">
          <div>
            <p className="text-sm font-semibold text-slate-950">Календарь готов к первому месячному плану.</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Сгенерируйте месячный план, чтобы увидеть материалы по датам и неделям.</p>
          </div>
          {blueprintId ? (
            <form action={generateMonthlyPlan} className="mt-4">
              <input type="hidden" name="blueprintId" value={blueprintId} />
              <PendingSubmitButton pendingLabel="Генерируем месячный план..." disabled={generationBlocked} className="rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300">
                Сгенерировать месячный план
              </PendingSubmitButton>
            </form>
          ) : (
            <a href={clientSetupHref} className="mt-4 inline-flex text-sm font-semibold text-violet-700 transition hover:text-violet-900">
              Начать с настройки клиента
            </a>
          )}
        </div>
      )}
    </section>
  );
}

type ClientSetupClient = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  briefs: Array<{
    id: string;
    rawBrief: string;
    createdAt: Date;
    blueprint: { id: string } | null;
  }>;
  blueprints: Array<{ id: string }>;
};

type ClientSetupBlueprint = {
  id: string;
  clientId: string;
  clientSummary: string;
  confidenceScore: number;
  totalContentUnitsMin: number;
  totalContentUnitsMax: number;
  nextRecommendedAction: string;
  client: {
    id: string;
    name: string;
    industry: string | null;
  };
  selectedModules: Array<{ id: string }>;
  platformRecommendations: Array<{ id: string; platformName: string; recommendation: string }>;
  monthlyPlans: Array<{
    id: string;
    month: string;
    status: string;
    totalPlannedUnits: number;
    plannedContentItems: Array<{ id: string }>;
    platforms: Array<{ id: string }>;
    managerTasks: Array<{ id: string }>;
  }>;
};

function inferClientSetupStep({
  requestedStep,
  clients,
  selectedClient,
  selectedBrief,
  blueprint,
  monthlyPlan,
}: {
  requestedStep?: string;
  clients: ClientSetupClient[];
  selectedClient: ClientSetupClient | null;
  selectedBrief: ClientSetupClient["briefs"][number] | null;
  blueprint: ClientSetupBlueprint | null;
  monthlyPlan: ClientSetupBlueprint["monthlyPlans"][number] | null;
}): SetupStep {
  if (setupSteps.includes(requestedStep as SetupStep)) return requestedStep as SetupStep;
  if (clients.length === 0) return "create_client";
  if (!selectedClient) return "create_client";
  if (!selectedBrief) return "brief";
  if (!blueprint) return "blueprint";
  if (!monthlyPlan) return "monthly_plan";
  return "brand";
}

function setupStepState(step: SetupStep, activeStep: SetupStep) {
  const stepIndex = setupSteps.indexOf(step);
  const activeIndex = setupSteps.indexOf(activeStep);

  if (stepIndex < activeIndex) return "Готово";
  if (stepIndex === activeIndex) return "Текущий шаг";
  return "Далее";
}

function setupStepTone(step: SetupStep, activeStep: SetupStep): "neutral" | "teal" | "green" {
  const stepIndex = setupSteps.indexOf(step);
  const activeIndex = setupSteps.indexOf(activeStep);

  if (stepIndex < activeIndex) return "green";
  if (stepIndex === activeIndex) return "teal";
  return "neutral";
}

function ClientSetupWizard({
  clients,
  selectedClient,
  selectedBrief,
  blueprint,
  monthlyPlan,
  requestedStep,
  workspaceContext,
}: {
  clients: ClientSetupClient[];
  selectedClient: ClientSetupClient | null;
  selectedBrief: ClientSetupClient["briefs"][number] | null;
  blueprint: ClientSetupBlueprint | null;
  monthlyPlan: ClientSetupBlueprint["monthlyPlans"][number] | null;
  requestedStep?: string;
  workspaceContext: WorkspaceContext;
}) {
  const activeStep = inferClientSetupStep({
    requestedStep,
    clients,
    selectedClient,
    selectedBrief,
    blueprint,
    monthlyPlan,
  });
  const context = {
    ...workspaceContext,
    client: selectedClient?.id ?? workspaceContext.client,
    blueprint: blueprint?.id ?? workspaceContext.blueprint,
    plan: monthlyPlan?.id ?? workspaceContext.plan,
  };
  const recommendedPlatformsCount =
    blueprint?.platformRecommendations.filter((platform) => platform.recommendation === "recommended").length ?? 0;

  return (
    <section id="client-setup" className="mx-auto max-w-6xl scroll-mt-24">
      <WorkspaceViewHeader
        eyebrow="Настройка клиента"
        title="Пошаговая конфигурация"
        description="Создайте клиента, сохраните бриф, соберите Blueprint, месячный план и подключите брендовый контекст без длинной простыни настроек."
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {setupSteps.map((step, index) => (
          <a
            key={step}
            href={clientSetupHref(step, context)}
            className={`rounded-lg border p-3 transition hover:border-violet-300 hover:bg-violet-50/50 ${
              step === activeStep ? "border-violet-300 bg-violet-50/70" : "border-stone-200 bg-white"
            }`}
          >
            <p className="text-xs font-bold text-stone-400">{index + 1}</p>
            <p className="mt-1 text-sm font-semibold text-stone-950">{setupStepLabels[step]}</p>
            <div className="mt-2">
              <StatusBadge tone={setupStepTone(step, activeStep)}>{setupStepState(step, activeStep)}</StatusBadge>
            </div>
          </a>
        ))}
      </div>

      <section className={`${panelClass} mt-5 p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400">Клиент в работе</p>
            <h3 className="mt-1 font-semibold text-stone-950">{selectedClient?.name ?? "Клиент не выбран"}</h3>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              {selectedClient ? selectedClient.industry || "Сфера бизнеса не указана" : "Сначала создайте клиента или выберите существующего."}
            </p>
          </div>
	          <div className="flex flex-wrap gap-2">
	            <a href={clientSetupHref("create_client", context)} className={secondaryButtonClass}>Создать нового клиента</a>
	            {selectedClient ? (
	              <form action={duplicateClientForTesting}>
	                <input type="hidden" name="clientId" value={selectedClient.id} />
	                <PendingSubmitButton pendingLabel="Копируем..." className={secondaryButtonClass}>
	                  Дублировать для теста
	                </PendingSubmitButton>
	              </form>
	            ) : null}
	            {monthlyPlan ? (
	              <details className="rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800">
	                <summary className="cursor-pointer">Переделать месяц</summary>
	                <form action={rebuildMonthProduction} className="absolute z-10 mt-3 grid w-[min(92vw,440px)] gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm shadow-[0_18px_50px_rgba(88,75,135,0.16)]">
	                  <input type="hidden" name="monthlyPlanId" value={monthlyPlan.id} />
	                  <p className="font-semibold text-slate-950">Переделать месяц?</p>
	                  <p className="text-slate-500">Текущий план сохранится как предыдущая версия. Новый месяц будет собран заново по текущему scope.</p>
	                  <PendingSubmitButton pendingLabel="Пересобираем..." className="rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300">
	                    Переделать месяц
	                  </PendingSubmitButton>
	                </form>
	              </details>
	            ) : blueprint ? (
	              <form action={prepareOrContinueMonthProduction}>
	                <input type="hidden" name="blueprintId" value={blueprint.id} />
	                <input type="hidden" name="clientId" value={blueprint.clientId} />
	                <PendingSubmitButton pendingLabel="Готовим месяц..." disabled={blueprint.nextRecommendedAction === "request_more_brief_data"} className="rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300">
	                  Подготовить месяц
	                </PendingSubmitButton>
	              </form>
	            ) : null}
	          </div>
	        </div>
        {clients.length > 0 ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {clients.slice(0, 6).map((client) => {
              const clientBrief = client.briefs[0] ?? null;
              const clientBlueprint = client.blueprints[0] ?? clientBrief?.blueprint ?? null;

              return (
                <a
                  key={client.id}
                  href={clientSetupHref("brief", { client: client.id, blueprint: clientBlueprint?.id })}
                  className={`rounded-lg border p-3 transition hover:border-violet-300 hover:bg-violet-50/60 ${
                    selectedClient?.id === client.id ? "border-violet-300 bg-violet-50/60" : "border-stone-200 bg-stone-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-stone-950">{client.name}</p>
                    <StatusBadge tone={clientBlueprint ? "green" : clientBrief ? "amber" : "neutral"}>
                      {clientBlueprint ? "Blueprint" : clientBrief ? "Бриф" : "Новый"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-stone-500">{client.website || client.industry || "Нет дополнительных данных"}</p>
                </a>
              );
            })}
          </div>
        ) : null}
      </section>

      <div className="mt-5">
        {activeStep === "create_client" ? (
          <section className={`${panelClass} p-5 sm:p-6`}>
            <SectionTitle
              eyebrow="Шаг 1"
              title="Создать клиента"
              description="Добавьте базовые данные клиента. После создания вы перейдёте к брифу."
            />
            <form action={createClient} className="mt-5 grid max-w-2xl gap-3">
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
            <p className="mt-4 text-xs leading-5 text-stone-500">После создания клиента вы перейдёте к брифу.</p>
          </section>
        ) : null}

        {activeStep === "brief" ? (
          <section className={`${panelClass} p-5 sm:p-6`}>
            <SectionTitle
              eyebrow="Шаг 2"
              title="Добавить бриф"
              description="Бриф даёт AI исходные данные для сборки Blueprint — стратегической конфигурации клиента."
            />
            {!selectedClient ? (
              <div className="mt-5"><EmptyState>Сначала создайте клиента.</EmptyState></div>
            ) : selectedBrief ? (
              <div className="mt-5 grid gap-4">
                <article className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold text-violet-700">{selectedClient.name}</p>
                      <p className="mt-2 line-clamp-4 text-sm leading-6 text-stone-600">{selectedBrief.rawBrief}</p>
                    </div>
                    <StatusBadge tone="green">Бриф сохранён</StatusBadge>
                  </div>
                  <details className="mt-4 rounded-md border border-stone-200 bg-white">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-stone-700">Редактировать бриф</summary>
                    <form action={updateClientBrief} className="grid gap-3 border-t border-stone-200 p-3">
                      <input type="hidden" name="briefId" value={selectedBrief.id} />
                      <textarea name="rawBrief" required rows={7} defaultValue={selectedBrief.rawBrief} className={`${inputClass} resize-y`} />
                      <p className="text-xs leading-5 text-stone-500">Если у брифа уже есть Blueprint, он будет удалён и его нужно будет сгенерировать заново.</p>
                      <PendingSubmitButton pendingLabel="Сохраняем..." className={secondaryButtonClass}>
                        Сохранить изменения
                      </PendingSubmitButton>
                    </form>
                  </details>
                </article>
                <a href={clientSetupHref("blueprint", { client: selectedClient.id, blueprint: blueprint?.id ?? selectedBrief.blueprint?.id })} className={primaryButtonClass}>
                  Перейти к Blueprint
                </a>
              </div>
            ) : (
              <form action={addClientBrief} className="mt-5 grid gap-3">
                <input type="hidden" name="clientId" value={selectedClient.id} />
                <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                  Бриф клиента
                  <textarea
                    name="rawBrief"
                    required
                    rows={9}
                    className={`${inputClass} resize-y`}
                    placeholder="Цели, аудитория, текущие площадки, ограничения, риски бренда, ресурсы команды..."
                  />
                </label>
                <PendingSubmitButton pendingLabel="Сохраняем..." className={primaryButtonClass}>
                  Сохранить бриф
                </PendingSubmitButton>
                <p className="text-xs leading-5 text-stone-500">Добавьте бриф, чтобы AI смог собрать Blueprint.</p>
              </form>
            )}
          </section>
        ) : null}

        {activeStep === "blueprint" ? (
          <section className={`${panelClass} p-5 sm:p-6`}>
            <SectionTitle
              eyebrow="Шаг 3"
              title="Сгенерировать Blueprint"
              description="Blueprint появится после генерации на основе брифа и станет исполнимой конфигурацией клиента."
            />
            {!selectedClient ? (
              <div className="mt-5"><EmptyState>Сначала создайте клиента.</EmptyState></div>
            ) : !selectedBrief ? (
              <div className="mt-5"><EmptyState>Добавьте бриф, чтобы AI смог собрать Blueprint.</EmptyState></div>
            ) : blueprint ? (
              <div className="mt-5 grid gap-4">
                <article className="rounded-lg border border-violet-200 bg-violet-50/70 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <StatusBadge tone="green">Blueprint готов</StatusBadge>
                      <h3 className="mt-3 text-xl font-semibold leading-8 text-stone-950">{blueprint.clientSummary}</h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600">{blueprint.client.industry || selectedClient.industry || "Сфера бизнеса не указана"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:min-w-80">
                      <MetricCard label="Уверенность" value={`${blueprint.confidenceScore}%`} tone="teal" />
                      <MetricCard label="Материалов/мес" value={`${blueprint.totalContentUnitsMin}-${blueprint.totalContentUnitsMax}`} />
                      <MetricCard label="Модулей" value={blueprint.selectedModules.length} />
                      <MetricCard label="Площадок" value={recommendedPlatformsCount} tone="amber" />
                    </div>
                  </div>
                </article>
                <a href={clientSetupHref("monthly_plan", { client: selectedClient.id, blueprint: blueprint.id, plan: monthlyPlan?.id })} className={primaryButtonClass}>
                  Перейти к месячному плану
                </a>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <article className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                  <p className="text-sm font-semibold text-stone-950">{selectedClient.name}</p>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-stone-600">{selectedBrief.rawBrief}</p>
                </article>
                <form action={generateBlueprint}>
                  <input type="hidden" name="briefId" value={selectedBrief.id} />
                  <PendingSubmitButton pendingLabel="Генерируем Blueprint..." className={primaryButtonClass}>
                    Сгенерировать Blueprint
                  </PendingSubmitButton>
                </form>
                <p className="text-xs leading-5 text-stone-500">Blueprint появится после генерации на основе брифа.</p>
              </div>
            )}
          </section>
        ) : null}

        {activeStep === "monthly_plan" ? (
          <section className={`${panelClass} p-5 sm:p-6`}>
            <SectionTitle
              eyebrow="Шаг 4"
              title="Сгенерировать месячный план"
              description="Месячный план превращает Blueprint в календарь материалов, площадок, задач и правил подготовки пакета."
            />
            {!blueprint ? (
              <div className="mt-5"><EmptyState>Blueprint появится после генерации на основе брифа.</EmptyState></div>
            ) : monthlyPlan ? (
              <div className="mt-5 grid gap-4">
                <article className="rounded-lg border border-violet-200 bg-violet-50/70 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <StatusBadge tone="green">{formatStatus(monthlyPlan.status)}</StatusBadge>
                      <h3 className="mt-3 text-xl font-semibold text-stone-950">{monthlyPlan.month}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:min-w-80">
                      <MetricCard label="Материалов" value={monthlyPlan.plannedContentItems.length} tone="teal" />
                      <MetricCard label="Площадок" value={monthlyPlan.platforms.length} />
                      <MetricCard label="Задач" value={monthlyPlan.managerTasks.length} tone="amber" />
                      <MetricCard label="План всего" value={monthlyPlan.totalPlannedUnits} />
                    </div>
                  </div>
                </article>
                <a href={clientSetupHref("brand", { client: blueprint.clientId, blueprint: blueprint.id, plan: monthlyPlan.id })} className={primaryButtonClass}>
                  Перейти к бренду
                </a>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <article className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                  <p className="text-sm font-semibold text-stone-950">{blueprint.client.name}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">{blueprint.clientSummary}</p>
                </article>
	                <form action={generateMonthlyPlan} className="grid gap-4">
	                  <input type="hidden" name="blueprintId" value={blueprint.id} />
	                  <div className="grid max-w-sm gap-3">
	                    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
	                      Месяц
	                      <input name="month" readOnly value={currentMonth()} className={inputClass} />
	                    </label>
	                  </div>
	                  <MonthScopeFields defaultPlatforms={blueprint.platformRecommendations
	                    .filter((platform) => platform.recommendation === "recommended")
	                    .map((platform) => platform.platformName)
	                    .join("\n") || undefined} />
	                  <PendingSubmitButton pendingLabel="Генерируем месячный план..." disabled={blueprint.nextRecommendedAction === "request_more_brief_data"} className={primaryButtonClass}>
	                    Сгенерировать месячный план
	                  </PendingSubmitButton>
	                </form>
                {blueprint.nextRecommendedAction === "request_more_brief_data" ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
                    Месячный план нельзя сгенерировать, пока не заполнены недостающие данные брифа.
                  </p>
                ) : (
                  <p className="text-xs leading-5 text-stone-500">Месячный план появится после генерации Blueprint.</p>
                )}
              </div>
            )}
          </section>
        ) : null}

        {activeStep === "brand" ? (
          <section className={`${panelClass} p-5 sm:p-6`}>
            <SectionTitle
              eyebrow="Шаг 5"
              title="Библиотека бренда"
              description="Заполните профиль бренда и загрузите материалы, чтобы AI точнее готовил тексты, ТЗ и визуалы."
            />
            {!selectedClient ? (
              <div className="mt-5"><EmptyState>Сначала создайте клиента.</EmptyState></div>
            ) : (
              <div className="mt-5 grid gap-4">
                <article className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                  <p className="font-semibold text-stone-950">{selectedClient.name}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Библиотека бренда хранит тональность, ограничения, брендбук, старые посты, фото, презентации и другие материалы для AI-контекста.
                  </p>
                </article>
                <a
                  href={workspaceHref("brand_assets", { client: selectedClient.id, blueprint: blueprint?.id, plan: monthlyPlan?.id })}
                  className={primaryButtonClass}
                >
                  Открыть библиотеку бренда
                </a>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </section>
  );
}

function ClientsBasePage({
  clients,
  workspaceContext,
  createClientHref,
}: {
  clients: ClientSetupClient[];
  workspaceContext: WorkspaceContext;
  createClientHref: string;
}) {
  return (
    <section id="clients" className="min-h-[calc(100vh-132px)] rounded-[28px] bg-[#f7f5fb] p-4 text-slate-900 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Клиентская база</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Клиенты</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Выберите клиента для работы, настройки брифа, Blueprint, месячного плана и брендового контекста.
          </p>
        </div>
        <a href={createClientHref} className="inline-flex items-center justify-center rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">
          Создать клиента
        </a>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => {
          const clientBlueprint = client.blueprints[0];
          const clientBrief = client.briefs[0];
          const statusLabel = clientBlueprint ? "Blueprint готов" : clientBrief ? "Есть бриф" : "Нужен бриф";
          const description =
            clientBrief?.rawBrief ||
            client.website ||
            "Клиент пока без подробного брифа. Откройте настройку, чтобы добавить исходные данные.";

          return (
            <article key={client.id} className="group min-w-0 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.045)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_16px_34px_rgba(88,75,135,0.09)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-slate-950">{client.name}</h3>
                  <p className="mt-1 truncate text-sm text-slate-500">{client.industry || "Сфера бизнеса не указана"}</p>
                </div>
                <span className="shrink-0 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  {statusLabel}
                </span>
              </div>

              <p className="mt-4 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-slate-500">{description}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-slate-400">Брифов</p>
                  <p className="mt-1 font-semibold text-slate-950">{client.briefs.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-slate-400">Blueprint</p>
                  <p className="mt-1 font-semibold text-slate-950">{clientBlueprint ? "готов" : "не создан"}</p>
                </div>
              </div>

	              <div className="mt-4 grid gap-2 sm:grid-cols-2">
	                <a
	                  href={workspaceHref("client_setup", { ...workspaceContext, client: client.id, blueprint: clientBlueprint?.id })}
	                  className="inline-flex items-center justify-center rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
	                >
	                  Открыть
	                </a>
	                <form action={duplicateClientForTesting}>
	                  <input type="hidden" name="clientId" value={client.id} />
	                  <PendingSubmitButton pendingLabel="Копируем..." className="w-full rounded-full border border-violet-100 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:border-violet-200 hover:bg-violet-50">
	                    Дублировать для теста
	                  </PendingSubmitButton>
	                </form>
	              </div>
	            </article>
          );
        })}
      </div>

      {clients.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-violet-200 bg-white p-6 text-sm leading-6 text-slate-500">
          Клиентов пока нет. Создайте первого клиента и добавьте бриф, чтобы собрать Blueprint.
        </div>
      ) : null}
    </section>
  );
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function safeLoadSelectedBrandClient(clientId: string) {
  try {
    return await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        brandProfile: true,
        brandAssets: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    console.error("Failed to load brand assets", error);
    return null;
  }
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
                    creativeAssets: {
                      include: {
                        generatedVariants: {
                          orderBy: { createdAt: "desc" },
                          select: generatedCreativeVariantPreviewSelect,
                        },
                      },
                    },
                    generatedCreativeVariants: {
                      orderBy: { createdAt: "desc" },
                      select: generatedCreativeVariantPreviewSelect,
                    },
                  },
                },
                managerTasks: true,
                clientPortalLinks: {
                  orderBy: { createdAt: "desc" },
                },
                revisionProposals: {
                  orderBy: { createdAt: "desc" },
                },
	                generationJobs: {
	                  orderBy: { createdAt: "desc" },
	                  take: 30,
	                },
	                productionRuns: {
	                  orderBy: { createdAt: "desc" },
	                  take: 3,
	                  include: {
	                    tasks: {
	                      orderBy: { createdAt: "asc" },
	                    },
	                  },
	                },
	                creativeAssets: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    scheduledPublication: true,
                    contentDraft: true,
                    generatedVariants: {
                      orderBy: { createdAt: "desc" },
                      select: generatedCreativeVariantPreviewSelect,
                    },
                  },
                },
                scheduledPublications: {
                  orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
                  include: {
                    contentDraft: true,
                    plannedContentItem: true,
                    metrics: {
                      orderBy: { capturedAt: "desc" },
                      take: 1,
                    },
                    creativeAssets: {
                      include: {
                        generatedVariants: {
                          orderBy: { createdAt: "desc" },
                          select: generatedCreativeVariantPreviewSelect,
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

  const fallbackClient = params.client
    ? clients.find((client) => client.id === params.client)
    : clients[0];
  const latestBlueprint =
    selectedBlueprint ??
    (fallbackClient?.blueprints[0]
      ? await prisma.clientPresenceBlueprint.findUnique({
          where: { id: fallbackClient.blueprints[0].id },
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
                    creativeAssets: {
                      include: {
                        generatedVariants: {
                          orderBy: { createdAt: "desc" },
                          select: generatedCreativeVariantPreviewSelect,
                        },
                      },
                    },
                    generatedCreativeVariants: {
                      orderBy: { createdAt: "desc" },
                      select: generatedCreativeVariantPreviewSelect,
                    },
                  },
                },
                managerTasks: true,
                clientPortalLinks: {
                  orderBy: { createdAt: "desc" },
                },
                revisionProposals: {
                  orderBy: { createdAt: "desc" },
                },
	                generationJobs: {
	                  orderBy: { createdAt: "desc" },
	                  take: 30,
	                },
	                productionRuns: {
	                  orderBy: { createdAt: "desc" },
	                  take: 3,
	                  include: {
	                    tasks: {
	                      orderBy: { createdAt: "asc" },
	                    },
	                  },
	                },
	                creativeAssets: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    scheduledPublication: true,
                    contentDraft: true,
                    generatedVariants: {
                      orderBy: { createdAt: "desc" },
                      select: generatedCreativeVariantPreviewSelect,
                    },
                  },
                },
                scheduledPublications: {
                  orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
                  include: {
                    contentDraft: true,
                    plannedContentItem: true,
                    metrics: {
                      orderBy: { capturedAt: "desc" },
                      take: 1,
                    },
                    creativeAssets: {
                      include: {
                        generatedVariants: {
                          orderBy: { createdAt: "desc" },
                          select: generatedCreativeVariantPreviewSelect,
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
  const brandClientId = params.client ?? latestBlueprint?.clientId ?? clients[0]?.id;
  const selectedBrandClient = !isProductionBuild && brandClientId
    ? await safeLoadSelectedBrandClient(brandClientId)
    : null;

  const currentMonthlyPlan =
    latestBlueprint?.monthlyPlans.find((plan) => plan.month === currentMonth() && !["archived", "replaced"].includes(plan.status)) ?? null;
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
  const clientRevisions = buildClientRevisions(selectedMonthlyPlan?.plannedContentItems ?? []);
  const openClientRevisionCount = clientRevisions.filter((revision) => revision.status === "new" || revision.status === "in_progress").length;
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
  const overviewCalendarItems: OverviewCalendarItem[] = (selectedMonthlyPlan?.plannedContentItems ?? []).map((item) => {
    const publication = selectedMonthlyPlan?.scheduledPublications.find(
      (pub) => pub.plannedContentItemId === item.id,
    );
    return {
      id: item.id,
      date: publication?.scheduledDate ?? item.plannedDate ?? null,
      platformName: item.platformName,
      topic: item.topic,
      status: item.contentDraft?.status ?? null,
    };
  });
  const latestProductionRun = selectedMonthlyPlan?.productionRuns[0];
  const creativeAssetAttentionCount =
    creativeAssets.filter((asset) => ["needed", "brief_ready", "in_production", "needs_review"].includes(asset.status)).length +
    (selectedMonthlyPlan?.scheduledPublications.filter(
      (publication) => publication.status === "needs_assets" && publication.creativeAssets.length === 0,
    ).length ?? 0);
  const missingVisualCount =
    selectedMonthlyPlan?.scheduledPublications.filter((publication) => {
      const slideAssets = publication.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");
      const requiredAssets = slideAssets.length > 0
        ? slideAssets
        : publication.creativeAssets.filter((asset) => !isLegacyCombinedCarouselAssetPreview(asset));

      return requiredAssets.length === 0 || requiredAssets.some((asset) => asset.generatedVariants.length === 0);
    }).length ?? 0;
  const brandProfileReady = Boolean(selectedBrandClient?.brandProfile);
  const brandAssetsCount = selectedBrandClient?.brandAssets.length ?? 0;
  const selectedSetupClient =
    clients.find((client) => client.id === (params.client ?? latestBlueprint?.clientId)) ??
    (latestBlueprint ? clients.find((client) => client.id === latestBlueprint.clientId) : null) ??
    clients[0] ??
    null;
  const selectedSetupBrief =
    selectedSetupClient?.briefs.find((brief) => brief.id === latestBlueprint?.brief.id) ??
    selectedSetupClient?.briefs[0] ??
    null;
  const workspaceContext = {
    blueprint: latestBlueprint?.id ?? params.blueprint,
    plan: selectedMonthlyPlan?.id ?? params.plan,
    client: params.client ?? latestBlueprint?.clientId ?? selectedSetupClient?.id,
  };
  const workspaceLinks = Object.fromEntries(
    workspaceViews.map((view) => [view, workspaceHref(view, workspaceContext)]),
  ) as Record<WorkspaceView, string>;
  const n8nConfigured = Boolean(process.env.N8N_WEBHOOK_URL?.trim());
  const integrationEvents = await prisma.integrationEvent
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, direction: true, eventType: true, status: true, createdAt: true },
    })
    .catch(() => [] as Array<{ id: string; direction: string; eventType: string; status: string; createdAt: Date }>);
  const telegramBotUsername = await prisma.integrationSetting
    .findUnique({ where: { key: "telegram_bot_username" }, select: { value: true } })
    .then((row) => row?.value ?? null)
    .catch(() => null);
  const telegramTokenSet = await prisma.integrationSetting
    .findUnique({ where: { key: "telegram_bot_token" }, select: { id: true } })
    .then(Boolean)
    .catch(() => false);
  const telegramClientId = workspaceContext.client ?? null;
  const telegramClientName = clients.find((client) => client.id === telegramClientId)?.name ?? null;
  const telegramChannels = telegramClientId
    ? await prisma.clientChannel
        .findMany({
          where: { clientId: telegramClientId, platform: "telegram", status: "active" },
          orderBy: { createdAt: "asc" },
          select: { id: true, channelId: true, title: true },
        })
        .catch(() => [] as Array<{ id: string; channelId: string; title: string | null }>)
    : [];

  return (
    <div className={pageBackgroundClass}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 border-r border-slate-200 bg-white text-slate-700 lg:flex lg:flex-col">
        <div className="flex justify-center px-3 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white" title="Adaptive Presence OS">
            AP
          </div>
        </div>

        <nav className="flex-1 px-3 py-3">
          <div className="grid gap-2">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="sr-only">{group.label}</p>
                <div className="mt-2 grid gap-1">
                  {group.items.map((item) => (
                    <a
                      key={item.label}
                      href={workspaceLinks[item.view]}
                      title={item.label}
                      aria-label={item.label}
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm transition ${
                        item.view === activeView
                          ? "bg-violet-50 font-semibold text-violet-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      <SidebarIcon name={item.icon} />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div id="settings" className="grid gap-2 border-t border-slate-100 px-3 py-4">
          <a
            href={workspaceLinks.settings}
            title="Настройки"
            aria-label="Настройки"
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
              activeView === "settings" ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <SidebarIcon name="settings" />
          </a>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-700" title="Профиль менеджера">
            <SidebarIcon name="profile" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-20">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="flex min-h-16 flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 xl:px-9">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-600 text-xs font-bold text-white lg:hidden">
                AP
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold text-slate-950">{viewTitles[activeView]}</h1>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">Manager Console</span>
                </div>
                <p className="mt-0.5 text-xs font-medium text-slate-400">Adaptive Presence OS · by Creative</p>
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
                  {activeView !== "overview" ? (
                    <input
                      aria-label="Поиск по рабочему пространству"
                      className="w-64 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      placeholder="Клиенты, материалы, события..."
                    />
                  ) : null}
                  <button type="button" aria-label="Уведомления" className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
                    <SidebarIcon name="bell" className="h-3.5 w-3.5" />
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] text-white">{approvalQueueCount}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-5 xl:px-6">
          <div className="mx-auto max-w-[1680px]">
            {params.error ? (
              <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                {params.error}
              </div>
            ) : null}
            {params.notice ? (
              <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-900">
                {params.notice}
              </div>
            ) : null}

            {activeView !== "clients" ? <WorkspaceSwitcher activeView={activeView} links={workspaceLinks} revisionCount={openClientRevisionCount} /> : null}

            {activeView === "overview" ? (
              <OverviewDashboard
                currentMonthLabel={currentMonth()}
                workspaceLinks={workspaceLinks}
                latestBlueprint={latestBlueprint}
                needsManagerReviewCount={needsManagerReviewCount}
                waitingForClientCount={openClientRevisionCount}
                approvedDraftCount={approvedDraftCount}
                readyToScheduleCount={readyToScheduleCount}
                approvalQueueCount={approvalQueueCount}
                integrationTaskCount={integrationTaskCount}
                plannedContentCount={plannedContentCount}
                draftCount={draftCount}
                productionProgress={productionProgress}
                missingTextCount={missingTextCount}
                missingVisualCount={missingVisualCount}
                brandProfileReady={brandProfileReady}
                brandAssetsCount={brandAssetsCount}
                generationJobs={generationJobs}
                month={selectedMonthlyPlan?.month}
                calendarItems={overviewCalendarItems}
              />
            ) : null}

            {activeView === "approvals" ? (
              <>
                <WorkspaceViewHeader
                  eyebrow="Комментарии клиента"
                  title="Правки"
                  description="Клиентские комментарии и запросы по материалам и месячному пакету. Внутренняя подготовка остаётся в Materials."
                />
                <ReviewQueue revisions={clientRevisions} draftsHref={workspaceLinks.drafts} />
              </>
            ) : null}

            {activeView === "calendar" ? (
              <>
                <ContentCalendar
                  groups={calendarGroups}
                  publications={selectedMonthlyPlan?.scheduledPublications ?? []}
                  month={selectedMonthlyPlan?.month ?? currentMonth()}
                  monthlyPlanId={selectedMonthlyPlan?.id}
                  blueprintId={latestBlueprint?.id}
                  clientName={latestBlueprint?.client.name}
                  generationBlocked={latestBlueprint?.nextRecommendedAction === "request_more_brief_data"}
                  draftsHref={workspaceLinks.drafts}
                  clientSetupHref={workspaceLinks.client_setup}
                  activeFilter={params.filter}
                  activeCalendarView={params.calendarView}
                  activeCalendarDate={params.calendarDate}
                />
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
	                productionRun={latestProductionRun}
	                monthlyPlanId={selectedMonthlyPlan?.id}
                blueprintId={latestBlueprint?.id}
                clientName={latestBlueprint?.client.name}
                month={selectedMonthlyPlan?.month}
                planStatus={selectedMonthlyPlan?.status}
                totalPlannedUnits={selectedMonthlyPlan?.totalPlannedUnits}
                clientId={latestBlueprint?.clientId}
                selectedMaterialId={params.materialId ?? params.material}
                activeFilter={params.filter}
                approvalsHref={workspaceLinks.approvals}
                calendarHref={workspaceLinks.calendar}
                assetsHref={workspaceLinks.assets}
                clientPortalHref={workspaceLinks.client_portal}
                reportsHref={workspaceLinks.reports}
                brandProfileReady={brandProfileReady}
                latestRevisionProposal={selectedMonthlyPlan?.revisionProposals[0]}
              />
            ) : null}

            {activeView === "client_portal" ? (
              <>
                <ClientPortalLinksPanel
                  blueprintId={latestBlueprint?.id}
                  monthlyPlanId={selectedMonthlyPlan?.id}
                  links={selectedMonthlyPlan?.clientPortalLinks ?? []}
                  newPortalLink={params.portalLink}
                  reportsHref={workspaceLinks.reports}
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

            {activeView === "brand_assets" ? (
              <BrandAssetsView
                client={selectedBrandClient}
                requestedStep={params.brandStep}
                workspaceContext={workspaceContext}
              />
            ) : null}

            {activeView === "clients" ? (
              <ClientsBasePage
                clients={clients}
                workspaceContext={workspaceContext}
                createClientHref={clientSetupHref("create_client", workspaceContext)}
              />
            ) : null}

            {activeView === "client_setup" ? (
              <ClientSetupWizard
                clients={clients}
                selectedClient={selectedSetupClient}
                selectedBrief={selectedSetupBrief}
                blueprint={latestBlueprint}
                monthlyPlan={selectedMonthlyPlan}
                requestedStep={params.setupStep}
                workspaceContext={workspaceContext}
              />
            ) : null}

            {activeView === "reports" ? (
              <MonthlyClientReport
                clientName={latestBlueprint?.client.name}
                month={selectedMonthlyPlan?.month}
                items={selectedMonthlyPlan?.plannedContentItems ?? []}
                publications={selectedMonthlyPlan?.scheduledPublications ?? []}
                assets={creativeAssets}
                jobs={generationJobs}
                draftsHref={workspaceLinks.drafts}
                downloadHref={selectedMonthlyPlan ? `/api/reports/pptx?plan=${selectedMonthlyPlan.id}` : undefined}
              />
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
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Хранилище визуалов</p>
                    <h3 className="mt-2 font-semibold text-stone-950">{process.env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob подключён" : "Vercel Blob не подключён"}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      {process.env.BLOB_READ_WRITE_TOKEN
                        ? "Новые визуалы и файлы библиотеки бренда сохраняются во внешнем хранилище."
                        : "Новые визуалы временно сохраняются в базе. Загрузка файлов библиотеки бренда недоступна до подключения Vercel Blob."}
                    </p>
                    <form action={clearLegacyBase64ForBlobVariants} className="mt-4 rounded-md border border-amber-200 bg-amber-50/70 p-3">
                      <p className="text-xs font-bold text-amber-950">Legacy base64</p>
                      <p className="mt-1 text-xs leading-5 text-amber-900">
                        Удаляет base64-копии у визуалов, которые уже сохранены в Vercel Blob.
                      </p>
                      <PendingSubmitButton pendingLabel="Очищаем..." className={`${secondaryButtonClass} mt-3`}>
                        Очистить legacy base64 у Blob-визуалов
                      </PendingSubmitButton>
                    </form>
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
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Интеграция n8n</p>
                    <h3 className="mt-2 font-semibold text-stone-950">{n8nConfigured ? "Webhook задан" : "Webhook не задан"}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      {n8nConfigured
                        ? "Платформа готова отправлять события в n8n. Адрес и секрет хранятся в переменных окружения и на экран не выводятся."
                        : "Задайте N8N_WEBHOOK_URL и N8N_SHARED_SECRET в переменных окружения Vercel, чтобы включить обмен с n8n."}
                    </p>
                    <p className="mt-3 border-t border-stone-200 pt-3 text-xs leading-5 text-stone-400">
                      Входящие: POST /api/integrations/n8n/ping и /publication-result с заголовком x-aps-secret.
                    </p>
                    <form action={testN8nConnection} className="mt-3">
                      <PendingSubmitButton
                        pendingLabel="Отправляем тест..."
                        className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
                      >
                        Проверить связь
                      </PendingSubmitButton>
                    </form>
                  </article>
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Telegram</p>
                    <h3 className="mt-2 font-semibold text-stone-950">
                      {telegramTokenSet ? `Бот подключён${telegramBotUsername ? `: @${telegramBotUsername}` : ""}` : "Бот не подключён"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      {telegramTokenSet
                        ? "Один бот-мастер публикует во все каналы клиентов. Токен хранится в базе и на экран не выводится."
                        : "Создайте бота в @BotFather и вставьте токен — он сохранится в платформе и будет публиковать во все каналы клиентов."}
                    </p>
                    <form action={saveTelegramBotToken} className="mt-3 grid gap-2">
                      <input
                        type="password"
                        name="botToken"
                        placeholder={telegramTokenSet ? "Вставьте новый токен, чтобы заменить" : "Токен из @BotFather"}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
                        autoComplete="off"
                      />
                      <div>
                        <PendingSubmitButton
                          pendingLabel="Проверяем токен..."
                          className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
                        >
                          {telegramTokenSet ? "Заменить токен" : "Подключить бота"}
                        </PendingSubmitButton>
                      </div>
                    </form>
                  </article>
                  <article className={`${panelClass} p-4`}>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Каналы клиента</p>
                    <h3 className="mt-2 font-semibold text-stone-950">{telegramClientName ?? "Клиент не выбран"}</h3>
                    {telegramChannels.length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {telegramChannels.map((channel) => (
                          <div key={channel.id} className="flex items-center justify-between gap-2 rounded-md border border-stone-100 bg-stone-50/70 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-stone-800">{channel.title || channel.channelId}</p>
                              <p className="truncate text-xs text-stone-400">{channel.channelId}</p>
                            </div>
                            <form action={archiveClientChannel}>
                              <input type="hidden" name="channelRecordId" value={channel.id} />
                              <button type="submit" className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-semibold text-stone-500 transition hover:border-rose-200 hover:text-rose-700">
                                Отключить
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-stone-500">
                        Каналы заполняются при онбординге клиента. Добавьте бота администратором канала, затем укажите адрес канала здесь.
                      </p>
                    )}
                    {telegramClientId ? (
                      <form action={addClientChannel} className="mt-3 grid gap-2">
                        <input type="hidden" name="clientId" value={telegramClientId} />
                        <input
                          type="text"
                          name="channelId"
                          placeholder="@канал или -100..."
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
                        />
                        <input
                          type="text"
                          name="title"
                          placeholder="Название (необязательно)"
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
                        />
                        <div>
                          <PendingSubmitButton
                            pendingLabel="Проверяем канал..."
                            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:border-violet-200 hover:text-violet-700"
                          >
                            Добавить канал
                          </PendingSubmitButton>
                        </div>
                      </form>
                    ) : null}
                  </article>
                </div>

                <article className={`${panelClass} mt-4 p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Последние события интеграций</p>
                    <span className="text-xs font-semibold text-stone-400">{integrationEvents.length}</span>
                  </div>
                  {integrationEvents.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {integrationEvents.map((event) => (
                        <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-100 bg-stone-50/70 px-3 py-2">
                          <p className="min-w-0 truncate text-sm font-semibold text-stone-800">
                            <span className="text-stone-400">{event.direction === "inbound" ? "входящее" : "исходящее"} · </span>
                            {event.eventType}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${integrationStatusTone(event.status)}`}>{event.status}</span>
                            <span className="text-xs text-stone-400">{event.createdAt.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-stone-500">Событий пока нет — появятся, когда платформа начнёт обмениваться данными с n8n.</p>
                  )}
                </article>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
