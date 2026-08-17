"use client";

import { useMemo, useState } from "react";
import { saveSelfServiceContentOrder } from "@/lib/self-service/content-order-actions";
import { CREDIT_PRODUCTS } from "@/lib/self-service/credit-catalog";

type Configuration = {
  vkPosts: number;
  telegramPosts: number;
  dzenArticles: number;
  vcruArticles: number;
  carousels: number;
  quickAnnouncements: number;
  reviewReplies: number;
};

const items: Array<{ key: keyof Configuration; title: string; detail: string; credits: number; icon: string }> = [
  { key: "vkPosts", title: "Посты VK", detail: "Готовый текст и визуал", credits: CREDIT_PRODUCTS.visual_post.credits, icon: "VK" },
  { key: "telegramPosts", title: "Посты Telegram", detail: "Нативная версия темы и визуал", credits: CREDIT_PRODUCTS.visual_post.credits, icon: "TG" },
  { key: "dzenArticles", title: "Статьи Дзен", detail: "Полный текст и обложка", credits: CREDIT_PRODUCTS.article_with_cover.credits, icon: "Д" },
  { key: "vcruArticles", title: "Статьи VC.ru", detail: "Деловая статья и обложка", credits: CREDIT_PRODUCTS.article_with_cover.credits, icon: "VC" },
  { key: "carousels", title: "Карусели", detail: "Четыре отдельных слайда", credits: CREDIT_PRODUCTS.carousel.credits, icon: "▦" },
  { key: "quickAnnouncements", title: "Быстрые анонсы", detail: "Короткий материал вне плана", credits: CREDIT_PRODUCTS.quick_announcement.credits, icon: "+" },
  { key: "reviewReplies", title: "Ответы на отзывы", detail: "В тоне вашего бренда", credits: CREDIT_PRODUCTS.review_reply.credits, icon: "↳" },
];

function Counter({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 p-1"><button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="grid h-8 w-8 place-items-center rounded-lg text-sm text-white/45 transition hover:bg-white/[0.06] hover:text-white">−</button><span className="w-7 text-center text-sm font-semibold text-white">{value}</span><button type="button" onClick={() => onChange(Math.min(100, value + 1))} className="grid h-8 w-8 place-items-center rounded-lg text-sm text-white/45 transition hover:bg-white/[0.06] hover:text-white">+</button></div>;
}

export function ContentMixBuilder({ balance, initial, notice, error }: { balance: number; initial: Configuration; notice?: string; error?: string }) {
  const [configuration, setConfiguration] = useState(initial);
  const total = useMemo(() => items.reduce((sum, item) => sum + configuration[item.key] * item.credits, 0), [configuration]);
  const enough = balance >= total;

  return (
    <form action={saveSelfServiceContentOrder} className="grid gap-5 lg:grid-cols-[1fr_330px]">
      <section className="space-y-3">
        {notice === "saved" ? <p className="rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">Набор сохранён. Пока кредиты не списаны и генерация не запущена.</p> : null}
        {error === "empty" ? <p className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-xs text-amber-100/80">Добавьте хотя бы один материал.</p> : null}
        {items.map((item) => <article key={item.key} className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5"><div className="flex min-w-0 items-center gap-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-[10px] font-bold text-violet-200">{item.icon}</span><div><p className="text-sm font-semibold text-white/82">{item.title}</p><p className="mt-1 text-[10px] text-white/28">{item.detail} · {item.credits} {item.credits === 1 ? "кредит" : "кредитов"}</p></div></div><Counter value={configuration[item.key]} onChange={(value) => setConfiguration((current) => ({ ...current, [item.key]: value }))} /><input type="hidden" name={item.key} value={configuration[item.key]} /></article>)}
      </section>

      <aside className="h-fit rounded-[24px] border border-violet-400/15 bg-[linear-gradient(145deg,rgba(111,75,255,.14),rgba(255,255,255,.025))] p-5 lg:sticky lg:top-24 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Ваш набор</p><div className="mt-5 flex items-end justify-between"><div><p className="text-4xl font-semibold tracking-[-0.05em] text-white">{total}</p><p className="mt-1 text-[10px] text-white/28">кредитов потребуется</p></div><div className="text-right"><p className="text-lg font-semibold text-white/75">{balance}</p><p className="mt-1 text-[9px] text-white/25">сейчас на балансе</p></div></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${enough ? "bg-violet-500" : "bg-amber-300/70"}`} style={{ width: `${Math.min(100, balance ? (total / balance) * 100 : 100)}%` }} /></div><p className={`mt-3 text-[10px] leading-4 ${enough ? "text-white/32" : "text-amber-100/70"}`}>{total === 0 ? "Добавьте нужные материалы — стоимость считается сразу." : enough ? `После запуска останется ${balance - total} кредитов.` : `Не хватает ${total - balance} кредитов. Набор всё равно можно сохранить.`}</p><button className="mt-6 w-full rounded-xl bg-white px-5 py-3.5 text-xs font-semibold text-slate-950 transition hover:bg-violet-50">Сохранить набор</button><p className="mt-3 text-center text-[9px] text-white/22">Сохранение не списывает кредиты</p><a href="/app/credits" className="mt-4 block text-center text-[10px] font-semibold text-violet-300">Тарифы и пополнение →</a></aside>
    </form>
  );
}
