import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { beginSelfServiceCheckout } from "@/lib/self-service/checkout-actions";
import { hasSelfServicePaidAccess } from "@/lib/self-service/subscription";
import { darkCardClass, SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Подписка · Adaptive Presence",
  robots: { index: false, follow: false },
};

export default async function SelfServiceSubscribePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/subscribe");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    include: {
      client: {
        include: {
          subscription: true,
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

  const features = [
    "8 публикаций на месяц — без контентного шума",
    "Посты VK и Telegram",
    "Статьи для Дзена и VC.ru",
    "Тексты и визуалы в стиле вашего бренда",
    "Календарь, редактор и скачивание материалов",
    "Подключение автопостинга — когда вы будете готовы",
    "Понятный итоговый отчёт за месяц",
  ];

  return (
    <SelfServiceAppShell
      brandName={workspace.name}
      active="overview"
      eyebrow="Подписка"
      title="Один тариф. Весь контент-месяц."
      description="Никакой менеджерской панели и сложных настроек. После оплаты система сама соберёт материалы по вашему брифу."
      headerAction={<Link href="/app/preview" className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.07]">Вернуться к превью</Link>}
    >
      <section className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1fr_.82fr]">
        <article className={`${darkCardClass} border-violet-400/20 bg-[linear-gradient(145deg,rgba(111,75,255,.16),rgba(255,255,255,.025))] p-7 sm:p-9`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200">Основной тариф</span><span className="text-[10px] text-white/28">Без автосписаний на старте</span></div>
          <div className="mt-8 flex items-end gap-2"><span className="text-5xl font-semibold tracking-[-0.055em] text-white">19 900 ₽</span><span className="pb-1.5 text-sm text-white/30">/ месяц</span></div>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/45">Полный рабочий кабинет для самостоятельного присутствия бренда — от идеи до готовой публикации.</p>
          {query.error === "checkout_unavailable" ? <p className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-xs leading-5 text-amber-100/80">Платёжный модуль ещё подключается. Ваш бриф и персональное превью сохранены — ничего заполнять заново не придётся.</p> : null}
          {query.error === "payment_failed" ? <p className="mt-5 rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-xs leading-5 text-rose-100/80">Не удалось открыть защищённую оплату. Деньги не списаны — попробуйте ещё раз чуть позже.</p> : null}
          {query.error === "payment_canceled" ? <p className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs leading-5 text-white/60">Оплата отменена. Можно вернуться к ней, когда будете готовы.</p> : null}
          <form action={beginSelfServiceCheckout} className="mt-7"><button className="w-full rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_50px_rgba(0,0,0,.2)] transition hover:bg-violet-50">Перейти к оплате</button></form>
          <p className="mt-3 text-center text-[10px] text-white/24">Полные тексты и визуалы начнут создаваться только после успешной оплаты.</p>
        </article>

        <article className={`${darkCardClass} p-7 sm:p-8`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Что входит</p>
          <div className="mt-6 space-y-4">{features.map((feature) => <div key={feature} className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-500/15 text-[10px] text-violet-200">✓</span><p className="text-sm leading-5 text-white/62">{feature}</p></div>)}</div>
          <div className="mt-7 rounded-2xl border border-white/[0.06] bg-black/20 p-4"><p className="text-xs font-semibold text-white/75">API площадок — позже</p><p className="mt-1.5 text-[11px] leading-5 text-white/32">Сначала получите материалы и оцените кабинет. Telegram и VK подключаются отдельно, когда захотите включить публикацию.</p></div>
        </article>
      </section>
    </SelfServiceAppShell>
  );
}
