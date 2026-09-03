export const VK_OAUTH_STATE_COOKIE = "ribes_vk_oauth_state";
export const VK_OAUTH_GROUP_COOKIE = "ribes_vk_oauth_group";
export const VK_OAUTH_ONBOARDING_COOKIE = "ribes_vk_oauth_onboarding";

export function isVkOauthConfigured() {
  return Boolean(process.env.VK_APP_ID?.trim() && process.env.VK_APP_SECRET?.trim());
}

export function vkOauthCallbackUrl(origin?: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || origin || "";
  return `${base.replace(/\/$/, "")}/api/integrations/vk/callback`;
}

export async function exchangeVkOauthCode(code: string, redirectUri: string) {
  const query = new URLSearchParams({
    client_id: process.env.VK_APP_ID?.trim() || "",
    client_secret: process.env.VK_APP_SECRET?.trim() || "",
    redirect_uri: redirectUri,
    code,
  });
  const response = await fetch(`https://oauth.vk.com/access_token?${query}`, { signal: AbortSignal.timeout(30000) });
  const data = await response.json() as { access_token?: string; user_id?: number; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "VK не выдал доступ к сообществу.");
  return { accessToken: data.access_token, userId: data.user_id };
}
