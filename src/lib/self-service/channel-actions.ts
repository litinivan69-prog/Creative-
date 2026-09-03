"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { decryptChannelCredential, encryptChannelCredential } from "@/lib/channel-credentials";
import { prisma } from "@/lib/prisma";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import {
  getIntegrationSetting,
  getTelegramBotToken,
  verifyTelegramBotToken,
  verifyTelegramChannel,
} from "@/lib/telegram";
import { publishScheduledPublication } from "@/lib/telegram-publish";
import { VK_ACCESS_TOKEN_KEY, verifyVkGroup, verifyVkToken } from "@/lib/vk";
import { connectVcAccount, verifyVcCredential } from "@/lib/vc";

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

function settingsRedirect(params: { notice?: string; error?: string; fromBrief?: boolean }): never {
  const query = new URLSearchParams();
  if (params.notice) query.set("notice", params.notice);
  if (params.error) query.set("error", params.error);
  if (params.fromBrief) query.set("from", "brief");
  redirect(`/app/channels?${query.toString()}`);
}

async function currentMembership() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  return prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true },
  });
}

export async function connectSelfServiceSocialChannel(formData: FormData) {
  const membership = await currentMembership();
  if (!membership) redirect("/sign-in?callbackUrl=/app/channels");

  const requestedPlatform = String(formData.get("platform") ?? "");
  const platform = requestedPlatform === "vk" ? "vk" : requestedPlatform === "vcru" ? "vcru" : "telegram";
  const reference = String(formData.get("reference") ?? "").trim();
  const suppliedToken = String(formData.get("token") ?? "").trim();
  const vcEmail = String(formData.get("vcEmail") ?? "").trim();
  const vcPassword = String(formData.get("vcPassword") ?? "");
  const autopublishEnabled = formData.get("autopublishEnabled") === "on";
  const fromBrief = formData.get("onboarding") === "1";
  function connectRedirect(params: { notice?: string; error?: string }): never {
    return settingsRedirect({ ...params, fromBrief });
  }
  if (!reference && platform !== "vcru") connectRedirect({ error: platform === "vk" ? "Укажите ссылку на сообщество VK." : "Укажите адрес Telegram-канала." });

  const existing = await prisma.clientChannel.findFirst({
    where: { clientId: membership.clientId, platform },
    orderBy: { createdAt: "asc" },
  });

  let channelId = reference;
  let title = platform === "vk" ? "VK" : platform === "vcru" ? "VC.ru" : "Telegram";
  let credentialHint = existing?.credentialHint ?? null;
  let credentialEncrypted = existing?.credentialEncrypted ?? null;

  if (platform === "vcru") {
    const savedCredential = decryptChannelCredential(existing?.credentialEncrypted);
    const requestedAuthorId = reference ? Number(reference) : undefined;
    if (reference && (!Number.isInteger(requestedAuthorId) || (requestedAuthorId ?? 0) <= 0)) {
      connectRedirect({ error: "Проверьте номер блога VC.ru или оставьте поле пустым." });
    }
    if (vcEmail || vcPassword) {
      if (!vcEmail || !vcPassword) connectRedirect({ error: "Введите почту и пароль от VC.ru." });
      const account = await connectVcAccount(vcEmail, vcPassword, requestedAuthorId);
      if (!account.ok) connectRedirect({ error: account.error });
      channelId = String(account.authorId);
      title = account.title;
      credentialHint = account.accountLabel;
      credentialEncrypted = encryptChannelCredential(account.credential);
    } else {
      if (!savedCredential || !existing?.channelId) connectRedirect({ error: "Введите почту и пароль от VC.ru для первого подключения." });
      const account = await verifyVcCredential(savedCredential, requestedAuthorId ?? Number(existing.channelId));
      if (!account.ok) connectRedirect({ error: account.error });
      channelId = String(account.authorId);
      title = account.title;
      credentialEncrypted = encryptChannelCredential(account.credential);
    }
  } else if (platform === "telegram") {
    const token = suppliedToken || decryptChannelCredential(existing?.credentialEncrypted) || await getTelegramBotToken();
    if (!token) connectRedirect({ error: "Нужен токен Telegram-бота. Получите его у @BotFather и вставьте один раз." });
    if (suppliedToken) {
      const bot = await verifyTelegramBotToken(token);
      if (!bot.ok) connectRedirect({ error: bot.error ?? "Telegram не принял токен бота." });
      credentialHint = bot.username ? `@${bot.username}` : "Telegram-бот";
      credentialEncrypted = encryptChannelCredential(token);
    }
    const channel = await verifyTelegramChannel(token, reference);
    const chat = channel.chat;
    if (!channel.ok || !chat) connectRedirect({ error: channel.error ?? "Бот не видит Telegram-канал." });
    channelId = chat.username ? `@${chat.username}` : String(chat.id);
    title = chat.title || "Telegram";
  } else {
    const token = suppliedToken || decryptChannelCredential(existing?.credentialEncrypted) || await getIntegrationSetting(VK_ACCESS_TOKEN_KEY);
    if (!token) connectRedirect({ error: "Нужен токен VK с доступом к сообществу." });
    if (suppliedToken) {
      const account = await verifyVkToken(token);
      if (!account.ok) connectRedirect({ error: account.error ?? "VK не принял токен." });
      credentialHint = account.label || "VK";
      credentialEncrypted = encryptChannelCredential(token);
    }
    const group = await verifyVkGroup(token, reference);
    if (!group.ok || !group.groupId) connectRedirect({ error: group.error ?? "Сообщество VK не найдено." });
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
  connectRedirect({ notice: `${title} подключён. Соединение проверено.` });
}

export async function disconnectSelfServiceSocialChannel(formData: FormData) {
  const membership = await currentMembership();
  if (!membership) redirect("/sign-in?callbackUrl=/app/channels");
  const channelId = String(formData.get("channelRecordId") ?? "").trim();
  const fromBrief = formData.get("onboarding") === "1";
  if (!channelId) settingsRedirect({ error: "Подключение не найдено.", fromBrief });

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
  settingsRedirect({ notice: "Площадка отключена.", fromBrief });
}

export async function completeSelfServiceChannelOnboarding() {
  const membership = await currentMembership();
  if (!membership) redirect("/sign-in?callbackUrl=/app/channels?from=brief");

  await prisma.client.update({
    where: { id: membership.clientId },
    data: { onboardingCompletedAt: new Date() },
  });

  revalidatePath("/app");
  revalidatePath("/app/channels");
  redirect("/app/month?notice=channels_saved");
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

  const combinedCarousel = /vk|вконтакт/i.test(item.platformName) && /telegram|телеграм|\btg\b/i.test(item.platformName);
  const targetPlatforms: Array<"vk" | "telegram" | "vcru"> = combinedCarousel
    ? ["vk", "telegram"]
    : /vc\.ru|виси/i.test(item.platformName)
      ? ["vcru"]
      : /vk|вконтакт/i.test(item.platformName)
        ? ["vk"]
        : /telegram|телеграм|\btg\b/i.test(item.platformName)
          ? ["telegram"]
          : [];
  if (!targetPlatforms.length) redirect(`/app/month/${encodeURIComponent(itemId)}?error=manual_export_only`);

  const outcome = await publishScheduledPublication(publication.id, { platforms: targetPlatforms });
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
    where: await selfServiceMembershipWhere(email),
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
