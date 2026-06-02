import type { Metadata } from "next";
import { ClientPortalView } from "@/app/client-portal-view";
import { hashPortalToken } from "@/lib/client-portal-links";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Клиентский календарь · Adaptive Presence OS",
  robots: {
    index: false,
    follow: false,
  },
};

function PortalError({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7f6] px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-xl rounded-lg border border-rose-200 bg-white p-6 shadow-[0_1px_2px_rgba(28,36,38,0.04)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Adaptive Presence OS · by Creative</p>
        <h1 className="mt-3 text-2xl font-semibold text-stone-950">Клиентский календарь</h1>
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-800">{children}</p>
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
              contentDraft: {
                select: {
                  id: true,
                  status: true,
                  draftTitle: true,
                  draftBody: true,
                },
              },
            },
          },
          scheduledPublications: {
            orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
            select: {
              plannedContentItemId: true,
              scheduledDate: true,
              scheduledTime: true,
              status: true,
              notes: true,
              creativeAssets: {
                select: {
                  generatedVariants: {
                    orderBy: { createdAt: "desc" },
                    select: {
                      status: true,
                      imageBase64: true,
                      imageUrl: true,
                      mimeType: true,
                      qualityStatus: true,
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

  return (
    <main className="min-h-screen bg-[#f5f7f6] px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <ClientPortalView
          clientName={portalLink.client.name}
          month={portalLink.monthlyPlan.month}
          items={portalLink.monthlyPlan.plannedContentItems}
          publications={portalLink.monthlyPlan.scheduledPublications}
          portalToken={token}
          notice={query.notice}
          error={query.error}
        />
      </div>
    </main>
  );
}
