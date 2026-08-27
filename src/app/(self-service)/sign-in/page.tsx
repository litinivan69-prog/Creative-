import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requestSelfServiceMagicLink } from "@/lib/self-service/auth-actions";
import { RibesBrand } from "@/app/(self-service)/ribes-brand";

export const metadata: Metadata = {
  title: "Войти · Ribes",
  description: "Вход в Ribes по одноразовой ссылке.",
  robots: { index: false, follow: false },
};

type SignInSearchParams = Promise<{
  callbackUrl?: string;
  error?: string;
}>;

function safeCallbackPath(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export default async function SignInPage({ searchParams }: { searchParams: SignInSearchParams }) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  const emailConfigured = Boolean(process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM && process.env.AUTH_SECRET);

  if (session?.user?.email) redirect(callbackUrl);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.17),transparent_38%),radial-gradient(circle_at_82%_10%,rgba(196,181,253,0.22),transparent_36%)]" />
      <div className="relative mx-auto max-w-[1080px]">
        <header className="flex items-center justify-between rounded-[24px] border border-white/80 bg-white/75 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur-xl sm:px-5">
          <a href="/start" className="flex items-center gap-3">
            <RibesBrand dark={false} />
          </a>
        </header>

        <section className="grid min-h-[calc(100vh-120px)] items-center gap-10 py-10 lg:grid-cols-[1fr_460px] lg:py-16">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-violet-600">Личный кабинет</p>
            <h1 className="mt-4 font-heading text-5xl font-semibold leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-6xl">Вход без пароля и лишних шагов.</h1>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">Введите рабочую почту. Мы отправим одноразовую ссылку — она безопасно откроет только ваш бренд и ваши материалы.</p>
          </div>

          <div className="rounded-[30px] border border-white/90 bg-white/90 p-6 shadow-[0_30px_100px_rgba(77,61,112,0.12)] backdrop-blur sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Войти или создать аккаунт</p>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.025em] text-slate-950">Продолжить по email</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Пароль придумывать не нужно. Ссылка действует один раз и ограниченное время.</p>

            {params.error === "invalid_email" ? (
              <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">Проверьте адрес электронной почты.</p>
            ) : null}

            {!emailConfigured ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Email-вход уже собран в коде. Для отправки писем останется добавить три защищённые настройки в Vercel.</p>
            ) : null}

            <form action={requestSelfServiceMagicLink} className="mt-5 grid gap-3">
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <label className="grid gap-2 text-sm font-semibold text-slate-800">
                Рабочая почта
                <input name="email" type="email" required autoComplete="email" placeholder="you@company.ru" className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
              </label>
              <button type="submit" disabled={!emailConfigured} className="mt-1 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Получить ссылку для входа</button>
            </form>

            <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">Продолжая, вы соглашаетесь получать только служебные письма, необходимые для входа и работы кабинета.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
