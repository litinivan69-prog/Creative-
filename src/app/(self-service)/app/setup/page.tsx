import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SELF_SERVICE_ONBOARDING_COOKIE } from "@/lib/self-service/onboarding";
import { claimSelfServiceOnboarding } from "@/lib/self-service/onboarding-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Создание кабинета · Adaptive Presence",
  robots: { index: false, follow: false },
};

export default async function SelfServiceSetupPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/setup");

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      memberships: { where: { role: "owner" }, take: 1, select: { id: true } },
    },
  });

  if (user?.memberships.length) redirect("/app");

  const cookieStore = await cookies();
  const hasDraft = Boolean(cookieStore.get(SELF_SERVICE_ONBOARDING_COOKIE)?.value);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-xl rounded-[30px] border border-white/90 bg-white/90 p-7 text-center shadow-[0_30px_100px_rgba(77,61,112,0.12)] sm:p-9">
        <span className="inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">Почта подтверждена</span>
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.04em] text-slate-950">Создать личный кабинет</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {hasDraft
            ? "Бриф сохранён. Теперь безопасно привяжем его к вашему аккаунту и создадим пространство бренда."
            : "Мы не нашли сохранённый бриф. Вернитесь к короткой настройке — аккаунт уже останется активным."}
        </p>
        {hasDraft ? (
          <form action={claimSelfServiceOnboarding} className="mt-7">
            <button className="w-full rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700">Создать кабинет</button>
          </form>
        ) : (
          <a href="/start" className="mt-7 inline-flex rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white">Заполнить короткий бриф</a>
        )}
      </section>
    </main>
  );
}
