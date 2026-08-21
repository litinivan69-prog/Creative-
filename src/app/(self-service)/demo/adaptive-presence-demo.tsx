"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { PlatformBrandIcon, type PlatformBrand } from "@/app/(self-service)/platform-brand-icon";
import {
  BILLING_DURATIONS,
  CREDIT_PLANS,
  CREDIT_PRODUCTS,
  TRIAL_CREDITS,
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

const materials: Array<{ day: string; platform: PlatformBrand; title: string; status: string; image: string; readiness: string }> = [
  { day: "06", platform: "VK", title: "Как экспертность превращается в доверие к бренду", status: "Готово", image: "/marketing/universal-brand-post-v1.webp", readiness: "Текст и визуал готовы" },
  { day: "10", platform: "Telegram", title: "Три точки контакта до первого обращения", status: "Запланировано", image: "/marketing/adaptive-presence-mascots-v2.webp", readiness: "Публикация назначена" },
  { day: "15", platform: "Дзен", title: "Как клиент выбирает бренд: подробный разбор", status: "Готово", image: "/marketing/adaptive-presence-longread-v2.webp", readiness: "1 840 слов · 4 изображения" },
  { day: "20", platform: "VC.ru", title: "Как связать статьи и короткие посты в одну систему", status: "Редактура", image: "/marketing/adaptive-presence-hero-v2.webp", readiness: "Текст готов · обложка проверяется" },
  { day: "24", platform: "Одноклассники", title: "Пять привычек бренда, которому доверяют", status: "Готово", image: "/marketing/universal-brand-post-v1.webp", readiness: "Текст и визуал готовы" },
  { day: "28", platform: "Telegram", title: "Коротко: что изменилось в продукте за месяц", status: "Черновик", image: "/marketing/adaptive-presence-mascots-v2.webp", readiness: "Текст готовится" },
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
        <div className="relative aspect-[4/5]"><Image src="/marketing/universal-brand-post-v1.webp" alt="Универсальный пример готовой публикации" fill priority sizes="(max-width:640px) 52vw, 310px" className="object-cover" /><div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/72 to-transparent p-3 sm:p-4"><div className="flex items-center gap-2"><PlatformBrandIcon platform="VK" size="xs" /><span className="text-[8px] font-semibold text-white/75">Пост готов к публикации</span></div><p className="mt-3 max-w-[210px] text-[10px] font-semibold leading-4 text-white sm:text-xs sm:leading-5">Как экспертность превращается в доверие к бренду</p></div></div>
      </article>

      <article className="absolute bottom-4 left-0 w-[43%] rotate-[-3deg] overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#f2effa] text-[#17131e] shadow-[0_28px_80px_rgba(0,0,0,.48)] sm:left-5 sm:w-[39%]">
        <div className="relative aspect-[16/9] overflow-hidden"><Image src="/marketing/adaptive-presence-longread-v2.webp" alt="Статья Дзен с изображениями" fill sizes="250px" className="object-cover" /></div>
        <div className="p-3 sm:p-4"><div className="flex items-center gap-2"><PlatformBrandIcon platform="Дзен" size="xs" /><span className="text-[8px] font-semibold text-black/45">Статья · 1 840 слов</span></div><p className="mt-2 line-clamp-2 text-[9px] font-semibold leading-4 sm:text-[11px]">Как клиент выбирает бренд до первого обращения</p></div>
      </article>

      <div className="absolute left-[38%] top-[49%] rounded-2xl border border-violet-300/20 bg-[#18131f]/95 px-3 py-2.5 shadow-xl backdrop-blur sm:px-4"><p className="text-[7px] text-white/35">Пример роста аудитории</p><p className="mt-1 text-xs font-semibold text-white sm:text-sm">+1 240 подписчиков</p></div>
      <div className="absolute right-[1%] top-[4%] rotate-6"><PlatformBrandIcon platform="Telegram" size="sm" /></div>
      <div className="absolute left-[1%] top-[35%] -rotate-6"><PlatformBrandIcon platform="Одноклассники" size="sm" /></div>
      <div className="absolute right-[2%] top-[45%] rotate-3"><PlatformBrandIcon platform="VC.ru" size="sm" /></div>
      <div className="absolute left-[34%] top-[1%] -rotate-3"><PlatformBrandIcon platform="Дзен" size="sm" /></div>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#9b87ff,#6d4aff)] text-[10px] font-black lowercase text-white shadow-[0_0_30px_rgba(124,92,255,.35)]">cc.</span>
      {!compact ? <span><span className="block text-sm font-semibold text-white">Adaptive Presence</span><span className="block text-[10px] text-white/35">продукт Creative Command</span></span> : null}
    </span>
  );
}

function YandexMapsMark({ size = "xs" }: { size?: "xs" | "sm" }) {
  return <span className={`grid shrink-0 place-items-center rounded-[9px] bg-white font-black text-[#ff2c2c] shadow-[0_8px_24px_rgba(15,23,42,.1)] ${size === "sm" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[11px]"}`}>Я</span>;
}

function TelegramMark({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${dark ? "bg-black text-white" : "bg-[#229ED9] text-white"}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M20.7 3.5 3.3 10.2c-1.2.5-1.2 1.1-.2 1.4l4.5 1.4 1.7 5.2c.2.6.1.8.8.8.5 0 .8-.2 1-.4l2.2-2.1 4.6 3.4c.9.5 1.5.3 1.7-.8l3-14.2c.3-1.4-.6-2-1.9-1.4Zm-2.4 3.3-7.5 6.8-.3 3.2-1.7-5.2 9.5-5.9c.5-.3.9-.1 0 1.1Z" /></svg>
    </span>
  );
}

function JourneyIcon({ step }: { step: number }) {
  const paths = [
    <path key="brief" d="M6 3h9l3 3v15H6zM9 11h6M9 15h6M15 3v4h4" />,
    <path key="brand" d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7zM9 12l2 2 4-4" />,
    <path key="mix" d="M4 6h16M4 12h16M4 18h16M7 3v6M16 9v6M10 15v6" />,
    <path key="production" d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />,
    <path key="calendar" d="M5 5h14v15H5zM8 3v4M16 3v4M5 9h14M8 13h2M13 13h3M8 17h4" />,
    <path key="result" d="M4 19h16M6 16l4-4 3 2 5-7M15 7h3v3" />,
  ];
  return <span className="grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/20 bg-violet-500/15 text-violet-200 shadow-[0_12px_35px_rgba(95,62,190,.2)]"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.6]" strokeLinecap="round" strokeLinejoin="round">{paths[step]}</svg></span>;
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
        <section className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.03]"><div className="grid sm:grid-cols-[1fr_150px]"><div className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Следующая публикация</p><p className="mt-1 text-[11px] text-white/35">17 августа · 11:00</p></div><span className="rounded-full bg-violet-500/12 px-3 py-1.5 text-[10px] font-semibold text-violet-200">готово</span></div><div className="mt-5 flex items-center gap-2"><PlatformBrandIcon platform="VK" size="xs" /><span className="text-[10px] text-white/35">VK</span></div><p className="mt-4 text-sm font-medium leading-6 text-white/85">Как экспертность превращается в доверие к бренду</p><button className="mt-5 text-[10px] font-semibold text-violet-300">Открыть материал →</button></div><div className="relative hidden min-h-64 sm:block"><Image src="/marketing/universal-brand-post-v1.webp" alt="Готовый визуал публикации" fill sizes="150px" className="object-cover" /></div></div></section>
        <section className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Неделя в цифрах</p><p className="mt-1 text-[10px] text-white/30">Обновлено 2 минуты назад</p></div><span className="text-[10px] font-semibold text-violet-300">+18%</span></div><div className="mt-6 flex h-24 items-end gap-2">{[34,48,42,65,58,82,76].map((height,index)=><div key={index} className="flex h-full flex-1 items-end"><span className="w-full rounded-t-md bg-[linear-gradient(180deg,#9d83ff,#6847d8)]" style={{height:`${height}%`}} /></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-black/20 p-3"><p className="text-lg font-semibold">48,6K</p><p className="mt-1 text-[9px] text-white/28">просмотров</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-lg font-semibold">326</p><p className="mt-1 text-[9px] text-white/28">переходов</p></div></div></section>
      </div>
      <section className="grid gap-3 rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4 sm:grid-cols-5">{(["Telegram","VK","Одноклассники","Дзен","VC.ru"] as PlatformBrand[]).map((name,index)=><div key={name} className="flex items-center gap-2.5 rounded-2xl bg-black/15 p-3"><PlatformBrandIcon platform={name} size="xs" /><div><p className="text-[10px] font-semibold text-white/65">{name}</p><p className="mt-0.5 text-[8px] text-white/28">{[4,5,3,2,2][index]} материала</p></div></div>)}</section>
    </div>
  );
}

function CalendarView() {
  const scheduled = new Map([[3,"VK"],[6,"TG"],[9,"ОК"],[12,"Дзен"],[15,"VK"],[18,"TG"],[21,"VC"],[24,"ОК"],[27,"VK"],[30,"TG"]]);
  const cells = Array.from({ length: 35 }, (_, index) => index < 2 || index > 32 ? null : index - 1);
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Календарь</p><h3 className="mt-2 text-2xl font-semibold text-white">Август 2026</h3></div><span className="text-[10px] text-white/35">18 материалов · без публикаций подряд</span></div>
      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=><span key={day} className="pb-1 text-center text-[9px] font-bold uppercase text-white/25">{day}</span>)}{cells.map((day,index)=><div key={index} className={`min-h-14 overflow-hidden rounded-xl border p-1.5 sm:min-h-20 sm:p-2 ${day ? "border-white/[0.05] bg-white/[0.025]" : "border-transparent"}`}>{day ? <><span className={`text-[10px] ${scheduled.has(day) ? "text-violet-200" : "text-white/25"}`}>{day}</span>{scheduled.has(day) ? <div className="relative mt-1.5 aspect-[16/8] overflow-hidden rounded-lg border border-violet-400/15 sm:aspect-[16/10]"><Image src={scheduled.get(day) === "Дзен" || scheduled.get(day) === "VC" ? "/marketing/adaptive-presence-longread-v2.webp" : "/marketing/universal-brand-post-v1.webp"} alt={`Материал ${scheduled.get(day)}`} fill sizes="100px" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" /><span className="absolute bottom-1 left-1.5 text-[7px] font-semibold text-white sm:text-[8px]">{scheduled.get(day)}</span></div> : null}</> : null}</div>)}</div>
    </section>
  );
}

function MaterialsView() {
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><p className="text-sm font-semibold text-white">Материалы месяца</p><p className="mt-1 text-[10px] text-white/35">Откройте текст, визуал или карусель</p></div><button className="rounded-xl bg-violet-500 px-3 py-2 text-[10px] font-semibold text-white">+ Быстрый анонс</button></div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{materials.map((material,index)=><article key={material.title} className="group overflow-hidden rounded-[20px] border border-white/[0.06] bg-black/15 transition hover:border-violet-400/20 hover:bg-white/[0.035]"><div className="relative aspect-[16/8] overflow-hidden"><Image src={material.image} alt={`Визуал материала для ${material.platform}`} fill sizes="320px" className={`object-cover transition duration-500 group-hover:scale-[1.03] ${index === 1 || index === 5 ? "object-[50%_65%]" : ""}`} /><div className="absolute inset-0 bg-gradient-to-t from-[#0d0c12] via-transparent to-transparent" /><span className="absolute left-3 top-3"><PlatformBrandIcon platform={material.platform} size="xs" /></span><span className="absolute bottom-2.5 right-3 text-[9px] font-semibold text-white/75">{material.day} августа</span></div><div className="p-4"><div className="flex items-center justify-between gap-2"><span className="text-[9px] text-white/30">{material.platform}</span><span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${material.status === "Готово" ? "bg-violet-500/12 text-violet-200" : material.status === "Редактура" ? "bg-amber-400/10 text-amber-200" : "bg-white/[0.06] text-white/40"}`}>{material.status}</span></div><p className="mt-3 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-white/82">{material.title}</p><p className="mt-3 border-t border-white/[0.05] pt-3 text-[9px] text-white/28">{material.readiness}</p></div></article>)}</div>
    </section>
  );
}

function ArticlesView() {
  const articles = [
    { platform: "Дзен" as PlatformBrand, title: "Как клиент выбирает бренд до первого обращения", words: "1 840 слов", state: "Готова", image: "/marketing/adaptive-presence-longread-v2.webp", details: "Обложка · 4 изображения · оглавление" },
    { platform: "VC.ru" as PlatformBrand, title: "Как связать статьи и короткие посты в одну систему", words: "1 520 слов", state: "Редактура", image: "/marketing/adaptive-presence-hero-v2.webp", details: "Обложка · 3 изображения · источники" },
  ];
  return (
    <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-3"><MetricCard label="Статей" value="2" detail="в этом месяце" /><MetricCard label="Изображений" value="9" detail="с обложками" /><MetricCard label="Средний объём" value="1 680" detail="слов" /></section><section className="grid gap-3 md:grid-cols-2">{articles.map((article)=><article key={article.title} className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.03]"><div className="relative aspect-[16/7] overflow-hidden"><Image src={article.image} alt={`Обложка статьи ${article.platform}`} fill sizes="450px" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#111018] via-black/10 to-transparent" /><span className="absolute left-4 top-4"><PlatformBrandIcon platform={article.platform} size="xs" /></span><span className="absolute bottom-3 left-4 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-semibold text-white/80 backdrop-blur">{article.state}</span></div><div className="p-5"><div className="flex items-center justify-between text-[9px]"><span className="text-white/32">{article.details}</span><span className="text-white/25">{article.words}</span></div><h3 className="mt-3 min-h-12 text-sm font-semibold leading-5 text-white/82">{article.title}</h3><div className="mt-5 grid grid-cols-2 gap-2"><button className="rounded-xl bg-violet-500 px-3 py-2.5 text-[10px] font-semibold text-white">Открыть</button><button className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 text-[10px] font-semibold text-white/55">Скачать ↓</button></div></div></article>)}</section></div>
  );
}

function AutopostingView() {
  const rules = [
    ["Публиковать подтверждённое по календарю","Материал уходит автоматически в выбранное время","активно"],
    ["Адаптировать одну тему под площадку","Для VK готовится подробная версия, для Telegram короткая","активно"],
    ["Повторить при технической ошибке","Три безопасные попытки и понятное уведомление","активно"],
    ["Требовать подтверждение","Ничего не публикуется без вашего решения","выключено"],
  ];
  const queue: Array<{ time: string; platform: PlatformBrand; title: string; image: string }> = [
    { time: "17 авг · 11:00", platform: "VK", title: "Экспертность и доверие к бренду", image: "/marketing/universal-brand-post-v1.webp" },
    { time: "20 авг · 13:30", platform: "VC.ru", title: "Как связать статьи и короткие посты", image: "/marketing/adaptive-presence-hero-v2.webp" },
    { time: "24 авг · 10:00", platform: "Одноклассники", title: "Пять привычек сильного бренда", image: "/marketing/adaptive-presence-mascots-v2.webp" },
  ];
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3"><MetricCard label="Активных правил" value="3/4" detail="работают" /><MetricCard label="Публикаций · 7 дней" value="4" detail="без ошибок" tone="mint" /><MetricCard label="Следующая" value="11:00" detail="завтра" /></section>
      <div className="grid gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Правила автопостинга</p><p className="mt-1 text-[10px] text-white/35">Система работает вместо ручных публикаций</p></div><button className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[10px] font-semibold text-white/70">Настроить</button></div><div className="mt-4 space-y-2.5">{rules.map(([title,description,state],index)=><article key={title} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-black/15 p-3.5"><span className={`relative h-5 w-9 shrink-0 rounded-full ${index < 3 ? "bg-violet-500" : "bg-white/10"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${index < 3 ? "left-[18px]" : "left-0.5"}`} /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-white/80">{title}</p><p className="mt-1 text-[10px] text-white/30">{description}</p></div><span className="text-[9px] text-white/25">{state}</span></article>)}</div></section>
        <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Очередь публикаций</p><p className="mt-1 text-[10px] text-white/35">Ближайшие материалы</p></div><span className="flex items-center gap-1.5 text-[9px] text-violet-200"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />работает</span></div><div className="mt-4 space-y-2.5">{queue.map((item,index)=><article key={item.title} className="grid grid-cols-[54px_minmax(0,1fr)] gap-3 rounded-2xl border border-white/[0.05] bg-black/15 p-2.5"><div className="relative aspect-square overflow-hidden rounded-xl"><Image src={item.image} alt={`Визуал публикации ${item.platform}`} fill sizes="54px" className="object-cover" /></div><div className="min-w-0"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[9px] text-white/45"><PlatformBrandIcon platform={item.platform} size="xs" />{item.platform}</span><span className="text-[8px] text-white/24">{index === 0 ? "следующая" : "в очереди"}</span></div><p className="mt-2 truncate text-[10px] font-medium text-white/72">{item.title}</p><p className="mt-1 text-[8px] text-violet-300">{item.time}</p></div></article>)}</div></section>
      </div>
    </div>
  );
}

function ResultsView() {
  const reach = [35,52,44,68,73,82,96];
  const transitions = [18,29,34,41,56,64,78];
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-4"><MetricCard label="Охват" value="186K" detail="+38%" /><MetricCard label="Новые подписчики" value="1 240" detail="+410 за месяц" /><MetricCard label="Вовлечение" value="4,8%" detail="+1,3 п.п." /><MetricCard label="Переходы" value="3 960" detail="+24%" /></section>
      <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">Динамика присутствия</p><p className="mt-1 text-[10px] text-white/35">Пример отчёта после подключения площадок</p></div><span className="rounded-full border border-white/[0.07] px-3 py-1.5 text-[9px] text-white/30">демонстрационные данные</span></div>
        <div className="mt-5 flex gap-5 text-[9px]"><span className="flex items-center gap-2 text-white/38"><span className="h-2 w-2 rounded-full bg-violet-400" />охват</span><span className="flex items-center gap-2 text-white/38"><span className="h-2 w-2 rounded-full bg-fuchsia-300" />переходы</span></div>
        <div className="relative mt-5 h-52 border-b border-white/[0.06]"><svg viewBox="0 0 700 180" preserveAspectRatio="none" className="absolute inset-0 h-[180px] w-full" aria-hidden="true"><defs><linearGradient id="resultArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8f72ff" stopOpacity=".42"/><stop offset="1" stopColor="#8f72ff" stopOpacity="0"/></linearGradient></defs><path d={`M 0 ${180-reach[0]*1.5} ${reach.map((value,index)=>`L ${index*116.6} ${180-value*1.5}`).join(" ")} L 700 180 L 0 180 Z`} fill="url(#resultArea)"/><polyline points={reach.map((value,index)=>`${index*116.6},${180-value*1.5}`).join(" ")} fill="none" stroke="#9b82ff" strokeWidth="4"/><polyline points={transitions.map((value,index)=>`${index*116.6},${180-value*1.5}`).join(" ")} fill="none" stroke="#e8a8ff" strokeWidth="3" strokeDasharray="7 7"/></svg><div className="absolute inset-x-0 bottom-[-22px] grid grid-cols-7">{["Фев","Мар","Апр","Май","Июн","Июл","Авг"].map(month=><span key={month} className="text-center text-[9px] text-white/22">{month}</span>)}</div></div>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">{[["Лучший формат","Статья Дзен","64 200 просмотров"],["Сильная площадка","VK","+620 подписчиков"],["Следующая точка роста","Telegram","увеличить долю анонсов"]].map(([label,value,detail])=><div key={label} className="rounded-2xl border border-white/[0.05] bg-black/15 p-4"><p className="text-[9px] uppercase tracking-[0.12em] text-white/25">{label}</p><p className="mt-3 text-sm font-semibold text-white/80">{value}</p><p className="mt-1 text-[10px] text-violet-300">{detail}</p></div>)}</div>
      </section>
    </div>
  );
}

function DemoWorkspace() {
  const [activeView, setActiveView] = useState<DemoView>("overview");
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#0d0c12] shadow-[0_40px_140px_rgba(0,0,0,.55),0_0_0_1px_rgba(139,92,246,.05)]">
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.06] bg-black/20 px-4"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" /><span className="ml-2 text-[9px] font-medium text-white/25">app.adaptivepresence.ai</span></div>
      <div className="grid min-h-[640px] lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/[0.06] bg-black/15 p-4 lg:flex lg:flex-col">
          <BrandMark />
          <div className="mt-7 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"><p className="text-[10px] text-white/30">Пример бренда</p><p className="mt-1 text-xs font-semibold text-white/80">Линия</p><p className="mt-1 flex items-center gap-1.5 text-[9px] text-violet-300"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />месяц готовится</p></div>
          <nav className="mt-6 space-y-1">{views.map(view=><button key={view.id} onClick={()=>setActiveView(view.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition ${activeView===view.id ? "border border-violet-400/25 bg-violet-500/12 text-white" : "border border-transparent text-white/40 hover:bg-white/[0.03] hover:text-white/70"}`}><span className="w-4 text-center text-violet-300/80">{view.icon}</span>{view.label}</button>)}</nav>
          <div className="mt-auto space-y-3 border-t border-white/[0.06] pt-4"><p className="text-[10px] text-white/30">Бренд и площадки</p><p className="text-[10px] text-white/30">Пример кабинета</p><div className="rounded-xl bg-violet-500/10 px-3 py-2 text-[10px] font-semibold text-violet-200">7 000 кредитов</div></div>
        </aside>
        <main className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6"><p className="text-[10px] text-white/30">Линия · <span className="text-white/65">{views.find(view=>view.id===activeView)?.label}</span></p><div className="flex items-center gap-2"><span className="hidden text-[9px] text-white/25 sm:block">обновлено 2 минуты назад</span><span className="hidden rounded-xl border border-violet-400/15 bg-violet-500/10 px-3 py-2 text-[9px] font-semibold text-violet-200 sm:block">7 000 кредитов</span><span className="hidden rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[9px] text-white/25 sm:block">⌘ Поиск</span><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-200">Л</span></div></header>
          <div className="border-b border-white/[0.05] px-3 py-2 lg:hidden"><div className="flex gap-1 overflow-x-auto">{views.map(view=><button key={view.id} onClick={()=>setActiveView(view.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-semibold ${activeView===view.id ? "bg-violet-500 text-white" : "text-white/35"}`}>{view.label}</button>)}</div></div>
          <div className="p-4 sm:p-6">{activeView === "overview" ? <OverviewView /> : activeView === "calendar" ? <CalendarView /> : activeView === "materials" ? <MaterialsView /> : activeView === "articles" ? <ArticlesView /> : activeView === "autoposting" ? <AutopostingView /> : <ResultsView />}</div>
        </main>
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
  { platform: "Telegram", title: "Посты Telegram", description: "Живой короткий формат без канцелярита и повторов из VK.", badge: "свой стиль общения" },
  { platform: "Одноклассники", title: "Посты ОК", description: "Понятная подача для локальной и зрелой аудитории бренда.", badge: "адаптация площадки" },
  { platform: "Дзен", title: "Статьи Дзен", description: "Структурные материалы с обложкой и несколькими изображениями.", badge: "подробная статья" },
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
              <div className="flex items-center gap-3"><PlatformBrandIcon platform={format.platform} size="md" /><div><p className={`text-[9px] font-bold uppercase tracking-[0.12em] ${index === 3 || index === 4 ? "text-violet-300" : "text-violet-700"}`}>{format.platform}</p><h3 className="mt-1 text-lg font-semibold tracking-[-0.025em]">{format.title}</h3></div></div>
              <p className={`mt-7 text-[9px] font-bold uppercase tracking-[0.14em] ${index === 3 || index === 4 ? "text-violet-300" : "text-violet-700"}`}>{format.badge}</p>
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

function BusinessOutcomes() {
  return (
    <section id="outcomes" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mb-12 grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-end">
        <div><SectionLabel>Что получает бизнес</SectionLabel><h2 className="mt-5 max-w-2xl font-heading text-4xl font-semibold leading-[.94] tracking-[-0.06em] sm:text-6xl">Контент должен приводить к результату</h2></div>
        <div><p className="max-w-2xl text-sm leading-7 text-white/44">Не абстрактные «охваты», а понятные точки присутствия: публикация в ленте, статья в поиске, упоминание в ответе нейросети и переход в продукт.</p><p className="mt-3 text-[9px] uppercase tracking-[0.13em] text-white/20">Ниже — интерфейсный пример. Показатели отмечены как демонстрационные данные.</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.12fr_.88fr]">
        <article className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#f6f4fb] text-[#17141e] shadow-[0_35px_100px_rgba(0,0,0,.25)]">
          <div className="flex items-center justify-between border-b border-black/[0.07] px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#7c5cff,#ff5b7f)] text-sm font-black text-white">Я</span><div><p className="text-xs font-semibold">Алиса</p><p className="text-[9px] text-black/35">пример нейросетевой выдачи</p></div></div><span className="rounded-full bg-violet-100 px-3 py-1.5 text-[9px] font-semibold text-violet-700">видимость в нейросетях</span></div>
          <div className="p-5 sm:p-7"><div className="ml-auto max-w-[82%] rounded-[20px_20px_5px_20px] bg-violet-600 px-4 py-3 text-xs leading-5 text-white">Как выстроить регулярное присутствие бренда без большой команды?</div><div className="mt-5 flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black text-[10px] text-white">✦</span><div className="text-xs leading-6 text-black/65"><p>Подход можно собрать вокруг единого профиля бренда, календаря и адаптации материалов под разные площадки.</p><p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 font-medium text-violet-950">В числе решений упоминается Adaptive Presence: система готовит посты, статьи и визуалы на основе одного брифа.</p><div className="mt-4 flex flex-wrap gap-2">{["Дзен", "VC.ru", "сайт бренда"].map(source=><span key={source} className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[9px] text-black/45">источник · {source}</span>)}</div></div></div></div>
          <div className="border-t border-black/[0.06] bg-white/65 px-5 py-4 text-[9px] text-black/35">Появление бренда в конкретном ответе не гарантируется. Система создаёт и поддерживает цифровой след, который можно измерять.</div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <article className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03]"><div className="grid grid-cols-[1fr_112px]"><div className="p-5"><div className="flex items-center gap-2"><PlatformBrandIcon platform="VK" size="xs" /><span className="text-[10px] font-semibold text-white/55">Публикация VK</span></div><h3 className="mt-4 text-base font-semibold leading-6 text-white/88">Как системный контент сокращает путь до первого обращения</h3><div className="mt-6 flex gap-5"><div><p className="text-xl font-semibold">38,4K</p><p className="mt-1 text-[8px] text-white/25">пример просмотров</p></div><div><p className="text-xl font-semibold">620</p><p className="mt-1 text-[8px] text-white/25">пример подписок</p></div></div></div><div className="relative min-h-56"><Image src="/marketing/universal-brand-post-v1.webp" alt="Пример готовой публикации VK" fill sizes="112px" className="object-cover" /></div></div></article>
          <article className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03]"><div className="relative h-28"><Image src="/marketing/adaptive-presence-longread-v2.webp" alt="Пример статьи Дзен" fill sizes="420px" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#111018] to-transparent" /><span className="absolute bottom-3 left-4 flex items-center gap-2 text-[9px] font-semibold"><PlatformBrandIcon platform="Дзен" size="xs" />Статья Дзен</span></div><div className="p-5"><h3 className="text-base font-semibold leading-6">Как клиент выбирает бренд ещё до первого обращения</h3><div className="mt-5 flex items-center justify-between text-[9px]"><span className="text-white/28">1 840 слов · 4 изображения</span><span className="font-semibold text-violet-300">64,2K чтений · пример</span></div></div></article>
        </div>
      </div>

      <div className="mt-4 grid gap-4 rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center sm:p-7">{[["01","Материал опубликован"],["02","Получен просмотр"],["03","Человек перешёл"],["04","Результат попал в отчёт"]].map(([number,label],index)=><div key={number} className="contents"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-[9px] font-semibold text-violet-200">{number}</span><span className="text-[10px] leading-4 text-white/48">{label}</span></div>{index < 3 ? <span className="hidden text-white/15 sm:block">→</span> : null}</div>)}</div>
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

function ClientJourney() {
  const steps = [
    ["Бриф", "Сайт и ответы превращаются в контекст бренда.", "контекст собран"],
    ["Профиль", "Вы проверяете аудиторию, продукты и стиль.", "бренд понят"],
    ["Набор месяца", "Выбираете посты, статьи, визуалы и карусели.", "объём выбран"],
    ["Производство", "Система готовит тексты и изображения.", "материалы готовы"],
    ["Календарь", "Публикации распределяются с нормальным ритмом.", "даты расставлены"],
    ["Публикация", "Вы подтверждаете, а результат попадает в отчёт.", "цикл замкнут"],
  ];
  return (
    <section id="how" className="border-t border-white/[0.06] py-24 sm:py-28">
      <div className="grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-end">
        <div><SectionLabel>Путь клиента</SectionLabel><h2 className="mt-4 max-w-3xl font-heading text-4xl font-semibold leading-[.98] tracking-[-0.05em] sm:text-6xl">От знакомства до публикации</h2></div>
        <p className="max-w-2xl text-sm leading-7 text-white/40">Один последовательный маршрут. Каждый шаг заканчивается понятным результатом, поэтому в кабинете всегда видно, что делать дальше.</p>
      </div>

      <div className="relative mt-14">
        <div className="absolute left-6 top-6 hidden h-px w-[calc(100%-3rem)] bg-[linear-gradient(90deg,rgba(139,110,255,.65),rgba(139,110,255,.08))] lg:block" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {steps.map(([title, description, result], index) => (
            <article key={title} className="relative rounded-[24px] border border-white/[0.07] bg-[#0f0d14] p-5 transition hover:border-violet-400/22 hover:bg-[#12101a]">
              <div className="relative z-10 flex items-center justify-between gap-3"><JourneyIcon step={index} /><span className="text-[9px] font-semibold text-white/22">0{index + 1}</span></div>
              <h3 className="mt-6 text-base font-semibold text-white/88">{title}</h3>
              <p className="mt-3 min-h-16 text-[11px] leading-5 text-white/34">{description}</p>
              <p className="mt-5 border-t border-white/[0.06] pt-4 text-[9px] font-semibold text-violet-300">✓ {result}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-violet-400/18 bg-violet-500/[0.07] px-5 py-4"><p className="text-xs text-white/46"><span className="font-semibold text-white/82">На пробном доступе:</span> пройдите бриф и получите первые материалы, не подключая площадки.</p><Link href="/start" className="text-xs font-semibold text-violet-200">Начать путь →</Link></div>
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
    <section id="results" className="scroll-mt-24 bg-[#0d0b12] py-24 text-white sm:py-28">
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
          <div className="relative aspect-[16/10] overflow-hidden rounded-[30px] bg-[#100d18] shadow-[0_30px_90px_rgba(76,51,135,.22)]"><Image src="/marketing/adaptive-presence-mascots-v2.webp" alt="Маскоты Adaptive Presence работают с контент-календарём" fill sizes="(max-width:1024px) 92vw, 760px" className="object-cover" /><div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.13em] text-violet-200 backdrop-blur">Внутри — опыт Creative Command</div></div>
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
  const formatExamples = [
    ["Быстрый пост", CREDIT_PRODUCTS.quick_announcement.credits],
    ["Пост с визуалом", CREDIT_PRODUCTS.visual_post.credits],
    ["Статья с обложкой", CREDIT_PRODUCTS.article_with_cover.credits],
    ["Карусель · 4 слайда", CREDIT_PRODUCTS.carousel.credits],
    ["Ответ на отзыв", CREDIT_PRODUCTS.review_reply.credits],
  ] as const;

  return (
    <section id="pricing" className="scroll-mt-6 border-t border-white/[0.06] py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Стоимость</p>
          <h2 className="mt-3 max-w-3xl font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl">Выбирайте объём под себя</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/40">Кредиты можно распределить между постами, статьями, визуалами и каруселями в любой пропорции.</p>
        </div>
        <Link href="/start" className="inline-flex w-fit rounded-2xl bg-white px-5 py-3 text-xs font-semibold text-black transition hover:bg-violet-100">Попробовать бесплатно</Link>
      </div>

      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap gap-2 rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-1.5">
        {BILLING_DURATIONS.map((item) => {
          return <button key={item.months} type="button" onClick={() => setMonths(item.months)} className={`rounded-xl px-4 py-2.5 text-left text-[11px] font-semibold transition ${months === item.months ? "bg-violet-500 text-white shadow-[0_8px_24px_rgba(112,78,255,.24)]" : "text-white/42 hover:bg-white/[0.04]"}`}><span>{item.label}</span>{item.discountPercent ? <span className={`ml-2 ${months === item.months ? "text-white/70" : "text-violet-300"}`}>−{item.discountPercent}%</span> : null}</button>;
        })}
      </div>

      <div className="mx-auto mt-4 grid max-w-6xl gap-3 lg:grid-cols-3">
        {CREDIT_PLANS.map((plan) => {
          const totalPrice = subscriptionPriceMinor(plan.code, months);
          const monthlyPrice = Math.round(totalPrice / months);
          const saving = plan.monthlyPriceMinor * months - totalPrice;
          return <article key={plan.code} className={`relative overflow-hidden rounded-[24px] border p-5 ${"featured" in plan && plan.featured ? "border-violet-400/30 bg-[linear-gradient(145deg,rgba(115,78,255,.18),rgba(255,255,255,.03))] shadow-[0_24px_70px_rgba(66,43,140,.16)]" : "border-white/[0.07] bg-white/[0.025]"}`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">{plan.name}</p>{"featured" in plan && plan.featured ? <span className="rounded-full bg-violet-500/16 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-violet-200">оптимальный</span> : null}</div><div className="mt-5 flex items-end gap-2"><p className="font-heading text-3xl font-semibold tracking-[-0.05em] text-white">{formatRubles(monthlyPrice)} ₽</p><span className="pb-1 text-[9px] text-white/28">в месяц</span></div><div className="mt-3 flex items-center justify-between rounded-xl bg-black/15 px-3 py-2"><span className="text-sm font-semibold text-violet-200">{displayCredits(plan.credits)} кредитов</span><span className="text-[8px] text-white/25">ежемесячно</span></div><ul className="mt-4 space-y-2 text-[11px] text-white/42"><li>✓ Любые форматы</li><li>✓ Тексты и визуалы под бренд</li><li>✓ Календарь и публикации</li></ul><p className="mt-4 min-h-8 text-[9px] leading-4 text-white/26">{plan.description}</p>{saving > 0 ? <p className="mt-2 text-[9px] font-semibold text-violet-300">Экономия {formatRubles(saving)} ₽ за период</p> : <p className="mt-2 text-[9px] text-white/20">Срок можно изменить</p>}<Link href="/start" className={`mt-4 flex justify-center rounded-xl px-4 py-3 text-[11px] font-semibold transition ${"featured" in plan && plan.featured ? "bg-violet-500 text-white hover:bg-violet-400" : "border border-white/[0.09] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"}`}>Выбрать</Link></article>;
        })}
      </div>

      <div className="mx-auto mt-4 max-w-6xl rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-4">
        <div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/28">Примеры расхода</span>{formatExamples.map(([label, credits]) => <div key={label} className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-black/15 px-3 py-2"><span className="text-[10px] text-white/44">{label}</span><span className="text-[10px] font-semibold text-violet-200">{displayCredits(credits)}</span></div>)}</div>
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
          <nav className="hidden items-center gap-7 text-[11px] font-medium text-white/48 lg:flex"><a href="#product" className="transition hover:text-white">Продукт</a><a href="#formats" className="transition hover:text-white">Форматы</a><a href="#articles" className="transition hover:text-white">Статьи</a><a href="#outcomes" className="transition hover:text-white">Результат</a><a href="#pricing" className="transition hover:text-white">Тарифы</a><a href="#faq" className="transition hover:text-white">Вопросы</a><Link href="/sign-in" className="transition hover:text-white">Войти</Link></nav>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setMobileMenuOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] text-sm text-white/70 lg:hidden" aria-label="Открыть меню">{mobileMenuOpen ? "×" : "≡"}</button><Link href="/start" className="rounded-full bg-white px-4 py-2.5 text-[11px] font-semibold text-black transition hover:bg-violet-100 sm:px-5">Попробовать</Link></div>
        </div>
        {mobileMenuOpen ? <nav className="grid gap-1 border-t border-white/[0.06] bg-[#0b0910] px-4 py-4 text-sm text-white/65 lg:hidden">{[["#product","Продукт"],["#formats","Форматы"],["#articles","Статьи"],["#outcomes","Результат"],["#pricing","Тарифы"],["#faq","Вопросы"]].map(([href,label])=><a key={href} href={href} onClick={()=>setMobileMenuOpen(false)} className="rounded-xl px-3 py-3 hover:bg-white/[0.04]">{label}</a>)}<Link href="/sign-in" className="rounded-xl px-3 py-3 hover:bg-white/[0.04]">Войти</Link></nav> : null}
      </header>

      <div className="relative mx-auto max-w-[1320px] px-4 sm:px-7">
        <section className="grid min-h-[780px] items-center gap-12 pb-16 pt-16 lg:grid-cols-[1.02fr_.98fr] lg:py-24">
          <div className="relative z-10"><span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" />ИИ-система присутствия бренда</span><h1 className="mt-7 max-w-4xl font-heading text-5xl font-semibold leading-[.92] tracking-[-0.065em] text-white sm:text-7xl lg:text-[82px]">Ваш бренд<br />выходит <span className="bg-[linear-gradient(90deg,#d6cdff,#9a81ff,#7656ff)] bg-clip-text text-transparent">сам.</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-white/46 sm:text-lg">Заполните бриф и получите готовый контент-месяц для российских площадок. Тексты, статьи, визуалы и даты публикаций появятся в одном кабинете.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/start" className="rounded-2xl bg-violet-500 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-[0_18px_55px_rgba(112,78,255,.3)] transition hover:bg-violet-400">Собрать пробный месяц</Link><a href="#product" className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-6 py-3.5 text-center text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white">Посмотреть кабинет</a></div><div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-white/28"><span>500 пробных кредитов</span><span>работа без менеджера</span><span>старт за 10 минут</span></div></div>
          <HeroProductMontage />
        </section>

        <section className="border-y border-white/[0.06] py-7"><p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/22">Площадки и каналы Adaptive Presence</p><div className="mt-5 flex flex-wrap items-center justify-center gap-6 sm:gap-10">{(["VK","Telegram","Одноклассники","Дзен","VC.ru"] as PlatformBrand[]).map(platform=><span key={platform} className="flex items-center gap-2.5 text-[11px] font-semibold text-white/42"><PlatformBrandIcon platform={platform} size="xs" />{platform}</span>)}<span className="flex items-center gap-2.5 text-[11px] font-semibold text-white/42"><YandexMapsMark />Яндекс Карты</span></div></section>

        <section id="product" className="scroll-mt-24 py-24 sm:py-28"><div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><SectionLabel>Живой продукт</SectionLabel><h2 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">Не презентация.<br />Попробуйте кабинет.</h2></div><p className="max-w-md text-xs leading-6 text-white/36">Переключайте обзор, календарь, материалы, статьи, автопостинг и результаты прямо на этой странице.</p></div><DemoWorkspace /></section>

        <BusinessOutcomes />
      </div>

      <PlatformFormats />

      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <ArticlePipeline />

        <ClientJourney />
      </div>

      <ResultsReport />
      <CreativeCommandStory />

      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <PublicPricing />
        <FAQ />

        <section className="mb-20 overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,.9),transparent_30%),linear-gradient(135deg,#ddd4ff,#f4f0ff_55%,#e4ddff)] p-7 text-[#14111b] shadow-[0_40px_130px_rgba(78,54,145,.22)] sm:p-12 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">Пробный доступ</p><h2 className="mt-5 max-w-4xl font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Попробуйте Adaptive Presence бесплатно</h2><p className="mt-6 max-w-2xl text-sm leading-7 text-black/55">Получите {displayCredits(TRIAL_CREDITS)} пробных кредитов. Заполните бриф, соберите профиль бренда и откройте первые материалы. Подписка и подключение площадок на этом этапе не нужны.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/start" className="rounded-2xl bg-black px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-violet-700">Попробовать бесплатно →</Link><Link href="/sign-in" className="rounded-2xl border border-black/10 bg-white/45 px-6 py-3.5 text-center text-sm font-semibold text-black/65 transition hover:bg-white/70">Уже есть аккаунт</Link></div></div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">{[[displayCredits(TRIAL_CREDITS),"кредитов на знакомство"],["0 ₽","до выбора подписки"],["3 шага","бриф, профиль, материалы"]].map(([value,label],index)=><div key={label} className={`rounded-[22px] border border-black/[0.07] bg-white/55 p-5 backdrop-blur ${index === 1 ? "lg:ml-8" : index === 2 ? "lg:ml-16" : ""}`}><p className="text-2xl font-semibold tracking-[-0.04em]">{value}</p><p className="mt-2 text-[10px] text-black/42">{label}</p></div>)}</div>
          </div>
        </section>

        <footer className="border-t border-white/[0.06] py-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr_1.15fr]">
            <div><BrandMark /><p className="mt-5 max-w-xs text-[11px] leading-5 text-white/28">ИИ-система регулярного присутствия бренда. Продукт Creative Command.</p></div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-[11px] text-white/38"><a href="#product">Продукт</a><a href="#formats">Форматы</a><a href="#pricing">Тарифы</a><a href="#results">Результаты</a><a href="#faq">Вопросы</a><Link href="/sign-in">Войти</Link></div>
            <a href="https://t.me/creative_command" target="_blank" rel="noreferrer" className="group rounded-[24px] border border-violet-400/16 bg-[linear-gradient(135deg,rgba(184,164,255,.16),rgba(255,255,255,.035))] p-5 transition hover:border-violet-300/28 hover:bg-violet-500/[0.1]"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white">Telegram-канал Creative Command</p><p className="mt-2 max-w-sm text-[10px] leading-5 text-white/32">Кейсы агентства, наблюдения о брендах и новости продукта.</p></div><TelegramMark /></div><span className="mt-5 inline-flex text-[10px] font-semibold text-violet-300 transition group-hover:text-violet-200">Открыть Telegram →</span></a>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-6 text-[9px] text-white/20"><p>© 2026 Creative Command · Adaptive Presence</p><p>Создано в России для российских площадок</p></div>
        </footer>
      </div>
    </main>
  );
}
