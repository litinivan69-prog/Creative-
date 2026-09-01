"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { continueSelfServiceArticle } from "@/lib/self-service/article-actions";

export function ArticleImageRunner(props: {
  articleId: string;
  initialReady: number;
  total: number;
}) {
  const router = useRouter();
  const working = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [ready, setReady] = useState(props.initialReady);
  const [total, setTotal] = useState(props.total);
  const [failed, setFailed] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled || working.current) return;
      working.current = true;
      try {
        const result = await continueSelfServiceArticle(props.articleId);
        if (cancelled) return;
        if (!result.ok) {
          setFailed(result.message || "Не удалось продолжить генерацию изображений.");
          if (typeof result.ready === "number") setReady(result.ready);
          if (typeof result.total === "number") setTotal(result.total);
          return;
        }
        setFailed(null);
        setReady(result.ready);
        setTotal(result.total);
        startTransition(() => router.refresh());
        if (!result.done) timer = setTimeout(tick, 2500);
      } catch {
        if (!cancelled) setFailed("Связь прервалась. Можно безопасно повторить.");
      } finally {
        working.current = false;
      }
    };

    timer = setTimeout(tick, 500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [props.articleId, retry, router]);

  const effectiveTotal = Math.max(1, total);
  const percent = Math.round((ready / effectiveTotal) * 100);

  return (
    <section className="mb-4 rounded-[22px] border border-violet-400/15 bg-violet-500/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-100">
            {failed ? "Изображения остановились" : isPending ? "Обновляем статью…" : `Готовим изображения: ${ready}/${total || "…"}`}
          </p>
          <p className={`mt-1 text-[10px] leading-4 ${failed ? "text-rose-200/75" : "text-violet-200/45"}`}>
            {failed || "Каждая иллюстрация сохраняется отдельно и появляется здесь сразу после готовности."}
          </p>
        </div>
        {failed ? (
          <button type="button" onClick={() => { setFailed(null); setRetry((value) => value + 1); }} className="rounded-xl bg-violet-500 px-4 py-2.5 text-[10px] font-semibold text-white">
            Повторить
          </button>
        ) : <span className="rounded-full bg-black/20 px-3 py-1.5 text-[10px] font-semibold text-violet-200">{percent}%</span>}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${percent}%` }} /></div>
    </section>
  );
}
