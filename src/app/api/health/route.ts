import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, service: "ribes" });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json({ ok: false, service: "ribes" }, { status: 503 });
  }
}
