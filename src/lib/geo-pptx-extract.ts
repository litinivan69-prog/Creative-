import JSZip from "jszip";

export type GeoAuditExtraction = {
  clientName: string | null;
  periodLabel: string | null;
  auditDateISO: string | null;
  presenceIndex: number | null;
  sovScore: number | null;
  sovMax: number | null;
  positionScore: number | null;
  positionMax: number | null;
  toneScore: number | null;
  toneMax: number | null;
  accuracyScore: number | null;
  accuracyMax: number | null;
  sovPercent: number | null;
  mentionPercent: number | null;
  queriesTotal: number | null;
  queriesCategorical: number | null;
  queriesBrand: number | null;
  engines: Array<{ engine: string; mentions: number; spontaneous: number }>;
  competitors: Array<{ name: string; mentions: number; sharePercent: number | null }>;
  sources: string[];
  growthPoints: Array<{ area: string; citations: number | null }>;
  /** True when at least the headline presence index was recognised. */
  matched: boolean;
};

const RU_MONTHS: Record<string, number> = {
  январ: 1, феврал: 2, март: 3, апрел: 4, ма: 5, июн: 6,
  июл: 7, август: 8, сентябр: 9, октябр: 10, ноябр: 11, декабр: 12,
};

function parseRussianDate(text: string): string | null {
  const match = text.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!match) return null;
  const day = Number(match[1]);
  const monthWord = match[2].toLowerCase();
  const year = Number(match[3]);
  const monthEntry = Object.entries(RU_MONTHS).find(([stem]) => monthWord.startsWith(stem));
  if (!monthEntry) return null;
  const date = new Date(Date.UTC(year, monthEntry[1] - 1, day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Extracts ordered plain-text runs (<a:t>) from every slide, in slide order. */
async function readSlideTexts(buffer: Buffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => {
      const leftNum = Number(left.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const rightNum = Number(right.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return leftNum - rightNum;
    });

  const slides: string[][] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const runs = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map((match) =>
      match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, " ")
        .trim(),
    );
    slides.push(runs);
  }
  return slides;
}

function toInt(value: string | undefined | null): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toFloat(value: string | undefined | null): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

const KNOWN_ENGINES: Array<{ key: string; label: RegExp }> = [
  { key: "perplexity", label: /perplexity/i },
  { key: "yandexgpt", label: /yandex\s?gpt|яндекс\s?gpt|yandexgpt/i },
  { key: "gigachat", label: /gigachat|гигачат/i },
  { key: "chatgpt", label: /chatgpt|gpt-?4|openai/i },
  { key: "alice", label: /алиса|alice/i },
];

/**
 * Best-effort extraction of the headline GEO numbers from a Creative Command
 * GEO-audit PPTX, laid out like the reference report. Never throws: on any
 * problem returns matched:false and the caller falls back to a manual form.
 */
export async function extractGeoAudit(buffer: Buffer): Promise<GeoAuditExtraction> {
  const empty: GeoAuditExtraction = {
    clientName: null, periodLabel: null, auditDateISO: null,
    presenceIndex: null, sovScore: null, sovMax: null, positionScore: null, positionMax: null,
    toneScore: null, toneMax: null, accuracyScore: null, accuracyMax: null,
    sovPercent: null, mentionPercent: null, queriesTotal: null, queriesCategorical: null,
    queriesBrand: null, engines: [], competitors: [], sources: [], growthPoints: [], matched: false,
  };

  let slides: string[][];
  try {
    slides = await readSlideTexts(buffer);
  } catch {
    return empty;
  }

  const flat = slides.flat();
  const joined = flat.join(" \n ");
  const result: GeoAuditExtraction = { ...empty };

  // Date (title / footer slides).
  result.auditDateISO = parseRussianDate(joined);
  const dateMatch = joined.match(/(\d{1,2}\s+[а-яё]+\s+\d{4})/i);
  result.periodLabel = dateMatch?.[1] ?? null;

  // Client name: title slide, first ALL-CAPS-ish run after the brand wordmark.
  const titleSlide = slides[0] ?? [];
  const brandIdx = titleSlide.findIndex((run) => /command\./i.test(run));
  for (const run of titleSlide.slice(brandIdx + 1)) {
    if (/^[A-ZА-ЯЁ0-9][\wА-ЯЁ .&'-]{1,40}$/.test(run) && !/GEO|АУДИТ|АНАЛИЗ|ПРИСУТСТВ/i.test(run)) {
      result.clientName = run.trim();
      break;
    }
  }

  // Presence index: "69 | из 100" and formula components "18/40" etc.
  const idxMatch = joined.match(/(\d{1,3})\s*\n?\s*из\s*100/i);
  result.presenceIndex = toInt(idxMatch?.[1]);

  const componentPatterns: Array<[keyof GeoAuditExtraction, keyof GeoAuditExtraction, RegExp]> = [
    ["sovScore", "sovMax", /share of voice[^\d]{0,40}?(\d{1,3})\s*\/\s*(\d{1,3})/i],
    ["positionScore", "positionMax", /позици[а-яё]*\s*в\s*ответе[^\d]{0,40}?(\d{1,3})\s*\/\s*(\d{1,3})/i],
    ["toneScore", "toneMax", /тональност[а-яё]*[^\d]{0,40}?(\d{1,3})\s*\/\s*(\d{1,3})/i],
    ["accuracyScore", "accuracyMax", /точност[а-яё]*\s*фактов[^\d]{0,40}?(\d{1,3})\s*\/\s*(\d{1,3})/i],
  ];
  for (const [scoreKey, maxKey, pattern] of componentPatterns) {
    const match = joined.match(pattern);
    if (match) {
      (result[scoreKey] as number | null) = toInt(match[1]);
      (result[maxKey] as number | null) = toInt(match[2]);
    }
  }

  // SoV % (e.g. "44.4% | Share of Voice").
  const sovPctMatch = joined.match(/(\d{1,3}[.,]?\d?)\s*%\s*\n?\s*Share of Voice/i);
  result.sovPercent = toFloat(sovPctMatch?.[1]);

  // Mention % (e.g. "60% | с упоминанием бренда").
  const mentionMatch = joined.match(/(\d{1,3})\s*%\s*\n?\s*с упоминанием/i);
  result.mentionPercent = toFloat(mentionMatch?.[1]);

  // Query counts (slide "О чём этот отчёт").
  result.queriesTotal = toInt(joined.match(/(\d{1,3})\s*\n?\s*запрос[а-яё]*\s*(?:проверено|провер)/i)?.[1]);
  result.queriesCategorical = toInt(joined.match(/(\d{1,3})\s*\n?\s*категорийн/i)?.[1]);
  result.queriesBrand = toInt(joined.match(/(\d{1,3})\s*\n?\s*брендов/i)?.[1]);

  // Engines breakdown slide: "Perplexity | 15 | 8 спонтанных | YandexGPT | 7 | 0 спонтанных | ...".
  // Scope to the dedicated slide so the methodology mention on other slides is ignored.
  const engineSlide =
    slides.find((slide) => slide.some((run) => /ПО НЕЙРОСЕТ|Где вас видно/i.test(run))) ??
    slides.find((slide) => slide.some((run) => /спонтанн/i.test(run)));
  if (engineSlide) {
    for (const engine of KNOWN_ENGINES) {
      const idx = engineSlide.findIndex((run) => engine.label.test(run));
      if (idx === -1) continue;
      // The engine name is immediately followed by its mentions count, then a
      // "N спонтанных" run (or "не упоминает" → 0).
      const mentions = toInt(engineSlide[idx + 1]);
      let spontaneous = 0;
      for (let j = idx + 1; j < Math.min(idx + 4, engineSlide.length); j += 1) {
        const spont = engineSlide[j].match(/(\d{1,3})\s*спонтанн/i);
        if (spont) { spontaneous = toInt(spont[1]) ?? 0; break; }
        if (/не упомина/i.test(engineSlide[j])) { spontaneous = 0; break; }
      }
      if (mentions != null && !result.engines.some((entry) => entry.engine === engine.key)) {
        result.engines.push({ engine: engine.key, mentions, spontaneous });
      }
    }
  }

  // Competitors: "<name> | <n>" pairs on the competitors slide, plus share %.
  const competitorSlide = slides.find((slide) => slide.some((run) => /КОНКУРЕНТ/i.test(run)));
  if (competitorSlide) {
    for (let i = 0; i < competitorSlide.length - 1; i += 1) {
      const name = competitorSlide[i];
      const next = competitorSlide[i + 1];
      const mentions = toInt(next);
      if (
        mentions != null &&
        /[A-Za-zА-Яа-яЁё]/.test(name) &&
        name.length <= 40 &&
        !/КОНКУРЕНТ|ваш бренд|рекоменд|органическ/i.test(name)
      ) {
        result.competitors.push({ name: name.replace(/\s*[—-]\s*ваш бренд/i, "").trim(), mentions, sharePercent: null });
      }
    }
    // Share % from the analysis slide "N упоминания · M% ответов".
    const analysisSlide = slides.find((slide) => slide.some((run) => /Почему конкуренты/i.test(run)));
    if (analysisSlide) {
      const analysisText = analysisSlide.join(" \n ");
      for (const competitor of result.competitors) {
        const escaped = competitor.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const share = analysisText.match(new RegExp(`${escaped}[\\s\\S]{0,60}?(\\d{1,3})\\s*%`, "i"));
        if (share) competitor.sharePercent = toFloat(share[1]);
      }
    }
  }

  // Sources: domains on the "ИСТОЧНИКИ" slide.
  const sourceSlide = slides.find((slide) => slide.some((run) => /ИСТОЧНИК/i.test(run)));
  if (sourceSlide) {
    const domains = new Set<string>();
    for (const run of sourceSlide) {
      const domainMatch = run.match(/^([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)$/i);
      if (domainMatch) domains.add(domainMatch[1].toLowerCase());
    }
    result.sources = Array.from(domains);
  }

  // Growth points: "<area> | <n> цитирований".
  const growthSlide = slides.find((slide) => slide.some((run) => /ТОЧКИ РОСТА/i.test(run)));
  if (growthSlide) {
    for (let i = 0; i < growthSlide.length; i += 1) {
      const citationMatch = growthSlide[i].match(/(\d{1,4})\s*цитирован/i);
      if (citationMatch && i > 0) {
        const area = growthSlide[i - 1];
        if (/[A-Za-zА-Яа-яЁё]/.test(area) && area.length <= 40 && !/ТОЧКИ РОСТА|усилить/i.test(area)) {
          result.growthPoints.push({ area: area.trim(), citations: toInt(citationMatch[1]) });
        }
      }
    }
  }

  result.matched = result.presenceIndex != null || result.sovPercent != null || result.engines.length > 0;
  return result;
}
