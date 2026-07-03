export type ReportMetricSnapshot = {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  views: number | null;
  saves: number | null;
  clicks: number | null;
};

export type ReportPublicationInput = {
  id: string;
  platformName: string;
  topic?: string | null;
  publishStatus?: string | null;
  publishedAt?: Date | string | null;
  scheduledDate?: string | null;
  metric?: ReportMetricSnapshot | null;
};

export const REPORT_METRIC_KEYS = [
  "likes",
  "comments",
  "shares",
  "reach",
  "views",
  "saves",
  "clicks",
] as const;

export type ReportMetricKey = (typeof REPORT_METRIC_KEYS)[number];

export const REPORT_METRIC_LABELS: Record<ReportMetricKey, string> = {
  likes: "Лайки",
  comments: "Комментарии",
  shares: "Репосты",
  reach: "Охват",
  views: "Просмотры",
  saves: "Сохранения",
  clicks: "Переходы",
};

export function isPublicationPublished(pub: {
  publishStatus?: string | null;
  publishedAt?: Date | string | null;
}) {
  return pub.publishStatus === "published" || Boolean(pub.publishedAt);
}

export function publicationEngagement(metric?: ReportMetricSnapshot | null) {
  if (!metric) return 0;
  return (metric.likes ?? 0) + (metric.comments ?? 0) + (metric.shares ?? 0) + (metric.saves ?? 0);
}

export type ReportPlatformSummary = {
  platformName: string;
  planned: number;
  published: number;
  engagement: number;
  reach: number | null;
};

export type ReportTopMaterial = {
  id: string;
  topic: string;
  platformName: string;
  engagement: number;
  metric: ReportMetricSnapshot;
};

export type MonthlyReport = {
  planned: number;
  published: number;
  publishRate: number;
  hasMetrics: boolean;
  totalEngagement: number;
  kpis: Record<ReportMetricKey, number | null>;
  byPlatform: ReportPlatformSummary[];
  top: ReportTopMaterial[];
};

export function buildMonthlyReport(publications: ReportPublicationInput[]): MonthlyReport {
  const planned = publications.length;
  const published = publications.filter(isPublicationPublished).length;

  const kpiState: Record<ReportMetricKey, { sum: number; has: boolean }> = {
    likes: { sum: 0, has: false },
    comments: { sum: 0, has: false },
    shares: { sum: 0, has: false },
    reach: { sum: 0, has: false },
    views: { sum: 0, has: false },
    saves: { sum: 0, has: false },
    clicks: { sum: 0, has: false },
  };

  const platformMap = new Map<
    string,
    { planned: number; published: number; engagement: number; reach: number; reachHas: boolean }
  >();
  const topCandidates: ReportTopMaterial[] = [];
  let totalEngagement = 0;

  for (const pub of publications) {
    const platform = platformMap.get(pub.platformName) ?? {
      planned: 0,
      published: 0,
      engagement: 0,
      reach: 0,
      reachHas: false,
    };
    platform.planned += 1;
    if (isPublicationPublished(pub)) platform.published += 1;

    const engagement = publicationEngagement(pub.metric);
    platform.engagement += engagement;
    totalEngagement += engagement;

    if (pub.metric?.reach != null) {
      platform.reach += pub.metric.reach;
      platform.reachHas = true;
    }
    platformMap.set(pub.platformName, platform);

    for (const key of REPORT_METRIC_KEYS) {
      const value = pub.metric?.[key];
      if (value != null) {
        kpiState[key].sum += value;
        kpiState[key].has = true;
      }
    }

    if (pub.metric && engagement > 0) {
      topCandidates.push({
        id: pub.id,
        topic: pub.topic ?? "Материал",
        platformName: pub.platformName,
        engagement,
        metric: pub.metric,
      });
    }
  }

  const kpis = REPORT_METRIC_KEYS.reduce((acc, key) => {
    acc[key] = kpiState[key].has ? kpiState[key].sum : null;
    return acc;
  }, {} as Record<ReportMetricKey, number | null>);

  const byPlatform: ReportPlatformSummary[] = [...platformMap.entries()]
    .map(([platformName, value]) => ({
      platformName,
      planned: value.planned,
      published: value.published,
      engagement: value.engagement,
      reach: value.reachHas ? value.reach : null,
    }))
    .sort((a, b) => b.engagement - a.engagement || b.published - a.published);

  const top = topCandidates.sort((a, b) => b.engagement - a.engagement).slice(0, 5);

  return {
    planned,
    published,
    publishRate: planned > 0 ? Math.round((published / planned) * 100) : 0,
    hasMetrics: REPORT_METRIC_KEYS.some((key) => kpiState[key].has),
    totalEngagement,
    kpis,
    byPlatform,
    top,
  };
}

export function formatReportNumber(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
}
