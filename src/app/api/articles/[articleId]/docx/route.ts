import { buildArticleDocx, loadArticleDocxInput } from "@/lib/article-docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;

  try {
    const input = await loadArticleDocxInput(articleId);
    if (!input) {
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
    console.error("Failed to build article docx", error);
    return new Response("Не удалось собрать документ. Попробуйте позже.", { status: 500 });
  }
}
