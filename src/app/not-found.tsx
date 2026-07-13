import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f5fb] bg-[radial-gradient(circle_at_24%_-8%,rgba(139,92,246,0.12),transparent_34%)] px-4">
      <section className="w-full max-w-md rounded-[28px] bg-white/90 p-8 text-center ring-1 ring-slate-900/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.75),0_24px_60px_-24px_rgba(88,75,135,0.35)]">
        <p className="font-heading text-lg font-extrabold lowercase tracking-tight text-violet-600">creative command<span className="text-slate-900">.</span></p>
        <h1 className="mt-4 text-6xl font-semibold tracking-tight text-slate-950">404</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Такой страницы нет. Возможно, ссылка устарела или материал переехал.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-[0.98]"
        >
          Вернуться в консоль
        </Link>
      </section>
    </main>
  );
}
