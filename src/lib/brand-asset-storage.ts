import { randomUUID } from "node:crypto";
import { putPublicObject } from "@/lib/object-storage";

function safeFilename(filename: string) {
  return filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

export async function storeClientBrandAssetFile(input: { file: File; clientId: string; assetType: string }) {
  const pathname = `brand-assets/${input.clientId}/${input.assetType}/${Date.now()}-${randomUUID()}-${safeFilename(input.file.name)}`;
  const contentType = input.file.type || "application/octet-stream";
  const stored = await putPublicObject({ key: pathname, body: Buffer.from(await input.file.arrayBuffer()), contentType });
  if (!stored) return null;

  return {
    fileUrl: stored.url,
    storageKey: stored.key,
    storageProvider: stored.provider,
    mimeType: input.file.type || null,
    fileSize: input.file.size,
  };
}
