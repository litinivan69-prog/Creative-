import { randomUUID } from "node:crypto";

function safeFilename(filename: string) {
  return filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "geo-report";
}

/**
 * Stores a GEO-audit PPTX in Vercel Blob. Returns null when Blob is not
 * configured (local/dev) so the caller degrades to manual entry without a file.
 */
export async function storeGeoReportFile(input: { file: File; clientId: string }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  const { put } = await import("@vercel/blob");
  const pathname = `geo-audits/${input.clientId}/${Date.now()}-${randomUUID()}-${safeFilename(input.file.name)}`;
  const blob = await put(pathname, Buffer.from(await input.file.arrayBuffer()), {
    access: "public",
    contentType: input.file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return { reportFileUrl: blob.url, reportStorageKey: blob.pathname };
}
