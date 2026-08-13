import JSZip from "jszip";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type VisualFile = {
  id: string;
  imageUrl: string | null;
  imageBase64: string | null;
  mimeType: string;
};

function extension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

async function visualBytes(visual: VisualFile) {
  if (visual.imageBase64) return Buffer.from(visual.imageBase64, "base64");
  if (!visual.imageUrl) return null;

  const url = new URL(visual.imageUrl);
  if (url.protocol !== "https:") return null;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function slideFilename(index: number, total: number, mimeType: string) {
  const number = String(index + 1).padStart(2, "0");
  const role = index === 0 ? "cover" : index === total - 1 ? "cta" : "slide";
  return `${number}_${role}.${extension(mimeType)}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return new Response("Требуется вход", { status: 401 });

  const { itemId } = await context.params;
  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    select: { clientId: true },
  });
  if (!membership) return new Response("Рабочее пространство не найдено", { status: 404 });

  const item = await prisma.plannedContentItem.findFirst({
    where: { id: itemId, monthlyPlan: { clientId: membership.clientId } },
    include: {
      creativeAssets: {
        orderBy: { createdAt: "asc" },
        include: { generatedVariants: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
      generatedCreativeVariants: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!item) return new Response("Материал не найден", { status: 404 });

  const slides = item.creativeAssets.filter((asset) => asset.assetType === "carousel_slide");
  const visuals: VisualFile[] = slides.length > 0
    ? slides.flatMap((asset) => asset.generatedVariants)
    : item.generatedCreativeVariants.slice(0, 1);
  const requestedId = request.nextUrl.searchParams.get("variant");
  const inline = request.nextUrl.searchParams.get("inline") === "1";

  if (requestedId) {
    const visual = visuals.find((candidate) => candidate.id === requestedId);
    if (!visual) return new Response("Визуал не найден", { status: 404 });
    const bytes = await visualBytes(visual);
    if (!bytes) return new Response("Файл визуала недоступен", { status: 404 });
    const index = visuals.findIndex((candidate) => candidate.id === visual.id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": visual.mimeType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${slideFilename(index, visuals.length, visual.mimeType)}"`,
        "Cache-Control": inline ? "private, max-age=300" : "private, no-store",
      },
    });
  }

  if (visuals.length === 0) return new Response("Визуалы ещё готовятся", { status: 404 });
  if (visuals.length === 1) {
    const bytes = await visualBytes(visuals[0]);
    if (!bytes) return new Response("Файл визуала недоступен", { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": visuals[0].mimeType,
        "Content-Disposition": `attachment; filename="visual.${extension(visuals[0].mimeType)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const zip = new JSZip();
  for (const [index, visual] of visuals.entries()) {
    const bytes = await visualBytes(visual);
    if (bytes) zip.file(slideFilename(index, visuals.length, visual.mimeType), bytes);
  }
  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const archiveBody = new ArrayBuffer(archive.byteLength);
  new Uint8Array(archiveBody).set(archive);
  return new Response(archiveBody, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="carousel.zip"',
      "Cache-Control": "private, no-store",
    },
  });
}
