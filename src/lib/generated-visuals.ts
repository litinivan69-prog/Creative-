type GeneratedVisualSource = {
  imageUrl?: string | null;
  imageBase64?: string | null;
  mimeType: string;
  storageProvider?: string | null;
  fileSize?: number | null;
};

export function getGeneratedVariantImageSrc(variant: GeneratedVisualSource) {
  if (variant.imageUrl) return variant.imageUrl;
  if (variant.imageBase64) return `data:${variant.mimeType};base64,${variant.imageBase64}`;
  return null;
}

export function formatGeneratedVisualStorage(storageProvider?: string | null) {
  if (storageProvider === "s3") return "S3";
  if (storageProvider === "vercel_blob") return "Vercel Blob";
  return "Base64 MVP";
}

export function formatGeneratedVisualFileSize(fileSize?: number | null) {
  if (!fileSize) return null;
  if (fileSize < 1024 * 1024) return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}
