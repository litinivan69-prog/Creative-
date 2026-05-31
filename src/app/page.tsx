import {
  addClientBrief,
  approveDraft,
  createClient,
  generateBlueprint,
  generateContentDraftForItem,
  generateMonthlyPlan,
  markDraftReadyToSchedule,
  rejectDraft,
  requestDraftChanges,
  sendDraftToClient,
  submitDraftForReview,
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
  return value.replaceAll("_", " ");
}

function formatDraftStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    needs_review: "Needs manager review",
    sent_to_client: "Waiting for client",
    client_changes_requested: "Changes requested",
    approved: "Approved",
    rejected: "Rejected",
    ready_to_schedule: "Ready to schedule",
  };

  return labels[status] ?? formatStatus(status);
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

const draftStatusGroups = [
  { status: "needs_review", label: "Needs manager review" },
  { status: "sent_to_client", label: "Waiting for client" },
  { status: "client_changes_requested", label: "Changes requested" },
  { status: "approved", label: "Approved" },
  { status: "ready_to_schedule", label: "Ready to schedule" },
  { status: "rejected", label: "Rejected" },
  { status: "draft", label: "Drafts" },
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
    return <StatusBadge tone="green">Ready to schedule</StatusBadge>;
  }

  if (draft.status === "rejected") {
    return <StatusBadge tone="rose">Rejected</StatusBadge>;
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {draft.status === "draft" || draft.status === "client_changes_requested" ? (
          <DraftWorkflowForm
            action={submitDraftForReview}
            contentDraftId={draft.id}
            label="Submit for review"
            pendingLabel="Submitting..."
            tone="primary"
          />
        ) : null}
        {draft.status === "draft" || draft.status === "needs_review" || draft.status === "client_changes_requested" ? (
          <DraftWorkflowForm
            action={sendDraftToClient}
            contentDraftId={draft.id}
            label="Send to client"
            pendingLabel="Sending..."
          />
        ) : null}
        {draft.status === "draft" || draft.status === "needs_review" ? (
          <DraftWorkflowForm
            action={approveDraft}
            contentDraftId={draft.id}
            label="Approve internally"
            pendingLabel="Approving..."
          />
        ) : null}
        {draft.status === "sent_to_client" ? (
          <DraftWorkflowForm
            action={approveDraft}
            contentDraftId={draft.id}
            actorType="client"
            label="Mark client approved"
            pendingLabel="Approving..."
            tone="primary"
          />
        ) : null}
        {draft.status === "approved" ? (
          <DraftWorkflowForm
            action={markDraftReadyToSchedule}
            contentDraftId={draft.id}
            label="Mark ready to schedule"
            pendingLabel="Updating..."
            tone="primary"
          />
        ) : null}
      </div>
      {draft.status === "needs_review" || draft.status === "sent_to_client" ? (
        <DraftWorkflowForm
          action={requestDraftChanges}
          contentDraftId={draft.id}
          actorType={draft.status === "sent_to_client" ? "client" : "manager"}
          label={draft.status === "sent_to_client" ? "Mark client requested changes" : "Request changes"}
          pendingLabel="Updating..."
          commentPlaceholder="Optional change note"
        />
      ) : null}
      {draft.status !== "approved" ? (
        <DraftWorkflowForm
          action={rejectDraft}
          contentDraftId={draft.id}
          actorType={draft.status === "sent_to_client" ? "client" : "manager"}
          label="Reject"
          pendingLabel="Rejecting..."
          commentPlaceholder="Optional rejection note"
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
        Review timeline ({events.length})
      </summary>
      <div className="grid gap-2 border-t border-stone-200 px-3 py-3">
        {events.length > 0 ? (
          events.map((event) => (
            <div key={event.id} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-500">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-stone-700">{formatStatus(event.action)}</span>
                <span>{event.createdAt.toISOString().replace("T", " ").slice(0, 16)}</span>
              </div>
              <p className="mt-1">Actor: {event.actorType}</p>
              {event.comment ? <p className="mt-1 text-stone-700">{event.comment}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-xs text-stone-400">No review events recorded yet.</p>
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
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Approval workflow</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Review Queue</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Move generated drafts through manager review, simulated client approval, and schedule readiness.
          </p>
        </div>
        <StatusBadge tone={draftCount > 0 ? "teal" : "neutral"}>{draftCount} drafts</StatusBadge>
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
                          <StatusBadge tone={draft.riskLevel === "high" ? "rose" : draft.riskLevel === "medium" ? "amber" : "green"}>Risk {draft.riskLevel}</StatusBadge>
                          {draft.approvalRequired ? <StatusBadge tone="amber">Approval required</StatusBadge> : null}
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">{draft.draftBody}</p>
                      {latestEvent ? (
                        <p className="mt-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-500">
                          Latest: <span className="font-bold text-stone-700">{formatStatus(latestEvent.action)}</span> by {latestEvent.actorType}
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
          <EmptyState>Generate drafts from planned content items to start the approval workflow.</EmptyState>
        </div>
      )}
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
}: {
  progress: number;
  attentionCount: number;
  draftCount: number;
  integrationTaskCount: number;
}) {
  return (
    <article className={`${panelClass} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Operations overview</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">Monthly production health</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            A practical progress signal based on prepared drafts, review pressure, and integration readiness.
          </p>
        </div>
        <StatusBadge tone={integrationTaskCount > 0 ? "amber" : "green"}>
          {integrationTaskCount > 0 ? "Access work pending" : "On track"}
        </StatusBadge>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="text-5xl font-semibold text-stone-950">{progress}%</p>
          <p className="mt-2 text-sm font-semibold text-stone-700">Production readiness</p>
          <p className="mt-1 text-xs leading-5 text-stone-400">Drafts prepared against planned calendar items.</p>
        </div>
        <div>
          <div className="flex h-44 items-end gap-3 rounded-lg border border-stone-200 bg-stone-50 px-5 pb-4 pt-6">
            {[
              { label: "Plan", value: 100, tone: "bg-teal-500" },
              { label: "Draft", value: Math.max(progress, 10), tone: "bg-sky-500" },
              { label: "Review", value: attentionCount > 0 ? 58 : 20, tone: "bg-amber-400" },
              { label: "Ready", value: integrationTaskCount > 0 ? 22 : Math.max(progress - 12, 10), tone: "bg-emerald-500" },
            ].map((bar) => (
              <div key={bar.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                <div className={`w-full max-w-14 rounded-t-md ${bar.tone}`} style={{ height: `${bar.value}%` }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-stone-400">{bar.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />On track</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-sky-500" />In progress</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />At risk</span>
            <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-500" />Blocked</span>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <MetricCard label="Prepared drafts" value={draftCount} detail="Ready for review" tone="teal" />
        <MetricCard label="Needs attention" value={attentionCount} detail="Approval pressure" tone="amber" />
        <MetricCard label="Integration tasks" value={integrationTaskCount} detail="Before launch" tone={integrationTaskCount > 0 ? "rose" : "stone"} />
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
  const timeline = ["Planning", "Content creation", "Approvals", "Publishing", "Reporting"];

  return (
    <section className={`${panelClass} overflow-hidden`}>
      <div className="border-b border-stone-200 bg-[#f8fbfa] px-5 py-5 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Future client portal preview</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-950">Welcome, {clientName}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          A calm approval-focused client view powered by the same Adaptive Presence operating system.
        </p>
      </div>
      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h3 className="text-sm font-semibold text-stone-950">What needs your attention</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Awaiting approval" value={approvalCount} tone="amber" />
            <MetricCard label="Scheduled this week" value={weeklyCount} tone="teal" />
            <MetricCard label="Published this month" value="-" detail="Coming later" />
            <MetricCard label="Open review responses" value="-" detail="Events coming later" />
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-stone-950">Monthly timeline</p>
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
            <p className="text-xs font-bold text-stone-700">Approval card</p>
            <StatusBadge tone="amber">Preview only</StatusBadge>
          </div>
          {selectedItem ? (
            <>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <StatusBadge tone="teal">{selectedItem.platformName}</StatusBadge>
                <StatusBadge>{selectedItem.format}</StatusBadge>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-stone-900">{selectedItem.topic}</p>
              <div className="mt-3 flex h-24 items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">
                Visual preview
              </div>
              <p className="mt-3 line-clamp-4 text-xs leading-5 text-stone-500">
                {selectedItem.contentDraft?.draftBody || "The approved draft text will appear here for a simple client review experience."}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-stone-500">The next approval-ready publication will appear here.</p>
          )}
          <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
            <p className="text-xs font-bold text-stone-700">Comments</p>
            <p className="mt-1 text-xs leading-5 text-stone-400">Client and manager discussion will appear here.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400">Request changes</button>
            <button type="button" disabled className="rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white opacity-60">Approve</button>
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
      Review draft
    </a>
  ) : (
    <form action={generateContentDraftForItem}>
      <input type="hidden" name="plannedContentItemId" value={item.id} />
      <PendingSubmitButton
        pendingLabel="Generating..."
        className="rounded-md bg-stone-950 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:bg-stone-400"
      >
        Generate draft
      </PendingSubmitButton>
    </form>
  );
}

function ContentCalendar({
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
  const items = groups.flatMap((group) => group.items);
  const inspectorItem = items[0];
  const approvalCount = items.filter((item) => item.approvalRequired).length;
  const draftCount = items.filter((item) => item.contentDraft).length;

  return (
    <section id="calendar" className={`${panelClass} scroll-mt-24 overflow-hidden`}>
      <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Production workspace</p>
            <h2 className="mt-1 text-2xl font-semibold text-stone-950">Content Calendar</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              The operational center for planned content, drafts, review status, and future publishing paths.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass}>All clients</button>
            <button type="button" className={secondaryButtonClass}>All platforms</button>
            <button type="button" className={secondaryButtonClass}>Week</button>
            <StatusBadge tone="teal">{month}</StatusBadge>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Content pieces" value={items.length} detail="In current calendar" />
          <MetricCard label="Scheduled" value={items.length} detail="Planning layer" tone="teal" />
          <MetricCard label="Awaiting approval" value={approvalCount} detail="Needs review" tone="amber" />
          <MetricCard label="Draft ready" value={draftCount} detail="Prepared objects" />
          <MetricCard label="Engagement estimate" value="-" detail="Analytics coming later" />
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-x-auto bg-stone-50/50 p-4">
            <div className="grid min-w-[920px] grid-cols-4 gap-3">
              {groups.map((group) => (
                <article key={group.label} className="rounded-lg border border-stone-200 bg-stone-100/70 p-3">
                  <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">{group.label}</p>
                      <p className="mt-1 text-xs text-stone-400">{group.items.length} content pieces</p>
                    </div>
                    <StatusBadge>{group.items.length}</StatusBadge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {group.items.map((item) => (
                      <div key={item.id} className="rounded-md border border-stone-200 bg-white p-3 shadow-[0_1px_2px_rgba(28,36,38,0.04)]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone="teal">{item.platformName}</StatusBadge>
                          <StatusBadge>{item.format}</StatusBadge>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-stone-400">{item.plannedDate}</p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-stone-900">{item.topic}</p>
                        {suggestsVisualAsset(item.format) ? (
                          <div className="mt-3 flex h-16 items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">
                            Visual / video
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <StatusBadge tone={item.status === "planned" ? "teal" : "amber"}>{formatStatus(item.status)}</StatusBadge>
                          {item.approvalRequired ? <StatusBadge tone="amber">Needs review</StatusBadge> : null}
                          {item.contentDraft ? <StatusBadge tone="green">Draft ready</StatusBadge> : null}
                        </div>
                        <div className="mt-3 border-t border-stone-100 pt-3">
                          <ContentItemAction item={item} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="border-t border-stone-200 bg-white p-5 xl:border-l xl:border-t-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Content inspector</p>
            {inspectorItem ? (
              <div className="mt-4">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone="teal">{inspectorItem.platformName}</StatusBadge>
                  <StatusBadge>{inspectorItem.format}</StatusBadge>
                </div>
                <h3 className="mt-3 text-lg font-semibold leading-7 text-stone-950">{inspectorItem.topic}</h3>
                <p className="mt-1 text-xs font-semibold text-stone-400">{inspectorItem.plannedDate}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <StatusBadge tone="teal">{formatStatus(inspectorItem.status)}</StatusBadge>
                  {inspectorItem.approvalRequired ? <StatusBadge tone="amber">Needs review</StatusBadge> : <StatusBadge tone="green">Review optional</StatusBadge>}
                </div>
                <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">
                  Visual preview
                </div>
                <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-bold text-stone-700">Draft preview</p>
                  <p className="mt-2 line-clamp-5 text-xs leading-5 text-stone-500">
                    {inspectorItem.contentDraft?.draftBody || "Generate a draft to prepare manager-review copy for this calendar item."}
                  </p>
                </div>
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-900">Approval block</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    {inspectorItem.approvalRequired ? "Human review is required before any future scheduling step." : "This item can follow the Blueprint review policy."}
                  </p>
                </div>
                <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 p-3">
                  <p className="text-xs font-bold text-teal-900">AI recommendation</p>
                  <p className="mt-1 text-xs leading-5 text-teal-800">Keep the channel-native angle and confirm any factual details during review.</p>
                </div>
                <div className="mt-3 rounded-md border border-stone-200 p-3">
                  <p className="text-xs font-bold text-stone-700">Publish path</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">Draft &rarr; Review &rarr; Approval &rarr; Scheduling</p>
                </div>
                <div className="mt-4 grid gap-2">
                  <ContentItemAction item={inspectorItem} />
                  <button type="button" disabled className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400">Send to client</button>
                  <button type="button" disabled className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400">Approve &amp; schedule</button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-stone-500">Calendar item details will appear here after the first Monthly Plan is generated.</p>
            )}
          </aside>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="rounded-lg border border-dashed border-teal-300 bg-teal-50/70 p-6">
            <p className="text-sm font-semibold text-teal-950">Your production calendar is ready for its first plan.</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-800">
              Generate a Monthly Operating Plan to activate week columns, review queues, inspector details, and draft actions.
            </p>
            {blueprintId ? (
              <form action={generateMonthlyPlan} className="mt-4">
                <input type="hidden" name="blueprintId" value={blueprintId} />
                <PendingSubmitButton pendingLabel="Generating Monthly Plan..." disabled={generationBlocked} className={primaryButtonClass}>
                  Generate Monthly Plan
                </PendingSubmitButton>
              </form>
            ) : (
              <a href="#clients" className="mt-4 inline-flex text-sm font-bold text-teal-800 transition hover:text-teal-950">
                Start with Setup / Intake
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

        <div id="settings" className="grid gap-3 border-t border-white/10 px-4 py-4">
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <p className="text-xs font-semibold text-white">AI Copilot</p>
            <p className="mt-1 text-xs leading-5 text-stone-400">Ask anything about clients or operations.</p>
          </div>
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white">M</div>
            <div>
              <p className="text-xs font-semibold text-stone-200">Manager profile</p>
              <p className="mt-0.5 text-[11px] text-stone-500">Creative operations</p>
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
                  <h1 className="text-base font-semibold text-stone-950">Manager Console</h1>
                  <StatusBadge tone="teal">Adaptive Presence OS</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs font-medium text-stone-400">by Creative</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden flex-wrap items-center gap-3 xl:flex">
                <ConnectionBadge label={process.env.OPENAI_API_KEY ? "OpenAI connected" : "OpenAI setup needed"} active={Boolean(process.env.OPENAI_API_KEY)} />
                <ConnectionBadge label="Neon connected" />
                <ConnectionBadge label={process.env.VERCEL ? "Live" : "Local"} />
              </div>
              <input
                aria-label="Search workspace"
                className="w-64 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 outline-none placeholder:text-stone-400 focus:border-teal-500"
                placeholder="Search clients, drafts, events..."
              />
              <button type="button" aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-md border border-stone-200 bg-white text-xs font-bold text-stone-600">
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
                <MetricCard label="Needs manager review" value={needsManagerReviewCount} detail="Drafts in the internal queue" tone="amber" />
                <MetricCard label="Waiting for client" value={waitingForClientCount} detail="Simulated client review" tone="teal" />
                <MetricCard label="Approved" value={approvedDraftCount} detail="Ready for final scheduling step" />
                <MetricCard label="Ready to schedule" value={readyToScheduleCount} detail="Publishing is not connected yet" tone="teal" />
              </div>
            </section>

            <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <OperationsOverview
                progress={productionProgress}
                attentionCount={approvalQueueCount}
                draftCount={draftCount}
                integrationTaskCount={integrationTaskCount}
              />
              <article className={`${panelClass} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Selected client</p>
                  <StatusBadge tone={latestBlueprint ? "green" : "amber"}>{latestBlueprint ? "Active" : "Setup needed"}</StatusBadge>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-stone-950">{latestBlueprint?.client.name ?? "No client selected"}</h2>
                <p className="mt-1 text-xs font-semibold text-stone-400">{latestBlueprint?.client.industry ?? "Choose or create a client to begin."}</p>
                <div className="mt-5 grid gap-2">
                  <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                    <p className="text-xs font-bold text-stone-700">Blueprint</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{latestBlueprint ? `${latestBlueprint.confidenceScore}% confidence` : "Not generated"}</p>
                  </div>
                  <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                    <p className="text-xs font-bold text-stone-700">Monthly plan</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{selectedMonthlyPlan ? `${plannedContentCount} calendar items` : "Not generated"}</p>
                  </div>
                  <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                    <p className="text-xs font-bold text-stone-700">Next recommended action</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">{latestBlueprint?.nextRecommendedAction ?? "Create client brief"}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3">
                  <p className="text-xs font-bold text-teal-900">AI insight</p>
                  <p className="mt-1 text-xs leading-5 text-teal-800">
                    {latestBlueprint ? "Keep the current operating sequence focused on review quality and channel-native execution." : "The AI operating layer activates after Blueprint generation."}
                  </p>
                </div>
              </article>
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
                    <p className="text-xs font-bold text-amber-900">Needs manager review</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{needsManagerReviewCount}</p>
                  </div>
                  <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                    <p className="text-xs font-bold text-teal-900">Waiting for client</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{waitingForClientCount}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-bold text-stone-700">Approved</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{approvedDraftCount}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-bold text-emerald-900">Ready to schedule</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-950">{readyToScheduleCount}</p>
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

            <ReviewQueue groups={reviewQueueGroups} />

            <section className="mt-7">
              <ContentCalendar
                groups={calendarGroups}
                month={selectedMonthlyPlan?.month ?? currentMonth()}
                blueprintId={latestBlueprint?.id}
                generationBlocked={latestBlueprint?.nextRecommendedAction === "request_more_brief_data"}
              />
            </section>

            <div className="mt-7">
              <ClientPortalPreview
                clientName={latestBlueprint?.client.name ?? "your business"}
                approvalCount={approvalQueueCount}
                weeklyCount={firstCalendarGroup?.items.length ?? 0}
                selectedItem={selectedInspectorItem}
              />
            </div>

            <section id="clients" className="mt-10 scroll-mt-24">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Setup / Intake</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-950">Client operating configuration</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                  Secondary onboarding controls and detailed operating records. Daily work stays in the command center and Content Calendar above.
                </p>
              </div>
              <div className="mt-5 grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="grid gap-5 xl:sticky xl:top-24">
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
                                <div className="flex items-start gap-3">
                                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 text-[9px] font-bold uppercase tracking-[0.1em] text-stone-400">
                                    Visual
                                  </div>
                                  <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-teal-700">{draft.platformName} &middot; {draft.format}</p>
                                  <h4 className="mt-2 text-lg font-semibold text-stone-950">{draft.draftTitle}</h4>
                                  <p className="mt-1 text-xs text-stone-400">{draft.topic}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <StatusBadge tone={draftStatusTone(draft.status)}>{formatDraftStatus(draft.status)}</StatusBadge>
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
                              <div className="mt-4">
                                <ReviewEventTimeline events={draft.reviewEvents} />
                              </div>
                              <a href="#review-queue" className="mt-4 inline-flex text-xs font-bold text-teal-700 transition hover:text-teal-900">
                                Open workflow actions in Review Queue
                              </a>
                            </article>
                          );
                        })}
                        {selectedMonthlyPlan.plannedContentItems.every((item) => !item.contentDraft) ? (
                          <EmptyState>
                            Generate drafts from planned content items to start the approval workflow.
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
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
