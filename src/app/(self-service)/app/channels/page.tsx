import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChannelSetupForm } from "@/app/(self-service)/app/channels/channel-setup-form";
import { SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getIntegrationSetting, getTelegramBotToken, TELEGRAM_BOT_USERNAME_KEY } from "@/lib/telegram";
import { VK_ACCESS_TOKEN_KEY, VK_ACCOUNT_LABEL_KEY } from "@/lib/vk";
import { completeSelfServiceChannelOnboarding } from "@/lib/self-service/channel-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Площадки · Adaptive Presence",
  robots: { index: false, follow: false },
};

export default async function SelfServiceChannelsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; from?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/channels");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    include: { client: { include: { channels: true, monthlyPlans: { select: { id: true }, take: 1 } } } },
  });
  if (!membership) redirect("/start");

  const [platformTelegramToken, platformTelegramUsername, platformVkToken, platformVkLabel] = await Promise.all([
    getTelegramBotToken().then(Boolean),
    getIntegrationSetting(TELEGRAM_BOT_USERNAME_KEY),
    getIntegrationSetting(VK_ACCESS_TOKEN_KEY).then(Boolean),
    getIntegrationSetting(VK_ACCOUNT_LABEL_KEY),
  ]);
  const socialDefinitions = [
    { platform: "telegram" as const, label: "Telegram", description: "Бот публикует посты и карусели в ваш канал.", referencePlaceholder: "@название_канала", tokenPlaceholder: "123456:ABC...", platformToken: platformTelegramToken, platformHint: platformTelegramUsername ? `@${platformTelegramUsername}` : null },
    { platform: "vk" as const, label: "VK", description: "Публикация полного текста и изображений в сообщество.", referencePlaceholder: "https://vk.com/сообщество", tokenPlaceholder: "Токен с правами wall, photos, groups", platformToken: platformVkToken, platformHint: platformVkLabel },
  ];
  const channels = socialDefinitions.map((definition) => {
    const saved = membership.client.channels.find((channel) => channel.platform === definition.platform);
    const connected = saved?.status === "active" && (Boolean(saved.credentialEncrypted) || definition.platformToken);
    return {
      ...definition,
      id: saved?.id ?? null,
      connected: Boolean(connected),
      title: saved?.title ?? null,
      reference: connected ? saved?.channelId ?? "" : "",
      credentialHint: saved?.credentialHint ?? definition.platformHint,
      tokenAvailable: Boolean(saved?.credentialEncrypted || definition.platformToken),
      autopublishEnabled: saved?.autopublishEnabled ?? false,
    };
  });
  const isOnboarding = query.from === "brief" || (!membership.client.onboardingCompletedAt && membership.client.monthlyPlans.length === 0);
  const connectedCount = channels.filter((channel) => channel.connected).length;

  return (
    <SelfServiceAppShell
      brandName={membership.client.name}
      active="channels"
      eyebrow={isOnboarding ? "Шаг 4 из 4" : "Бренд и площадки"}
      title={isOnboarding ? "Куда будем публиковать?" : "Подключите площадки один раз."}
      description={isOnboarding ? "Выберите Telegram, VK или обе площадки. Подключение можно сделать сейчас либо вернуться к нему позже — этот шаг больше не потеряется." : "После проверки соединения подтверждённые материалы можно будет отправлять прямо из календаря. Ключи хранятся зашифрованно и не показываются повторно."}
    >
      <div className="max-w-[960px]">
        {isOnboarding ? <section className="mb-5 overflow-hidden rounded-[22px] border border-violet-400/15 bg-violet-500/[0.07] p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-violet-100">Последний шаг настройки</p><p className="mt-1 text-[10px] leading-4 text-white/35">Профиль бренда уже сохранён. Теперь решите, куда система сможет отправлять готовые посты.</p></div><span className="shrink-0 rounded-full bg-violet-500/15 px-3 py-1.5 text-[10px] font-semibold text-violet-200">75 → 100%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-full rounded-full bg-violet-500" /></div></section> : null}
        {query.notice ? <div className="rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">{query.notice}</div> : null}
        {query.error ? <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">{query.error}</div> : null}
        <ChannelSetupForm channels={channels} onboarding={isOnboarding} />
        <section className="mt-4 rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-5"><p className="text-xs font-semibold text-white/55">Дзен и VC.ru</p><p className="mt-2 text-xs leading-5 text-white/27">Статьи уже готовятся в платформе и скачиваются из материала. Прямую публикацию подключим отдельно, когда площадки откроют стабильный доступ для вашего аккаунта.</p></section>
        {isOnboarding ? <section className="sticky bottom-4 mt-5 rounded-[22px] border border-white/[0.08] bg-[#111014]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:gap-5"><div><p className="text-xs font-semibold text-white/72">{connectedCount ? `Подключено площадок: ${connectedCount}` : "Можно продолжить без подключения"}</p><p className="mt-1 text-[10px] leading-4 text-white/28">Telegram и VK всегда останутся доступны в разделе «Площадки».</p></div><form action={completeSelfServiceChannelOnboarding} className="mt-3 sm:mt-0"><button className={`w-full rounded-xl px-5 py-3 text-xs font-semibold transition sm:w-auto ${connectedCount ? "bg-violet-500 text-white hover:bg-violet-400" : "border border-white/[0.08] bg-white/[0.04] text-white/55 hover:bg-white/[0.07]"}`}>{connectedCount ? "Продолжить — собрать месяц" : "Пока без автопостинга"}</button></form></section> : null}
      </div>
    </SelfServiceAppShell>
  );
}
