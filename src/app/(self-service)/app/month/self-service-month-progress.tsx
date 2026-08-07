"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  continueSelfServiceMonth,
  processNextSelfServiceProductionBatch,
} from "@/app/actions";

export function SelfServiceMonthStarter({ active }: { active: boolean }) {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState("Собираем структуру месяца…");

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;

    void continueSelfServiceMonth().then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.replace("/app/month?notice=month_started");
      router.refresh();
    }).catch(() => {
      setMessage("Связь прервалась. Обновите страницу — бриф уже сохранён.");
    });
  }, [active, router]);

  if (!active) return null;

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-[24px] border border-violet-100 bg-white p-5 text-left shadow-[0_18px_55px_rgba(77,61,112,0.08)]">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500" />
        <p className="text-sm font-semibold text-slate-900">{message}</p>
      </div>
      <p className="mt-2 pl-5 text-xs leading-5 text-slate-500">Сначала определяем темы и даты. Готовые материалы начнут появляться автоматически.</p>
    </div>
  );
}

export function SelfServiceProductionRunner(props: {
  productionRunId: string;
  enabled: boolean;
  currentStage: string;
  completedTasks: number;
  totalTasks: number;
}) {
  const router = useRouter();
  const processing = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("Готовим материалы автоматически…");
  const serverPercent = props.totalTasks > 0 ? Math.round((props.completedTasks / props.totalTasks) * 100) : 0;
  const [percent, setPercent] = useState(serverPercent);

  useEffect(() => {
    setPercent(serverPercent);
  }, [serverPercent]);

  useEffect(() => {
    if (!props.enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled || processing.current) return;
      processing.current = true;
      try {
        const result = await processNextSelfServiceProductionBatch(props.productionRunId);
        if (cancelled) return;
        if (!result.ok) {
          setMessage(result.message || "Подготовка временно остановилась.");
          return;
        }
        setPercent(result.percent);
        if (result.status === "completed") setMessage("Контент-набор готов.");
        else if (result.status === "completed_with_errors") setMessage("Основные материалы готовы. Некоторые элементы можно повторить позже.");
        else if (result.status === "paused") setMessage(result.message || "Подготовка временно остановилась.");
        else setMessage(`Готовим материалы: ${result.percent}%.`);
        startTransition(() => router.refresh());
      } catch {
        if (!cancelled) setMessage("Связь прервалась. Подготовка продолжится после обновления страницы.");
      } finally {
        processing.current = false;
        if (!cancelled) timer = setTimeout(tick, props.currentStage === "visuals" ? 8000 : 4000);
      }
    };

    timer = setTimeout(tick, 900);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [props.currentStage, props.enabled, props.productionRunId, router]);

  if (!props.enabled) return null;

  return (
    <div className="mb-5 rounded-[24px] border border-violet-100 bg-violet-50/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-violet-950">{isPending ? "Обновляем готовые материалы…" : message}</p><p className="mt-1 text-xs text-violet-700">Можно закрыть страницу и вернуться позже.</p></div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-700">{percent}%</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
