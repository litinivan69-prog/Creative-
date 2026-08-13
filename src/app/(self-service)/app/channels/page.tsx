import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChannelSetupForm } from "@/app/(self-service)/app/channels/channel-setup-form";
import { SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getIntegrationSetting, getTelegramBotToken, TELEGRAM_BOT_USERNAME_KEY } from "@/lib/telegram";
import { VK_ACCESS_TOKEN_KEY, VK_ACCOUNT_LABEL_KEY } from "@/lib/vk";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Площадки · Adaptive Presence",
  robots: { index: false, follow: false },
};

export default async function SelfServiceChannelsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/channels");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    include: { client: { include: { channels: true } } },
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

  return (
    <SelfServiceAppShell
      brandName={membership.client.name}
      active="channels"
      eyebrow="Бренд и площадки"
      title="Подключите площадки один раз."
      description="После проверки соединения подтверждённые материалы можно будет отправлять прямо из календаря. Ключи хранятся зашифрованно и не показываются повторно."
    >
      <div className="max-w-[960px]">
        {query.notice ? <div className="rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">{query.notice}</div> : null}
        {query.error ? <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">{query.error}</div> : null}
        <ChannelSetupForm channels={channels} />
        <section className="mt-4 rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-5"><p className="text-xs font-semibold text-white/55">Дзен и VC.ru</p><p className="mt-2 text-xs leading-5 text-white/27">Статьи уже готовятся в платформе и скачиваются из материала. Прямую публикацию подключим отдельно, когда площадки откроют стабильный доступ для вашего аккаунта.</p></section>
      </div>
    </SelfServiceAppShell>
  );
}
