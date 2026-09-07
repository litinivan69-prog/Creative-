import { fetchAndPrepareImage } from "@/lib/social-images";
import { okSignature, type OkCredential } from "@/lib/ok-oauth";

const OK_API_URL = "https://api.ok.ru/fb.do";
const OK_IMAGES_LIMIT = 10;

type OkApiError = { error_code?: number; error_msg?: string; error_data?: string };

async function okCall<T>(credential: OkCredential, method: string, input: Record<string, string> = {}): Promise<T> {
  const params: Record<string, string> = {
    application_key: process.env.OK_PUBLIC_KEY?.trim() || "",
    format: "json",
    method,
    ...input,
  };
  const body = new URLSearchParams({ ...params, access_token: credential.accessToken, sig: okSignature(params, credential.accessToken) });
  const response = await fetch(OK_API_URL, { method: "POST", body, signal: AbortSignal.timeout(30_000) });
  const data = await response.json() as T & OkApiError;
  if (!response.ok || data.error_code) throw new Error(data.error_msg || data.error_data || "Одноклассники отклонили запрос.");
  return data;
}

export async function resolveOkGroup(credential: OkCredential, reference: string) {
  const normalized = reference.trim();
  let groupId = normalized.match(/^\d+$/)?.[0] || normalized.match(/\/group\/(\d+)/i)?.[1] || "";
  if (!groupId) {
    const info = await okCall<{ objectIdStr?: string; objectId?: number; type?: string }>(credential, "url.getInfo", { url: normalized });
    if (!/group/i.test(info.type || "") || !(info.objectIdStr || info.objectId)) throw new Error("По этой ссылке не найдена группа Одноклассников.");
    groupId = String(info.objectIdStr || info.objectId);
  }
  const groups = await okCall<Array<{ uid?: string; name?: string }>>(credential, "group.getInfo", { uids: groupId, fields: "uid,name" });
  const group = groups[0];
  if (!group?.uid) throw new Error("Группа Одноклассников не найдена.");
  return { groupId: String(group.uid), title: group.name || "Одноклассники" };
}

async function uploadOkImages(credential: OkCredential, groupId: string, imageUrls: string[]) {
  const prepared = (await Promise.all(imageUrls.slice(0, OK_IMAGES_LIMIT).map(fetchAndPrepareImage)))
    .filter((image): image is Buffer => Boolean(image));
  if (!prepared.length) return [];

  const upload = await okCall<{ upload_url: string }>(credential, "photosV2.getUploadUrl", {
    gid: groupId,
    count: String(prepared.length),
  });
  const form = new FormData();
  prepared.forEach((image, index) => form.append(`pic${index + 1}`, new Blob([new Uint8Array(image)], { type: "image/jpeg" }), `visual-${index + 1}.jpg`));
  const response = await fetch(upload.upload_url, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  const data = await response.json() as { photos?: Record<string, { token?: string }> } & OkApiError;
  if (!response.ok || data.error_code) throw new Error(data.error_msg || "Одноклассники не приняли изображения.");
  return Object.values(data.photos || {}).map((photo) => photo.token).filter((token): token is string => Boolean(token));
}

export type OkPostResult = { ok: true; topicId: string; url: string; imagesSent: number } | { ok: false; error: string };

export async function sendOkPost(options: { credential: OkCredential; groupId: string; message: string; imageUrls?: string[] }): Promise<OkPostResult> {
  try {
    const imageTokens = await uploadOkImages(options.credential, options.groupId, options.imageUrls || []);
    const media: Array<Record<string, unknown>> = [{ type: "text", text: options.message.trim() }];
    if (imageTokens.length) media.push({ type: "photo", list: imageTokens.map((id) => ({ id })) });
    const topicId = await okCall<string>(options.credential, "mediatopic.post", {
      type: "GROUP_THEME",
      gid: options.groupId,
      attachment: JSON.stringify({ media, onBehalfOfGroup: "true" }),
    });
    return { ok: true, topicId: String(topicId), url: `https://ok.ru/group/${options.groupId}/topic/${topicId}`, imagesSent: imageTokens.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось опубликовать в Одноклассниках." };
  }
}
