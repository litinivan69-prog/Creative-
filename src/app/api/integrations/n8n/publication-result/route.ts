import { prisma } from "@/lib/prisma";
import { verifyN8nSecret } from "@/lib/integration-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!verifyN8nSecret(request)) {
    return Response.json({ ok: false, error: "Неверный секрет." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Некорректное тело запроса." }, { status: 400 });
  }

  const scheduledPublicationId = readString(body, "scheduledPublicationId");
  const externalUrl = readString(body, "externalUrl");
  const externalId = readString(body, "externalId");
  const status = readString(body, "status");

  if (!scheduledPublicationId) {
    return Response.json({ ok: false, error: "Не указан scheduledPublicationId." }, { status: 400 });
  }

  try {
    const publication = await prisma.scheduledPublication.findUnique({
      where: { id: scheduledPublicationId },
      select: { id: true, externalId: true, publishStatus: true },
    });

    if (!publication) {
      return Response.json({ ok: false, error: "Публикация не найдена." }, { status: 404 });
    }

    // Idempotent dedup: the same external result was already recorded.
    if (externalId && publication.externalId === externalId && publication.publishStatus) {
      return Response.json({ ok: true, deduped: true });
    }

    const resolvedStatus = status || "published";

    await prisma.scheduledPublication.update({
      where: { id: publication.id },
      data: {
        publishStatus: resolvedStatus,
        externalUrl: externalUrl || null,
        externalId: externalId || null,
        publishedAt: resolvedStatus === "published" ? new Date() : undefined,
      },
    });

    await prisma.integrationEvent.create({
      data: {
        direction: "inbound",
        eventType: "publication-result",
        relatedType: "ScheduledPublication",
        relatedId: publication.id,
        payload: { externalUrl, externalId, status: resolvedStatus },
        status: "processed",
        processedAt: new Date(),
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to process publication-result", error);
    return Response.json({ ok: false, error: "Не удалось обработать событие." }, { status: 500 });
  }
}
