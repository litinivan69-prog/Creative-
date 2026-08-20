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

export default async function QuickPostPage({ searchParams }: { searchParams: Promise<{ result?: string; error?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/quick-post");
  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { client: { select: { id: true, name: true } } },
  });
  if (!membership) redirect("/start");
  await grantTrialCredits(membership.client.id);
  const [wallet, result, recent] = await Promise.all([
    prisma.creditWallet.findUnique({ where: { clientId: membership.client.id }, select: { balance: true } }),
    query.result ? prisma.selfServiceInstantContent.findFirst({ where: { id: query.result, clientId: membership.client.id, kind: "quick_post" } }) : null,
    prisma.selfServiceInstantContent.findMany({ where: { clientId: membership.client.id, kind: "quick_post" }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <SelfServiceAppShell brandName={membership.client.name} active="quick" eyebrow="Вне плана" title="Быстрый пост" description={`Расскажите, что произошло. Система соберёт готовую публикацию за ${displayCredits(1)} кредитов — без пересборки всего месяца.`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form action={generateSelfServiceInstantContent} className={`${darkCardClass} p-5 sm:p-7`}>
          <input type="hidden" name="kind" value="quick_post" />
          {query.error === "credits" ? <p className="mb-4 rounded-xl bg-amber-300/[0.08] px-4 py-3 text-xs text-amber-100">Не хватает {displayCredits(1)} кредитов. Сохранённые материалы не изменились.</p> : null}
          {query.error === "source" ? <p className="mb-4 rounded-xl bg-amber-300/[0.08] px-4 py-3 text-xs text-amber-100">Добавьте хотя бы несколько фактов для поста.</p> : null}
          <label className="block text-[10px] font-bold uppercase tracking-[0.13em] text-white/32">Куда подготовить</label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['VK', 'Telegram', 'Одноклассники'].map((platform, index) => <label key={platform} className="cursor-pointer"><input type="radio" name="platform" value={platform} defaultChecked={index === 0} className="peer sr-only" /><span className="grid min-h-12 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 text-center text-[11px] font-semibold text-white/45 transition peer-checked:border-violet-400/35 peer-checked:bg-violet-500/12 peer-checked:text-violet-100">{platform}</span></label>)}
          </div>
          <label className="mt-6 block text-[10px] font-bold uppercase tracking-[0.13em] text-white/32">Что случилось</label>
          <textarea name="sourceText" required rows={8} placeholder="Например: сегодня получили новую поставку. В наличии появились латунные фитинги трёх размеров. Есть фотографии со склада. Цену в посте не указываем." className="mt-3 w-full resize-y rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-4 text-sm leading-6 text-white/75 outline-none placeholder:text-white/18 focus:border-violet-400/35" />
          <div className="mt-4 flex items-center justify-between gap-4"><p className="text-[10px] text-white/28">Баланс: {displayCredits(wallet?.balance ?? 0)} кредитов</p><button className="rounded-xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white">Создать за {displayCredits(1)} кредитов</button></div>
        </form>

        <aside className={`${darkCardClass} h-fit p-5`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-violet-300">Результат</p>
          {result?.generatedText ? <div className="mt-4"><InstantResult text={result.generatedText} /></div> : result?.status === "failed" ? <div className="mt-4"><p className="text-xs leading-5 text-amber-100/70">{result.errorMessage}</p><form action={retrySelfServiceInstantContent} className="mt-3"><input type="hidden" name="id" value={result.id} /><button className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white/65">Повторить бесплатно</button></form></div> : <p className="mt-4 text-xs leading-5 text-white/28">Готовый текст появится здесь. Перед публикацией его можно проверить и скопировать.</p>}
          {recent.length ? <div className="mt-6 border-t border-white/[0.06] pt-4"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/22">Последние</p>{recent.slice(0, 3).map((item) => <a key={item.id} href={`/app/quick-post?result=${item.id}`} className="mt-2 block truncate text-[11px] text-white/42 hover:text-violet-200">{item.platform} · {item.sourceText}</a>)}</div> : null}
        </aside>
      </div>
    </SelfServiceAppShell>
  );
}
