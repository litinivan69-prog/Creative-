import { randomUUID } from "node:crypto";

export const VK_OAUTH_STATE_COOKIE = "ribes_vk_oauth_state";
export const VK_OAUTH_GROUP_COOKIE = "ribes_vk_oauth_group";
export const VK_OAUTH_ONBOARDING_COOKIE = "ribes_vk_oauth_onboarding";
export const VK_OAUTH_GROUP_ID_COOKIE = "ribes_vk_oauth_group_id";
export const VK_OAUTH_VERIFIER_COOKIE = "ribes_vk_oauth_verifier";

export type VkOauthCredential = {
  accessToken: string;
  refreshToken?: string;
  deviceId?: string;
  expiresAt?: number;
};

export function parseVkOauthCredential(value?: string | null): VkOauthCredential | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VkOauthCredential>;
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken.trim()) return null;
    return {
      accessToken: parsed.accessToken.trim(),
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken.trim() || undefined : undefined,
      deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId.trim() || undefined : undefined,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
    };
  } catch {
    // Existing community and legacy user tokens were stored as plain strings.
    return { accessToken: raw };
  }
}

export function serializeVkOauthCredential(credential: VkOauthCredential) {
  return JSON.stringify(credential);
}

export function isVkOauthConfigured() {
  return Boolean(process.env.VK_APP_ID?.trim() && process.env.VK_APP_SECRET?.trim() && process.env.VK_SERVICE_TOKEN?.trim());
}

export async function resolveVkCommunity(reference: string) {
  const candidate = reference.trim().replace(/^https?:\/\/(www\.)?vk\.(?:com|ru)\//i, "").replace(/^@/, "").replace(/\?.*$/, "").replace(/\/$/, "");
  const numeric = candidate.match(/^-?(\d+)$/) ?? candidate.match(/^(?:club|public)(\d+)$/i);
  if (numeric) return Number(numeric[1]);
  if (!candidate) return null;
  const body = new URLSearchParams({
    group_id: candidate,
    access_token: process.env.VK_SERVICE_TOKEN?.trim() || "",
    v: "5.199",
  });
  const response = await fetch("https://api.vk.com/method/groups.getById", { method: "POST", body, signal: AbortSignal.timeout(15000) });
  const data = await response.json() as { response?: { groups?: Array<{ id?: number }> } | Array<{ id?: number }>; error?: unknown };
  const groups = Array.isArray(data.response) ? data.response : data.response?.groups ?? [];
  return groups[0]?.id || null;
}

export function publicAppUrl(origin?: string) {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || origin || "").replace(/\/$/, "");
}

export function vkOauthCallbackUrl(origin?: string) {
  return `${publicAppUrl(origin)}/api/integrations/vk/callback`;
}

export async function exchangeVkOauthCode(code: string, redirectUri: string, deviceId: string, codeVerifier: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.VK_APP_ID?.trim() || "",
    redirect_uri: redirectUri,
    device_id: deviceId,
    code_verifier: codeVerifier,
    code,
  });
  const response = await fetch("https://id.vk.ru/oauth2/auth", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "VK не выдал доступ к публикации.");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    deviceId,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 3600) * 1000,
  } satisfies VkOauthCredential;
}

export async function refreshVkOauthCredential(credential: VkOauthCredential) {
  if (!credential.refreshToken || !credential.deviceId) return credential;
  if (credential.expiresAt && credential.expiresAt > Date.now() + 5 * 60 * 1000) return credential;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: credential.refreshToken,
    client_id: process.env.VK_APP_ID?.trim() || "",
    device_id: credential.deviceId,
    state: randomUUID(),
  });
  const response = await fetch("https://id.vk.ru/oauth2/auth", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.error_description || data.error || "VK попросил подключить сообщество заново.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    deviceId: credential.deviceId,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 3600) * 1000,
  } satisfies VkOauthCredential;
}
