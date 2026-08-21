"use client";

import { useMemo, useState } from "react";
import { beginSelfServiceCheckout } from "@/lib/self-service/checkout-actions";
import {
  BILLING_DURATIONS,
  CREDIT_PLANS,
  CREDIT_PRODUCTS,
  CREDIT_TOP_UPS,
  displayCredits,
  formatRubles,
  subscriptionPriceMinor,
  type CreditPlanCode,
} from "@/lib/self-service/credit-catalog";

const checkoutErrors: Record<string, string> = {
  checkout_unavailable: "Оплата ещё не настроена. Мы уже сохранили ваш выбор — подключите тестовый магазин ЮKassa и повторите.",
  invalid_purchase: "Не удалось распознать выбранный тариф. Обновите страницу и попробуйте ещё раз.",
  payment_failed: "ЮKassa не смогла создать платёж. Деньги не списаны — попробуйте ещё раз чуть позже.",
  payment_canceled: "Платёж отменён. Деньги не списаны, тариф можно выбрать заново.",
  payment_missing: "Не удалось найти платёж. Вернитесь к тарифам и попробуйте ещё раз.",
  payment_verification_failed: "Платёж не прошёл безопасную проверку. Кредиты не начислены — обратитесь в поддержку, если деньги были списаны.",
};

export function CreditPricingSelector({ currentBalance, checkoutConfigured, testMode, error, payment }: { currentBalance: number; checkoutConfigured: boolean; testMode: boolean; error?: string; payment?: string }) {
  const [planCode, setPlanCode] = useState<CreditPlanCode>("growth");
  const [months, setMonths] = useState(1);
  const plan = CREDIT_PLANS.find((candidate) => candidate.code === planCode) ?? CREDIT_PLANS[1];
  const duration = BILLING_DURATIONS.find((candidate) => candidate.months === months) ?? BILLING_DURATIONS[0];
  const totalPrice = subscriptionPriceMinor(plan.code, duration.months);
  const monthlyEquivalent = Math.round(totalPrice / duration.months);
  const totalCredits = plan.credits * duration.months;
  const examples = useMemo(() => [
    `${Math.floor(plan.credits / CREDIT_PRODUCTS.visual_post.credits)} постов с визуалом`,
    `${Math.floor(plan.credits / CREDIT_PRODUCTS.article_with_cover.credits)} статей с обложкой`,
    "или любое сочетание форматов",
  ], [plan]);

  return (
    <div className="space-y-5">
      {payment === "success" ? <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-5 py-4 text-sm font-semibold text-violet-100">Оплата подтверждена. Кредиты уже начислены на баланс.</div> : null}
      {error && checkoutErrors[error] ? <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-5 py-4 text-sm text-amber-100/80">{checkoutErrors[error]}</div> : null}
      {testMode ? <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.07] px-5 py-3 text-xs text-violet-100/70">Тестовый режим ЮKassa: можно пройти оплату без настоящего списания.</div> : null}
      <section className="rounded-[24px] border border-violet-400/15 bg-[linear-gradient(145deg,rgba(111,75,255,.13),rgba(255,255,255,.025))] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Ваш баланс</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{displayCredits(currentBalance)} кредитов</p></div>
          <span className="rounded-full border border-white/[0.07] bg-black/15 px-3 py-1.5 text-[10px] text-white/38">не сгорают до использования</span>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Срок подписки</p><h2 className="mt-2 text-xl font-semibold text-white">Чем дольше, тем выгоднее</h2></div><p className="text-[10px] text-white/28">кредиты за оплаченный период начисляются сразу</p></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{BILLING_DURATIONS.map((item) => <button key={item.months} type="button" onClick={() => setMonths(item.months)} className={`rounded-2xl border px-4 py-3 text-left transition ${months === item.months ? "border-violet-400/35 bg-violet-500/14" : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.045]"}`}><span className="block text-xs font-semibold text-white/78">{item.label}</span><span className={`mt-1 block text-[9px] ${item.discountPercent ? "text-violet-300" : "text-white/24"}`}>{item.discountPercent ? `скидка ${item.discountPercent}%` : "без скидки"}</span></button>)}</div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">{CREDIT_PLANS.map((item) => {
        const selected = item.code === planCode;
        const price = subscriptionPriceMinor(item.code, months);
        return <button key={item.code} type="button" onClick={() => setPlanCode(item.code)} className={`relative rounded-[22px] border p-5 text-left transition ${selected ? "border-violet-400/35 bg-violet-500/10 shadow-[0_24px_70px_rgba(95,62,210,.18)]" : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.045]"}`}>{"featured" in item && item.featured ? <span className="absolute right-4 top-4 rounded-full bg-violet-500/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-violet-200">выгодный</span> : null}<p className="text-sm font-semibold text-white">{item.name}</p><p className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-white">{displayCredits(item.credits)}</p><p className="mt-1 text-[10px] text-white/30">кредитов каждый месяц</p><p className="mt-4 text-lg font-semibold text-white/80">{formatRubles(Math.round(price / months))} ₽ <span className="text-[10px] font-normal text-white/28">/ мес.</span></p><p className="mt-3 text-[10px] leading-4 text-white/32">{item.description}</p></button>;
      })}</section>

      <section className="grid gap-4 rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 lg:grid-cols-[1fr_auto] lg:items-center sm:p-6">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Вы выбрали</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">{plan.name} · {duration.label}</h3><div className="mt-3 flex flex-wrap gap-2">{examples.map((example) => <span key={example} className="rounded-full bg-white/[0.045] px-3 py-1.5 text-[9px] text-white/42">{example}</span>)}</div><p className="mt-4 text-xs text-white/32">Всего за период: {displayCredits(totalCredits)} кредитов · {formatRubles(totalPrice)} ₽</p></div>
        <div className="min-w-52 rounded-2xl bg-black/20 p-4 text-center"><p className="text-3xl font-semibold tracking-[-0.045em] text-white">{formatRubles(monthlyEquivalent)} ₽</p><p className="mt-1 text-[9px] text-white/28">в пересчёте на месяц</p>{duration.discountPercent ? <p className="mt-2 text-[10px] font-semibold text-violet-300">экономия {duration.discountPercent}%</p> : null}</div>
      </section>

      <form action={beginSelfServiceCheckout}>
        <input type="hidden" name="purchaseKind" value="subscription" />
        <input type="hidden" name="planCode" value={plan.code} />
        <input type="hidden" name="durationMonths" value={duration.months} />
        <button disabled={!checkoutConfigured} className="w-full rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45">{checkoutConfigured ? `Перейти к оплате · ${formatRubles(totalPrice)} ₽` : "Оплата появится после подключения ЮKassa"}</button>
      </form>

      <section className="pt-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Нужно больше в этом месяце?</p><h2 className="mt-2 text-xl font-semibold text-white">Докупить кредиты отдельно</h2><p className="mt-1 text-xs text-white/30">Без смены тарифа и без нового обязательства.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{CREDIT_TOP_UPS.map((topUp) => <form action={beginSelfServiceCheckout} key={topUp.code} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><input type="hidden" name="purchaseKind" value="top_up" /><input type="hidden" name="topUpCode" value={topUp.code} /><p className="text-2xl font-semibold text-white">+{displayCredits(topUp.credits)}</p><p className="mt-1 text-[9px] text-white/28">кредитов</p><p className="mt-4 text-sm font-semibold text-violet-200">{formatRubles(topUp.priceMinor)} ₽</p><button disabled={!checkoutConfigured} className="mt-4 w-full rounded-xl border border-white/[0.08] px-4 py-2.5 text-[10px] font-semibold text-white/65 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35">Купить</button></form>)}</div></section>
    </div>
  );
}
