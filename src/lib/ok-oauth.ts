import { createHash } from "node:crypto";

export const OK_OAUTH_STATE_COOKIE = "ribes_ok_oauth_state";
export const OK_OAUTH_GROUP_COOKIE = "ribes_ok_oauth_group";
export const OK_OAUTH_ONBOARDING_COOKIE = "ribes_ok_oauth_onboarding";

export type OkCredential = {
  accessToken: string;
  refreshToken?: string;
};

export function isOkOauthConfigured() {
  return Boolean(
    process.env.OK_APP_ID?.trim()
      && process.env.OK_PUBLIC_KEY?.trim()
      && process.env.OK_SECRET_KEY?.trim(),
  );
}

export function okOauthCallbackUrl(origin?: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.trim() || origin || "").replace(/\/$/, "");
  return `${base}/api/integrations/ok/callback`;
}

export async function exchangeOkOauthCode(code: string, redirectUri: string): Promise<OkCredential> {
  const body = new URLSearchParams({
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    client_id: process.env.OK_APP_ID?.trim() || "",
    client_secret: process.env.OK_SECRET_KEY?.trim() || "",
  });
  const response = await fetch("https://api.ok.ru/oauth/token.do", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json() as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Одноклассники не выдали доступ к группе.");
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export function parseOkCredential(value: string | null): OkCredential | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OkCredential>;
    return parsed.accessToken ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken } : null;
  } catch {
    return { accessToken: value };
  }
}

export function okSignature(params: Record<string, string>, accessToken: string) {
  const applicationSecret = process.env.OK_SECRET_KEY?.trim();
  if (!applicationSecret) throw new Error("Подключение Одноклассников не настроено.");
  const sessionSecret = createHash("md5").update(`${accessToken}${applicationSecret}`).digest("hex");
  const source = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("");
  return createHash("md5").update(`${source}${sessionSecret}`).digest("hex");
}
