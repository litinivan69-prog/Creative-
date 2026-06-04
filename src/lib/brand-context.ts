import { prisma } from "@/lib/prisma";

const MAX_CONTEXT_LENGTH = 12000;

export async function getClientBrandContext(clientId: string) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        brandProfile: true,
        brandAssets: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!client?.brandProfile && !client?.brandAssets.length) return "";

    const profile = client.brandProfile;
    const lines = [
      profile?.toneOfVoice ? `Тональность: ${profile.toneOfVoice}` : null,
      profile?.keyMessages ? `Ключевые сообщения: ${profile.keyMessages}` : null,
      profile?.targetAudienceNotes ? `Целевая аудитория: ${profile.targetAudienceNotes}` : null,
      profile?.brandColors ? `Цвета бренда: ${profile.brandColors}` : null,
      profile?.fonts ? `Шрифты: ${profile.fonts}` : null,
      profile?.visualStyle ? `Визуальный стиль: ${profile.visualStyle}` : null,
      profile?.productServiceNotes ? `Услуги и продукты: ${profile.productServiceNotes}` : null,
      profile?.forbiddenTopics ? `Запрещено: ${profile.forbiddenTopics}` : null,
      profile?.requiredDisclaimers ? `Обязательные дисклеймеры: ${profile.requiredDisclaimers}` : null,
      profile?.legalNotes ? `Юридические ограничения: ${profile.legalNotes}` : null,
      client.brandAssets.length
        ? `Материалы бренда:\n${client.brandAssets.map((asset) => `- ${asset.title} (${asset.assetType})${asset.description ? `: ${asset.description}` : ""}${asset.textContent ? `\n  Текст: ${asset.textContent.slice(0, 1200)}` : ""}${asset.sourceUrl ? `\n  Источник: ${asset.sourceUrl}` : ""}${asset.fileUrl ? `\n  Файл: ${asset.fileUrl}` : ""}`).join("\n")}`
        : null,
    ].filter(Boolean).join("\n");

    return lines.slice(0, MAX_CONTEXT_LENGTH);
  } catch (error) {
    console.error("Failed to load brand context", error);
    return "";
  }
}
