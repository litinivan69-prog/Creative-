import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChannelSetupForm } from "@/app/(self-service)/app/channels/channel-setup-form";
import { SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Площадки · Adaptive Presence",
  robots: { index: false, follow: false },
};

const platformDefinitions = [
  { platform: "vk" as const, label: "VK", description: "Сообщество бренда, посты и визуальное оформление.", placeholder: "https://vk.com/..." },
  { platform: "telegram" as const, label: "Telegram", description: "Канал бренда с более короткой и живой подачей.", placeholder: "https://t.me/..." },
  { platform: "dzen" as const, label: "Дзен", description: "Экспертные статьи и органический поисковый трафик.", placeholder: "https://dzen.ru/..." },
  { platform: "vcru" as const, label: "VC.ru", description: "Деловые статьи, кейсы и профессиональные разборы.", placeholder: "https://vc.ru/..." },
];

export default async function SelfServiceChannelsPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/channels");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    include: { client: { include: { channels: true } } },
  });
  if (!membership) redirect("/start");

  const initialChannels = platformDefinitions.map((definition) => {
    const saved = membership.client.channels.find((channel) => channel.platform === definition.platform);
    const state = saved?.status === "active" && /^https?:\/\//i.test(saved.channelId)
      ? "active" as const
      : saved?.status === "to_create"
        ? "to_create" as const
        : "inactive" as const;

    return { ...definition, state, url: state === "active" ? saved?.channelId ?? "" : "" };
  });

  return (
    <SelfServiceAppShell
      brandName={membership.client.name}
      active="channels"
      eyebrow="Бренд и площадки"
      title="Где бренд уже есть, а что нужно оформить?"
      description="Для каждой площадки выберите один понятный вариант. Мы сохраним это в профиле и не будем заставлять вас повторно вводить данные."
    >
      <div className="ap-dark-surface max-w-[960px]">
          <ChannelSetupForm initialChannels={initialChannels} />
      </div>
    </SelfServiceAppShell>
  );
}
