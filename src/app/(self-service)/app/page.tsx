import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signOutSelfService } from "@/lib/self-service/auth-actions";
import { hasSelfServicePaidAccess } from "@/lib/self-service/subscription";
import { darkCardClass, SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { PlatformBrandIcon, platformBrandFromName, type PlatformBrand } from "@/app/(self-service)/platform-brand-icon";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { articleHeroUrl } from "@/lib/article-engine";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Главная · Adaptive Presence",
  robots: { index: false, follow: false },
};

function overviewVisual(item: {
  id: string;
  creativeAssets: Array<{
    assetType: string;
    notes: string | null;
    generatedVariants: Array<{ id: string }>;
  }>;
  generatedCreativeVariants: Array<{ id: string }>;
}, articleCover?: string | null) {
  if (articleCover) return { src: articleCover, slideCount: 0 };
  const slides = item.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");
  const activeAssets = slides.length > 0
    ? slides
    : item.creativeAssets.filter((asset) => !asset.notes?.includes("legacyCombinedCarouselAsset=true"));
  const variant = activeAssets.flatMap((asset) => asset.generatedVariants)[0]
    ?? (slides.length === 0 ? item.generatedCreativeVariants[0] : null)
    ?? null;

  return variant
    ? {
        src: `/api/self-service/materials/${item.id}/visuals?variant=${variant.id}&inline=1`,
        slideCount: slides.length,
      }
    : null;
}

function overviewPlatformLabel(value: string) {
  if (/telegram|телег/i.test(value)) return "Telegram";
  if (/(^|\s)(vk|вк)(\s|$)|vkontakte|вконтакте/i.test(value)) return "VK";
  if (/однокласс|(^|\s)ок(\s|$)/i.test(value)) return "Одноклассники";
  if (/vc\.ru|виси/i.test(value)) return "VC.ru";
  if (/дзен|dzen|zen/i.test(value)) return "Дзен";
  return value;
}

export default async function SelfServiceHomePage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) redirect("/sign-in?callbackUrl=/app");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    include: {
      client: {
        include: {
              subscription: true,
              brandProfile: true,
              channels: { where: { status: "active" }, select: { id: true, platform: true } },
              monthlyPlans: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                  plannedContentItems: {
                    orderBy: { plannedDate: "asc" },
                    select: {
                      id: true,
                      topic: true,
                      platformName: true,
                      plannedDate: true,
                      contentDraft: { select: { id: true } },
                      generatedCreativeVariants: { select: { id: true }, take: 1 },
                      creativeAssets: {
                        orderBy: { createdAt: "asc" },
                        select: {
                          assetType: true,
                          notes: true,
                          generatedVariants: { orderBy: { createdAt: "desc" }, select: { id: true }, take: 1 },
                        },
                      },
                    },
                  },
                },
              },
            },
      },
    },
  });

  const workspace = membership?.client ?? null;

  if (!workspace) {
    return (
      <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.16),transparent_38%)]" />
        <div className="relative mx-auto max-w-[1080px]">
          <header className="flex items-center justify-between rounded-[24px] border border-white/80 bg-white/75 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur-xl sm:px-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-xs font-extrabold lowercase text-white">cc.</div>
              <div><p className="text-sm font-semibold text-slate-950">Adaptive Presence</p><p className="text-[11px] text-slate-400">{email}</p></div>
            </div>
            <form action={signOutSelfService}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">Выйти</button></form>
          </header>
          <section className="mx-auto grid min-h-[calc(100vh-120px)] max-w-2xl place-items-center py-12 text-center">
            <div>
              <span className="inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">Аккаунт готов</span>
              <h1 className="mt-5 font-heading text-5xl font-semibold tracking-[-0.045em] text-slate-950">Теперь создадим ваш бренд.</h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">Вы вошли безопасно. Осталось заполнить короткий бриф — после него появится личный кабинет и первый месяц.</p>
              <a href="/start" className="mt-7 inline-flex rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700">Начать настройку</a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const latestPlan = workspace.monthlyPlans[0] ?? null;
  if (!latestPlan) {
    redirect(hasSelfServicePaidAccess(workspace.subscription) ? "/app/month" : "/app/preview");
  }
  const items = latestPlan?.plannedContentItems ?? [];
  const articleCovers = items.length
    ? await prisma.article.findMany({
        where: { plannedContentItemId: { in: items.map((item) => item.id) }, status: { not: "archived" } },
        select: { plannedContentItemId: true, images: true },
      })
    : [];
  const articleCoverByItemId = new Map(
    articleCovers.flatMap((article) => {
      const cover = articleHeroUrl(article.images);
      return article.plannedContentItemId && cover ? [[article.plannedContentItemId, cover] as const] : [];
    }),
  );
  const readyItems = items.filter((item) => item.contentDraft && overviewVisual(item, articleCoverByItemId.get(item.id))).length;
  const nextItem = items.find((item) => item.plannedDate >= new Date().toISOString().slice(0, 10)) ?? items[0] ?? null;
  const nextVisual = nextItem ? overviewVisual(nextItem, articleCoverByItemId.get(nextItem.id)) : null;
  const nextPlatform = platformBrandFromName(nextItem?.platformName);
  const readinessPercent = items.length ? Math.round((readyItems / items.length) * 100) : 0;
  const platformCounts = new Map<string, number>();
  for (const item of items) {
    const label = overviewPlatformLabel(item.platformName);
    platformCounts.set(label, (platformCounts.get(label) ?? 0) + 1);
  }
  const publicationRhythm = Array.from({ length: 7 }, () => 0);
  for (const item of items) {
    const date = new Date(`${item.plannedDate}T12:00:00`);
    if (!Number.isNaN(date.getTime())) publicationRhythm[(date.getDay() + 6) % 7] += 1;
  }
  const maxRhythm = Math.max(...publicationRhythm, 1);

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="overview"
      eyebrow="Обзор"
      title={latestPlan ? "Ваш контент-месяц работает." : "Соберём первый контент-месяц."}
      description={latestPlan ? "В одном экране — готовность материалов, следующая публикация и состояние подключённых площадок." : "Бренд уже сохранён. Осталось подключить площадки и запустить первую подготовку."}
      headerAction={<Link href="/app/month" className="rounded-2xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(112,78,255,.24)] transition hover:bg-violet-400">{latestPlan ? "Открыть месяц" : "Собрать месяц"}</Link>}
    >
      <section className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(140deg,rgba(124,92,255,.13),rgba(255,255,255,.025)_50%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,.18)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">{latestPlan.month} · контент готовится</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">{readyItems} из {items.length} материалов готовы</h2><p className="mt-2 max-w-xl text-xs leading-5 text-white/42">Посты, статьи и визуалы собраны в одном календаре. Открывайте материал, когда хотите проверить или изменить его.</p></div>
          <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200">{readinessPercent}% месяца</span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#7454ff,#a98fff)]" style={{ width: `${readinessPercent}%` }} /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[["Материалов", String(items.length), "план месяца"], ["Полностью готово", String(readyItems), `${readinessPercent}%`], ["Площадок", String(platformCounts.size), "в одном плане"]].map(([label, value, detail]) => <article key={label} className="rounded-[20px] border border-white/[0.07] bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/30">{label}</p><div className="mt-3 flex items-end justify-between gap-3"><p className="text-2xl font-semibold tracking-[-0.04em]">{value}</p><span className="text-[10px] font-semibold text-violet-300">{detail}</span></div></article>)}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <article className={`${darkCardClass} overflow-hidden`}>
          <div className="grid min-h-full sm:grid-cols-[minmax(0,1fr)_190px]">
            <div className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">Следующая публикация</p><div className="mt-2 flex items-center gap-2">{nextPlatform ? <PlatformBrandIcon platform={nextPlatform} size="xs" /> : null}<p className="text-[10px] text-white/30">{nextItem ? `${nextItem.plannedDate} · ${nextItem.platformName}` : "появится после подготовки месяца"}</p></div></div>{nextItem ? <span className="rounded-full bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200">{nextItem.contentDraft && nextVisual ? "готово" : "готовится"}</span> : null}</div><div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/15 p-4"><p className="text-sm font-medium leading-6 text-white/78">{nextItem?.topic ?? "Система сама предложит темы, распределит их по датам и подготовит материалы."}</p></div>{nextItem ? <Link href={`/app/month/${nextItem.id}`} className="mt-4 inline-flex text-xs font-semibold text-violet-300 transition hover:text-violet-200">Открыть материал →</Link> : null}</div>
            <div className="relative min-h-48 border-t border-white/[0.06] bg-black/20 sm:min-h-full sm:border-l sm:border-t-0">{nextVisual ? <><img src={nextVisual.src} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />{nextVisual.slideCount > 0 ? <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-semibold text-white/75 backdrop-blur">Карусель · {nextVisual.slideCount}</span> : null}</> : <div className="grid h-full min-h-48 place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(124,92,255,.18),transparent_60%)] text-center"><div><span className="text-2xl text-violet-300/45">◇</span><p className="mt-2 text-[10px] text-white/25">визуал готовится</p></div></div>}</div>
          </div>
        </article>
        <article className={`${darkCardClass} p-5 sm:p-6`}>
          <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Ритм публикаций</p><p className="mt-1 text-[10px] text-white/30">Как материалы распределены по неделе</p></div><Link href="/app/month#calendar" className="text-[10px] font-semibold text-violet-300">Календарь</Link></div>
          <div className="mt-6 flex h-28 items-end gap-2">{publicationRhythm.map((count, index) => <div key={index} className="flex h-full flex-1 flex-col justify-end gap-2"><span className="w-full rounded-t-md bg-[linear-gradient(180deg,#9d83ff,#6847d8)]" style={{ height: `${count ? Math.max(22, Math.round((count / maxRhythm) * 100)) : 7}%`, opacity: count ? 1 : .22 }} /><span className="text-center text-[8px] text-white/22">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][index]}</span></div>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-black/20 p-3"><p className="text-lg font-semibold">{platformCounts.size}</p><p className="mt-1 text-[9px] text-white/28">площадок в плане</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-lg font-semibold">{items.length - readyItems}</p><p className="mt-1 text-[9px] text-white/28">ещё готовятся</p></div></div>
        </article>
      </section>

      <section className="mt-4 grid gap-3 rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4 sm:grid-cols-5">
        {(["Telegram", "VK", "Одноклассники", "Дзен", "VC.ru"] as PlatformBrand[]).map((platform) => <Link key={platform} href={platform === "Дзен" || platform === "VC.ru" ? "/app/articles" : "/app/month#materials"} className="flex items-center gap-2.5 rounded-2xl bg-black/15 p-3 transition hover:bg-white/[0.04]"><PlatformBrandIcon platform={platform} size="xs" /><div><p className="text-[10px] font-semibold text-white/65">{platform}</p><p className="mt-0.5 text-[8px] text-white/28">{platformCounts.get(platform) ?? 0} материалов</p></div></Link>)}
      </section>
    </SelfServiceAppShell>
  );
}
