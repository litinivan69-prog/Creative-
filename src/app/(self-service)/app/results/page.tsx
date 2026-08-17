import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SelfServiceAppShell, darkCardClass } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PlatformBrandIcon, platformBrandFromName } from "@/app/(self-service)/platform-brand-icon";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Результаты · Adaptive Presence",
  robots: { index: false, follow: false },
};

function platformLabel(value: string) {
  if (/telegram|телег/i.test(value)) return "Telegram";
  if (/(^|\s)(vk|вк)(\s|$)|vkontakte|вконтакте/i.test(value)) return "VK";
  if (/vc\.ru|виси/i.test(value)) return "VC.ru";
  if (/дзен|dzen/i.test(value)) return "Дзен";
  return value;
}

function formatMonth(value: string) {
  const parsed = new Date(`${value}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(parsed);
  return label.slice(0, 1).toUpperCase() + label.slice(1);
}

export default async function SelfServiceResultsPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/results");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    include: {
      client: {
        include: {
          channels: { where: { status: "active" } },
          monthlyPlans: {
            where: { status: { notIn: ["archived", "replaced"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              plannedContentItems: {
                orderBy: { plannedDate: "asc" },
                include: {
                  contentDraft: { select: { status: true } },
                  scheduledPublications: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { id: true, publishStatus: true, publishedAt: true, externalUrl: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!membership) redirect("/start");

  const workspace = membership.client;
  const plan = workspace.monthlyPlans[0] ?? null;
  const items = plan?.plannedContentItems ?? [];
  const metrics = plan
    ? await prisma.publicationMetric.findMany({
        where: { clientId: workspace.id, monthlyPlanId: plan.id },
        orderBy: { capturedAt: "desc" },
      })
    : [];

  // Platform APIs return cumulative snapshots. Use only the newest snapshot
  // for each material so repeated metric collection never inflates totals.
  const latestMetricByMaterial = new Map<string, (typeof metrics)[number]>();
  for (const metric of metrics) {
    const key = metric.scheduledPublicationId || metric.plannedContentItemId || `unlinked:${metric.platformName}`;
    if (!latestMetricByMaterial.has(key)) latestMetricByMaterial.set(key, metric);
  }
  const latestMetrics = [...latestMetricByMaterial.values()];

  const publishedItems = items.filter((item) => item.scheduledPublications[0]?.publishStatus === "published");
  const readyItems = items.filter((item) => ["ready_to_schedule", "approved"].includes(item.contentDraft?.status ?? "") || item.scheduledPublications[0]?.publishStatus === "published");
  const views = latestMetrics.reduce((sum, metric) => sum + (metric.views ?? metric.reach ?? 0), 0);
  const reactions = latestMetrics.reduce((sum, metric) => sum + (metric.likes ?? 0) + (metric.comments ?? 0) + (metric.shares ?? 0) + (metric.saves ?? 0), 0);
  const engagement = views > 0 ? (reactions / views) * 100 : 0;
  const progress = items.length > 0 ? Math.round((publishedItems.length / items.length) * 100) : 0;

  const platformNames = [...new Set(items.map((item) => platformLabel(item.platformName)))];
  const platformRows = platformNames.map((name) => {
    const platformItems = items.filter((item) => platformLabel(item.platformName) === name);
    const platformPublished = platformItems.filter((item) => item.scheduledPublications[0]?.publishStatus === "published");
    const platformMetrics = latestMetrics.filter((metric) => platformLabel(metric.platformName) === name);
    return {
      name,
      planned: platformItems.length,
      published: platformPublished.length,
      views: platformMetrics.reduce((sum, metric) => sum + (metric.views ?? metric.reach ?? 0), 0),
      reactions: platformMetrics.reduce((sum, metric) => sum + (metric.likes ?? 0) + (metric.comments ?? 0) + (metric.shares ?? 0) + (metric.saves ?? 0), 0),
    };
  });

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="results"
      eyebrow={plan ? `Результаты · ${formatMonth(plan.month)}` : "Результаты"}
      title="Только реальные данные месяца."
      description="Готовность и публикации считаются по календарю. Просмотры и реакции появляются только тогда, когда их действительно вернула площадка."
      headerAction={<Link href={workspace.channels.length ? "/app/month" : "/app/channels"} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.07]">{workspace.channels.length ? "Открыть месяц" : "Подключить площадки"}</Link>}
    >
      {!plan ? (
        <section className={`${darkCardClass} grid min-h-80 place-items-center p-8 text-center`}><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-200">⌇</span><h2 className="mt-5 text-xl font-semibold">Сначала соберём контент-месяц</h2><p className="mt-2 text-sm text-white/32">После подготовки здесь появится простой отчёт по плану и публикациям.</p><Link href="/app/month" className="mt-6 inline-flex rounded-2xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white">Открыть календарь</Link></div></section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "План месяца", value: String(items.length), detail: `${readyItems.length} готовы`, percent: items.length ? Math.round((readyItems.length / items.length) * 100) : 0 },
              { label: "Опубликовано", value: String(publishedItems.length), detail: `${progress}% плана`, percent: progress },
              { label: "Просмотры", value: views.toLocaleString("ru-RU"), detail: latestMetrics.length ? "по последним замерам" : "данных площадок пока нет", percent: null },
              { label: "Вовлечение", value: latestMetrics.length ? `${engagement.toFixed(1)}%` : "—", detail: reactions ? `${reactions.toLocaleString("ru-RU")} реакций` : "после первых метрик", percent: null },
            ].map((card) => <article key={card.label} className={`${darkCardClass} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/28">{card.label}</p><div className="mt-3 flex items-end justify-between gap-2"><p className="text-3xl font-semibold tracking-[-0.04em]">{card.value}</p><span className="max-w-28 text-right text-[9px] leading-4 text-white/24">{card.detail}</span></div>{card.percent !== null ? <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${card.percent}%` }} /></div> : <p className="mt-4 text-[9px] text-white/18">без прогнозных значений</p>}</article>)}
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
            <article className={`${darkCardClass} p-6 sm:p-7`}>
              <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">По площадкам</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Ритм присутствия</h2></div><span className="text-[9px] text-white/24">опубликовано / план</span></div>
              <div className="mt-6 space-y-3">
                {platformRows.map((row) => { const platform = platformBrandFromName(row.name); return <div key={row.name} className="rounded-2xl border border-white/[0.06] bg-black/15 p-4"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3">{platform ? <PlatformBrandIcon platform={platform} size="sm" /> : null}<div className="min-w-0"><p className="text-sm font-semibold text-white/72">{row.name}</p><p className="mt-1 truncate text-[10px] text-white/26">{row.views ? `${row.views.toLocaleString("ru-RU")} просмотров · ${row.reactions.toLocaleString("ru-RU")} реакций` : "метрики площадки пока не получены"}</p></div></div><span className="shrink-0 text-sm font-semibold text-violet-200">{row.published} / {row.planned}</span></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${row.planned ? Math.round((row.published / row.planned) * 100) : 0}%` }} /></div></div>; })}
              </div>
            </article>

            <article className={`${darkCardClass} p-6 sm:p-7`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Что означает отчёт</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Без декоративных цифр</h2>
              <div className="mt-6 space-y-4 text-xs leading-5 text-white/38">
                <p><span className="mr-2 text-violet-300">01</span>Статьи Дзен и VC.ru учитываются после того, как вы отметили их опубликованными.</p>
                <p><span className="mr-2 text-violet-300">02</span>VK и Telegram учитываются автоматически при публикации через кабинет.</p>
                <p><span className="mr-2 text-violet-300">03</span>Просмотры и реакции не рассчитываются приблизительно — только по данным интеграций.</p>
              </div>
              {publishedItems.length > 0 && latestMetrics.length === 0 ? <div className="mt-6 rounded-2xl border border-violet-400/15 bg-violet-500/[0.07] p-4"><p className="text-xs font-semibold text-violet-100">Публикации уже учитываются</p><p className="mt-1 text-[10px] leading-4 text-white/30">Числа охвата появятся, когда площадки начнут возвращать статистику.</p></div> : null}
            </article>
          </section>
        </>
      )}
    </SelfServiceAppShell>
  );
}
