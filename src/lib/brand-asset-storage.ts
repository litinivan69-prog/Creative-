import { randomUUID } from "node:crypto";

function safeFilename(filename: string) {
  return filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

export async function storeClientBrandAssetFile(input: { file: File; clientId: string; assetType: string }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  const { put } = await import("@vercel/blob");
  const pathname = `brand-assets/${input.clientId}/${input.assetType}/${Date.now()}-${randomUUID()}-${safeFilename(input.file.name)}`;
  const blob = await put(pathname, Buffer.from(await input.file.arrayBuffer()), {
    access: "public",
    contentType: input.file.type || "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return {
    fileUrl: blob.url,
    storageKey: blob.pathname,
    storageProvider: "vercel_blob",
    mimeType: input.file.type || null,
    fileSize: input.file.size,
  };
}
