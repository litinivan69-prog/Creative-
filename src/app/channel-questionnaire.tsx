"use client";

import { useState } from "react";

export type ChannelAnswerMode = "have" | "create" | "skip";

export type ChannelPrefill = {
  platform: "vk" | "telegram" | "zen";
  mode: ChannelAnswerMode;
  link: string;
};

const platformMeta: Array<{ key: "vk" | "telegram" | "zen"; label: string; hint: string; placeholder: string }> = [
  { key: "vk", label: "VK", hint: "Сообщество ВКонтакте", placeholder: "https://vk.com/club... или @короткое_имя" },
  { key: "telegram", label: "Telegram", hint: "Канал в Telegram", placeholder: "https://t.me/... или @username" },
  { key: "zen", label: "Дзен", hint: "Канал в Дзене", placeholder: "https://dzen.ru/..." },
];

const modeOptions: Array<{ value: ChannelAnswerMode; label: string; description: string }> = [
  { value: "have", label: "Да, уже есть", description: "Вставьте ссылку — подключим к публикации" },
  { value: "create", label: "Нужно завести", description: "Добавим задачу на обложку и аватар (Launch Kit)" },
  { value: "skip", label: "Не используем", description: "Площадка не нужна этому клиенту" },
];

/**
 * Big chat-assistant-style questionnaire: «есть канал?» per platform.
 * Emits plain form fields (channel_{platform}_mode / _link) — the server
 * action does the actual persistence.
 */
export function ChannelQuestionnaire({ prefill }: { prefill: ChannelPrefill[] }) {
  const [answers, setAnswers] = useState<Record<string, { mode: ChannelAnswerMode; link: string }>>(() => {
    const initial: Record<string, { mode: ChannelAnswerMode; link: string }> = {};
    for (const meta of platformMeta) {
      const existing = prefill.find((entry) => entry.platform === meta.key);
      initial[meta.key] = { mode: existing?.mode ?? "skip", link: existing?.link ?? "" };
    }
    return initial;
  });

  return (
    <div className="grid gap-5">
      {platformMeta.map((meta) => {
        const answer = answers[meta.key];

        return (
          <fieldset key={meta.key} className="rounded-2xl border border-stone-200 bg-white p-5">
            <legend className="sr-only">{meta.label}</legend>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-lg font-bold text-stone-950">Есть {meta.label}?</p>
              <p className="text-xs font-semibold text-stone-400">{meta.hint}</p>
            </div>
            <input type="hidden" name={`channel_${meta.key}_mode`} value={answer.mode} />
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [meta.key]: { ...prev[meta.key], mode: option.value } }))}
                  aria-pressed={answer.mode === option.value}
                  className={`rounded-xl border p-3.5 text-left transition active:scale-[0.99] ${
                    answer.mode === option.value
                      ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                      : "border-stone-200 bg-white hover:border-violet-200"
                  }`}
                >
                  <p className={`text-sm font-bold ${answer.mode === option.value ? "text-violet-800" : "text-stone-800"}`}>{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{option.description}</p>
                </button>
              ))}
            </div>
            {answer.mode === "have" ? (
              <label className="mt-4 grid gap-2 text-sm font-semibold text-stone-700">
                Ссылка или название канала
                <input
                  name={`channel_${meta.key}_link`}
                  value={answer.link}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [meta.key]: { ...prev[meta.key], link: event.target.value } }))}
                  placeholder={meta.placeholder}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-3.5 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />
              </label>
            ) : null}
            {answer.mode === "create" ? (
              <p className="mt-4 rounded-xl bg-[#f7f3fd] px-4 py-3 text-sm font-semibold leading-6 text-violet-800">
                Отметим «завести с нуля»: в план добавится задача на обложку и аватар, а нехватка появится в «Брифе месяца».
              </p>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
