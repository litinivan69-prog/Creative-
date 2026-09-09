import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVkOauthConfigured, publicAppUrl, resolveVkCommunity, VK_OAUTH_GROUP_COOKIE, VK_OAUTH_GROUP_ID_COOKIE, VK_OAUTH_ONBOARDING_COOKIE, VK_OAUTH_STATE_COOKIE, VK_OAUTH_VERIFIER_COOKIE, vkOauthCallbackUrl } from "@/lib/vk-oauth";

export async function GET(request: Request) {
  const publicBase = publicAppUrl(new URL(request.url).origin);
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/sign-in?callbackUrl=/app/channels", publicBase));
  const current = new URL(request.url);
  const group = current.searchParams.get("reference")?.trim() || "";
  const onboarding = current.searchParams.get("onboarding") === "1";
  if (!group) return NextResponse.redirect(new URL(`/app/channels?error=${encodeURIComponent("Укажите ссылку на сообщество VK.")}`, publicBase));
  if (!isVkOauthConfigured()) return NextResponse.redirect(new URL(`/app/channels?error=${encodeURIComponent("Вход через VK ещё не включён владельцем Ribes.")}`, publicBase));

  const groupId = await resolveVkCommunity(group);
  if (!groupId) return NextResponse.redirect(new URL(`/app/channels?error=${encodeURIComponent("Не удалось найти сообщество по этой ссылке. Проверьте адрес и попробуйте ещё раз.")}`, publicBase));

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = vkOauthCallbackUrl(current.origin);
  const authorize = new URL("https://id.vk.ru/authorize");
  authorize.search = new URLSearchParams({
    client_id: process.env.VK_APP_ID!.trim(),
    redirect_uri: redirectUri,
    scope: "wall photos groups offline",
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "s256",
    state,
  }).toString();

  const response = NextResponse.redirect(authorize);
  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 10 * 60 };
  response.cookies.set(VK_OAUTH_STATE_COOKIE, state, cookie);
  response.cookies.set(VK_OAUTH_GROUP_COOKIE, group, cookie);
  response.cookies.set(VK_OAUTH_GROUP_ID_COOKIE, String(groupId), cookie);
  response.cookies.set(VK_OAUTH_ONBOARDING_COOKIE, onboarding ? "1" : "0", cookie);
  response.cookies.set(VK_OAUTH_VERIFIER_COOKIE, verifier, cookie);
  return response;
}
