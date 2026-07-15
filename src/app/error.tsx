"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled app error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fb] bg-[radial-gradient(circle_at_24%_-8%,rgba(139,92,246,0.12),transparent_34%)] px-4">
      <section className="w-full max-w-md rounded-[28px] bg-white/90 p-8 text-center ring-1 ring-slate-900/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.75),0_24px_60px_-24px_rgba(88,75,135,0.35)]">
        <p className="font-heading text-lg font-extrabold lowercase tracking-tight text-violet-600">
          creative command<span className="text-slate-900">.</span>
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">Что-то пошло не так</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Операция не завершилась — чаще всего это долгая генерация. Уже созданные данные сохранены:
          план и материалы не теряются, подготовку можно продолжить с места остановки.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-[0.98]"
          >
            Попробовать ещё раз
          </button>
          <a
            href="/?view=drafts"
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700"
          >
            Открыть материалы
          </a>
        </div>
      </section>
    </main>
  );
}
