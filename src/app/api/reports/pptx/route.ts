import { getGeneratedVariantImageSrc } from "@/lib/generated-visuals";
import { prisma } from "@/lib/prisma";
import { assembleReportDeck, buildReportPptx } from "@/lib/report-pptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function monthLabel(month?: string | null) {
  const match = month?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month ?? "Отчёт";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" })
    .format(date)
    .replace(/^./, (letter) => letter.toUpperCase());
}

export async function GET(request: Request) {
  const planId = new URL(request.url).searchParams.get("plan");

  if (!planId) {
    return new Response("Не выбран месячный план.", { status: 400 });
  }

  try {
    const plan = await prisma.monthlyOperatingPlan.findUnique({
      where: { id: planId },
      select: {
        month: true,
        client: { select: { name: true } },
        scheduledPublications: {
          orderBy: [{ scheduledDate: "asc" }],
          select: {
            id: true,
            platformName: true,
            topic: true,
            publishStatus: true,
            publishedAt: true,
            scheduledDate: true,
            metrics: {
              orderBy: { capturedAt: "desc" },
              take: 1,
              select: { likes: true, comments: true, shares: true, reach: true, views: true, saves: true, clicks: true },
            },
            creativeAssets: {
              select: {
                generatedVariants: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { imageUrl: true, mimeType: true, storageProvider: true, fileSize: true },
                },
              },
            },
          },
        },
      },
    });

    if (!plan) {
      return new Response("Месячный план не найден.", { status: 404 });
    }

    const publications = plan.scheduledPublications.map((publication) => {
      const variant = publication.creativeAssets.flatMap((asset) => asset.generatedVariants)[0];
      return {
        id: publication.id,
        platformName: publication.platformName,
        topic: publication.topic,
        publishStatus: publication.publishStatus,
        publishedAt: publication.publishedAt,
        scheduledDate: publication.scheduledDate,
        metric: publication.metrics[0] ?? null,
        imageSrc: variant ? getGeneratedVariantImageSrc(variant) : null,
      };
    });

    const deck = await assembleReportDeck({
      clientName: plan.client.name,
      monthLabel: monthLabel(plan.month),
      publications,
    });
    const buffer = await buildReportPptx(deck);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="report-${plan.month}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to build manager report deck", error);
    return new Response("Не удалось сформировать отчёт. Попробуйте позже.", { status: 500 });
  }
}
