"use client";

import { useState } from "react";
import { saveSelfServiceChannels } from "@/lib/self-service/channel-actions";

type ChannelState = "active" | "to_create" | "inactive";

type ChannelValue = {
  platform: "vk" | "telegram" | "dzen" | "vcru";
  label: string;
  description: string;
  placeholder: string;
  state: ChannelState;
  url: string;
};

const stateOptions: Array<{ id: ChannelState; label: string; description: string }> = [
  { id: "active", label: "Уже есть", description: "Добавлю ссылку на действующую площадку" },
  { id: "to_create", label: "Нужно оформить", description: "Нужны аватар, обложка и стартовая структура" },
  { id: "inactive", label: "Пока не нужно", description: "Вернусь к этой площадке позже" },
];

export function ChannelSetupForm({ initialChannels }: { initialChannels: ChannelValue[] }) {
  const [channels, setChannels] = useState(initialChannels);

  const update = (platform: ChannelValue["platform"], patch: Partial<ChannelValue>) => {
    setChannels((current) => current.map((channel) => (channel.platform === platform ? { ...channel, ...patch } : channel)));
  };

  return (
    <form action={saveSelfServiceChannels} className="mt-7 grid gap-4">
      {channels.map((channel) => (
        <article key={channel.platform} className="rounded-[24px] border border-slate-200/75 bg-white p-5 shadow-[0_14px_45px_rgba(77,61,112,0.05)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-semibold tracking-[-0.025em] text-slate-950">{channel.label}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{channel.description}</p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${channel.state === "to_create" ? "bg-violet-50 text-violet-700" : channel.state === "active" ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-400"}`}>
              {stateOptions.find((option) => option.id === channel.state)?.label}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {stateOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => update(channel.platform, { state: option.id })}
                className={`rounded-2xl border px-4 py-3 text-left transition ${channel.state === option.id ? "border-violet-300 bg-violet-50/70" : "border-slate-200 bg-white hover:border-violet-200"}`}
              >
                <span className={`block text-xs font-semibold ${channel.state === option.id ? "text-violet-800" : "text-slate-700"}`}>{option.label}</span>
                <span className="mt-1 block text-[11px] leading-4 text-slate-400">{option.description}</span>
              </button>
            ))}
          </div>

          {channel.state === "active" ? (
            <label className="mt-4 grid gap-2">
              <span className="text-xs font-semibold text-slate-700">Ссылка на площадку</span>
              <input
                type="url"
                required
                value={channel.url}
                onChange={(event) => update(channel.platform, { url: event.target.value })}
                placeholder={channel.placeholder}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
            </label>
          ) : null}

          <input type="hidden" name={`${channel.platform}State`} value={channel.state} />
          <input type="hidden" name={`${channel.platform}Url`} value={channel.url} />
        </article>
      ))}

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a href="/app" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-600">Вернуться в кабинет</a>
        <button className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(124,58,237,0.22)] transition hover:bg-violet-700">Сохранить и перейти к месяцу</button>
      </div>
    </form>
  );
}
