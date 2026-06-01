import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type GenerationJobResultLinks = {
  contentDraftId?: string;
  creativeAssetId?: string;
  generatedCreativeVariantId?: string;
};

export function createGenerationJob(data: Omit<Prisma.GenerationJobUncheckedCreateInput, "status">) {
  return prisma.generationJob.create({
    data: {
      ...data,
      status: "queued",
    },
  });
}

export function markGenerationJobRunning(jobId: string, message?: string) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: new Date(),
      message: message || null,
      errorMessage: null,
    },
  });
}

export function markGenerationJobCompleted(
  jobId: string,
  resultSummary?: string,
  links: GenerationJobResultLinks = {},
) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      ...links,
      status: "completed",
      completedAt: new Date(),
      resultSummary: resultSummary || null,
      errorMessage: null,
    },
  });
}

export function markGenerationJobFailed(jobId: string, errorMessage: string) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage,
    },
  });
}

export async function markGenerationJobFailedSafely(jobId: string | undefined, errorMessage: string) {
  if (!jobId) return;

  try {
    await markGenerationJobFailed(jobId, errorMessage);
  } catch {
    // Preserve the original generation error if the status update also fails.
  }
}
