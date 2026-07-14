import type { Metadata } from "next";
import { ClientPortalView, type ClientPortalArticle } from "@/app/client-portal-view";
import type { ArticleCallout, ArticleFaqItem, ArticleImage, ArticleSource } from "@/lib/article-schema";
import { hashPortalToken } from "@/lib/client-portal-links";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Клиентский пакет · Adaptive Presence OS",
  robots: {
    index: false,
    follow: false,
  },
};

function PortalError({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f5fb] bg-[radial-gradient(circle_at_24%_-8%,rgba(139,92,246,0.16),transparent_34%)] px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-xl rounded-[28px] border border-white/80 bg-white/90 p-7 shadow-[0_24px_80px_rgba(88,75,135,0.10)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Adaptive Presence OS · by Creative Command</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Клиентский пакет</h1>
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-800">{children}</p>
      </section>
    </main>
  );
}

export default async function ClientPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const portalLink = await prisma.clientPortalLink.findUnique({
    where: {
      tokenHash: hashPortalToken(token),
    },
    select: {
      id: true,
      clientId: true,
      status: true,
      expiresAt: true,
      client: {
        select: {
          name: true,
        },
      },
      monthlyPlan: {
        select: {
          month: true,
          plannedContentItems: {
            select: {
              id: true,
              plannedDate: true,
              week: true,
              platformName: true,
              format: true,
              topic: true,
              deliverableKind: true,
              contentDraft: {
                select: {
                  id: true,
                  status: true,
                  draftTitle: true,
                  draftBody: true,
                  reviewEvents: {
                    orderBy: { createdAt: "asc" },
                    select: {
                      id: true,
                      actorType: true,
                      action: true,
                      comment: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
          scheduledPublications: {
            orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
            select: {
              plannedContentItemId: true,
              platformName: true,
              topic: true,
              scheduledDate: true,
              scheduledTime: true,
              status: true,
              notes: true,
              publishStatus: true,
              publishedAt: true,
              externalUrl: true,
              metrics: {
                orderBy: { capturedAt: "desc" },
                take: 1,
                select: {
                  likes: true,
                  comments: true,
                  shares: true,
                  reach: true,
                  views: true,
                  saves: true,
                  clicks: true,
                },
              },
              creativeAssets: {
                select: {
                  id: true,
                  assetType: true,
                  title: true,
                  status: true,
                  notes: true,
                  generatedVariants: {
                    orderBy: { createdAt: "desc" },
                    select: {
                      id: true,
                      imageUrl: true,
                      mimeType: true,
                      storageProvider: true,
                      fileSize: true,
                      status: true,
                      qualityStatus: true,
                      variantTitle: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!portalLink || portalLink.status !== "active") {
    return <PortalError>Ссылка недействительна или была отключена.</PortalError>;
  }

  if (portalLink.expiresAt && portalLink.expiresAt < new Date()) {
    return <PortalError>Срок действия ссылки истёк.</PortalError>;
  }

  await prisma.clientPortalLink.update({
    where: { id: portalLink.id },
    data: { lastOpenedAt: new Date() },
  });

  const articles: ClientPortalArticle[] = await prisma.article
    .findMany({
      where: { clientId: portalLink.clientId, status: { not: "archived" }, stage: "done" },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    .then((rows) =>
      rows.map((article) => ({
        id: article.id,
        plannedContentItemId: article.plannedContentItemId,
        title: article.title,
        bodyMarkdown: article.bodyMarkdown,
        images: (article.images as ArticleImage[]) ?? [],
        callouts: (article.calloutNotes as ArticleCallout[]) ?? [],
        faq: (article.faq as ArticleFaqItem[]) ?? [],
        sources: (article.sources as ArticleSource[]) ?? [],
        wordCount: article.wordCount,
      })),
    )
    .catch(() => []);

  return (
    <ClientPortalView
      clientName={portalLink.client.name}
      month={portalLink.monthlyPlan.month}
      items={portalLink.monthlyPlan.plannedContentItems}
      publications={portalLink.monthlyPlan.scheduledPublications}
      articles={articles}
      portalToken={token}
      notice={query.notice}
      error={query.error}
    />
  );
}
