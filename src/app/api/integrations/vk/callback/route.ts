import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { encryptChannelCredential } from "@/lib/channel-credentials";
import { prisma } from "@/lib/prisma";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { verifyVkGroup, verifyVkToken } from "@/lib/vk";
import { exchangeVkOauthCode, isVkOauthConfigured, publicAppUrl, VK_OAUTH_GROUP_COOKIE, VK_OAUTH_ONBOARDING_COOKIE, VK_OAUTH_STATE_COOKIE, vkOauthCallbackUrl } from "@/lib/vk-oauth";

function finish(request: Request, params: { notice?: string; error?: string; onboarding?: boolean }) {
  const target = new URL("/app/channels", publicAppUrl(new URL(request.url).origin));
  if (params.notice) target.searchParams.set("notice", params.notice);
  if (params.error) target.searchParams.set("error", params.error);
  if (params.onboarding) target.searchParams.set("from", "brief");
  const redirect = NextResponse.redirect(target);
  for (const name of [VK_OAUTH_STATE_COOKIE, VK_OAUTH_GROUP_COOKIE, VK_OAUTH_ONBOARDING_COOKIE]) redirect.cookies.delete(name);
  return redirect;
}

export async function GET(request: Request) {
  const current = new URL(request.url);
  const cookieStore = await cookies();
  const onboarding = cookieStore.get(VK_OAUTH_ONBOARDING_COOKIE)?.value === "1";
  try {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) return NextResponse.redirect(new URL("/sign-in?callbackUrl=/app/channels", publicAppUrl(current.origin)));
    if (!isVkOauthConfigured()) throw new Error("Вход через VK не настроен.");
    const state = current.searchParams.get("state") || "";
    const expectedState = cookieStore.get(VK_OAUTH_STATE_COOKIE)?.value || "";
    const groupReference = cookieStore.get(VK_OAUTH_GROUP_COOKIE)?.value || "";
    if (!state || !expectedState || state !== expectedState) throw new Error("Сессия подключения VK истекла. Начните ещё раз.");
    const code = current.searchParams.get("code");
    if (!code) throw new Error(current.searchParams.get("error_description") || "VK не подтвердил подключение.");

    const membership = await prisma.workspaceMembership.findFirst({ where: await selfServiceMembershipWhere(email), select: { clientId: true } });
    if (!membership) throw new Error("Сначала создайте бренд в Ribes.");
    const exchanged = await exchangeVkOauthCode(code, vkOauthCallbackUrl(current.origin));
    const [account, group] = await Promise.all([verifyVkToken(exchanged.accessToken), verifyVkGroup(exchanged.accessToken, groupReference)]);
    if (!account.ok) throw new Error(account.error || "VK не подтвердил доступ.");
    if (!group.ok || !group.groupId) throw new Error(group.error || "Сообщество VK не найдено.");

    const channelData = { channelId: String(group.groupId), title: group.title || "VK", status: "active", credentialEncrypted: encryptChannelCredential(exchanged.accessToken), credentialHint: account.label || "Вход через VK", autopublishEnabled: true, connectedAt: new Date() };
    const existing = await prisma.clientChannel.findFirst({ where: { clientId: membership.clientId, platform: "vk" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (existing) await prisma.clientChannel.update({ where: { id: existing.id }, data: channelData });
    else await prisma.clientChannel.create({ data: { clientId: membership.clientId, platform: "vk", ...channelData } });
    return finish(request, { notice: `${group.title || "Сообщество VK"} подключено.`, onboarding });
  } catch (error) {
    return finish(request, { error: error instanceof Error ? error.message : "Не удалось подключить VK.", onboarding });
  }
}
