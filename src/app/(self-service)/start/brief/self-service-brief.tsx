"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SELF_SERVICE_ARTICLE_RHYTHMS,
  SELF_SERVICE_FORMATS,
  SELF_SERVICE_POST_RHYTHMS,
  type SelfServiceSelection,
} from "@/lib/self-service/product";
import { stageSelfServiceOnboarding } from "@/lib/self-service/onboarding-actions";

type BriefValues = {
  brandName: string;
  website: string;
  businessDescription: string;
  priorityOffer: string;
  audience: string;
  tone: string;
  keyMessage: string;
  restrictions: string;
  monthGoal: string;
  monthTopics: string;
  telegramUrl: string;
  vkUrl: string;
  okUrl: string;
  instagramUrl: string;
  dzenUrl: string;
  vcruUrl: string;
  otherSocialUrls: string;
  starterKitPlatformIds: string[];
  brandColors: string;
  fonts: string;
  visualStyle: string;
  likedVisualReferences: string;
  dislikedVisualReferences: string;
  logoUrl: string;
  brandbookUrl: string;
};

const EMPTY_BRIEF: BriefValues = {
  brandName: "",
  website: "",
  businessDescription: "",
  priorityOffer: "",
  audience: "",
  tone: "Спокойно и экспертно",
  keyMessage: "",
  restrictions: "",
  monthGoal: "",
  monthTopics: "",
  telegramUrl: "",
  vkUrl: "",
  okUrl: "",
  instagramUrl: "",
  dzenUrl: "",
  vcruUrl: "",
  otherSocialUrls: "",
  starterKitPlatformIds: [],
  brandColors: "",
  fonts: "",
  visualStyle: "",
  likedVisualReferences: "",
  dislikedVisualReferences: "",
  logoUrl: "",
  brandbookUrl: "",
};

const BRIEF_STORAGE_KEY = "adaptive-presence:brief-draft:v1";

const toneOptions = [
  ["Спокойно и экспертно", "Уверенно, понятно, без громких обещаний"],
  ["Тепло и по-человечески", "Дружелюбно, заботливо и без канцелярита"],
  ["Смело и энергично", "Быстрый темп, яркие формулировки, больше характера"],
  ["Сдержанно и премиально", "Коротко, точно, с ощущением высокого качества"],
] as const;

const socialFields = [
  ["telegramUrl", "Telegram", "https://t.me/..."],
  ["vkUrl", "VK", "https://vk.com/..."],
  ["okUrl", "Одноклассники", "https://ok.ru/..."],
  ["instagramUrl", "Instagram", "https://instagram.com/..."],
  ["dzenUrl", "Дзен", "https://dzen.ru/..."],
  ["vcruUrl", "VC.ru", "https://vc.ru/..."],
] as const;

const starterKitPlatforms = [
  ["telegram", "Telegram"],
  ["vk", "VK"],
  ["ok", "Одноклассники"],
  ["instagram", "Instagram"],
  ["dzen", "Дзен"],
  ["vcru", "VC.ru"],
] as const;

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{label}</span>
        {hint ? <span className="text-[11px] font-medium text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white px-4 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1.5 whitespace-pre-line text-sm font-medium leading-6 text-slate-800">{value || "Не указано"}</p>
    </div>
  );
}

export function SelfServiceBrief({ selection }: { selection: SelfServiceSelection }) {
  const [storageReady, setStorageReady] = useState(false);
  const [values, setValues] = useState<BriefValues>(EMPTY_BRIEF);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BRIEF_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<keyof BriefValues, unknown>>;
        const restored = { ...EMPTY_BRIEF };
        for (const key of Object.keys(EMPTY_BRIEF) as Array<keyof BriefValues>) {
          if (key === "starterKitPlatformIds") {
            if (Array.isArray(parsed[key])) restored[key] = parsed[key].filter((value): value is string => typeof value === "string");
          } else if (typeof parsed[key] === "string") {
            restored[key] = parsed[key];
          }
        }
        setValues(restored);
      }
    } catch {
      window.localStorage.removeItem(BRIEF_STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(BRIEF_STORAGE_KEY, JSON.stringify(values));
  }, [storageReady, values]);

  const selectedFormats = useMemo(
    () => SELF_SERVICE_FORMATS.filter((format) => selection.formatIds.includes(format.id)),
    [selection.formatIds],
  );
  const postRhythm = SELF_SERVICE_POST_RHYTHMS.find((rhythm) => rhythm.id === selection.postRhythmId)!;
  const articleRhythm = SELF_SERVICE_ARTICLE_RHYTHMS.find((rhythm) => rhythm.id === selection.articleRhythmId)!;
  const visualFoundation = values.visualStyle || values.brandbookUrl;
  const requiredFields = [values.brandName, values.businessDescription, values.priorityOffer, values.audience, visualFoundation];
  const completedRequired = requiredFields.filter((value) => value.trim()).length;
  const canPreview = completedRequired === requiredFields.length;
  const progress = showPreview ? 75 : 50;

  const update = <Key extends keyof BriefValues>(key: Key, value: BriefValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setConfirmed(false);
  };

  if (showPreview) {
    return (
      <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.15),transparent_38%),radial-gradient(circle_at_84%_10%,rgba(196,181,253,0.20),transparent_34%)]" />
        <div className="relative mx-auto max-w-[1040px]">
          <header className="flex items-center justify-between gap-4 rounded-[24px] border border-white/80 bg-white/75 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur-xl sm:px-5">
            <a href="/start" className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-xs font-extrabold lowercase text-white">cc.</div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Adaptive Presence</p>
                <p className="text-[11px] font-medium text-slate-400">by Creative Command</p>
              </div>
            </a>
            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">75%</span>
          </header>

          <section className="py-9 sm:py-12">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-violet-600">Шаг 3 из 4</p>
              <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">Вот как мы поняли ваш бренд</h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">Проверьте основу. Именно на неё будут опираться темы, тексты, статьи и визуалы.</p>
            </div>

            <div className="mt-8 rounded-[30px] border border-white/90 bg-white/90 p-5 shadow-[0_30px_100px_rgba(77,61,112,0.11)] sm:p-7">
              <div className="rounded-[24px] bg-slate-950 px-5 py-6 text-white sm:px-7">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Профиль бренда</p>
                <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em]">{values.brandName}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{values.businessDescription}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedFormats.map((format) => (
                    <span key={format.id} className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">{format.shortLabel}</span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryItem label="Главный продукт" value={values.priorityOffer} />
                <SummaryItem label="Аудитория" value={values.audience} />
                <SummaryItem label="Тон бренда" value={values.tone} />
                <SummaryItem label="Главная мысль" value={values.keyMessage} />
                <SummaryItem label="Цель месяца" value={values.monthGoal} />
                <SummaryItem label="Темы месяца" value={values.monthTopics} />
                <SummaryItem label="Визуальный характер" value={values.visualStyle || (values.brandbookUrl ? "Определим по брендбуку" : "")} />
                <SummaryItem label="Площадки" value={socialFields.filter(([key]) => values[key]).map(([, label]) => label).join(", ")} />
              </div>

              {values.restrictions ? (
                <div className="mt-3 rounded-[20px] border border-amber-200/80 bg-amber-50/70 px-4 py-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Что нельзя использовать</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-amber-950">{values.restrictions}</p>
                </div>
              ) : null}

              <div className="mt-4 rounded-[20px] border border-violet-100 bg-violet-50/60 px-4 py-3.5">
                <p className="text-xs font-semibold text-violet-900">Ритм: {postRhythm.label.toLowerCase()} · {articleRhythm.label.toLowerCase()}</p>
                <p className="mt-1 text-xs leading-5 text-violet-700">Каждая тема будет адаптирована под выбранную площадку, а не скопирована одинаковым текстом.</p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => setShowPreview(false)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700">Вернуться и поправить</button>
                <form action={stageSelfServiceOnboarding} onSubmit={() => setConfirmed(true)}>
                  <input type="hidden" name="formatIds" value={selection.formatIds.join(",")} />
                  <input type="hidden" name="postRhythmId" value={selection.postRhythmId} />
                  <input type="hidden" name="articleRhythmId" value={selection.articleRhythmId} />
                  {Object.entries(values).filter(([key]) => key !== "starterKitPlatformIds").map(([key, value]) => (
                    <input key={key} type="hidden" name={key} value={String(value)} />
                  ))}
                  {values.starterKitPlatformIds.map((platform) => (
                    <input key={platform} type="hidden" name="starterKitPlatformIds" value={platform} />
                  ))}
                  <button type="submit" className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700">Сохранить и продолжить</button>
                </form>
              </div>

              {confirmed ? (
                <div role="status" className="mt-4 rounded-[20px] border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium leading-6 text-violet-950">
                  Сохраняем профиль и переходим к безопасному входу по email…
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.15),transparent_38%),radial-gradient(circle_at_84%_10%,rgba(196,181,253,0.20),transparent_34%)]" />
      <div className="relative mx-auto max-w-[1120px]">
        <header className="flex items-center justify-between gap-4 rounded-[24px] border border-white/80 bg-white/75 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur-xl sm:px-5">
          <a href="/start" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-xs font-extrabold lowercase text-white">cc.</div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Adaptive Presence</p>
              <p className="text-[11px] font-medium text-slate-400">by Creative Command</p>
            </div>
          </a>
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">{progress}%</span>
        </header>

        <section className="grid gap-7 py-9 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8 lg:py-12">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (canPreview) setShowPreview(true);
            }}
            className="rounded-[30px] border border-white/90 bg-white/90 p-5 shadow-[0_30px_100px_rgba(77,61,112,0.11)] sm:p-7"
          >
            <div className="border-b border-slate-100 pb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Шаг 2 из 4</p>
              <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Расскажите самое важное</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Не нужен маркетинговый документ. Пишите обычными словами — систему и структуру мы соберём сами.</p>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Название компании или бренда">
                <input required value={values.brandName} onChange={(event) => update("brandName", event.target.value)} placeholder="Например: Северная клиника" className={inputClass} />
              </Field>
              <Field label="Сайт" hint="необязательно">
                <input value={values.website} onChange={(event) => update("website", event.target.value)} placeholder="https://..." className={inputClass} />
              </Field>
            </div>

            <section className="mt-7 border-t border-slate-100 pt-6">
              <div>
                <p className="text-sm font-semibold text-slate-900">Где бренд уже присутствует?</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Добавьте ссылки — они станут частью профиля бренда и позже помогут подключить публикации.</p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {socialFields.map(([key, label, placeholder]) => (
                  <Field key={key} label={label} hint="необязательно">
                    <input type="url" value={values[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} className={inputClass} />
                  </Field>
                ))}
                <Field label="Другие площадки" hint="необязательно">
                  <textarea rows={2} value={values.otherSocialUrls} onChange={(event) => update("otherSocialUrls", event.target.value)} placeholder="Ссылки на остальные площадки — каждая с новой строки" className={`${inputClass} resize-y`} />
                </Field>
              </div>

              <div className="mt-5 rounded-[22px] border border-violet-100 bg-violet-50/55 p-4">
                <p className="text-xs font-semibold text-violet-950">Какие площадки нужно оформить с нуля?</p>
                <p className="mt-1 text-xs leading-5 text-violet-700">Подготовим стартовый комплект: аватар, обложку и базовые рубрики в корректных размерах.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {starterKitPlatforms.map(([id, label]) => {
                    const selected = values.starterKitPlatformIds.includes(id);
                    return (
                      <button key={id} type="button" onClick={() => update("starterKitPlatformIds", selected ? values.starterKitPlatformIds.filter((value) => value !== id) : [...values.starterKitPlatformIds, id])} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selected ? "border-violet-300 bg-white text-violet-700" : "border-transparent bg-white/65 text-slate-500 hover:text-violet-700"}`}>
                        {selected ? "✓ " : "+ "}{label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="mt-7 border-t border-slate-100 pt-6">
              <div>
                <p className="text-sm font-semibold text-slate-900">Визуальная система бренда</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Эти правила будут передаваться в каждую генерацию, чтобы материалы выглядели как одна система.</p>
              </div>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Field label="Фирменные цвета" hint="необязательно">
                  <input value={values.brandColors} onChange={(event) => update("brandColors", event.target.value)} placeholder="Например: #6D4AFF, молочный, графитовый" className={inputClass} />
                </Field>
                <Field label="Шрифты" hint="необязательно">
                  <input value={values.fonts} onChange={(event) => update("fonts", event.target.value)} placeholder="Основной, дополнительный, акцентный" className={inputClass} />
                </Field>
                <Field label="Ссылка на логотип" hint="необязательно">
                  <input type="url" value={values.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="Google Drive, Dropbox или прямая ссылка" className={inputClass} />
                </Field>
                <Field label="Ссылка на брендбук" hint="необязательно">
                  <input type="url" value={values.brandbookUrl} onChange={(event) => update("brandbookUrl", event.target.value)} placeholder="PDF в облаке или прямая ссылка" className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Как должны выглядеть материалы?" hint="обязательно, если нет брендбука">
                    <textarea rows={3} value={values.visualStyle} onChange={(event) => update("visualStyle", event.target.value)} placeholder="Фотостиль, композиция, настроение, графика, 3D, минимализм — обычными словами" className={`${inputClass} resize-y`} />
                  </Field>
                </div>
                <Field label="Что визуально нравится" hint="ссылки или описание">
                  <textarea rows={3} value={values.likedVisualReferences} onChange={(event) => update("likedVisualReferences", event.target.value)} placeholder="Примеры, бренды, публикации, стили" className={`${inputClass} resize-y`} />
                </Field>
                <Field label="Что точно не нравится" hint="необязательно">
                  <textarea rows={3} value={values.dislikedVisualReferences} onChange={(event) => update("dislikedVisualReferences", event.target.value)} placeholder="Цвета, стили, приёмы, которых нужно избегать" className={`${inputClass} resize-y`} />
                </Field>
              </div>
            </section>

            <div className="mt-5 grid gap-5">
              <Field label="Чем вы занимаетесь?" hint="1–3 предложения">
                <textarea required rows={3} value={values.businessDescription} onChange={(event) => update("businessDescription", event.target.value)} placeholder="Что делает компания и какую проблему клиента решает?" className={`${inputClass} resize-y`} />
              </Field>
              <Field label="Что продвигаем в первую очередь?">
                <textarea required rows={3} value={values.priorityOffer} onChange={(event) => update("priorityOffer", event.target.value)} placeholder="Главный продукт, услуга или направление, которое должно получать больше внимания" className={`${inputClass} resize-y`} />
              </Field>
              <Field label="Кто ваш клиент?">
                <textarea required rows={3} value={values.audience} onChange={(event) => update("audience", event.target.value)} placeholder="Кто эти люди, что для них важно и почему они выбирают вас?" className={`${inputClass} resize-y`} />
              </Field>
            </div>

            <fieldset className="mt-7 border-t border-slate-100 pt-6">
              <legend className="text-sm font-semibold text-slate-900">Как должен звучать бренд?</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {toneOptions.map(([title, description]) => (
                  <button key={title} type="button" onClick={() => update("tone", title)} aria-pressed={values.tone === title} className={`rounded-[20px] border p-4 text-left transition ${values.tone === title ? "border-violet-300 bg-violet-50/80 ring-2 ring-violet-100" : "border-slate-200 bg-white hover:border-violet-200"}`}>
                    <span className="block text-sm font-semibold text-slate-900">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Главная мысль бренда" hint="необязательно">
                <textarea rows={3} value={values.keyMessage} onChange={(event) => update("keyMessage", event.target.value)} placeholder="Что клиент должен запомнить о вас?" className={`${inputClass} resize-y`} />
              </Field>
              <Field label="Что нельзя писать" hint="необязательно">
                <textarea rows={3} value={values.restrictions} onChange={(event) => update("restrictions", event.target.value)} placeholder="Запретные темы, обещания, слова или юридические ограничения" className={`${inputClass} resize-y`} />
              </Field>
              <Field label="Главная цель этого месяца" hint="необязательно">
                <textarea rows={3} value={values.monthGoal} onChange={(event) => update("monthGoal", event.target.value)} placeholder="Запуск, продажи, доверие, узнаваемость, новое направление..." className={`${inputClass} resize-y`} />
              </Field>
              <Field label="О чём точно нужно рассказать" hint="необязательно">
                <textarea rows={3} value={values.monthTopics} onChange={(event) => update("monthTopics", event.target.value)} placeholder="События, темы, продукты или вопросы клиентов" className={`${inputClass} resize-y`} />
              </Field>
            </div>

            <div className="mt-7 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-400">Обязательные поля: {completedRequired} из {requiredFields.length}</p>
              <button type="submit" disabled={!canPreview} className="rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Показать профиль бренда</button>
            </div>
          </form>

          <aside className="grid gap-4 lg:sticky lg:top-7">
            <div className="rounded-[24px] border border-white/90 bg-white/80 p-5 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-violet-600">Ваш набор</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedFormats.map((format) => (
                  <span key={format.id} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">{format.shortLabel}</span>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
                <p className="font-semibold text-slate-800">{postRhythm.label}</p>
                <p>{articleRhythm.label}</p>
              </div>
            </div>
            <div className="rounded-[24px] bg-slate-950 p-5 text-white shadow-[0_20px_65px_rgba(15,23,42,0.14)]">
              <p className="text-sm font-semibold">Что будет дальше</p>
              <ol className="mt-4 grid gap-3 text-xs leading-5 text-slate-300">
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 font-semibold text-white">1</span><span>Покажем короткий профиль бренда для проверки.</span></li>
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 font-semibold text-white">2</span><span>Соберём темы и календарь на месяц.</span></li>
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 font-semibold text-white">3</span><span>Постепенно подготовим тексты, статьи и визуалы.</span></li>
              </ol>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
