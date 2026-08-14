"use client";

import {
  connectSelfServiceSocialChannel,
  disconnectSelfServiceSocialChannel,
} from "@/lib/self-service/channel-actions";

type SocialChannel = {
  id: string | null;
  platform: "vk" | "telegram";
  label: string;
  description: string;
  referencePlaceholder: string;
  tokenPlaceholder: string;
  connected: boolean;
  title: string | null;
  reference: string;
  credentialHint: string | null;
  tokenAvailable: boolean;
  autopublishEnabled: boolean;
};

export function ChannelSetupForm({ channels, onboarding = false }: { channels: SocialChannel[]; onboarding?: boolean }) {
  return (
    <div className="mt-7 grid gap-4 lg:grid-cols-2">
      {channels.map((channel) => (
        <article key={channel.platform} className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,.16)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-lg font-semibold tracking-[-0.025em] text-white">{channel.label}</p><p className="mt-1 text-xs leading-5 text-white/30">{channel.description}</p></div>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-semibold ${channel.connected ? "bg-violet-500/15 text-violet-200" : "bg-white/[0.05] text-white/32"}`}>{channel.connected ? "подключено" : "не подключено"}</span>
          </div>

          {channel.connected ? <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/15 p-4"><p className="text-xs font-semibold text-white/70">{channel.title || channel.reference}</p><p className="mt-1 text-[10px] text-white/28">{channel.credentialHint ? `Доступ: ${channel.credentialHint}` : "Соединение проверено"}</p></div> : null}

          <form action={connectSelfServiceSocialChannel} className="mt-5 space-y-3">
            <input type="hidden" name="platform" value={channel.platform} />
            {onboarding ? <input type="hidden" name="onboarding" value="1" /> : null}
            <label className="grid gap-1.5"><span className="text-[10px] font-semibold text-white/42">{channel.platform === "telegram" ? "Адрес канала" : "Ссылка на сообщество"}</span><input name="reference" required defaultValue={channel.reference} placeholder={channel.referencePlaceholder} className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-white/75 outline-none transition placeholder:text-white/18 focus:border-violet-400/40" /></label>
            <label className="grid gap-1.5"><span className="text-[10px] font-semibold text-white/42">{channel.platform === "telegram" ? "Токен бота" : "Токен VK"}</span><input type="password" name="token" required={!channel.tokenAvailable} autoComplete="off" placeholder={channel.tokenAvailable ? "Сохранён — оставьте пустым" : channel.tokenPlaceholder} className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-white/75 outline-none transition placeholder:text-white/18 focus:border-violet-400/40" /></label>
            <label className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-black/10 px-3.5 py-3"><input type="checkbox" name="autopublishEnabled" defaultChecked={channel.autopublishEnabled || onboarding} className="h-4 w-4 accent-violet-500" /><span><span className="block text-xs font-medium text-white/60">Разрешить автопубликацию</span><span className="mt-0.5 block text-[9px] text-white/24">Только после вашего подтверждения материала</span></span></label>
            <button className="w-full rounded-xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white transition hover:bg-violet-400">{channel.connected ? "Проверить и обновить" : "Подключить"}</button>
          </form>

          {channel.connected && channel.id ? <form action={disconnectSelfServiceSocialChannel} className="mt-3"><input type="hidden" name="channelRecordId" value={channel.id} />{onboarding ? <input type="hidden" name="onboarding" value="1" /> : null}<button className="w-full py-2 text-[10px] font-medium text-white/22 transition hover:text-rose-300">Отключить площадку</button></form> : null}
        </article>
      ))}
    </div>
  );
}
