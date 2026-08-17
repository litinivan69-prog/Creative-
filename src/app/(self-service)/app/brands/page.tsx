import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { selectSelfServiceBrand } from "@/lib/self-service/onboarding-actions";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { SelfServiceAppShell, darkCardClass } from "../self-service-app-shell";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/brands");

  const [activeMembership, memberships] = await Promise.all([
    prisma.workspaceMembership.findFirst({ where: await selfServiceMembershipWhere(email), select: { clientId: true, client: { select: { name: true } } } }),
    prisma.workspaceMembership.findMany({ where: { user: { email }, role: "owner" }, orderBy: { createdAt: "asc" }, select: { client: { select: { id: true, name: true, website: true } } } }),
  ]);
  if (!activeMembership) redirect("/start");

  return (
    <SelfServiceAppShell brandName={activeMembership.client.name} active="channels" eyebrow="Бренды" title="Ваши бренды" description="Переключайтесь между кабинетами. Материалы, кредиты и настройки каждого бренда хранятся отдельно.">
      <div className="grid gap-3 md:grid-cols-2">
        {memberships.map(({ client }) => {
          const active = client.id === activeMembership.clientId;
          return (
            <form key={client.id} action={selectSelfServiceBrand} className={`${darkCardClass} p-5 ${active ? "border-violet-400/30 bg-violet-500/[0.08]" : ""}`}>
              <input type="hidden" name="clientId" value={client.id} />
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-lg font-semibold">{client.name}</p><p className="mt-1 truncate text-xs text-white/30">{client.website || "Бренд без сайта"}</p></div>
                {active ? <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[9px] font-semibold text-violet-200">открыт</span> : null}
              </div>
              <button disabled={active} className="mt-6 w-full rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:cursor-default disabled:opacity-35">{active ? "Текущий бренд" : "Открыть бренд"}</button>
            </form>
          );
        })}
        <a href="/start" className={`${darkCardClass} grid min-h-40 place-items-center border-dashed p-5 text-center transition hover:border-violet-400/30 hover:bg-violet-500/[0.06]`}><span><span className="block text-3xl text-violet-300">+</span><span className="mt-2 block text-sm font-semibold">Добавить бренд</span><span className="mt-1 block text-xs text-white/30">Заполнить новый короткий бриф</span></span></a>
      </div>
    </SelfServiceAppShell>
  );
}
