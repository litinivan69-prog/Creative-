import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVkOauthConfigured, VK_OAUTH_GROUP_COOKIE, VK_OAUTH_ONBOARDING_COOKIE, VK_OAUTH_STATE_COOKIE, vkOauthCallbackUrl } from "@/lib/vk-oauth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/sign-in?callbackUrl=/app/channels", request.url));
  const current = new URL(request.url);
  const group = current.searchParams.get("reference")?.trim() || "";
  const onboarding = current.searchParams.get("onboarding") === "1";
  if (!group) return NextResponse.redirect(new URL(`/app/channels?error=${encodeURIComponent("Укажите ссылку на сообщество VK.")}`, request.url));
  if (!isVkOauthConfigured()) return NextResponse.redirect(new URL(`/app/channels?error=${encodeURIComponent("Вход через VK ещё не включён владельцем Ribes.")}`, request.url));

  const state = randomBytes(24).toString("base64url");
  const redirectUri = vkOauthCallbackUrl(current.origin);
  const authorize = new URL("https://oauth.vk.com/authorize");
  authorize.search = new URLSearchParams({
    client_id: process.env.VK_APP_ID!.trim(),
    display: "page",
    redirect_uri: redirectUri,
    scope: "wall,photos,groups,offline",
    response_type: "code",
    v: "5.199",
    state,
  }).toString();

  const response = NextResponse.redirect(authorize);
  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 10 * 60 };
  response.cookies.set(VK_OAUTH_STATE_COOKIE, state, cookie);
  response.cookies.set(VK_OAUTH_GROUP_COOKIE, group, cookie);
  response.cookies.set(VK_OAUTH_ONBOARDING_COOKIE, onboarding ? "1" : "0", cookie);
  return response;
}
