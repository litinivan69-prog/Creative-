import { prisma } from "@/lib/prisma";

export const TELEGRAM_BOT_TOKEN_KEY = "telegram_bot_token";
export const TELEGRAM_BOT_USERNAME_KEY = "telegram_bot_username";

type TelegramChat = {
  id: number;
  type?: string;
  title?: string;
  username?: string;
};

type TelegramResult<T> = { ok: true; result: T } | { ok: false; description?: string };

async function telegramCall<T>(token: string, method: string, params: Record<string, unknown>): Promise<TelegramResult<T>> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    return (await response.json()) as TelegramResult<T>;
  } catch {
    return { ok: false, description: "Telegram API недоступен" };
  }
}

export async function getIntegrationSetting(key: string): Promise<string | null> {
  const row = await prisma.integrationSetting.findUnique({ where: { key } }).catch(() => null);
  return row?.value ?? null;
}

export async function setIntegrationSetting(key: string, value: string) {
  await prisma.integrationSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getTelegramBotToken() {
  return getIntegrationSetting(TELEGRAM_BOT_TOKEN_KEY);
}

/** Verifies a bot token against Telegram; returns the bot username when valid. */
export async function verifyTelegramBotToken(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  const res = await telegramCall<{ username?: string }>(token, "getMe", {});
  if (!res.ok) return { ok: false, error: res.description || "Токен не принят Telegram." };
  return { ok: true, username: res.result.username };
}

/** Checks the bot can see the channel; returns canonical chat info. */
export async function verifyTelegramChannel(token: string, channelId: string): Promise<{ ok: boolean; chat?: TelegramChat; error?: string }> {
  const res = await telegramCall<TelegramChat>(token, "getChat", { chat_id: channelId });
  if (!res.ok) {
    return { ok: false, error: "Бот не видит этот канал. Добавьте бота администратором канала и проверьте адрес." };
  }
  return { ok: true, chat: res.result };
}

function buildMessageUrl(chat: TelegramChat, messageId: number) {
  if (chat.username) return `https://t.me/${chat.username}/${messageId}`;
  const internalId = String(chat.id).replace(/^-100/, "");
  return `https://t.me/c/${internalId}/${messageId}`;
}

const TELEGRAM_TEXT_LIMIT = 4096;
const TELEGRAM_CAPTION_LIMIT = 1024;
const TELEGRAM_ALBUM_LIMIT = 10;

type SentMessage = { message_id: number; chat: TelegramChat };

export type TelegramPostResult =
  | { ok: true; messageId: number; url: string; imagesSent: number }
  | { ok: false; error: string };

/**
 * Posts a material to a channel: single visual -> sendPhoto (caption when it fits),
 * carousel -> sendMediaGroup album, no visuals -> plain text. When the text is too
 * long for a caption it follows as a separate message. Image failures gracefully
 * fall back to a text post so publishing never breaks because of a visual.
 */
export async function sendTelegramPost(options: {
  token: string;
  channelId: string;
  title?: string | null;
  body: string;
  imageUrls?: string[];
}): Promise<TelegramPostResult> {
  const text = [options.title?.trim(), options.body.trim()]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, TELEGRAM_TEXT_LIMIT);

  const images = (options.imageUrls ?? [])
    .filter((url) => /^https?:\/\//.test(url))
    .slice(0, TELEGRAM_ALBUM_LIMIT);

  if (!text && images.length === 0) {
    return { ok: false, error: "У материала нет текста для публикации." };
  }

  const captionFits = text.length > 0 && text.length <= TELEGRAM_CAPTION_LIMIT;

  const sendFollowUpText = async () => {
    if (text && !captionFits) {
      await telegramCall(options.token, "sendMessage", { chat_id: options.channelId, text });
    }
  };

  if (images.length === 1) {
    const res = await telegramCall<SentMessage>(options.token, "sendPhoto", {
      chat_id: options.channelId,
      photo: images[0],
      ...(captionFits ? { caption: text } : {}),
    });
    if (res.ok) {
      await sendFollowUpText();
      return {
        ok: true,
        messageId: res.result.message_id,
        url: buildMessageUrl(res.result.chat, res.result.message_id),
        imagesSent: 1,
      };
    }
  }

  if (images.length > 1) {
    const media = images.map((url, index) => ({
      type: "photo",
      media: url,
      ...(index === 0 && captionFits ? { caption: text } : {}),
    }));
    const res = await telegramCall<SentMessage[]>(options.token, "sendMediaGroup", {
      chat_id: options.channelId,
      media,
    });
    if (res.ok && res.result.length > 0) {
      await sendFollowUpText();
      const first = res.result[0];
      return {
        ok: true,
        messageId: first.message_id,
        url: buildMessageUrl(first.chat, first.message_id),
        imagesSent: res.result.length,
      };
    }
  }

  // No images, or the image send failed — post as text so publishing still succeeds.
  if (!text) {
    return { ok: false, error: "Telegram не принял визуалы материала." };
  }

  const res = await telegramCall<SentMessage>(options.token, "sendMessage", {
    chat_id: options.channelId,
    text,
  });

  if (!res.ok) {
    return { ok: false, error: res.description || "Telegram не принял сообщение." };
  }

  return {
    ok: true,
    messageId: res.result.message_id,
    url: buildMessageUrl(res.result.chat, res.result.message_id),
    imagesSent: 0,
  };
}
