import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signOutSelfService } from "@/lib/self-service/auth-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Главная · Adaptive Presence",
  robots: { index: false, follow: false },
};

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
              monthlyPlans: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                  plannedContentItems: { select: { id: true } },
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

  return (
    <main className="min-h-screen px-4 py-5 sm:px-7 sm:py-7">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex items-center justify-between rounded-[24px] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] sm:px-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-xs font-extrabold lowercase text-white">cc.</div><div><p className="text-sm font-semibold text-slate-950">{workspace.name}</p><p className="text-[11px] text-slate-400">Adaptive Presence</p></div></div>
          <form action={signOutSelfService}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">Выйти</button></form>
        </header>
        <section className="py-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Главная</p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.04em] text-slate-950">Добро пожаловать, {workspace.name}</h1>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_55px_rgba(77,61,112,0.06)]"><p className="text-xs text-slate-400">Тариф</p><p className="mt-2 text-xl font-semibold text-slate-950">{workspace.subscription?.planCode ?? "trial"}</p></article>
            <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_55px_rgba(77,61,112,0.06)]"><p className="text-xs text-slate-400">Текущий месяц</p><p className="mt-2 text-xl font-semibold text-slate-950">{latestPlan?.month ?? "Ещё не собран"}</p></article>
            <article className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_55px_rgba(77,61,112,0.06)]"><p className="text-xs text-slate-400">Материалов</p><p className="mt-2 text-xl font-semibold text-slate-950">{latestPlan?.plannedContentItems.length ?? 0}</p></article>
          </div>
          <Link href="/app/month" className="mt-5 inline-flex rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700">
            Открыть контент месяца
          </Link>
        </section>
      </div>
    </main>
  );
}
