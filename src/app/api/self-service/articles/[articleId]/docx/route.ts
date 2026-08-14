import { auth } from "@/auth";
import { buildArticleDocx, loadArticleDocxInput } from "@/lib/article-docx";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return new Response("Войдите в кабинет.", { status: 401 });

  const { articleId } = await params;
  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    select: { clientId: true },
  });
  if (!membership) return new Response("Статья не найдена.", { status: 404 });

  try {
    const input = await loadArticleDocxInput(articleId);
    if (!input || input.clientId !== membership.clientId) {
      return new Response("Статья не найдена.", { status: 404 });
    }

    const buffer = await buildArticleDocx(input);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="article-${articleId}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to build self-service article docx", error);
    return new Response("Не удалось собрать документ. Попробуйте позже.", { status: 500 });
  }
}
