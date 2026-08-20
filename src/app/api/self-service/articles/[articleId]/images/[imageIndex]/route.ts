import { auth } from "@/auth";
import { loadArticleDocxInput } from "@/lib/article-docx";
import { prisma } from "@/lib/prisma";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { fetchAndPrepareImage } from "@/lib/social-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ articleId: string; imageIndex: string }> },
) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return new Response("Войдите в кабинет.", { status: 401 });

  const { articleId, imageIndex } = await params;
  const index = Number(imageIndex);
  if (!Number.isInteger(index) || index < 0) return new Response("Изображение не найдено.", { status: 404 });

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true },
  });
  if (!membership) return new Response("Изображение не найдено.", { status: 404 });

  const input = await loadArticleDocxInput(articleId);
  const image = input?.images[index];
  if (!input || input.clientId !== membership.clientId || !image?.url) {
    return new Response("Изображение не найдено.", { status: 404 });
  }

  const buffer = await fetchAndPrepareImage(image.url);
  if (!buffer) return new Response("Не удалось подготовить изображение.", { status: 502 });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="article-${articleId}-${image.role}-${index + 1}.jpg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
