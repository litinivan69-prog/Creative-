import { syncYooKassaPayment } from "@/lib/yookassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type YooKassaNotification = {
  type?: string;
  event?: string;
  object?: { id?: string };
};

export async function POST(request: Request) {
  let notification: YooKassaNotification;
  try {
    notification = await request.json() as YooKassaNotification;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const paymentId = notification.object?.id;
  if (notification.type !== "notification" || !paymentId || !notification.event?.startsWith("payment.")) {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    // The notification itself is not trusted: fetch the payment from YooKassa
    // with server credentials and verify its amount and metadata before access.
    await syncYooKassaPayment(paymentId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("YooKassa webhook sync failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok: false }, { status: 500 });
  }
}
