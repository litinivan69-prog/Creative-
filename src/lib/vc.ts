import { fetchAndPrepareImage } from "@/lib/social-images";

const VC_AUTH_BASE = "https://api.vc.ru/v3.4/auth";
const VC_EDITOR_BASE = "https://api.vc.ru/v2.1";
const VC_UPLOAD_BASE = "https://upload.vc.ru/v2.8";
const USER_AGENT = "ribes-app/1.0 (server; node; ru; 1920x1080)";

export type VcSession = {
  accessToken: string;
  refreshToken: string;
  accessExpTimestamp?: number;
  refreshExpTimestamp?: number;
};

type VcAuthor = { value?: number; label?: string; image?: string; badgeId?: string | null };
type VcApiEntry = {
  id?: number;
  user_id?: number;
  subsite_id?: number;
  [key: string]: unknown;
};
type VcEditorData = {
  entry?: VcApiEntry;
  editor?: { authors?: VcAuthor[]; owners?: VcAuthor[] };
};
type VcApiEnvelope<T> = {
  message?: string;
  result?: T;
  data?: T;
  code?: number;
  error?: { code?: number; info?: unknown };
};
type VcAttachment = { type: string; data: Record<string, unknown> };

function vcError(payload: VcApiEnvelope<unknown> | null, fallback: string) {
  if (payload?.code === 104) return "VC.ru не принял почту или пароль.";
  if (payload?.code === 111) return "Проверьте адрес почты VC.ru.";
  return payload?.message?.trim() || fallback;
}

async function readEnvelope<T>(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as VcApiEnvelope<T> | null;
  if (!response.ok || payload?.error || (payload?.code && payload.code !== 200)) {
    throw new Error(vcError(payload, fallback));
  }
  return (payload?.data ?? payload?.result) as T;
}

function authHeaders(accessToken: string) {
  return { JWTAuthorization: `Bearer ${accessToken}`, "User-Agent": USER_AGENT };
}

export function serializeVcSession(session: VcSession) {
  return JSON.stringify({ version: 2, ...session });
}

export function parseVcSession(credential: string): VcSession | null {
  try {
    const parsed = JSON.parse(credential) as Partial<VcSession>;
    if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      accessExpTimestamp: parsed.accessExpTimestamp,
      refreshExpTimestamp: parsed.refreshExpTimestamp,
    };
  } catch {
    return null;
  }
}

export async function createVcSession(email: string, password: string) {
  try {
    const form = new URLSearchParams({ email: email.trim(), password });
    const response = await fetch(`${VC_AUTH_BASE}/email/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const session = await readEnvelope<VcSession>(response, "Не удалось войти в VC.ru.");
    if (!session?.accessToken || !session?.refreshToken) {
      return { ok: false as const, error: "VC.ru не вернул доступ к публикациям." };
    }
    return { ok: true as const, session };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось войти в VC.ru." };
  }
}

async function refreshVcSession(session: VcSession) {
  const form = new URLSearchParams({ token: session.refreshToken });
  const response = await fetch(`${VC_AUTH_BASE}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  return readEnvelope<VcSession>(response, "Подключение VC.ru истекло. Подключите площадку ещё раз.");
}

async function activeVcSession(credential: string) {
  const stored = parseVcSession(credential);
  if (!stored) {
    return { session: { accessToken: credential, refreshToken: "" } satisfies VcSession, credential };
  }
  const now = Math.floor(Date.now() / 1000);
  if (!stored.accessExpTimestamp || stored.accessExpTimestamp > now + 60) {
    return { session: stored, credential };
  }
  const refreshed = await refreshVcSession(stored);
  return { session: refreshed, credential: serializeVcSession(refreshed) };
}

async function vcEditorRequest<T>(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`${VC_EDITOR_BASE}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { ...authHeaders(accessToken), ...init.headers },
    signal: AbortSignal.timeout(30000),
  });
  return readEnvelope<T>(response, "VC.ru временно не отвечает.");
}

async function loadVcEditor(accessToken: string) {
  return vcEditorRequest<VcEditorData>("editor/0", accessToken);
}

function editorAuthors(data: VcEditorData) {
  return (data?.editor?.authors ?? []).filter((author) => Number.isInteger(author.value) && (author.value ?? 0) > 0);
}

async function loadVcAuthors(accessToken: string) {
  return editorAuthors(await loadVcEditor(accessToken));
}

export async function connectVcAccount(email: string, password: string, requestedAuthorId?: number) {
  const login = await createVcSession(email, password);
  if (!login.ok) return login;
  try {
    const authors = await loadVcAuthors(login.session.accessToken);
    const author = requestedAuthorId ? authors.find((item) => item.value === requestedAuthorId) : authors[0];
    if (!author?.value) return { ok: false as const, error: "В аккаунте VC.ru не найден блог для публикации." };
    return {
      ok: true as const,
      credential: serializeVcSession(login.session),
      authorId: author.value,
      title: author.label?.trim() || `Блог VC.ru #${author.value}`,
      accountLabel: email.trim(),
    };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось проверить блог VC.ru." };
  }
}

export async function verifyVcCredential(credential: string, authorId: number) {
  try {
    const active = await activeVcSession(credential);
    const authors = await loadVcAuthors(active.session.accessToken);
    const author = authors.find((item) => item.value === authorId);
    if (!author?.value) return { ok: false as const, error: "У подключения больше нет доступа к выбранному блогу VC.ru." };
    return {
      ok: true as const,
      credential: active.credential,
      authorId: author.value,
      title: author.label?.trim() || `Блог VC.ru #${author.value}`,
    };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось проверить подключение VC.ru." };
  }
}

async function uploadVcImage(accessToken: string, imageUrl: string) {
  const image = await fetchAndPrepareImage(imageUrl);
  if (!image) throw new Error("Не удалось подготовить изображение статьи.");
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "article-image.jpg");
  const response = await fetch(`${VC_UPLOAD_BASE}/uploader/upload`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: form,
    signal: AbortSignal.timeout(45000),
  });
  const attachments = await readEnvelope<VcAttachment[]>(response, "VC.ru не принял изображение.");
  const attachment = attachments?.[0];
  if (!attachment?.data) throw new Error("VC.ru не принял изображение.");
  return attachment;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/__([^_]+)__/g, "<b>$1</b>")
    .replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="nofollow noreferrer noopener">$1</a>');
}

function articleBlocks(body: string, attachments: VcAttachment[]) {
  const blocks: Array<Record<string, unknown>> = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  let attachmentIndex = 0;
  const pushParagraph = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) blocks.push({ type: "text", cover: false, hidden: false, anchor: "", data: { text: `<p>${inlineMarkdown(text)}</p>` } });
  };
  const pushList = () => {
    if (!list.length) return;
    blocks.push({ type: "list", cover: false, hidden: false, anchor: "", data: { style: "unordered", items: list.map(inlineMarkdown) } });
    list = [];
  };
  const pushImage = () => {
    const image = attachments[attachmentIndex++];
    if (!image) return;
    blocks.push({ type: "media", cover: attachmentIndex === 1, hidden: false, anchor: "", data: { items: [{ title: "", image }] } });
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { pushParagraph(); pushList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      pushParagraph(); pushList();
      blocks.push({ type: "header", cover: false, hidden: false, anchor: "", data: { style: heading[1].length >= 3 ? "h3" : "h2", text: inlineMarkdown(heading[2]) } });
      if (attachmentIndex < attachments.length && blocks.length > 2) pushImage();
      continue;
    }
    const listItem = line.match(/^[-•]\s+(.+)$/);
    if (listItem) { pushParagraph(); list.push(listItem[1]); continue; }
    if (/^!\[[^\]]*]\([^)]+\)$/.test(line)) { pushParagraph(); pushList(); pushImage(); continue; }
    paragraph.push(line.replace(/^\d+[.)]\s+/, ""));
  }
  pushParagraph(); pushList();
  while (attachmentIndex < attachments.length) pushImage();
  return blocks;
}

export async function sendVcArticle(input: {
  credential: string;
  authorId: number;
  title: string;
  body: string;
  imageUrls: string[];
}) {
  let phase = "проверка подключения";
  try {
    const active = await activeVcSession(input.credential);
    phase = "проверка редактора";
    const editorData = await loadVcEditor(active.session.accessToken);
    const authors = editorAuthors(editorData);
    const author = authors.find((item) => item.value === input.authorId)
      ?? authors.find((item) => item.value === editorData.entry?.user_id)
      ?? authors[0];
    if (!author?.value) throw new Error("В аккаунте не найден блог для публикации.");

    const owners = (editorData.editor?.owners ?? [])
      .filter((owner) => Number.isInteger(owner.value) && (owner.value ?? 0) > 0);
    const defaultSubsiteId = Number(editorData.entry?.subsite_id) || 0;
    const owner = owners.find((item) => item.value === defaultSubsiteId)
      ?? owners.find((item) => item.value === author.value)
      ?? owners[0];
    const subsiteId = defaultSubsiteId || owner?.value || 0;

    const attachments: VcAttachment[] = [];
    for (const [index, imageUrl] of input.imageUrls.slice(0, 10).entries()) {
      phase = `загрузка изображения ${index + 1}`;
      attachments.push(await uploadVcImage(active.session.accessToken, imageUrl));
    }
    phase = "создание черновика";
    const entry = {
      ...(editorData.entry ?? {}),
      id: 0, user_id: author.value, type: 1, subsite_id: subsiteId,
      title: input.title.trim(), entry: { blocks: articleBlocks(input.body, attachments) },
      external_access_link: "", path: "", is_editorial: false, is_advertisement: false,
      is_enabled_comments: true, is_enabled_likes: true, withheld: false, is_enabled_ad: true,
      is_holdonflash: false, forced_to_mainpage: 0, is_holdonmain: false, is_adult: false,
      is_published: false, repostId: null, repostData: null,
    };
    const form = new FormData();
    form.set("entry", JSON.stringify(entry));
    const saved = await vcEditorRequest<{ entry?: { id?: number } }>("editor", active.session.accessToken, { method: "POST", body: form });
    const entryId = saved?.entry?.id;
    if (!entryId) return { ok: false as const, error: "VC.ru не создал черновик статьи." };
    phase = "публикация черновика";
    await vcEditorRequest(`editor/${entryId}/publish`, active.session.accessToken, { method: "POST", body: new FormData() });
    return { ok: true as const, entryId, url: `https://vc.ru/${entryId}`, imagesSent: attachments.length, credential: active.credential };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось опубликовать статью в VC.ru.";
    const detailedMessage = `VC.ru: ${phase} — ${message}`;
    console.error("[vcru_publish_failed]", { authorId: input.authorId, phase, message });
    return { ok: false as const, error: detailedMessage };
  }
}
