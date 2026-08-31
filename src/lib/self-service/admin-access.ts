import { prisma } from "@/lib/prisma";

function configuredAdminEmails() {
  return (process.env.RIBES_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isRibesAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return configuredAdminEmails().includes(email.trim().toLowerCase());
}

export async function clientHasUnlimitedCredits(clientId: string) {
  const adminEmails = configuredAdminEmails();
  if (adminEmails.length === 0) return false;

  const membership = await prisma.workspaceMembership.findFirst({
    where: { clientId, user: { email: { in: adminEmails } } },
    select: { id: true },
  });
  return Boolean(membership);
}
