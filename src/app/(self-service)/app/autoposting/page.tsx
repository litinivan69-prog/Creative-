import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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

export default async function SelfServiceAutopostingPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/autoposting");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    include: {
      client: {
        include: {
          channels: { orderBy: { createdAt: "asc" } },
          scheduledPublications: {
            where: { scheduledDate: { gte: new Date().toISOString().slice(0, 10) } },
            orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
            take: 5,
          },
        },
      },
    },
  });
  if (!membership) redirect("/start");

  const workspace = membership.client;
  const activeChannels = workspace.channels.filter((channel) => channel.status === "active" && ["telegram", "vk"].includes(channel.platform.toLowerCase()));
  const publishingReady = activeChannels.length;
  const automaticChannels = activeChannels.filter((channel) => channel.autopublishEnabled).length;

  const rules = [
    { title: "Публиковать подтверждённое по календарю", description: "Материал выходит в выбранный день и время.", active: automaticChannels > 0 },
    { title: "Адаптировать текст под площадку", description: "VK получает подробную версию, Telegram — более короткую.", active: true },
    { title: "Повторить при технической ошибке", description: "Безопасный повтор и понятное уведомление вместо пропущенного поста.", active: true },
    { title: "Требовать подтверждение", description: "Включите позже, если хотите проверять каждый материал вручную.", active: false },
  ];

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="autoposting"
      eyebrow="Автопостинг"
      title="Публикации идут по календарю."
      description="Подключите площадки один раз. После этого подтверждённые материалы смогут выходить без ручного копирования текста и загрузки визуалов."
      headerAction={<Link href="/app/channels" className="rounded-2xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white transition hover:bg-violet-400">Подключить площадку</Link>}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        {[["Подключено", String(publishingReady), "Telegram и VK"],["Автоматически", String(automaticChannels), "после подтверждения"],["В очереди", String(workspace.scheduledPublications.length), "ближайшие публикации"]].map(([label,value,detail]) => <article key={label} className={`${darkCardClass} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/28">{label}</p><div className="mt-3 flex items-end justify-between"><p className="text-3xl font-semibold tracking-[-0.04em]">{value}</p><span className="text-[9px] text-white/25">{detail}</span></div></article>)}
      </section>

      <section className={`${darkCardClass} mt-4 p-5 sm:p-6`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Правила публикации</h2><p className="mt-1 text-[10px] text-white/30">Сначала понятное правило, затем автоматическое действие.</p></div><span className="rounded-full bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200">{rules.filter((rule) => rule.active).length}/{rules.length} активны</span></div><div className="mt-5 space-y-2.5">{rules.map((rule) => <article key={rule.title} className="flex items-center gap-3 rounded-2xl border border-white/[0.055] bg-black/15 p-4"><span className={`relative h-5 w-9 shrink-0 rounded-full ${rule.active ? "bg-violet-500" : "bg-white/10"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white ${rule.active ? "left-[18px]" : "left-0.5"}`} /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-white/78">{rule.title}</p><p className="mt-1 text-[10px] leading-4 text-white/28">{rule.description}</p></div><span className={`text-[9px] ${rule.active ? "text-emerald-300/70" : "text-white/20"}`}>{rule.active ? "работает" : "выключено"}</span></article>)}</div></section>

      <section className={`${darkCardClass} mt-4 overflow-hidden`}><div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold">Ближайшие публикации</h2><p className="mt-1 text-[10px] text-white/30">Очередь строится из вашего календаря.</p></div>{workspace.scheduledPublications.length ? <div className="divide-y divide-white/[0.05]">{workspace.scheduledPublications.map((publication) => <article key={publication.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[110px_90px_minmax(0,1fr)_90px] sm:items-center"><span className="text-xs text-white/55">{publication.scheduledDate}<span className="ml-1 text-white/22">{publication.scheduledTime || ""}</span></span><span className="w-fit rounded-full bg-white/[0.05] px-2.5 py-1 text-[9px] font-semibold text-white/45">{platformLabel(publication.platformName)}</span><p className="truncate text-xs text-white/72">{publication.topic}</p><span className="text-[9px] text-violet-200">{publication.status}</span></article>)}</div> : <div className="px-5 py-10 text-center"><p className="text-sm font-medium text-white/65">Публикаций в очереди пока нет</p><p className="mt-2 text-xs text-white/28">После подготовки месяца они появятся здесь автоматически.</p><Link href="/app/month" className="mt-5 inline-flex text-xs font-semibold text-violet-300">Открыть календарь →</Link></div>}</section>
    </SelfServiceAppShell>
  );
}
