import { randomUUID } from "node:crypto";
import { putPublicObject } from "@/lib/object-storage";

function safeFilename(filename: string) {
  return filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "geo-report";
}

/**
 * Stores a GEO-audit PPTX in public object storage. Returns null when storage is not
 * configured (local/dev) so the caller degrades to manual entry without a file.
 */
export async function storeGeoReportFile(input: { file: File; clientId: string }) {
  const pathname = `geo-audits/${input.clientId}/${Date.now()}-${randomUUID()}-${safeFilename(input.file.name)}`;
  const contentType = input.file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const stored = await putPublicObject({ key: pathname, body: Buffer.from(await input.file.arrayBuffer()), contentType });
  if (!stored) return null;

  return { reportFileUrl: stored.url, reportStorageKey: stored.key };
}
