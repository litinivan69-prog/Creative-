import { prisma } from "@/lib/prisma";
import { verifyN8nSecret } from "@/lib/integration-events";
import {
  TELEGRAM_BOT_TOKEN_KEY,
  TELEGRAM_BOT_USERNAME_KEY,
  getIntegrationSetting,
  getTelegramBotToken,
  setIntegrationSetting,
  verifyTelegramBotToken,
  verifyTelegramChannel,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Integration setup/status API (guarded by x-aps-secret).
 * GET  — bot status, clients with their channels and recent publications.
 * POST — { botToken? , channel?: { clientId, channelId, title? } } (both optional, idempotent).
 */
export async function GET(request: Request) {
  if (!verifyN8nSecret(request)) {
    return Response.json({ ok: false, error: "Неверный секрет." }, { status: 401 });
  }

  try {
    const [botUsername, tokenSet, clients] = await Promise.all([
      getIntegrationSetting(TELEGRAM_BOT_USERNAME_KEY),
      getTelegramBotToken().then(Boolean),
      prisma.client.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          channels: {
            where: { platform: "telegram", status: "active" },
            select: { id: true, channelId: true, title: true },
          },
          scheduledPublications: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, topic: true, platformName: true, publishStatus: true, externalUrl: true },
          },
        },
      }),
    ]);

    return Response.json({ ok: true, bot: { configured: tokenSet, username: botUsername }, clients });
  } catch (error) {
    console.error("telegram setup GET failed", error);
    return Response.json({ ok: false, error: "Не удалось получить статус." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!verifyN8nSecret(request)) {
    return Response.json({ ok: false, error: "Неверный секрет." }, { status: 401 });
  }

  let body: { botToken?: unknown; channel?: { clientId?: unknown; channelId?: unknown; title?: unknown } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Некорректное тело запроса." }, { status: 400 });
  }

  const summary: Record<string, unknown> = {};

  try {
    if (typeof body.botToken === "string" && body.botToken.trim()) {
      const token = body.botToken.trim();
      const check = await verifyTelegramBotToken(token);
      if (!check.ok) {
        return Response.json({ ok: false, error: "Telegram не принял токен бота." }, { status: 400 });
      }
      await setIntegrationSetting(TELEGRAM_BOT_TOKEN_KEY, token);
      if (check.username) await setIntegrationSetting(TELEGRAM_BOT_USERNAME_KEY, check.username);
      summary.bot = { username: check.username };
    }

    if (body.channel && typeof body.channel.clientId === "string" && typeof body.channel.channelId === "string") {
      const clientId = body.channel.clientId.trim();
      const channelId = body.channel.channelId.trim();
      const title = typeof body.channel.title === "string" ? body.channel.title.trim() : "";

      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) {
        return Response.json({ ok: false, error: "Клиент не найден." }, { status: 404 });
      }

      const token = await getTelegramBotToken();
      if (!token) {
        return Response.json({ ok: false, error: "Сначала подключите Telegram-бота." }, { status: 400 });
      }

      const check = await verifyTelegramChannel(token, channelId);
      if (!check.ok) {
        return Response.json({ ok: false, error: check.error ?? "Бот не видит канал." }, { status: 400 });
      }

      const existing = await prisma.clientChannel.findFirst({
        where: { clientId, platform: "telegram", channelId },
        select: { id: true },
      });

      const channel = existing
        ? await prisma.clientChannel.update({
            where: { id: existing.id },
            data: { status: "active", title: title || check.chat?.title || null },
          })
        : await prisma.clientChannel.create({
            data: { clientId, platform: "telegram", channelId, title: title || check.chat?.title || null },
          });

      summary.channel = { id: channel.id, channelId: channel.channelId, title: channel.title };
    }

    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("telegram setup POST failed", error);
    return Response.json({ ok: false, error: "Не удалось сохранить настройки." }, { status: 500 });
  }
}
