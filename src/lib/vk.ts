import { fetchAndPrepareImage } from "@/lib/social-images";

export const VK_ACCESS_TOKEN_KEY = "vk_access_token";
export const VK_ACCOUNT_LABEL_KEY = "vk_account_label";

const VK_API = "https://api.vk.com/method";
const VK_API_VERSION = "5.199";
const VK_ATTACHMENTS_LIMIT = 10;
const VK_TEXT_LIMIT = 15000;

type VkResult<T> = { ok: true; result: T } | { ok: false; error: string };

async function vkCall<T>(token: string, method: string, params: Record<string, string>): Promise<VkResult<T>> {
  try {
    const body = new URLSearchParams({ ...params, access_token: token, v: VK_API_VERSION });
    const response = await fetch(`${VK_API}/${method}`, { method: "POST", body });
    const data = (await response.json()) as { response?: T; error?: { error_msg?: string } };
    if (data.error || data.response === undefined) {
      return { ok: false, error: data.error?.error_msg || "VK API отклонил запрос." };
    }
    return { ok: true, result: data.response };
  } catch {
    return { ok: false, error: "VK API недоступен." };
  }
}

/** Verifies the agency VK token; works for both user and community tokens. */
export async function verifyVkToken(token: string): Promise<{ ok: boolean; label?: string; error?: string }> {
  const asUser = await vkCall<Array<{ first_name?: string; last_name?: string }>>(token, "users.get", {});
  if (asUser.ok && asUser.result[0]?.first_name) {
    const user = asUser.result[0];
    return { ok: true, label: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() };
  }

  const asGroup = await vkCall<{ groups?: Array<{ name?: string }> } | Array<{ name?: string }>>(
    token,
    "groups.getById",
    {},
  );
  if (asGroup.ok) {
    const groups = Array.isArray(asGroup.result) ? asGroup.result : asGroup.result.groups ?? [];
    if (groups[0]?.name) return { ok: true, label: groups[0].name };
  }

  return { ok: false, error: "VK не принял токен. Проверьте права: wall, photos, groups, offline." };
}

/** Resolves a group reference (@screen_name, URL, club123, -123 or 123) to a numeric group id. */
export async function verifyVkGroup(
  token: string,
  reference: string,
  lookupToken = token,
): Promise<{ ok: boolean; groupId?: number; title?: string; error?: string }> {
  let candidate = reference.trim();
  try {
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    const parsed = new URL(withProtocol);
    if (/^(?:www\.|m\.)?(?:vk\.com|vk\.ru)$/i.test(parsed.hostname)) {
      candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    }
  } catch {
    // Plain screen names and numeric IDs are handled below.
  }
  candidate = candidate
    .replace(/^https?:\/\/(?:www\.|m\.)?(?:vk\.com|vk\.ru)\//i, "")
    .split(/[/?#]/)[0]
    .replace(/^@/, "")
    .trim();

  if (!candidate) {
    return { ok: false, error: "Вставьте ссылку на сообщество VK целиком — Ribes сам определит его ID." };
  }

  let groupId: number | null = null;
  const numeric = candidate.match(/^-?(\d+)$/) ?? candidate.match(/^(?:club|public)(\d+)$/i);
  if (numeric) {
    groupId = Number(numeric[1]);
  } else {
    const resolved = await vkCall<{ type?: string; object_id?: number }>(lookupToken, "utils.resolveScreenName", {
      screen_name: candidate,
    });
    if (!resolved.ok || resolved.result?.type !== "group" || !resolved.result.object_id) {
      return { ok: false, error: "Не удалось распознать ссылку. Откройте главную страницу сообщества и скопируйте адрес из браузера." };
    }
    groupId = resolved.result.object_id;
  }

  const info = await vkCall<{ groups?: Array<{ id: number; name?: string }> } | Array<{ id: number; name?: string }>>(
    token,
    "groups.getById",
    { group_id: String(groupId) },
  );
  if (!info.ok) {
    return { ok: false, error: "VK не отдал сообщество. Проверьте, что токен имеет доступ к нему." };
  }
  const groups = Array.isArray(info.result) ? info.result : info.result.groups ?? [];
  const group = groups[0];
  if (!group?.id) {
    return { ok: false, error: "Сообщество не найдено." };
  }

  return { ok: true, groupId: group.id, title: group.name };
}

export type VkPostResult =
  | { ok: true; url: string; postId: number; imagesSent: number }
  | { ok: false; error: string };

export async function verifyVkMediaUpload(token: string, groupId: number) {
  const photo = await vkCall<{ upload_url: string }>(token, "photos.getWallUploadServer", { group_id: String(groupId) });
  if (photo.ok) return { ok: true as const, mode: "photo" as const };
  const document = await vkCall<{ upload_url: string }>(token, "docs.getWallUploadServer", { group_id: String(groupId) });
  if (document.ok) return { ok: true as const, mode: "document" as const };
  return {
    ok: false as const,
    error: "Для публикации визуалов включите у ключа сообщества право «Документы» и подключите его заново.",
  };
}

async function uploadVkWallDocument(token: string, groupId: number, buffer: Buffer, index: number) {
  const server = await vkCall<{ upload_url: string }>(token, "docs.getWallUploadServer", { group_id: String(groupId) });
  if (!server.ok) return { ok: false as const, error: server.error };
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), `visual-${index + 1}.jpg`);
    const response = await fetch(server.result.upload_url, { method: "POST", body: form });
    const uploaded = (await response.json()) as { file?: string; error?: string };
    if (!response.ok || !uploaded.file) return { ok: false as const, error: uploaded.error || "VK не принял файл." };
    const saved = await vkCall<{
      type?: string;
      doc?: { owner_id?: number; id?: number };
      graffiti?: { owner_id?: number; id?: number };
    }>(token, "docs.save", { file: uploaded.file, title: `Визуал ${index + 1}` });
    if (!saved.ok) return { ok: false as const, error: saved.error };
    const document = saved.result.doc ?? saved.result.graffiti;
    if (!document?.owner_id || !document.id) return { ok: false as const, error: "VK не вернул сохранённый визуал." };
    return { ok: true as const, attachment: `doc${document.owner_id}_${document.id}` };
  } catch {
    return { ok: false as const, error: "Соединение с сервером загрузки VK прервалось." };
  }
}

/**
 * Publishes a post to the community wall: uploads normalized visuals as wall
 * photos (up to 10), then wall.post with the FULL text (VK has no 1024 limit).
 */
export async function sendVkPost(options: {
  token: string;
  mediaToken?: string | null;
  groupId: number;
  message: string;
  imageUrls?: string[];
}): Promise<VkPostResult> {
  const mediaToken = options.mediaToken?.trim() || options.token;
  const message = options.message.trim().slice(0, VK_TEXT_LIMIT);
  const images = (options.imageUrls ?? []).filter((url) => /^https?:\/\//.test(url)).slice(0, VK_ATTACHMENTS_LIMIT);

  if (!message && images.length === 0) {
    return { ok: false, error: "У материала нет текста для публикации." };
  }

  const attachments: string[] = [];
  let visualError: string | null = null;
  for (const [index, url] of images.entries()) {
    const buffer = await fetchAndPrepareImage(url);
    if (!buffer) {
      visualError = "Ribes не смог подготовить изображение для VK. Попробуйте публикацию ещё раз.";
      break;
    }

    const uploadServer = await vkCall<{ upload_url: string }>(mediaToken, "photos.getWallUploadServer", {
      group_id: String(options.groupId),
    });
    if (!uploadServer.ok) {
      const document = await uploadVkWallDocument(mediaToken, options.groupId, buffer, index);
      if (document.ok) {
        attachments.push(document.attachment);
        continue;
      }
      visualError = document.error.includes("scope") || document.error.includes("Access denied")
        ? "У ключа сообщества нет права «Документы». Добавьте это право, подключите VK заново и повторите публикацию."
        : `VK не разрешил загрузить визуал: ${document.error}`;
      break;
    }

    try {
      const form = new FormData();
      form.append("photo", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "visual.jpg");
      const uploadResponse = await fetch(uploadServer.result.upload_url, { method: "POST", body: form });
      const uploaded = (await uploadResponse.json()) as { server?: number; photo?: string; hash?: string };
      if (!uploaded.photo || uploaded.photo === "[]" || !uploaded.hash) {
        visualError = "VK принял файл, но не создал фотографию. Попробуйте публикацию ещё раз.";
        break;
      }

      const saved = await vkCall<Array<{ owner_id: number; id: number }>>(mediaToken, "photos.saveWallPhoto", {
        group_id: String(options.groupId),
        photo: uploaded.photo,
        server: String(uploaded.server ?? ""),
        hash: uploaded.hash,
      });
      if (saved.ok && saved.result[0]) {
        attachments.push(`photo${saved.result[0].owner_id}_${saved.result[0].id}`);
      } else {
        visualError = saved.ok ? "VK не вернул сохранённую фотографию." : `VK не сохранил фотографию: ${saved.error}`;
        break;
      }
    } catch {
      visualError = "Во время загрузки изображения в VK оборвалось соединение. Попробуйте ещё раз.";
      break;
    }
  }

  if (images.length > 0 && (visualError || attachments.length !== images.length)) {
    return { ok: false, error: visualError || "Не все изображения удалось загрузить в VK. Пост не опубликован без полного комплекта визуалов." };
  }

  const post = await vkCall<{ post_id: number }>(options.token, "wall.post", {
    owner_id: String(-options.groupId),
    from_group: "1",
    message,
    ...(attachments.length > 0 ? { attachments: attachments.join(",") } : {}),
  });

  if (!post.ok) {
    return { ok: false, error: post.error };
  }

  return {
    ok: true,
    postId: post.result.post_id,
    url: `https://vk.com/wall-${options.groupId}_${post.result.post_id}`,
    imagesSent: attachments.length,
  };
}
