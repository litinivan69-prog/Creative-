import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signOutSelfService } from "@/lib/self-service/auth-actions";
import { MaterialEditor } from "@/app/(self-service)/app/month/[itemId]/material-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Материал · Adaptive Presence",
  robots: { index: false, follow: false },
};

function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

function platformLabel(value: string) {
  if (/telegram|телег/i.test(value)) return "Telegram";
  if (/(^|\s)(vk|вк)(\s|$)|vkontakte|вконтакте/i.test(value)) return "VK";
  if (/vc\.ru|виси/i.test(value)) return "VC.ru";
  if (/дзен|dzen/i.test(value)) return "Дзен";
  return value;
}

function variantSource(variant: { imageUrl: string | null; imageBase64: string | null; mimeType: string }) {
  if (variant.imageUrl) return variant.imageUrl;
  if (variant.imageBase64) return `data:${variant.mimeType};base64,${variant.imageBase64}`;
  return null;
}

export default async function SelfServiceMaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ itemId }, query] = await Promise.all([params, searchParams]);
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect(`/sign-in?callbackUrl=/app/month/${encodeURIComponent(itemId)}`);

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    select: { clientId: true, client: { select: { name: true } } },
  });
  if (!membership) redirect("/start");

  const item = await prisma.plannedContentItem.findFirst({
    where: { id: itemId, monthlyPlan: { clientId: membership.clientId } },
    include: {
      monthlyPlan: { select: { month: true } },
      contentDraft: true,
      generatedCreativeVariants: { orderBy: { createdAt: "desc" } },
      creativeAssets: {
        orderBy: { createdAt: "asc" },
        include: { generatedVariants: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });
  if (!item) notFound();

  const article = item.deliverableKind === "article"
    ? await prisma.article.findFirst({ where: { plannedContentItemId: item.id, clientId: membership.clientId } })
    : null;
  const isTelegram = /telegram|телег/i.test(item.platformName);
  const body = article?.bodyMarkdown || (isTelegram ? item.contentDraft?.telegramBody : null) || item.contentDraft?.draftBody || "";
  const slides = item.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");
  const visualVariants = slides.length > 0
    ? slides.flatMap((asset) => asset.generatedVariants)
    : item.generatedCreativeVariants.slice(0, 1);
  const visuals = visualVariants.map((variant) => ({ id: variant.id, src: variantSource(variant) })).filter((visual): visual is { id: string; src: string } => Boolean(visual.src));

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(circle_at_30%_0%,rgba(139,92,246,0.14),transparent_55%)]" />
      <div className="relative mx-auto max-w-[1180px]">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur-xl sm:px-5">
          <Link href="/app" className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-xs font-extrabold lowercase text-white">cc.</div><div><p className="text-sm font-semibold text-slate-950">{membership.client.name}</p><p className="text-[11px] text-slate-400">Adaptive Presence</p></div></Link>
          <Link href="/app/month" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:text-violet-700">← Все материалы</Link>
          <form action={signOutSelfService}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">Выйти</button></form>
        </header>

        <section className="pb-7 pt-9 sm:pt-11">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><span>{formatDate(item.plannedDate)}</span><span>·</span><span>{platformLabel(item.platformName)}</span><span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">{body ? "Текст готов" : "Готовится"}</span></div>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">{article?.title || item.contentDraft?.draftTitle || item.topic}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{item.goal}</p>
        </section>

        {query.notice === "saved" ? <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800">Изменения сохранены.</div> : null}
        {query.error ? <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.error === "text_not_ready" ? "Текст пока не готов. Подождите завершения подготовки." : "Проверьте текст и попробуйте ещё раз."}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className="rounded-[28px] border border-white bg-white p-5 shadow-[0_22px_70px_rgba(77,61,112,0.07)] sm:p-7">
            <div className="mb-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Текст публикации</p><h2 className="mt-2 text-lg font-semibold text-slate-950">Можно сразу отредактировать под себя</h2></div>
            <MaterialEditor itemId={item.id} initialBody={body} ready={Boolean(body)} />
          </section>

          <aside className="space-y-5">
            <section className="rounded-[28px] border border-white bg-white p-5 shadow-[0_22px_70px_rgba(77,61,112,0.07)]">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Визуал</p><h2 className="mt-2 text-base font-semibold text-slate-950">{slides.length > 0 ? `Карусель · ${visuals.length}/${slides.length}` : "Изображение материала"}</h2></div>{visuals[0] ? <a href={`/api/self-service/materials/${item.id}/visuals`} className="rounded-full border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600">{visuals.length > 1 ? "Скачать всё · ZIP" : "Скачать"}</a> : null}</div>
              {visuals.length > 0 ? (
                <div className={`mt-5 grid gap-3 ${visuals.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {visuals.map((visual, index) => <div key={visual.id} className="group relative overflow-hidden rounded-[20px] border border-slate-100 bg-slate-50"><img src={visual.src} alt={`Визуал ${index + 1}`} className="aspect-square h-full w-full object-cover" />{visuals.length > 1 ? <><span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-600">{index + 1}</span><a href={`/api/self-service/materials/${item.id}/visuals?variant=${visual.id}`} aria-label={`Скачать слайд ${index + 1}`} className="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100">Скачать</a></> : null}</div>)}
                </div>
              ) : (
                <div className="mt-5 grid aspect-square place-items-center rounded-[22px] border border-dashed border-violet-200 bg-violet-50/45 p-6 text-center"><div><span className="mx-auto block h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500" /><p className="mt-4 text-sm font-semibold text-slate-900">Визуал готовится</p><p className="mt-2 text-xs leading-5 text-slate-500">Он появится автоматически.</p></div></div>
              )}
            </section>

            <section className="rounded-[24px] border border-white bg-white p-5 shadow-[0_18px_55px_rgba(77,61,112,0.05)]"><p className="text-xs font-semibold text-slate-900">Зачем этот материал</p><p className="mt-2 text-xs leading-5 text-slate-500">{item.sequenceReason || item.channelRole || "Материал поддерживает регулярное присутствие бренда и ведёт аудиторию к следующему полезному действию."}</p></section>
          </aside>
        </div>
      </div>
    </main>
  );
}
