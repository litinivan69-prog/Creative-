import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SelfServiceOnboardingSchema } from "@/lib/self-service/onboarding";
import { continueWithExistingBrand, createNewBrandFromOnboarding } from "@/lib/self-service/onboarding-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Выбор бренда · Ribes", robots: { index: false, follow: false } };

export default async function BrandChoicePage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/brand-choice");

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      memberships: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        select: { client: { select: { id: true, name: true, website: true } } },
      },
    },
  });
  const draft = await prisma.selfServiceOnboardingDraft.findFirst({
    where: { email, claimedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { payload: true },
  });
  const pending = draft ? SelfServiceOnboardingSchema.safeParse(draft.payload) : null;

  if (!user?.memberships.length && !pending?.success) redirect("/start");

  return (
    <main className="min-h-screen bg-[#09080d] px-4 py-10 text-white sm:py-16">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[600px] bg-[radial-gradient(circle_at_50%_0%,rgba(124,92,255,.18),transparent_45%)]" />
      <section className="relative mx-auto max-w-4xl">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">Всё сохранено</span>
          <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Какой бренд открыть?</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/42">Мы нашли существующий кабинет. Можно вернуться в него или создать отдельное пространство из нового брифа.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {user?.memberships.map(({ client }) => (
            <form key={client.id} action={continueWithExistingBrand} className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-6 shadow-[0_28px_90px_rgba(0,0,0,.22)]">
              <input type="hidden" name="clientId" value={client.id} />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Существующий бренд</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{client.name}</h2>
              <p className="mt-2 truncate text-xs text-white/32">{client.website || "Сохранённый кабинет и материалы"}</p>
              <button className="mt-7 w-full rounded-2xl border border-white/[0.1] bg-white/[0.06] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.1]">Открыть {client.name}</button>
            </form>
          ))}

          {pending?.success ? (
            <form action={createNewBrandFromOnboarding} className="rounded-[24px] border border-violet-400/30 bg-[linear-gradient(145deg,rgba(124,92,255,.18),rgba(255,255,255,.035))] p-6 shadow-[0_28px_90px_rgba(74,48,170,.16)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">Новый бриф</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{pending.data.brief.brandName}</h2>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/38">{pending.data.brief.businessDescription}</p>
              <button className="mt-7 w-full rounded-2xl bg-violet-500 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(124,92,255,.25)] transition hover:bg-violet-400">Создать новый бренд</button>
            </form>
          ) : null}
        </div>
        <p className="mt-6 text-center text-xs text-white/25">Старый кабинет и его материалы не изменятся.</p>
      </section>
    </main>
  );
}
