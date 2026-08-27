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
  title: "Ваш контент-план · Ribes",
  robots: { index: false, follow: false },
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
  const topics = previewTopics(rawBrief, workspace.name);
  const profile = workspace.brandProfile;
  const platformFormats = [
    { id: "vk_post", label: "VK", platform: platformBrandFromFormatId("vk_post") },
    { id: "telegram_post", label: "Telegram", platform: platformBrandFromFormatId("telegram_post") },
    { id: "dzen_article", label: "Дзен", platform: platformBrandFromFormatId("dzen_article") },
    { id: "vcru_article", label: "VC.ru", platform: platformBrandFromFormatId("vcru_article") },
  ].filter((format) => format.platform);
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
      description="Профиль бренда уже собран. Теперь выберите пробный набор материалов — стоимость в кредитах будет видна до запуска."
      headerAction={<Link href="/app/plan-builder" className="rounded-2xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_45px_rgba(112,78,255,.28)] transition hover:bg-violet-400">Собрать пробный набор</Link>}
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
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Следующий шаг</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">Вы сами собираете набор</h2>
          <p className="mt-2 text-sm leading-6 text-white/38">Посты, статьи и карусели выбираются отдельно. Ничего не запускается и не списывается без подтверждения.</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">{platformFormats.map((format) => {
            const platform = platformBrandFromFormatId(format.id);
            return <div key={format.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">{platform ? <PlatformBrandIcon platform={platform} size="sm" /> : null}<span className="truncate text-xs font-medium text-white/68">{format.label}</span></div>;
          })}</div>
          <div className="mt-6 rounded-2xl bg-violet-500/10 p-4"><p className="text-xs font-semibold text-violet-100">Пробные кредиты уже начислены</p><p className="mt-1 text-[10px] leading-4 text-white/32">Их хватит, чтобы пройти реальный путь и получить первые материалы.</p></div>
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
        <div><p className="text-lg font-semibold text-white">Попробуйте на реальных материалах</p><p className="mt-1 text-sm text-white/40">Сначала соберите пробный набор. Подписка понадобится, когда бесплатные кредиты закончатся.</p></div>
        <Link href="/app/plan-builder" className="shrink-0 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-50">Собрать набор</Link>
      </section>
    </SelfServiceAppShell>
  );
}
