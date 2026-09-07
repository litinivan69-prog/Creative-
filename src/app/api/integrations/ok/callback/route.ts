import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { encryptChannelCredential } from "@/lib/channel-credentials";
import { resolveOkGroup } from "@/lib/ok";
import { exchangeOkOauthCode, isOkOauthConfigured, OK_OAUTH_GROUP_COOKIE, OK_OAUTH_ONBOARDING_COOKIE, OK_OAUTH_STATE_COOKIE, okOauthCallbackUrl } from "@/lib/ok-oauth";
import { prisma } from "@/lib/prisma";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { publicAppUrl } from "@/lib/vk-oauth";

function finish(request: Request, params: { notice?: string; error?: string; onboarding?: boolean }) {
  const target = new URL("/app/channels", publicAppUrl(new URL(request.url).origin));
  if (params.notice) target.searchParams.set("notice", params.notice);
  if (params.error) target.searchParams.set("error", params.error);
  if (params.onboarding) target.searchParams.set("from", "brief");
  const response = NextResponse.redirect(target);
  [OK_OAUTH_STATE_COOKIE, OK_OAUTH_GROUP_COOKIE, OK_OAUTH_ONBOARDING_COOKIE].forEach((name) => response.cookies.delete(name));
  return response;
}

export async function GET(request: Request) {
  const current = new URL(request.url);
  const cookieStore = await cookies();
  const onboarding = cookieStore.get(OK_OAUTH_ONBOARDING_COOKIE)?.value === "1";
  try {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) return NextResponse.redirect(new URL("/sign-in?callbackUrl=/app/channels", publicAppUrl(current.origin)));
    if (!isOkOauthConfigured()) throw new Error("Подключение Одноклассников ещё не настроено.");
    const state = current.searchParams.get("state") || "";
    const expectedState = cookieStore.get(OK_OAUTH_STATE_COOKIE)?.value || "";
    if (!state || state !== expectedState) throw new Error("Сессия подключения Одноклассников истекла. Начните ещё раз.");
    const code = current.searchParams.get("code");
    if (!code) throw new Error(current.searchParams.get("error_description") || "Одноклассники не подтвердили подключение.");
    const groupReference = cookieStore.get(OK_OAUTH_GROUP_COOKIE)?.value || "";
    const membership = await prisma.workspaceMembership.findFirst({ where: await selfServiceMembershipWhere(email), select: { clientId: true } });
    if (!membership) throw new Error("Сначала создайте бренд в Ribes.");

    const credential = await exchangeOkOauthCode(code, okOauthCallbackUrl(current.origin));
    const group = await resolveOkGroup(credential, groupReference);
    const data = {
      channelId: group.groupId,
      title: group.title,
      status: "active",
      credentialEncrypted: encryptChannelCredential(JSON.stringify(credential)),
      credentialHint: "Вход через Одноклассники",
      autopublishEnabled: true,
      connectedAt: new Date(),
    };
    const existing = await prisma.clientChannel.findFirst({ where: { clientId: membership.clientId, platform: "ok" }, select: { id: true } });
    if (existing) await prisma.clientChannel.update({ where: { id: existing.id }, data });
    else await prisma.clientChannel.create({ data: { clientId: membership.clientId, platform: "ok", ...data } });
    return finish(request, { notice: `${group.title} подключена.`, onboarding });
  } catch (error) {
    return finish(request, { error: error instanceof Error ? error.message : "Не удалось подключить Одноклассники.", onboarding });
  }
}
