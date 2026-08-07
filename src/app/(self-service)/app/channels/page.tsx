import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChannelSetupForm } from "@/app/(self-service)/app/channels/channel-setup-form";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signOutSelfService } from "@/lib/self-service/auth-actions";

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
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(circle_at_24%_0%,rgba(139,92,246,0.16),transparent_48%)]" />
      <div className="relative mx-auto max-w-[960px]">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur-xl sm:px-5">
          <Link href="/app" className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-xs font-extrabold lowercase text-white">cc.</div><div><p className="text-sm font-semibold text-slate-950">{membership.client.name}</p><p className="text-[11px] text-slate-400">Adaptive Presence</p></div></Link>
          <form action={signOutSelfService}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">Выйти</button></form>
        </header>

        <section className="pb-12 pt-10 sm:pt-12">
          <span className="inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">Следующий шаг после брифа</span>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">Где бренд уже есть, а что нужно оформить?</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">Для каждой площадки выберите один понятный вариант. Мы сохраним это в профиле и не будем заставлять вас повторно вводить данные.</p>
          <ChannelSetupForm initialChannels={initialChannels} />
        </section>
      </div>
    </main>
  );
}
