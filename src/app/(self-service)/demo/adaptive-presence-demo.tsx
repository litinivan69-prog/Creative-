"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { PlatformBrandIcon, type PlatformBrand } from "@/app/(self-service)/platform-brand-icon";
import {
  BILLING_DURATIONS,
  CREDIT_PLANS,
  CREDIT_PRODUCTS,
  displayCredits,
  formatRubles,
  subscriptionPriceMinor,
} from "@/lib/self-service/credit-catalog";

type DemoView = "overview" | "calendar" | "materials" | "articles" | "autoposting" | "results";

const views: Array<{ id: DemoView; label: string; icon: string }> = [
  { id: "overview", label: "Обзор", icon: "⌁" },
  { id: "calendar", label: "Календарь", icon: "□" },
  { id: "materials", label: "Материалы", icon: "◇" },
  { id: "articles", label: "Статьи", icon: "≡" },
  { id: "autoposting", label: "Автопостинг", icon: "↗" },
  { id: "results", label: "Результаты", icon: "⌇" },
];

const materials = [
  { day: "06", platform: "VK", title: "Как выбрать газовый счётчик для частного дома", status: "Готово" },
  { day: "10", platform: "Telegram", title: "Три ошибки при выборе оборудования", status: "Запланировано" },
  { day: "15", platform: "Дзен", title: "Газификация и догазификация: полный разбор", status: "Готово" },
  { day: "20", platform: "VC.ru", title: "Как устроены комплексные поставки для инженерных сетей", status: "Готовится" },
];

function HeroProductMontage() {
  return (
    <div className="relative mx-auto h-[520px] w-full max-w-[650px] sm:h-[610px] lg:mr-0">
      <div className="absolute inset-8 rounded-full bg-violet-600/25 blur-[100px]" />

      <div className="absolute left-2 right-6 top-10 overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#100e16] shadow-[0_45px_150px_rgba(0,0,0,.6)] sm:left-8 sm:right-10">
        <div className="flex h-9 items-center gap-1.5 border-b border-white/[0.06] bg-black/25 px-4">
          <span className="h-2 w-2 rounded-full bg-rose-400/75" />
          <span className="h-2 w-2 rounded-full bg-amber-300/75" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/75" />
          <span className="ml-2 text-[8px] font-medium text-white/25">app.adaptivepresence.ai</span>
        </div>
        <div className="grid grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[102px_minmax(0,1fr)]">
          <div className="border-r border-white/[0.06] bg-black/15 p-2.5 sm:p-3">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500 text-[8px] font-black text-white">cc.</span>
            <div className="mt-5 space-y-2">
              {["Обзор", "Календарь", "Материалы", "Статьи"].map((item, index) => <div key={item} className={`truncate rounded-lg px-2 py-1.5 text-[7px] sm:text-[8px] ${index === 0 ? "bg-violet-500/15 text-white" : "text-white/28"}`}>{item}</div>)}
            </div>
          </div>
          <div className="min-w-0 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-violet-300">Август</p><p className="mt-1 text-sm font-semibold text-white sm:text-base">Контент-месяц готов</p></div><span className="rounded-full bg-violet-500/12 px-2 py-1 text-[7px] font-semibold text-violet-200">16 / 18</span></div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
              {[["18", "материалов"], ["5", "площадок"], ["89%", "готово"]].map(([value, label]) => <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.035] p-2.5"><p className="text-sm font-semibold text-white">{value}</p><p className="mt-1 truncate text-[6px] text-white/28 sm:text-[7px]">{label}</p></div>)}
            </div>
            <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
              <div className="flex items-center justify-between text-[7px]"><span className="text-white/65">Публикации месяца</span><span className="text-violet-300">распределены</span></div>
              <div className="mt-2 grid grid-cols-7 gap-1">{[0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0].map((active, index) => <span key={index} className={`h-4 rounded-[4px] ${active ? "bg-violet-500/70" : "bg-white/[0.04]"}`} />)}</div>
            </div>
          </div>
        </div>
      </div>

      <article className="absolute bottom-7 right-1 w-[52%] overflow-hidden rounded-[24px] border border-white/[0.14] bg-[#15121b] shadow-[0_35px_90px_rgba(0,0,0,.6)] sm:right-4 sm:w-[48%]">
        <div className="relative aspect-[4/5]"><Image src="/marketing/ilart-editorial-post-v1.webp" alt="Готовый пост для инженерного бренда" fill priority sizes="(max-width:640px) 52vw, 310px" className="object-cover" /><div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/72 to-transparent p-3 sm:p-4"><div className="flex items-center gap-2"><PlatformBrandIcon platform="VK" size="xs" /><span className="text-[8px] font-semibold text-white/75">Пост готов к публикации</span></div><p className="mt-3 max-w-[210px] text-[10px] font-semibold leading-4 text-white sm:text-xs sm:leading-5">Комплектующие как часть инженерного проекта</p></div></div>
      </article>

      <article className="absolute bottom-4 left-0 w-[43%] rotate-[-3deg] overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#f2effa] text-[#17131e] shadow-[0_28px_80px_rgba(0,0,0,.48)] sm:left-5 sm:w-[39%]">
        <div className="relative aspect-[16/9] overflow-hidden"><Image src="/marketing/adaptive-presence-longread-v2.webp" alt="Статья Дзен с изображениями" fill sizes="250px" className="object-cover" /></div>
        <div className="p-3 sm:p-4"><div className="flex items-center gap-2"><PlatformBrandIcon platform="Дзен" size="xs" /><span className="text-[8px] font-semibold text-black/45">Статья · 1 840 слов</span></div><p className="mt-2 line-clamp-2 text-[9px] font-semibold leading-4 sm:text-[11px]">Газификация дома: этапы, документы и ошибки</p></div>
      </article>

      <div className="absolute left-[38%] top-[49%] rounded-2xl border border-violet-300/20 bg-[#18131f]/95 px-3 py-2.5 shadow-xl backdrop-blur sm:px-4"><p className="text-[7px] text-white/35">Рост аудитории · демо</p><p className="mt-1 text-xs font-semibold text-white sm:text-sm">+1 240 подписчиков</p></div>
      <div className="absolute right-[1%] top-[4%] rotate-6"><PlatformBrandIcon platform="Telegram" size="sm" /></div>
      <div className="absolute left-[1%] top-[35%] -rotate-6"><PlatformBrandIcon platform="Одноклассники" size="sm" /></div>
      <div className="absolute right-[2%] top-[45%] rotate-3"><PlatformBrandIcon platform="VC.ru" size="sm" /></div>
      <div className="absolute left-[34%] top-[1%] -rotate-3"><YandexMapsMark size="sm" /></div>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#9b87ff,#6d4aff)] text-[10px] font-black lowercase text-white shadow-[0_0_30px_rgba(124,92,255,.35)]">cc.</span>
      {!compact ? <span><span className="block text-sm font-semibold text-white">Adaptive Presence</span><span className="block text-[10px] text-white/35">by Creative Command</span></span> : null}
    </span>
  );
}

function YandexMapsMark({ size = "xs" }: { size?: "xs" | "sm" }) {
  return <span className={`grid shrink-0 place-items-center rounded-[9px] bg-white font-black text-[#ff2c2c] shadow-[0_8px_24px_rgba(15,23,42,.1)] ${size === "sm" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[11px]"}`}>Я</span>;
}

function MetricCard({ label, value, detail, tone = "violet" }: { label: string; value: string; detail: string; tone?: "violet" | "mint" }) {
  return (
    <article className="rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/35">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3"><p className="text-2xl font-semibold tracking-[-0.04em] text-white">{value}</p><span className={`text-[10px] font-semibold ${tone === "mint" ? "text-emerald-300" : "text-violet-300"}`}>{detail}</span></div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${tone === "mint" ? "w-[74%] bg-emerald-400" : "w-[82%] bg-violet-500"}`} /></div>
    </article>
  );
}

function OverviewView() {
  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(140deg,rgba(124,92,255,.13),rgba(255,255,255,.025)_50%)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Август · контент готовится</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">16 из 18 материалов готовы</h3><p className="mt-2 max-w-xl text-xs leading-5 text-white/45">В календаре уже стоят посты, статьи и визуалы. Два материала завершают подготовку.</p></div>
          <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200">89% месяца</span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full w-[89%] rounded-full bg-[linear-gradient(90deg,#7454ff,#a98fff)]" /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><MetricCard label="Материалов" value="18" detail="план месяца" /><MetricCard label="Полностью готово" value="16" detail="89%" /><MetricCard label="Площадок" value="5" detail="в одном плане" /></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <section className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.03]"><div className="grid sm:grid-cols-[1fr_150px]"><div className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Следующая публикация</p><p className="mt-1 text-[11px] text-white/35">17 августа · 11:00</p></div><span className="rounded-full bg-violet-500/12 px-3 py-1.5 text-[10px] font-semibold text-violet-200">готово</span></div><div className="mt-5 flex items-center gap-2"><PlatformBrandIcon platform="VK" size="xs" /><span className="text-[10px] text-white/35">VK</span></div><p className="mt-4 text-sm font-medium leading-6 text-white/85">Почему комплектующие нельзя рассматривать отдельно от проекта</p><button className="mt-5 text-[10px] font-semibold text-violet-300">Открыть материал →</button></div><div className="relative hidden min-h-64 sm:block"><Image src="/marketing/ilart-editorial-post-v1.webp" alt="Готовый визуал публикации" fill sizes="150px" className="object-cover" /></div></div></section>
        <section className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Площадки</p><p className="mt-1 text-[10px] text-white/30">3 подключены, 2 готовы к настройке</p></div><span className="text-[10px] font-semibold text-violet-300">Настроить</span></div><div className="mt-5 space-y-3">{(["Telegram","VK","Дзен","VC.ru"] as PlatformBrand[]).map((name,index)=><div key={name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2.5 text-white/65"><PlatformBrandIcon platform={name} size="xs" />{name}</span><span className={index < 2 ? "text-violet-200" : "text-white/30"}>{index < 2 ? "подключено" : "настроить"}</span></div>)}</div></section>
      </div>
    </div>
  );
}

function CalendarView() {
  const scheduled = new Map([[3,"VK"],[6,"TG"],[9,"ОК"],[12,"Дзен"],[15,"VK"],[18,"TG"],[21,"VC"],[24,"ОК"],[27,"VK"],[30,"TG"]]);
  const cells = Array.from({ length: 35 }, (_, index) => index < 2 || index > 32 ? null : index - 1);
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Календарь</p><h3 className="mt-2 text-2xl font-semibold text-white">Август 2026</h3></div><span className="text-[10px] text-white/35">18 материалов · без публикаций подряд</span></div>
      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=><span key={day} className="pb-1 text-center text-[9px] font-bold uppercase text-white/25">{day}</span>)}{cells.map((day,index)=><div key={index} className={`min-h-14 overflow-hidden rounded-xl border p-1.5 sm:min-h-20 sm:p-2 ${day ? "border-white/[0.05] bg-white/[0.025]" : "border-transparent"}`}>{day ? <><span className={`text-[10px] ${scheduled.has(day) ? "text-violet-200" : "text-white/25"}`}>{day}</span>{scheduled.has(day) ? <div className="relative mt-1.5 aspect-[16/8] overflow-hidden rounded-lg border border-violet-400/15 sm:aspect-[16/10]"><Image src={scheduled.get(day) === "Дзен" || scheduled.get(day) === "VC" ? "/marketing/adaptive-presence-longread-v2.webp" : "/marketing/ilart-editorial-post-v1.webp"} alt={`Материал ${scheduled.get(day)}`} fill sizes="100px" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" /><span className="absolute bottom-1 left-1.5 text-[7px] font-semibold text-white sm:text-[8px]">{scheduled.get(day)}</span></div> : null}</> : null}</div>)}</div>
    </section>
  );
}

function MaterialsView() {
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><p className="text-sm font-semibold text-white">Материалы месяца</p><p className="mt-1 text-[10px] text-white/35">Откройте текст, визуал или карусель</p></div><button className="rounded-xl bg-violet-500 px-3 py-2 text-[10px] font-semibold text-white">+ Быстрый анонс</button></div>
      <div className="divide-y divide-white/[0.05]">{materials.map((material,index)=><article key={material.title} className="grid gap-3 px-5 py-4 sm:grid-cols-[46px_76px_minmax(0,1fr)_90px] sm:items-center"><span className="text-lg font-semibold text-white/80">{material.day}</span><span className="w-fit rounded-full bg-white/[0.05] px-2.5 py-1 text-[9px] font-semibold text-white/45">{material.platform}</span><div className="min-w-0"><p className="truncate text-xs font-medium text-white/85">{material.title}</p><p className="mt-1 text-[10px] text-white/30">Текст {index === 3 ? "готовится" : "и визуал готовы"}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[9px] font-semibold ${material.status === "Готово" ? "bg-emerald-400/10 text-emerald-300" : material.status === "Готовится" ? "bg-amber-400/10 text-amber-200" : "bg-violet-500/10 text-violet-200"}`}>{material.status}</span></article>)}</div>
    </section>
  );
}

function ArticlesView() {
  const articles = [
    { platform: "Дзен", title: "Газификация частного дома: этапы, документы и частые ошибки", words: "1 840 слов", state: "Готова", tone: "from-[#44306f] to-[#191622]" },
    { platform: "VC.ru", title: "Как комплексные поставки сокращают риски инженерного проекта", words: "1 520 слов", state: "Редактура", tone: "from-[#254754] to-[#151923]" },
  ];
  return (
    <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-3"><MetricCard label="Статей" value="2" detail="в этом месяце" /><MetricCard label="Готово" value="1" detail="можно размещать" /><MetricCard label="Средний объём" value="1.7K" detail="слов" /></section><section className="grid gap-3 md:grid-cols-2">{articles.map((article)=><article key={article.title} className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.03]"><div className={`aspect-[16/7] bg-gradient-to-br ${article.tone} p-4`}><span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-semibold text-white/70">{article.platform}</span><div className="mt-6 h-1.5 w-20 rounded-full bg-white/25" /><div className="mt-2 h-1.5 w-32 rounded-full bg-white/10" /></div><div className="p-5"><div className="flex items-center justify-between text-[9px]"><span className="text-violet-300">{article.state}</span><span className="text-white/25">{article.words}</span></div><h3 className="mt-3 min-h-12 text-sm font-semibold leading-5 text-white/82">{article.title}</h3><div className="mt-5 grid grid-cols-2 gap-2"><button className="rounded-xl bg-violet-500 px-3 py-2.5 text-[10px] font-semibold text-white">Открыть</button><button className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 text-[10px] font-semibold text-white/55">DOCX ↓</button></div></div></article>)}</section></div>
  );
}

function AutopostingView() {
  const rules = [
    ["Публиковать подтверждённое по календарю","Материал уходит автоматически в выбранное время","активно"],
    ["Адаптировать одну тему под площадку","Для VK готовится подробная версия, для Telegram короткая","активно"],
    ["Повторить при технической ошибке","Три безопасные попытки и понятное уведомление","активно"],
    ["Требовать подтверждение","Ничего не публикуется без вашего решения","выключено"],
  ];
  return (
    <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-3"><MetricCard label="Активных правил" value="3/4" detail="работают" /><MetricCard label="Публикаций · 7 дней" value="4" detail="без ошибок" tone="mint" /><MetricCard label="Следующая" value="11:00" detail="завтра" /></section><section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Правила автопостинга</p><p className="mt-1 text-[10px] text-white/35">Система работает вместо ручных публикаций</p></div><button className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[10px] font-semibold text-white/70">Настроить</button></div><div className="mt-4 space-y-2.5">{rules.map(([title,description,state],index)=><article key={title} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-black/15 p-3.5"><span className={`relative h-5 w-9 shrink-0 rounded-full ${index < 3 ? "bg-violet-500" : "bg-white/10"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${index < 3 ? "left-[18px]" : "left-0.5"}`} /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-white/80">{title}</p><p className="mt-1 text-[10px] text-white/30">{description}</p></div><span className="text-[9px] text-white/25">{state}</span></article>)}</div></section></div>
  );
}

function ResultsView() {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-4"><MetricCard label="Охват" value="186K" detail="+38%" /><MetricCard label="Новые подписчики" value="1 240" detail="+410 за месяц" /><MetricCard label="Вовлечение" value="4,8%" detail="+1,3 п.п." /><MetricCard label="Переходы" value="3 960" detail="+24%" /></section>
      <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">Динамика присутствия</p><p className="mt-1 text-[10px] text-white/35">Пример отчёта после подключения площадок</p></div><span className="rounded-full border border-white/[0.07] px-3 py-1.5 text-[9px] text-white/30">демо-данные</span></div><div className="mt-7 grid h-52 grid-cols-7 items-end gap-2 border-b border-white/[0.06] px-2">{[35,52,44,68,73,82,96].map((height,index)=><div key={height} className="group flex h-full flex-col justify-end"><div className="relative rounded-t-lg bg-[linear-gradient(180deg,#9b82ff,#6646d9)] opacity-80 transition group-hover:opacity-100" style={{height:`${height}%`}} /><span className="mt-2 text-center text-[9px] text-white/22">{["Фев","Мар","Апр","Май","Июн","Июл","Авг"][index]}</span></div>)}</div><div className="mt-7 grid gap-3 sm:grid-cols-3">{[["Лучший формат","Статья Дзен","64 200 просмотров"],["Сильная площадка","VK","+620 подписчиков"],["Следующая точка роста","Telegram","увеличить долю анонсов"]].map(([label,value,detail])=><div key={label} className="rounded-2xl border border-white/[0.05] bg-black/15 p-4"><p className="text-[9px] uppercase tracking-[0.12em] text-white/25">{label}</p><p className="mt-3 text-sm font-semibold text-white/80">{value}</p><p className="mt-1 text-[10px] text-violet-300">{detail}</p></div>)}</div></section>
    </div>
  );
}

function DemoWorkspace() {
  const [activeView, setActiveView] = useState<DemoView>("overview");
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#0d0c12] shadow-[0_40px_140px_rgba(0,0,0,.55),0_0_0_1px_rgba(139,92,246,.05)]">
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.06] bg-black/20 px-4"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" /><span className="ml-2 text-[9px] font-medium text-white/25">app.adaptivepresence.ai</span></div>
      <div className="grid min-h-[640px] lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/[0.06] bg-black/15 p-4 lg:flex lg:flex-col"><BrandMark /><div className="mt-7 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"><p className="text-[10px] text-white/30">Ваш бренд</p><p className="mt-1 text-xs font-semibold text-white/80">ШопИларт</p><p className="mt-1 flex items-center gap-1.5 text-[9px] text-violet-300"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />месяц готовится</p></div><nav className="mt-6 space-y-1">{views.map(view=><button key={view.id} onClick={()=>setActiveView(view.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition ${activeView===view.id ? "border border-violet-400/25 bg-violet-500/12 text-white" : "border border-transparent text-white/40 hover:bg-white/[0.03] hover:text-white/70"}`}><span className="w-4 text-center text-violet-300/80">{view.icon}</span>{view.label}</button>)}</nav><div className="mt-auto space-y-3 border-t border-white/[0.06] pt-4"><p className="text-[10px] text-white/30">Бренд и площадки</p><p className="text-[10px] text-white/30">Публичное демо</p><div className="rounded-xl bg-violet-500/10 px-3 py-2 text-[10px] font-semibold text-violet-200">7 000 кредитов</div></div></aside>
        <main className="min-w-0"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6"><div><p className="text-[10px] text-white/30">ШопИларт · <span className="text-white/65">{views.find(view=>view.id===activeView)?.label}</span></p></div><div className="flex items-center gap-2"><span className="hidden rounded-xl border border-violet-400/15 bg-violet-500/10 px-3 py-2 text-[9px] font-semibold text-violet-200 sm:block">7 000 кредитов</span><span className="hidden rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[9px] text-white/25 sm:block">⌘ Поиск</span><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-200">Ш</span></div></header><div className="border-b border-white/[0.05] px-3 py-2 lg:hidden"><div className="flex gap-1 overflow-x-auto">{views.map(view=><button key={view.id} onClick={()=>setActiveView(view.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-semibold ${activeView===view.id ? "bg-violet-500 text-white" : "text-white/35"}`}>{view.label}</button>)}</div></div><div className="p-4 sm:p-6">{activeView === "overview" ? <OverviewView /> : activeView === "calendar" ? <CalendarView /> : activeView === "materials" ? <MaterialsView /> : activeView === "articles" ? <ArticlesView /> : activeView === "autoposting" ? <AutopostingView /> : <ResultsView />}</div></main>
      </div>
    </div>
  );
}

const platformFormats: Array<{
  platform: PlatformBrand;
  title: string;
  description: string;
  badge: string;
}> = [
  { platform: "VK", title: "Посты VK", description: "Полезные публикации, карточки и промо под ленту сообщества.", badge: "текст + визуал" },
  { platform: "Telegram", title: "Посты Telegram", description: "Живой короткий формат без канцелярита и повторов из VK.", badge: "свой tone of voice" },
  { platform: "Одноклассники", title: "Посты ОК", description: "Понятная подача для локальной и зрелой аудитории бренда.", badge: "адаптация площадки" },
  { platform: "Дзен", title: "Статьи Дзен", description: "Структурные материалы с обложкой и несколькими изображениями.", badge: "longread" },
  { platform: "VC.ru", title: "Статьи VC.ru", description: "Экспертные истории, кейсы и разборы для бизнес-аудитории.", badge: "автопубликация" },
];

const faqItems = [
  ["Это очередной генератор постов?", "Нет. Система сначала запоминает бренд, затем собирает ритм месяца, адаптирует одну тему под разные площадки, готовит визуалы и только после этого публикует подтверждённые материалы."],
  ["Нужно ли подключать площадки до знакомства с продуктом?", "Нет. Сначала можно пройти бриф и увидеть кабинет. Подключение каналов понадобится перед автоматической публикацией."],
  ["Можно ли самому выбрать количество постов и статей?", "Да. Вы получаете кредиты и собираете месяц самостоятельно: больше коротких постов, больше статей или смешанный набор."],
  ["Что происходит с визуалами для статей?", "Для статьи создаётся обложка и набор изображений по смысловым блокам. Они сохраняются вместе с материалом и передаются при публикации на поддерживаемую площадку."],
  ["Контент публикуется без проверки?", "Сначала вы видите готовый материал и подтверждаете его. Автоматический режим включается отдельно для выбранных каналов."],
  ["Что с ответами на отзывы Яндекс Карт?", "Adaptive Presence собирает отзывы, готовит ответы в стиле бренда и сохраняет историю работы с обратной связью. Перед размещением ответ можно проверить и подтвердить."],
];

function SectionLabel({ children, dark = true }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${dark ? "text-violet-300" : "text-violet-700"}`}>{children}</p>;
}

function PlatformFormats() {
  return (
    <section id="formats" className="scroll-mt-24 bg-[#f5f2ff] py-24 text-[#121019] sm:py-28">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <SectionLabel dark={false}>Форматы месяца</SectionLabel>
            <h2 className="mt-4 max-w-xl font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Одна система.<br />Разный язык площадок.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-black/50 sm:text-base">Не копируем один текст пять раз. Сохраняем общую идею бренда, но меняем ритм, длину, структуру и визуальную подачу под каждую площадку.</p>
        </div>

        <div className="mt-12 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {platformFormats.map((format, index) => (
            <article key={format.title} className={`group rounded-[26px] border border-black/[0.07] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(70,48,130,.12)] ${index === 3 || index === 4 ? "bg-[#121018] text-white" : "bg-white"}`}>
              <PlatformBrandIcon platform={format.platform} size="md" />
              <p className={`mt-8 text-[9px] font-bold uppercase tracking-[0.14em] ${index === 3 || index === 4 ? "text-violet-300" : "text-violet-700"}`}>{format.badge}</p>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.025em]">{format.title}</h3>
              <p className={`mt-3 text-xs leading-5 ${index === 3 || index === 4 ? "text-white/42" : "text-black/45"}`}>{format.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <article className="rounded-[28px] border border-black/[0.07] bg-white p-6 sm:p-8">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-xl text-violet-700">↗</span>
            <h3 className="mt-6 text-2xl font-semibold tracking-[-0.04em]">Быстрый пост</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-black/45">Сообщите новость, запустите акцию или отреагируйте на событие вне месячного плана. Короткая форма, один понятный экран, публикация без пересборки месяца.</p>
          </article>
          <article className="rounded-[28px] border border-black/[0.07] bg-[linear-gradient(145deg,#ebe5ff,#fff)] p-6 sm:p-8">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl text-violet-700 shadow-sm">✦</span>
            <h3 className="mt-6 text-2xl font-semibold tracking-[-0.04em]">Ответы на отзывы</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-black/45">Adaptive Presence собирает отзывы Яндекс Карт, готовит ответы с учётом оценки, текста и правил бренда. Вы проверяете результат, подтверждаете ответ и видите историю в кабинете.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function ProductValue() {
  const valueBlocks = [
    ["01", "Контекст", "Сайт, продукты, аудитория, география, тон и ограничения становятся памятью бренда, а не теряются между запросами."],
    ["02", "Ритм", "Материалы распределяются по месяцу с нормальными интервалами. Площадки поддерживают друг друга, но не дублируются день в день."],
    ["03", "Производство", "Посты, статьи, обложки, изображения внутри longread и отдельные слайды каруселей готовятся одним процессом."],
    ["04", "Доставка", "Подтверждённые материалы уходят по расписанию. Ошибка не создаёт дубль: система сохраняет результат и повторяет безопасно."],
  ];
  return (
    <section id="why" className="scroll-mt-24 border-t border-white/[0.06] py-24 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionLabel>Почему работает</SectionLabel>
          <h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.05em] sm:text-6xl">Не магия.<br />Собранный процесс.</h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/40">Человек видит простой кабинет. Под ним работает производственное ядро, которое мы уже проверили на реальных месячных планах.</p>
        </div>
        <div className="space-y-3">
          {valueBlocks.map(([number, title, description]) => (
            <article key={number} className="group grid gap-6 rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-6 transition hover:border-violet-400/20 hover:bg-violet-500/[0.045] sm:grid-cols-[80px_1fr] sm:p-8">
              <span className="font-heading text-3xl font-semibold text-violet-400/55">{number}</span>
              <div><h3 className="text-2xl font-semibold tracking-[-0.035em] text-white">{title}</h3><p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">{description}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BusinessOutcomes() {
  const outcomes = [
    ["01", "Больше точек входа", "Статьи в Дзене и VC.ru отвечают на конкретные запросы. Посты в социальных сетях поддерживают тему и ведут человека к продукту."],
    ["02", "GEO и видимость в AI", "Экспертные материалы создают понятные сущности, факты и ответы. Это основа GEO: поисковые системы индексируют страницы, а нейросети получают больше оснований упоминать бренд как источник."],
    ["03", "Выше доверие к бренду", "Регулярные публикации и ответы на отзывы показывают живую компанию. Клиент видит экспертизу до первого обращения."],
    ["04", "Понятная конверсия", "В кабинете видно, какие темы дают просмотры, подписки и переходы. Следующий месяц строится на фактическом результате."],
  ];
  return (
    <section className="border-t border-white/[0.06] py-24 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr]">
        <div><SectionLabel>Что получает бизнес</SectionLabel><h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Контент должен приводить к результату</h2><p className="mt-6 max-w-md text-sm leading-7 text-white/40">Adaptive Presence связывает публикации, площадки и показатели. Вы видите не объём производства, а вклад каждого формата.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">{outcomes.map(([number,title,text])=><article key={number} className="rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-6"><span className="text-[10px] font-semibold text-violet-300">{number}</span><h3 className="mt-7 text-xl font-semibold tracking-[-0.03em] text-white">{title}</h3><p className="mt-3 text-xs leading-6 text-white/38">{text}</p></article>)}</div>
      </div>
    </section>
  );
}

function ArticlePipeline() {
  return (
    <section id="articles" className="scroll-mt-24 py-24 sm:py-28">
      <div className="overflow-hidden rounded-[34px] border border-white/[0.08] bg-[radial-gradient(circle_at_82%_12%,rgba(126,86,255,.2),transparent_32%),#111018] p-6 sm:p-10 lg:p-14">
        <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
          <div>
            <SectionLabel>Статьи без ручной сборки</SectionLabel>
            <h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.05em] sm:text-5xl">Полноценная статья для Дзена и VC.ru</h2>
            <p className="mt-6 text-sm leading-7 text-white/42">Система готовит структуру, заголовок, лид, смысловые блоки, обложку и изображения. После проверки статья публикуется целиком.</p>
            <div className="mt-8 flex flex-wrap gap-2">{["обложка", "3–6 изображений", "структура", "редактура", "автопубликация"].map(item => <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] font-semibold text-white/50">{item}</span>)}</div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 bg-[radial-gradient(circle,rgba(124,92,255,.22),transparent_67%)] blur-xl" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#ece8f8] shadow-[0_35px_100px_rgba(0,0,0,.4)]"><Image src="/marketing/adaptive-presence-longread-v2.webp" alt="Автоматическая сборка статьи с обложкой и изображениями" fill sizes="(max-width:1024px) 92vw, 700px" className="object-cover" /></div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-[#18131f] shadow-lg backdrop-blur"><span className="flex items-center gap-2.5 text-[11px] font-semibold"><PlatformBrandIcon platform="Дзен" size="xs" />Статья готова</span><span className="text-[10px] text-black/40">1 обложка · 4 изображения</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PilotCase() {
  return (
    <section id="cases" className="scroll-mt-24 bg-white py-24 text-[#121019] sm:py-28">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-6"><div><SectionLabel dark={false}>Пилотный сценарий</SectionLabel><h2 className="mt-4 max-w-3xl font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Весь контент-месяц в одном экране</h2></div><p className="max-w-md text-xs leading-6 text-black/40">ИЛАРТ используется как демонстрационный бренд для проверки полного пути. Цифры показывают состав тестового месяца.</p></div>
        <div className="mt-12 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <article className="overflow-hidden rounded-[30px] bg-[#121018] text-white shadow-[0_30px_90px_rgba(61,42,110,.18)]"><div className="flex h-10 items-center gap-1.5 border-b border-white/[0.06] px-5"><span className="h-2 w-2 rounded-full bg-rose-400" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="ml-2 text-[8px] text-white/25">ИЛАРТ · август</span></div><div className="grid gap-3 p-5 sm:grid-cols-[.78fr_1.22fr] sm:p-7"><div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-violet-300">Месяц собран</p><p className="mt-3 text-2xl font-semibold">16 из 18 готовы</p><div className="mt-5 space-y-2">{(["VK","Telegram","Дзен","VC.ru"] as PlatformBrand[]).map((platform,index)=><div key={platform} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2"><span className="flex items-center gap-2 text-[9px] text-white/55"><PlatformBrandIcon platform={platform} size="xs" />{platform}</span><span className="text-[8px] text-violet-300">{[6,6,1,1][index]} материалов</span></div>)}</div></div><div className="rounded-[22px] border border-white/[0.06] bg-black/15 p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold">Календарь публикаций</p><span className="text-[8px] text-white/25">август</span></div><div className="mt-4 grid grid-cols-7 gap-1.5">{Array.from({length:28},(_,index)=>index+1).map(day=><div key={day} className={`aspect-square rounded-md p-1 text-[6px] ${[2,5,8,12,16,19,23,26].includes(day) ? "bg-violet-500/60 text-white" : "bg-white/[0.035] text-white/18"}`}>{day}</div>)}</div><div className="mt-4 flex items-center gap-2"><div className="relative h-16 w-14 overflow-hidden rounded-lg"><Image src="/marketing/ilart-editorial-post-v1.webp" alt="Публикация в календаре" fill sizes="56px" className="object-cover" /></div><div><p className="text-[8px] text-violet-300">Следующая публикация</p><p className="mt-1 text-[9px] leading-4 text-white/55">Комплектующие как часть проекта</p></div></div></div></div></article>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"><article className="rounded-[30px] border border-violet-200 bg-[linear-gradient(145deg,#ede7ff,#fff)] p-7"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">Результат месяца · демо</p><div className="mt-7 grid grid-cols-2 gap-6">{[["186K","охват"],["+1 240","подписчики"],["3 960","переходы"],["4,8%","вовлечение"]].map(([value,label])=><div key={label}><p className="text-2xl font-semibold tracking-[-0.04em]">{value}</p><p className="mt-1 text-[9px] text-black/35">{label}</p></div>)}</div><div className="mt-7 flex h-20 items-end gap-1.5">{[28,38,34,52,61,72,92].map(value=><span key={value} className="flex-1 rounded-t bg-violet-500" style={{height:`${value}%`}} />)}</div></article><p className="px-2 text-[9px] leading-4 text-black/35">Цифры показывают структуру будущего отчёта. Реальные показатели появятся после подключения статистики площадок.</p></div>
        </div>
      </div>
    </section>
  );
}

function ResultsReport() {
  const reportMetrics = [
    ["+1 240", "новых подписчиков", "+49% к прошлому месяцу"],
    ["186 000", "просмотров контента", "пять площадок"],
    ["4,8%", "вовлечение", "+1,3 п.п."],
    ["3 960", "переходов", "+24%"],
  ];
  return (
    <section className="bg-[#0d0b12] py-24 text-white sm:py-28">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end"><div><SectionLabel>Результаты</SectionLabel><h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Не только количество постов</h2></div><div><p className="max-w-2xl text-sm leading-7 text-white/42">После подключения статистики кабинет показывает рост аудитории, охват, вовлечение и переходы. Видно, какой формат дал результат и что стоит усилить в следующем месяце.</p><p className="mt-3 text-[9px] uppercase tracking-[0.13em] text-white/20">Ниже показан пример отчёта с демонстрационными данными</p></div></div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{reportMetrics.map(([value,label,delta])=><article key={label} className="rounded-[26px] border border-white/[0.07] bg-white/[0.03] p-6"><p className="font-heading text-4xl font-semibold tracking-[-0.05em]">{value}</p><p className="mt-3 text-xs text-white/45">{label}</p><p className="mt-8 text-[10px] font-semibold text-violet-300">{delta}</p></article>)}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <article className="rounded-[28px] border border-white/[0.07] bg-white/[0.03] p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Рост аудитории</p><p className="mt-1 text-[10px] text-white/28">с февраля по август</p></div><span className="rounded-full bg-violet-500/12 px-3 py-1.5 text-[9px] font-semibold text-violet-200">+2 510 за 7 месяцев</span></div><div className="mt-8 grid h-64 grid-cols-7 items-end gap-2 border-b border-white/[0.06]">{[22,31,38,49,61,76,96].map((height,index)=><div key={height} className="flex h-full flex-col justify-end"><div className="rounded-t-xl bg-[linear-gradient(180deg,#a58cff,#6947dc)]" style={{height:`${height}%`}} /><span className="mt-2 text-center text-[9px] text-white/20">{["Ф","М","А","М","И","И","А"][index]}</span></div>)}</div></article>
          <article className="rounded-[28px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(124,92,255,.14),rgba(255,255,255,.025))] p-6 sm:p-8"><p className="text-sm font-semibold">Что сработало лучше</p><div className="mt-6 space-y-5">{[["Статья Дзен","64 200 просмотров","92%"],["Пост VK","620 подписчиков","71%"],["Серия Telegram","840 переходов","54%"]].map(([label,value,width])=><div key={label}><div className="flex items-center justify-between text-[11px]"><span className="text-white/55">{label}</span><span className="font-semibold text-white/80">{value}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500" style={{width}} /></div></div>)}</div><div className="mt-8 rounded-2xl border border-white/[0.06] bg-black/20 p-4"><p className="text-[9px] uppercase tracking-[0.12em] text-violet-300">Рекомендация на следующий месяц</p><p className="mt-2 text-xs leading-5 text-white/55">Увеличить долю экспертных статей и поддержать их короткими анонсами в Telegram.</p></div></article>
        </div>
      </div>
    </section>
  );
}

function CreativeCommandStory() {
  return (
    <section className="bg-[#f5f2ff] py-24 text-[#121019] sm:py-28">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
          <div><SectionLabel dark={false}>Сделано Creative Command</SectionLabel><h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Опыт агентства стал продуктом</h2><p className="mt-6 max-w-md text-sm leading-7 text-black/48">Внутри Adaptive Presence работают редакторская логика, память бренда, визуальная система и контроль качества. Пользователь получает понятный кабинет и готовые материалы.</p><div className="mt-8 inline-flex rotate-[-2deg] rounded-full border-2 border-violet-600 px-4 py-2 text-sm font-semibold italic text-violet-700">технология с характером ↗</div></div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[30px] bg-[#100d18] shadow-[0_30px_90px_rgba(76,51,135,.22)]"><Image src="/marketing/adaptive-presence-mascots-v2.webp" alt="Маскоты Adaptive Presence работают с контент-календарём" fill sizes="(max-width:1024px) 92vw, 760px" className="object-cover" /><div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.13em] text-violet-200 backdrop-blur">Creative Command inside</div></div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-white/[0.06] py-24 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]"><div><SectionLabel>Вопросы</SectionLabel><h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.05em] sm:text-5xl">Всё важное перед стартом.</h2><p className="mt-5 max-w-sm text-sm leading-6 text-white/38">Без мелкого шрифта и обещаний «нажать одну кнопку и забыть о маркетинге».</p></div><div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">{faqItems.map(([question,answer])=><details key={question} className="group py-1"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-sm font-semibold text-white/82"><span>{question}</span><span className="text-xl font-light text-violet-300 transition group-open:rotate-45">+</span></summary><p className="max-w-2xl pb-6 text-xs leading-6 text-white/38">{answer}</p></details>)}</div></div>
    </section>
  );
}

function PublicPricing() {
  const [months, setMonths] = useState(3);
  const duration = BILLING_DURATIONS.find((item) => item.months === months) ?? BILLING_DURATIONS[1];
  const formatExamples = [
    ["Быстрый пост", CREDIT_PRODUCTS.quick_announcement.credits],
    ["Пост с визуалом", CREDIT_PRODUCTS.visual_post.credits],
    ["Статья с обложкой", CREDIT_PRODUCTS.article_with_cover.credits],
    ["Карусель · 4 слайда", CREDIT_PRODUCTS.carousel.credits],
    ["Ответ на отзыв", CREDIT_PRODUCTS.review_reply.credits],
  ] as const;

  return (
    <section id="pricing" className="scroll-mt-6 border-t border-white/[0.06] py-24">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Стоимость</p><h2 className="mt-3 max-w-3xl font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl">Вы платите за нужный объём, а не за лишний пакет.</h2><p className="mt-5 max-w-2xl text-sm leading-6 text-white/40">Каждый месяц вы получаете кредиты и сами собираете набор: посты VK, Telegram и ОК, статьи Дзен и VC.ru, визуалы, карусели и быстрые публикации.</p></div>
        <Link href="/start" className="rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-violet-100">Попробовать на своём бренде</Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2 rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-1.5 sm:grid-cols-4">
        {BILLING_DURATIONS.map((item) => {
          const growthMonthly = Math.round(subscriptionPriceMinor("growth", item.months) / item.months);
          return <button key={item.months} type="button" onClick={() => setMonths(item.months)} className={`relative rounded-2xl px-4 py-4 text-left transition ${months === item.months ? "bg-[linear-gradient(135deg,#805cff,#633fd4)] text-white shadow-[0_12px_35px_rgba(112,78,255,.28)]" : "text-white/48 hover:bg-white/[0.04]"}`}><span className="block text-xs font-semibold">{item.label}</span><span className={`mt-2 block text-[11px] font-bold ${months === item.months ? "text-white" : item.discountPercent ? "text-violet-300" : "text-white/25"}`}>{item.discountPercent ? `−${item.discountPercent}%` : "обычная цена"}</span><span className={`mt-1 block text-[9px] ${months === item.months ? "text-white/65" : "text-white/20"}`}>«Рост» от {formatRubles(growthMonthly)} ₽/мес.</span>{item.months === 12 ? <span className="absolute right-3 top-3 rounded-full bg-lime-300 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-black">выгодно</span> : null}</button>;
        })}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {CREDIT_PLANS.map((plan) => {
          const totalPrice = subscriptionPriceMinor(plan.code, months);
          const monthlyPrice = Math.round(totalPrice / months);
          const saving = plan.monthlyPriceMinor * months - totalPrice;
          return <article key={plan.code} className={`relative overflow-hidden rounded-[26px] border p-6 ${"featured" in plan && plan.featured ? "border-violet-400/30 bg-[linear-gradient(145deg,rgba(115,78,255,.18),rgba(255,255,255,.03))] shadow-[0_30px_90px_rgba(66,43,140,.2)]" : "border-white/[0.07] bg-white/[0.025]"}`}>{"featured" in plan && plan.featured ? <span className="absolute right-5 top-5 rounded-full bg-violet-500/16 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-violet-200">оптимальный</span> : null}<p className="text-sm font-semibold text-white">{plan.name}</p><div className="mt-6 flex items-end gap-2"><p className="font-heading text-4xl font-semibold tracking-[-0.05em] text-white">{formatRubles(monthlyPrice)} ₽</p><span className="pb-1 text-[10px] text-white/28">/ месяц</span></div><p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-violet-200">{displayCredits(plan.credits)}</p><p className="mt-1 text-[10px] text-white/28">кредитов каждый месяц</p><div className="my-5 h-px bg-white/[0.06]" /><ul className="space-y-3 text-xs text-white/45"><li>✓ Любое сочетание форматов</li><li>✓ Тексты и визуалы под бренд</li><li>✓ Календарь на весь месяц</li><li>✓ Быстрые посты и ответы на отзывы</li></ul><p className="mt-5 min-h-8 text-[10px] leading-4 text-white/28">{plan.description}</p>{saving > 0 ? <p className="mt-3 text-[10px] font-semibold text-violet-300">Экономия за период: {formatRubles(saving)} ₽</p> : <p className="mt-3 text-[10px] text-white/20">Можно сменить срок позже</p>}<Link href="/start" className={`mt-6 flex justify-center rounded-2xl px-5 py-3.5 text-xs font-semibold transition ${"featured" in plan && plan.featured ? "bg-violet-500 text-white hover:bg-violet-400" : "border border-white/[0.09] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"}`}>Выбрать тариф</Link></article>;
        })}
      </div>

      <div className="mt-4 grid gap-4 rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-6 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Как работают кредиты</p><h3 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">Вы сами собираете нужный объём</h3><p className="mt-3 max-w-md text-xs leading-5 text-white/35">Количество форматов не фиксировано. Кредиты можно потратить на статьи, короткие публикации, карусели и визуалы в любой пропорции.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">{formatExamples.map(([label, credits]) => <div key={label} className="flex items-center justify-between rounded-2xl border border-white/[0.05] bg-black/15 px-4 py-3"><span className="text-xs text-white/48">{label}</span><span className="text-xs font-semibold text-violet-200">{displayCredits(credits)}</span></div>)}</div>
      </div>
    </section>
  );
}

export function AdaptivePresenceDemo() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <main className="min-h-screen overflow-hidden bg-[#08070c] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(circle_at_16%_5%,rgba(109,74,255,.25),transparent_34%),radial-gradient(circle_at_84%_15%,rgba(160,125,255,.15),transparent_30%)]" />

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08070c]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-7">
          <Link href="/" aria-label="Adaptive Presence"><BrandMark /></Link>
          <nav className="hidden items-center gap-7 text-[11px] font-medium text-white/48 lg:flex"><a href="#product" className="transition hover:text-white">Продукт</a><a href="#formats" className="transition hover:text-white">Форматы</a><a href="#articles" className="transition hover:text-white">Статьи</a><a href="#cases" className="transition hover:text-white">Сценарий</a><a href="#pricing" className="transition hover:text-white">Тарифы</a><a href="#faq" className="transition hover:text-white">Вопросы</a><Link href="/sign-in" className="transition hover:text-white">Войти</Link></nav>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setMobileMenuOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] text-sm text-white/70 lg:hidden" aria-label="Открыть меню">{mobileMenuOpen ? "×" : "≡"}</button><Link href="/start" className="rounded-full bg-white px-4 py-2.5 text-[11px] font-semibold text-black transition hover:bg-violet-100 sm:px-5">Попробовать</Link></div>
        </div>
        {mobileMenuOpen ? <nav className="grid gap-1 border-t border-white/[0.06] bg-[#0b0910] px-4 py-4 text-sm text-white/65 lg:hidden">{[["#product","Продукт"],["#formats","Форматы"],["#articles","Статьи"],["#cases","Сценарий"],["#pricing","Тарифы"],["#faq","Вопросы"]].map(([href,label])=><a key={href} href={href} onClick={()=>setMobileMenuOpen(false)} className="rounded-xl px-3 py-3 hover:bg-white/[0.04]">{label}</a>)}<Link href="/sign-in" className="rounded-xl px-3 py-3 hover:bg-white/[0.04]">Войти</Link></nav> : null}
      </header>

      <div className="relative mx-auto max-w-[1320px] px-4 sm:px-7">
        <section className="grid min-h-[780px] items-center gap-12 pb-16 pt-16 lg:grid-cols-[1.02fr_.98fr] lg:py-24">
          <div className="relative z-10"><span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" />AI-система присутствия бренда</span><h1 className="mt-7 max-w-4xl font-heading text-5xl font-semibold leading-[.92] tracking-[-0.065em] text-white sm:text-7xl lg:text-[82px]">Ваш бренд<br />выходит <span className="bg-[linear-gradient(90deg,#d6cdff,#9a81ff,#7656ff)] bg-clip-text text-transparent">сам.</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-white/46 sm:text-lg">Заполните бриф и получите готовый контент-месяц для российских площадок. Тексты, статьи, визуалы и даты публикаций появятся в одном кабинете.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/start" className="rounded-2xl bg-violet-500 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-[0_18px_55px_rgba(112,78,255,.3)] transition hover:bg-violet-400">Собрать пробный месяц</Link><a href="#product" className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-6 py-3.5 text-center text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white">Открыть демо</a></div><div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-white/28"><span>500 пробных кредитов</span><span>работа без менеджера</span><span>старт за 10 минут</span></div></div>
          <HeroProductMontage />
        </section>

        <section className="border-y border-white/[0.06] py-7"><p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/22">Площадки и каналы Adaptive Presence</p><div className="mt-5 flex flex-wrap items-center justify-center gap-6 sm:gap-10">{(["VK","Telegram","Одноклассники","Дзен","VC.ru"] as PlatformBrand[]).map(platform=><span key={platform} className="flex items-center gap-2.5 text-[11px] font-semibold text-white/42"><PlatformBrandIcon platform={platform} size="xs" />{platform}</span>)}<span className="flex items-center gap-2.5 text-[11px] font-semibold text-white/42"><YandexMapsMark />Яндекс Карты</span></div></section>

        <section id="product" className="scroll-mt-24 py-24 sm:py-28"><div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><SectionLabel>Живой продукт</SectionLabel><h2 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">Не презентация.<br />Попробуйте кабинет.</h2></div><p className="max-w-md text-xs leading-6 text-white/36">Переключайте обзор, календарь, материалы, статьи, автопостинг и результаты прямо на этой странице.</p></div><DemoWorkspace /></section>

        <ProductValue />
        <BusinessOutcomes />
      </div>

      <PlatformFormats />

      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <ArticlePipeline />

        <section id="how" className="border-t border-white/[0.06] py-24 sm:py-28"><div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]"><div><SectionLabel>Путь клиента</SectionLabel><h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.05em] sm:text-5xl">От сайта до публикации без менеджерской панели</h2><p className="mt-5 max-w-md text-sm leading-7 text-white/38">Каждый этап заканчивается готовым результатом и открывает следующий раздел кабинета.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["01","Знакомство","Вводите сайт и отвечаете на короткие вопросы о бизнесе."],["02","Профиль бренда","Проверяете аудиторию, продукты и правила коммуникации."],["03","Конструктор месяца","Выбираете нужное количество постов, статей и визуальных форматов."],["04","Готовый календарь","Система распределяет материалы по месяцу с нормальными интервалами."],["05","Проверка","Редактируете текст, визуал или отдельный слайд карусели."],["06","Публикация","Подключаете площадки и утверждаете расписание."]].map(([number,title,text])=><article key={number} className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-6"><span className="text-[10px] font-semibold text-violet-300">{number}</span><h3 className="mt-6 text-lg font-semibold text-white">{title}</h3><p className="mt-3 text-xs leading-6 text-white/35">{text}</p></article>)}</div></div></section>
      </div>

      <PilotCase />
      <ResultsReport />
      <CreativeCommandStory />

      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <PublicPricing />
        <FAQ />

        <section className="mb-20 overflow-hidden rounded-[34px] border border-violet-400/20 bg-[radial-gradient(circle_at_20%_15%,rgba(149,112,255,.25),transparent_35%),linear-gradient(135deg,#171220,#0d0b12)] p-7 text-center shadow-[0_40px_130px_rgba(68,43,140,.18)] sm:p-14"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-violet-300">Можно начать без подключения площадок</p><h2 className="mx-auto mt-5 max-w-4xl font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Покажите системе бренд.<br />Она покажет вам месяц.</h2><p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-white/40">Пробных кредитов хватит, чтобы пройти путь и увидеть результат. Подписка и автопостинг понадобятся только после решения продолжить.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/start" className="rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-violet-100">Попробовать на своём бренде</Link><Link href="/sign-in" className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08]">Уже есть аккаунт</Link></div></section>

        <footer className="border-t border-white/[0.06] py-10"><div className="flex flex-wrap items-start justify-between gap-8"><div><BrandMark /><p className="mt-5 max-w-xs text-[11px] leading-5 text-white/28">AI-система регулярного присутствия бренда. Продукт Creative Command.</p></div><div className="grid grid-cols-2 gap-x-12 gap-y-3 text-[11px] text-white/38 sm:grid-cols-3"><a href="#product">Продукт</a><a href="#formats">Форматы</a><a href="#pricing">Тарифы</a><a href="#cases">Сценарий</a><a href="#faq">Вопросы</a><Link href="/sign-in">Войти</Link></div></div><div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-6 text-[9px] text-white/20"><p>© 2026 Creative Command · Adaptive Presence</p><p>Создано в России для российских площадок</p></div></footer>
      </div>
    </main>
  );
}
