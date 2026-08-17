import Link from "next/link";
import { signOutSelfService } from "@/lib/self-service/auth-actions";

export type SelfServiceAppView = "overview" | "calendar" | "materials" | "articles" | "autoposting" | "results" | "channels" | "credits" | "builder";

const navItems: Array<{ id: SelfServiceAppView; label: string; href: string; icon: string }> = [
  { id: "overview", label: "Обзор", href: "/app", icon: "⌁" },
  { id: "builder", label: "Собрать месяц", href: "/app/plan-builder", icon: "+" },
  { id: "calendar", label: "Календарь", href: "/app/month#calendar", icon: "□" },
  { id: "materials", label: "Материалы", href: "/app/month#materials", icon: "◇" },
  { id: "articles", label: "Статьи", href: "/app/articles", icon: "≡" },
  { id: "autoposting", label: "Автопостинг", href: "/app/autoposting", icon: "↗" },
  { id: "results", label: "Результаты", href: "/app/results", icon: "⌇" },
  { id: "credits", label: "Кредиты", href: "/app/credits", icon: "✦" },
];

export function SelfServiceAppShell({
  brandName,
  active,
  eyebrow,
  title,
  description,
  children,
  headerAction,
}: {
  brandName: string;
  active: SelfServiceAppView;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#09080d] text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_26%_0%,rgba(111,75,255,.12),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(68,205,170,.045),transparent_28%)]" />
      <div className="relative min-h-screen lg:grid lg:grid-cols-[226px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/[0.06] bg-black/15 p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <Link href="/app" className="flex items-center gap-3 px-2 py-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#9b87ff,#6d4aff)] text-[10px] font-black lowercase text-white shadow-[0_0_28px_rgba(124,92,255,.25)]">cc.</span>
            <span><span className="block text-sm font-semibold text-white">Adaptive Presence</span><span className="block text-[10px] text-white/30">Creative Command</span></span>
          </Link>

          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/25">Ваш бренд</p>
            <p className="mt-2 truncate text-sm font-semibold text-white/85">{brandName}</p>
            <div className="mt-2 flex items-center gap-2 text-[9px] text-emerald-300/75"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />система активна</div>
          </div>

          <nav className="mt-6 space-y-1">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-white/20">Присутствие</p>
            {navItems.map((item) => (
              <Link key={item.id} href={item.href} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-medium transition ${active === item.id ? "border-violet-400/25 bg-violet-500/12 text-white" : "border-transparent text-white/38 hover:bg-white/[0.035] hover:text-white/75"}`}>
                <span className="w-4 text-center text-violet-300/80">{item.icon}</span>{item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto space-y-1 border-t border-white/[0.06] pt-4">
            <Link href="/app/channels" className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-medium transition ${active === "channels" ? "border-violet-400/25 bg-violet-500/12 text-white" : "border-transparent text-white/38 hover:bg-white/[0.035] hover:text-white/75"}`}><span className="w-4 text-center text-violet-300/80">◎</span>Бренд и площадки</Link>
            <Link href="/demo" className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-xs font-medium text-white/38 transition hover:bg-white/[0.035] hover:text-white/75"><span className="w-4 text-center text-violet-300/80">◉</span>Публичное демо</Link>
            <form action={signOutSelfService}><button className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-xs font-medium text-white/28 transition hover:bg-white/[0.035] hover:text-white/65"><span className="w-4 text-center">←</span>Выйти</button></form>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#09080d]/85 px-4 py-3 backdrop-blur-xl sm:px-7">
            <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
              <Link href="/app" className="flex items-center gap-3 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-[10px] font-black lowercase">cc.</span><span className="text-xs font-semibold text-white">{brandName}</span></Link>
              <div className="hidden lg:block"><p className="text-[10px] text-white/25">{brandName} <span className="mx-1.5">·</span> <span className="text-white/55">{eyebrow}</span></p></div>
              <div className="flex items-center gap-2"><span className="hidden rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[9px] text-white/25 sm:block">⌘ Поиск или команда</span><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-200">{brandName.slice(0, 1).toUpperCase()}</span></div>
            </div>
            <nav className="mx-auto mt-3 flex max-w-[1180px] gap-1 overflow-x-auto lg:hidden">{navItems.map((item) => <Link key={item.id} href={item.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-semibold ${active === item.id ? "bg-violet-500 text-white" : "text-white/35"}`}>{item.label}</Link>)}</nav>
          </header>

          <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-8 sm:px-7 sm:pt-10">
            <section className="mb-7 flex flex-wrap items-end justify-between gap-5">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">{eyebrow}</p><h1 className="mt-2 max-w-4xl font-heading text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">{title}</h1>{description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/38">{description}</p> : null}</div>
              {headerAction}
            </section>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

export const darkCardClass = "rounded-[22px] border border-white/[0.07] bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,.16)]";
