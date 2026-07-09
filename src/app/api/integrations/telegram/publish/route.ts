import { verifyN8nSecret } from "@/lib/integration-events";
import { publishScheduledPublication } from "@/lib/telegram-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Publish a scheduled publication to the client's Telegram channel
 * (guarded by x-aps-secret; usable by n8n/automation later).
 */
export async function POST(request: Request) {
  if (!verifyN8nSecret(request)) {
    return Response.json({ ok: false, error: "Неверный секрет." }, { status: 401 });
  }

  let body: { scheduledPublicationId?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Некорректное тело запроса." }, { status: 400 });
  }

  const scheduledPublicationId =
    typeof body.scheduledPublicationId === "string" ? body.scheduledPublicationId.trim() : "";

  if (!scheduledPublicationId) {
    return Response.json({ ok: false, error: "Не указан scheduledPublicationId." }, { status: 400 });
  }

  const outcome = await publishScheduledPublication(scheduledPublicationId, {
    force: body.force === true,
  });

  if (!outcome.ok) {
    return Response.json({ ok: false, error: outcome.error }, { status: 400 });
  }

  return Response.json(outcome);
}
