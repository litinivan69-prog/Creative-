"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function beginSelfServiceCheckout() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/subscribe");

  const membership = await prisma.workspaceMembership.findFirst({
    where: { user: { email } },
    select: { clientId: true },
  });
  if (!membership) redirect("/start");

  const checkoutUrl = process.env.SELF_SERVICE_CHECKOUT_URL?.trim();
  if (!checkoutUrl) redirect("/app/subscribe?error=checkout_unavailable");

  redirect(checkoutUrl);
}
