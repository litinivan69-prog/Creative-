import {
  createClient,
  addClientBrief,
  generateBlueprint,
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

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-600">
      {children}
    </div>
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
                plannedContentItems: true,
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
                plannedContentItems: true,
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

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">Sprint 0 + Sprint 1</p>
            <h1 className="text-3xl font-semibold text-slate-950">Adaptive Presence OS</h1>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Client brief to executable Blueprint to monthly operating plan, saved in PostgreSQL with Prisma and displayed for managers.
          </p>
        </header>

        {params.error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
            {params.error}
          </div>
        ) : null}

        {params.notice ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
            {params.notice}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="flex flex-col gap-6">
            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle eyebrow="Client" title="Create Client" />
              <form action={createClient} className="mt-5 grid gap-3">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Name
                  <input
                    name="name"
                    required
                    className="rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-600"
                    placeholder="Northstar Dental Studio"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Website
                  <input
                    name="website"
                    className="rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-600"
                    placeholder="https://example.com"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Industry
                  <input
                    name="industry"
                    className="rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-600"
                    placeholder="Healthcare"
                  />
                </label>
                <PendingSubmitButton
                  pendingLabel="Creating..."
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-600"
                >
                  Create client
                </PendingSubmitButton>
              </form>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle eyebrow="Brief" title="Add Raw Brief" />
              {clients.length > 0 ? (
                <form action={addClientBrief} className="mt-5 grid gap-3">
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    Client
                    <select
                      name="clientId"
                      required
                      className="rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-600"
                    >
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    Raw brief
                    <textarea
                      name="rawBrief"
                      required
                      rows={8}
                      className="resize-y rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-600"
                      placeholder="Paste goals, target audience, constraints, current channels, brand risks, team capacity..."
                    />
                  </label>
                  <PendingSubmitButton
                    pendingLabel="Saving..."
                    className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:bg-teal-500"
                  >
                    Save brief
                  </PendingSubmitButton>
                </form>
              ) : (
                <div className="mt-5">
                  <EmptyState>Create a client before adding a brief.</EmptyState>
                </div>
              )}
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle eyebrow="Queue" title="Briefs" />
              <div className="mt-5 grid gap-3">
                {clients.flatMap((client) =>
                  client.briefs.map((brief) => (
                    <div key={brief.id} className="rounded-md border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{client.name}</p>
                          <p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-600">{brief.rawBrief}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {brief.blueprint ? "Generated" : "Ready"}
                        </span>
                      </div>
                      <details className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Edit brief</summary>
                        <form action={updateClientBrief} className="mt-3 grid gap-3">
                          <input type="hidden" name="briefId" value={brief.id} />
                          <textarea
                            name="rawBrief"
                            required
                            rows={7}
                            defaultValue={brief.rawBrief}
                            className="resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-600"
                          />
                          {brief.blueprint ? (
                            <p className="text-xs leading-5 text-slate-500">
                              Saving changes clears the generated blueprint so the next blueprint matches the edited brief.
                            </p>
                          ) : null}
                          <PendingSubmitButton
                            pendingLabel="Saving..."
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:text-slate-500"
                          >
                            Save edited brief
                          </PendingSubmitButton>
                        </form>
                      </details>
                      <form action={generateBlueprint} className="mt-4">
                        <input type="hidden" name="briefId" value={brief.id} />
                        <PendingSubmitButton
                          pendingLabel={brief.blueprint ? "Opening Blueprint..." : "Generating Blueprint..."}
                          className="w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-wait disabled:bg-amber-400"
                        >
                          {brief.blueprint ? "View blueprint" : "Generate blueprint"}
                        </PendingSubmitButton>
                      </form>
                    </div>
                  )),
                )}
                {clients.every((client) => client.briefs.length === 0) ? (
                  <EmptyState>No briefs saved yet.</EmptyState>
                ) : null}
              </div>
            </section>
          </aside>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle eyebrow="Blueprint" title="Client Presence Blueprint" />
            {latestBlueprint ? (
              <div className="mt-5 grid gap-6">
                <div className="grid gap-4 border-b border-slate-200 pb-5 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <p className="text-sm font-semibold text-slate-500">{latestBlueprint.client.name}</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">{latestBlueprint.clientSummary}</h3>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">Confidence</p>
                      <p className="text-slate-800">{latestBlueprint.confidenceScore}/100</p>
                    </div>
                    <div className="rounded-md bg-rose-50 p-3">
                      <p className="font-semibold text-rose-900">Next action</p>
                      <p className="text-rose-800">{latestBlueprint.nextRecommendedAction}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">Monthly units</p>
                      <p className="text-slate-800">
                        {latestBlueprint.totalContentUnitsMin}-{latestBlueprint.totalContentUnitsMax}
                      </p>
                    </div>
                    <div className="rounded-md bg-teal-50 p-3">
                      <p className="font-semibold text-teal-900">Approval mode</p>
                      <p className="text-teal-800">{latestBlueprint.approvalMode}</p>
                    </div>
                    <div className="rounded-md bg-amber-50 p-3">
                      <p className="font-semibold text-amber-900">Manager attention</p>
                      <p className="text-amber-800">{latestBlueprint.managerAttentionLevel}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-950">Monthly Operating Plan</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        This is the planning layer for the month: modules, platforms, cadence, approvals, and tasks.
                        It does not generate final content.
                      </p>
                    </div>
                    {currentMonthlyPlan ? (
                      <a
                        href={`/?blueprint=${latestBlueprint.id}&plan=${currentMonthlyPlan.id}#monthly-plan`}
                        className="rounded-md border border-teal-700 bg-white px-4 py-2 text-center text-sm font-semibold text-teal-800 hover:bg-teal-50"
                      >
                        View Current Plan
                      </a>
                    ) : (
                      <form action={generateMonthlyPlan}>
                        <input type="hidden" name="blueprintId" value={latestBlueprint.id} />
                        <PendingSubmitButton
                          pendingLabel="Generating Monthly Plan..."
                          disabled={latestBlueprint.nextRecommendedAction === "request_more_brief_data"}
                          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                        >
                          Generate Monthly Plan
                        </PendingSubmitButton>
                      </form>
                    )}
                  </div>
                  {currentMonthlyPlan ? (
                    <p className="mt-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900">
                      A Monthly Operating Plan already exists for {currentMonthlyPlan.month}. The existing plan is
                      displayed below.
                    </p>
                  ) : null}
                  {latestBlueprint.nextRecommendedAction === "request_more_brief_data" ? (
                    <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
                      Monthly plan generation is blocked until the missing brief data is resolved.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-slate-950">Business goals</h4>
                    <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                      {(latestBlueprint.businessGoals as string[]).map((goal) => (
                        <li key={goal} className="rounded-md bg-slate-50 px-3 py-2">
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950">Recommended monthly content scope</h4>
                    <div className="mt-3">
                      <JsonBlock value={latestBlueprint.recommendedMonthlyContentScope} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-slate-950">Missing brief fields</h4>
                    <div className="mt-3">
                      <JsonBlock value={latestBlueprint.missingBriefFields} />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950">Assumptions</h4>
                    <div className="mt-3">
                      <JsonBlock value={latestBlueprint.assumptions} />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-950">Platform recommendations</h4>
                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    {latestBlueprint.platformRecommendations.map((platform) => (
                      <article key={platform.id} className="rounded-md border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h5 className="font-semibold text-slate-950">{platform.platformName}</h5>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {platform.recommendation}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-md bg-teal-50 px-2 py-1 text-teal-800">
                            {platform.platformType}
                          </span>
                          <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">
                            {platform.priority}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                            {platform.automationStatus}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{platform.rationale}</p>
                        <p className="mt-3 text-sm font-semibold text-slate-700">{platform.suggestedFrequency}</p>
                        <div className="mt-3 grid gap-2 text-xs text-slate-600">
                          <p>
                            <span className="font-semibold text-slate-800">Credentials:</span>{" "}
                            {Array.isArray(platform.requiredCredentials)
                              ? platform.requiredCredentials.join(", ") || "None"
                              : "None"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-800">Permissions:</span>{" "}
                            {Array.isArray(platform.permissionsNeeded)
                              ? platform.permissionsNeeded.join(", ") || "None"
                              : "None"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-800">Formats:</span>{" "}
                            {Array.isArray(platform.contentFormats)
                              ? platform.contentFormats.join(", ") || "None"
                              : "None"}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-950">Selected modules</h4>
                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    {latestBlueprint.selectedModules.map((module) => (
                      <article key={module.id} className="rounded-md border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="font-semibold text-slate-950">{module.name}</h5>
                            <p className="mt-1 text-xs font-semibold text-teal-700">{module.moduleType}</p>
                          </div>
                          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                            {module.priority}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{module.purpose}</p>
                        <div className="mt-3">
                          <JsonBlock value={module.monthlyContentScope} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-slate-950">Publishing frequency</h4>
                    <div className="mt-3">
                      <JsonBlock value={latestBlueprint.publishingFrequency} />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950">Not recommended platforms</h4>
                    <div className="mt-3">
                      <JsonBlock value={latestBlueprint.notRecommendedPlatforms} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-slate-950">Integration requirements</h4>
                    <div className="mt-3">
                      <JsonBlock value={latestBlueprint.integrationRequirements} />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950">Human review policy</h4>
                    <div className="mt-3">
                      <JsonBlock value={latestBlueprint.humanReviewPolicy} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-slate-950">Automation plan</h4>
                    <div className="mt-3 grid gap-3">
                      {latestBlueprint.automationPlans.map((automation) => (
                        <article key={automation.id} className="rounded-md border border-slate-200 p-4 text-sm">
                          <h5 className="font-semibold text-slate-950">{automation.name}</h5>
                          <p className="mt-2 text-slate-600">{automation.trigger}</p>
                          <p className="mt-2 text-slate-800">{automation.action}</p>
                          <p className="mt-2 text-slate-500">{automation.humanCheckpoint}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950">Risk rules</h4>
                    <div className="mt-3 grid gap-3">
                      {latestBlueprint.riskRules.map((rule) => (
                        <article key={rule.id} className="rounded-md border border-slate-200 p-4 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <h5 className="font-semibold text-slate-950">{rule.ruleName}</h5>
                            <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">
                              {rule.severity}
                            </span>
                          </div>
                          <p className="mt-2 text-slate-600">{rule.riskDescription}</p>
                          <p className="mt-2 text-slate-800">{rule.preventionAction}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>

                <details className="rounded-md border border-slate-200 p-4">
                  <summary className="cursor-pointer font-semibold text-slate-950">Raw structured blueprint</summary>
                  <div className="mt-3">
                    <JsonBlock value={latestBlueprint.rawBlueprintJson} />
                  </div>
                </details>

                {selectedMonthlyPlan ? (
                  <section id="monthly-plan" className="scroll-mt-6 rounded-md border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
                          Monthly Plan
                        </p>
                        <h4 className="mt-1 text-xl font-semibold text-slate-950">
                          {selectedMonthlyPlan.month}
                        </h4>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Summary
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{selectedMonthlyPlan.summary}</p>
                      </div>
                      <div className="grid gap-2 text-sm sm:min-w-56">
                        <div className="rounded-md bg-slate-50 p-3">
                          <p className="font-semibold text-slate-900">Status</p>
                          <p className="text-slate-700">{selectedMonthlyPlan.status}</p>
                        </div>
                        <div className="rounded-md bg-teal-50 p-3">
                          <p className="font-semibold text-teal-900">Planned units</p>
                          <p className="text-teal-800">{selectedMonthlyPlan.totalPlannedUnits}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-3">
                      <div>
                        <h5 className="font-semibold text-slate-950">Approval strategy</h5>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {selectedMonthlyPlan.approvalStrategy}
                        </p>
                      </div>
                      <div>
                        <h5 className="font-semibold text-slate-950">Autopublish strategy</h5>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {selectedMonthlyPlan.autopublishStrategy}
                        </p>
                      </div>
                      <div>
                        <h5 className="font-semibold text-slate-950">Risk summary</h5>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{selectedMonthlyPlan.riskSummary}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-2">
                      <div>
                        <h5 className="font-semibold text-slate-950">Active modules</h5>
                        <div className="mt-3 grid gap-3">
                          {selectedMonthlyPlan.modules.map((module) => (
                            <article key={module.id} className="rounded-md border border-slate-200 p-3 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-950">{module.name}</p>
                                  <p className="mt-1 text-xs font-semibold text-teal-700">{module.moduleType}</p>
                                </div>
                                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                                  {module.plannedUnitsMin}-{module.plannedUnitsMax}
                                </span>
                              </div>
                              <p className="mt-2 leading-6 text-slate-600">{module.rationale}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="font-semibold text-slate-950">Selected platforms</h5>
                        <div className="mt-3 grid gap-3">
                          {selectedMonthlyPlan.platforms.map((platform) => (
                            <article key={platform.id} className="rounded-md border border-slate-200 p-3 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-950">{platform.platformName}</p>
                                  <p className="mt-1 text-xs font-semibold text-teal-700">
                                    {platform.platformType} · {platform.automationStatus}
                                  </p>
                                </div>
                                {platform.requiresIntegrationBeforeLaunch ? (
                                  <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">
                                    Integration needed
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 leading-6 text-slate-600">{platform.plannedCadence}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {Array.isArray(platform.contentFormats)
                                  ? platform.contentFormats.join(", ")
                                  : ""}
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h5 className="font-semibold text-slate-950">Planned content items</h5>
                      <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                            <tr>
                              <th className="px-3 py-3">Date</th>
                              <th className="px-3 py-3">Module</th>
                              <th className="px-3 py-3">Platform</th>
                              <th className="px-3 py-3">Format</th>
                              <th className="px-3 py-3">Topic</th>
                              <th className="px-3 py-3">Goal</th>
                              <th className="px-3 py-3">Approval</th>
                              <th className="px-3 py-3">Autopublish</th>
                              <th className="px-3 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {selectedMonthlyPlan.plannedContentItems.map((item) => (
                              <tr key={item.id} className="align-top">
                                <td className="px-3 py-3 text-slate-700">{item.plannedDate}</td>
                                <td className="px-3 py-3 text-slate-700">{item.moduleType}</td>
                                <td className="px-3 py-3 text-slate-700">{item.platformName}</td>
                                <td className="px-3 py-3 text-slate-700">{item.format}</td>
                                <td className="px-3 py-3 font-semibold text-slate-950">{item.topic}</td>
                                <td className="px-3 py-3 text-slate-600">{item.goal}</td>
                                <td className="px-3 py-3 text-slate-700">
                                  {item.approvalRequired ? "Required" : "Not required"}
                                </td>
                                <td className="px-3 py-3 text-slate-700">
                                  {item.autopublishEligible ? "Eligible" : "No"}
                                </td>
                                <td className="px-3 py-3 text-slate-700">{item.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h5 className="font-semibold text-slate-950">Manager tasks</h5>
                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        {selectedMonthlyPlan.managerTasks.map((task) => (
                          <article key={task.id} className="rounded-md border border-slate-200 p-4 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-950">{task.title}</p>
                                <p className="mt-1 text-slate-600">{task.description}</p>
                              </div>
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {task.priority}
                              </span>
                            </div>
                            <p className="mt-3 text-xs font-semibold text-slate-500">
                              Due {task.dueDate} · {task.status}
                            </p>
                          </article>
                        ))}
                        {selectedMonthlyPlan.managerTasks.length === 0 ? (
                          <EmptyState>No manager tasks for this monthly plan.</EmptyState>
                        ) : null}
                      </div>
                    </div>

                    <details className="mt-6 rounded-md border border-slate-200 p-4">
                      <summary className="cursor-pointer font-semibold text-slate-950">
                        Raw structured monthly plan
                      </summary>
                      <div className="mt-3">
                        <JsonBlock value={selectedMonthlyPlan.rawPlanJson} />
                      </div>
                    </details>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState>Generate a blueprint from a saved client brief to see the operating system plan.</EmptyState>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
