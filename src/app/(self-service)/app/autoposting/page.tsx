import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextPublicationCountdown } from "@/app/(self-service)/app/autoposting/next-publication-countdown";
import { SelfServiceAppShell, darkCardClass } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Автопостинг · Adaptive Presence",
  robots: { index: false, follow: false },
};

function platformLabel(value: string) {
  if (/telegram|телег/i.test(value)) return "Telegram";
  if (/^(vk|vkontakte)$/i.test(value)) return "VK";
  if (/dzen|дзен/i.test(value)) return "Дзен";
  if (/vcru|vc\.ru/i.test(value)) return "VC.ru";
  return value;
}

function moscowDateKey() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatDate(value: string, includeYear = false) {
  const parsed = new Date(`${value}T12:00:00+03:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(parsed);
}

function publicationState(publication: { publishStatus: string | null; status: string }) {
  if (publication.publishStatus === "published") return { label: "Опубликовано", tone: "text-violet-200 bg-violet-500/10" };
  if (publication.publishStatus === "publishing") return { label: "Публикуется", tone: "text-violet-200 bg-violet-500/10" };
  if (publication.publishStatus === "failed") return { label: "Нужен повтор", tone: "text-rose-200 bg-rose-500/10" };
  if (publication.status === "ready") return { label: "В очереди", tone: "text-violet-200 bg-violet-500/10" };
  return { label: "Ждёт подтверждения", tone: "text-white/35 bg-white/[0.045]" };
}

function firstVisualVariantId(publication: {
  plannedContentItem: {
    creativeAssets: Array<{
      assetType: string;
      notes: string | null;
      generatedVariants: Array<{ id: string }>;
    }>;
  };
}) {
  const assets = publication.plannedContentItem.creativeAssets;
  const slides = assets.filter((asset) => asset.assetType === "carousel_slide");
  const activeAssets = slides.length
    ? slides
    : assets.filter((asset) => !asset.notes?.includes("legacyCombinedCarouselAsset=true"));
  return activeAssets.flatMap((asset) => asset.generatedVariants)[0]?.id ?? null;
}

const publicationVisualSelect = {
  plannedContentItem: {
    select: {
      creativeAssets: {
        orderBy: { createdAt: "asc" as const },
        select: {
          assetType: true,
          notes: true,
          generatedVariants: {
            orderBy: { createdAt: "desc" as const },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  },
};

export default async function SelfServiceAutopostingPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/autoposting");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    include: { client: { include: { channels: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!membership) redirect("/start");

  const workspace = membership.client;
  const today = moscowDateKey();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [upcoming, history, publishedThisMonth] = await Promise.all([
    prisma.scheduledPublication.findMany({
      where: {
        clientId: workspace.id,
        scheduledDate: { gte: today },
        OR: [{ publishStatus: null }, { publishStatus: { not: "published" } }],
      },
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
      take: 8,
      select: {
        id: true,
        plannedContentItemId: true,
        scheduledDate: true,
        scheduledTime: true,
        platformName: true,
        topic: true,
        status: true,
        publishStatus: true,
        publishErrorMessage: true,
        ...publicationVisualSelect,
      },
    }),
    prisma.scheduledPublication.findMany({
      where: {
        clientId: workspace.id,
        OR: [{ publishStatus: "published" }, { publishStatus: "failed" }],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        plannedContentItemId: true,
        scheduledDate: true,
        scheduledTime: true,
        platformName: true,
        topic: true,
        status: true,
        publishStatus: true,
        publishErrorMessage: true,
        externalUrl: true,
        results: { orderBy: { publishedAt: "desc" }, select: { externalUrl: true }, take: 1 },
        ...publicationVisualSelect,
      },
    }),
    prisma.scheduledPublication.count({
      where: { clientId: workspace.id, publishStatus: "published", publishedAt: { gte: monthStart } },
    }),
  ]);

  const activeChannels = workspace.channels.filter(
    (channel) => channel.status === "active" && ["telegram", "vk"].includes(channel.platform.toLowerCase()),
  );
  const automaticChannels = activeChannels.filter((channel) => channel.autopublishEnabled);
  const nextPublication = upcoming.find(
    (publication) => publication.status === "ready" && publication.publishStatus !== "failed",
  ) ?? null;

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="autoposting"
      eyebrow="Автопостинг"
      title="Публикации выходят сами."
      description="Вы подтверждаете материал и выбираете время. Дальше система публикует его в подключённом канале и сохраняет результат."
      headerAction={<Link href="/app/channels" className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07]">Площадки</Link>}
    >
      <section className="grid gap-4 lg:grid-cols-[1.55fr_.8fr]">
        <article className="relative min-h-[250px] overflow-hidden rounded-[28px] border border-violet-400/15 bg-[radial-gradient(circle_at_20%_10%,rgba(124,92,255,.25),transparent_42%),rgba(255,255,255,.03)] p-6 shadow-[0_28px_90px_rgba(0,0,0,.24)] sm:p-8">
          {nextPublication ? (
            <>
              <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-violet-300/15 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200">Следующая публикация</span>
                  <span className="text-[10px] text-white/30">Москва</span>
                </div>
                <div>
                  <NextPublicationCountdown scheduledDate={nextPublication.scheduledDate} scheduledTime={nextPublication.scheduledTime || "11:00"} initialNow={Date.now()} />
                  <p className="mt-3 max-w-xl text-lg font-semibold leading-7 text-white/85 sm:text-xl">{nextPublication.topic}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-white/55">{platformLabel(nextPublication.platformName)}</span>
                    <span className="text-white/30">{formatDate(nextPublication.scheduledDate)} · {nextPublication.scheduledTime || "11:00"}</span>
                    <Link href={`/app/month/${nextPublication.plannedContentItemId}`} className="ml-auto font-semibold text-violet-200 transition hover:text-white">Открыть материал →</Link>
                  </div>
                </div>
              </div>
              {firstVisualVariantId(nextPublication) ? <img src={`/api/self-service/materials/${nextPublication.plannedContentItemId}/visuals?variant=${firstVisualVariantId(nextPublication)}&inline=1`} alt="" className="absolute inset-y-0 right-0 h-full w-[44%] object-cover opacity-20 [mask-image:linear-gradient(to_left,black,transparent)]" /> : null}
            </>
          ) : (
            <div className="flex min-h-[200px] flex-col justify-between">
              <span className="w-fit rounded-full bg-white/[0.05] px-3 py-1.5 text-[10px] font-semibold text-white/35">Расписание свободно</span>
              <div><h2 className="text-2xl font-semibold tracking-[-0.035em] text-white/85">Следующей публикации пока нет.</h2><p className="mt-3 max-w-lg text-xs leading-5 text-white/35">Выберите время в материале и подтвердите его — всё остальное система сделает автоматически.</p><Link href="/app/month" className="mt-5 inline-flex text-xs font-semibold text-violet-200">Открыть календарь →</Link></div>
            </div>
          )}
        </article>

        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            ["Автопостинг", automaticChannels.length ? "Включён" : "Выключен", automaticChannels.length ? `подключено площадок: ${automaticChannels.length}` : "подключите площадку"],
            ["В очереди", String(upcoming.filter((item) => item.status === "ready").length), "подтверждённых материалов"],
            ["Опубликовано", String(publishedThisMonth), "за текущий месяц"],
          ].map(([label, value, detail]) => <article key={label} className={`${darkCardClass} flex min-h-[76px] items-center justify-between gap-4 p-5`}><div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-white/25">{label}</p><p className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white/82">{value}</p></div><span className="max-w-[110px] text-right text-[9px] leading-4 text-white/25">{detail}</span></article>)}
        </section>
      </section>

      <section className={`${darkCardClass} mt-4 overflow-hidden`}>
        <div className="flex items-end justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div><h2 className="text-sm font-semibold">Очередь</h2><p className="mt-1 text-[10px] text-white/30">Только ближайшие материалы — без сложных технических статусов.</p></div>
          <Link href="/app/month" className="text-[10px] font-semibold text-violet-200">Календарь →</Link>
        </div>
        {upcoming.length ? <div className="divide-y divide-white/[0.05]">{upcoming.map((publication) => {
          const state = publicationState(publication);
          const variantId = firstVisualVariantId(publication);
          return <article key={publication.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[44px_120px_80px_minmax(0,1fr)_auto] sm:items-center sm:px-6">
            <div className="h-11 w-11 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.035]">{variantId ? <img src={`/api/self-service/materials/${publication.plannedContentItemId}/visuals?variant=${variantId}&inline=1`} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-white/20">AP</div>}</div>
            <span className="text-xs text-white/55">{formatDate(publication.scheduledDate)}<span className="ml-1 text-white/25">{publication.scheduledTime || "11:00"}</span></span>
            <span className="w-fit rounded-full bg-white/[0.045] px-2.5 py-1 text-[9px] font-semibold text-white/42">{platformLabel(publication.platformName)}</span>
            <div className="min-w-0"><Link href={`/app/month/${publication.plannedContentItemId}`} className="line-clamp-1 text-xs text-white/72 transition hover:text-white">{publication.topic}</Link>{publication.publishStatus === "failed" && publication.publishErrorMessage ? <p className="mt-1 line-clamp-1 text-[9px] text-rose-300/65">{publication.publishErrorMessage}</p> : null}</div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-[9px] font-semibold ${state.tone}`}>{state.label}</span>
          </article>;
        })}</div> : <div className="px-5 py-10 text-center"><p className="text-sm font-medium text-white/65">Очередь пока пустая</p><p className="mt-2 text-xs text-white/28">Подтверждённые материалы появятся здесь автоматически.</p></div>}
      </section>

      <section className={`${darkCardClass} mt-4 overflow-hidden`}>
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold">История</h2><p className="mt-1 text-[10px] text-white/30">Что уже опубликовано и где требуется внимание.</p></div>
        {history.length ? <div className="divide-y divide-white/[0.05]">{history.map((publication) => {
          const state = publicationState(publication);
          const resultUrl = publication.results[0]?.externalUrl || publication.externalUrl;
          return <article key={publication.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap sm:px-6"><span className="w-20 shrink-0 text-[10px] text-white/30">{formatDate(publication.scheduledDate, true)}</span><span className="w-16 shrink-0 text-[9px] font-semibold text-white/40">{platformLabel(publication.platformName)}</span><Link href={`/app/month/${publication.plannedContentItemId}`} className="min-w-0 flex-1 truncate text-xs text-white/62 transition hover:text-white">{publication.topic}</Link><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${state.tone}`}>{state.label}</span>{resultUrl ? <a href={resultUrl} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-violet-200">Открыть пост ↗</a> : null}</article>;
        })}</div> : <div className="px-5 py-9 text-center text-xs text-white/28">После первой автоматической публикации здесь появится история.</div>}
      </section>
    </SelfServiceAppShell>
  );
}
