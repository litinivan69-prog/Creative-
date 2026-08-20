import { prisma } from "@/lib/prisma";
import { publishScheduledPublication } from "@/lib/telegram-publish";

const DEFAULT_TIMEZONE = "Europe/Moscow";
const DEFAULT_PUBLISH_TIME = "11:00";
const MAX_PUBLICATIONS_PER_RUN = 20;

function localClock(now: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
  } catch {
    return localClock(now, DEFAULT_TIMEZONE);
  }
}

function publicationPlatform(name: string): "vk" | "telegram" | "vcru" | null {
  if (/vc\.ru|виси/i.test(name)) return "vcru";
  if (/vk|вконтакт/i.test(name)) return "vk";
  if (/telegram|телеграм|\btg\b/i.test(name)) return "telegram";
  return null;
}

function isDue(publication: { scheduledDate: string; scheduledTime: string | null; timezone: string | null }, now: Date) {
  const clock = localClock(now, publication.timezone || DEFAULT_TIMEZONE);
  if (publication.scheduledDate < clock.date) return true;
  if (publication.scheduledDate > clock.date) return false;
  return (publication.scheduledTime || DEFAULT_PUBLISH_TIME) <= clock.time;
}

export async function runScheduledAutopublish(now = new Date()) {
  const todayMoscow = localClock(now, DEFAULT_TIMEZONE).date;
  const candidates = await prisma.scheduledPublication.findMany({
    where: {
      scheduledDate: { lte: todayMoscow },
      status: "ready",
      publishStatus: { not: "published" },
      contentDraft: { status: { in: ["approved", "ready_to_schedule"] } },
    },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
    take: MAX_PUBLICATIONS_PER_RUN,
    select: {
      id: true,
      clientId: true,
      platformName: true,
      scheduledDate: true,
      scheduledTime: true,
      timezone: true,
      client: {
        select: {
          channels: {
            where: { status: "active", autopublishEnabled: true, platform: { in: ["vk", "telegram", "vcru"] } },
            select: { platform: true },
          },
        },
      },
    },
  });

  const summary = { checked: candidates.length, due: 0, published: 0, failed: 0, skipped: 0 };
  for (const publication of candidates) {
    const platform = publicationPlatform(publication.platformName);
    if (!platform || !publication.client.channels.some((channel) => channel.platform === platform)) {
      summary.skipped += 1;
      continue;
    }
    if (!isDue(publication, now)) continue;

    summary.due += 1;
    const outcome = await publishScheduledPublication(publication.id, { platforms: [platform] });
    if (outcome.ok) summary.published += 1;
    else summary.failed += 1;
  }

  return summary;
}

export const scheduledAutopublishDefaults = {
  timezone: DEFAULT_TIMEZONE,
  time: DEFAULT_PUBLISH_TIME,
};
