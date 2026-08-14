import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signOutSelfService } from "@/lib/self-service/auth-actions";
import { hasSelfServicePaidAccess } from "@/lib/self-service/subscription";
import { darkCardClass, SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";

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
}) {
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

export default async function SelfServiceHomePage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) redirect("/sign-in?callbackUrl=/app");

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
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
      },
    },
  });

  const workspace = user?.memberships[0]?.client ?? null;

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
  const readyItems = items.filter((item) => item.contentDraft && overviewVisual(item)).length;
  const nextItem = items.find((item) => item.plannedDate >= new Date().toISOString().slice(0, 10)) ?? items[0] ?? null;
  const nextVisual = nextItem ? overviewVisual(nextItem) : null;

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="overview"
      eyebrow="Обзор"
      title={latestPlan ? "Ваш контент-месяц работает." : "Соберём первый контент-месяц."}
      description={latestPlan ? "В одном экране — готовность материалов, следующая публикация и состояние подключённых площадок." : "Бренд уже сохранён. Осталось подключить площадки и запустить первую подготовку."}
      headerAction={<Link href="/app/month" className="rounded-2xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(112,78,255,.24)] transition hover:bg-violet-400">{latestPlan ? "Открыть месяц" : "Собрать месяц"}</Link>}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Материалов", String(items.length), latestPlan ? "план месяца" : "ещё не собран"],
          ["Полностью готово", String(readyItems), items.length ? `${Math.round((readyItems / items.length) * 100)}% месяца` : "после запуска"],
          ["Площадки", String(workspace.channels.length), workspace.channels.length ? "подключены" : "нужна настройка"],
        ].map(([label, value, detail]) => (
          <article key={label} className={`${darkCardClass} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/28">{label}</p><div className="mt-3 flex items-end justify-between gap-3"><p className="text-3xl font-semibold tracking-[-0.04em] text-white">{value}</p><span className="text-[10px] text-violet-300/75">{detail}</span></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-4/5 rounded-full bg-violet-500" /></div></article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <article className={`${darkCardClass} overflow-hidden`}>
          <div className="grid min-h-full sm:grid-cols-[minmax(0,1fr)_190px]">
            <div className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">Следующая публикация</p><p className="mt-1 text-[10px] text-white/30">{nextItem ? `${nextItem.plannedDate} · ${nextItem.platformName}` : "появится после подготовки месяца"}</p></div>{nextItem ? <span className="rounded-full bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200">{nextItem.contentDraft && nextVisual ? "готово" : "готовится"}</span> : null}</div><div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/15 p-4"><p className="text-sm font-medium leading-6 text-white/78">{nextItem?.topic ?? "Система сама предложит темы, распределит их по датам и подготовит материалы."}</p></div>{nextItem ? <Link href={`/app/month/${nextItem.id}`} className="mt-4 inline-flex text-xs font-semibold text-violet-300 transition hover:text-violet-200">Открыть материал →</Link> : null}</div>
            <div className="relative min-h-48 border-t border-white/[0.06] bg-black/20 sm:min-h-full sm:border-l sm:border-t-0">{nextVisual ? <><img src={nextVisual.src} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />{nextVisual.slideCount > 0 ? <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-semibold text-white/75 backdrop-blur">Карусель · {nextVisual.slideCount}</span> : null}</> : <div className="grid h-full min-h-48 place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(124,92,255,.18),transparent_60%)] text-center"><div><span className="text-2xl text-violet-300/45">◇</span><p className="mt-2 text-[10px] text-white/25">визуал готовится</p></div></div>}</div>
          </div>
        </article>
        <article className={`${darkCardClass} p-5 sm:p-6`}><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Площадки</p><p className="mt-1 text-[10px] text-white/30">Где система сможет публиковать</p></div><Link href="/app/channels" className="text-[10px] font-semibold text-violet-300">Настроить</Link></div><div className="mt-5 space-y-3">{["Telegram", "VK", "Дзен", "VC.ru"].map((platform) => { const connected = workspace.channels.some((channel) => channel.platform.toLowerCase().includes(platform === "Дзен" ? "dzen" : platform === "VC.ru" ? "vcru" : platform.toLowerCase())); return <div key={platform} className="flex items-center justify-between border-b border-white/[0.04] pb-3 text-xs last:border-0 last:pb-0"><span className="text-white/58">{platform}</span><span className={connected ? "text-emerald-300/80" : "text-white/22"}>{connected ? "подключено" : "не подключено"}</span></div>; })}</div></article>
      </section>
    </SelfServiceAppShell>
  );
}
