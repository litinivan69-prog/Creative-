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

export async function sendTelegramPost(options: {
  token: string;
  channelId: string;
  title?: string | null;
  body: string;
}): Promise<{ ok: true; messageId: number; url: string } | { ok: false; error: string }> {
  const text = [options.title?.trim(), options.body.trim()]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, TELEGRAM_TEXT_LIMIT);

  if (!text) {
    return { ok: false, error: "У материала нет текста для публикации." };
  }

  const res = await telegramCall<{ message_id: number; chat: TelegramChat }>(options.token, "sendMessage", {
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
  };
}
