import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SelfServiceAppShell, darkCardClass } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { ARTICLE_STAGE_LABELS, articleHeroUrl, articleImageProgress, type ArticleStage } from "@/lib/article-engine";
import { prisma } from "@/lib/prisma";
import { PlatformBrandIcon, platformBrandFromName } from "@/app/(self-service)/platform-brand-icon";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import type { ArticleImage } from "@/lib/article-schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Статьи · Ribes",
  robots: { index: false, follow: false },
};

function platformLabel(value: string | null) {
  if (!value) return "Статья";
  if (/vc\.ru|виси/i.test(value)) return "VC.ru";
  if (/дзен|dzen|zen/i.test(value)) return "Дзен";
  return value;
}

function stageLabel(stage: string, status: string) {
  if (status === "failed") return "Нужно повторить";
  if (stage === "done") return "Готова";
  return ARTICLE_STAGE_LABELS[stage as ArticleStage] ?? "Готовится";
}

function stageProgress(stage: string, status: string) {
  if (status === "failed") return 0;
  return ({ brief: 12, draft: 32, humanize: 52, geo: 70, images: 86, done: 100 } as Record<string, number>)[stage] ?? 8;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(value);
}

export default async function SelfServiceArticlesPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/articles");

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    include: { client: { select: { id: true, name: true } } },
  });
  if (!membership) redirect("/start");

  const articles = await prisma.article.findMany({
    where: { clientId: membership.clientId, status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const ready = articles.filter((article) => article.stage === "done" && article.status !== "failed" && articleImageProgress(article.briefJson, article.images).complete).length;
  const preparing = articles.filter((article) => article.status !== "failed" && !articleImageProgress(article.briefJson, article.images).complete).length;
  const platforms = new Set(articles.map((article) => platformLabel(article.platformTarget))).size;
  const totalImages = articles.reduce((sum, article) => sum + (((article.images as ArticleImage[] | null) ?? []).filter((image) => image.url).length), 0);
  const articlesWithWordCount = articles.filter((article) => article.wordCount);
  const averageWords = articlesWithWordCount.length
    ? Math.round(articlesWithWordCount.reduce((sum, article) => sum + (article.wordCount ?? 0), 0) / articlesWithWordCount.length)
    : 0;

  return (
    <SelfServiceAppShell
      brandName={membership.client.name}
      active="articles"
      eyebrow="Статьи"
      title="Полноценные материалы для Дзена и VC.ru."
      description="Структура, полный текст, обложка и дополнительные изображения собраны в одном месте."
      headerAction={<Link href="/app/month#materials" className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.07]">Открыть календарь</Link>}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Всего статей", String(articles.length), "в кабинете"],
          ["Изображений", String(totalImages), "с обложками"],
          ["Средний объём", averageWords ? averageWords.toLocaleString("ru-RU") : "—", averageWords ? "слов" : "после подготовки"],
        ].map(([label, value, detail]) => <article key={label} className={`${darkCardClass} p-5`}><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/28">{label}</p><div className="mt-3 flex items-end justify-between gap-3"><p className="text-3xl font-semibold tracking-[-0.04em]">{value}</p><span className="text-[9px] font-semibold text-violet-300/70">{detail}</span></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-4/5 rounded-full bg-violet-500" /></div></article>)}
      </section>

      {articles.length ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-[10px]"><span className="text-white/35">{ready} готовы{preparing ? ` · ${preparing} ещё собираются` : " · можно размещать"}</span><span className="text-violet-300">{platforms || 0} площадки · Дзен и VC.ru</span></div> : null}

      {articles.length ? (
        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => {
            const cover = articleHeroUrl(article.images);
            const imageCount = ((article.images as ArticleImage[] | null) ?? []).filter((image) => image.url).length;
            const imageProgress = articleImageProgress(article.briefJson, article.images);
            const done = article.stage === "done" && article.status !== "failed" && imageProgress.complete;
            const progress = article.status === "failed"
              ? 0
              : imageProgress.total > 0 && !imageProgress.complete
                ? 70 + Math.round((imageProgress.ready / imageProgress.total) * 30)
                : stageProgress(article.stage, article.status);
            const editorHref = article.plannedContentItemId ? `/app/month/${article.plannedContentItemId}` : null;
            const platform = platformBrandFromName(article.platformTarget);
            return <article key={article.id} className={`${darkCardClass} group overflow-hidden transition hover:-translate-y-0.5 hover:border-violet-400/20`}>
              <div className="relative aspect-[16/7] overflow-hidden bg-[radial-gradient(circle_at_30%_10%,rgba(124,92,255,.25),transparent_45%),#111016]">
                {cover ? <img src={cover} alt="" className="h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-95" /> : <div className="grid h-full place-items-center"><span className="text-4xl font-light text-violet-300/45">Aa</span></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-[#111018] via-transparent to-transparent" />
                <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 py-1 pl-1 pr-3 text-[9px] font-semibold text-white/80 backdrop-blur">{platform ? <PlatformBrandIcon platform={platform} size="xs" /> : null}{platformLabel(article.platformTarget)}</span>
                <span className="absolute bottom-3 left-4 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-semibold text-white/80 backdrop-blur">{done ? "Готова" : article.status === "failed" ? "Нужно повторить" : imageProgress.total > 0 ? "Иллюстрации" : stageLabel(article.stage, article.status)}</span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3 text-[9px]"><span className="text-white/28">{imageCount ? `Обложка · ${imageCount} изображения` : "Визуалы готовятся"}</span><span className="text-white/20">{formatDate(article.createdAt)}</span></div>
                <h2 className="mt-3 line-clamp-3 min-h-[3.75rem] text-lg font-semibold leading-5 tracking-[-0.025em] text-white/82">{article.title}</h2>
                <div className="mt-4 flex items-center gap-3 text-[9px] text-white/25"><span>{article.wordCount ? `${article.wordCount.toLocaleString("ru-RU")} слов` : "объём уточняется"}</span><span>·</span><span>{imageCount ? `${imageCount} ${imageCount === 1 ? "изображение" : "изображения"}` : "визуалы готовятся"}</span></div>
                {!done ? <div className="mt-4"><div className="flex items-center justify-between text-[9px]"><span className="text-white/30">{article.status === "failed" ? "Нужно повторить" : imageProgress.total > 0 ? `Иллюстрации ${imageProgress.ready}/${imageProgress.total}` : stageLabel(article.stage, article.status)}</span><span className="font-semibold text-violet-300">{progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-[9px] leading-4 text-white/22">Откройте статью — подготовка продолжится с последнего сохранённого шага.</p></div> : null}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {editorHref ? <Link href={`/app/articles/${article.id}`} className="rounded-xl bg-violet-500 px-3 py-2.5 text-center text-[10px] font-semibold text-white transition hover:bg-violet-400">Проверить</Link> : <span className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center text-[10px] text-white/25">Архивная статья</span>}
                  {done ? <a href={`/api/self-service/articles/${article.id}/docx`} className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 text-center text-[10px] font-semibold text-white/55 transition hover:bg-white/[0.06]">DOCX ↓</a> : <span className="rounded-xl border border-white/[0.05] px-3 py-2.5 text-center text-[10px] text-white/20">Документ готовится</span>}
                </div>
              </div>
            </article>;
          })}
        </section>
      ) : (
        <section className={`${darkCardClass} mt-4 grid min-h-80 place-items-center p-8 text-center`}><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-lg text-violet-200">≡</span><h2 className="mt-5 text-xl font-semibold">Статьи появятся здесь</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/32">Выберите Дзен или VC.ru при настройке контент-месяца. Система подготовит структуру, полный текст и обложку автоматически.</p><Link href="/app/month" className="mt-6 inline-flex rounded-2xl bg-violet-500 px-5 py-3 text-xs font-semibold text-white">Открыть месяц</Link></div></section>
      )}
    </SelfServiceAppShell>
  );
}
