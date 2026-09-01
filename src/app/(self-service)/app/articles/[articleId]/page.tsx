import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArticleReader } from "@/app/article-reader";
import { ArticleCopyButton } from "@/app/(self-service)/app/articles/article-copy-button";
import { ArticleImageRunner } from "@/app/(self-service)/app/articles/article-image-runner";
import { SelfServiceAppShell, darkCardClass } from "@/app/(self-service)/app/self-service-app-shell";
import { auth } from "@/auth";
import { countWords, type ArticleCallout, type ArticleFaqItem, type ArticleImage, type ArticleSource } from "@/lib/article-schema";
import { articleImageProgress } from "@/lib/article-engine";
import { parseArticleMarkdown } from "@/lib/article-markdown";
import { prisma } from "@/lib/prisma";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Проверка статьи · Ribes",
  robots: { index: false, follow: false },
};

function platformLabel(value: string | null) {
  return /vc\.ru|виси/i.test(value ?? "") ? "VC.ru" : "Дзен";
}

function editorUrl(value: string | null) {
  return /vc\.ru|виси/i.test(value ?? "") ? "https://vc.ru/new" : "https://dzen.ru/profile/editor";
}

export default async function SelfServiceArticlePreviewPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect(`/sign-in?callbackUrl=/app/articles/${encodeURIComponent(articleId)}`);

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true, client: { select: { name: true } } },
  });
  if (!membership) redirect("/start");

  const article = await prisma.article.findFirst({
    where: { id: articleId, clientId: membership.clientId, status: { not: "archived" } },
  });
  if (!article) notFound();

  const images = (article.images as ArticleImage[] | null) ?? [];
  const callouts = (article.calloutNotes as ArticleCallout[] | null) ?? [];
  const faq = (article.faq as ArticleFaqItem[] | null) ?? [];
  const sources = (article.sources as ArticleSource[] | null) ?? [];
  const blocks = parseArticleMarkdown(article.bodyMarkdown);
  const words = article.wordCount ?? countWords(article.bodyMarkdown);
  const readyImages = images.filter((image) => image.url);
  const imageProgress = articleImageProgress(article.briefJson, article.images);
  const checks = [
    { label: "Полный текст", detail: `${words.toLocaleString("ru-RU")} слов`, ok: words >= 900 },
    { label: "Структура", detail: `${blocks.filter((block) => block.type === "h2").length} разделов`, ok: blocks.filter((block) => block.type === "h2").length >= 4 },
    { label: "Обложка", detail: images.some((image) => image.role === "hero" && image.url) ? "готова" : "ещё готовится", ok: images.some((image) => image.role === "hero" && image.url) },
    { label: "Изображения внутри", detail: `${readyImages.filter((image) => image.role === "inline").length} готово`, ok: readyImages.filter((image) => image.role === "inline").length >= 2 },
    { label: "Частые вопросы", detail: `${faq.length} вопросов`, ok: faq.length >= 4 },
  ];
  const readyChecks = checks.filter((check) => check.ok).length;
  const platform = platformLabel(article.platformTarget);
  const itemHref = article.plannedContentItemId ? `/app/month/${article.plannedContentItemId}` : "/app/articles";

  return (
    <SelfServiceAppShell
      brandName={membership.client.name}
      active="articles"
      eyebrow={`${platform} · контроль публикации`}
      title="Посмотрите статью глазами читателя."
      description="Здесь нет технической разметки: заголовки, текст и изображения стоят так, как должны выглядеть в готовом материале."
      headerAction={<Link href={itemHref} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.07]">← Редактировать</Link>}
    >
      {!imageProgress.complete ? <ArticleImageRunner articleId={article.id} initialReady={imageProgress.ready} total={imageProgress.total} /> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#f8f7fb] shadow-[0_30px_90px_rgba(0,0,0,.28)]">
          <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] bg-white/75 px-5 py-3 text-[10px] text-slate-500 backdrop-blur sm:px-8">
            <span>Предпросмотр · {platform}</span>
            <span>{words.toLocaleString("ru-RU")} слов · {readyImages.length} изображений</span>
          </div>
          <div id="article-publication-preview" className="px-5 py-8 sm:px-10 sm:py-12">
            <ArticleReader
              article={{
                title: article.title,
                bodyMarkdown: article.bodyMarkdown,
                images,
                callouts,
                faq,
                sources,
                metaTitle: article.metaTitle,
                metaDescription: article.metaDescription,
              }}
            />
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className={`${darkCardClass} p-5`}>
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Готовность</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{readyChecks}/{checks.length}</p></div>
              <span className="text-[10px] text-white/28">проверок пройдено</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(readyChecks / checks.length) * 100}%` }} /></div>
            <div className="mt-5 space-y-3">
              {checks.map((check) => <div key={check.label} className="flex items-center justify-between gap-3 text-[10px]"><span className={check.ok ? "text-white/58" : "text-white/32"}><span className={`mr-2 ${check.ok ? "text-violet-300" : "text-white/18"}`}>{check.ok ? "✓" : "○"}</span>{check.label}</span><span className="text-right text-white/24">{check.detail}</span></div>)}
            </div>
          </section>

          <section className={`${darkCardClass} p-5`}>
            <p className="text-sm font-semibold text-white/75">Размещение на {platform}</p>
            <p className="mt-2 text-[10px] leading-4 text-white/30">Скопируйте материал с форматированием. Изображения можно открыть и скачать прямо из предпросмотра или получить вместе с документом.</p>
            <div className="mt-4 grid gap-2">
              <ArticleCopyButton targetId="article-publication-preview" />
              <a href={`/api/self-service/articles/${article.id}/docx`} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center text-xs font-semibold text-white/60 transition hover:bg-white/[0.07]">Скачать документ</a>
              <a href={editorUrl(article.platformTarget)} target="_blank" rel="noreferrer" className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center text-xs font-semibold text-white/60 transition hover:bg-white/[0.07]">Открыть редактор {platform} ↗</a>
            </div>
          </section>

          <section className={`${darkCardClass} p-5`}>
            <p className="text-xs font-semibold text-white/65">Перед публикацией</p>
            <ol className="mt-3 space-y-2 text-[10px] leading-4 text-white/28">
              <li><span className="mr-2 text-violet-300">1.</span>Проверьте факты, цены и названия.</li>
              <li><span className="mr-2 text-violet-300">2.</span>Убедитесь, что изображения не повторяются.</li>
              <li><span className="mr-2 text-violet-300">3.</span>После размещения сохраните ссылку в материале.</li>
            </ol>
          </section>
        </aside>
      </div>
    </SelfServiceAppShell>
  );
}
