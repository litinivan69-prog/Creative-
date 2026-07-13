import { buildArticleDocx, loadArticleDocxInput } from "@/lib/article-docx";
import { hashPortalToken } from "@/lib/client-portal-links";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; articleId: string }> },
) {
  const { token, articleId } = await params;

  try {
    const link = await prisma.clientPortalLink.findUnique({
      where: { tokenHash: hashPortalToken(token) },
      select: { status: true, expiresAt: true, clientId: true },
    });

    if (!link || link.status !== "active" || (link.expiresAt && link.expiresAt < new Date())) {
      return new Response("Ссылка недействительна или срок её действия истёк.", { status: 404 });
    }

    const input = await loadArticleDocxInput(articleId);
    if (!input || input.clientId !== link.clientId) {
      return new Response("Статья не найдена.", { status: 404 });
    }

    const buffer = await buildArticleDocx(input);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="article-${articleId}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to build portal article docx", error);
    return new Response("Не удалось собрать документ. Попробуйте позже.", { status: 500 });
  }
}
