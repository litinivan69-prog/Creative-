"use client";

import { useEffect, useState } from "react";

const cardClass =
  "rounded-[22px] bg-white ring-1 ring-slate-900/[0.045] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_16px_40px_-22px_rgba(88,75,135,0.28)]";

export type OverviewCalendarItem = {
  id: string;
  date: string | null;
  platformName: string;
  topic: string;
  status: string | null;
  thumbnail?: string | null;
};

function useCountUp(value: number) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || value <= 0) {
      setDisplay(value);
      return;
    }

    const duration = 750;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return display;
}

export function OverviewMetric({
  label,
  value,
  detail,
  href,
  icon,
  suffix,
  progress,
  tone = "violet",
  index = 0,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  icon?: React.ReactNode;
  suffix?: string;
  progress?: number;
  tone?: "violet" | "amber" | "neutral";
  index?: number;
}) {
  const display = useCountUp(value);
  const chip =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "neutral"
        ? "bg-slate-100 text-slate-500"
        : "bg-violet-50 text-violet-700";
  const bar = tone === "amber" ? "bg-amber-400" : "bg-violet-500";

  return (
    <a
      href={href}
      className={`${cardClass} ap-rise group min-w-0 p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(88,75,135,0.1)]`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${chip}`}>
          {icon ?? <span className="h-1.5 w-1.5 rounded-full bg-current" />}
        </span>
        <span className="text-base text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-400">›</span>
      </div>
      <p className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
        {display}
        {suffix ? <span className="text-lg text-slate-400">{suffix}</span> : null}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 truncate text-xs text-slate-400">{detail}</p>
      {typeof progress === "number" ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`ap-grow h-full origin-left rounded-full ${bar}`}
            style={{ width: `${Math.max(4, Math.min(progress, 100))}%`, animationDelay: `${index * 70 + 120}ms` }}
          />
        </div>
      ) : null}
    </a>
  );
}

export function OverviewAttention({
  items,
}: {
  items: Array<{ label: string; count: number; href: string }>;
}) {
  const active = items.filter((item) => item.count > 0);

  return (
    <article className={`${cardClass} ap-rise p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active.length > 0 ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          <h2 className="text-sm font-semibold text-slate-950">Требует внимания</h2>
        </div>
        {active.length === 0 ? (
          <span className="text-xs font-semibold text-slate-400">Критичных задач нет</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {active.length === 0 ? (
          <p className="text-xs leading-5 text-slate-400">Всё под контролем — срочных действий не требуется.</p>
        ) : (
          active.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="group inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
            >
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white tabular-nums">{item.count}</span>
              {item.label}
              <span className="text-amber-400 transition group-hover:translate-x-0.5">›</span>
            </a>
          ))
        )}
      </div>
    </article>
  );
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function attentionTone(status: string | null) {
  return status === "client_changes_requested" || status === "rejected" || status === "sent_to_client";
}

export function OverviewMiniCalendar({
  month,
  items,
  calendarHref,
}: {
  month?: string;
  items: OverviewCalendarItem[];
  calendarHref: string;
}) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);

  const match = month?.match(/^(\d{4})-(\d{2})$/);
  const base = new Date();
  const year = match ? Number(match[1]) : base.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : base.getMonth();
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingDays = (first.getDay() + 6) % 7;

  const byDay = new Map<number, OverviewCalendarItem[]>();
  for (const item of items) {
    const date = parseDate(item.date);
    if (!date || date.getFullYear() !== year || date.getMonth() !== monthIndex) continue;
    const list = byDay.get(date.getDate()) ?? [];
    list.push(item);
    byDay.set(date.getDate(), list);
  }

  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" })
    .format(first)
    .replace(/^./, (letter) => letter.toUpperCase());

  const todayDay =
    today && today.getFullYear() === year && today.getMonth() === monthIndex ? today.getDate() : null;
  const todayKey = today ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}` : "";

  const upcoming = items
    .filter((item) => item.date && (!todayKey || item.date >= todayKey))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .slice(0, 4);

  const cells = [
    ...Array.from({ length: leadingDays }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];
  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <article className={`${cardClass} ap-rise min-w-0 p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600">Календарь</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{monthLabel}</h2>
        </div>
        <a href={calendarHref} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100">
          Открыть календарь
        </a>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
            {weekDays.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const dayItems = cell.day ? byDay.get(cell.day) ?? [] : [];
              const isToday = cell.day === todayDay;
              const amber = dayItems.some((item) => attentionTone(item.status));

              return (
                <div
                  key={cell.key}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-xs ${
                    cell.day
                      ? isToday
                        ? "bg-violet-600 font-semibold text-white"
                        : dayItems.length > 0
                          ? "bg-violet-50 font-semibold text-violet-800"
                          : "text-slate-500"
                      : ""
                  }`}
                >
                  {cell.day ? (
                    <>
                      <span>{cell.day}</span>
                      {dayItems[0]?.thumbnail ? (
                        <img
                          src={dayItems[0].thumbnail}
                          alt=""
                          className={`mt-0.5 h-5 w-5 rounded-md object-cover ${amber ? "ring-2 ring-amber-400" : isToday ? "ring-2 ring-white/70" : ""}`}
                        />
                      ) : dayItems.length > 0 ? (
                        <span
                          className={`mt-0.5 h-1 w-1 rounded-full ${
                            isToday ? "bg-white" : amber ? "bg-amber-400" : "bg-violet-500"
                          }`}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Ближайшие публикации</p>
          <div className="mt-2 grid gap-1.5">
            {upcoming.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-400">
                Публикации появятся, когда материалы получат даты.
              </p>
            ) : (
              upcoming.map((item) => {
                const date = parseDate(item.date);
                const label = date
                  ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date)
                  : "—";
                return (
                  <a
                    key={item.id}
                    href={calendarHref}
                    className="flex min-w-0 items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2 transition hover:bg-violet-50"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-semibold leading-tight text-violet-700">
                      {label.split(" ")[0]}
                      <span className="text-[8px] uppercase text-slate-400">{label.split(" ")[1]}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-slate-700">{item.platformName}</span>
                      <span className="block truncate text-[11px] text-slate-400">{item.topic}</span>
                    </span>
                  </a>
                );
              })
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
