import {
  addClientBrief,
  approveDraft,
  approveCreativeVariant,
  archiveClientBrandAsset,
  clearLegacyBase64ForBlobVariants,
  createClientBrandAsset,
  createClientPortalLink,
  createCreativeAssetBrief,
  createClient,
  createPlannedContentItemManual,
  deleteCreativeVariant,
  deletePlannedContentItemManual,
  duplicatePlannedContentItemManual,
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
  proposeMonthlyPlanRevision,
  reviseMonthlyPlanWithCopilot,
  regenerateCreativeAssetBrief,
  rejectDraft,
  rejectCreativeVariant,
  rejectMonthlyPlanRevisionProposal,
  requestDraftChanges,
  revokeClientPortalLink,
  scheduleContentDraft,
  sendDraftToClient,
  submitDraftForReview,
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
  setupStep?: string;
  brandStep?: string;
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
  approvals: "Согласования",
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
    label: "Работа",
    items: [
      { label: "Обзор", view: "overview" as const, glyph: "О" },
      { label: "Клиенты", view: "clients" as const, glyph: "К" },
      { label: "Настройка клиента", view: "client_setup" as const, glyph: "Н" },
      { label: "Календарь", view: "calendar" as const, glyph: "К" },
      { label: "Клиентский вид", view: "client_portal" as const, glyph: "В" },
      { label: "Бренд", view: "brand_assets" as const, glyph: "Б" },
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

const pageBackgroundClass = "min-h-screen bg-[#f7f5fb] text-stone-900";
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

const overviewCardClass = "rounded-[22px] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(88,75,135,0.07)]";
const overviewAccentTextClass = "text-violet-700";
const overviewAccentBgClass = "bg-violet-50 text-violet-700";

function OverviewMetricCard({
  label,
  value,
  detail,
  href,
  glyph,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  href: string;
  glyph: string;
}) {
  return (
    <a href={href} className={`${overviewCardClass} group min-w-0 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(88,75,135,0.11)]`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${overviewAccentBgClass} text-xs font-bold`}>
          {glyph}
        </span>
        <span className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-400">›</span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
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
    <article className={`${overviewCardClass} p-5 lg:col-span-7 xl:col-span-7`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Состояние работы на месяц</h2>
          <p className="mt-1 text-xs text-slate-400">{plannedContentCount} материалов · {draftCount} текстов готово</p>
        </div>
        {integrationTaskCount > 0 ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Настроить доступы</span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Онлайн</span>
        )}
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-[156px_minmax(0,1fr)] md:items-center">
        <div className="relative flex h-32 w-32 items-center justify-center justify-self-center rounded-full bg-violet-50">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(#7c3aed ${Math.max(progress, 2)}%, #ede9fe 0)`,
            }}
          />
          <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-3xl font-semibold tracking-tight text-slate-950">{progress}%</span>
            <span className="text-[11px] font-semibold text-slate-400">готовность</span>
          </div>
        </div>
        <div>
          <div className="grid grid-cols-4 gap-2">
            {steps.map((step) => (
              <div key={step.label} className={`rounded-2xl border px-3 py-3 text-center ${step.active ? "border-violet-200 bg-violet-50 text-violet-800" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                <p className="text-xs font-semibold">{step.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-600" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">План → Тексты → Проверка → Готово</p>
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
    <article className={`${overviewCardClass} p-5 lg:col-span-5 xl:col-span-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">Клиент в работе</p>
          <h2 className="mt-2 truncate text-xl font-semibold text-slate-950">{clientName}</h2>
          <p className="mt-1 text-xs text-slate-400">{industry}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">active</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold text-slate-400">Blueprint</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{confidenceScore ?? 0}%</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold text-slate-400">План</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{plannedContentCount}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold text-slate-400">Бренд</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{brandProfileReady ? "OK" : brandAssetsCount}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
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
      <p className="mt-1 min-h-8 text-xs leading-4 text-slate-500">{copy}</p>
      <a href={href} className={`mt-4 inline-flex text-xs font-semibold ${overviewAccentTextClass} transition hover:text-violet-900`}>{action}</a>
    </article>
  );
}

function OverviewDashboard({
  currentMonthLabel,
  workspaceLinks,
  latestBlueprint,
  selectedMonthlyPlan,
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
}: {
  currentMonthLabel: string;
  workspaceLinks: Record<WorkspaceView, string>;
  latestBlueprint: {
    confidenceScore: number;
    nextRecommendedAction: string;
    client: { name: string; industry: string | null };
  } | null;
  selectedMonthlyPlan: {
    month: string;
    status: string;
    summary: string;
    scheduledPublications: ScheduledPublicationPreview[];
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
}) {
  const recentItems = [
    ...generationJobs.slice(0, 3).map((job) => ({
      title: formatGenerationJobType(job.jobType),
      meta: formatGenerationJobStatus(job.status),
      time: job.createdAt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
    })),
    selectedMonthlyPlan
      ? {
          title: "Месячный план",
          meta: formatStatus(selectedMonthlyPlan.status),
          time: selectedMonthlyPlan.month,
        }
      : null,
  ].filter(Boolean).slice(0, 4) as Array<{ title: string; meta: string; time: string }>;

  return (
    <section id="overview" className="min-h-[calc(100vh-132px)] rounded-[28px] bg-[#f7f5fb] p-4 text-slate-900 sm:p-5 xl:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Обзор</h2>
          <p className="mt-1 text-sm text-slate-500">{currentMonthLabel} · Adaptive Presence OS</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden min-w-72 items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 shadow-sm md:flex">
            Поиск по клиентам, материалам, событиям
          </div>
          <ConnectionBadge label="OpenAI" active />
          <ConnectionBadge label="Neon" active />
          <ConnectionBadge label="Онлайн" active />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-600 shadow-sm">M</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetricCard label="Требует проверки" value={needsManagerReviewCount} detail="Внутренняя очередь" href={workspaceLinks.approvals} glyph="П" />
        <OverviewMetricCard label="У клиента" value={waitingForClientCount} detail="Ждём решение" href={workspaceLinks.client_portal} glyph="К" />
        <OverviewMetricCard label="Согласовано" value={approvedDraftCount} detail="Можно продолжать" href={workspaceLinks.approvals} glyph="ОК" />
        <OverviewMetricCard label="Готово к планированию" value={readyToScheduleCount} detail="Следующий шаг" href={workspaceLinks.calendar} glyph="Г" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        <OverviewProgressCard
          progress={productionProgress}
          plannedContentCount={plannedContentCount}
          draftCount={draftCount}
          approvalQueueCount={approvalQueueCount}
          readyToScheduleCount={readyToScheduleCount}
          integrationTaskCount={integrationTaskCount}
          draftsHref={workspaceLinks.drafts}
        />
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
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        <OverviewSmallCard
          title="Материалы без текста"
          value={missingTextCount}
          copy={missingTextCount > 0 ? "Нужно подготовить тексты перед согласованием." : "Тексты по плану подготовлены."}
          href={workspaceLinks.drafts}
          action="Открыть материалы"
        />
        <article className={`${overviewCardClass} p-4 lg:col-span-4 xl:col-span-4`}>
          <p className="text-xs font-semibold text-slate-400">Очередь</p>
          <div className="mt-3 grid gap-2">
            {[
              ["Проверка", needsManagerReviewCount],
              ["Клиент", waitingForClientCount],
              ["Визуалы", missingVisualCount],
              ["Доступы", integrationTaskCount],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-500">{label}</span>
                <span className="text-sm font-semibold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
        </article>
        <article className={`${overviewCardClass} p-4 lg:col-span-4 xl:col-span-4`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-400">Активность</p>
            <a href={workspaceLinks.reports} className="text-xs font-semibold text-violet-700">Отчёт</a>
          </div>
          <div className="mt-3 grid gap-2">
            {recentItems.map((item) => (
              <div key={`${item.title}-${item.time}`} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-[10px] font-bold text-violet-700">AI</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{item.title}</p>
                  <p className="truncate text-[11px] text-slate-400">{item.meta}</p>
                </div>
                <span className="text-[11px] text-slate-400">{item.time}</span>
              </div>
            ))}
            {recentItems.length === 0 ? <p className="text-xs leading-5 text-slate-400">Активность появится после генерации плана и материалов.</p> : null}
          </div>
        </article>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        <div className={`${overviewCardClass} flex items-center justify-between gap-3 p-4 lg:col-span-8`}>
          <div>
            <p className="text-xs font-semibold text-slate-400">Следующее действие</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {latestBlueprint ? formatStatus(latestBlueprint.nextRecommendedAction) : "Создать бриф клиента"}
            </p>
          </div>
          <a href={workspaceLinks.client_setup} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700">Открыть настройку</a>
        </div>
        <div className={`${overviewCardClass} flex items-center justify-between gap-3 p-4 lg:col-span-4`}>
          <div>
            <p className="text-xs font-semibold text-slate-400">Календарь</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{selectedMonthlyPlan?.scheduledPublications.length ?? 0} публикаций</p>
          </div>
          <a href={workspaceLinks.calendar} className="text-xs font-semibold text-violet-700">Открыть</a>
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
  status: string;
  approvalRequired: boolean;
  campaignTheme: string | null;
  contentPillar: string | null;
  channelRole: string | null;
  sequenceReason: string | null;
  contentDraft: DraftQueueItem | null;
  creativeAssets: Array<{
    id: string;
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

function MonthlyClientReport({
  clientName,
  month,
  items,
  publications,
  assets,
  jobs,
  draftsHref,
}: {
  clientName?: string;
  month?: string;
  items: MaterialPlannedItem[];
  publications: ScheduledPublicationPreview[];
  assets: CreativeAssetPreview[];
  jobs: GenerationJobPreview[];
  draftsHref: string;
}) {
  if (!month) {
    return (
      <section>
        <WorkspaceViewHeader
          eyebrow="Отчётность"
          title="Отчёт по подготовке материалов"
          description="Сводка по текстам, визуалам, согласованиям и календарю публикаций."
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
              ? "Согласованный материал ещё не добавлен в календарь."
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
    ? "Проверить материалы, которые ожидают согласования."
    : changesNeeded > 0
      ? "Команда внесёт правки и подготовит обновлённые материалы."
      : "Команда продолжает подготовку материалов по календарю.";

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <WorkspaceViewHeader
          eyebrow="Отчётность"
          title="Отчёт по подготовке материалов"
          description="Сводка по текстам, визуалам, согласованиям и календарю публикаций."
        />
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="teal">MVP-отчёт</StatusBadge>
          <button type="button" disabled className={`${secondaryButtonClass} cursor-not-allowed opacity-60`}>Экспорт PDF позже</button>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-500">PDF-экспорт отчёта будет добавлен отдельным этапом.</p>

      <article className={`${panelClass} mt-5 overflow-hidden`}>
        <div className="border-b border-stone-200 bg-[#f8fbfa] p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{clientName || "Клиент"}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-stone-950">{month}</h2>
            <StatusBadge tone="green">Сводка актуальна</StatusBadge>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="Всего материалов" value={totalMaterials} detail="В плане" />
          <MetricCard label="Тексты подготовлены" value={textsPrepared} detail="Есть текст" tone="teal" />
          <MetricCard label="Визуалы подготовлены" value={visualsPrepared} detail="Есть вариант" tone="teal" />
          <MetricCard label="Согласовано клиентом" value={approvedMaterials} detail="Можно двигать дальше" />
          <MetricCard label="Нужны правки" value={changesNeeded} detail="Вернулись в работу" tone={changesNeeded > 0 ? "amber" : "stone"} />
          <MetricCard label="Запланировано" value={scheduledMaterials} detail="Есть дата" tone="teal" />
          <MetricCard label="В работе" value={inProgress} detail="Есть следующий шаг" tone={inProgress > 0 ? "amber" : "stone"} />
          <MetricCard label="Готово к публикации" value={readyToPublish} detail="Проверено и запланировано" />
        </div>
      </article>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className={`${panelClass} p-5`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Краткий итог</p>
          <p className="mt-3 text-sm leading-7 text-stone-700">
            За месяц запланировано {totalMaterials} материалов. Тексты подготовлены для {textsPrepared}, визуалы готовы для {visualsPrepared}, согласовано {approvedMaterials}.
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            Основные зоны внимания: {missingTexts} материалов без текста, {missingVisuals} материалов без визуала, {changesNeeded} материалов ждут правок.
          </p>
        </article>
        <article className={`${panelClass} p-5`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Клиентская сводка</p>
          <div className="mt-3 grid gap-1.5 text-sm leading-6 text-stone-700">
            <p>В этом месяце подготовлено: <span className="font-semibold">{textsPrepared} материалов.</span></p>
            <p>Согласовано: <span className="font-semibold">{approvedMaterials}.</span></p>
            <p>Ожидают вашего решения: <span className="font-semibold">{waitingForClient}.</span></p>
            <p>В работе у команды: <span className="font-semibold">{inProgress}.</span></p>
            <p className="mt-2 text-stone-500">Следующий шаг: {clientNextStep}</p>
          </div>
        </article>
      </div>

      <article className={`${panelClass} mt-5 overflow-hidden`}>
        <div className={cardHeaderClass}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Материалы</p>
            <h2 className="mt-1 text-xl font-semibold text-stone-950">Статус материалов</h2>
          </div>
        </div>
        <div className="grid gap-2 p-4">
          {materials.map(({ item, draft, publication, visualRequired, visualPrepared, approved, needsChanges, scheduled, nextAction }) => (
            <article key={item.id} className="grid gap-3 rounded-md border border-stone-200 bg-stone-50/50 p-3 lg:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(110px,0.65fr))_minmax(150px,0.9fr)] lg:items-center">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-700">{publication?.scheduledDate || item.week || item.plannedDate} &middot; {item.platformName} &middot; {item.format}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-stone-900">{item.topic}</p>
              </div>
              <StatusBadge tone={draft ? "teal" : "neutral"}>{draft ? "Текст готов" : "Нет текста"}</StatusBadge>
              <StatusBadge tone={visualPrepared ? "green" : visualRequired ? "amber" : "neutral"}>
                {visualPrepared ? "Визуал готов" : visualRequired ? "Нет визуала" : "Не требуется / не определено"}
              </StatusBadge>
              <StatusBadge tone={approved ? "green" : needsChanges ? "rose" : draft?.status === "sent_to_client" ? "amber" : "neutral"}>
                {approved ? "Согласовано" : needsChanges ? "Нужны правки" : draft?.status === "sent_to_client" ? "Ждёт клиента" : "В работе"}
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
                <p className="mt-2 text-xs font-bold text-teal-800">{attention.nextAction}</p>
              </div>
            ))}
            {attentionItems.length === 0 ? <p className={mutedTextClass}>Сейчас нет материалов, требующих внимания.</p> : null}
          </div>
          <a href={draftsHref} className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950">Открыть материалы</a>
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
            className={`rounded-lg border p-3 transition hover:border-teal-300 hover:bg-teal-50/50 ${
              step === activeStep ? "border-teal-300 bg-teal-50/70" : "border-stone-200 bg-white"
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
            <a href={brandAssetsHref("profile", context)} className="inline-flex items-center text-sm font-bold text-teal-800 transition hover:text-teal-950">Вернуться к профилю бренда</a>
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
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-teal-800">
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
    { label: "Бренд", view: "brand_assets" as const },
    { label: "Клиентский вид", view: "client_portal" as const },
    { label: "Отчёт", view: "reports" as const },
  ];

  return (
    <nav aria-label="Рабочие зоны" className="mb-4 overflow-x-auto rounded-[18px] border border-slate-200/80 bg-white/80 p-1 shadow-[0_10px_30px_rgba(88,75,135,0.05)]">
      <div className="flex min-w-max gap-1">
        {items.map((item) => (
          <a
            key={item.view}
            href={links[item.view]}
            className={`rounded-[14px] px-3 py-2 text-xs font-semibold transition ${
              item.view === activeView ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
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
    <article className={`${panelClass} mt-5 overflow-hidden border-teal-200`}>
      <div className="grid gap-5 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">AI-помощник</p>
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
        <div className="border-t border-teal-100 bg-teal-50/50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Предложенные правки</p>
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
            <div className="rounded-lg border border-teal-200 bg-white p-4">
              <p className="text-sm font-semibold text-teal-900">Добавить</p>
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
    labels.push({ label: "Согласовано", tone: "green" });
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
    <article className={`${panelClass} mt-5 overflow-hidden border-teal-200`}>
      <div className="grid gap-5 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Ручное управление планом</p>
          <h3 className="mt-1 text-lg font-semibold text-stone-950">Редактор месячного плана</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Исправьте площадки, темы и недели до запуска производства. Календарь и связанные рабочие записи обновятся после сохранения.
          </p>
        </div>
        <details className="rounded-lg border border-teal-200 bg-teal-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-teal-950">Добавить материал в план</summary>
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
  monthlyPlanId,
  blueprintId,
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
  monthlyPlanId?: string;
  blueprintId?: string;
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
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={clientPortalHref} className={secondaryButtonClass}>Открыть клиентский вид</a>
        <a href={reportsHref} className={secondaryButtonClass}>Открыть отчёт</a>
      </div>
      <p className={`mt-3 rounded-md border px-3 py-2 text-xs leading-5 ${brandProfileReady ? "border-teal-200 bg-teal-50 text-teal-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {brandProfileReady ? "AI использует контекст бренда клиента." : "Заполните библиотеку бренда, чтобы тексты и визуалы были точнее."}
      </p>
      <ManualMonthlyPlanEditor monthlyPlanId={monthlyPlanId} items={items} publications={publications} />
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
                                  <GeneratedVisualImage variant={variant} alt={variant.variantTitle} className="aspect-square max-h-72 w-full bg-stone-100 object-contain" />
                                  <div className="p-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      <StatusBadge tone={creativeVariantTone(variant.status)}>{formatStatus(variant.status)}</StatusBadge>
                                      <StatusBadge tone={creativeVariantQualityTone(variant.qualityStatus)}>{formatStatus(variant.qualityStatus)}</StatusBadge>
                                      <StatusBadge>{formatGeneratedVisualStorage(variant.storageProvider)}</StatusBadge>
                                      {formatGeneratedVisualFileSize(variant.fileSize) ? <StatusBadge>{formatGeneratedVisualFileSize(variant.fileSize)}</StatusBadge> : null}
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
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Экспериментально</p>
        <MonthlyPlanRevisionCopilot monthlyPlanId={monthlyPlanId} proposal={latestRevisionProposal} />
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
      <a href={reportsHref} className="mt-4 inline-flex text-xs font-bold text-teal-800 transition hover:text-teal-950">Открыть отчёт</a>

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
  const unscheduledItems = items.filter((item) => !scheduledByItemId.has(item.id));
  const unscheduledGroups = groupCalendarItems(unscheduledItems);
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
        <>
          <ScheduledPublicationCalendar publications={publications} />
          {unscheduledItems.length > 0 ? (
            <div className="border-t border-stone-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">Ещё не запланировано</p>
                  <h3 className="mt-1 text-lg font-semibold text-stone-950">Материалы без даты публикации</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Эти пункты уже есть в месячном плане, но ещё не прошли путь до расписания.
                  </p>
                </div>
                <StatusBadge tone="amber">{unscheduledItems.length} в плане</StatusBadge>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {unscheduledGroups.flatMap((group) => group.items).map((item) => (
                  <article key={item.id} className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge tone="teal">{item.platformName}</StatusBadge>
                      <StatusBadge>{item.format}</StatusBadge>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-stone-400">{item.week || item.plannedDate}</p>
                    <h4 className="mt-1 text-sm font-semibold leading-5 text-stone-950">{item.topic}</h4>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <StatusBadge tone={item.status === "planned" ? "teal" : "amber"}>{formatStatus(item.status)}</StatusBadge>
                      <StatusBadge tone={materialTextStatusTone(item.contentDraft)}>{formatMaterialTextStatus(item.contentDraft)}</StatusBadge>
                    </div>
                    <div className="mt-3 border-t border-stone-200 pt-3">
                      <ContentItemAction item={item} draftsHref={draftsHref} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </>
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
  platformRecommendations: Array<{ id: string; recommendation: string }>;
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
            className={`rounded-lg border p-3 transition hover:border-teal-300 hover:bg-teal-50/50 ${
              step === activeStep ? "border-teal-300 bg-teal-50/70" : "border-stone-200 bg-white"
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
          <a href={clientSetupHref("create_client", context)} className={secondaryButtonClass}>Создать нового клиента</a>
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
                  className={`rounded-lg border p-3 transition hover:border-teal-300 hover:bg-teal-50/60 ${
                    selectedClient?.id === client.id ? "border-teal-300 bg-teal-50/60" : "border-stone-200 bg-stone-50/60"
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
                      <p className="text-xs font-bold text-teal-700">{selectedClient.name}</p>
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
                <article className="rounded-lg border border-teal-200 bg-teal-50/70 p-4">
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
              description="Месячный план превращает Blueprint в календарь материалов, площадок, задач и правил согласования."
            />
            {!blueprint ? (
              <div className="mt-5"><EmptyState>Blueprint появится после генерации на основе брифа.</EmptyState></div>
            ) : monthlyPlan ? (
              <div className="mt-5 grid gap-4">
                <article className="rounded-lg border border-teal-200 bg-teal-50/70 p-4">
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
                <form action={generateMonthlyPlan} className="grid max-w-sm gap-3">
                  <input type="hidden" name="blueprintId" value={blueprint.id} />
                  <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                    Месяц
                    <input name="month" readOnly value={currentMonth()} className={inputClass} />
                  </label>
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

  return (
    <div className={pageBackgroundClass}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white text-slate-700 lg:flex lg:flex-col">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white">
              AP
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Adaptive Presence</p>
              <p className="mt-0.5 text-xs text-slate-400">OS by Creative</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5">
          <div className="grid gap-5">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.label}</p>
                <div className="mt-2 grid gap-1">
                  {group.items.map((item) => (
                    <a
                      key={item.label}
                      href={workspaceLinks[item.view]}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                        item.view === activeView
                          ? "bg-violet-50 font-semibold text-violet-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-xl text-[10px] font-bold ${item.view === activeView ? "bg-white text-violet-700" : "bg-slate-50 text-slate-500"}`}>
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

        <div id="settings" className="grid gap-3 border-t border-slate-100 px-4 py-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-800">AI-помощник</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Короткие подсказки по рабочим задачам.</p>
          </div>
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">M</div>
            <div>
              <p className="text-xs font-semibold text-slate-700">Профиль менеджера</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Creative operations</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
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
                  <button type="button" aria-label="Уведомления" className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-600">
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
              <OverviewDashboard
                currentMonthLabel={currentMonth()}
                workspaceLinks={workspaceLinks}
                latestBlueprint={latestBlueprint}
                selectedMonthlyPlan={selectedMonthlyPlan}
                needsManagerReviewCount={needsManagerReviewCount}
                waitingForClientCount={waitingForClientCount}
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
              />
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
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
