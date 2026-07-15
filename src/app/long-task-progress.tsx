"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Determinate-looking progress for a single long server call (blueprint or
 * monthly plan generation). Rendered INSIDE the form: appears while the form
 * is pending, advances through named stages against the expected duration and
 * never looks like a frozen endless spinner. Caps at 95% until the redirect.
 */
export function LongTaskProgress({
  title,
  stages,
  estimatedSeconds,
}: {
  title: string;
  stages: string[];
  estimatedSeconds: number;
}) {
  const { pending } = useFormStatus();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!pending) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const intervalId = setInterval(() => {
      setElapsedSeconds((Date.now() - startedAt) / 1000);
    }, 500);
    return () => clearInterval(intervalId);
  }, [pending]);

  if (!pending) return null;

  // Asymptotic progress: fast start, slows near the end, never "hangs" at 100%.
  const ratio = 1 - Math.exp(-elapsedSeconds / (estimatedSeconds / 1.8));
  const percent = Math.min(95, Math.max(3, Math.round(ratio * 100)));
  const stageIndex = Math.min(stages.length - 1, Math.floor((percent / 96) * stages.length));
  const estimateLabel =
    estimatedSeconds >= 120 ? `${Math.round(estimatedSeconds / 60)}–${Math.round(estimatedSeconds / 60) + 1} минуты` : "1–2 минуты";

  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_10px_28px_rgba(88,75,135,0.055)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <span className="text-sm font-bold tabular-nums text-violet-700">{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-50">
        <div
          className="h-full rounded-full bg-violet-600 transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-3 grid gap-1.5">
        {stages.map((stage, index) => (
          <li key={stage} className="flex items-center gap-2 text-xs font-semibold">
            <span
              className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${
                index < stageIndex
                  ? "bg-violet-600 text-white"
                  : index === stageIndex
                    ? "bg-violet-100 text-violet-700 ring-2 ring-violet-300"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {index < stageIndex ? "✓" : index + 1}
            </span>
            <span className={index <= stageIndex ? "text-slate-800" : "text-slate-400"}>
              {stage}
              {index === stageIndex ? "…" : ""}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        Процесс идёт, обычно занимает {estimateLabel}. Не закрывайте вкладку — по завершении страница обновится сама.
      </p>
    </div>
  );
}
