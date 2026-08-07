"use server";

import { signIn, signOut } from "@/auth";
import { redirect } from "next/navigation";

function safeCallbackPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value.trim() : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/app";
}

export async function requestSelfServiceMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const redirectTo = safeCallbackPath(formData.get("callbackUrl"));

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    redirect(`/sign-in?error=invalid_email&callbackUrl=${encodeURIComponent(redirectTo)}`);
  }

  await signIn("resend", {
    email,
    redirectTo,
  });
}

export async function signOutSelfService() {
  await signOut({ redirectTo: "/sign-in" });
}
