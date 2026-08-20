import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { grantTrialCredits } from "@/lib/self-service/credits";
import { displayCredits } from "@/lib/self-service/credit-catalog";
import { generateSelfServiceInstantContent, retrySelfServiceInstantContent } from "@/lib/self-service/instant-content-actions";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { InstantResult } from "../instant-result";
import { SelfServiceAppShell, darkCardClass } from "../self-service-app-shell";

export const dynamic = "force-dynamic";

export default async function ReputationPage({ searchParams }: { searchParams: Promise<{ result?: string; error?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/reputation");
  const membership = await prisma.workspaceMembership.findFirst({ where: await selfServiceMembershipWhere(email), select: { client: { select: { id: true, name: true } } } });
  if (!membership) redirect("/start");
  await grantTrialCredits(membership.client.id);
  const [wallet, result, recent] = await Promise.all([
    prisma.creditWallet.findUnique({ where: { clientId: membership.client.id }, select: { balance: true } }),
    query.result ? prisma.selfServiceInstantContent.findFirst({ where: { id: query.result, clientId: membership.client.id, kind: "yandex_review_reply" } }) : null,
    prisma.selfServiceInstantContent.findMany({ where: { clientId: membership.client.id, kind: "yandex_review_reply" }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  return (
    <SelfServiceAppShell brandName={membership.client.name} active="reputation" eyebrow="Яндекс Карты" title="Ответы на отзывы" description="Вставьте новый отзыв — система подготовит персональный официальный ответ в тоне вашего бренда.">
      <div className="mb-5 rounded-2xl border border-violet-400/15 bg-violet-500/[0.07] px-4 py-3 text-xs leading-5 text-violet-100/65">MVP: ответ создаётся автоматически, публикация в Яндекс Картах пока выполняется вручную после проверки. Так мы не используем хрупкую неофициальную автоматизацию.</div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <form action={generateSelfServiceInstantContent} className={`${darkCardClass} p-5 sm:p-7`}>
          <input type="hidden" name="kind" value="yandex_review_reply" />
          {query.error === "credits" ? <p className="mb-4 rounded-xl bg-amber-300/[0.08] px-4 py-3 text-xs text-amber-100">Не хватает {displayCredits(1)} кредитов.</p> : null}
          {query.error === "source" ? <p className="mb-4 rounded-xl bg-amber-300/[0.08] px-4 py-3 text-xs text-amber-100">Вставьте текст отзыва целиком.</p> : null}
          <label className="block text-[10px] font-bold uppercase tracking-[0.13em] text-white/32">Оценка клиента</label>
          <div className="mt-3 flex gap-2">{[1,2,3,4,5].map((rating) => <label key={rating} className="cursor-pointer"><input type="radio" name="rating" value={rating} defaultChecked={rating === 5} className="peer sr-only" /><span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-xs text-white/35 peer-checked:border-violet-400/35 peer-checked:bg-violet-500/12 peer-checked:text-violet-100">{rating}</span></label>)}</div>
          <label className="mt-6 block text-[10px] font-bold uppercase tracking-[0.13em] text-white/32">Текст отзыва</label>
          <textarea name="sourceText" required rows={9} placeholder="Вставьте отзыв из Яндекс Карт целиком…" className="mt-3 w-full resize-y rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-4 text-sm leading-6 text-white/75 outline-none placeholder:text-white/18 focus:border-violet-400/35" />
          <div className="mt-4 flex items-center justify-between gap-4"><p className="text-[10px] text-white/28">Баланс: {displayCredits(wallet?.balance ?? 0)} кредитов</p><button className="rounded-xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white">Подготовить за {displayCredits(1)} кредитов</button></div>
        </form>
        <aside className={`${darkCardClass} h-fit p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-violet-300">Готовый ответ</p>{result?.generatedText ? <div className="mt-4"><InstantResult text={result.generatedText} /><a href="https://business.yandex.ru/" target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[10px] font-semibold text-violet-300">Перейти к отзывам в Яндексе →</a></div> : result?.status === "failed" ? <div className="mt-4"><p className="text-xs leading-5 text-amber-100/70">{result.errorMessage}</p><form action={retrySelfServiceInstantContent} className="mt-3"><input type="hidden" name="id" value={result.id} /><button className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white/65">Повторить бесплатно</button></form></div> : <p className="mt-4 text-xs leading-5 text-white/28">Здесь появится безопасный персональный ответ. Проверьте его, скопируйте и опубликуйте в кабинете Яндекса.</p>}{recent.length ? <div className="mt-6 border-t border-white/[0.06] pt-4"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/22">Последние ответы</p>{recent.slice(0, 4).map((item) => <a key={item.id} href={`/app/reputation?result=${item.id}`} className="mt-2 block truncate text-[11px] text-white/42 hover:text-violet-200">{item.rating ? `${item.rating}/5` : "Без оценки"} · {item.sourceText}</a>)}</div> : null}</aside>
      </div>
    </SelfServiceAppShell>
  );
}
