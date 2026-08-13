"use client";

import Link from "next/link";
import { useState } from "react";

type DemoView = "overview" | "calendar" | "materials" | "autoposting" | "results";

const views: Array<{ id: DemoView; label: string; icon: string }> = [
  { id: "overview", label: "Обзор", icon: "⌁" },
  { id: "calendar", label: "Календарь", icon: "□" },
  { id: "materials", label: "Материалы", icon: "◇" },
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
      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=><span key={day} className="pb-1 text-center text-[9px] font-bold uppercase text-white/25">{day}</span>)}{cells.map((day,index)=><div key={index} className={`min-h-14 rounded-xl border p-1.5 sm:min-h-20 sm:p-2 ${day ? "border-white/[0.05] bg-white/[0.025]" : "border-transparent"}`}>{day ? <><span className={`text-[10px] ${scheduled.has(day) ? "text-violet-200" : "text-white/25"}`}>{day}</span>{scheduled.has(day) ? <div className="mt-1.5 rounded-lg border border-violet-400/15 bg-violet-500/10 px-1.5 py-1 text-[8px] font-semibold text-violet-200 sm:text-[9px]">{scheduled.get(day)}</div> : null}</> : null}</div>)}</div>
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
  const points = [42,55,49,68,63,82,76,94];
  return (
    <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-4"><MetricCard label="Опубликовано" value="12" detail="+4" /><MetricCard label="Просмотры" value="18.4K" detail="+24%" tone="mint" /><MetricCard label="Реакции" value="746" detail="+18%" /><MetricCard label="Вовлечение" value="4.1%" detail="+0.8" tone="mint" /></section><section className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"><div><p className="text-sm font-semibold text-white">Динамика присутствия</p><p className="mt-1 text-[10px] text-white/35">Охват опубликованных материалов · 30 дней</p></div><div className="mt-8 flex h-44 items-end gap-2 sm:gap-3">{points.map((height,index)=><div key={index} className="flex flex-1 items-end"><div className="w-full rounded-t-lg bg-[linear-gradient(180deg,#8668ff,rgba(134,104,255,.14))]" style={{height:`${height}%`}} /></div>)}</div><div className="mt-3 flex justify-between text-[9px] text-white/25"><span>1 авг</span><span>8 авг</span><span>15 авг</span><span>22 авг</span><span>сегодня</span></div></section></div>
  );
}

function DemoWorkspace() {
  const [activeView, setActiveView] = useState<DemoView>("overview");
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#0d0c12] shadow-[0_40px_140px_rgba(0,0,0,.55),0_0_0_1px_rgba(139,92,246,.05)]">
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.06] bg-black/20 px-4"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" /><span className="ml-2 text-[9px] font-medium text-white/25">app.adaptivepresence.ai</span></div>
      <div className="grid min-h-[640px] lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/[0.06] bg-black/15 p-4 lg:flex lg:flex-col"><BrandMark /><div className="mt-7 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"><p className="text-[10px] text-white/30">Бренд</p><p className="mt-1 text-xs font-semibold text-white/80">ИЛАРТ</p><p className="mt-0.5 text-[9px] text-white/25">контент-месяц активен</p></div><nav className="mt-6 space-y-1">{views.map(view=><button key={view.id} onClick={()=>setActiveView(view.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition ${activeView===view.id ? "border border-violet-400/25 bg-violet-500/12 text-white" : "border border-transparent text-white/40 hover:bg-white/[0.03] hover:text-white/70"}`}><span className="w-4 text-center text-violet-300/80">{view.icon}</span>{view.label}</button>)}</nav><div className="mt-auto border-t border-white/[0.06] pt-4"><p className="text-[10px] text-white/30">Бренд и площадки</p><p className="mt-3 text-[10px] text-white/30">Тариф · Старт</p></div></aside>
        <main className="min-w-0"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6"><div><p className="text-[10px] text-white/30">ИЛАРТ · <span className="text-white/65">{views.find(view=>view.id===activeView)?.label}</span></p></div><div className="flex items-center gap-2"><span className="hidden rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[9px] text-white/25 sm:block">⌘ Поиск или команда</span><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-200">И</span></div></header><div className="border-b border-white/[0.05] px-3 py-2 lg:hidden"><div className="flex gap-1 overflow-x-auto">{views.map(view=><button key={view.id} onClick={()=>setActiveView(view.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-semibold ${activeView===view.id ? "bg-violet-500 text-white" : "text-white/35"}`}>{view.label}</button>)}</div></div><div className="p-4 sm:p-6">{activeView === "overview" ? <OverviewView /> : activeView === "calendar" ? <CalendarView /> : activeView === "materials" ? <MaterialsView /> : activeView === "autoposting" ? <AutopostingView /> : <ResultsView />}</div></main>
      </div>
    </div>
  );
}

export function AdaptivePresenceDemo() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08070c] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(circle_at_18%_4%,rgba(109,74,255,.22),transparent_34%),radial-gradient(circle_at_80%_12%,rgba(91,61,205,.16),transparent_28%)]" />
      <div className="relative mx-auto max-w-[1320px] px-4 sm:px-7">
        <header className="flex h-20 items-center justify-between gap-5 border-b border-white/[0.06]"><Link href="/demo"><BrandMark /></Link><nav className="hidden items-center gap-8 text-xs font-medium text-white/45 md:flex"><a href="#product" className="transition hover:text-white">Продукт</a><a href="#how" className="transition hover:text-white">Как работает</a><a href="#pricing" className="transition hover:text-white">Стоимость</a><Link href="/sign-in" className="transition hover:text-white">Войти</Link></nav><Link href="/start" className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-violet-100">Попробовать на своём бренде</Link></header>

        <section className="pb-16 pt-16 text-center sm:pb-20 sm:pt-24"><span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />AI-система присутствия бренда</span><h1 className="mx-auto mt-7 max-w-5xl font-heading text-5xl font-semibold leading-[.96] tracking-[-0.06em] text-white sm:text-7xl lg:text-[86px]">Ваш бренд<br /><span className="bg-[linear-gradient(90deg,#b9a8ff,#7558ff,#68dfbd)] bg-clip-text text-transparent">публикуется сам.</span></h1><p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">Один короткий бриф — и Adaptive Presence собирает месяц, пишет тексты, создаёт визуалы и публикует материалы в VK, Telegram, Дзен и VC.ru.</p><div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"><a href="#product" className="rounded-2xl bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_55px_rgba(112,78,255,.28)] transition hover:bg-violet-400">Посмотреть живое демо</a><Link href="/start" className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white">Попробовать на своём бренде</Link></div><p className="mt-5 text-[10px] text-white/25">Демо работает без регистрации и не расходует генерации</p></section>

        <section id="product" className="scroll-mt-6 pb-24"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Живой продукт</p><h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Нажмите на раздел и пройдите кабинет.</h2></div><p className="max-w-md text-xs leading-5 text-white/35">Это не видеоролик. Переключайте обзор, календарь, материалы, автопостинг и результаты прямо на странице.</p></div><DemoWorkspace /></section>

        <section id="how" className="border-t border-white/[0.06] py-24"><div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Как работает</p><h2 className="mt-3 font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.045em]">От брифа до публикации — один спокойный цикл.</h2><p className="mt-5 max-w-md text-sm leading-6 text-white/40">Сложная производственная логика остаётся внутри. Вы видите только результат и следующий понятный шаг.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["01","Понимаем бренд","Сайт, продукты, аудитория, тон и ограничения сохраняются в памяти."],["02","Собираем месяц","Темы распределяются по календарю и адаптируются под каждую площадку."],["03","Создаём материалы","Готовим тексты, статьи, визуалы и отдельные слайды каруселей."],["04","Публикуем и измеряем","Подтверждённое выходит по расписанию, результаты возвращаются в кабинет."]].map(([number,title,text])=><article key={number} className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-5"><span className="text-[10px] font-semibold text-violet-300">{number}</span><h3 className="mt-5 text-base font-semibold text-white">{title}</h3><p className="mt-2 text-xs leading-5 text-white/35">{text}</p></article>)}</div></div></section>

        <section id="pricing" className="pb-24"><div className="overflow-hidden rounded-[30px] border border-violet-400/15 bg-[radial-gradient(circle_at_70%_20%,rgba(124,92,255,.18),transparent_34%),rgba(255,255,255,.025)] p-7 sm:p-10"><div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Начать просто</p><h2 className="mt-3 max-w-3xl font-heading text-4xl font-semibold tracking-[-0.045em]">Сначала увидьте один материал для своего бренда.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-white/40">Введите сайт, проверьте, как система поняла компанию, и получите первые темы. Полный месяц и автопостинг открываются после подтверждения.</p></div><Link href="/start" className="inline-flex justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-violet-100">Попробовать бесплатно</Link></div></div></section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] py-8 text-[10px] text-white/25"><BrandMark compact /><p>© 2026 Creative Command · Adaptive Presence</p><div className="flex gap-5"><Link href="/sign-in">Войти</Link><Link href="/start">Начать</Link></div></footer>
      </div>
    </main>
  );
}
