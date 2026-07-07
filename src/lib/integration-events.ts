import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type EmitOptions = {
  relatedType?: string | null;
  relatedId?: string | null;
  payload?: unknown;
};

/**
 * Outbound: platform -> n8n.
 * Records an IntegrationEvent (status "queued"), then best-effort POSTs it to
 * N8N_WEBHOOK_URL with the shared-secret header. Never throws; when the webhook
 * is not configured it silently leaves the event queued.
 */
export async function emitIntegrationEvent(eventType: string, options: EmitOptions = {}) {
  const payload = (options.payload ?? {}) as Prisma.InputJsonValue;

  let event;
  try {
    event = await prisma.integrationEvent.create({
      data: {
        direction: "outbound",
        eventType,
        relatedType: options.relatedType ?? null,
        relatedId: options.relatedId ?? null,
        payload,
        status: "queued",
      },
    });
  } catch (error) {
    console.error("Failed to record integration event", error);
    return null;
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    // n8n not wired yet — keep the event queued, do not fail.
    return event;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aps-secret": process.env.N8N_SHARED_SECRET ?? "",
      },
      body: JSON.stringify({
        event: eventType,
        id: event.id,
        relatedId: event.relatedId,
        payload: options.payload ?? {},
      }),
    });

    if (!response.ok) throw new Error(`n8n responded with ${response.status}`);

    await prisma.integrationEvent.update({
      where: { id: event.id },
      data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 } },
    });
  } catch (error) {
    await prisma.integrationEvent
      .update({
        where: { id: event.id },
        data: {
          status: "failed",
          attempts: { increment: 1 },
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : "n8n webhook failed",
        },
      })
      .catch(() => {});
  }

  return event;
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Inbound guard: n8n -> platform. Compares the x-aps-secret header against
 * N8N_SHARED_SECRET. Fails closed when the secret is not configured.
 */
export function verifyN8nSecret(request: Request): boolean {
  const secret = process.env.N8N_SHARED_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("x-aps-secret");
  return typeof provided === "string" && constantTimeEqual(provided, secret);
}
