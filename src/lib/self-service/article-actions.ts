"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { articleImageProgress, runArticlePipeline } from "@/lib/article-engine";
import { prisma } from "@/lib/prisma";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";

export async function continueSelfServiceArticle(articleId: string) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return { ok: false as const, message: "Сессия завершилась. Войдите ещё раз." };

  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    select: { clientId: true },
  });
  if (!membership) return { ok: false as const, message: "Бренд для этой статьи не найден." };

  const article = await prisma.article.findFirst({
    where: { id: articleId, clientId: membership.clientId, status: { not: "archived" } },
    select: { id: true, plannedContentItemId: true },
  });
  if (!article) return { ok: false as const, message: "Статья недоступна." };

  const outcome = await runArticlePipeline(article.id, { singleStep: true });
  const fresh = await prisma.article.findUnique({
    where: { id: article.id },
    select: { stage: true, status: true, briefJson: true, images: true, errorMessage: true },
  });
  if (!fresh) return { ok: false as const, message: "Статья не найдена после обновления." };

  const progress = articleImageProgress(fresh.briefJson, fresh.images);
  revalidatePath("/app/articles");
  revalidatePath(`/app/articles/${article.id}`);
  if (article.plannedContentItemId) revalidatePath(`/app/month/${article.plannedContentItemId}`);

  if (!outcome.ok) {
    return {
      ok: false as const,
      message: fresh.errorMessage || outcome.error,
      ready: progress.ready,
      total: progress.total,
    };
  }

  return {
    ok: true as const,
    done: outcome.done && progress.complete,
    stage: fresh.stage,
    ready: progress.ready,
    total: progress.total,
  };
}
