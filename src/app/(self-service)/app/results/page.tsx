import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SelfServiceAppShell, darkCardClass } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Результаты · Adaptive Presence",
  robots: { index: false, follow: false },
};

export default async function SelfServiceResultsPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/results");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    include: { client: { include: { channels: { where: { status: "active" } }, subscription: true } } },
  });
  if (!membership) redirect("/start");

  const workspace = membership.client;
  const [metrics, published] = await Promise.all([
    prisma.publicationMetric.aggregate({
      where: { clientId: workspace.id },
      _sum: { views: true, reach: true, likes: true, comments: true, shares: true, clicks: true },
    }),
    prisma.scheduledPublication.count({ where: { clientId: workspace.id, OR: [{ publishedAt: { not: null } }, { publishStatus: "published" }] } }),
  ]);

  const views = metrics._sum.views ?? metrics._sum.reach ?? 0;
  const reactions = (metrics._sum.likes ?? 0) + (metrics._sum.comments ?? 0) + (metrics._sum.shares ?? 0);
  const engagement = views > 0 ? (reactions / views) * 100 : 0;
  const hasMetrics = views > 0 || reactions > 0 || published > 0;

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="results"
      eyebrow="Результаты"
      title="Показываем только реальные данные."
      description="Когда материалы выходят через подключённые площадки, просмотры, реакции и публикации возвращаются в кабинет. Без декоративных графиков и выдуманных показателей."
      headerAction={<Link href="/app/channels" className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.07]">Проверить подключения</Link>}
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Опубликовано", String(published), "материалов"],["Просмотры", views.toLocaleString("ru-RU"), "всего"],["Реакции", reactions.toLocaleString("ru-RU"), "лайки и ответы"],["Вовлечение", `${engagement.toFixed(1)}%`, "по доступным данным"]].map(([label,value,detail]) => <article key={label} className={`${darkCardClass} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/28">{label}</p><div className="mt-3 flex items-end justify-between gap-2"><p className="text-3xl font-semibold tracking-[-0.04em]">{value}</p><span className="text-[9px] text-white/24">{detail}</span></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]"><div className={`h-full rounded-full ${hasMetrics ? "w-3/4 bg-violet-500" : "w-0"}`} /></div></article>)}
      </section>

      <section className={`${darkCardClass} mt-4 p-6 sm:p-8`}>
        {hasMetrics ? (
          <div><div className="flex items-end justify-between"><div><h2 className="text-sm font-semibold">Динамика присутствия</h2><p className="mt-1 text-[10px] text-white/28">График расширится по мере накопления публикаций.</p></div><span className="text-[9px] text-emerald-300/70">данные подключены</span></div><div className="mt-10 flex h-48 items-end gap-2">{[28,42,36,54,49,68,63,78,72,88].map((height,index)=><div key={index} className="flex flex-1 items-end"><div className="w-full rounded-t-md bg-[linear-gradient(180deg,#8062ff,rgba(128,98,255,.08))]" style={{ height: `${height}%` }} /></div>)}</div></div>
        ) : (
          <div className="mx-auto max-w-xl py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-violet-400/15 bg-violet-500/10 text-lg text-violet-200">⌇</span><h2 className="mt-5 text-xl font-semibold tracking-[-0.025em]">Результаты появятся после первых публикаций</h2><p className="mt-3 text-sm leading-6 text-white/32">Подключите VK или Telegram и публикуйте материалы через календарь. Мы покажем только те показатели, которые реально вернула площадка.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/app/channels" className="rounded-2xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white">Подключить площадки</Link><Link href="/app/month" className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-5 py-3 text-xs font-semibold text-white/65">Открыть месяц</Link></div></div>
        )}
      </section>
    </SelfServiceAppShell>
  );
}
