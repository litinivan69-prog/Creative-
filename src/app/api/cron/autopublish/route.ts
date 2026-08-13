import { runScheduledAutopublish } from "@/lib/scheduled-autopublish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });

  try {
    const summary = await runScheduledAutopublish();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("Scheduled autopublish failed", error);
    return Response.json({ ok: false, error: "Не удалось проверить очередь публикаций." }, { status: 500 });
  }
}
