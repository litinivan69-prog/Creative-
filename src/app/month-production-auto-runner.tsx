"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { processNextMonthProductionBatch } from "@/app/actions";

type MonthProductionAutoRunnerProps = {
  productionRunId: string;
  enabled: boolean;
  hasQueuedTasks: boolean;
  status: string;
  currentStage: string;
};

function intervalForStage(stage: string) {
  if (stage === "visuals") return 8000;
  if (stage === "briefs") return 5000;
  return 3500;
}

export function MonthProductionAutoRunner({
  productionRunId,
  enabled,
  hasQueuedTasks,
  status,
  currentStage,
}: MonthProductionAutoRunnerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("Автоподготовка активна.");
  const processingRef = useRef(false);
  const stopped =
    !enabled ||
    !hasQueuedTasks ||
    ["paused", "completed", "completed_with_errors"].includes(status);
  const intervalMs = useMemo(() => intervalForStage(currentStage), [currentStage]);

  useEffect(() => {
    if (stopped) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled || processingRef.current) return;

      processingRef.current = true;
      setMessage("Готовим следующий шаг...");

      try {
        const snapshot = await processNextMonthProductionBatch(productionRunId);
        if (cancelled) return;

        if (!snapshot.ok) {
          setMessage(snapshot.message || "Не удалось обновить подготовку месяца.");
        } else if (snapshot.status === "completed") {
          setMessage("Месяц подготовлен.");
        } else if (snapshot.status === "completed_with_errors") {
          setMessage("Подготовка завершилась с ошибками. Ошибки можно повторить.");
        } else if (snapshot.status === "paused") {
          setMessage(snapshot.message || "Подготовка остановлена. Можно возобновить после проверки причины.");
        } else {
          setMessage(`Подготовка идёт: ${snapshot.percent}%.`);
        }

        startTransition(() => {
          router.refresh();
        });
      } catch {
        if (!cancelled) {
          setMessage("Связь с подготовкой прервалась. Обновите страницу, чтобы продолжить с места остановки.");
        }
      } finally {
        processingRef.current = false;
        if (!cancelled) {
          timeoutId = setTimeout(tick, intervalMs);
        }
      }
    };

    timeoutId = setTimeout(tick, 800);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [intervalMs, productionRunId, router, stopped]);

  if (stopped) return null;

  return (
    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{isPending ? "Обновляем прогресс..." : message}</p>
        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700">
          Подготовка идёт...
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold text-violet-700">
        Можно проверять первые готовые материалы. Если закрыть страницу, подготовка продолжится после возвращения.
      </p>
    </div>
  );
}
