import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SELF_SERVICE_ONBOARDING_COOKIE } from "@/lib/self-service/onboarding";
import { claimSelfServiceOnboarding } from "@/lib/self-service/onboarding-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Создание кабинета · Ribes",
  robots: { index: false, follow: false },
};

export default async function SelfServiceSetupPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/setup");

  const cookieStore = await cookies();
  const hasDraftCookie = Boolean(cookieStore.get(SELF_SERVICE_ONBOARDING_COOKIE)?.value);
  const hasDraft = hasDraftCookie
    ? true
    : Boolean(
        await prisma.selfServiceOnboardingDraft.findFirst({
          where: {
            email,
            claimedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        }),
      );

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      memberships: { where: { role: "owner" }, take: 1, select: { id: true } },
    },
  });

  if (user?.memberships.length && hasDraft) redirect("/app/brand-choice");
  if (user?.memberships.length) redirect("/app");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#09090d] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_30%_0%,rgba(124,92,255,.18),transparent_38%)]" />
      <section className="relative w-full max-w-xl rounded-[30px] border border-white/[.09] bg-[#101015]/95 p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,.35)] sm:p-9">
        <span className="inline-flex rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200">Почта подтверждена</span>
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.04em] text-white">Создать личный кабинет</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {hasDraft
            ? "Бриф сохранён. Теперь безопасно привяжем его к вашему аккаунту и создадим пространство бренда."
            : "Мы не нашли сохранённый бриф. Вернитесь к короткой настройке — аккаунт уже останется активным."}
        </p>
        {hasDraft ? (
          <form action={claimSelfServiceOnboarding} className="mt-7">
            <button className="w-full rounded-2xl bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-400">Создать кабинет</button>
          </form>
        ) : (
          <a href="/start" className="mt-7 inline-flex rounded-2xl bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white">Заполнить короткий бриф</a>
        )}
      </section>
    </main>
  );
}
