import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { composeArticleFlow, type ArticleBlock, type InlineSpan } from "@/lib/article-markdown";
import type { ArticleCallout, ArticleFaqItem, ArticleImage, ArticleSource } from "@/lib/article-schema";
import { prisma } from "@/lib/prisma";
import { fetchAndPrepareImage } from "@/lib/social-images";

const INK = "0F172A";
const MUTED = "64748B";
const VIOLET = "7C3AED";
const CALLOUT_BG = "F7F3FD";
const BORDER = "EFE7FC";

export type ArticleDocxInput = {
  title: string;
  clientName: string;
  metaTitle: string | null;
  metaDescription: string | null;
  bodyMarkdown: string;
  faq: ArticleFaqItem[];
  sources: ArticleSource[];
  images: ArticleImage[];
  callouts: ArticleCallout[];
};

export async function loadArticleDocxInput(articleId: string): Promise<(ArticleDocxInput & { clientId: string }) | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { client: { select: { name: true } } },
  });
  if (!article) return null;

  return {
    clientId: article.clientId,
    title: article.title,
    clientName: article.client.name,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    bodyMarkdown: article.bodyMarkdown,
    faq: (article.faq as ArticleFaqItem[]) ?? [],
    sources: (article.sources as ArticleSource[]) ?? [],
    images: (article.images as ArticleImage[]) ?? [],
    callouts: (article.calloutNotes as ArticleCallout[]) ?? [],
  };
}

function runsFromSpans(spans: InlineSpan[], overrides: { size?: number; color?: string; bold?: boolean } = {}) {
  return spans.map(
    (span) =>
      new TextRun({
        text: span.text,
        bold: overrides.bold ?? span.bold,
        italics: span.italic,
        size: overrides.size,
        color: overrides.color,
      }),
  );
}

function paragraphsFromBlock(block: ArticleBlock): Paragraph[] {
  switch (block.type) {
    case "h2":
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 160 },
          children: runsFromSpans(block.spans, { color: INK, bold: true }),
        }),
      ];
    case "h3":
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 260, after: 120 },
          children: runsFromSpans(block.spans, { color: INK, bold: true }),
        }),
      ];
    case "quote":
      return [
        new Paragraph({
          spacing: { before: 160, after: 160 },
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: VIOLET } },
          children: runsFromSpans(block.spans, { color: MUTED }),
        }),
      ];
    case "ul":
      return block.items.map(
        (item) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: runsFromSpans(item),
          }),
      );
    case "ol":
      return block.items.map(
        (item, index) =>
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: `${index + 1}. `, bold: true }), ...runsFromSpans(item)],
          }),
      );
    case "p":
    default:
      return [
        new Paragraph({
          spacing: { after: 160, line: 300 },
          children: runsFromSpans(block.spans),
        }),
      ];
  }
}

function calloutTable(callout: ArticleCallout) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      left: { style: BorderStyle.SINGLE, size: 12, color: VIOLET },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: CALLOUT_BG },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: callout.title, bold: true, color: VIOLET })],
              }),
              new Paragraph({ children: [new TextRun({ text: callout.text, color: INK })] }),
            ],
          }),
        ],
      }),
    ],
  });
}

async function imageParagraphs(image: ArticleImage): Promise<Array<Paragraph | Table>> {
  const result: Array<Paragraph | Table> = [];

  if (image.url) {
    const buffer = await fetchAndPrepareImage(image.url);
    if (buffer) {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(buffer).metadata();
      const sourceWidth = meta.width ?? 1200;
      const sourceHeight = meta.height ?? 800;
      const width = 600;
      const height = Math.round((sourceHeight / sourceWidth) * width);

      result.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 80 },
          children: [
            new ImageRun({
              type: "jpg",
              data: buffer,
              transformation: { width, height },
            }),
          ],
        }),
      );
    }
  }

  if (image.caption) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: image.caption, italics: true, size: 20, color: MUTED })],
      }),
    );
  }

  return result;
}

export async function buildArticleDocx(input: ArticleDocxInput): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: input.clientName, bold: true, size: 20, color: VIOLET })],
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
      children: [new TextRun({ text: input.title, bold: true, color: INK })],
    }),
  );

  const flow = composeArticleFlow(input.bodyMarkdown, input.images, input.callouts);

  for (const item of flow) {
    if (item.kind === "block") {
      children.push(...paragraphsFromBlock(item.block));
    } else if (item.kind === "callout") {
      children.push(calloutTable(item.callout), new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else {
      children.push(...(await imageParagraphs(item.image)));
    }
  }

  if (input.faq.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 160 },
        children: [new TextRun({ text: "Частые вопросы", bold: true, color: INK })],
      }),
    );
    for (const item of input.faq) {
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [new TextRun({ text: item.question, bold: true, color: INK })],
        }),
        new Paragraph({
          spacing: { after: 120, line: 300 },
          children: [new TextRun({ text: item.answer })],
        }),
      );
    }
  }

  const sources = input.sources.filter((source) => source.title || source.url);
  if (sources.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 160 },
        children: [new TextRun({ text: "Источники", bold: true, color: INK })],
      }),
    );
    for (const source of sources) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: [
            new TextRun({ text: source.title || source.url }),
            ...(source.url && source.title ? [new TextRun({ text: ` — ${source.url}`, color: MUTED })] : []),
          ],
        }),
      );
    }
  }

  if (input.metaTitle || input.metaDescription) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 160 },
        children: [new TextRun({ text: "SEO-мета", bold: true, color: INK })],
      }),
    );
    if (input.metaTitle) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: "Title: ", bold: true }), new TextRun({ text: input.metaTitle })],
        }),
      );
    }
    if (input.metaDescription) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: "Description: ", bold: true }), new TextRun({ text: input.metaDescription })],
        }),
      );
    }
  }

  const doc = new Document({
    creator: "Creative Command · Adaptive Presence OS",
    title: input.title,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: INK },
        },
      },
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
