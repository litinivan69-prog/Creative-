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
import { signOutSelfService } from "@/lib/self-service/auth-actions";

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

function materialState(item: { contentDraft: { id: string } | null; generatedCreativeVariants: Array<{ id: string }> }) {
  if (item.contentDraft && item.generatedCreativeVariants.length > 0) return "Готов";
  if (item.contentDraft) return "Текст готов";
  return "Готовится";
}

type CalendarItem = {
  id: string;
  plannedDate: string;
  platformName: string;
  topic: string;
};

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
    <section id="calendar" className="mt-5 rounded-[28px] border border-white bg-white p-4 shadow-[0_22px_70px_rgba(77,61,112,0.07)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-base font-semibold text-slate-950">Календарь публикаций</h2><p className="mt-1 text-xs text-slate-400">Нажмите на материал в нужный день, чтобы открыть текст и визуал.</p></div>
        <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700">{items.length} материалов</span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <div key={day} className="pb-1 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{day}</div>)}
        {cells.map((day, index) => {
          const dayItems = day ? byDay.get(day) ?? [] : [];
          return (
            <div key={`${day ?? "blank"}-${index}`} className={`min-h-16 min-w-0 rounded-2xl border p-1.5 sm:min-h-24 sm:p-2.5 ${day ? "border-slate-100 bg-slate-50/55" : "border-transparent bg-transparent"}`}>
              {day ? <p className={`text-[11px] font-semibold ${dayItems.length ? "text-violet-700" : "text-slate-400"}`}>{day}</p> : null}
              <div className="mt-1 grid min-w-0 gap-1">
                {dayItems.slice(0, 2).map((item) => (
                  <Link key={item.id} href={`/app/month/${item.id}`} title={item.topic} className="min-w-0 rounded-lg bg-white px-1.5 py-1 text-[9px] font-semibold leading-3 text-slate-600 shadow-sm transition hover:bg-violet-50 hover:text-violet-700 sm:px-2 sm:text-[10px]">
                    <span className="block truncate">{platformLabel(item.platformName)}</span>
                    <span className="hidden truncate font-normal text-slate-400 xl:block">{item.topic}</span>
                  </Link>
                ))}
                {dayItems.length > 2 ? <span className="px-1 text-[9px] font-semibold text-violet-600">+{dayItems.length - 2}</span> : null}
              </div>
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
    where: { user: { email } },
    include: {
      client: {
        include: {
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
  const productionRun = plan?.productionRuns[0] ?? null;
  const items = plan?.plannedContentItems ?? [];
  const readyTexts = items.filter((item) => item.contentDraft).length;
  const readyVisuals = items.filter((item) => item.generatedCreativeVariants.length > 0).length;
  const visualUsage = plan
    ? await prisma.generatedCreativeVariant.aggregate({
        where: { monthlyPlanId: plan.id },
        _sum: { estimatedCostUsd: true },
      })
    : null;
  const visualCostUsd = visualUsage?._sum.estimatedCostUsd ?? 0;
  const configuredBudget = Number(process.env.SELF_SERVICE_MONTH_VISUAL_BUDGET_USD ?? "3");
  const visualBudgetUsd = Number.isFinite(configuredBudget) && configuredBudget > 0 ? configuredBudget : 3;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(circle_at_28%_0%,rgba(139,92,246,0.15),transparent_54%)]" />
      <div className="relative mx-auto max-w-[1180px]">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-xs font-extrabold lowercase text-white">cc.</div>
            <div><p className="text-sm font-semibold text-slate-950">{workspace.name}</p><p className="text-[11px] text-slate-400">Adaptive Presence</p></div>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 p-1 text-xs font-semibold text-slate-500">
            <Link href="/app" className="rounded-full px-3.5 py-2 transition hover:text-slate-900">Главная</Link>
            <Link href="/app/month#calendar" className="rounded-full bg-violet-50 px-3.5 py-2 text-violet-700">Календарь</Link>
            <Link href="/app/channels" className="rounded-full px-3.5 py-2 transition hover:text-slate-900">Площадки</Link>
          </nav>
          <form action={signOutSelfService}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">Выйти</button></form>
        </header>

        {!plan ? (
          <section className="mx-auto grid min-h-[calc(100vh-120px)] max-w-2xl place-items-center py-12 text-center">
            <div>
              <span className="inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">Бренд сохранён</span>
              <h1 className="mt-5 font-heading text-5xl font-semibold tracking-[-0.05em] text-slate-950">Соберём первый контент-набор.</h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">Здесь появятся темы, тексты и визуалы для VK, Telegram, Дзена и VC.ru — без внутренних очередей и менеджерских статусов.</p>
              <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-slate-400">Перед генерацией действует защитный лимит визуалов до ${visualBudgetUsd.toFixed(2)} на месяц. Повторный запуск не создаёт уже готовые материалы заново.</p>
              {query.notice === "channels_saved" ? <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-900">Площадки сохранены. Теперь можно собрать первый месяц — публикации сразу появятся в календаре.</p> : null}
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
            <section className="pb-7 pt-10 sm:pt-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Контент месяца</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-heading text-4xl font-semibold capitalize tracking-[-0.045em] text-slate-950 sm:text-5xl">{formatMonth(plan.month)}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Ваш компактный набор материалов. Открывайте готовые тексты, проверяйте визуалы и двигайтесь по календарю.</p>
                </div>
                <span className="rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700">{items.length} материалов</span>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_55px_rgba(77,61,112,0.06)]"><p className="text-xs text-slate-400">План месяца</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{items.length}</p><div className="mt-4 h-1.5 rounded-full bg-slate-100"><div className="h-full w-full rounded-full bg-violet-500" /></div></article>
              <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_55px_rgba(77,61,112,0.06)]"><p className="text-xs text-slate-400">Тексты готовы</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{readyTexts}</p><div className="mt-4 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${items.length ? Math.round((readyTexts / items.length) * 100) : 0}%` }} /></div></article>
              <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_55px_rgba(77,61,112,0.06)]"><p className="text-xs text-slate-400">Визуалы готовы</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{readyVisuals}</p><div className="mt-4 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-400" style={{ width: `${items.length ? Math.round((readyVisuals / items.length) * 100) : 0}%` }} /></div></article>
              <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_55px_rgba(77,61,112,0.06)]"><p className="text-xs text-slate-400">Визуалы API</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">${visualCostUsd.toFixed(2)}</p><p className="mt-3 text-[11px] text-slate-400">лимит ${visualBudgetUsd.toFixed(2)} / месяц</p></article>
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

            <section className="mt-5 overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_22px_70px_rgba(77,61,112,0.07)]">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-7"><h2 className="text-base font-semibold text-slate-950">Материалы по порядку</h2><p className="mt-1 text-xs text-slate-400">Без производственных этапов — только дата, площадка и результат.</p></div>
              <div className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const state = materialState(item);
                  return (
                    <Link href={`/app/month/${item.id}`} key={item.id} className="grid gap-4 px-5 py-5 transition hover:bg-violet-50/35 sm:grid-cols-[70px_120px_minmax(0,1fr)_110px] sm:items-center sm:px-7">
                      <div><p className="text-sm font-semibold text-slate-950">{formatDate(item.plannedDate)}</p><p className="mt-0.5 text-[11px] text-slate-400">#{String(index + 1).padStart(2, "0")}</p></div>
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">{platformLabel(item.platformName)}</span>
                      <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-950 sm:whitespace-normal">{item.topic}</h3><p className="mt-1 line-clamp-1 text-xs text-slate-400">{item.goal}</p></div>
                      <span className={`w-fit rounded-full px-3 py-1.5 text-[11px] font-semibold ${state === "Готов" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500"}`}>{state}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
