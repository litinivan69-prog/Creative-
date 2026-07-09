import { prisma } from "@/lib/prisma";
import { getIntegrationSetting, getTelegramBotToken, sendTelegramPost } from "@/lib/telegram";
import { VK_ACCESS_TOKEN_KEY, sendVkPost } from "@/lib/vk";

/** Maps a planned platform name (free text from the plan) to a channel platform. */
function mapPublicationPlatform(name?: string | null): "vk" | "telegram" | null {
  if (!name) return null;
  if (/vk|вконтакт/i.test(name)) return "vk";
  if (/telegram|телеграм|\btg\b/i.test(name)) return "telegram";
  return null;
}

export type TelegramPublishOutcome =
  | {
      ok: true;
      url: string;
      messageId?: number;
      alreadyPublished?: boolean;
      imagesSent?: number;
      textTruncated?: boolean;
    }
  | { ok: false; error: string };

/**
 * Active visuals for a publication, following the carousel rules:
 * carousel_slide assets are the required visuals (one image per slide);
 * otherwise non-legacy assets; best variant = approved one, else the latest.
 */
async function collectPublicationImageUrls(scheduledPublicationId: string): Promise<string[]> {
  const assets = await prisma.creativeAsset
    .findMany({
      where: { scheduledPublicationId },
      orderBy: { createdAt: "asc" },
      select: {
        assetType: true,
        notes: true,
        generatedVariants: {
          orderBy: { createdAt: "desc" },
          select: { imageUrl: true, status: true },
        },
      },
    })
    .catch(() => []);

  const slides = assets.filter((asset) => asset.assetType === "carousel_slide");
  const activeAssets =
    slides.length > 0
      ? slides
      : assets.filter((asset) => !(asset.notes ?? "").includes("legacyCombinedCarouselAsset=true"));

  return activeAssets
    .map((asset) => {
      const withUrl = asset.generatedVariants.filter((candidate) => Boolean(candidate.imageUrl));
      const variant = withUrl.find((candidate) => candidate.status === "approved") ?? withUrl[0];
      return variant?.imageUrl ?? null;
    })
    .filter((url): url is string => Boolean(url));
}

/**
 * Core publish flow shared by the manager UI action and the integration API:
 * resolves the client's active Telegram channel, posts the draft, persists
 * the result on ScheduledPublication and logs an IntegrationEvent.
 * Idempotent: an already published item is not posted twice.
 */
export async function publishScheduledPublication(
  scheduledPublicationId: string,
  options: { force?: boolean } = {},
): Promise<TelegramPublishOutcome> {
  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: {
      id: true,
      clientId: true,
      topic: true,
      platformName: true,
      publishStatus: true,
      externalUrl: true,
      contentDraft: { select: { draftTitle: true, draftBody: true, telegramBody: true } },
    },
  });

  if (!publication) {
    return { ok: false, error: "Публикация не найдена." };
  }

  if (!options.force && publication.publishStatus === "published" && publication.externalUrl) {
    return { ok: true, url: publication.externalUrl, alreadyPublished: true };
  }

  // Pick the client's channel: match the publication's planned platform when
  // possible, otherwise fall back to Telegram, then to any active channel.
  const channels = await prisma.clientChannel.findMany({
    where: { clientId: publication.clientId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: { channelId: true, platform: true },
  });

  if (channels.length === 0) {
    return { ok: false, error: "У клиента нет подключённых каналов. Добавьте канал в настройках." };
  }

  const mappedPlatform = mapPublicationPlatform(publication.platformName);
  const channel =
    (mappedPlatform ? channels.find((candidate) => candidate.platform === mappedPlatform) : undefined) ??
    channels.find((candidate) => candidate.platform === "telegram") ??
    channels[0];

  const imageUrls = await collectPublicationImageUrls(publication.id);
  const eventType = channel.platform === "vk" ? "vk_publish" : "telegram_publish";

  let result:
    | { ok: true; url: string; externalId: string; messageId?: number; imagesSent?: number; textTruncated?: boolean }
    | { ok: false; error: string };

  if (channel.platform === "vk") {
    const vkToken = await getIntegrationSetting(VK_ACCESS_TOKEN_KEY);
    if (!vkToken) {
      return { ok: false, error: "Сначала подключите VK в настройках." };
    }
    // VK gets the FULL text — no caption limit there.
    const message = [publication.contentDraft?.draftTitle || publication.topic, publication.contentDraft?.draftBody ?? ""]
      .filter(Boolean)
      .join("\n\n");
    const vk = await sendVkPost({
      token: vkToken,
      groupId: Number(channel.channelId),
      message,
      imageUrls,
    });
    result = vk.ok
      ? { ok: true, url: vk.url, externalId: String(vk.postId), imagesSent: vk.imagesSent }
      : vk;
  } else {
    const token = await getTelegramBotToken();
    if (!token) {
      return { ok: false, error: "Сначала подключите Telegram-бота в настройках." };
    }
    // Prefer the generator's Telegram-length version (standalone post, fits the
    // caption limit); the long draftBody is reserved for VK and the portal.
    const telegramBody = publication.contentDraft?.telegramBody?.trim();
    const tg = await sendTelegramPost({
      token,
      channelId: channel.channelId,
      title: telegramBody ? null : publication.contentDraft?.draftTitle || publication.topic,
      body: telegramBody || publication.contentDraft?.draftBody || "",
      imageUrls,
    });
    result = tg.ok
      ? {
          ok: true,
          url: tg.url,
          externalId: String(tg.messageId),
          messageId: tg.messageId,
          imagesSent: tg.imagesSent,
          textTruncated: tg.textTruncated,
        }
      : tg;
  }

  if (!result.ok) {
    await prisma.integrationEvent
      .create({
        data: {
          direction: "outbound",
          eventType,
          relatedType: "ScheduledPublication",
          relatedId: publication.id,
          payload: { channelId: channel.channelId, platform: channel.platform, error: result.error },
          status: "failed",
          errorMessage: result.error.slice(0, 500),
          attempts: 1,
        },
      })
      .catch(() => {});
    return { ok: false, error: result.error };
  }

  try {
    await prisma.scheduledPublication.update({
      where: { id: publication.id },
      data: {
        publishStatus: "published",
        publishedAt: new Date(),
        externalUrl: result.url,
        externalId: result.externalId,
      },
    });

    await prisma.integrationEvent.create({
      data: {
        direction: "outbound",
        eventType,
        relatedType: "ScheduledPublication",
        relatedId: publication.id,
        payload: {
          channelId: channel.channelId,
          platform: channel.platform,
          externalId: result.externalId,
          url: result.url,
          imagesSent: result.imagesSent,
          textTruncated: result.textTruncated ?? false,
        },
        status: "sent",
        sentAt: new Date(),
        attempts: 1,
      },
    });
  } catch {
    return { ok: false, error: "Пост вышел, но не удалось сохранить результат. Обновите страницу." };
  }

  return {
    ok: true,
    url: result.url,
    messageId: result.messageId,
    imagesSent: result.imagesSent,
    textTruncated: result.textTruncated,
  };
}
