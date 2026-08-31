"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { SelfServiceSelection } from "@/lib/self-service/product";
import { stageSelfServiceOnboarding } from "@/lib/self-service/onboarding-actions";
import { RibesBrand } from "@/app/(self-service)/ribes-brand";

type BriefValues = {
  brandName: string; website: string; businessDescription: string; priorityOffer: string;
  audience: string; tone: string; keyMessage: string; restrictions: string; monthGoal: string; monthTopics: string;
  telegramUrl: string; vkUrl: string; okUrl: string; instagramUrl: string; dzenUrl: string; vcruUrl: string; otherSocialUrls: string;
  starterKitPlatformIds: string[]; brandColors: string; fonts: string; visualStyle: string;
  likedVisualReferences: string; dislikedVisualReferences: string; logoUrl: string; brandbookUrl: string;
};

const EMPTY_BRIEF: BriefValues = {
  brandName: "", website: "", businessDescription: "", priorityOffer: "", audience: "",
  tone: "Спокойно и экспертно", keyMessage: "", restrictions: "", monthGoal: "", monthTopics: "",
  telegramUrl: "", vkUrl: "", okUrl: "", instagramUrl: "", dzenUrl: "", vcruUrl: "", otherSocialUrls: "",
  starterKitPlatformIds: [], brandColors: "", fonts: "", visualStyle: "", likedVisualReferences: "",
  dislikedVisualReferences: "", logoUrl: "", brandbookUrl: "",
};

const BRIEF_STORAGE_KEY = "adaptive-presence:brief-draft:v1";
const BRIEF_STEP_STORAGE_KEY = "adaptive-presence:brief-step:v1";
const steps = ["Бренд", "Аудитория", "Стиль", "Площадки", "Проверка"];
const toneOptions = [
  ["Спокойно и экспертно", "Уверенно, понятно, без громких обещаний"],
  ["Тепло и по-человечески", "Дружелюбно и без канцелярита"],
  ["Смело и энергично", "Быстрый темп и больше характера"],
  ["Сдержанно и премиально", "Коротко, точно и уверенно"],
] as const;
const socialFields = [
  ["telegramUrl", "Telegram", "https://t.me/..."], ["vkUrl", "VK", "https://vk.com/..."],
  ["okUrl", "Одноклассники", "https://ok.ru/..."], ["dzenUrl", "Дзен", "https://dzen.ru/..."],
  ["vcruUrl", "VC.ru", "https://vc.ru/..."],
] as const;
const starterKitPlatforms = [["telegram", "Telegram"], ["vk", "VK"], ["ok", "Одноклассники"], ["dzen", "Дзен"], ["vcru", "VC.ru"]] as const;
const inputClass = "w-full rounded-2xl border border-white/[.09] bg-white/[.045] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/70 focus:bg-white/[.065] focus:ring-4 focus:ring-violet-500/10";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-2"><span className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-semibold text-slate-200">{label}</span>{hint ? <span className="text-[11px] text-slate-600">{hint}</span> : null}</span>{children}</label>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/[.08] bg-white/[.035] px-4 py-3.5"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-1.5 whitespace-pre-line text-sm font-medium leading-6 text-slate-200">{value || "Не указано"}</p></div>;
}

function CreateCabinetButton({ confirmed }: { confirmed: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!confirmed || pending}
      className="w-full rounded-full bg-violet-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Создаём кабинет…" : "Создать кабинет"}
    </button>
  );
}

export function SelfServiceBrief({ selection }: { selection: SelfServiceSelection }) {
  const [storageReady, setStorageReady] = useState(false);
  const [values, setValues] = useState<BriefValues>(EMPTY_BRIEF);
  const [currentStep, setCurrentStep] = useState(1);
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
          } else if (typeof parsed[key] === "string") restored[key] = parsed[key];
        }
        setValues(restored);
      }
      const savedStep = Number(window.localStorage.getItem(BRIEF_STEP_STORAGE_KEY));
      if (savedStep >= 1 && savedStep <= steps.length) setCurrentStep(savedStep);
    } catch {
      window.localStorage.removeItem(BRIEF_STORAGE_KEY);
      window.localStorage.removeItem(BRIEF_STEP_STORAGE_KEY);
    } finally { setStorageReady(true); }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(BRIEF_STORAGE_KEY, JSON.stringify(values));
    window.localStorage.setItem(BRIEF_STEP_STORAGE_KEY, String(currentStep));
  }, [storageReady, values, currentStep]);

  const visualFoundation = values.visualStyle || values.brandbookUrl;
  const canContinue = useMemo(() => {
    if (currentStep === 1) return Boolean(values.brandName.trim() && values.businessDescription.trim() && values.priorityOffer.trim());
    if (currentStep === 2) return Boolean(values.audience.trim());
    if (currentStep === 3) return Boolean(visualFoundation.trim());
    return true;
  }, [currentStep, values, visualFoundation]);
  const update = <Key extends keyof BriefValues>(key: Key, value: BriefValues[Key]) => { setValues((current) => ({ ...current, [key]: value })); setConfirmed(false); };
  const goNext = () => { if (canContinue) setCurrentStep((step) => Math.min(steps.length, step + 1)); };
  const goBack = () => setCurrentStep((step) => Math.max(1, step - 1));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09090d] px-4 py-5 text-white sm:px-7 sm:py-7 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_18%_0%,rgba(124,92,255,.18),transparent_38%),radial-gradient(circle_at_85%_12%,rgba(77,208,168,.05),transparent_28%)]" />
      <div className="relative mx-auto max-w-[1040px]">
        <header className="flex items-center justify-between border-b border-white/[.08] py-3"><a href="/start"><RibesBrand dark /></a><span className="text-xs font-semibold text-slate-500">Шаг {currentStep} из {steps.length}</span></header>
        <section className="py-8 sm:py-12"><div className="mx-auto max-w-[820px]">
          <div className="grid grid-cols-5 gap-2" aria-label={`Шаг ${currentStep} из ${steps.length}`}>{steps.map((step, index) => <span key={step} className={`h-1 rounded-full transition ${index < currentStep ? "bg-violet-500" : "bg-white/10"}`} />)}</div>
          <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[.1em] text-slate-600">{steps.map((step, index) => <span key={step} className={index + 1 === currentStep ? "text-violet-300" : "hidden sm:block"}>{step}</span>)}</div>
          <div className="mt-8 rounded-[30px] border border-white/[.09] bg-[#101015]/95 p-5 shadow-[0_28px_100px_rgba(0,0,0,.36)] sm:p-8">
            {currentStep === 1 ? <>
              <h1 className="font-heading text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Сначала — о вашем бренде</h1><p className="mt-3 text-sm leading-6 text-slate-400">Этой основы хватит, чтобы система поняла бизнес и не писала обезличенные материалы.</p>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <Field label="Название бренда"><input className={inputClass} value={values.brandName} onChange={(e) => update("brandName", e.target.value)} placeholder="Например, Северная студия" /></Field>
                <Field label="Сайт" hint="если есть"><input className={inputClass} value={values.website} onChange={(e) => update("website", e.target.value)} placeholder="https://..." /></Field>
                <div className="sm:col-span-2"><Field label="Чем занимается компания"><textarea className={`${inputClass} min-h-28 resize-y`} value={values.businessDescription} onChange={(e) => update("businessDescription", e.target.value)} placeholder="Что вы делаете и какую задачу клиента решаете" /></Field></div>
                <div className="sm:col-span-2"><Field label="Что продвигаем в первую очередь"><textarea className={`${inputClass} min-h-24 resize-y`} value={values.priorityOffer} onChange={(e) => update("priorityOffer", e.target.value)} placeholder="Главный продукт, услуга или направление" /></Field></div>
              </div>
            </> : null}
            {currentStep === 2 ? <>
              <h1 className="font-heading text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Кому и как мы говорим</h1><p className="mt-3 text-sm leading-6 text-slate-400">Опишите клиента своими словами. Профессиональная формулировка не нужна.</p>
              <div className="mt-7 grid gap-5">
                <Field label="Кто ваш клиент"><textarea className={`${inputClass} min-h-28 resize-y`} value={values.audience} onChange={(e) => update("audience", e.target.value)} placeholder="Кто покупает, что для него важно и чего он опасается" /></Field>
                <Field label="Тон общения"><div className="grid gap-3 sm:grid-cols-2">{toneOptions.map(([title, description]) => <button type="button" key={title} onClick={() => update("tone", title)} className={`rounded-2xl border p-4 text-left transition ${values.tone === title ? "border-violet-400/70 bg-violet-500/10" : "border-white/[.08] bg-white/[.025] hover:bg-white/[.045]"}`}><span className="block text-sm font-semibold text-slate-100">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></button>)}</div></Field>
                <div className="grid gap-5 sm:grid-cols-2"><Field label="Главная мысль" hint="необязательно"><textarea className={`${inputClass} min-h-24 resize-y`} value={values.keyMessage} onChange={(e) => update("keyMessage", e.target.value)} placeholder="Что аудитория должна запомнить" /></Field><Field label="Что нельзя писать" hint="необязательно"><textarea className={`${inputClass} min-h-24 resize-y`} value={values.restrictions} onChange={(e) => update("restrictions", e.target.value)} placeholder="Запреты, обещания, темы" /></Field></div>
                <div className="grid gap-5 sm:grid-cols-2"><Field label="Цель на месяц" hint="необязательно"><input className={inputClass} value={values.monthGoal} onChange={(e) => update("monthGoal", e.target.value)} placeholder="Например, рассказать о новом направлении" /></Field><Field label="Темы месяца" hint="необязательно"><input className={inputClass} value={values.monthTopics} onChange={(e) => update("monthTopics", e.target.value)} placeholder="Запуск, кейсы, команда" /></Field></div>
              </div>
            </> : null}
            {currentStep === 3 ? <>
              <h1 className="font-heading text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Как должен выглядеть бренд</h1><p className="mt-3 text-sm leading-6 text-slate-400">Можно дать ссылку на брендбук или коротко описать визуальное направление.</p>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <Field label="Визуальный стиль"><textarea className={`${inputClass} min-h-28 resize-y`} value={values.visualStyle} onChange={(e) => update("visualStyle", e.target.value)} placeholder="Цвета, настроение, композиция, характер изображений" /></Field>
                <Field label="Ссылка на брендбук"><input className={inputClass} value={values.brandbookUrl} onChange={(e) => update("brandbookUrl", e.target.value)} placeholder="https://..." /><input className={`${inputClass} mt-3`} value={values.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="Ссылка на логотип" /></Field>
                <Field label="Фирменные цвета" hint="необязательно"><input className={inputClass} value={values.brandColors} onChange={(e) => update("brandColors", e.target.value)} placeholder="#6D4AFF, белый, графит" /></Field><Field label="Шрифты" hint="необязательно"><input className={inputClass} value={values.fonts} onChange={(e) => update("fonts", e.target.value)} placeholder="Названия шрифтов или ссылка" /></Field>
                <Field label="Что нравится" hint="необязательно"><textarea className={`${inputClass} min-h-24 resize-y`} value={values.likedVisualReferences} onChange={(e) => update("likedVisualReferences", e.target.value)} placeholder="Ссылки или описание удачных примеров" /></Field><Field label="Чего избегать" hint="необязательно"><textarea className={`${inputClass} min-h-24 resize-y`} value={values.dislikedVisualReferences} onChange={(e) => update("dislikedVisualReferences", e.target.value)} placeholder="Стили и приёмы, которые не подходят" /></Field>
              </div>
            </> : null}
            {currentStep === 4 ? <>
              <h1 className="font-heading text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Ваши площадки</h1><p className="mt-3 text-sm leading-6 text-slate-400">Добавьте существующие страницы. Если площадки пока нет, отметьте, для какой нужен стартовый набор.</p>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">{socialFields.map(([key, label, placeholder]) => <Field key={key} label={label}><input className={inputClass} value={values[key]} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} /></Field>)}</div>
              <div className="mt-7 border-t border-white/[.08] pt-6"><p className="text-sm font-semibold text-slate-200">Подготовить оформление новой площадки</p><div className="mt-3 flex flex-wrap gap-2">{starterKitPlatforms.map(([id, label]) => { const active = values.starterKitPlatformIds.includes(id); return <button key={id} type="button" onClick={() => update("starterKitPlatformIds", active ? values.starterKitPlatformIds.filter((item) => item !== id) : [...values.starterKitPlatformIds, id])} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${active ? "border-violet-400/70 bg-violet-500/15 text-violet-200" : "border-white/10 text-slate-400 hover:text-white"}`}>{label}</button>; })}</div></div>
            </> : null}
            {currentStep === 5 ? <>
              <h1 className="font-heading text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Проверьте основу</h1><p className="mt-3 text-sm leading-6 text-slate-400">Количество постов, статей и каруселей вы выберете уже в кабинете. Они будут списываться из кредитов по понятной стоимости.</p>
              <div className="mt-7 rounded-[24px] bg-violet-500/10 p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-300">{values.brandName}</p><p className="mt-2 text-sm leading-6 text-slate-300">{values.businessDescription}</p></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><SummaryItem label="Продвигаем" value={values.priorityOffer} /><SummaryItem label="Аудитория" value={values.audience} /><SummaryItem label="Тон" value={values.tone} /><SummaryItem label="Визуальный стиль" value={values.visualStyle || "Берём из брендбука"} /><SummaryItem label="Площадки" value={socialFields.filter(([key]) => values[key]).map(([, label]) => label).join(", ")} /><SummaryItem label="Цель месяца" value={values.monthGoal} /></div>
              <label className="mt-6 flex items-start gap-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-4"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-500" /><span className="text-sm leading-6 text-slate-400">Данные верны. Я смогу изменить их позже в кабинете.</span></label>
              <form action={stageSelfServiceOnboarding} className="mt-5"><input type="hidden" name="selection" value={JSON.stringify(selection)} /><input type="hidden" name="brief" value={JSON.stringify(values)} /><CreateCabinetButton confirmed={confirmed} /></form>
            </> : null}
            <div className="mt-8 flex items-center justify-between border-t border-white/[.08] pt-6"><button type="button" onClick={goBack} disabled={currentStep === 1} className="rounded-full px-5 py-3 text-sm font-semibold text-slate-400 transition hover:text-white disabled:invisible">Назад</button>{currentStep < steps.length ? <button type="button" onClick={goNext} disabled={!canContinue} className="rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-35">Продолжить</button> : null}</div>
          </div>
        </div></section>
      </div>
    </main>
  );
}
