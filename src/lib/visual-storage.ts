import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

type StoreGeneratedVisualInput = {
  imageBase64: string;
  mimeType: string;
  clientId: string;
  monthlyPlanId: string;
  creativeAssetId: string;
};

function extensionForMimeType(mimeType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensions[mimeType] ?? "png";
}

export async function storeGeneratedVisual(input: StoreGeneratedVisualInput) {
  const file = Buffer.from(input.imageBase64, "base64");
  const fileSize = file.byteLength;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      storageProvider: "database_base64" as const,
      imageBase64: input.imageBase64,
      fileSize,
    };
  }

  const storageKey = [
    "generated-visuals",
    input.clientId,
    input.monthlyPlanId,
    input.creativeAssetId,
    `${Date.now()}-${randomUUID()}.${extensionForMimeType(input.mimeType)}`,
  ].join("/");
  const blob = await put(storageKey, file, {
    access: "public",
    contentType: input.mimeType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return {
    storageProvider: "vercel_blob" as const,
    imageUrl: blob.url,
    storageKey: blob.pathname,
    fileSize,
  };
}
