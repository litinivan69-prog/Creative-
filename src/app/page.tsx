import {
  addClientBrief,
  createClient,
  generateBlueprint,
  generateContentDraftForItem,
  generateMonthlyPlan,
  updateClientBrief,
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
    label: "Operate",
    items: [
      { label: "Overview", href: "#overview", glyph: "O" },
      { label: "Clients", href: "#clients", glyph: "C" },
      { label: "Calendar", href: "#calendar", glyph: "C" },
    ],
  },
  {
    label: "Review",
    items: [
      { label: "Approvals", href: "#approvals", glyph: "A" },
      { label: "Drafts", href: "#drafts", glyph: "D" },
      { label: "Events", href: "#events", glyph: "E" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Reports", href: "#reports", glyph: "R" },
      { label: "Settings", href: "#settings", glyph: "S" },
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
  return value.replaceAll("_", " ");
}

function suggestsVisualAsset(format: string) {
  return ["visual", "video", "reel", "story", "image", "photo", "carousel", "short"].some((token) =>
    format.toLowerCase().includes(token),
  );
}

function CalendarPreview({
  groups,
  month,
  blueprintId,
  generationBlocked,
}: {
  groups: ReturnType<typeof groupCalendarItems>;
  month: string;
  blueprintId?: string;
  generationBlocked: boolean;
}) {
  return (
    <section id="calendar" className={`${panelClass} scroll-mt-24 p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Calendar preview</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Monthly operations calendar</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            A week-based view of planned work, approvals, and draft readiness derived from the current Monthly Plan.
          </p>
        </div>
        <StatusBadge tone="teal">{month}</StatusBadge>
      </div>

      {groups.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {groups.map((group) => (
            <article key={group.label} className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
              <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
                <p className="text-sm font-semibold text-stone-950">{group.label}</p>
                <StatusBadge>{group.items.length} items</StatusBadge>
              </div>
              <div className="mt-3 grid gap-2">
                {group.items.map((item) => (
                  <div key={item.id} className="rounded-md border border-stone-200 bg-white p-3 shadow-[0_1px_1px_rgba(28,36,38,0.03)]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge tone="teal">{item.platformName}</StatusBadge>
                      <StatusBadge>{item.format}</StatusBadge>
                      {suggestsVisualAsset(item.format) ? <StatusBadge tone="amber">Visual asset</StatusBadge> : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-5 text-stone-900">{item.topic}</p>
                    <p className="mt-1 text-xs text-stone-400">{item.plannedDate}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge tone={item.status === "planned" ? "teal" : "amber"}>{formatStatus(item.status)}</StatusBadge>
                      {item.approvalRequired ? <StatusBadge tone="amber">Needs review</StatusBadge> : null}
                      {item.contentDraft ? <StatusBadge tone="green">Draft ready</StatusBadge> : null}
                    </div>
                    <div className="mt-3 border-t border-stone-100 pt-3">
                      {item.contentDraft ? (
                        <a href={`#draft-${item.contentDraft.id}`} className="text-xs font-bold text-teal-700 transition hover:text-teal-900">
                          Review draft
                        </a>
                      ) : (
                        <form action={generateContentDraftForItem}>
                          <input type="hidden" name="plannedContentItemId" value={item.id} />
                          <PendingSubmitButton
                            pendingLabel="Generating..."
                            className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-wait disabled:text-stone-400"
                          >
                            Generate draft
                          </PendingSubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-teal-300 bg-teal-50/70 p-5">
          <p className="text-sm font-semibold text-teal-950">Your operating calendar is ready for its first plan.</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-800">
            Generate a Monthly Operating Plan to turn the Blueprint into week-based content operations, review queues,
            and draft tasks.
          </p>
          {blueprintId ? (
            <form action={generateMonthlyPlan} className="mt-4">
              <input type="hidden" name="blueprintId" value={blueprintId} />
              <PendingSubmitButton
                pendingLabel="Generating Monthly Plan..."
                disabled={generationBlocked}
                className={primaryButtonClass}
              >
                Generate Monthly Plan
              </PendingSubmitButton>
            </form>
          ) : (
            <a href="#clients" className="mt-4 inline-flex text-sm font-bold text-teal-800 transition hover:text-teal-950">
              Start with client intake
            </a>
          )}
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
                  include: { contentDraft: true },
                },
                managerTasks: true,
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
                  include: { contentDraft: true },
                },
                managerTasks: true,
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
  const approvalQueueCount =
    selectedMonthlyPlan?.plannedContentItems.filter((item) => item.approvalRequired).length ?? 0;
  const withoutDraftCount =
    selectedMonthlyPlan?.plannedContentItems.filter((item) => !item.contentDraft).length ?? 0;
  const integrationTaskCount =
    selectedMonthlyPlan?.managerTasks.filter((task) =>
      ["integration", "connect", "credential", "access", "permission", "auth", "интеграц", "подключ", "доступ"].some(
        (token) => `${task.title} ${task.description}`.toLowerCase().includes(token),
      ),
    ).length ?? 0;
  const firstCalendarGroup = calendarGroups[0];
  const recentlyPreparedItems =
    selectedMonthlyPlan?.plannedContentItems.filter((item) => item.contentDraft).slice(0, 3) ?? [];

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
                        item.label === "Overview"
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

        <div id="settings" className="border-t border-white/10 px-5 py-4">
          <p className="text-xs font-semibold text-stone-300">Manager Console</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Internal operating workspace</p>
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
                  <h1 className="text-base font-semibold text-stone-950">Adaptive Presence OS</h1>
                  <StatusBadge tone="teal">Manager Console</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs font-medium text-stone-400">by Creative</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <ConnectionBadge label={process.env.OPENAI_API_KEY ? "OpenAI connected" : "OpenAI setup needed"} active={Boolean(process.env.OPENAI_API_KEY)} />
              <ConnectionBadge label="Neon connected" />
              <ConnectionBadge label={process.env.VERCEL ? "Vercel live" : "Local workspace"} />
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Operating workspace</p>
                  <h2 className="mt-2 text-3xl font-semibold text-stone-950">Digital presence control room</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                    Turn a client brief into an executable Blueprint, a monthly operating plan, and manager-ready
                    content drafts.
                  </p>
                </div>
                <p className="text-xs font-semibold text-stone-400">Current cycle: {currentMonth()}</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Needs review" value={approvalQueueCount} detail="Planned items awaiting approval" tone="amber" />
                <MetricCard label="Draft ready" value={draftCount} detail="Prepared for manager review" tone="teal" />
                <MetricCard label="Without draft" value={withoutDraftCount} detail="Planned items still to prepare" />
                <MetricCard label="Integration tasks" value={integrationTaskCount} detail="Access work before launch" tone={integrationTaskCount > 0 ? "rose" : "stone"} />
              </div>
            </section>

            <section id="approvals" className="mt-7 grid scroll-mt-24 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <article className={`${panelClass} p-5 sm:p-6`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Today / current focus</p>
                    <h2 className="mt-1 text-xl font-semibold text-stone-950">Today needs attention</h2>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      The live operating queue derived from this client&apos;s Blueprint and current Monthly Plan.
                    </p>
                  </div>
                  <StatusBadge tone={approvalQueueCount + integrationTaskCount > 0 ? "amber" : "green"}>
                    {approvalQueueCount + integrationTaskCount > 0 ? "Action needed" : "Clear"}
                  </StatusBadge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold text-amber-900">Items requiring approval</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{approvalQueueCount}</p>
                  </div>
                  <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                    <p className="text-xs font-bold text-teal-900">Generated drafts</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{draftCount}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-bold text-stone-700">Items without drafts</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{withoutDraftCount}</p>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <p className="text-xs font-bold text-rose-900">Integration tasks</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{integrationTaskCount}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-400">Blueprint next action</p>
                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {latestBlueprint?.nextRecommendedAction ?? "Create a client brief and generate a Blueprint."}
                  </p>
                </div>
              </article>

              <article className={`${panelClass} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Monthly plan status</p>
                  {selectedMonthlyPlan ? <StatusBadge tone="green">{formatStatus(selectedMonthlyPlan.status)}</StatusBadge> : <StatusBadge tone="amber">Not generated</StatusBadge>}
                </div>
                {selectedMonthlyPlan ? (
                  <div className="mt-4">
                    <p className="text-2xl font-semibold text-stone-950">{selectedMonthlyPlan.month}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">{selectedMonthlyPlan.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge tone="teal">{selectedMonthlyPlan.totalPlannedUnits} planned units</StatusBadge>
                      <StatusBadge>{selectedMonthlyPlan.plannedContentItems.length} calendar items</StatusBadge>
                    </div>
                    <a href="#monthly-plan" className="mt-4 inline-flex text-sm font-bold text-teal-700 transition hover:text-teal-900">
                      Open monthly plan
                    </a>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm leading-6 text-stone-500">
                      Generate a Monthly Operating Plan to activate the operating calendar and draft queue.
                    </p>
                    <a href="#calendar" className="mt-4 inline-flex text-sm font-bold text-teal-700 transition hover:text-teal-900">
                      Open calendar setup
                    </a>
                  </div>
                )}
              </article>
            </section>

            <section className="mt-7 grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <CalendarPreview
                groups={calendarGroups}
                month={selectedMonthlyPlan?.month ?? currentMonth()}
                blueprintId={latestBlueprint?.id}
                generationBlocked={latestBlueprint?.nextRecommendedAction === "request_more_brief_data"}
              />
              <div className="grid gap-5">
                <article className={`${panelClass} p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Client preview</p>
                      <h2 className="mt-1 text-lg font-semibold text-stone-950">Approval-focused portal</h2>
                    </div>
                    <StatusBadge tone="amber">Preview only</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-500">
                    A calm, simplified view of the same operating plan. Auth and approval actions come later.
                  </p>
                  <div className="mt-4 grid gap-2">
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <p className="text-xs font-bold text-amber-900">Awaiting your approval</p>
                      <p className="mt-1 text-sm text-amber-800">{approvalQueueCount} planned items need review.</p>
                    </div>
                    <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2.5">
                      <p className="text-xs font-bold text-teal-900">Planned this week</p>
                      <p className="mt-1 text-sm text-teal-800">
                        {firstCalendarGroup ? `${firstCalendarGroup.items.length} items in ${firstCalendarGroup.label}.` : "Your first weekly plan will appear here."}
                      </p>
                    </div>
                    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5">
                      <p className="text-xs font-bold text-stone-700">Recently prepared</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {recentlyPreparedItems.length > 0 ? `${recentlyPreparedItems.length} drafts are ready to review.` : "Prepared drafts will appear here."}
                      </p>
                    </div>
                    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5">
                      <p className="text-xs font-bold text-stone-700">New reviews / events</p>
                      <p className="mt-1 text-sm text-stone-500">Coming soon with the future events stream.</p>
                    </div>
                  </div>
                </article>

                <article className={`${panelClass} p-5`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Product mode</p>
                  <h2 className="mt-1 text-lg font-semibold text-stone-950">One OS, two views</h2>
                  <div className="mt-4 grid gap-3 text-sm leading-6">
                    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                      <p className="font-semibold text-stone-900">Manager Console</p>
                      <p className="text-stone-500">Internal control for strategy, operations, risks, and drafts.</p>
                    </div>
                    <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2">
                      <p className="font-semibold text-teal-900">Client Portal</p>
                      <p className="text-teal-700">A future simplified view for approvals and progress.</p>
                    </div>
                    <p className="text-stone-500">Both views use the same underlying operating system.</p>
                  </div>
                </article>
              </div>
            </section>

            <div className="mt-7 grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside id="clients" className="grid scroll-mt-24 gap-5 xl:sticky xl:top-24">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">Setup and intake</p>
                  <p className="mt-1 text-sm leading-6 text-stone-500">Secondary controls for onboarding and brief updates.</p>
                </div>
                <section className={`${panelClass} p-5`}>
                  <SectionTitle eyebrow="Client intake" title="Create client" />
                  <form action={createClient} className="mt-5 grid gap-3">
                    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                      Name
                      <input name="name" required className={inputClass} placeholder="Northstar Dental Studio" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                      Website
                      <input name="website" className={inputClass} placeholder="https://example.com" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                      Industry
                      <input name="industry" className={inputClass} placeholder="Healthcare" />
                    </label>
                    <PendingSubmitButton pendingLabel="Creating..." className={primaryButtonClass}>
                      Create client
                    </PendingSubmitButton>
                  </form>
                </section>

                <section className={`${panelClass} p-5`}>
                  <SectionTitle eyebrow="Raw input" title="Add brief" />
                  {clients.length > 0 ? (
                    <form action={addClientBrief} className="mt-5 grid gap-3">
                      <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                        Client
                        <select name="clientId" required className={inputClass}>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
                        Raw brief
                        <textarea
                          name="rawBrief"
                          required
                          rows={7}
                          className={`${inputClass} resize-y`}
                          placeholder="Goals, audience, current channels, constraints, brand risks, team capacity..."
                        />
                      </label>
                      <PendingSubmitButton pendingLabel="Saving..." className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:bg-teal-400">
                        Save brief
                      </PendingSubmitButton>
                    </form>
                  ) : (
                    <div className="mt-5">
                      <EmptyState>Create a client before adding a brief.</EmptyState>
                    </div>
                  )}
                </section>

                <section className={`${panelClass} p-5`}>
                  <SectionTitle eyebrow="Blueprint queue" title="Saved briefs" />
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
                              {brief.blueprint ? "Generated" : "Ready"}
                            </StatusBadge>
                          </div>
                          <details className="mt-3 border-t border-stone-200 pt-3">
                            <summary className="cursor-pointer text-xs font-bold text-stone-600">Edit brief</summary>
                            <form action={updateClientBrief} className="mt-3 grid gap-3">
                              <input type="hidden" name="briefId" value={brief.id} />
                              <textarea name="rawBrief" required rows={6} defaultValue={brief.rawBrief} className={`${inputClass} resize-y text-xs`} />
                              {brief.blueprint ? (
                                <p className="text-xs leading-5 text-stone-500">
                                  Saving changes clears the current Blueprint so it can be regenerated from the edited brief.
                                </p>
                              ) : null}
                              <PendingSubmitButton pendingLabel="Saving..." className={secondaryButtonClass}>
                                Save edited brief
                              </PendingSubmitButton>
                            </form>
                          </details>
                          <form action={generateBlueprint} className="mt-3">
                            <input type="hidden" name="briefId" value={brief.id} />
                            <PendingSubmitButton
                              pendingLabel={brief.blueprint ? "Opening Blueprint..." : "Generating Blueprint..."}
                              className="w-full rounded-md bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:bg-amber-300"
                            >
                              {brief.blueprint ? "View blueprint" : "Generate blueprint"}
                            </PendingSubmitButton>
                          </form>
                        </article>
                      )),
                    )}
                    {clients.every((client) => client.briefs.length === 0) ? (
                      <EmptyState>No briefs saved yet.</EmptyState>
                    ) : null}
                  </div>
                </section>
              </aside>

              <div className="min-w-0 space-y-6">
                <section id="blueprints" className={`${panelClass} scroll-mt-24 p-5 sm:p-6`}>
                  <SectionTitle
                    eyebrow="Presence blueprint"
                    title="Client operating system"
                    description="The Blueprint translates strategic input into an executable product configuration."
                  />
                  {latestBlueprint ? (
                    <div className="mt-6 grid gap-6">
                      <div className="grid gap-5 border-b border-stone-200 pb-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone="green">Blueprint active</StatusBadge>
                            <StatusBadge>{latestBlueprint.client.industry || "Industry not set"}</StatusBadge>
                          </div>
                          <p className="mt-5 text-sm font-semibold text-teal-700">{latestBlueprint.client.name}</p>
                          <h3 className="mt-2 max-w-4xl text-2xl font-semibold leading-9 text-stone-950">
                            {latestBlueprint.clientSummary}
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <MetricCard label="Confidence" value={`${latestBlueprint.confidenceScore}%`} tone="teal" />
                          <MetricCard label="Monthly units" value={`${latestBlueprint.totalContentUnitsMin}-${latestBlueprint.totalContentUnitsMax}`} />
                          <MetricCard label="Approval" value={latestBlueprint.approvalMode} />
                          <MetricCard label="Attention" value={latestBlueprint.managerAttentionLevel} tone="amber" />
                        </div>
                      </div>

                      <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Next operating layer</p>
                            <h4 className="mt-1 font-semibold text-stone-950">Monthly Operating Plan</h4>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
                              A planning layer for modules, channels, cadence, approvals, integrations, and tasks. It is not final content generation.
                            </p>
                          </div>
                          {currentMonthlyPlan ? (
                            <a href={`/?blueprint=${latestBlueprint.id}&plan=${currentMonthlyPlan.id}#monthly-plan`} className={secondaryButtonClass}>
                              View current plan
                            </a>
                          ) : (
                            <form action={generateMonthlyPlan}>
                              <input type="hidden" name="blueprintId" value={latestBlueprint.id} />
                              <PendingSubmitButton pendingLabel="Generating Monthly Plan..." disabled={latestBlueprint.nextRecommendedAction === "request_more_brief_data"} className={primaryButtonClass}>
                                Generate Monthly Plan
                              </PendingSubmitButton>
                            </form>
                          )}
                        </div>
                        {currentMonthlyPlan ? (
                          <p className="mt-3 text-xs font-semibold text-teal-800">
                            A Monthly Operating Plan already exists for {currentMonthlyPlan.month}. The existing plan is displayed below.
                          </p>
                        ) : null}
                        {latestBlueprint.nextRecommendedAction === "request_more_brief_data" ? (
                          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
                            Monthly plan generation is blocked until the missing brief data is resolved.
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                          <h4 className="text-sm font-semibold text-stone-950">Business goals</h4>
                          <div className="mt-3">
                            <StringList items={latestBlueprint.businessGoals as string[]} emptyText="No business goals listed." />
                          </div>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Next action</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-stone-900">{latestBlueprint.nextRecommendedAction}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-semibold text-stone-950">Missing brief fields</h4>
                          <div className="mt-3">
                            <StringList items={latestBlueprint.missingBriefFields as string[]} emptyText="No missing brief fields." tone="rose" />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-stone-950">Assumptions</h4>
                          <div className="mt-3">
                            <StringList items={latestBlueprint.assumptions as string[]} emptyText="No assumptions recorded." tone="amber" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-stone-950">Platform recommendations</h4>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {latestBlueprint.platformRecommendations.map((platform) => (
                            <article key={platform.id} className="rounded-lg border border-stone-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h5 className="font-semibold text-stone-950">{platform.platformName}</h5>
                                  <p className="mt-1 text-xs font-medium text-stone-500">{platform.suggestedFrequency}</p>
                                </div>
                                <StatusBadge tone={platform.recommendation === "recommended" ? "green" : "rose"}>
                                  {platform.recommendation}
                                </StatusBadge>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <StatusBadge tone="teal">{platform.platformType}</StatusBadge>
                                <StatusBadge tone="amber">{platform.priority}</StatusBadge>
                                <StatusBadge>{platform.automationStatus}</StatusBadge>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-stone-600">{platform.rationale}</p>
                              <details className="mt-3 border-t border-stone-100 pt-3">
                                <summary className="cursor-pointer text-xs font-bold text-stone-500">Access and formats</summary>
                                <div className="mt-2 grid gap-1 text-xs leading-5 text-stone-500">
                                  <p><span className="font-semibold text-stone-700">Credentials:</span> {Array.isArray(platform.requiredCredentials) ? platform.requiredCredentials.join(", ") || "None" : "None"}</p>
                                  <p><span className="font-semibold text-stone-700">Permissions:</span> {Array.isArray(platform.permissionsNeeded) ? platform.permissionsNeeded.join(", ") || "None" : "None"}</p>
                                  <p><span className="font-semibold text-stone-700">Formats:</span> {Array.isArray(platform.contentFormats) ? platform.contentFormats.join(", ") || "None" : "None"}</p>
                                </div>
                              </details>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-stone-950">Selected modules</h4>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {latestBlueprint.selectedModules.map((module) => (
                            <article key={module.id} className="rounded-lg border border-stone-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h5 className="font-semibold text-stone-950">{module.name}</h5>
                                  <p className="mt-1 text-xs font-bold text-teal-700">{module.moduleType}</p>
                                </div>
                                <StatusBadge tone="amber">{module.priority}</StatusBadge>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-stone-600">{module.purpose}</p>
                              <div className="mt-3">
                                <JsonDetails title="Module scope" value={module.monthlyContentScope} />
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-semibold text-stone-950">Automation plan</h4>
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
                          <h4 className="text-sm font-semibold text-stone-950">Risk rules</h4>
                          <div className="mt-3 grid gap-3">
                            {latestBlueprint.riskRules.map((rule) => (
                              <article key={rule.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <h5 className="font-semibold text-stone-950">{rule.ruleName}</h5>
                                  <StatusBadge tone="rose">{rule.severity}</StatusBadge>
                                </div>
                                <p className="mt-2 leading-6 text-stone-500">{rule.riskDescription}</p>
                                <p className="mt-2 leading-6 text-stone-700">{rule.preventionAction}</p>
                              </article>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <JsonDetails title="Recommended monthly content scope" value={latestBlueprint.recommendedMonthlyContentScope} />
                        <JsonDetails title="Publishing frequency" value={latestBlueprint.publishingFrequency} />
                        <JsonDetails title="Integration requirements" value={latestBlueprint.integrationRequirements} />
                        <JsonDetails title="Human review policy" value={latestBlueprint.humanReviewPolicy} />
                        <JsonDetails title="Not recommended platforms" value={latestBlueprint.notRecommendedPlatforms} />
                        <JsonDetails title="Raw structured Blueprint" value={latestBlueprint.rawBlueprintJson} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <EmptyState>Generate a Blueprint from a saved client brief to open the operating workspace.</EmptyState>
                    </div>
                  )}
                </section>

                {selectedMonthlyPlan ? (
                  <section id="monthly-plan" className={`${panelClass} scroll-mt-24 p-5 sm:p-6`}>
                    <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Monthly operating plan</p>
                        <h2 className="mt-1 text-2xl font-semibold text-stone-950">{selectedMonthlyPlan.month}</h2>
                        <p className="mt-3 max-w-4xl text-sm leading-6 text-stone-500">{selectedMonthlyPlan.summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone="green">{selectedMonthlyPlan.status}</StatusBadge>
                        <StatusBadge tone="teal">{selectedMonthlyPlan.totalPlannedUnits} planned units</StatusBadge>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                        <p className="text-xs font-bold text-stone-700">Approval strategy</p>
                        <p className="mt-2 text-sm leading-6 text-stone-500">{selectedMonthlyPlan.approvalStrategy}</p>
                      </div>
                      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                        <p className="text-xs font-bold text-stone-700">Autopublish strategy</p>
                        <p className="mt-2 text-sm leading-6 text-stone-500">{selectedMonthlyPlan.autopublishStrategy}</p>
                      </div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                        <p className="text-xs font-bold text-rose-800">Risk summary</p>
                        <p className="mt-2 text-sm leading-6 text-rose-700">{selectedMonthlyPlan.riskSummary}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-semibold text-stone-950">Active modules</h3>
                        <div className="mt-3 grid gap-3">
                          {selectedMonthlyPlan.modules.map((module) => (
                            <article key={module.id} className="rounded-lg border border-stone-200 p-4 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-stone-950">{module.name}</p>
                                  <p className="mt-1 text-xs font-bold text-teal-700">{module.moduleType}</p>
                                </div>
                                <StatusBadge tone="amber">{module.plannedUnitsMin}-{module.plannedUnitsMax} units</StatusBadge>
                              </div>
                              <p className="mt-2 leading-6 text-stone-500">{module.rationale}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-stone-950">Selected platforms</h3>
                        <div className="mt-3 grid gap-3">
                          {selectedMonthlyPlan.platforms.map((platform) => (
                            <article key={platform.id} className="rounded-lg border border-stone-200 p-4 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-stone-950">{platform.platformName}</p>
                                  <p className="mt-1 text-xs font-bold text-teal-700">{platform.platformType} &middot; {platform.automationStatus}</p>
                                </div>
                                {platform.requiresIntegrationBeforeLaunch ? <StatusBadge tone="rose">Integration required</StatusBadge> : <StatusBadge tone="green">Ready</StatusBadge>}
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
                          <h3 className="text-sm font-semibold text-stone-950">Weekly campaign overview</h3>
                          <p className="mt-1 text-sm leading-6 text-stone-500">
                            The strategic sequence behind the detailed calendar: themes, channel roles, and the reason each item exists.
                          </p>
                        </div>
                        <StatusBadge tone="teal">{calendarGroups.length} calendar groups</StatusBadge>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {calendarGroups.map((group) => (
                          <article key={group.label} className="rounded-lg border border-stone-200 bg-stone-50/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-stone-950">{group.label}</p>
                                <p className="mt-1 text-xs leading-5 text-stone-500">
                                  {Array.from(new Set(group.items.map((item) => item.campaignTheme).filter(Boolean))).join(", ") || "Cross-channel operating theme"}
                                </p>
                              </div>
                              <StatusBadge>{group.items.length} items</StatusBadge>
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
                                    {item.channelRole ? <p><span className="font-bold text-stone-700">Role:</span> {item.channelRole}</p> : null}
                                    {item.sequenceReason ? <p className="line-clamp-2"><span className="font-bold text-stone-700">Sequence:</span> {item.sequenceReason}</p> : null}
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
                          <h3 className="text-sm font-semibold text-stone-950">Planned content items</h3>
                          <p className="mt-1 text-sm leading-6 text-stone-500">Cross-channel calendar items ready for one-by-one draft generation.</p>
                        </div>
                        <StatusBadge>{selectedMonthlyPlan.plannedContentItems.length} listed items</StatusBadge>
                      </div>
                      <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200">
                        <table className="min-w-[1180px] border-collapse text-left text-sm">
                          <thead className="bg-stone-50 text-[10px] uppercase tracking-[0.1em] text-stone-500">
                            <tr>
                              <th className="px-3 py-3">Cadence</th>
                              <th className="px-3 py-3">Platform</th>
                              <th className="px-3 py-3">Format</th>
                              <th className="px-3 py-3">Theme and topic</th>
                              <th className="px-3 py-3">Channel role</th>
                              <th className="px-3 py-3">Goal</th>
                              <th className="px-3 py-3">Review</th>
                              <th className="px-3 py-3">Draft</th>
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
                                    <StatusBadge tone={item.approvalRequired ? "amber" : "green"}>{item.approvalRequired ? "Approval" : "No approval"}</StatusBadge>
                                    <StatusBadge tone={item.autopublishEligible ? "green" : "neutral"}>{item.autopublishEligible ? "Autopublish" : "Manual"}</StatusBadge>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  {item.contentDraft ? (
                                    <a href={`#draft-${item.contentDraft.id}`} className="inline-flex rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-100">
                                      Draft ready
                                    </a>
                                  ) : (
                                    <form action={generateContentDraftForItem}>
                                      <input type="hidden" name="plannedContentItemId" value={item.id} />
                                      <PendingSubmitButton pendingLabel="Generating Draft..." className="whitespace-nowrap rounded-md bg-stone-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:bg-stone-400">
                                        Generate Draft
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
                      <h3 className="text-sm font-semibold text-stone-950">Content draft review</h3>
                      <p className="mt-1 text-sm leading-6 text-stone-500">Drafts are generated one planned item at a time for manager review. Nothing is published automatically.</p>
                      <div className="mt-3 grid gap-3">
                        {selectedMonthlyPlan.plannedContentItems.filter((item) => item.contentDraft).map((item) => {
                          const draft = item.contentDraft!;
                          return (
                            <article id={`draft-${draft.id}`} key={draft.id} className="scroll-mt-24 rounded-lg border border-stone-200 bg-white p-5">
                              <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-teal-700">{draft.platformName} &middot; {draft.format}</p>
                                  <h4 className="mt-2 text-lg font-semibold text-stone-950">{draft.draftTitle}</h4>
                                  <p className="mt-1 text-xs text-stone-400">{draft.topic}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <StatusBadge tone={draft.status === "approved" ? "green" : "amber"}>{formatStatus(draft.status)}</StatusBadge>
                                  <StatusBadge tone={draft.riskLevel === "high" ? "rose" : draft.riskLevel === "medium" ? "amber" : "green"}>risk: {draft.riskLevel}</StatusBadge>
                                </div>
                              </div>
                              <div className="mt-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-400">Body preview</p>
                                <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-7 text-stone-700">{draft.draftBody}</p>
                                <details className="mt-3">
                                  <summary className="cursor-pointer text-xs font-bold text-teal-700">View complete draft</summary>
                                  <p className="mt-3 whitespace-pre-wrap rounded-md border border-stone-200 bg-stone-50 p-3 text-sm leading-7 text-stone-700">{draft.draftBody}</p>
                                </details>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                                <StatusBadge tone={draft.approvalRequired ? "amber" : "green"}>Approval: {draft.approvalRequired ? "required" : "not required"}</StatusBadge>
                                <StatusBadge tone={draft.autopublishEligible ? "green" : "neutral"}>Autopublish: {draft.autopublishEligible ? "eligible" : "no"}</StatusBadge>
                              </div>
                              <div className="mt-4">
                                <p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-400">Draft notes</p>
                                {Array.isArray(draft.draftNotes) && draft.draftNotes.length > 0 ? (
                                  <ul className="mt-2 grid gap-2">
                                    {draft.draftNotes.map((note) => <li key={String(note)} className="rounded-md bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-600">{String(note)}</li>)}
                                  </ul>
                                ) : <p className="mt-2 text-sm text-stone-400">No draft notes.</p>}
                              </div>
                            </article>
                          );
                        })}
                        {selectedMonthlyPlan.plannedContentItems.every((item) => !item.contentDraft) ? (
                          <EmptyState>
                            Drafts are generated from planned content items. Choose a calendar item or table row and use
                            Generate Draft to prepare the first review-ready object.
                          </EmptyState>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-7">
                      <h3 className="text-sm font-semibold text-stone-950">Manager tasks</h3>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {selectedMonthlyPlan.managerTasks.map((task) => (
                          <article key={task.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-stone-950">{task.title}</p>
                                <p className="mt-1 leading-6 text-stone-500">{task.description}</p>
                              </div>
                              <StatusBadge tone={task.priority === "high" ? "rose" : "neutral"}>{task.priority}</StatusBadge>
                            </div>
                            <p className="mt-3 text-xs font-semibold text-stone-400">Due {task.dueDate} &middot; {task.status}</p>
                          </article>
                        ))}
                        {selectedMonthlyPlan.managerTasks.length === 0 ? <EmptyState>No manager tasks for this monthly plan.</EmptyState> : null}
                      </div>
                    </div>

                    <div className="mt-6">
                      <JsonDetails title="Raw structured monthly plan" value={selectedMonthlyPlan.rawPlanJson} />
                    </div>
                  </section>
                ) : null}

                <div id="reports" className="grid scroll-mt-24 gap-4 lg:grid-cols-2">
                  <div className="scroll-mt-24">
                    <PreviewCard title="Calendar operations" glyph="C" copy="Daily content operations will show planned posts, drafts, approvals, visuals, videos, and publishing status." />
                  </div>
                  <div id="events" className="scroll-mt-24">
                    <PreviewCard title="Events stream" glyph="E" copy="External events will show new reviews, comments, client approvals, publication results, and AI-proposed actions." />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
