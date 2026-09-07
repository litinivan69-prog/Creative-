import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { addSelfServiceContentToCurrentMonth } from "@/app/actions";
import { SelfServiceAppShell, darkCardClass } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { launchSelfServiceContentOrder } from "@/lib/self-service/content-order-actions";
import { CREDIT_PRODUCTS, displayCredits } from "@/lib/self-service/credit-catalog";
import { grantTrialCredits } from "@/lib/self-service/credits";
import { isRibesAdminEmail } from "@/lib/self-service/admin-access";
import { prisma } from "@/lib/prisma";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Новая статья · Ribes", robots: { index: false, follow: false } };

export default async function NewSpecificArticlePage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/articles/new");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true, client: { select: { name: true } } },
  });
  if (!membership) redirect("/start");

  await grantTrialCredits(membership.clientId);
  const [wallet, currentPlan] = await Promise.all([
    prisma.creditWallet.findUnique({ where: { clientId: membership.clientId }, select: { balance: true } }),
    prisma.monthlyOperatingPlan.findFirst({
      where: { clientId: membership.clientId, status: { notIn: ["archived", "replaced"] } },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    }),
  ]);
  const unlimited = isRibesAdminEmail(email);
  const cost = CREDIT_PRODUCTS.article_with_cover.credits;
  const action = currentPlan ? addSelfServiceContentToCurrentMonth : launchSelfServiceContentOrder;

  return (
    <SelfServiceAppShell
      brandName={membership.client.name}
      active="articles"
      eyebrow="Новая статья"
      title="Задайте конкретную тему."
      description="Ribes соберёт полноценную статью, обложку и иллюстрации. Она добавится в текущий календарь, не меняя готовые материалы."
    >
      <form action={action} className="mx-auto grid max-w-3xl gap-4">
        <section className={`${darkCardClass} p-6 sm:p-8`}>
          <label className="block">
            <span className="text-sm font-semibold text-white/80">О чём должна быть статья?</span>
            <span className="mt-1 block text-[10px] leading-4 text-white/28">Напишите задачу так, как объяснили бы её редактору. Одного–трёх предложений достаточно.</span>
            <textarea name="specificArticleTopic" required minLength={10} maxLength={500} rows={5} placeholder="Например: статья для владельцев квартир о том, как выбрать кухонную мойку, проверить размеры тумбы и избежать ошибок при монтаже" className="mt-4 w-full resize-y rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-4 text-sm leading-6 text-white/78 outline-none placeholder:text-white/18 focus:border-violet-400/40" />
          </label>
        </section>

        <section className={`${darkCardClass} p-6 sm:p-8`}>
          <p className="text-sm font-semibold text-white/80">Куда готовим материал?</p>
          <p className="mt-1 text-[10px] text-white/28">Выберите площадку — структура и подача будут адаптированы под неё.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="cursor-pointer rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition has-[:checked]:border-violet-400/55 has-[:checked]:bg-violet-500/10"><input className="sr-only" type="radio" name="specificArticlePlatform" value="dzen" defaultChecked /><span className="text-sm font-semibold">Дзен</span><span className="mt-1 block text-[10px] leading-4 text-white/30">Практичный материал для широкого поиска и рекомендаций</span></label>
            <label className="cursor-pointer rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition has-[:checked]:border-violet-400/55 has-[:checked]:bg-violet-500/10"><input className="sr-only" type="radio" name="specificArticlePlatform" value="vcru" /><span className="text-sm font-semibold">VC.ru</span><span className="mt-1 block text-[10px] leading-4 text-white/30">Деловая подача для предпринимателей и профессиональной аудитории</span></label>
          </div>
        </section>

        <aside className="rounded-[24px] border border-violet-400/15 bg-violet-500/[0.08] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div><p className="text-xs font-semibold text-violet-100">Полная статья · {displayCredits(cost)} кредитов</p><p className="mt-1 text-[10px] text-white/30">Текст, обложка и несколько иллюстраций. Баланс: {unlimited ? "безлимит администратора" : `${displayCredits(wallet?.balance ?? 0)} кредитов`}.</p></div>
          <button disabled={!unlimited && (wallet?.balance ?? 0) < cost} className="mt-4 w-full rounded-xl bg-white px-6 py-3.5 text-xs font-semibold text-black transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-35 sm:mt-0 sm:w-auto">Создать статью</button>
        </aside>
      </form>
    </SelfServiceAppShell>
  );
}
