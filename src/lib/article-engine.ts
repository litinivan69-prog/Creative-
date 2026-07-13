import { Prisma } from "@prisma/client";
import {
  ARTICLE_BRIEF_JSON_SPEC,
  ARTICLE_GEO_JSON_SPEC,
  ArticleBriefSchema,
  ArticleGeoPassSchema,
  countWords,
  type ArticleBrief,
  type ArticleGeoPass,
  type ArticleImage,
} from "@/lib/article-schema";
import { getClientBrandContext } from "@/lib/brand-context";
import { generateCreativeVisualVariant } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { storeGeneratedVisual } from "@/lib/visual-storage";
import { resolveWriter, writerJson, writerText, WriterUnavailableError, type ResolvedWriter } from "@/lib/writer";

export const ARTICLE_STAGES = ["brief", "draft", "humanize", "geo", "images", "done"] as const;
export type ArticleStage = (typeof ARTICLE_STAGES)[number];

export const ARTICLE_STAGE_LABELS: Record<ArticleStage, string> = {
  brief: "Бриф и структура",
  draft: "Черновик",
  humanize: "Очеловечивание",
  geo: "GEO-проход",
  images: "Иллюстрации",
  done: "Готово",
};

const AI_CLICHE_LIST =
  "«более того», «в заключение», «в современном мире», «стоит отметить», «важно понимать», «не секрет, что», «давайте разберёмся», «подводя итог», «ключевым аспектом является»";

type ArticleContext = {
  clientName: string;
  clientIndustry: string;
  brandContext: string;
  geoFocus: string;
  platformTarget: string;
  topic: string;
  angle: string;
};

function brandVoiceBlock(context: ArticleContext) {
  return [
    `Клиент (бренд): ${context.clientName}`,
    `Отрасль: ${context.clientIndustry || "не указана"}`,
    `Гео-фокус (город/регион): ${context.geoFocus || "определи из контекста бренда; если нет — Россия"}`,
    `Целевая площадка: ${context.platformTarget || "универсальная (сайт/блог)"}`,
    "Контекст бренда клиента:",
    context.brandContext || "Не предоставлен",
  ].join("\n");
}

const GEO_BRAND_RULE = [
  "МАРКЕТИНГОВОЕ ПРАВИЛО (GEO): по всему тексту нативно и уместно упоминай название компании бренда и гео-контекст (город/регион).",
  "Связывай бренд с темой как эксперта — так, чтобы нейросети и поисковые системы ассоциировали бренд с этими запросами.",
  "Упоминания органичные: опыт компании, примеры из практики, локальные детали. Без рекламных штампов, без спама, без «лучшая компания города».",
  "3-6 упоминаний бренда на статью, распределённых по разделам, включая первый экран.",
].join(" ");

async function runBriefStage(writer: ResolvedWriter, context: ArticleContext): Promise<ArticleBrief> {
  return writerJson({
    writer,
    schema: ArticleBriefSchema,
    schemaName: "article_brief",
    jsonSpec: ARTICLE_BRIEF_JSON_SPEC,
    system: [
      "Ты — редактор-стратег и GEO-специалист (generative engine optimization) в контент-агентстве, работаешь на русскоязычный рынок.",
      "Составь бриф и структуру экспертной статьи: тема, угол, целевые запросы (включая локальные с городом/регионом), ключевые сущности, факты, источники, план заголовков и план иллюстраций.",
      "Заголовки разделов формулируй как реальные вопросы, которые люди задают поисковикам и нейросетям.",
      "Не выдумывай конкретные цифры, цены, имена врачей/сотрудников, лицензии и кейсы — используй только то, что есть в контексте бренда, либо общеизвестные факты.",
      GEO_BRAND_RULE,
    ].join("\n"),
    prompt: [
      `Тема статьи: ${context.topic}`,
      context.angle ? `Желаемый угол: ${context.angle}` : null,
      brandVoiceBlock(context),
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
}

async function runDraftStage(writer: ResolvedWriter, context: ArticleContext, brief: ArticleBrief): Promise<string> {
  return writerText({
    writer,
    system: [
      "Ты — экспертный автор длинных статей на русском языке.",
      "Напиши полную структурированную статью в Markdown объёмом 1200–2500 слов строго по брифу.",
      "Формат: заголовок первого уровня не нужен, начинай с вводного абзаца, затем разделы ## по плану из брифа.",
      "Раскрывай каждый раздел конкретикой: механики, шаги, примеры, ориентиры. Никакой воды.",
      "Не выдумывай факты, цифры, цены и кейсы, которых нет в брифе или контексте бренда.",
      GEO_BRAND_RULE,
      "Верни только Markdown статьи, без пояснений.",
    ].join("\n"),
    prompt: [
      `Тема: ${context.topic}`,
      "Бриф (JSON):",
      JSON.stringify(brief, null, 2),
      brandVoiceBlock(context),
    ].join("\n\n"),
  });
}

async function runHumanizeStage(writer: ResolvedWriter, context: ArticleContext, draft: string): Promise<string> {
  return writerText({
    writer,
    system: [
      "Ты — редактор с живым авторским голосом. Перепиши статью под tone-of-voice бренда, сохранив структуру разделов ## и все факты.",
      `Убери ИИ-штампы и канцелярит: ${AI_CLICHE_LIST}. Убери воду и симметричные абзацы-близнецы.`,
      "Меняй длину предложений: короткие рядом с длинными. Добавляй конкретику и точные формулировки. Пиши как опытный практик, а не как нейросеть.",
      "Не сокращай статью существенно: объём остаётся 1200–2500 слов.",
      "Сохрани нативные упоминания бренда и гео — они обязаны остаться органичной частью текста.",
      "Верни только Markdown статьи, без пояснений.",
    ].join("\n"),
    prompt: [brandVoiceBlock(context), "Статья для переработки:", draft].join("\n\n"),
  });
}

async function runGeoStage(
  writer: ResolvedWriter,
  context: ArticleContext,
  brief: ArticleBrief,
  humanized: string,
): Promise<ArticleGeoPass> {
  return writerJson({
    writer,
    schema: ArticleGeoPassSchema,
    schemaName: "article_geo_pass",
    jsonSpec: ARTICLE_GEO_JSON_SPEC,
    maxTokens: 32000,
    system: [
      "Ты — GEO-специалист (generative engine optimization). Доведи статью до формата, который нейросети охотно цитируют.",
      "Требования к bodyMarkdown:",
      "1) Answer-first: первые 2-4 предложения дают прямой полный ответ на главный запрос.",
      "2) Заголовки ## сформулированы как реальные вопросы пользователей (сохрани структуру, улучши формулировки).",
      "3) Текст остаётся человеческим — не возвращай ИИ-штампы, не ломай авторский голос, не сокращай статью.",
      "4) Нативные упоминания бренда и гео сохраняются и при необходимости усиливаются (без спама).",
      "Дополнительно верни FAQ (4-6 пар), meta title/description, источники (E-E-A-T) и врезки-примечания с привязкой к разделам.",
      "Не выдумывай факты и URL источников: если точного URL нет — верни пустую строку.",
    ].join("\n"),
    prompt: [
      `Целевые запросы: ${brief.targetQueries.join("; ")}`,
      `Ключевые сущности: ${brief.keyEntities.join("; ")}`,
      brandVoiceBlock(context),
      "Статья:",
      humanized,
    ].join("\n\n"),
  });
}

function buildJsonLd(input: {
  title: string;
  metaDescription: string;
  clientName: string;
  faq: Array<{ question: string; answer: string }>;
  heroUrl: string | null;
}) {
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.metaDescription,
    author: { "@type": "Organization", name: input.clientName },
    publisher: { "@type": "Organization", name: input.clientName },
    ...(input.heroUrl ? { image: [input.heroUrl] } : {}),
  };

  const faqPage =
    input.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: input.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;

  return faqPage ? [article, faqPage] : [article];
}

async function generateArticleImages(input: {
  articleId: string;
  clientId: string;
  monthlyPlanId: string | null;
  context: ArticleContext;
  brief: ArticleBrief;
  title: string;
}): Promise<ArticleImage[]> {
  const plan = input.brief.imagePlan.slice(0, 5);
  const images: ArticleImage[] = [];

  for (const item of plan) {
    const base: ArticleImage = {
      role: item.role,
      sectionIndex: Math.max(0, item.sectionIndex),
      url: null,
      caption: item.caption,
      prompt: item.prompt,
    };

    try {
      const generated = await generateCreativeVisualVariant({
        clientName: input.context.clientName,
        clientIndustry: input.context.clientIndustry || null,
        creativeAsset: {
          assetType: item.role === "hero" ? "article_hero" : "article_inline",
          title: input.title,
          brief: item.prompt,
          formatRequirements: "Wide editorial illustration for a long-form article, 3:2 landscape.",
          textOnAsset: "",
          references: null,
          notes: "Editorial article illustration. Calm, premium, realistic. No text inside the image.",
        },
        scheduledPublication: {
          platformName: input.context.platformTarget || "site_blog",
          format: "article",
          topic: input.context.topic,
          scheduledDate: new Date().toISOString().slice(0, 10),
          scheduledTime: null,
        },
        contentDraft: {
          draftTitle: input.title,
          draftBody: item.caption,
          riskLevel: "low",
          approvalRequired: false,
        },
        brandContext: input.context.brandContext || undefined,
      });

      const stored = await storeGeneratedVisual({
        imageBase64: generated.imageBase64,
        mimeType: generated.mimeType,
        clientId: input.clientId,
        monthlyPlanId: input.monthlyPlanId ?? "articles",
        creativeAssetId: input.articleId,
      });

      if (stored.storageProvider === "vercel_blob") {
        images.push({ ...base, url: stored.imageUrl });
      } else {
        // No blob storage configured: keep the placeholder + prompt instead of heavy base64 in the Article row.
        images.push(base);
      }
    } catch (error) {
      console.error("Article image generation failed", error);
      images.push(base);
    }
  }

  return images;
}

function friendlyPipelineError(error: unknown) {
  if (error instanceof WriterUnavailableError) return error.message;
  return "Генерация статьи прервалась. Нажмите «Продолжить» — движок продолжит с последнего успешного прохода.";
}

export async function runArticlePipeline(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { client: { select: { name: true, industry: true } } },
  });

  if (!article) {
    return { ok: false as const, error: "Статья не найдена." };
  }

  const brandContext = await getClientBrandContext(article.clientId);
  const context: ArticleContext = {
    clientName: article.client.name,
    clientIndustry: article.client.industry ?? "",
    brandContext,
    geoFocus: article.geoFocus ?? "",
    platformTarget: article.platformTarget ?? "",
    topic: article.title,
    angle: article.angle ?? "",
  };

  let writer: ResolvedWriter;
  try {
    writer = resolveWriter(article.provider || null);
  } catch (error) {
    const message = friendlyPipelineError(error);
    await prisma.article.update({
      where: { id: articleId },
      data: { status: "failed", errorMessage: message },
    });
    return { ok: false as const, error: message };
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { status: "generating", errorMessage: null, provider: writer.provider, model: writer.model },
  });

  let stage = (ARTICLE_STAGES as readonly string[]).includes(article.stage)
    ? (article.stage as ArticleStage)
    : "brief";
  let brief = (article.briefJson as ArticleBrief | null) ?? null;
  let body = article.bodyMarkdown;

  try {
    if (stage === "brief") {
      brief = await runBriefStage(writer, context);
      context.angle = context.angle || brief.angle;
      stage = "draft";
      await prisma.article.update({
        where: { id: articleId },
        data: {
          stage,
          angle: article.angle || brief.angle,
          targetQueries: brief.targetQueries as Prisma.InputJsonValue,
          briefJson: brief as unknown as Prisma.InputJsonValue,
          sources: brief.sources as Prisma.InputJsonValue,
        },
      });
    }

    if (!brief) {
      throw new Error("Article brief is missing for a non-brief stage.");
    }

    if (stage === "draft") {
      body = await runDraftStage(writer, context, brief);
      stage = "humanize";
      await prisma.article.update({
        where: { id: articleId },
        data: { stage, bodyMarkdown: body, wordCount: countWords(body) },
      });
    }

    if (stage === "humanize") {
      body = await runHumanizeStage(writer, context, body);
      stage = "geo";
      await prisma.article.update({
        where: { id: articleId },
        data: { stage, bodyMarkdown: body, wordCount: countWords(body) },
      });
    }

    if (stage === "geo") {
      const geo = await runGeoStage(writer, context, brief, body);
      body = geo.bodyMarkdown;
      stage = "images";
      await prisma.article.update({
        where: { id: articleId },
        data: {
          stage,
          title: geo.title,
          bodyMarkdown: geo.bodyMarkdown,
          wordCount: countWords(geo.bodyMarkdown),
          faq: geo.faq as Prisma.InputJsonValue,
          metaTitle: geo.metaTitle,
          metaDescription: geo.metaDescription,
          sources: geo.sources as Prisma.InputJsonValue,
          calloutNotes: geo.calloutNotes as Prisma.InputJsonValue,
        },
      });
    }

    if (stage === "images") {
      const fresh = await prisma.article.findUniqueOrThrow({
        where: { id: articleId },
        select: { title: true, metaDescription: true, faq: true, monthlyPlanId: true },
      });
      const images = await generateArticleImages({
        articleId,
        clientId: article.clientId,
        monthlyPlanId: fresh.monthlyPlanId,
        context,
        brief,
        title: fresh.title,
      });
      const heroUrl = images.find((image) => image.role === "hero")?.url ?? null;
      const jsonLd = buildJsonLd({
        title: fresh.title,
        metaDescription: fresh.metaDescription ?? "",
        clientName: context.clientName,
        faq: (fresh.faq as Array<{ question: string; answer: string }>) ?? [],
        heroUrl,
      });

      await prisma.article.update({
        where: { id: articleId },
        data: {
          stage: "done",
          status: "draft",
          errorMessage: null,
          images: images as unknown as Prisma.InputJsonValue,
          schemaJsonLd: jsonLd as Prisma.InputJsonValue,
        },
      });
    }

    return { ok: true as const };
  } catch (error) {
    console.error("Article pipeline failed", error);
    const message = friendlyPipelineError(error);
    await prisma.article.update({
      where: { id: articleId },
      data: { status: "failed", errorMessage: message },
    });
    return { ok: false as const, error: message };
  }
}
