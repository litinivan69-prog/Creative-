"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { decryptChannelCredential, encryptChannelCredential } from "@/lib/channel-credentials";
import { prisma } from "@/lib/prisma";
import {
  getIntegrationSetting,
  getTelegramBotToken,
  verifyTelegramBotToken,
  verifyTelegramChannel,
} from "@/lib/telegram";
import { publishScheduledPublication } from "@/lib/telegram-publish";
import { VK_ACCESS_TOKEN_KEY, verifyVkGroup, verifyVkToken } from "@/lib/vk";

const platforms = ["vk", "telegram", "dzen", "vcru"] as const;

const platformTitles: Record<(typeof platforms)[number], string> = {
  vk: "VK",
  telegram: "Telegram",
  dzen: "Дзен",
  vcru: "VC.ru",
};

function cleanUrl(value: FormDataEntryValue | null) {
  const url = String(value ?? "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function settingsRedirect(params: { notice?: string; error?: string }): never {
  const query = new URLSearchParams();
  if (params.notice) query.set("notice", params.notice);
  if (params.error) query.set("error", params.error);
  redirect(`/app/channels?${query.toString()}`);
}

async function currentMembership() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  return prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    select: { clientId: true },
  });
}

export async function connectSelfServiceSocialChannel(formData: FormData) {
  const membership = await currentMembership();
  if (!membership) redirect("/sign-in?callbackUrl=/app/channels");

  const platform = String(formData.get("platform") ?? "") === "vk" ? "vk" : "telegram";
  const reference = String(formData.get("reference") ?? "").trim();
  const suppliedToken = String(formData.get("token") ?? "").trim();
  const autopublishEnabled = formData.get("autopublishEnabled") === "on";
  if (!reference) settingsRedirect({ error: platform === "vk" ? "Укажите ссылку на сообщество VK." : "Укажите адрес Telegram-канала." });

  const existing = await prisma.clientChannel.findFirst({
    where: { clientId: membership.clientId, platform },
    orderBy: { createdAt: "asc" },
  });

  let channelId = reference;
  let title = platform === "vk" ? "VK" : "Telegram";
  let credentialHint = existing?.credentialHint ?? null;
  let credentialEncrypted = existing?.credentialEncrypted ?? null;

  if (platform === "telegram") {
    const token = suppliedToken || decryptChannelCredential(existing?.credentialEncrypted) || await getTelegramBotToken();
    if (!token) settingsRedirect({ error: "Нужен токен Telegram-бота. Получите его у @BotFather и вставьте один раз." });
    if (suppliedToken) {
      const bot = await verifyTelegramBotToken(token);
      if (!bot.ok) settingsRedirect({ error: bot.error ?? "Telegram не принял токен бота." });
      credentialHint = bot.username ? `@${bot.username}` : "Telegram-бот";
      credentialEncrypted = encryptChannelCredential(token);
    }
    const channel = await verifyTelegramChannel(token, reference);
    const chat = channel.chat;
    if (!channel.ok || !chat) settingsRedirect({ error: channel.error ?? "Бот не видит Telegram-канал." });
    channelId = chat.username ? `@${chat.username}` : String(chat.id);
    title = chat.title || "Telegram";
  } else {
    const token = suppliedToken || decryptChannelCredential(existing?.credentialEncrypted) || await getIntegrationSetting(VK_ACCESS_TOKEN_KEY);
    if (!token) settingsRedirect({ error: "Нужен токен VK с доступом к сообществу." });
    if (suppliedToken) {
      const account = await verifyVkToken(token);
      if (!account.ok) settingsRedirect({ error: account.error ?? "VK не принял токен." });
      credentialHint = account.label || "VK";
      credentialEncrypted = encryptChannelCredential(token);
    }
    const group = await verifyVkGroup(token, reference);
    if (!group.ok || !group.groupId) settingsRedirect({ error: group.error ?? "Сообщество VK не найдено." });
    channelId = String(group.groupId);
    title = group.title || "VK";
  }

  const data = {
    channelId,
    title,
    status: "active",
    credentialEncrypted,
    credentialHint,
    autopublishEnabled,
    connectedAt: new Date(),
  };
  if (existing) {
    await prisma.clientChannel.update({ where: { id: existing.id }, data });
  } else {
    await prisma.clientChannel.create({ data: { clientId: membership.clientId, platform, ...data } });
  }

  revalidatePath("/app");
  revalidatePath("/app/channels");
  revalidatePath("/app/autoposting");
  settingsRedirect({ notice: `${title} подключён. Соединение проверено.` });
}

export async function disconnectSelfServiceSocialChannel(formData: FormData) {
  const membership = await currentMembership();
  if (!membership) redirect("/sign-in?callbackUrl=/app/channels");
  const channelId = String(formData.get("channelRecordId") ?? "").trim();
  if (!channelId) settingsRedirect({ error: "Подключение не найдено." });

  await prisma.clientChannel.updateMany({
    where: { id: channelId, clientId: membership.clientId },
    data: {
      status: "inactive",
      credentialEncrypted: null,
      credentialHint: null,
      autopublishEnabled: false,
      connectedAt: null,
    },
  });
  revalidatePath("/app");
  revalidatePath("/app/channels");
  revalidatePath("/app/autoposting");
  settingsRedirect({ notice: "Площадка отключена." });
}

export async function publishSelfServiceMaterialNow(formData: FormData) {
  const membership = await currentMembership();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!membership) redirect(`/sign-in?callbackUrl=/app/month/${encodeURIComponent(itemId)}`);

  const item = await prisma.plannedContentItem.findFirst({
    where: { id: itemId, monthlyPlan: { clientId: membership.clientId } },
    select: {
      platformName: true,
      contentDraft: { select: { status: true } },
      scheduledPublications: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  const publication = item?.scheduledPublications[0];
  if (!item || !publication) redirect(`/app/month/${encodeURIComponent(itemId)}?error=publication_missing`);
  if (!item.contentDraft || !["approved", "ready_to_schedule"].includes(item.contentDraft.status)) {
    redirect(`/app/month/${encodeURIComponent(itemId)}?error=confirm_first`);
  }

  const targetPlatform = /vk|вконтакт/i.test(item.platformName)
    ? "vk" as const
    : /telegram|телеграм|\btg\b/i.test(item.platformName)
      ? "telegram" as const
      : null;
  if (!targetPlatform) redirect(`/app/month/${encodeURIComponent(itemId)}?error=manual_export_only`);

  const outcome = await publishScheduledPublication(publication.id, { platforms: [targetPlatform] });
  revalidatePath("/app");
  revalidatePath("/app/month");
  revalidatePath(`/app/month/${itemId}`);
  revalidatePath("/app/results");
  if (!outcome.ok) redirect(`/app/month/${encodeURIComponent(itemId)}?error=${encodeURIComponent(outcome.error)}`);
  redirect(`/app/month/${itemId}?notice=${outcome.alreadyPublished ? "already_published" : "published"}`);
}

export async function saveSelfServiceChannels(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/channels");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    select: { clientId: true },
  });
  if (!membership) redirect("/start");

  const existing = await prisma.clientChannel.findMany({
    where: { clientId: membership.clientId, platform: { in: [...platforms] } },
    orderBy: { createdAt: "asc" },
  });

  await prisma.$transaction(
    platforms.map((platform) => {
      const requestedState = String(formData.get(`${platform}State`) ?? "skip");
      const url = cleanUrl(formData.get(`${platform}Url`));
      const state = requestedState === "active" && url ? "active" : requestedState === "to_create" ? "to_create" : "inactive";
      const channelId = state === "active" ? url : state === "to_create" ? "pending_setup" : "not_configured";
      const current = existing.find((channel) => channel.platform === platform);
      const data = {
        channelId,
        title: state === "to_create" ? `${platformTitles[platform]}: подготовить оформление` : platformTitles[platform],
        status: state,
      };

      return current
        ? prisma.clientChannel.update({ where: { id: current.id }, data })
        : prisma.clientChannel.create({ data: { clientId: membership.clientId, platform, ...data } });
    }),
  );

  redirect("/app/month?notice=channels_saved");
}
