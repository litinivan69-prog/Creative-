import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MaterialEditor } from "@/app/(self-service)/app/month/[itemId]/material-editor";
import { darkCardClass, SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";
import { markSelfServiceMaterialPublishedManually, markSelfServiceMaterialReady, saveSelfServicePublicationSchedule } from "@/lib/self-service/material-actions";
import { publishSelfServiceMaterialNow } from "@/lib/self-service/channel-actions";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import type { ArticleImage } from "@/lib/article-schema";

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

function articleEditorUrl(platformName: string) {
  if (/vc\.ru|виси/i.test(platformName)) return "https://vc.ru/new";
  if (/дзен|dzen/i.test(platformName)) return "https://dzen.ru/profile/editor";
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
    where: await selfServiceMembershipWhere(email),
    select: {
      clientId: true,
      client: {
        select: {
          name: true,
          channels: { where: { status: "active", platform: { in: ["vk", "telegram", "vcru"] } }, select: { id: true, platform: true } },
        },
      },
    },
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
      scheduledPublications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, scheduledDate: true, scheduledTime: true, timezone: true, status: true, publishStatus: true, publishErrorMessage: true, externalUrl: true },
      },
    },
  });
  if (!item) notFound();

  const isArticle = item.deliverableKind === "article";
  const article = isArticle
    ? await prisma.article.findFirst({ where: { plannedContentItemId: item.id, clientId: membership.clientId } })
    : null;
  const isTelegram = /telegram|телег/i.test(item.platformName);
  const body = article?.bodyMarkdown || (isTelegram ? item.contentDraft?.telegramBody : null) || item.contentDraft?.draftBody || "";
  const slides = item.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");
  const articleImages = ((article?.images as ArticleImage[] | null) ?? [])
    .map((image, sourceIndex) => ({ image, sourceIndex }))
    .filter((entry) => Boolean(entry.image.url));
  const visualVariants = slides.length > 0
    ? slides.flatMap((asset) => asset.generatedVariants)
    : item.generatedCreativeVariants.slice(0, 1);
  const generatedVisuals = visualVariants
    .map((variant) => ({ id: variant.id, src: variantSource(variant), downloadHref: `/api/self-service/materials/${item.id}/visuals?variant=${variant.id}`, label: "Визуал" }))
    .filter((visual): visual is { id: string; src: string; downloadHref: string; label: string } => Boolean(visual.src));
  const visuals = isArticle
    ? articleImages.map(({ image, sourceIndex }, index) => ({
        id: `article-image-${sourceIndex}`,
        src: image.url!,
        downloadHref: `/api/self-service/articles/${article!.id}/images/${sourceIndex}`,
        label: image.role === "hero" ? "Обложка" : `Иллюстрация ${index}`,
      }))
    : generatedVisuals;
  const materialTitle = article?.title || item.contentDraft?.draftTitle || item.topic;
  const publication = item.scheduledPublications[0] ?? null;
  const isReady = item.contentDraft?.status === "ready_to_schedule" || item.contentDraft?.status === "approved" || publication?.status === "ready";
  const isPublished = publication?.publishStatus === "published";
  const targetPlatform = /vc\.ru|виси/i.test(item.platformName) ? "vcru" : /vk|вконтакт/i.test(item.platformName) ? "vk" : /telegram|телеграм|\btg\b/i.test(item.platformName) ? "telegram" : null;
  const supportsDirectPublish = Boolean(targetPlatform);
  const canPublish = Boolean(publication && targetPlatform && membership.client.channels.some((channel) => channel.platform === targetPlatform));
  const visualReady = isArticle ? articleImages.length > 0 : slides.length > 0 ? visuals.length === slides.length : visuals.length > 0;
  const editorUrl = isArticle ? articleEditorUrl(item.platformName) : null;

  return (
    <SelfServiceAppShell
      brandName={membership.client.name}
      active="materials"
      eyebrow={`${formatDate(item.plannedDate)} · ${platformLabel(item.platformName)}`}
      title={materialTitle}
      description={isArticle ? "Полноценная редакционная статья: проверьте структуру, текст и обложку, затем скачайте документ для размещения." : "Проверьте текст и изображение. Если всё устраивает — подтвердите материал одним действием."}
      headerAction={<Link href="/app/month#materials" className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.07]">← Все материалы</Link>}
    >
      <div>
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px]">
          <span className={`rounded-full px-3 py-1.5 font-semibold ${isReady ? "bg-violet-500/15 text-violet-200" : "bg-white/[0.05] text-white/45"}`}>{isReady ? "Готов к публикации" : body && visualReady ? "Можно подтвердить" : "Материал готовится"}</span>
          <span className="rounded-full bg-white/[0.035] px-3 py-1.5 text-white/30">{publication?.scheduledDate ?? item.plannedDate}{publication?.scheduledTime ? ` · ${publication.scheduledTime}` : ""}</span>
        </div>

        {query.notice === "saved" ? <div className="mb-5 rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">Изменения сохранены.</div> : null}
        {query.notice === "ready" ? <div className="mb-5 rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">Готово. Материал подтверждён и подготовлен к публикации.</div> : null}
        {query.notice === "published" ? <div className="mb-5 rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">Материал опубликован.</div> : null}
        {query.notice === "schedule_saved" ? <div className="mb-5 rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">Дата и время сохранены.</div> : null}
        {query.notice === "already_published" ? <div className="mb-5 rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3 text-xs font-semibold text-violet-100">Материал уже был опубликован — повтор не создавался.</div> : null}
        {query.error ? <div className="mb-5 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">{query.error === "text_not_ready" ? "Текст пока готовится." : query.error === "material_not_ready" ? "Сначала дождитесь текста и всех изображений." : query.error === "confirm_first" ? "Сначала подтвердите готовность материала." : query.error === "publication_missing" ? "Публикация ещё не добавлена в календарь." : query.error === "publication_url_invalid" ? "Проверьте ссылку на опубликованный материал." : query.error === "manual_export_only" ? "Для статей Дзен и VC.ru пока используйте скачивание и ручное размещение." : query.error === "schedule_invalid" ? "Проверьте дату и время публикации." : query.error === "already_published" ? "Опубликованный материал уже нельзя перепланировать." : "Не удалось опубликовать. Проверьте подключение площадки и попробуйте ещё раз."}</div> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,.88fr)]">
          <section className={`${darkCardClass} p-5 sm:p-6`}>
            <div className="mb-4 flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">{isArticle ? "Статья" : "Текст"}</p><h2 className="mt-1.5 text-sm font-semibold text-white/80">{isArticle ? "Структура Markdown сохранится в документе" : "Отредактируйте, если хотите"}</h2></div><span className="text-[10px] text-white/22">сохраняется вручную</span></div>
            <MaterialEditor itemId={item.id} initialBody={body} ready={Boolean(body)} article={isArticle} />
          </section>

          <aside className="space-y-4">
            <section className={`${darkCardClass} overflow-hidden`}>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">{isArticle ? "Визуалы статьи" : "Визуал"}</p><p className="mt-1 text-xs font-medium text-white/55">{slides.length > 0 ? `Карусель · ${visuals.length}/${slides.length}` : isArticle ? `${visuals.length} ${visuals.length === 1 ? "изображение" : "изображения"}: обложка и иллюстрации` : "Изображение поста"}</p></div>{visuals[0] ? <a href={visuals[0].downloadHref} className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-[10px] font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white">Скачать {isArticle ? "обложку" : visuals.length > 1 ? "первый" : ""}</a> : null}</div>
              {visuals.length > 0 ? (
                <div className="p-3">
                  <div className="relative overflow-hidden rounded-[18px] bg-black/25"><img src={visuals[0].src} alt={isArticle ? "Обложка статьи" : "Основной визуал"} className={`${isArticle ? "aspect-[16/9]" : "aspect-square"} h-full w-full object-cover`} />{visuals.length > 1 ? <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-semibold text-white/75 backdrop-blur">1 / {visuals.length}</span> : null}</div>
                  {visuals.length > 1 ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{visuals.slice(1, 5).map((visual, index) => <a key={visual.id} href={visual.downloadHref} aria-label={`Скачать: ${visual.label}`} className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/20"><img src={visual.src} alt={visual.label} className={`${isArticle ? "aspect-[3/2]" : "aspect-square"} h-full w-full object-cover opacity-75 transition group-hover:opacity-100`} /><span className="absolute inset-x-1.5 bottom-1.5 truncate rounded-md bg-black/65 px-1.5 py-1 text-[8px] text-white/70 backdrop-blur">{visual.label}</span>{index === 3 && visuals.length > 5 ? <span className="absolute inset-0 grid place-items-center bg-black/65 text-xs font-semibold text-white">+{visuals.length - 5}</span> : null}</a>)}</div> : null}
                </div>
              ) : (
                <div className="grid aspect-square place-items-center p-6 text-center"><div><span className="mx-auto block h-2.5 w-2.5 animate-pulse rounded-full bg-violet-400" /><p className="mt-4 text-sm font-semibold text-white/70">Визуал готовится</p><p className="mt-2 text-xs text-white/25">Появится автоматически.</p></div></div>
              )}
            </section>

            {article ? <section className={`${darkCardClass} p-5`}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Пакет статьи</p><p className="mt-2 text-sm font-semibold text-white/75">Всё для публикации</p><p className="mt-1 text-[10px] leading-4 text-white/28">DOCX уже содержит заголовки, полный текст, FAQ, обложку и иллюстрации.</p></div><span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[9px] text-white/30">DOCX</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><a href={`/api/self-service/articles/${article.id}/docx`} className="block rounded-xl bg-violet-500 px-4 py-3 text-center text-xs font-semibold text-white transition hover:bg-violet-400">Скачать пакет</a>{editorUrl ? <a href={editorUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center text-xs font-semibold text-white/65 transition hover:bg-white/[0.07] hover:text-white">Открыть {platformLabel(item.platformName)} ↗</a> : null}</div><ol className="mt-4 space-y-2 text-[10px] leading-4 text-white/28"><li><span className="mr-2 text-violet-300">1.</span>Скачайте пакет или скопируйте текст слева.</li><li><span className="mr-2 text-violet-300">2.</span>Перенесите текст и изображения в редактор площадки.</li><li><span className="mr-2 text-violet-300">3.</span>После публикации добавьте ссылку ниже — результат попадёт в отчёт.</li></ol></section> : null}

            {publication && !isPublished ? <section className={`${darkCardClass} p-5`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-white/65">Дата и время</p><p className="mt-1 text-[9px] text-white/24">Москва · публикация после подтверждения</p></div></div><form action={saveSelfServicePublicationSchedule} className="mt-4 grid grid-cols-[1fr_100px_auto] gap-2"><input type="hidden" name="itemId" value={item.id} /><input type="date" name="scheduledDate" required defaultValue={publication.scheduledDate || item.plannedDate} className="min-w-0 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-[11px] text-white/65 outline-none focus:border-violet-400/35" /><input type="time" name="scheduledTime" required defaultValue={publication.scheduledTime || "11:00"} className="min-w-0 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-[11px] text-white/65 outline-none focus:border-violet-400/35" /><button aria-label="Сохранить дату и время" className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 text-xs font-semibold text-white/55 transition hover:bg-white/[0.07]">✓</button></form>{publication.publishStatus === "failed" && publication.publishErrorMessage ? <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-[10px] leading-4 text-rose-200">Не получилось: {publication.publishErrorMessage}</p> : null}</section> : null}

            <section className={`${darkCardClass} p-5`}>
            {isPublished ? <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-white/78">Опубликовано</p><p className="mt-1 text-[10px] text-white/28">Материал уже вышел на площадке и учтён в отчёте.</p></div>{publication?.externalUrl ? <a href={publication.externalUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-violet-300">Открыть ↗</a> : <span className="text-lg text-violet-300">✓</span>}</div> : isReady ? <div>{!supportsDirectPublish ? <form action={markSelfServiceMaterialPublishedManually} className="space-y-2"><input type="hidden" name="itemId" value={item.id} /><input name="externalUrl" type="url" placeholder="Ссылка на публикацию — необязательно" className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3 text-[11px] text-white/65 outline-none placeholder:text-white/20 focus:border-violet-400/35" /><button className="w-full rounded-xl bg-violet-500 px-5 py-3.5 text-xs font-semibold text-white transition hover:bg-violet-400">Отметить опубликованным</button></form> : canPublish ? <form action={publishSelfServiceMaterialNow}><input type="hidden" name="itemId" value={item.id} /><button className="w-full rounded-xl bg-violet-500 px-5 py-3.5 text-xs font-semibold text-white shadow-[0_14px_35px_rgba(124,92,255,.2)] transition hover:bg-violet-400">Опубликовать сейчас</button></form> : <Link href="/app/channels" className="block w-full rounded-xl border border-violet-400/20 bg-violet-500/10 px-5 py-3.5 text-center text-xs font-semibold text-violet-200">Подключить {targetPlatform === "vk" ? "VK" : targetPlatform === "vcru" ? "VC.ru" : "Telegram"}</Link>}<p className="mt-3 text-center text-[10px] leading-4 text-white/24">{supportsDirectPublish ? "Материал подтверждён. Можно отправить его сейчас." : "Разместите статью вручную и отметьте публикацию — она войдёт в отчёт."}</p></div> : <form action={markSelfServiceMaterialReady}><input type="hidden" name="itemId" value={item.id} /><button disabled={!body || !visualReady} className="w-full rounded-xl bg-violet-500 px-5 py-3.5 text-xs font-semibold text-white shadow-[0_14px_35px_rgba(124,92,255,.2)] transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/25 disabled:shadow-none">Готово к публикации</button><p className="mt-3 text-center text-[10px] leading-4 text-white/24">Подтвердите, когда текст и изображение вас устраивают.</p></form>}
            </section>

            <details className={`${darkCardClass} group p-5`}><summary className="cursor-pointer list-none text-xs font-semibold text-white/48">Зачем этот материал <span className="float-right text-white/20 transition group-open:rotate-45">+</span></summary><p className="mt-3 text-xs leading-5 text-white/30">{item.sequenceReason || item.channelRole || item.goal}</p></details>
          </aside>
        </div>
      </div>
    </SelfServiceAppShell>
  );
}
