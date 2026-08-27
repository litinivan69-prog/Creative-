import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { grantTrialCredits } from "@/lib/self-service/credits";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { ContentMixBuilder } from "@/app/(self-service)/app/plan-builder/content-mix-builder";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Собрать месяц · Ribes", robots: { index: false, follow: false } };

const defaultConfiguration = { vkPosts: 2, telegramPosts: 2, okPosts: 0, dzenArticles: 1, vcruArticles: 0, carousels: 0, quickAnnouncements: 0, reviewReplies: 0 };

export default async function SelfServicePlanBuilderPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/plan-builder");
  const membership = await prisma.workspaceMembership.findFirst({ where: await selfServiceMembershipWhere(email), include: { client: { select: { id: true, name: true } } } });
  if (!membership) redirect("/start");

  await grantTrialCredits(membership.client.id);
  const [wallet, draft] = await Promise.all([
    prisma.creditWallet.findUnique({ where: { clientId: membership.client.id } }),
    prisma.selfServiceContentOrder.findFirst({ where: { clientId: membership.client.id, status: "draft" }, orderBy: { updatedAt: "desc" } }),
  ]);
  const initial = draft?.configuration && typeof draft.configuration === "object" && !Array.isArray(draft.configuration)
    ? { ...defaultConfiguration, ...(draft.configuration as typeof defaultConfiguration) }
    : defaultConfiguration;

  return <SelfServiceAppShell brandName={membership.client.name} active="builder" eyebrow="Конструктор месяца" title="Выберите только то, что нужно." description="Любое количество постов, статей и дополнительных материалов. Стоимость в кредитах видна сразу — без скрытых лимитов."><ContentMixBuilder balance={wallet?.balance ?? 0} initial={initial} notice={query.notice} error={query.error} /></SelfServiceAppShell>;
}
