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
import { VK_ACCESS_TOKEN_KEY, VK_ACCOUNT_LABEL_KEY, verifyVkGroup, verifyVkToken } from "@/lib/vk";

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
            where: { status: "active" },
            select: { id: true, channelId: true, title: true, platform: true },
          },
          scheduledPublications: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              topic: true,
              platformName: true,
              publishStatus: true,
              externalUrl: true,
              creativeAssets: {
                select: {
                  assetType: true,
                  generatedVariants: { select: { imageUrl: true }, orderBy: { createdAt: "desc" }, take: 1 },
                },
              },
            },
          },
        },
      }),
    ]);

    const clientsWithCounts = clients.map((client) => ({
      ...client,
      scheduledPublications: client.scheduledPublications.map(({ creativeAssets, ...publication }) => ({
        ...publication,
        imagesAvailable: creativeAssets.filter((asset) =>
          asset.generatedVariants.some((variant) => Boolean(variant.imageUrl)),
        ).length,
      })),
    }));

    return Response.json({ ok: true, bot: { configured: tokenSet, username: botUsername }, clients: clientsWithCounts });
  } catch (error) {
    console.error("telegram setup GET failed", error);
    return Response.json({ ok: false, error: "Не удалось получить статус." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!verifyN8nSecret(request)) {
    return Response.json({ ok: false, error: "Неверный секрет." }, { status: 401 });
  }

  let body: {
    botToken?: unknown;
    vkToken?: unknown;
    channel?: { clientId?: unknown; channelId?: unknown; title?: unknown; platform?: unknown };
  };
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

    if (typeof body.vkToken === "string" && body.vkToken.trim()) {
      const token = body.vkToken.trim();
      const check = await verifyVkToken(token);
      if (!check.ok) {
        return Response.json({ ok: false, error: check.error ?? "VK не принял токен." }, { status: 400 });
      }
      await setIntegrationSetting(VK_ACCESS_TOKEN_KEY, token);
      if (check.label) await setIntegrationSetting(VK_ACCOUNT_LABEL_KEY, check.label);
      summary.vk = { label: check.label };
    }

    if (body.channel && typeof body.channel.clientId === "string" && typeof body.channel.channelId === "string") {
      const clientId = body.channel.clientId.trim();
      const channelReference = body.channel.channelId.trim();
      const title = typeof body.channel.title === "string" ? body.channel.title.trim() : "";
      const platform = body.channel.platform === "vk" ? "vk" : "telegram";

      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) {
        return Response.json({ ok: false, error: "Клиент не найден." }, { status: 404 });
      }

      let canonicalChannelId = channelReference;
      let resolvedTitle = title;

      if (platform === "vk") {
        const vkToken = await getIntegrationSetting(VK_ACCESS_TOKEN_KEY);
        if (!vkToken) {
          return Response.json({ ok: false, error: "Сначала подключите VK." }, { status: 400 });
        }
        const check = await verifyVkGroup(vkToken, channelReference);
        if (!check.ok || !check.groupId) {
          return Response.json({ ok: false, error: check.error ?? "VK-сообщество не найдено." }, { status: 400 });
        }
        canonicalChannelId = String(check.groupId);
        resolvedTitle = title || check.title || "";
      } else {
        const token = await getTelegramBotToken();
        if (!token) {
          return Response.json({ ok: false, error: "Сначала подключите Telegram-бота." }, { status: 400 });
        }
        const check = await verifyTelegramChannel(token, channelReference);
        if (!check.ok) {
          return Response.json({ ok: false, error: check.error ?? "Бот не видит канал." }, { status: 400 });
        }
        resolvedTitle = title || check.chat?.title || "";
      }

      const existing = await prisma.clientChannel.findFirst({
        where: { clientId, platform, channelId: canonicalChannelId },
        select: { id: true },
      });

      const channel = existing
        ? await prisma.clientChannel.update({
            where: { id: existing.id },
            data: { status: "active", title: resolvedTitle || null },
          })
        : await prisma.clientChannel.create({
            data: { clientId, platform, channelId: canonicalChannelId, title: resolvedTitle || null },
          });

      summary.channel = { id: channel.id, platform: channel.platform, channelId: channel.channelId, title: channel.title };
    }

    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("telegram setup POST failed", error);
    return Response.json({ ok: false, error: "Не удалось сохранить настройки." }, { status: 500 });
  }
}
