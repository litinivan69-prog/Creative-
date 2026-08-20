import { Prisma } from "@prisma/client";
import { stripCarouselSlideLabel } from "@/lib/creative-asset-schema";
import { prisma } from "@/lib/prisma";
import { getIntegrationSetting, getTelegramBotToken, sendTelegramPost } from "@/lib/telegram";
import { VK_ACCESS_TOKEN_KEY, sendVkPost } from "@/lib/vk";
import { decryptChannelCredential } from "@/lib/channel-credentials";
import { sendVcArticle } from "@/lib/vc";
import type { ArticleImage } from "@/lib/article-schema";

/** Maps a planned platform name (free text from the plan) to a channel platform. */
function mapPublicationPlatform(name?: string | null): "vk" | "telegram" | "vcru" | null {
  if (!name) return null;
  if (/vc\.ru|виси/i.test(name)) return "vcru";
  if (/vk|вконтакт/i.test(name)) return "vk";
  if (/telegram|телеграм|\btg\b/i.test(name)) return "telegram";
  return null;
}

export type PlatformPublishResult = {
  platform: string;
  ok: boolean;
  url?: string;
  externalId?: string;
  imagesSent?: number;
  textTruncated?: boolean;
  alreadyPublished?: boolean;
  error?: string;
};

export type TelegramPublishOutcome =
  | {
      ok: true;
      url: string;
      alreadyPublished?: boolean;
      imagesSent?: number;
      textTruncated?: boolean;
      results: PlatformPublishResult[];
    }
  | { ok: false; error: string; results?: PlatformPublishResult[] };

async function recordPublishFailure(scheduledPublicationId: string, error: string) {
  await prisma.scheduledPublication.update({
    where: { id: scheduledPublicationId },
    data: {
      publishStatus: "failed",
      publishErrorMessage: error.slice(0, 500),
    },
  }).catch(() => {});
}

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

async function collectVcArticle(plannedContentItemId: string) {
  const article = await prisma.article.findFirst({
    where: { plannedContentItemId, status: { not: "archived" } },
    orderBy: { updatedAt: "desc" },
    select: { title: true, bodyMarkdown: true, images: true },
  });
  if (!article?.bodyMarkdown) return null;
  const imageUrls = ((article.images as ArticleImage[] | null) ?? [])
    .map((image) => image.url)
    .filter((url): url is string => Boolean(url));
  return { title: article.title, body: article.bodyMarkdown, imageUrls };
}

async function logIntegrationEvent(data: {
  eventType: string;
  relatedId: string;
  payload: Prisma.InputJsonValue;
  ok: boolean;
  errorMessage?: string;
}) {
  await prisma.integrationEvent
    .create({
      data: {
        direction: "outbound",
        eventType: data.eventType,
        relatedType: "ScheduledPublication",
        relatedId: data.relatedId,
        payload: data.payload,
        status: data.ok ? "sent" : "failed",
        sentAt: data.ok ? new Date() : null,
        errorMessage: data.errorMessage?.slice(0, 500) ?? null,
        attempts: 1,
      },
    })
    .catch(() => {});
}

/**
 * Cross-posting publish: sends the material to EVERY active client channel
 * (one post per platform — Telegram gets the caption-length version, VK the
 * full text). Idempotent per platform via PublicationResult; `force` re-posts.
 * Legacy fields on ScheduledPublication keep pointing at the primary platform
 * (the one planned for the material) for existing reports/UI.
 */
export async function publishScheduledPublication(
  scheduledPublicationId: string,
  options: { force?: boolean; platforms?: Array<"vk" | "telegram" | "vcru"> } = {},
): Promise<TelegramPublishOutcome> {
  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: {
      id: true,
      clientId: true,
      topic: true,
      platformName: true,
      plannedContentItemId: true,
      publishStatus: true,
      externalUrl: true,
      contentDraft: { select: { draftTitle: true, draftBody: true, telegramBody: true } },
      results: { select: { platform: true, externalUrl: true, externalId: true } },
    },
  });

  if (!publication) {
    return { ok: false, error: "Публикация не найдена." };
  }

  if (publication.publishStatus === "published" && !options.force) {
    const existing = publication.results.find((result) => result.externalUrl);
    return existing
      ? { ok: true, url: existing.externalUrl, alreadyPublished: true, results: publication.results.map((result) => ({ platform: result.platform, ok: true, alreadyPublished: true, url: result.externalUrl, externalId: result.externalId })) }
      : { ok: false, error: "Материал уже отмечен как опубликованный." };
  }

  const channels = await prisma.clientChannel.findMany({
    where: {
      clientId: publication.clientId,
      status: "active",
      platform: { in: options.platforms?.length ? options.platforms : ["vk", "telegram"] },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, channelId: true, platform: true, credentialEncrypted: true },
  });

  if (channels.length === 0) {
    return { ok: false, error: "У клиента нет подключённых каналов. Добавьте каналы в настройках." };
  }

  if (!options.force) {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    const claimed = await prisma.scheduledPublication.updateMany({
      where: {
        id: publication.id,
        publishStatus: { not: "published" },
        OR: [
          { publishStatus: null },
          { publishStatus: { in: ["failed", "queued"] } },
          { publishStatus: "publishing", lastPublishAttemptAt: { lt: staleBefore } },
        ],
      },
      data: {
        publishStatus: "publishing",
        publishErrorMessage: null,
        publishAttempts: { increment: 1 },
        lastPublishAttemptAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      return { ok: false, error: "Публикация уже выполняется. Подождите несколько секунд." };
    }
  }

  // One target channel per platform (first added wins).
  const targets = [...new Map(channels.map((channel) => [channel.platform, channel])).values()];
  const primaryPlatform = mapPublicationPlatform(publication.platformName) ?? "telegram";
  const existingByPlatform = new Map(publication.results.map((result) => [result.platform, result]));

  const imageUrls = await collectPublicationImageUrls(publication.id);
  const vcArticle = targets.some((channel) => channel.platform === "vcru")
    ? await collectVcArticle(publication.plannedContentItemId)
    : null;
  const results: PlatformPublishResult[] = [];

  for (const channel of targets) {
    const existing = existingByPlatform.get(channel.platform);
    if (existing && !options.force) {
      results.push({
        platform: channel.platform,
        ok: true,
        alreadyPublished: true,
        url: existing.externalUrl,
        externalId: existing.externalId,
      });
      continue;
    }

    if (channel.platform === "vcru") {
      const token = decryptChannelCredential(channel.credentialEncrypted);
      const subsiteId = Number(channel.channelId);
      if (!token || !Number.isInteger(subsiteId) || subsiteId <= 0) {
        results.push({ platform: "vcru", ok: false, error: "VC.ru не подключён в настройках." });
        continue;
      }
      if (!vcArticle) {
        results.push({ platform: "vcru", ok: false, error: "Статья ещё не готова к публикации." });
        continue;
      }
      const vc = await sendVcArticle({ token, subsiteId, ...vcArticle });
      if (vc.ok) {
        results.push({ platform: "vcru", ok: true, url: vc.url, externalId: String(vc.entryId), imagesSent: vc.imagesSent });
      } else {
        results.push({ platform: "vcru", ok: false, error: vc.error });
      }
      await logIntegrationEvent({
        eventType: "vcru_publish",
        relatedId: publication.id,
        payload: vc.ok ? { subsiteId, url: vc.url, imagesSent: vc.imagesSent } : { subsiteId, error: vc.error },
        ok: vc.ok,
        errorMessage: vc.ok ? undefined : vc.error,
      });
    } else if (channel.platform === "vk") {
      const vkToken = decryptChannelCredential(channel.credentialEncrypted)
        ?? await getIntegrationSetting(VK_ACCESS_TOKEN_KEY);
      if (!vkToken) {
        results.push({ platform: "vk", ok: false, error: "VK не подключён в настройках." });
        continue;
      }
      // Legacy drafts may still carry the service slide label — never publish it.
      const message = stripCarouselSlideLabel(
        [publication.contentDraft?.draftTitle || publication.topic, publication.contentDraft?.draftBody ?? ""]
          .filter(Boolean)
          .join("\n\n"),
      );
      const vk = await sendVkPost({ token: vkToken, groupId: Number(channel.channelId), message, imageUrls });
      if (vk.ok) {
        results.push({ platform: "vk", ok: true, url: vk.url, externalId: String(vk.postId), imagesSent: vk.imagesSent });
      } else {
        results.push({ platform: "vk", ok: false, error: vk.error });
      }
      await logIntegrationEvent({
        eventType: "vk_publish",
        relatedId: publication.id,
        payload: vk.ok
          ? { channelId: channel.channelId, url: vk.url, imagesSent: vk.imagesSent }
          : { channelId: channel.channelId, error: vk.error },
        ok: vk.ok,
        errorMessage: vk.ok ? undefined : vk.error,
      });
    } else {
      const token = decryptChannelCredential(channel.credentialEncrypted)
        ?? await getTelegramBotToken();
      if (!token) {
        results.push({ platform: "telegram", ok: false, error: "Telegram-бот не подключён в настройках." });
        continue;
      }
      const telegramBody = publication.contentDraft?.telegramBody?.trim();
      const tg = await sendTelegramPost({
        token,
        channelId: channel.channelId,
        title: telegramBody
          ? null
          : stripCarouselSlideLabel(publication.contentDraft?.draftTitle || publication.topic),
        body: stripCarouselSlideLabel(telegramBody || publication.contentDraft?.draftBody || ""),
        imageUrls,
      });
      if (tg.ok) {
        results.push({
          platform: "telegram",
          ok: true,
          url: tg.url,
          externalId: String(tg.messageId),
          imagesSent: tg.imagesSent,
          textTruncated: tg.textTruncated,
        });
      } else {
        results.push({ platform: "telegram", ok: false, error: tg.error });
      }
      await logIntegrationEvent({
        eventType: "telegram_publish",
        relatedId: publication.id,
        payload: tg.ok
          ? { channelId: channel.channelId, url: tg.url, imagesSent: tg.imagesSent, textTruncated: tg.textTruncated ?? false }
          : { channelId: channel.channelId, error: tg.error },
        ok: tg.ok,
        errorMessage: tg.ok ? undefined : tg.error,
      });
    }

    // Persist the per-platform result (idempotent upsert).
    const sent = results[results.length - 1];
    if (sent.ok && !sent.alreadyPublished && sent.url && sent.externalId) {
      await prisma.publicationResult
        .upsert({
          where: {
            scheduledPublicationId_platform: {
              scheduledPublicationId: publication.id,
              platform: sent.platform,
            },
          },
          update: {
            externalId: sent.externalId,
            externalUrl: sent.url,
            imagesSent: sent.imagesSent ?? 0,
            textTruncated: sent.textTruncated ?? false,
            channelRecordId: channel.id,
            publishedAt: new Date(),
          },
          create: {
            scheduledPublicationId: publication.id,
            clientId: publication.clientId,
            platform: sent.platform,
            channelRecordId: channel.id,
            externalId: sent.externalId,
            externalUrl: sent.url,
            imagesSent: sent.imagesSent ?? 0,
            textTruncated: sent.textTruncated ?? false,
          },
        })
        .catch(() => {});
    }
  }

  const successes = results.filter((result) => result.ok && result.url);
  if (successes.length === 0) {
    const firstError = results.find((result) => !result.ok)?.error ?? "Не удалось опубликовать.";
    await recordPublishFailure(publication.id, firstError);
    return { ok: false, error: firstError, results };
  }

  // Legacy single-value fields keep pointing at the primary (planned) platform.
  const primary = successes.find((result) => result.platform === primaryPlatform) ?? successes[0];
  try {
    await prisma.scheduledPublication.update({
      where: { id: publication.id },
      data: {
        publishStatus: "published",
        publishErrorMessage: null,
        publishedAt: new Date(),
        externalUrl: primary.url,
        externalId: primary.externalId ?? null,
      },
    });
  } catch {
    // Result rows are already persisted; legacy pointers can be refreshed later.
  }

  return {
    ok: true,
    url: primary.url as string,
    alreadyPublished: successes.every((result) => result.alreadyPublished),
    imagesSent: primary.imagesSent,
    textTruncated: primary.textTruncated,
    results,
  };
}
