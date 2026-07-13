import type { ArticleCallout, ArticleImage } from "@/lib/article-schema";

export type InlineSpan = { text: string; bold: boolean; italic: boolean };

export type ArticleBlock =
  | { type: "h2"; spans: InlineSpan[] }
  | { type: "h3"; spans: InlineSpan[] }
  | { type: "p"; spans: InlineSpan[] }
  | { type: "quote"; spans: InlineSpan[] }
  | { type: "ul"; items: InlineSpan[][] }
  | { type: "ol"; items: InlineSpan[][] };

export type ArticleFlowItem =
  | { kind: "block"; block: ArticleBlock }
  | { kind: "image"; image: ArticleImage }
  | { kind: "callout"; callout: ArticleCallout };

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false });
    }
    if (match[2] !== undefined || match[4] !== undefined) {
      spans.push({ text: match[2] ?? match[4] ?? "", bold: true, italic: false });
    } else {
      spans.push({ text: match[3] ?? match[5] ?? "", bold: false, italic: true });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    spans.push({ text: text.slice(lastIndex), bold: false, italic: false });
  }

  return spans.length > 0 ? spans : [{ text, bold: false, italic: false }];
}

export function parseArticleMarkdown(markdown: string): ArticleBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "p", spans: parseInline(paragraph.join(" ").trim()) });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list) {
      blocks.push({
        type: list.ordered ? "ol" : "ul",
        items: list.items.map((item) => parseInline(item)),
      });
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.*)$/);
    const h2 = trimmed.match(/^##\s+(.*)$/);
    const h1 = trimmed.match(/^#\s+(.*)$/);
    const quote = trimmed.match(/^>\s?(.*)$/);
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);

    if (h3) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h3", spans: parseInline(h3[1]) });
    } else if (h2) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", spans: parseInline(h2[1]) });
    } else if (h1) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", spans: parseInline(h1[1]) });
    } else if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", spans: parseInline(quote[1]) });
    } else if (bullet) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}

/**
 * Merges body blocks with images and callouts:
 * hero image goes on top; inline images and callouts attach to the end
 * of their `sectionIndex`-th `##` section (0-based).
 */
export function composeArticleFlow(
  markdown: string,
  images: ArticleImage[],
  callouts: ArticleCallout[],
): ArticleFlowItem[] {
  const blocks = parseArticleMarkdown(markdown);
  const flow: ArticleFlowItem[] = [];

  const hero = images.find((image) => image.role === "hero");
  if (hero) {
    flow.push({ kind: "image", image: hero });
  }

  const sectionEndInserts = new Map<number, ArticleFlowItem[]>();
  const pushInsert = (sectionIndex: number, item: ArticleFlowItem) => {
    const key = Math.max(0, sectionIndex);
    const bucket = sectionEndInserts.get(key) ?? [];
    bucket.push(item);
    sectionEndInserts.set(key, bucket);
  };

  for (const image of images) {
    if (image.role === "inline") {
      pushInsert(image.sectionIndex, { kind: "image", image });
    }
  }
  for (const callout of callouts) {
    pushInsert(callout.sectionIndex, { kind: "callout", callout });
  }

  let currentSection = -1;

  const flushSectionInserts = (sectionIndex: number) => {
    const bucket = sectionEndInserts.get(sectionIndex);
    if (bucket) {
      flow.push(...bucket);
      sectionEndInserts.delete(sectionIndex);
    }
  };

  for (const block of blocks) {
    if (block.type === "h2") {
      if (currentSection >= 0) {
        flushSectionInserts(currentSection);
      }
      currentSection += 1;
    }
    flow.push({ kind: "block", block });
  }
  if (currentSection >= 0) {
    flushSectionInserts(currentSection);
  }

  // Anything pointing past the last section lands at the end.
  const leftovers = [...sectionEndInserts.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, bucket] of leftovers) {
    flow.push(...bucket);
  }

  return flow;
}
