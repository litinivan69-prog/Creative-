import { z } from "zod";

export const ArticleBriefSchema = z.object({
  workingTitle: z.string().describe("Рабочий заголовок статьи на русском"),
  angle: z.string().describe("Угол подачи: чем эта статья отличается и почему её будут цитировать"),
  targetQueries: z
    .array(z.string())
    .describe("Целевые поисковые запросы, включая локальные/гео-варианты с городом или регионом"),
  keyEntities: z.array(z.string()).describe("Ключевые сущности и термины, которые обязаны появиться в тексте"),
  facts: z.array(z.string()).describe("Проверяемые факты и тезисы для статьи; без выдуманных цифр"),
  sources: z
    .array(z.object({ title: z.string(), url: z.string().describe("URL источника или пустая строка") }))
    .describe("Рекомендуемые источники для E-E-A-T"),
  outline: z
    .array(
      z.object({
        heading: z.string().describe("Заголовок раздела в формате живого вопроса или утверждения"),
        summary: z.string().describe("О чём раздел, 1-2 предложения"),
      }),
    )
    .describe("План разделов статьи (H2), 5-8 разделов"),
  imagePlan: z
    .array(
      z.object({
        role: z.enum(["hero", "inline"]),
        sectionIndex: z
          .number()
          .int()
          .describe("Индекс раздела из outline, после которого стоит картинка; для hero всегда 0"),
        prompt: z.string().describe("Краткое описание сюжета иллюстрации для генерации, на английском"),
        caption: z.string().describe("Подпись под иллюстрацией на русском"),
      }),
    )
    .describe("Hero-изображение + 2-4 инлайн-иллюстрации, привязанные к разделам"),
});

export type ArticleBrief = z.infer<typeof ArticleBriefSchema>;

export const ARTICLE_BRIEF_JSON_SPEC = `{
  "workingTitle": "string — рабочий заголовок на русском",
  "angle": "string — угол подачи",
  "targetQueries": ["string — целевые запросы, включая локальные/гео"],
  "keyEntities": ["string"],
  "facts": ["string — проверяемые тезисы, без выдуманных цифр"],
  "sources": [{ "title": "string", "url": "string или пустая строка" }],
  "outline": [{ "heading": "string — H2 как живой вопрос", "summary": "string" }],
  "imagePlan": [{ "role": "hero" | "inline", "sectionIndex": number, "prompt": "string на английском", "caption": "string на русском" }]
}`;

export const ArticleGeoPassSchema = z.object({
  title: z.string().describe("Финальный заголовок статьи"),
  bodyMarkdown: z
    .string()
    .describe("Полный финальный текст статьи в Markdown: прямой ответ сверху, разделы ## под реальные вопросы"),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .describe("FAQ-блок: 4-6 коротких вопросов и ответов"),
  metaTitle: z.string().describe("Meta title до 60 символов"),
  metaDescription: z.string().describe("Meta description до 160 символов"),
  sources: z
    .array(z.object({ title: z.string(), url: z.string().describe("URL источника или пустая строка") }))
    .describe("Итоговый список источников"),
  calloutNotes: z
    .array(
      z.object({
        title: z.string().describe("Короткий заголовок врезки"),
        text: z.string().describe("Текст врезки-примечания, 1-3 предложения"),
        sectionIndex: z.number().int().describe("После какого по счёту раздела (##) показывать врезку, с нуля"),
      }),
    )
    .describe("2-4 врезки-примечания: практические советы, цифры, локальные детали"),
});

export type ArticleGeoPass = z.infer<typeof ArticleGeoPassSchema>;

export const ARTICLE_GEO_JSON_SPEC = `{
  "title": "string — финальный заголовок",
  "bodyMarkdown": "string — полный текст статьи в Markdown, answer-first, разделы ##",
  "faq": [{ "question": "string", "answer": "string" }],
  "metaTitle": "string до 60 символов",
  "metaDescription": "string до 160 символов",
  "sources": [{ "title": "string", "url": "string или пустая строка" }],
  "calloutNotes": [{ "title": "string", "text": "string", "sectionIndex": number }]
}`;

export type ArticleImage = {
  role: "hero" | "inline";
  sectionIndex: number;
  url: string | null;
  caption: string;
  prompt: string;
};

export type ArticleFaqItem = { question: string; answer: string };
export type ArticleSource = { title: string; url: string };
export type ArticleCallout = { title: string; text: string; sectionIndex: number };

export function countWords(markdown: string) {
  return markdown
    .replace(/[#>*_`\-|]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
