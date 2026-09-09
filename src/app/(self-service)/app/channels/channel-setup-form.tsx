"use client";

import Link from "next/link";
import {
  connectSelfServiceSocialChannel,
  disconnectSelfServiceSocialChannel,
} from "@/lib/self-service/channel-actions";
import { PlatformBrandIcon } from "@/app/(self-service)/platform-brand-icon";

type SocialChannel = {
  id: string | null;
  platform: "vk" | "telegram" | "vcru" | "ok";
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
  oauthAvailable?: boolean;
  approvalPending?: boolean;
};

export function ChannelSetupForm({ channels, onboarding = false }: { channels: SocialChannel[]; onboarding?: boolean }) {
  return (
    <div className="mt-7 grid gap-4 lg:grid-cols-2">
      {channels.map((channel) => (
        <article key={channel.platform} className={`rounded-[22px] border p-5 shadow-[0_24px_80px_rgba(0,0,0,.16)] sm:p-6 ${channel.connected ? "border-violet-400/20 bg-violet-500/[0.055]" : "border-white/[0.07] bg-white/[0.03]"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5"><PlatformBrandIcon platform={channel.platform === "vk" ? "VK" : channel.platform === "vcru" ? "VC.ru" : channel.platform === "ok" ? "Одноклассники" : "Telegram"} size="sm" /><div><p className="text-lg font-semibold tracking-[-0.025em] text-white">{channel.label}</p><p className="mt-1 text-xs leading-5 text-white/30">{channel.description}</p></div></div>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-semibold ${channel.connected ? "bg-violet-500/15 text-violet-200" : "bg-white/[0.05] text-white/32"}`}>{channel.connected ? "подключено" : "не подключено"}</span>
          </div>

          {channel.connected ? <div className="mt-5 rounded-2xl border border-violet-400/12 bg-black/15 p-4"><div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-violet-500/15 text-[10px] text-violet-200">✓</span><p className="text-xs font-semibold text-white/70">{channel.title || channel.reference}</p></div><p className="mt-2 text-[10px] text-white/28">{channel.credentialHint ? `Доступ сохранён: ${channel.credentialHint}` : "Соединение проверено и готово к публикации"}</p></div> : <div className="mt-5 rounded-2xl border border-white/[0.05] bg-black/10 px-4 py-3"><p className="text-[10px] leading-4 text-white/28">Можно пропустить сейчас. Тексты и визуалы всё равно будут созданы в кабинете.</p></div>}

          <form action={channel.platform === "vk" && channel.oauthAvailable && !channel.connected ? "/api/integrations/vk/connect" : channel.platform === "ok" && channel.oauthAvailable ? "/api/integrations/ok/connect" : connectSelfServiceSocialChannel} method={(channel.platform === "vk" && channel.oauthAvailable && !channel.connected) || (channel.platform === "ok" && channel.oauthAvailable) ? "get" : undefined} className="mt-5 space-y-3">
            <input type="hidden" name="platform" value={channel.platform} />
            {onboarding ? <input type="hidden" name="onboarding" value="1" /> : null}
            {channel.platform === "vcru" ? <>
              <div className="rounded-xl border border-violet-400/10 bg-violet-500/[0.05] px-3.5 py-3 text-[10px] leading-4 text-white/35">Войдите один раз. Ribes сохранит только зашифрованный доступ к публикациям — пароль не сохраняется.</div>
              <label className="grid gap-1.5"><span className="text-[10px] font-semibold text-white/42">Почта VC.ru</span><input type="email" name="vcEmail" required={!channel.tokenAvailable} autoComplete="username" placeholder={channel.tokenAvailable ? channel.credentialHint || "Подключена" : "name@example.ru"} className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-white/75 outline-none transition placeholder:text-white/18 focus:border-violet-400/40" /></label>
              <label className="grid gap-1.5"><span className="text-[10px] font-semibold text-white/42">Пароль VC.ru</span><input type="password" name="vcPassword" required={!channel.tokenAvailable} autoComplete="current-password" placeholder={channel.tokenAvailable ? "Не нужен для проверки" : "Введите пароль"} className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-white/75 outline-none transition placeholder:text-white/18 focus:border-violet-400/40" /></label>
            </> : <>
              {channel.platform === "vk" ? <div className="rounded-2xl border border-[#2787F5]/25 bg-[#2787F5]/[0.08] p-4 sm:p-5">
                <p className="text-sm font-semibold text-white/85">Сначала откройте VK по синей кнопке</p>
                <p className="mt-1 text-[10px] leading-4 text-white/38">Откроется список сообществ, которыми вы управляете. Выберите то, куда Ribes должен публиковать.</p>
                <Link href="https://vk.com/groups?tab=admin" target="_blank" className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#2787F5] px-4 py-3 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(39,135,245,.25)] transition hover:brightness-110">1. Открыть мои сообщества VK →</Link>
                <div className="mt-4 grid gap-2">
                  {[
                    ["2", "Откройте нужное сообщество", "Нажмите на название или аватар сообщества."],
                    ["3", "Нажмите «Управление»", "Кнопка находится на странице сообщества."],
                    ["4", "Откройте «Дополнительно»", "В меню управления сначала раскройте этот раздел."],
                    ["5", "Выберите «Работа с API»", "Затем откройте «Ключи доступа» и нажмите «Создать ключ»."],
                  ].map(([number, title, hint]) => <div key={number} className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2787F5]/20 text-[10px] font-bold text-[#8bc2ff]">{number}</span><div><p className="text-[11px] font-semibold text-white/65">{title}</p><p className="mt-0.5 text-[9px] leading-4 text-white/28">{hint}</p></div></div>)}
                </div>
                <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3">
                  <p className="text-[10px] font-semibold text-emerald-200/80">При создании ключа включите три пункта:</p>
                  <div className="mt-2 flex flex-wrap gap-2">{["Управление сообществом", "Фотографии", "Стена"].map((permission) => <span key={permission} className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2.5 py-1 text-[9px] text-emerald-100/65">✓ {permission}</span>)}</div>
                  <p className="mt-2 text-[9px] leading-4 text-white/25">Если пункта «Стена» нет, включите управление и фотографии — Ribes проверит доступ автоматически.</p>
                </div>
                <p className="mt-3 text-[10px] leading-4 text-white/38"><span className="font-semibold text-white/60">6.</span> Скопируйте появившийся ключ, вернитесь сюда и вставьте его в поле ниже.</p>
              </div> : null}
              {channel.platform === "telegram" && channel.tokenAvailable && channel.credentialHint ? <div className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.06] p-4"><p className="text-xs font-semibold text-white/70">1. Добавьте бота в канал</p><p className="mt-1 text-[10px] leading-4 text-white/30">Telegram сам предложит выбрать канал и выдаст боту право публиковать.</p><Link href={`https://t.me/${channel.credentialHint.replace(/^@/, "")}?startchannel&admin=post_messages+edit_messages+delete_messages`} target="_blank" className="mt-3 inline-flex rounded-xl bg-[#229ED9] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:brightness-110">Добавить {channel.credentialHint}</Link></div> : null}
              <label className="grid gap-1.5"><span className="text-[10px] font-semibold text-white/42">{channel.platform === "telegram" ? "Адрес канала" : channel.platform === "ok" ? "Ссылка на группу" : "Ссылка на сообщество"}</span><input name="reference" required defaultValue={channel.reference} placeholder={channel.referencePlaceholder} className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-white/75 outline-none transition placeholder:text-white/18 focus:border-violet-400/40" /></label>
              {channel.platform === "vk" ? <label className="grid gap-1.5"><span className="text-[10px] font-semibold text-white/42">Ключ сообщества</span><input type="password" name="token" required autoComplete="off" placeholder={channel.tokenPlaceholder} className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-white/75 outline-none transition placeholder:text-white/18 focus:border-violet-400/40" /><span className="text-[9px] leading-4 text-white/22">Ключ хранится зашифрованно. Ribes не показывает его после сохранения.</span></label> : !channel.tokenAvailable && channel.platform !== "ok" ? <details className="rounded-xl border border-white/[0.06] bg-black/10 p-3"><summary className="cursor-pointer text-[10px] font-semibold text-white/35">Дополнительная настройка</summary><label className="mt-3 grid gap-1.5"><span className="text-[10px] font-semibold text-white/42">Ключ бота</span><input type="password" name="token" required autoComplete="off" placeholder={channel.tokenPlaceholder} className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs text-white/75 outline-none transition placeholder:text-white/18 focus:border-violet-400/40" /></label></details> : <input type="hidden" name="token" value="" />}
            </>}
            <label className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-black/10 px-3.5 py-3"><input type="checkbox" name="autopublishEnabled" defaultChecked={channel.autopublishEnabled || onboarding} className="h-4 w-4 accent-violet-500" /><span><span className="block text-xs font-medium text-white/60">Публиковать после подтверждения</span><span className="mt-0.5 block text-[9px] text-white/24">Ничего не выйдет без вашего нажатия «Готово»</span></span></label>
            <button disabled={channel.approvalPending} className="w-full rounded-xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/30">{channel.platform === "vk" ? "Проверить и включить VK" : channel.connected ? "Проверить и обновить" : channel.approvalPending ? "Ожидаем одобрение ОК" : channel.platform === "ok" && channel.oauthAvailable ? "Войти через Одноклассники" : "Подключить"}</button>
          </form>

          {channel.connected && channel.id ? <form action={disconnectSelfServiceSocialChannel} className="mt-3"><input type="hidden" name="channelRecordId" value={channel.id} />{onboarding ? <input type="hidden" name="onboarding" value="1" /> : null}<button className="w-full py-2 text-[10px] font-medium text-white/22 transition hover:text-rose-300">Отключить площадку</button></form> : null}
        </article>
      ))}
    </div>
  );
}
