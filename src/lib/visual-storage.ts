import { randomUUID } from "node:crypto";
import { putPublicObject } from "@/lib/object-storage";

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

  const storageKey = [
    "generated-visuals",
    input.clientId,
    input.monthlyPlanId,
    input.creativeAssetId,
    `${Date.now()}-${randomUUID()}.${extensionForMimeType(input.mimeType)}`,
  ].join("/");
  const stored = await putPublicObject({ key: storageKey, body: file, contentType: input.mimeType });

  if (!stored) {
    return {
      storageProvider: "database_base64" as const,
      imageBase64: input.imageBase64,
      fileSize,
    };
  }

  return {
    storageProvider: stored.provider,
    imageUrl: stored.url,
    storageKey: stored.key,
    fileSize,
  };
}
