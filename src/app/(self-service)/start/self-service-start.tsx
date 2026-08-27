"use client";

import Link from "next/link";
import { RibesBrand } from "@/app/(self-service)/ribes-brand";

const steps = ["Бренд", "Аудитория", "Стиль", "Площадки", "Проверка"];

export function SelfServiceStart() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09090d] px-4 py-5 text-white sm:px-7 sm:py-7 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(circle_at_20%_0%,rgba(124,92,255,.20),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(77,208,168,.06),transparent_26%)]" />
      <div className="relative mx-auto max-w-[1120px]">
        <header className="flex items-center justify-between border-b border-white/[.08] py-3">
          <RibesBrand dark />
          <Link href="/demo" className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-violet-400/40 hover:text-white">
            Посмотреть кабинет
          </Link>
        </header>
        <section className="mx-auto grid min-h-[calc(100vh-110px)] max-w-[960px] items-center py-12 lg:grid-cols-[1fr_360px] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Начало настройки</p>
            <h1 className="mt-5 max-w-2xl font-heading text-[44px] font-semibold leading-[1.02] tracking-[-.05em] sm:text-6xl">Расскажите о бренде. Остальное соберём по шагам.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">Сначала разберёмся в бизнесе, аудитории и стиле. Количество материалов и площадки для публикации вы выберете позже в кабинете.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/start/brief" className="inline-flex items-center justify-center rounded-full bg-violet-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_45px_rgba(124,92,255,.25)] transition hover:bg-violet-400">Начать настройку</Link>
              <span className="text-sm text-slate-500">Черновик сохранится автоматически</span>
            </div>
          </div>
          <aside className="mt-12 rounded-[28px] border border-white/[.09] bg-white/[.035] p-6 lg:mt-0">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Ваш путь</p><p className="text-xs font-semibold text-violet-300">0 из 5</p></div>
            <div className="mt-4 grid grid-cols-5 gap-2" aria-label="Прогресс настройки">{steps.map((step) => <span key={step} className="h-1 rounded-full bg-white/10" />)}</div>
            <ol className="mt-7 space-y-4">{steps.map((step, index) => <li key={step} className="flex items-center gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-xs font-semibold text-slate-400">{index + 1}</span><span className="text-sm font-medium text-slate-300">{step}</span></li>)}</ol>
          </aside>
        </section>
      </div>
    </main>
  );
}
