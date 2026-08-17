import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SELF_SERVICE_ACTIVE_CLIENT_COOKIE = "ap_active_client";

export async function selfServiceMembershipWhere(email: string): Promise<Prisma.WorkspaceMembershipWhereInput> {
  const cookieStore = await cookies();
  const requestedClientId = cookieStore.get(SELF_SERVICE_ACTIVE_CLIENT_COOKIE)?.value;

  if (requestedClientId) {
    const allowed = await prisma.workspaceMembership.findFirst({
      where: { clientId: requestedClientId, user: { email } },
      select: { id: true },
    });
    if (allowed) return { clientId: requestedClientId, user: { email } };
  }

  return { user: { email } };
}

export async function rememberActiveSelfServiceClient(email: string, clientId: string) {
  const allowed = await prisma.workspaceMembership.findFirst({
    where: { clientId, user: { email } },
    select: { id: true },
  });
  if (!allowed) throw new Error("WORKSPACE_ACCESS_DENIED");

  const cookieStore = await cookies();
  cookieStore.set(SELF_SERVICE_ACTIVE_CLIENT_COOKIE, clientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}
