"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
