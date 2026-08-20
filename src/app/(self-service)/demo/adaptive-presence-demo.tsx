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

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#9b87ff,#6d4aff)] text-[10px] font-black lowercase text-white shadow-[0_0_30px_rgba(124,92,255,.35)]">cc.</span>
      {!compact ? <span><span className="block text-sm font-semibold text-white">Adaptive Presence</span><span className="block text-[10px] text-white/35">by Creative Command</span></span> : null}
    </span>
  );
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
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Август · контент-месяц</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">8 из 10 материалов готовы</h3><p className="mt-2 max-w-xl text-xs leading-5 text-white/45">Тексты, статьи и визуалы готовятся автоматически. Два материала ждут вашего решения.</p></div>
          <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200">обновлено сейчас</span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full w-4/5 rounded-full bg-[linear-gradient(90deg,#7454ff,#43d5ae)]" /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><MetricCard label="Материалов" value="10" detail="план месяца" /><MetricCard label="Готово" value="8" detail="80%" /><MetricCard label="Опубликовано" value="4" detail="+2 за неделю" tone="mint" /></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Следующая публикация</p><p className="mt-1 text-[11px] text-white/35">завтра · 11:00 · Telegram</p></div><span className="rounded-full bg-violet-500/12 px-3 py-1.5 text-[10px] font-semibold text-violet-200">готово</span></div><div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4"><p className="text-sm font-medium leading-5 text-white/85">Три ошибки при выборе оборудования для газоснабжения дома</p><p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/35">Цена — не единственный критерий. Показываем, какие параметры нужно проверить до покупки.</p></div></section>
        <section className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-5"><p className="text-sm font-semibold text-white">Автопостинг</p><div className="mt-4 space-y-3">{[["Telegram","подключён"],["VK","подключён"],["Дзен","экспорт готов"]].map(([name,status],index)=><div key={name} className="flex items-center justify-between text-xs"><span className="text-white/65">{name}</span><span className={index < 2 ? "text-emerald-300" : "text-white/35"}>{status}</span></div>)}</div></section>
      </div>
    </div>
  );
}

function CalendarView() {
  const scheduled = new Map([[6,"VK"],[10,"TG"],[15,"Дзен"],[20,"VC"],[24,"VK"],[28,"TG"]]);
  const cells = Array.from({ length: 35 }, (_, index) => index < 2 || index > 32 ? null : index - 1);
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Календарь</p><h3 className="mt-2 text-2xl font-semibold text-white">Август 2026</h3></div><span className="text-[10px] text-white/35">10 материалов</span></div>
      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=><span key={day} className="pb-1 text-center text-[9px] font-bold uppercase text-white/25">{day}</span>)}{cells.map((day,index)=><div key={index} className={`min-h-14 overflow-hidden rounded-xl border p-1.5 sm:min-h-20 sm:p-2 ${day ? "border-white/[0.05] bg-white/[0.025]" : "border-transparent"}`}>{day ? <><span className={`text-[10px] ${scheduled.has(day) ? "text-violet-200" : "text-white/25"}`}>{day}</span>{scheduled.has(day) ? <div className={`mt-1.5 overflow-hidden rounded-lg border border-violet-400/15 ${day % 3 === 0 ? "bg-[linear-gradient(135deg,#6d55bf,#242035)]" : day % 2 === 0 ? "bg-[linear-gradient(135deg,#253e49,#6d4aff)]" : "bg-[linear-gradient(135deg,#4c2b54,#a46672)]"}`}><div className="aspect-[16/7] px-1.5 py-1 text-[8px] font-semibold text-white/80 sm:aspect-[16/9] sm:text-[9px]">{scheduled.get(day)}</div></div> : null}</> : null}</div>)}</div>
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
    ["Адаптировать одну тему под площадку","VK получает подробную версию, Telegram — короткую","активно"],
    ["Повторить при технической ошибке","Три безопасные попытки и понятное уведомление","активно"],
    ["Требовать подтверждение","Ничего не публикуется без вашего решения","выключено"],
  ];
  return (
    <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-3"><MetricCard label="Активных правил" value="3/4" detail="работают" /><MetricCard label="Публикаций · 7 дней" value="4" detail="без ошибок" tone="mint" /><MetricCard label="Следующая" value="11:00" detail="завтра" /></section><section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Правила автопостинга</p><p className="mt-1 text-[10px] text-white/35">Система работает вместо ручных публикаций</p></div><button className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[10px] font-semibold text-white/70">Настроить</button></div><div className="mt-4 space-y-2.5">{rules.map(([title,description,state],index)=><article key={title} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-black/15 p-3.5"><span className={`relative h-5 w-9 shrink-0 rounded-full ${index < 3 ? "bg-violet-500" : "bg-white/10"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${index < 3 ? "left-[18px]" : "left-0.5"}`} /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-white/80">{title}</p><p className="mt-1 text-[10px] text-white/30">{description}</p></div><span className="text-[9px] text-white/25">{state}</span></article>)}</div></section></div>
  );
}

function ResultsView() {
  return (
    <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-4"><MetricCard label="План месяца" value="10" detail="8 готовы" /><MetricCard label="Опубликовано" value="4" detail="40% плана" /><article className="rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/35">Просмотры</p><div className="mt-3 flex items-end justify-between gap-3"><p className="text-2xl font-semibold text-white">—</p><span className="text-right text-[9px] text-white/25">после подключения метрик</span></div><p className="mt-4 text-[9px] text-white/18">без прогнозных значений</p></article><article className="rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/35">Вовлечение</p><div className="mt-3 flex items-end justify-between gap-3"><p className="text-2xl font-semibold text-white">—</p><span className="text-right text-[9px] text-white/25">только реальные данные</span></div><p className="mt-4 text-[9px] text-white/18">без декоративных цифр</p></article></section><section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"><div><p className="text-sm font-semibold text-white">Ритм по площадкам</p><p className="mt-1 text-[10px] text-white/35">Опубликовано / план текущего месяца</p></div><div className="mt-6 space-y-3">{[["VK",2,4],["Telegram",1,3],["Дзен",1,2],["VC.ru",0,1]].map(([name,published,planned])=><div key={String(name)} className="rounded-2xl border border-white/[0.05] bg-black/15 p-3.5"><div className="flex items-center justify-between text-xs"><span className="text-white/65">{name}</span><span className="font-semibold text-violet-200">{published} / {planned}</span></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-violet-500" style={{width:`${Number(published)/Number(planned)*100}%`}} /></div></div>)}</div></section></div>
  );
}

function DemoWorkspace() {
  const [activeView, setActiveView] = useState<DemoView>("overview");
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#0d0c12] shadow-[0_40px_140px_rgba(0,0,0,.55),0_0_0_1px_rgba(139,92,246,.05)]">
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.06] bg-black/20 px-4"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" /><span className="ml-2 text-[9px] font-medium text-white/25">app.adaptivepresence.ai</span></div>
      <div className="grid min-h-[640px] lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/[0.06] bg-black/15 p-4 lg:flex lg:flex-col"><BrandMark /><div className="mt-7 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"><p className="text-[10px] text-white/30">Бренд</p><p className="mt-1 text-xs font-semibold text-white/80">ИЛАРТ</p><p className="mt-0.5 text-[9px] text-white/25">контент-месяц активен</p></div><nav className="mt-6 space-y-1">{views.map(view=><button key={view.id} onClick={()=>setActiveView(view.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition ${activeView===view.id ? "border border-violet-400/25 bg-violet-500/12 text-white" : "border border-transparent text-white/40 hover:bg-white/[0.03] hover:text-white/70"}`}><span className="w-4 text-center text-violet-300/80">{view.icon}</span>{view.label}</button>)}</nav><div className="mt-auto border-t border-white/[0.06] pt-4"><p className="text-[10px] text-white/30">Бренд и площадки</p><p className="mt-3 text-[10px] text-white/30">Тариф · Старт</p></div></aside>
        <main className="min-w-0"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6"><div><p className="text-[10px] text-white/30">ИЛАРТ · <span className="text-white/65">{views.find(view=>view.id===activeView)?.label}</span></p></div><div className="flex items-center gap-2"><span className="hidden rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[9px] text-white/25 sm:block">⌘ Поиск или команда</span><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-200">И</span></div></header><div className="border-b border-white/[0.05] px-3 py-2 lg:hidden"><div className="flex gap-1 overflow-x-auto">{views.map(view=><button key={view.id} onClick={()=>setActiveView(view.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-semibold ${activeView===view.id ? "bg-violet-500 text-white" : "text-white/35"}`}>{view.label}</button>)}</div></div><div className="p-4 sm:p-6">{activeView === "overview" ? <OverviewView /> : activeView === "calendar" ? <CalendarView /> : activeView === "materials" ? <MaterialsView /> : activeView === "articles" ? <ArticlesView /> : activeView === "autoposting" ? <AutopostingView /> : <ResultsView />}</div></main>
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
  ["Контент публикуется без проверки?", "По умолчанию — нет. Сначала вы видите готовый материал и подтверждаете его. Автоматический режим можно включить отдельно для выбранных каналов."],
  ["Что с ответами на отзывы Яндекс Карт?", "В MVP система готовит ответ в вашем стиле и открывает карточку организации. Полная автоматизация появится после безопасной интеграции с доступным API."],
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
            <p className="mt-3 max-w-xl text-sm leading-6 text-black/45">Adaptive Presence формулирует спокойный ответ в стиле бренда — без шаблонной вежливости и риска сказать лишнее. В MVP вы подтверждаете и размещаете ответ в Яндекс Картах.</p>
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

function ArticlePipeline() {
  return (
    <section id="articles" className="scroll-mt-24 py-24 sm:py-28">
      <div className="overflow-hidden rounded-[34px] border border-white/[0.08] bg-[radial-gradient(circle_at_82%_12%,rgba(126,86,255,.2),transparent_32%),#111018] p-6 sm:p-10 lg:p-14">
        <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
          <div>
            <SectionLabel>Статьи без ручной сборки</SectionLabel>
            <h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.05em] sm:text-5xl">Longread — это не растянутый пост.</h2>
            <p className="mt-6 text-sm leading-7 text-white/42">Для Дзена и VC.ru система строит отдельную структуру: заголовок, лид, смысловые блоки, вывод, обложку и изображения внутри статьи. После проверки материал публикуется целиком.</p>
            <div className="mt-8 flex flex-wrap gap-2">{["обложка", "3–6 изображений", "структура", "редактура", "автопубликация"].map(item => <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] font-semibold text-white/50">{item}</span>)}</div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 bg-[radial-gradient(circle,rgba(124,92,255,.22),transparent_67%)] blur-xl" />
            <article className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#17151f] shadow-[0_35px_100px_rgba(0,0,0,.4)]">
              <div className="grid min-h-[410px] sm:grid-cols-[1fr_150px]">
                <div className="p-6 sm:p-8"><div className="flex items-center gap-3"><PlatformBrandIcon platform="Дзен" size="sm" /><span className="text-[10px] text-white/32">статья готова к публикации</span></div><h3 className="mt-9 text-2xl font-semibold leading-8 tracking-[-0.035em]">Как выбрать инженерное оборудование и не переделывать проект через год</h3><p className="mt-4 text-xs leading-6 text-white/36">Разбираем проект как систему: от исходных данных и совместимости узлов до документов и сервисного обслуживания.</p><div className="mt-8 space-y-3">{["Что проверить до расчёта", "Почему комплектующие нельзя выбирать отдельно", "Чек-лист перед оплатой"].map((item,index)=><div key={item} className="flex items-center gap-3 border-t border-white/[0.06] pt-3 text-[11px] text-white/50"><span className="text-violet-300">0{index+1}</span>{item}</div>)}</div></div>
                <div className="relative hidden overflow-hidden sm:block"><Image src="/marketing/creative-command/creative-command-02.webp" alt="Визуальный стиль Creative Command" fill sizes="150px" className="object-cover object-[58%_center] opacity-70" /></div>
              </div>
            </article>
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
        <div className="flex flex-wrap items-end justify-between gap-6"><div><SectionLabel dark={false}>Пилотный сценарий</SectionLabel><h2 className="mt-4 max-w-3xl font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Месяц для бренда — уже в одном экране.</h2></div><p className="max-w-md text-xs leading-6 text-black/40">ИЛАРТ используется как демонстрационный бренд для проверки полного пути. Цифры ниже описывают состав тестового месяца, а не выдуманные бизнес-результаты.</p></div>
        <div className="mt-12 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
          <article className="rounded-[30px] bg-[#121018] p-7 text-white sm:p-9"><div className="flex items-center justify-between"><p className="text-xs font-semibold">ИЛАРТ · инженерные решения</p><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[9px] font-semibold text-emerald-300">пилот собран</span></div><div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["18","материалов"],["5","площадок"],["2","статьи"],["1","календарь"]].map(([value,label])=><div key={label}><p className="font-heading text-4xl font-semibold tracking-[-0.05em]">{value}</p><p className="mt-2 text-[10px] text-white/30">{label}</p></div>)}</div><div className="mt-10 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full w-[89%] rounded-full bg-[linear-gradient(90deg,#7d5cff,#ae92ff)]" /></div><p className="mt-3 text-[10px] text-white/30">16 из 18 материалов полностью готовы</p></article>
          <div className="grid gap-4 sm:grid-cols-2"><article className="rounded-[30px] border border-black/[0.07] bg-[#f5f2ff] p-7"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">Было</p><h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Темы, тексты и картинки жили отдельно.</h3><p className="mt-4 text-xs leading-6 text-black/42">Ручное распределение дат, перенос между документами и повторная адаптация под каждую площадку.</p></article><article className="rounded-[30px] border border-violet-200 bg-[linear-gradient(145deg,#ede7ff,#fff)] p-7"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">Стало</p><h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Бриф запускает связанный месяц.</h3><p className="mt-4 text-xs leading-6 text-black/42">Календарь, материалы, статьи, визуалы и публикация работают как один понятный путь.</p></article></div>
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
          <div><SectionLabel dark={false}>Сделано Creative Command</SectionLabel><h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl">Агентский опыт.<br />Без агентской тяжести.</h2><p className="mt-6 max-w-md text-sm leading-7 text-black/48">Мы перенесли в продукт то, что действительно улучшает контент: понимание бренда, редакторскую логику, визуальную систему и контроль качества. Менеджерские таблицы и бесконечные согласования оставили за кадром.</p><div className="mt-8 inline-flex rotate-[-2deg] rounded-full border-2 border-violet-600 px-4 py-2 text-sm font-semibold italic text-violet-700">серьёзный продукт, живой характер ↗</div></div>
          <div className="grid grid-cols-12 gap-3">
            <div className="relative col-span-7 aspect-[4/5] overflow-hidden rounded-[28px] shadow-[0_30px_90px_rgba(76,51,135,.2)]"><Image src="/marketing/creative-command/creative-command-01.webp" alt="Креативная система Creative Command" fill sizes="(max-width:1024px) 55vw, 500px" className="object-cover" /></div>
            <div className="col-span-5 space-y-3 pt-10"><div className="relative aspect-[4/5] overflow-hidden rounded-[24px]"><Image src="/marketing/creative-command/creative-command-04.webp" alt="Визуальная ДНК Creative Command" fill sizes="(max-width:1024px) 40vw, 340px" className="object-cover" /></div><div className="rounded-[24px] bg-[#17121f] p-5 text-white"><p className="text-[10px] uppercase tracking-[0.14em] text-violet-300">Creative Command</p><p className="mt-3 text-sm font-semibold leading-5">Стратегия, контент и автоматизация в одной команде.</p></div></div>
          </div>
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
        {BILLING_DURATIONS.map((item) => <button key={item.months} type="button" onClick={() => setMonths(item.months)} className={`rounded-2xl px-4 py-3 text-left transition ${months === item.months ? "bg-violet-500 text-white shadow-[0_12px_35px_rgba(112,78,255,.22)]" : "text-white/48 hover:bg-white/[0.04]"}`}><span className="block text-xs font-semibold">{item.label}</span><span className={`mt-1 block text-[9px] ${months === item.months ? "text-white/70" : item.discountPercent ? "text-violet-300" : "text-white/22"}`}>{item.discountPercent ? `скидка ${item.discountPercent}%` : "без скидки"}</span></button>)}
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
        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Как работают кредиты</p><h3 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">Понятная внутренняя валюта</h3><p className="mt-3 max-w-md text-xs leading-5 text-white/35">Кредиты не привязывают вас к фиксированному числу постов. В одном месяце можно сделать больше статей, в другом — больше коротких публикаций.</p></div>
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
          <div className="relative z-10"><span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" />AI-система присутствия бренда</span><h1 className="mt-7 max-w-4xl font-heading text-5xl font-semibold leading-[.92] tracking-[-0.065em] text-white sm:text-7xl lg:text-[82px]">Ваш бренд<br />выходит <span className="bg-[linear-gradient(90deg,#d6cdff,#9a81ff,#7656ff)] bg-clip-text text-transparent">сам.</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-white/46 sm:text-lg">Заполните один бриф. Получите контент-месяц, статьи с изображениями, визуалы, календарь и автопостинг для российских площадок.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/start" className="rounded-2xl bg-violet-500 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-[0_18px_55px_rgba(112,78,255,.3)] transition hover:bg-violet-400">Собрать пробный месяц</Link><a href="#product" className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-6 py-3.5 text-center text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white">Пройти живое демо</a></div><div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-white/28"><span>500 пробных кредитов</span><span>без менеджера</span><span>настройка за 10 минут</span></div></div>
          <div className="relative mx-auto w-full max-w-[570px] lg:mr-0"><div className="absolute -inset-12 rounded-full bg-violet-600/20 blur-[90px]" /><div className="relative rotate-[1.5deg] overflow-hidden rounded-[34px] border border-white/[0.1] bg-white/[0.04] p-2 shadow-[0_45px_150px_rgba(0,0,0,.55)]"><div className="relative aspect-[4/5] overflow-hidden rounded-[27px]"><Image src="/marketing/creative-command/creative-command-03.webp" alt="Creative Command создаёт живую AI-систему для брендов" fill priority sizes="(max-width:1024px) 90vw, 550px" className="object-cover" /></div></div><div className="absolute -bottom-5 -left-5 rotate-[-4deg] rounded-2xl border border-violet-300/20 bg-[#17131f]/95 px-5 py-4 shadow-xl backdrop-blur"><p className="text-[10px] text-white/35">Следующая публикация</p><p className="mt-1 text-sm font-semibold">завтра · 11:00</p></div></div>
        </section>

        <section className="border-y border-white/[0.06] py-7"><p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/22">Один месяц · пять площадок · один голос бренда</p><div className="mt-5 flex flex-wrap items-center justify-center gap-6 sm:gap-10">{(["VK","Telegram","Одноклассники","Дзен","VC.ru"] as PlatformBrand[]).map(platform=><span key={platform} className="flex items-center gap-2.5 text-[11px] font-semibold text-white/42"><PlatformBrandIcon platform={platform} size="xs" />{platform}</span>)}</div></section>

        <section id="product" className="scroll-mt-24 py-24 sm:py-28"><div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><SectionLabel>Живой продукт</SectionLabel><h2 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">Не презентация.<br />Попробуйте кабинет.</h2></div><p className="max-w-md text-xs leading-6 text-white/36">Переключайте обзор, календарь, материалы, статьи, автопостинг и результаты прямо на этой странице.</p></div><DemoWorkspace /></section>

        <ProductValue />
      </div>

      <PlatformFormats />

      <div className="mx-auto max-w-[1320px] px-4 sm:px-7">
        <ArticlePipeline />

        <section id="how" className="border-t border-white/[0.06] py-24 sm:py-28"><div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]"><div><SectionLabel>Путь клиента</SectionLabel><h2 className="mt-4 font-heading text-4xl font-semibold leading-[.98] tracking-[-0.05em] sm:text-5xl">От сайта до публикации — без менеджерской панели.</h2><p className="mt-5 max-w-md text-sm leading-7 text-white/38">Сложность остаётся внутри продукта. Снаружи — только следующий понятный шаг.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["01","Знакомство","Вводите сайт и отвечаете на короткие вопросы о бизнесе."],["02","Профиль бренда","Проверяете, как система поняла аудиторию, продукты и голос."],["03","Конструктор месяца","Выбираете любое сочетание постов, статей и визуальных форматов."],["04","Готовый календарь","Материалы равномерно распределяются по месяцу и готовятся автоматически."],["05","Проверка","Редактируете текст, визуал или конкретный слайд без пересборки всего материала."],["06","Публикация","Подключаете площадки и отправляете подтверждённое по расписанию."]].map(([number,title,text])=><article key={number} className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-6"><span className="text-[10px] font-semibold text-violet-300">{number}</span><h3 className="mt-6 text-lg font-semibold text-white">{title}</h3><p className="mt-3 text-xs leading-6 text-white/35">{text}</p></article>)}</div></div></section>
      </div>

      <PilotCase />
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
