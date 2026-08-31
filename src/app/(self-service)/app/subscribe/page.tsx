import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { grantTrialCredits } from "@/lib/self-service/credits";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { CreditPricingSelector } from "@/app/(self-service)/app/subscribe/credit-pricing-selector";
import { isYooKassaConfigured } from "@/lib/yookassa";
import { isRibesAdminEmail } from "@/lib/self-service/admin-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Тарифы и кредиты · Ribes",
  robots: { index: false, follow: false },
};

export default async function SelfServiceSubscribePage({ searchParams }: { searchParams: Promise<{ error?: string; payment?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/subscribe");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    include: { client: { select: { id: true, name: true } } },
  });
  if (!membership) redirect("/start");

  await grantTrialCredits(membership.client.id);
  const wallet = await prisma.creditWallet.findUnique({ where: { clientId: membership.client.id } });

  return (
    <SelfServiceAppShell
      brandName={membership.client.name}
      active="credits"
      eyebrow="Тарифы и кредиты"
      title="Соберите подходящий объём сами."
      description="Кредиты можно тратить на любые форматы: посты, статьи, визуалы и карусели. Подписка даёт их выгоднее, а при необходимости баланс пополняется отдельно."
      headerAction={<Link href="/app" className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.07]">Вернуться в кабинет</Link>}
    >
      <CreditPricingSelector
        currentBalance={wallet?.balance ?? 0}
        unlimited={isRibesAdminEmail(email)}
        checkoutConfigured={isYooKassaConfigured()}
        testMode={process.env.YOOKASSA_TEST_MODE === "true"}
        error={query.error}
        payment={query.payment}
      />
    </SelfServiceAppShell>
  );
}
