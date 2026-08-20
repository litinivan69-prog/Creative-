import { fetchAndPrepareImage } from "@/lib/social-images";

const VC_API_BASE = "https://api.vc.ru/v1.9";
const USER_AGENT = "adaptive-presence-app/1.0 (server; node; ru; 1920x1080)";

type VcSubsite = { id?: number; name?: string; title?: string; url?: string };

async function vcRequest(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${VC_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-Device-Token": token,
      "User-Agent": USER_AGENT,
      ...init.headers,
    },
    signal: AbortSignal.timeout(30000),
  });
}

export async function verifyVcToken(token: string) {
  try {
    const response = await vcRequest("/user/me", token);
    const payload = await response.json().catch(() => null) as { result?: VcSubsite; message?: string } | null;
    const account = payload?.result;
    if (!response.ok || !account?.id) return { ok: false as const, error: payload?.message || "VC.ru не принял API-токен." };
    return { ok: true as const, accountId: account.id, label: account.name || account.title || `Блог #${account.id}` };
  } catch {
    return { ok: false as const, error: "Не удалось проверить подключение VC.ru." };
  }
}

export async function verifyVcSubsite(token: string, subsiteId: number) {
  try {
    const response = await vcRequest(`/subsite/${subsiteId}`, token);
    const payload = await response.json().catch(() => null) as { result?: VcSubsite; message?: string } | null;
    const subsite = payload?.result;
    if (!response.ok || !subsite?.id) return { ok: false as const, error: payload?.message || "Блог VC.ru не найден." };
    return { ok: true as const, subsiteId: subsite.id, title: subsite.name || subsite.title || `Блог #${subsite.id}` };
  } catch {
    return { ok: false as const, error: "Не удалось проверить блог VC.ru." };
  }
}

async function uploadVcImage(token: string, imageUrl: string) {
  const image = await fetchAndPrepareImage(imageUrl);
  if (!image) throw new Error("Не удалось подготовить изображение статьи.");

  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "article-image.jpg");
  const response = await vcRequest("/uploader/upload", token, { method: "POST", body: form });
  const payload = await response.json().catch(() => null) as { result?: Array<{ type?: string; data?: Record<string, unknown> }>; message?: string } | null;
  const attachment = payload?.result?.[0];
  if (!response.ok || !attachment?.data) throw new Error(payload?.message || "VC.ru не принял изображение.");
  return { type: attachment.type || "image", data: attachment.data };
}

export async function sendVcArticle(input: {
  token: string;
  subsiteId: number;
  title: string;
  body: string;
  imageUrls: string[];
}) {
  try {
    const attachments = [];
    for (const imageUrl of input.imageUrls.slice(0, 10)) {
      attachments.push(await uploadVcImage(input.token, imageUrl));
    }

    const form = new FormData();
    form.set("title", input.title.trim());
    form.set("text", input.body.trim());
    form.set("subsite_id", String(input.subsiteId));
    form.set("attachments", JSON.stringify(attachments));
    const response = await vcRequest("/entry/create", input.token, { method: "POST", body: form });
    const payload = await response.json().catch(() => null) as { result?: { id?: number; webviewUrl?: string }; message?: string } | null;
    const entry = payload?.result;
    if (!response.ok || !entry?.id) return { ok: false as const, error: payload?.message || "VC.ru не создал публикацию." };

    return {
      ok: true as const,
      entryId: entry.id,
      url: entry.webviewUrl || `https://vc.ru/${entry.id}`,
      imagesSent: attachments.length,
    };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось опубликовать статью в VC.ru." };
  }
}
