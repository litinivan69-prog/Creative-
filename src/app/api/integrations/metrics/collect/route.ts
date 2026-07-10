import { verifyN8nSecret } from "@/lib/integration-events";
import { collectPublicationMetrics } from "@/lib/metrics-collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Metric snapshot collector (guarded by x-aps-secret). Intended to be called
 * by an n8n cron workflow; also callable manually.
 */
export async function POST(request: Request) {
  if (!verifyN8nSecret(request)) {
    return Response.json({ ok: false, error: "Неверный секрет." }, { status: 401 });
  }

  try {
    const summary = await collectPublicationMetrics();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("metrics collect failed", error);
    return Response.json({ ok: false, error: "Не удалось собрать метрики." }, { status: 500 });
  }
}
