export const VK_OAUTH_STATE_COOKIE = "ribes_vk_oauth_state";
export const VK_OAUTH_GROUP_COOKIE = "ribes_vk_oauth_group";
export const VK_OAUTH_ONBOARDING_COOKIE = "ribes_vk_oauth_onboarding";
export const VK_OAUTH_GROUP_ID_COOKIE = "ribes_vk_oauth_group_id";

export function isVkOauthConfigured() {
  return Boolean(process.env.VK_APP_ID?.trim() && process.env.VK_APP_SECRET?.trim() && process.env.VK_SERVICE_TOKEN?.trim());
}

export async function resolveVkCommunity(reference: string) {
  const candidate = reference.trim().replace(/^https?:\/\/(www\.)?vk\.(?:com|ru)\//i, "").replace(/^@/, "").replace(/\?.*$/, "").replace(/\/$/, "");
  const numeric = candidate.match(/^-?(\d+)$/) ?? candidate.match(/^(?:club|public)(\d+)$/i);
  if (numeric) return Number(numeric[1]);
  if (!candidate) return null;
  const body = new URLSearchParams({
    screen_name: candidate,
    access_token: process.env.VK_SERVICE_TOKEN?.trim() || "",
    v: "5.199",
  });
  const response = await fetch("https://api.vk.com/method/utils.resolveScreenName", { method: "POST", body, signal: AbortSignal.timeout(15000) });
  const data = await response.json() as { response?: { type?: string; object_id?: number }; error?: unknown };
  return data.response?.type === "group" && data.response.object_id ? data.response.object_id : null;
}

export function publicAppUrl(origin?: string) {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || origin || "").replace(/\/$/, "");
}

export function vkOauthCallbackUrl(origin?: string) {
  return `${publicAppUrl(origin)}/api/integrations/vk/callback`;
}

export async function exchangeVkOauthCode(code: string, redirectUri: string, groupId: number) {
  const query = new URLSearchParams({
    client_id: process.env.VK_APP_ID?.trim() || "",
    client_secret: process.env.VK_APP_SECRET?.trim() || "",
    redirect_uri: redirectUri,
    code,
  });
  const response = await fetch(`https://oauth.vk.com/access_token?${query}`, { signal: AbortSignal.timeout(30000) });
  const data = await response.json() as {
    access_token?: string;
    groups?: Array<{ group_id?: number; access_token?: string }>;
    error?: string;
    error_description?: string;
  } & Record<string, unknown>;
  const keyedToken = data[`access_token_${groupId}`];
  const accessToken = data.groups?.find((group) => group.group_id === groupId)?.access_token
    || (typeof keyedToken === "string" ? keyedToken : undefined)
    || data.access_token;
  if (!response.ok || !accessToken) throw new Error(data.error_description || data.error || "VK не выдал доступ к сообществу.");
  return { accessToken };
}
