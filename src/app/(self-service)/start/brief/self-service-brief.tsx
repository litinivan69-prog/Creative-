"use client";

import Link from "next/link";
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
  likedVisualReferences: string; dislikedVisualReferences: string; logoMode: "upload" | "url" | "none"; logoUrl: string; brandbookUrl: string;
};

const EMPTY_BRIEF: BriefValues = {
  brandName: "", website: "", businessDescription: "", priorityOffer: "", audience: "",
  tone: "Спокойно и экспертно", keyMessage: "", restrictions: "", monthGoal: "", monthTopics: "",
  telegramUrl: "", vkUrl: "", okUrl: "", instagramUrl: "", dzenUrl: "", vcruUrl: "", otherSocialUrls: "",
  starterKitPlatformIds: [], brandColors: "", fonts: "", visualStyle: "", likedVisualReferences: "",
  dislikedVisualReferences: "", logoMode: "none", logoUrl: "", brandbookUrl: "",
};

const STORAGE_KEY = "ribes:brief-draft:v2";
const STEP_STORAGE_KEY = "ribes:brief-step:v2";
const stepLabels = ["Сайт", "Название", "Бизнес", "Продукт", "Аудитория", "Тон", "Цель", "Стиль", "Логотип", "Площадки", "Проверка"];
const audienceOptions = ["Частные покупатели", "Владельцы малого бизнеса", "Компании и команды", "Профессионалы отрасли", "Текущие клиенты"];
const goalOptions = ["Получать больше заявок", "Повысить узнаваемость", "Показать экспертность", "Запустить новый продукт", "Вернуть внимание клиентов"];
const visualOptions = ["Чисто и минималистично", "Живо и по-человечески", "Сдержанно и премиально", "Современно и технологично"];
const toneOptions = [
  { title: "Спокойно и экспертно", detail: "Понятно, уверенно, без громких обещаний", example: "Разберём, на что смотреть при выборе и где чаще всего ошибаются." },
  { title: "Тепло и по-человечески", detail: "Дружелюбно и без канцелярита", example: "Собрали простой список, чтобы вам не пришлось разбираться во всём с нуля." },
  { title: "Смело и энергично", detail: "Быстрый темп и больше характера", example: "Хватит откладывать: вот три шага, которые можно сделать уже сегодня." },
  { title: "Сдержанно и премиально", detail: "Коротко, точно и уверенно", example: "Детали определяют результат. Показываем решения, которые выдерживают проверку временем." },
] as const;
const socialFields = [
  ["telegramUrl", "Telegram", "https://t.me/..."], ["vkUrl", "VK", "https://vk.com/..."],
  ["okUrl", "Одноклассники", "https://ok.ru/..."], ["dzenUrl", "Дзен", "https://dzen.ru/..."],
  ["vcruUrl", "VC.ru", "https://vc.ru/..."],
] as const;
const inputClass = "w-full rounded-2xl border border-white/[.09] bg-white/[.045] px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/70 focus:bg-white/[.065] focus:ring-4 focus:ring-violet-500/10";

function CreateButton({ confirmed }: { confirmed: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={!confirmed || pending} className="w-full rounded-full bg-violet-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-35">{pending ? "Создаём кабинет…" : "Создать кабинет"}</button>;
}

function Choice({ active, title, detail, onClick }: { active: boolean; title: string; detail?: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? "border-violet-400/65 bg-violet-500/12 text-white" : "border-white/[.08] bg-white/[.025] text-slate-400 hover:bg-white/[.05] hover:text-white"}`}><span className="block text-sm font-semibold">{title}</span>{detail ? <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span> : null}</button>;
}

export function SelfServiceBrief({ selection, resetDraft = false }: { selection: SelfServiceSelection; resetDraft?: boolean }) {
  const [ready, setReady] = useState(false);
  const [values, setValues] = useState<BriefValues>(EMPTY_BRIEF);
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [importState, setImportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    try {
      if (resetDraft) {
        localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STEP_STORAGE_KEY);
        history.replaceState(null, "", location.pathname);
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setValues({ ...EMPTY_BRIEF, ...(JSON.parse(raw) as Partial<BriefValues>) });
        const savedStep = Number(localStorage.getItem(STEP_STORAGE_KEY));
        if (savedStep >= 1 && savedStep <= stepLabels.length) setStep(savedStep);
      }
    } catch { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STEP_STORAGE_KEY); }
    setReady(true);
  }, [resetDraft]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    localStorage.setItem(STEP_STORAGE_KEY, String(step));
  }, [ready, values, step]);

  const update = <K extends keyof BriefValues>(key: K, value: BriefValues[K]) => { setValues((current) => ({ ...current, [key]: value })); setConfirmed(false); };
  const canContinue = useMemo(() => {
    if (step === 2) return values.brandName.trim().length >= 2;
    if (step === 3) return values.businessDescription.trim().length >= 10;
    if (step === 4) return values.priorityOffer.trim().length >= 3;
    if (step === 5) return Boolean(values.audience.trim());
    if (step === 6) return Boolean(values.tone);
    if (step === 8) return Boolean(values.visualStyle);
    return true;
  }, [step, values]);
  const next = () => { if (canContinue) setStep((current) => Math.min(stepLabels.length, current + 1)); };
  const back = () => setStep((current) => Math.max(1, current - 1));

  const importWebsite = async () => {
    if (!values.website.trim()) return;
    setImportState("loading"); setImportMessage("");
    try {
      const response = await fetch("/api/self-service/brief/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ website: values.website }) });
      const data = await response.json() as { ok?: boolean; error?: string; website?: string; brandName?: string; businessDescription?: string; priorityOffer?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось прочитать сайт.");
      setValues((current) => ({ ...current, website: data.website || current.website, brandName: data.brandName || current.brandName, businessDescription: data.businessDescription || current.businessDescription, priorityOffer: data.priorityOffer || current.priorityOffer }));
      setImportState("done"); setImportMessage("Готово. Следующие ответы уже заполнены — останется только проверить.");
    } catch (error) { setImportState("error"); setImportMessage(error instanceof Error ? error.message : "Не удалось прочитать сайт."); }
  };

  const progress = Math.round((step / stepLabels.length) * 100);
  return <main className="relative min-h-screen overflow-hidden bg-[#09090d] px-4 py-5 text-white sm:px-7 lg:px-10"><div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_18%_0%,rgba(124,92,255,.18),transparent_38%),radial-gradient(circle_at_85%_12%,rgba(77,208,168,.05),transparent_28%)]" /><div className="relative mx-auto max-w-4xl">
    <header className="flex items-center justify-between border-b border-white/[.08] py-3"><a href="/start"><RibesBrand dark /></a><span className="text-xs font-semibold text-slate-500">{step} из {stepLabels.length}</span></header>
    <section className="py-8 sm:py-12"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.1em]"><span className="text-violet-300">{stepLabels[step - 1]}</span><span className="text-slate-600">{progress}% заполнено</span></div>
      <div className="mt-8 min-h-[500px] rounded-[30px] border border-white/[.09] bg-[#101015]/95 p-5 shadow-[0_28px_100px_rgba(0,0,0,.36)] sm:p-8">
        {step === 1 ? <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-violet-300">Быстрый старт</p><h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">У бренда есть сайт?</h1><p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">Вставьте ссылку — Ribes попробует заполнить основу сам. Сайта нет? Просто нажмите «Дальше».</p><div className="mt-8 flex gap-2"><input className={inputClass} value={values.website} onChange={(event) => { update("website", event.target.value); setImportState("idle"); }} placeholder="https://ваш-сайт.ru" /><button type="button" onClick={importWebsite} disabled={!values.website.trim() || importState === "loading"} className="shrink-0 rounded-2xl bg-white px-5 text-xs font-semibold text-black disabled:opacity-35">{importState === "loading" ? "Читаю…" : "Заполнить"}</button></div>{importMessage ? <p className={`mt-3 text-xs ${importState === "error" ? "text-rose-300" : "text-emerald-300"}`}>{importMessage}</p> : null}</div> : null}
        {step === 2 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Как называется бренд?</h1><p className="mt-4 text-sm text-slate-400">Так он будет подписан в кабинете и материалах.</p><input autoFocus className={`${inputClass} mt-8 text-lg`} value={values.brandName} onChange={(event) => update("brandName", event.target.value)} placeholder="Название бренда" /></div> : null}
        {step === 3 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Чем занимается компания?</h1><p className="mt-4 text-sm text-slate-400">Одно–два предложения простыми словами.</p><textarea autoFocus className={`${inputClass} mt-8 min-h-36 resize-y text-base leading-7`} value={values.businessDescription} onChange={(event) => update("businessDescription", event.target.value)} placeholder="Мы производим… / Помогаем клиентам…" /></div> : null}
        {step === 4 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Что продвигаем первым?</h1><p className="mt-4 text-sm text-slate-400">Главный продукт, услуга или направление. Короткого ответа достаточно.</p><input autoFocus className={`${inputClass} mt-8 text-base`} value={values.priorityOffer} onChange={(event) => update("priorityOffer", event.target.value)} placeholder="Например: кухонные мойки из нержавеющей стали" /></div> : null}
        {step === 5 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Кто ваш основной клиент?</h1><p className="mt-4 text-sm text-slate-400">Выберите ближайший вариант или допишите свой.</p><div className="mt-7 grid gap-2 sm:grid-cols-2">{audienceOptions.map((option) => <Choice key={option} active={values.audience === option} title={option} onClick={() => update("audience", option)} />)}</div><input className={`${inputClass} mt-3`} value={values.audience} onChange={(event) => update("audience", event.target.value)} placeholder="Или свой вариант в одной строке" /></div> : null}
        {step === 6 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Как бренд должен звучать?</h1><p className="mt-4 text-sm text-slate-400">Нажмите на стиль — под каждым есть пример будущего текста.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{toneOptions.map((option) => <button type="button" key={option.title} onClick={() => update("tone", option.title)} className={`rounded-2xl border p-4 text-left transition ${values.tone === option.title ? "border-violet-400/65 bg-violet-500/12" : "border-white/[.08] bg-white/[.025] hover:bg-white/[.05]"}`}><span className="text-sm font-semibold text-white/88">{option.title}</span><span className="mt-1 block text-[11px] text-slate-500">{option.detail}</span><span className="mt-4 block rounded-xl bg-black/20 px-3 py-3 text-[11px] italic leading-5 text-white/48">«{option.example}»</span></button>)}</div></div> : null}
        {step === 7 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Какой результат нужен сейчас?</h1><p className="mt-4 text-sm text-slate-400">Это поможет выбрать темы и призывы к действию. Можно пропустить.</p><div className="mt-7 grid gap-2 sm:grid-cols-2">{goalOptions.map((option) => <Choice key={option} active={values.monthGoal === option} title={option} onClick={() => update("monthGoal", option)} />)}</div><input className={`${inputClass} mt-3`} value={values.monthGoal} onChange={(event) => update("monthGoal", event.target.value)} placeholder="Или свой результат в одной строке" /></div> : null}
        {step === 8 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Как должен выглядеть бренд?</h1><p className="mt-4 text-sm text-slate-400">Выберите направление. Цвета и композицию Ribes уточнит по сайту и логотипу.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{visualOptions.map((option) => <Choice key={option} active={values.visualStyle === option} title={option} onClick={() => update("visualStyle", option)} />)}</div><input className={`${inputClass} mt-3`} value={values.brandbookUrl} onChange={(event) => update("brandbookUrl", event.target.value)} placeholder="Ссылка на брендбук — если есть" /></div> : null}
        {step === 9 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Использовать логотип?</h1><p className="mt-4 text-sm text-slate-400">Ribes никогда не будет придумывать похожий знак. Либо используем ваш оригинал, либо работаем без логотипа.</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><Choice active={values.logoMode === "upload"} title="Загрузить файл" detail="Лучший вариант" onClick={() => update("logoMode", "upload")} /><Choice active={values.logoMode === "url"} title="Дать ссылку" detail="Если файл опубликован" onClick={() => update("logoMode", "url")} /><Choice active={values.logoMode === "none"} title="Без логотипа" detail="Ничего не выдумываем" onClick={() => { update("logoMode", "none"); update("logoUrl", ""); }} /></div>{values.logoMode === "url" ? <input className={`${inputClass} mt-4`} value={values.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="Прямая ссылка на файл логотипа" /> : null}</div> : null}
        {step === 10 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Где бренд уже есть?</h1><p className="mt-4 text-sm text-slate-400">Добавьте только известные ссылки. Подключение автопубликации сделаем позже в кабинете.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{socialFields.map(([key, label, placeholder]) => <label key={key} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4"><span className="text-xs font-semibold text-white/65">{label}</span><input className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" value={values[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} /></label>)}</div></div> : null}
        {step === 11 ? <div><h1 className="font-heading text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Готово. Проверьте основу</h1><p className="mt-4 text-sm text-slate-400">Количество постов и статей выберете уже в кабинете — здесь мы только знакомимся с брендом.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{[["Бренд",values.brandName],["Продвигаем",values.priorityOffer],["Аудитория",values.audience],["Тон",values.tone],["Цель",values.monthGoal || "Определим по материалу"],["Визуальный стиль",values.visualStyle]].map(([label,value]) => <div key={label} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-2 text-sm leading-5 text-white/68">{value}</p></div>)}</div><form action={stageSelfServiceOnboarding} className="mt-5"><input type="hidden" name="selection" value={JSON.stringify(selection)} /><input type="hidden" name="brief" value={JSON.stringify(values)} />{values.logoMode === "upload" ? <label className="mb-4 grid gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/[.07] p-4"><span className="text-sm font-semibold">Оригинал логотипа</span><span className="text-xs text-slate-500">PNG, JPG, WEBP или SVG · до 8 МБ</span><input required name="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-sm text-slate-400 file:mr-4 file:rounded-full file:border-0 file:bg-violet-500 file:px-4 file:py-2 file:font-semibold file:text-white" /></label> : null}<label className="mb-5 flex items-start gap-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-4"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-500" /><span className="text-xs leading-5 text-slate-400">Данные верны. Я принимаю <Link href="/legal/terms" target="_blank" className="text-violet-300 underline">условия использования</Link> и даю <Link href="/legal/consent" target="_blank" className="text-violet-300 underline">согласие на обработку данных</Link>.</span></label><CreateButton confirmed={confirmed} /></form></div> : null}
        <div className="mt-9 flex items-center justify-between border-t border-white/[.08] pt-6"><button type="button" onClick={back} disabled={step === 1} className="rounded-full px-5 py-3 text-sm font-semibold text-slate-400 hover:text-white disabled:invisible">Назад</button>{step < stepLabels.length ? <button type="button" onClick={next} disabled={!canContinue} className="rounded-full bg-violet-500 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-35">Дальше</button> : null}</div>
      </div>
    </section>
  </div></main>;
}
