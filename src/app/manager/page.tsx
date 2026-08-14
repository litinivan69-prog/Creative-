import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ManagerDashboard from "@/app/manager-dashboard";

export const dynamic = "force-dynamic";

export default async function ManagerPage(props: Parameters<typeof ManagerDashboard>[0]) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/manager");

  const allowedEmails = (process.env.MANAGER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedEmails.includes(email)) notFound();

  return <ManagerDashboard {...props} />;
}
