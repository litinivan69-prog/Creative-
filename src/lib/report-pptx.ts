import PptxGenJS from "pptxgenjs";
import {
  buildMonthlyReport,
  type ReportMetricSnapshot,
  type ReportPublicationInput,
} from "@/lib/report-metrics";

export type ReportDeckKpi = { label: string; value: number | null };

export type ReportDeckPlatform = {
  platformName: string;
  planned: number;
  published: number;
  engagement: number;
  reach: number | null;
};

export type ReportDeckTopMaterial = {
  topic: string;
  platformName: string;
  engagement: number;
  imageDataUrl?: string | null;
};

export type ReportDeckData = {
  clientName: string;
  monthLabel: string;
  planned: number;
  published: number;
  publishRate: number;
  kpis: ReportDeckKpi[];
  platforms: ReportDeckPlatform[];
  top: ReportDeckTopMaterial[];
};

const VIOLET = "7C3AED";
const VIOLET_SOFT = "E9D5FF";
const VIOLET_FAINT = "C4B5FD";
const INK = "0F172A";
const MUTED = "64748B";
const BG = "FAF5FF";
const CARD = "FFFFFF";
const BORDER = "EFE7FC";

function num(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
}

export async function buildReportPptx(data: ReportDeckData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "Creative Command";
  pptx.company = "Adaptive Presence OS";
  pptx.layout = "LAYOUT_WIDE";

  // 1. Cover
  const cover = pptx.addSlide();
  cover.background = { color: VIOLET };
  cover.addText("ОТЧЁТ ЗА МЕСЯЦ", { x: 0.7, y: 2.3, w: 12, h: 0.5, fontSize: 16, color: VIOLET_SOFT, charSpacing: 6 });
  cover.addText(data.clientName || "Клиент", { x: 0.7, y: 2.85, w: 12, h: 1.3, fontSize: 48, bold: true, color: "FFFFFF" });
  cover.addText(data.monthLabel, { x: 0.7, y: 4.2, w: 12, h: 0.7, fontSize: 24, color: VIOLET_SOFT });
  cover.addText("Adaptive Presence OS · Creative Command", { x: 0.7, y: 6.8, w: 12, h: 0.4, fontSize: 12, color: VIOLET_FAINT });

  // 2. KPI
  const kpi = pptx.addSlide();
  kpi.background = { color: BG };
  kpi.addText("Ключевые результаты", { x: 0.7, y: 0.5, w: 12, h: 0.6, fontSize: 28, bold: true, color: INK });
  kpi.addText(`Запланировано ${data.planned} · опубликовано ${data.published} (${data.publishRate}%)`, {
    x: 0.7, y: 1.15, w: 12, h: 0.4, fontSize: 14, color: MUTED,
  });
  data.kpis.slice(0, 8).forEach((item, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.7 + col * 3.05;
    const y = 1.9 + row * 1.9;
    kpi.addText(num(item.value), {
      x, y, w: 2.85, h: 1.0, fontSize: 34, bold: true, color: INK, align: "center", valign: "middle",
      fill: { color: CARD }, line: { color: BORDER, width: 1 }, rectRadius: 0.12,
    });
    kpi.addText(item.label, { x, y: y + 1.0, w: 2.85, h: 0.4, fontSize: 13, color: MUTED, align: "center" });
  });

  // 3. Platforms
  const plat = pptx.addSlide();
  plat.background = { color: BG };
  plat.addText("По площадкам", { x: 0.7, y: 0.5, w: 12, h: 0.6, fontSize: 28, bold: true, color: INK });
  const headerRow = ["Площадка", "Опубликовано", "Вовлечённость", "Охват"].map((t) => ({
    text: t,
    options: { bold: true, color: "FFFFFF", fill: { color: VIOLET }, fontSize: 13 },
  }));
  const bodyRows = (data.platforms.length > 0 ? data.platforms : [{ platformName: "—", planned: 0, published: 0, engagement: 0, reach: null }]).map((p) => [
    { text: p.platformName, options: { color: INK, fontSize: 13 } },
    { text: `${p.published}/${p.planned}`, options: { color: INK, fontSize: 13 } },
    { text: num(p.engagement), options: { color: INK, fontSize: 13 } },
    { text: num(p.reach), options: { color: INK, fontSize: 13 } },
  ]);
  plat.addTable([headerRow, ...bodyRows], {
    x: 0.7, y: 1.4, w: 11.9, colW: [4.5, 2.4, 2.5, 2.5], border: { type: "solid", color: BORDER, pt: 1 },
    fill: { color: CARD }, rowH: 0.5, valign: "middle",
  });

  // 4. Top materials
  const top = pptx.addSlide();
  top.background = { color: BG };
  top.addText("Топ материалов месяца", { x: 0.7, y: 0.5, w: 12, h: 0.6, fontSize: 28, bold: true, color: INK });
  if (data.top.length === 0) {
    top.addText("Метрики появятся после публикаций.", { x: 0.7, y: 1.5, w: 12, h: 0.5, fontSize: 14, color: MUTED });
  } else {
    data.top.slice(0, 5).forEach((item, i) => {
      const y = 1.4 + i * 1.15;
      top.addText("", { x: 0.7, y, w: 11.9, h: 1.0, fill: { color: CARD }, line: { color: BORDER, width: 1 }, rectRadius: 0.1 });
      if (item.imageDataUrl) {
        try {
          top.addImage({ data: item.imageDataUrl, x: 0.85, y: y + 0.12, w: 0.76, h: 0.76, rounding: true });
        } catch {
          // best-effort image embedding
        }
      }
      top.addText(item.topic, { x: 1.8, y: y + 0.14, w: 8.5, h: 0.5, fontSize: 16, bold: true, color: INK, valign: "middle" });
      top.addText(`${item.platformName} · вовлечённость ${num(item.engagement)}`, {
        x: 1.8, y: y + 0.55, w: 8.5, h: 0.4, fontSize: 12, color: MUTED,
      });
    });
  }

  // 5. Closing
  const closing = pptx.addSlide();
  closing.background = { color: VIOLET };
  closing.addText("Каких результатов добились", { x: 0.7, y: 2.3, w: 12, h: 0.9, fontSize: 32, bold: true, color: "FFFFFF" });
  const reachKpi = data.kpis.find((k) => k.label === "Охват")?.value ?? null;
  const summary = [
    `Опубликовано ${data.published} из ${data.planned} материалов (${data.publishRate}%).`,
    reachKpi != null ? `Совокупный охват — ${num(reachKpi)}.` : "Метрики охвата собираются.",
    data.top[0] ? `Лучший материал месяца: «${data.top[0].topic}».` : "Топ-материалы появятся с первыми метриками.",
  ].join("\n");
  closing.addText(summary, { x: 0.7, y: 3.4, w: 11.9, h: 2.4, fontSize: 18, color: VIOLET_SOFT, lineSpacingMultiple: 1.4 });

  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}

export type DeckPublicationInput = ReportPublicationInput & { imageSrc?: string | null };

export async function assembleReportDeck(input: {
  clientName: string;
  monthLabel: string;
  publications: DeckPublicationInput[];
}): Promise<ReportDeckData> {
  const report = buildMonthlyReport(input.publications);
  const imageByPublicationId = new Map(input.publications.map((pub) => [pub.id, pub.imageSrc ?? null]));

  const kpiOrder: Array<[string, keyof ReportMetricSnapshot]> = [
    ["Охват", "reach"],
    ["Лайки", "likes"],
    ["Комментарии", "comments"],
    ["Репосты", "shares"],
    ["Просмотры", "views"],
    ["Сохранения", "saves"],
    ["Переходы", "clicks"],
  ];

  const top = await Promise.all(
    report.top.map(async (entry) => ({
      topic: entry.topic,
      platformName: entry.platformName,
      engagement: entry.engagement,
      imageDataUrl: await toImageDataUrl(imageByPublicationId.get(entry.id)),
    })),
  );

  return {
    clientName: input.clientName,
    monthLabel: input.monthLabel,
    planned: report.planned,
    published: report.published,
    publishRate: report.publishRate,
    kpis: kpiOrder.map(([label, key]) => ({ label, value: report.kpis[key] })),
    platforms: report.byPlatform,
    top,
  };
}

export async function toImageDataUrl(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  if (!/^https?:\/\//.test(src)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(src, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > 4_000_000) return null;

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
