import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOkOauthConfigured, OK_OAUTH_GROUP_COOKIE, OK_OAUTH_ONBOARDING_COOKIE, OK_OAUTH_STATE_COOKIE, okOauthCallbackUrl } from "@/lib/ok-oauth";
import { publicAppUrl } from "@/lib/vk-oauth";

export async function GET(request: Request) {
  const current = new URL(request.url);
  const base = publicAppUrl(current.origin);
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/sign-in?callbackUrl=/app/channels", base));
  const group = current.searchParams.get("reference")?.trim() || "";
  const onboarding = current.searchParams.get("onboarding") === "1";
  if (!group) return NextResponse.redirect(new URL(`/app/channels?error=${encodeURIComponent("Укажите ссылку на группу Одноклассников.")}`, base));
  if (!isOkOauthConfigured()) return NextResponse.redirect(new URL(`/app/channels?error=${encodeURIComponent("Подключение Одноклассников ожидает одобрения приложения.")}`, base));

  const state = randomBytes(24).toString("base64url");
  const authorize = new URL("https://connect.ok.ru/oauth/authorize");
  authorize.search = new URLSearchParams({
    client_id: process.env.OK_APP_ID!.trim(),
    scope: "VALUABLE_ACCESS;LONG_ACCESS_TOKEN;PHOTO_CONTENT;GROUP_CONTENT",
    response_type: "code",
    redirect_uri: okOauthCallbackUrl(current.origin),
    layout: "w",
    state,
  }).toString();

  const response = NextResponse.redirect(authorize);
  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 10 * 60 };
  response.cookies.set(OK_OAUTH_STATE_COOKIE, state, cookie);
  response.cookies.set(OK_OAUTH_GROUP_COOKIE, group, cookie);
  response.cookies.set(OK_OAUTH_ONBOARDING_COOKIE, onboarding ? "1" : "0", cookie);
  return response;
}
