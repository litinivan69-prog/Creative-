import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncYooKassaPayment } from "@/lib/yookassa";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Проверяем оплату · Adaptive Presence",
  robots: { index: false, follow: false },
};

export default async function YooKassaReturnPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/subscribe");

  const { payment: localPaymentId } = await searchParams;
  if (!localPaymentId) redirect("/app/subscribe?error=payment_missing");

  const localPayment = await prisma.billingPayment.findFirst({
    where: { id: localPaymentId, client: { memberships: { some: { user: { email } } } } },
    select: { providerPaymentId: true },
  });
  if (!localPayment?.providerPaymentId) redirect("/app/subscribe?error=payment_missing");

  try {
    const result = await syncYooKassaPayment(localPayment.providerPaymentId);
    if (result.status === "succeeded") redirect("/app/credits?payment=success");
    if (result.status === "canceled") redirect("/app/subscribe?error=payment_canceled");
    if (result.status === "verification_failed" || result.status === "unknown") redirect("/app/subscribe?error=payment_verification_failed");
  } catch (error) {
    console.error("YooKassa return sync failed", error instanceof Error ? error.message : "unknown error");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#09080d] px-4 py-10 text-white">
      <section className="w-full max-w-lg rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-8 text-center shadow-2xl">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">⌁</span>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Проверяем оплату</h1>
        <p className="mt-3 text-sm leading-6 text-white/45">Банк ещё подтверждает платёж. Обычно это занимает несколько секунд. Можно обновить страницу безопасно.</p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center"><Link href={`/app/subscribe/return?payment=${encodeURIComponent(localPaymentId)}`} className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Проверить ещё раз</Link><Link href="/app/subscribe" className="rounded-2xl border border-white/[0.08] px-5 py-3 text-sm font-semibold text-white/65">Вернуться к тарифу</Link></div>
      </section>
    </main>
  );
}
