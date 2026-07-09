import { prisma } from "@/lib/prisma";
import { fetchAndPrepareImage } from "@/lib/social-images";

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

async function telegramUpload<T>(
  token: string,
  method: string,
  fields: Record<string, string>,
  files: Array<{ name: string; data: Buffer; filename: string }>,
): Promise<TelegramResult<T>> {
  try {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    for (const file of files) {
      form.append(file.name, new Blob([new Uint8Array(file.data)], { type: "image/jpeg" }), file.filename);
    }
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      body: form,
    });
    return (await response.json()) as TelegramResult<T>;
  } catch {
    return { ok: false, description: "Telegram API недоступен" };
  }
}

export type TelegramPostResult =
  | { ok: true; messageId: number; url: string; imagesSent: number; textTruncated?: boolean }
  | { ok: false; error: string };

/** Trims text to the Telegram caption limit at a word boundary, adding an ellipsis. */
function truncateCaption(text: string) {
  const slice = text.slice(0, TELEGRAM_CAPTION_LIMIT - 1);
  const lastBreak = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
  const cut = lastBreak > TELEGRAM_CAPTION_LIMIT * 0.6 ? slice.slice(0, lastBreak) : slice;
  return `${cut.trimEnd()}…`;
}

/**
 * Posts a material to a channel as ONE message: single visual -> sendPhoto with
 * caption, carousel -> one sendMediaGroup album with caption on the first slide,
 * no visuals -> plain text. Captions are trimmed to Telegram's 1024 limit
 * (full text stays in the platform; VK will receive it untrimmed later).
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

  // Telegram norm: a post is ONE message. Text rides as the caption (<=1024),
  // longer texts are trimmed at a word boundary; the full text stays in the
  // platform (and will be used as-is for VK later).
  const caption = text.length <= TELEGRAM_CAPTION_LIMIT ? text : truncateCaption(text);
  const textTruncated = caption.length < text.length;

  if (images.length > 0) {
    const prepared = (await Promise.all(images.map(fetchAndPrepareImage))).filter(
      (buffer): buffer is Buffer => buffer !== null,
    );

    if (prepared.length === 1) {
      const res = await telegramUpload<SentMessage>(
        options.token,
        "sendPhoto",
        { chat_id: options.channelId, ...(caption ? { caption } : {}) },
        [{ name: "photo", data: prepared[0], filename: "visual-1.jpg" }],
      );
      if (res.ok) {
        return {
          ok: true,
          messageId: res.result.message_id,
          url: buildMessageUrl(res.result.chat, res.result.message_id),
          imagesSent: 1,
          textTruncated,
        };
      }
    }

    if (prepared.length > 1) {
      // Carousel is always a single album post.
      const media = prepared.map((_, index) => ({
        type: "photo",
        media: `attach://photo${index}`,
        ...(index === 0 && caption ? { caption } : {}),
      }));
      const res = await telegramUpload<SentMessage[]>(
        options.token,
        "sendMediaGroup",
        { chat_id: options.channelId, media: JSON.stringify(media) },
        prepared.map((data, index) => ({ name: `photo${index}`, data, filename: `visual-${index + 1}.jpg` })),
      );
      if (res.ok && res.result.length > 0) {
        const first = res.result[0];
        return {
          ok: true,
          messageId: first.message_id,
          url: buildMessageUrl(first.chat, first.message_id),
          imagesSent: res.result.length,
          textTruncated,
        };
      }
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
