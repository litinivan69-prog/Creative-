import { verifyN8nSecret } from "@/lib/integration-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifyN8nSecret(request)) {
    return Response.json({ ok: false, error: "Неверный секрет." }, { status: 401 });
  }

  return Response.json({ ok: true });
}
