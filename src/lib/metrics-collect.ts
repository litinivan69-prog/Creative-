import { prisma } from "@/lib/prisma";
import { getIntegrationSetting } from "@/lib/telegram";
import { VK_ACCESS_TOKEN_KEY } from "@/lib/vk";

const VK_API = "https://api.vk.com/method";
const VK_API_VERSION = "5.199";

/** Parses Telegram's compact view counter ("1.2K", "3M", "845"). */
function parseCompactNumber(raw: string): number | null {
  const match = raw.trim().match(/^([\d.,]+)\s*([KkMm])?$/);
  if (!match) return null;
  const base = Number(match[1].replace(",", "."));
  if (!Number.isFinite(base)) return null;
  const factor = match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2] ? 1_000 : 1;
  return Math.round(base * factor);
}

/** Best-effort view count for a PUBLIC Telegram channel post via the embed page. */
async function fetchTelegramViews(channelRef: string, messageId: string): Promise<number | null> {
  const username = channelRef.replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{4,}$/.test(username)) return null; // private/id-based channels have no public embed

  try {
    const response = await fetch(`https://t.me/${username}/${messageId}?embed=1`, {
      signal: AbortSignal.timeout(10000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; APSMetrics/1.0)" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/tgme_widget_message_views[^>]*>([^<]+)</);
    return match ? parseCompactNumber(match[1]) : null;
  } catch {
    return null;
  }
}

type VkPostStats = {
  likes?: { count?: number };
  comments?: { count?: number };
  reposts?: { count?: number };
  views?: { count?: number };
};

/** Batch stats for VK wall posts (ids like "-123_45"). */
async function fetchVkStats(token: string, postIds: string[]): Promise<Map<string, VkPostStats>> {
  const stats = new Map<string, VkPostStats>();
  for (let i = 0; i < postIds.length; i += 50) {
    const batch = postIds.slice(i, i + 50);
    try {
      const body = new URLSearchParams({ posts: batch.join(","), access_token: token, v: VK_API_VERSION });
      const response = await fetch(`${VK_API}/wall.getById`, { method: "POST", body });
      const data = (await response.json()) as {
        response?: { items?: Array<VkPostStats & { owner_id: number; id: number }> } | Array<VkPostStats & { owner_id: number; id: number }>;
      };
      const items = Array.isArray(data.response) ? data.response : data.response?.items ?? [];
      for (const item of items) {
        stats.set(`${item.owner_id}_${item.id}`, item);
      }
    } catch {
      // best effort per batch
    }
  }
  return stats;
}

export type MetricsCollectSummary = {
  scanned: number;
  vkCollected: number;
  telegramCollected: number;
  skipped: number;
};

/**
 * Takes fresh metric snapshots for recently published results (both platforms)
 * and appends them to PublicationMetric (source "auto"). Reports always read
 * the latest snapshot, so manual entries stay valid until a newer auto one.
 */
export async function collectPublicationMetrics(options: { days?: number; limit?: number } = {}): Promise<MetricsCollectSummary> {
  const since = new Date(Date.now() - (options.days ?? 60) * 24 * 60 * 60 * 1000);

  const results = await prisma.publicationResult.findMany({
    where: { publishedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    take: options.limit ?? 100,
    select: {
      scheduledPublicationId: true,
      clientId: true,
      platform: true,
      externalId: true,
      externalUrl: true,
      channelRecordId: true,
      scheduledPublication: { select: { monthlyPlanId: true, platformName: true, plannedContentItemId: true } },
    },
  });

  const summary: MetricsCollectSummary = { scanned: results.length, vkCollected: 0, telegramCollected: 0, skipped: 0 };
  if (results.length === 0) return summary;

  const channelRecords = await prisma.clientChannel.findMany({
    where: { id: { in: results.map((r) => r.channelRecordId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, channelId: true },
  });
  const channelById = new Map(channelRecords.map((channel) => [channel.id, channel.channelId]));

  // VK: batch stats.
  const vkResults = results.filter((result) => result.platform === "vk");
  const vkToken = vkResults.length > 0 ? await getIntegrationSetting(VK_ACCESS_TOKEN_KEY) : null;
  const vkStats = vkToken
    ? await fetchVkStats(
        vkToken,
        vkResults.map((result) => {
          const groupId = channelById.get(result.channelRecordId ?? "") ?? "";
          return `-${groupId}_${result.externalId}`;
        }),
      )
    : new Map<string, VkPostStats>();

  for (const result of results) {
    const base = {
      scheduledPublicationId: result.scheduledPublicationId,
      plannedContentItemId: result.scheduledPublication.plannedContentItemId,
      clientId: result.clientId,
      monthlyPlanId: result.scheduledPublication.monthlyPlanId,
      platformName: result.platform,
      source: "auto",
    };

    if (result.platform === "vk") {
      const groupId = channelById.get(result.channelRecordId ?? "");
      const stats = groupId ? vkStats.get(`-${groupId}_${result.externalId}`) : undefined;
      if (!stats) {
        summary.skipped += 1;
        continue;
      }
      await prisma.publicationMetric
        .create({
          data: {
            ...base,
            likes: stats.likes?.count ?? null,
            comments: stats.comments?.count ?? null,
            shares: stats.reposts?.count ?? null,
            views: stats.views?.count ?? null,
          },
        })
        .catch(() => {});
      summary.vkCollected += 1;
    } else if (result.platform === "telegram") {
      const channelRef = channelById.get(result.channelRecordId ?? "") ?? "";
      const views = await fetchTelegramViews(channelRef, result.externalId);
      if (views == null) {
        summary.skipped += 1;
        continue;
      }
      await prisma.publicationMetric
        .create({
          data: { ...base, views, reach: views },
        })
        .catch(() => {});
      summary.telegramCollected += 1;
    } else {
      summary.skipped += 1;
    }
  }

  return summary;
}
