import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startSelfServiceMonth } from "@/app/actions";
import {
  SelfServiceMonthStarter,
  SelfServiceProductionRunner,
} from "@/app/(self-service)/app/month/self-service-month-progress";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasSelfServicePaidAccess } from "@/lib/self-service/subscription";
import { SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { PlatformBrandIcon, platformBrandFromName } from "@/app/(self-service)/platform-brand-icon";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { articleHeroUrl } from "@/lib/article-engine";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Контент месяца · Adaptive Presence",
  robots: { index: false, follow: false },
};

function formatMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;

  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, 1),
  );
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(parsed);
}

function platformLabel(value: string) {
  if (/telegram|телег/i.test(value)) return "Telegram";
  if (/(^|\s)(vk|вк)(\s|$)|vkontakte|вконтакте/i.test(value)) return "VK";
  if (/vc\.ru|виси/i.test(value)) return "VC.ru";
  if (/дзен|dzen/i.test(value)) return "Дзен";
  return value;
}

function materialState(item: { contentDraft: { id: string } | null }, visualReady: boolean) {
  if (item.contentDraft && visualReady) return "Готов";
  if (item.contentDraft) return "Текст готов";
  return "Готовится";
}

type CalendarItem = {
  id: string;
  plannedDate: string;
  platformName: string;
  topic: string;
  goal: string;
  thumbnailVariantId: string | null;
  thumbnailUrl: string | null;
  slideCount: number;
};

function activeVisualInfo(item: {
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
  const firstVariant = activeAssets.flatMap((asset) => asset.generatedVariants)[0]
    ?? (slides.length === 0 ? item.generatedCreativeVariants[0] : null)
    ?? null;

  return {
    thumbnailVariantId: firstVariant?.id ?? null,
    slideCount: slides.length,
  };
}

function materialThumbnailUrl(item: Pick<CalendarItem, "id" | "thumbnailVariantId" | "thumbnailUrl">) {
  return item.thumbnailUrl ?? (item.thumbnailVariantId
    ? `/api/self-service/materials/${item.id}/visuals?variant=${item.thumbnailVariantId}&inline=1`
    : null);
}

function MonthCalendar({ month, items }: { month: string; items: CalendarItem[] }) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayFirstOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: mondayFirstOffset + daysInMonth }, (_, index) => {
    const day = index - mondayFirstOffset + 1;
    return day > 0 ? day : null;
  });
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<number, CalendarItem[]>();
  for (const item of items) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.plannedDate);
    if (!match || Number(match[1]) !== year || Number(match[2]) !== monthIndex + 1) continue;
    const day = Number(match[3]);
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }

  return (
    <section id="calendar" className="mt-5 rounded-[24px] border border-white/[0.07] bg-white/[0.03] p-4 shadow-[0_24px_80px_rgba(0,0,0,.16)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-base font-semibold text-white">Календарь публикаций</h2><p className="mt-1 text-xs text-white/30">Обложки показывают, что и когда выйдет. Нажмите, чтобы открыть материал.</p></div>
        <span className="rounded-full border border-violet-400/15 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-200">{items.length} материалов</span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 sm:gap-2">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <div key={day} className="pb-1 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-white/22 sm:text-[10px]">{day}</div>)}
        {cells.map((day, index) => {
          const dayItems = day ? byDay.get(day) ?? [] : [];
          const primaryItem = dayItems[0] ?? null;
          const thumbnail = primaryItem ? materialThumbnailUrl(primaryItem) : null;
          const primaryPlatform = primaryItem ? platformBrandFromName(primaryItem.platformName) : null;
          return (
            <div key={`${day ?? "blank"}-${index}`} className={`relative min-h-[72px] min-w-0 overflow-hidden rounded-xl border sm:min-h-[128px] sm:rounded-2xl ${day ? "border-white/[0.055] bg-black/15" : "border-transparent bg-transparent"}`}>
              {day ? <span className={`absolute left-1.5 top-1.5 z-10 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px] font-semibold backdrop-blur-md sm:left-2 sm:top-2 ${dayItems.length ? "bg-violet-500 text-white" : "bg-black/45 text-white/45"}`}>{day}</span> : null}
              {primaryItem ? (
                <Link href={`/app/month/${primaryItem.id}`} title={primaryItem.topic} className="group absolute inset-0 block">
                  {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-90" /> : <div className="h-full w-full bg-[radial-gradient(circle_at_50%_20%,rgba(124,92,255,.18),transparent_55%),linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.01))]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2.5">
                    <div className="flex items-center gap-1.5">{primaryPlatform ? <PlatformBrandIcon platform={primaryPlatform} size="xs" className="hidden sm:block" /> : null}<span className="rounded-md bg-black/45 px-1.5 py-0.5 text-[7px] font-bold text-white/85 backdrop-blur sm:text-[8px]">{platformLabel(primaryItem.platformName)}</span>{primaryItem.slideCount > 0 ? <span className="hidden text-[8px] text-white/55 lg:inline">Карусель · {primaryItem.slideCount}</span> : null}</div>
                    <p className="mt-1 hidden line-clamp-2 text-[9px] font-medium leading-3 text-white/75 sm:block xl:text-[10px]">{primaryItem.topic}</p>
                  </div>
                </Link>
              ) : null}
              {dayItems.length > 1 ? <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/65 px-1.5 py-0.5 text-[8px] font-bold text-white/70 backdrop-blur sm:right-2 sm:top-2">+{dayItems.length - 1}</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function SelfServiceMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ autostart?: string; notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/month");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    include: {
      client: {
        include: {
          subscription: true,
          contentOrders: {
            where: { status: { in: ["confirmed", "processing"] } },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { id: true },
          },
          monthlyPlans: {
            where: { status: { notIn: ["archived", "replaced"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              productionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
              plannedContentItems: {
                orderBy: { plannedDate: "asc" },
                include: {
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

  if (!membership) redirect("/start");

  const workspace = membership.client;
  const plan = workspace.monthlyPlans[0] ?? null;
  if (!plan && !hasSelfServicePaidAccess(workspace.subscription) && !workspace.contentOrders[0]) redirect("/app/plan-builder");
  const productionRun = plan?.productionRuns[0] ?? null;
  const rawItems = plan?.plannedContentItems ?? [];
  const articleCovers = rawItems.length
    ? await prisma.article.findMany({
        where: { plannedContentItemId: { in: rawItems.map((item) => item.id) }, status: { not: "archived" } },
        select: { plannedContentItemId: true, images: true },
      })
    : [];
  const articleCoverByItemId = new Map(
    articleCovers.flatMap((article) => {
      const cover = articleHeroUrl(article.images);
      return article.plannedContentItemId && cover ? [[article.plannedContentItemId, cover] as const] : [];
    }),
  );
  const items: CalendarItem[] = rawItems.map((item) => ({
    ...item,
    ...activeVisualInfo(item),
    thumbnailUrl: articleCoverByItemId.get(item.id) ?? null,
  }));
  const readyTexts = rawItems.filter((item) => item.contentDraft).length;
  const readyVisuals = items.filter((item) => item.thumbnailUrl || item.thumbnailVariantId).length;
  const readinessPercent = items.length
    ? Math.round(((readyTexts + readyVisuals) / (items.length * 2)) * 100)
    : 0;

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="calendar"
      eyebrow="Календарь"
      title={plan ? formatMonth(plan.month) : "Соберём первый контент-месяц."}
      description={plan ? "Материалы распределены по датам. Открывайте готовые тексты, проверяйте визуалы и двигайтесь по календарю." : "Здесь появятся темы, тексты и визуалы для VK, Telegram, Дзена и VC.ru."}
      headerAction={plan ? <a href="#materials" className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07]">Все материалы · {items.length}</a> : null}
    >
      <div className="ap-dark-surface">
        {!plan ? (
          <section className="mx-auto grid max-w-2xl place-items-center py-12 text-center">
            <div>
              <span className="inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">Бренд сохранён</span>
              <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-slate-400">Система сама подготовит темы, тексты и визуалы. Повторный запуск не создаёт уже готовые материалы заново.</p>
              {query.notice === "channels_saved" ? <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-900">Площадки сохранены. Теперь можно собрать первый месяц — публикации сразу появятся в календаре.</p> : null}
              {query.notice === "order_confirmed" ? <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-900">Набор подтверждён, кредиты списаны. Собираем темы, даты и материалы автоматически.</p> : null}
              {query.error === "blueprint_failed" ? <p className="mx-auto mt-5 max-w-xl rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Не удалось подготовить профиль с первого раза. Бриф сохранён — можно повторить безопасно.</p> : null}
              {query.autostart === "1" ? (
                <SelfServiceMonthStarter active />
              ) : (
                <form action={startSelfServiceMonth} className="mt-7">
                  <button className="inline-flex rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(124,58,237,0.22)] transition hover:bg-violet-700">Собрать первый месяц</button>
                </form>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["План месяца", String(items.length), 100],
                ["Тексты готовы", String(readyTexts), items.length ? Math.round((readyTexts / items.length) * 100) : 0],
                ["Визуалы готовы", String(readyVisuals), items.length ? Math.round((readyVisuals / items.length) * 100) : 0],
                ["Готовность месяца", `${readinessPercent}%`, readinessPercent],
              ].map(([label, value, percent]) => <article key={label} className="rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-5 shadow-[0_24px_70px_rgba(0,0,0,.14)]"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/30">{label}</p><p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</p><div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${percent}%` }} /></div></article>)}
            </section>

            {productionRun ? (
              <div className="mt-5">
                <SelfServiceProductionRunner
                  productionRunId={productionRun.id}
                  enabled={!['paused', 'completed', 'completed_with_errors'].includes(productionRun.status)}
                  currentStage={productionRun.currentStage}
                  completedTasks={productionRun.completedTasks}
                  totalTasks={productionRun.totalTasks}
                />
              </div>
            ) : null}

            {query.notice === "channels_saved" ? (
              <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-900">Площадки сохранены. Теперь собирайте месяц — материалы сразу лягут в календарь.</div>
            ) : null}

            <MonthCalendar month={plan.month} items={items} />

            <section id="materials" className="mt-5 scroll-mt-24 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,.18)]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-6"><div><h2 className="text-base font-semibold text-white">Материалы месяца</h2><p className="mt-1 text-[10px] text-white/35">Откройте текст, визуал или карусель</p></div><Link href="/app/quick-post" className="rounded-xl bg-violet-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-violet-400">+ Быстрый пост</Link></div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item, index) => {
                  const sourceItem = rawItems.find((candidate) => candidate.id === item.id)!;
                  const state = materialState(sourceItem, Boolean(item.thumbnailUrl || item.thumbnailVariantId));
                  const thumbnail = materialThumbnailUrl(item);
                  const platform = platformBrandFromName(item.platformName);
                  return (
                    <Link href={`/app/month/${item.id}`} key={item.id} className="group overflow-hidden rounded-[20px] border border-white/[0.06] bg-black/15 transition hover:-translate-y-0.5 hover:border-violet-400/20 hover:bg-white/[0.04]">
                      <div className="relative aspect-[16/8] overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(124,92,255,.18),transparent_60%)]">{thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-95" /> : <span className="grid h-full place-items-center text-2xl text-violet-300/45">◇</span>}<div className="absolute inset-0 bg-gradient-to-t from-[#0d0c12] via-transparent to-transparent" /><span className="absolute left-3 top-3">{platform ? <PlatformBrandIcon platform={platform} size="xs" /> : null}</span><span className="absolute bottom-2.5 right-3 text-[9px] font-semibold text-white/75">{formatDate(item.plannedDate)}</span>{item.slideCount > 0 ? <span className="absolute bottom-2.5 left-3 rounded-full bg-black/65 px-2 py-1 text-[8px] font-semibold text-white/75 backdrop-blur">Карусель · {item.slideCount}</span> : null}</div>
                      <div className="p-4"><div className="flex items-center justify-between gap-2"><span className="text-[9px] text-white/30">{platformLabel(item.platformName)} · #{String(index + 1).padStart(2, "0")}</span><span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${state === "Готов" ? "bg-violet-500/12 text-violet-200" : "bg-white/[0.06] text-white/40"}`}>{state}</span></div><h3 className="mt-3 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-white/82">{item.topic}</h3><p className="mt-3 line-clamp-1 border-t border-white/[0.05] pt-3 text-[9px] text-white/28">{item.goal}</p></div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </SelfServiceAppShell>
  );
}
