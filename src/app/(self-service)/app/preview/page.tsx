import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasSelfServicePaidAccess } from "@/lib/self-service/subscription";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { darkCardClass, SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { PlatformBrandIcon, platformBrandFromFormatId } from "@/app/(self-service)/platform-brand-icon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ваш контент-план · Adaptive Presence",
  robots: { index: false, follow: false },
};

const formatLabels: Record<string, string> = {
  vk_post: "Посты VK",
  telegram_post: "Посты Telegram",
  dzen_article: "Статьи Дзен",
  vcru_article: "Статьи VC.ru",
  quick_announcement: "Короткие анонсы",
  review_reply: "Ответы на отзывы",
};

function briefValue(rawBrief: string, label: string) {
  return rawBrief
    .split("\n")
    .find((line) => line.startsWith(`${label}: `))
    ?.slice(label.length + 2)
    .trim() ?? "";
}

function shorten(value: string, length = 92) {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trim()}…`;
}

function previewTopics(rawBrief: string, brandName: string) {
  const offer = briefValue(rawBrief, "Приоритетный продукт или услуга");
  const audience = briefValue(rawBrief, "Целевая аудитория");
  const goal = briefValue(rawBrief, "Цель ближайшего месяца");
  const requiredTopics = briefValue(rawBrief, "Обязательные темы ближайшего месяца")
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return [
    requiredTopics[0] || `${brandName}: главное, что важно знать перед первым обращением`,
    requiredTopics[1] || (offer ? `Как выбрать ${shorten(offer, 58)} без лишнего риска` : "Как выбрать решение под свою задачу"),
    goal ? `Практический путь к цели: ${shorten(goal, 66)}` : "Разбор частой задачи клиента шаг за шагом",
    audience ? `Что особенно важно для: ${shorten(audience, 68)}` : "Что важно клиенту перед принятием решения",
    offer ? `Вопросы и ответы о продукте: ${shorten(offer, 62)}` : "Ответы на частые вопросы клиентов",
    `История и подход ${brandName}: почему мы делаем именно так`,
  ];
}

export default async function SelfServicePreviewPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/preview");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    include: {
      client: {
        include: {
          brandProfile: true,
          subscription: true,
          briefs: { orderBy: { createdAt: "desc" }, take: 1 },
          monthlyPlans: {
            where: { status: { notIn: ["archived", "replaced"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });

  if (!membership) redirect("/start");
  const workspace = membership.client;
  if (workspace.monthlyPlans[0]) redirect("/app/month");
  if (hasSelfServicePaidAccess(workspace.subscription)) redirect("/app/month");

  const brief = workspace.briefs[0];
  if (!brief) redirect("/start");

  const rawBrief = brief.rawBrief;
  const formats = briefValue(rawBrief, "Выбранные форматы")
    .split(",")
    .map((format) => ({ id: format.trim(), label: formatLabels[format.trim()] ?? format.trim() }))
    .filter(Boolean);
  const topics = previewTopics(rawBrief, workspace.name);
  const profile = workspace.brandProfile;
  const postTopics = briefValue(rawBrief, "Ритм постов") === "calm" ? 4 : 8;
  const articleRhythm = briefValue(rawBrief, "Ритм статей");
  const articleCount = articleRhythm === "two" ? 2 : articleRhythm === "one" ? 1 : 0;
  const platformFormats = formats.map((format) => ({ ...format, platform: platformBrandFromFormatId(format.id) })).filter((format) => format.platform);
  const calendarPreview = topics.slice(0, 6).map((topic, index) => ({
    topic,
    day: [3, 6, 10, 13, 17, 20][index],
    format: platformFormats[index % Math.max(platformFormats.length, 1)] ?? null,
  }));

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="overview"
      eyebrow="Персональное превью"
      title="Мы уже поняли ваш бренд."
      description="Показываем структуру будущего месяца до оплаты — без пустых обещаний. Полные тексты, визуалы и скачивание откроются после активации."
      headerAction={<Link href="/app/subscribe" className="rounded-2xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_45px_rgba(112,78,255,.28)] transition hover:bg-violet-400">Открыть полный месяц</Link>}
    >
      <section className="grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <article className={`${darkCardClass} p-6 sm:p-7`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Профиль бренда</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">{workspace.name}</h2></div>
            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200">Бриф обработан</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/25">Аудитория</p><p className="mt-2 text-sm leading-6 text-white/68">{shorten(profile?.targetAudienceNotes || "Аудитория будет уточняться по мере работы.", 150)}</p></div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/25">Голос бренда</p><p className="mt-2 text-sm leading-6 text-white/68">{shorten(profile?.toneOfVoice || "Спокойный, ясный и профессиональный", 150)}</p></div>
          </div>
          <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/25">Главная линия контента</p><p className="mt-2 text-sm leading-6 text-white/68">{shorten(profile?.keyMessages || briefValue(rawBrief, "Приоритетный продукт или услуга"), 230)}</p></div>
        </article>

        <article className={`${darkCardClass} p-6 sm:p-7`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Ваш набор</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">Лёгкий месяц без перегруза</h2>
          <p className="mt-2 text-sm leading-6 text-white/38">Только выбранные площадки и понятный ритм публикаций.</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">{formats.map((format) => {
            const platform = platformBrandFromFormatId(format.id);
            return <div key={format.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">{platform ? <PlatformBrandIcon platform={platform} size="sm" /> : null}<span className="truncate text-xs font-medium text-white/68">{format.label}</span></div>;
          })}</div>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-violet-500/10 p-3"><p className="text-xl font-semibold text-white">до {postTopics}</p><p className="mt-1 text-[9px] text-white/30">тем для постов</p></div>
            <div className="rounded-2xl bg-white/[0.035] p-3"><p className="text-xl font-semibold text-white">4</p><p className="mt-1 text-[9px] text-white/30">недели</p></div>
            <div className="rounded-2xl bg-white/[0.035] p-3"><p className="text-xl font-semibold text-white">{articleCount || "—"}</p><p className="mt-1 text-[9px] text-white/30">{articleCount === 0 ? "без статей" : articleCount === 1 ? "статья" : "статьи"}</p></div>
          </div>
        </article>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <article className={`${darkCardClass} p-6 sm:p-7`}>
          <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Календарь месяца</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">Так выглядит будущий ритм</h2></div><span className="text-[9px] text-white/24">предварительно</span></div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {calendarPreview.map((item) => <div key={`${item.day}-${item.topic}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/15 p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-xs font-semibold text-violet-200">{item.day}</span>{item.format?.platform ? <PlatformBrandIcon platform={item.format.platform} size="xs" /> : null}<div className="min-w-0"><p className="text-[9px] text-white/25">{item.format?.label ?? "Материал"}</p><p className="mt-1 line-clamp-1 text-[11px] font-medium text-white/62">{item.topic}</p></div></div>)}
          </div>
        </article>

        <article className={`${darkCardClass} overflow-hidden`}>
          <div className="relative h-44 bg-[radial-gradient(circle_at_30%_20%,rgba(124,92,255,.38),transparent_36%),radial-gradient(circle_at_78%_68%,rgba(72,190,165,.16),transparent_34%),linear-gradient(145deg,#191523,#0d0c11)]"><div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:28px_28px]" /><div className="absolute inset-x-6 bottom-6"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-violet-200/80">Визуальная концепция</p><p className="mt-2 max-w-xs text-lg font-semibold leading-5 text-white/85">Материал в стиле вашего бренда</p></div></div>
          <div className="relative p-6"><div className="space-y-2 opacity-30 blur-[2px]"><div className="h-2.5 w-full rounded bg-white/40" /><div className="h-2.5 w-11/12 rounded bg-white/35" /><div className="h-2.5 w-4/5 rounded bg-white/30" /><div className="h-2.5 w-2/3 rounded bg-white/25" /></div><div className="absolute inset-0 grid place-items-center bg-[#111016]/28 backdrop-blur-[1px]"><div className="rounded-2xl border border-violet-400/20 bg-[#171421]/95 px-4 py-3 text-center shadow-2xl"><span className="mx-auto grid h-7 w-7 place-items-center rounded-xl bg-violet-500/15 text-xs text-violet-200">⌁</span><p className="mt-2 text-[11px] font-semibold text-white">Полный материал защищён</p><p className="mt-1 text-[9px] text-white/32">откроется после активации</p></div></div></div>
        </article>
      </section>

      <section className={`${darkCardClass} relative mt-4 overflow-hidden p-6 sm:p-7`}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Предварительный план</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">Темы первого месяца</h2></div><span className="text-xs text-white/28">Персонально по вашему брифу</span></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic, index) => <article key={topic} className="min-h-36 rounded-[18px] border border-white/[0.06] bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-violet-300">Неделя {Math.floor(index / 2) + 1}</span><span className="text-[9px] text-white/20">{index % 2 === 0 ? "Пост" : "Материал"}</span></div><p className="mt-5 text-sm font-medium leading-6 text-white/72">{topic}</p></article>)}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-32 items-end justify-center bg-gradient-to-t from-[#111016] via-[#111016]/90 to-transparent pb-6">
          <div className="flex items-center gap-3 rounded-2xl border border-violet-400/20 bg-[#171421] px-4 py-3 shadow-2xl"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-sm">⌁</span><div><p className="text-xs font-semibold text-white">Полные материалы защищены</p><p className="mt-0.5 text-[10px] text-white/35">Тексты, визуалы и скачивание — после активации</p></div></div>
        </div>
      </section>

      <section className="mt-4 flex flex-col items-center justify-between gap-5 rounded-[22px] border border-violet-400/18 bg-[linear-gradient(120deg,rgba(111,75,255,.18),rgba(255,255,255,.025))] p-6 text-center sm:flex-row sm:text-left">
        <div><p className="text-lg font-semibold text-white">Готовы собрать полноценный месяц?</p><p className="mt-1 text-sm text-white/40">После оплаты система подготовит тексты, визуалы и календарь автоматически.</p></div>
        <Link href="/app/subscribe" className="shrink-0 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-50">Посмотреть тариф</Link>
      </section>
    </SelfServiceAppShell>
  );
}
