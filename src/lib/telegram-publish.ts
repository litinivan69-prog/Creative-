import { prisma } from "@/lib/prisma";
import { getTelegramBotToken, sendTelegramPost } from "@/lib/telegram";

export type TelegramPublishOutcome =
  | { ok: true; url: string; messageId?: number; alreadyPublished?: boolean }
  | { ok: false; error: string };

/**
 * Core publish flow shared by the manager UI action and the integration API:
 * resolves the client's active Telegram channel, posts the draft, persists
 * the result on ScheduledPublication and logs an IntegrationEvent.
 * Idempotent: an already published item is not posted twice.
 */
export async function publishScheduledPublication(scheduledPublicationId: string): Promise<TelegramPublishOutcome> {
  const publication = await prisma.scheduledPublication.findUnique({
    where: { id: scheduledPublicationId },
    select: {
      id: true,
      clientId: true,
      topic: true,
      publishStatus: true,
      externalUrl: true,
      contentDraft: { select: { draftTitle: true, draftBody: true } },
    },
  });

  if (!publication) {
    return { ok: false, error: "Публикация не найдена." };
  }

  if (publication.publishStatus === "published" && publication.externalUrl) {
    return { ok: true, url: publication.externalUrl, alreadyPublished: true };
  }

  const token = await getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "Сначала подключите Telegram-бота в настройках." };
  }

  const channel = await prisma.clientChannel.findFirst({
    where: { clientId: publication.clientId, platform: "telegram", status: "active" },
    orderBy: { createdAt: "asc" },
    select: { channelId: true },
  });

  if (!channel) {
    return { ok: false, error: "У клиента нет подключённого Telegram-канала. Добавьте канал в настройках." };
  }

  const result = await sendTelegramPost({
    token,
    channelId: channel.channelId,
    title: publication.contentDraft?.draftTitle || publication.topic,
    body: publication.contentDraft?.draftBody ?? "",
  });

  if (!result.ok) {
    await prisma.integrationEvent
      .create({
        data: {
          direction: "outbound",
          eventType: "telegram_publish",
          relatedType: "ScheduledPublication",
          relatedId: publication.id,
          payload: { channelId: channel.channelId, error: result.error },
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
        externalId: String(result.messageId),
      },
    });

    await prisma.integrationEvent.create({
      data: {
        direction: "outbound",
        eventType: "telegram_publish",
        relatedType: "ScheduledPublication",
        relatedId: publication.id,
        payload: { channelId: channel.channelId, messageId: result.messageId, url: result.url },
        status: "sent",
        sentAt: new Date(),
        attempts: 1,
      },
    });
  } catch {
    return { ok: false, error: "Пост вышел в Telegram, но не удалось сохранить результат. Обновите страницу." };
  }

  return { ok: true, url: result.url, messageId: result.messageId };
}
