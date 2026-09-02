import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChannelSetupForm } from "@/app/(self-service)/app/channels/channel-setup-form";
import { SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { PlatformBrandIcon, type PlatformBrand } from "@/app/(self-service)/platform-brand-icon";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getIntegrationSetting, getTelegramBotToken, TELEGRAM_BOT_USERNAME_KEY } from "@/lib/telegram";
import { VK_ACCESS_TOKEN_KEY, VK_ACCOUNT_LABEL_KEY } from "@/lib/vk";
import { completeSelfServiceChannelOnboarding } from "@/lib/self-service/channel-actions";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Площадки · Ribes",
  robots: { index: false, follow: false },
};

export default async function SelfServiceChannelsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; from?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/channels");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
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
    { platform: "vcru" as const, label: "VC.ru", description: "Статьи с обложкой и дополнительными изображениями по календарю.", referencePlaceholder: "Например, 123456 — пусто для личного блога", tokenPlaceholder: "API-токен из настроек профиля VC.ru", platformToken: false, platformHint: null },
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
      active="autoposting"
      eyebrow={isOnboarding ? "Площадки" : "Площадки и публикации"}
      title={isOnboarding ? "Куда будем публиковать?" : "Подключите площадки один раз."}
      description={isOnboarding ? "Подключение не обязательно для знакомства с платформой. Без него мы всё равно подготовим материалы — автоматическая публикация включится позже." : "VK, Telegram и VC.ru публикуются из кабинета. Одноклассники и Дзен пока получают готовые материалы для размещения."}
    >
      <div className="max-w-[960px]">
        {isOnboarding ? <section className="mb-5 overflow-hidden rounded-[22px] border border-violet-400/15 bg-violet-500/[0.07] p-5"><div><p className="text-xs font-semibold text-violet-100">Подключение можно пропустить</p><p className="mt-1 text-[10px] leading-4 text-white/35">Материалы подготовятся в любом случае. Автоматическую публикацию можно включить позже в этом же разделе.</p></div></section> : null}
        {query.notice ? <div className="rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">{query.notice}</div> : null}
        {query.error ? <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">{query.error}</div> : null}
        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Автопостинг</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">VK, Telegram и VC.ru</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-white/30">Подключите нужные площадки. Система отправит только тот материал, который вы сами подтвердили.</p></div><span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[9px] text-white/30">можно настроить позже</span></div>
          <ChannelSetupForm channels={channels} onboarding={isOnboarding} />
        </section>

        <section className="mt-8 border-t border-white/[0.06] pt-8">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Дополнительная площадка</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">Одноклассники</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-white/30">Система готовит отдельный текст и визуал под аудиторию ОК. В MVP вы проверяете материал, копируете его и размещаете вручную — без передачи пароля.</p></div>
          <article className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-5 sm:p-6"><div className="flex items-center gap-3.5"><PlatformBrandIcon platform="Одноклассники" size="sm" /><div><p className="text-base font-semibold text-white">Посты Одноклассники</p><p className="mt-1 text-[10px] text-white/28">готовый текст и изображение</p></div></div><span className="rounded-full bg-violet-500/10 px-3 py-1.5 text-[9px] font-semibold text-violet-200">ручная публикация в MVP</span></article>
        </section>

        <section className="mt-8 border-t border-white/[0.06] pt-8">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Статьи</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">Дзен — пакет для размещения</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-white/30">VC.ru уже подключается выше для автопубликации. Для Дзена платформа готовит структуру, текст, обложку, иллюстрации и DOCX.</p></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3.5"><PlatformBrandIcon platform="Дзен" size="sm" /><div><p className="text-base font-semibold text-white">Дзен</p><p className="mt-1 text-[10px] text-white/28">готовая статья для размещения</p></div></div><span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[9px] font-semibold text-white/35">пакет статьи</span></div><div className="mt-5 grid grid-cols-3 gap-2 text-center">{[["01", "Проверить"], ["02", "Скачать"], ["03", "Разместить"]].map(([number, label]) => <div key={number} className="rounded-xl border border-white/[0.05] bg-black/10 px-2 py-3"><p className="text-[9px] font-semibold text-violet-300">{number}</p><p className="mt-1 text-[9px] text-white/38">{label}</p></div>)}</div></article>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-white/[0.06] bg-black/15 px-4 py-3.5"><p className="text-[10px] leading-4 text-white/28">Для статей не нужно передавать пароль или токен от аккаунта.</p><Link href="/app/articles" className="text-[10px] font-semibold text-violet-300 transition hover:text-violet-200">Открыть статьи →</Link></div>
        </section>
        {isOnboarding ? <section className="sticky bottom-4 mt-5 rounded-[22px] border border-white/[0.08] bg-[#111014]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:gap-5"><div><p className="text-xs font-semibold text-white/72">{connectedCount ? `Автопостинг подключён: ${connectedCount} ${connectedCount === 1 ? "площадка" : "площадки"}` : "Материалы можно подготовить без подключения"}</p><p className="mt-1 text-[10px] leading-4 text-white/28">Для автоматической публикации подключаются VK, Telegram и VC.ru. Дзен пока получает готовый пакет статьи.</p></div><form action={completeSelfServiceChannelOnboarding} className="mt-3 sm:mt-0"><button className="w-full rounded-xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white transition hover:bg-violet-400 sm:w-auto">{connectedCount ? "Продолжить — собрать месяц" : "Продолжить без подключения"}</button></form></section> : null}
      </div>
    </SelfServiceAppShell>
  );
}
