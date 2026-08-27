import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Проверьте почту · Ribes",
  robots: { index: false, follow: false },
};

export default function CheckEmailPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-lg rounded-[30px] border border-white/90 bg-white/90 p-7 text-center shadow-[0_30px_100px_rgba(77,61,112,0.12)] sm:p-9">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-violet-100 text-2xl">✉</div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Ссылка отправлена</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.035em] text-slate-950">Проверьте почту</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Откройте письмо от Ribes и нажмите кнопку входа. После этого вернём вас к созданию кабинета.</p>
        <a href="/sign-in" className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700">Использовать другую почту</a>
      </section>
    </main>
  );
}
