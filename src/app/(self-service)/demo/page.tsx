import type { Metadata } from "next";
import { AdaptivePresenceDemo } from "@/app/(self-service)/demo/adaptive-presence-demo";

export const metadata: Metadata = {
  title: "Демо · Adaptive Presence",
  description: "Посмотрите, как Adaptive Presence собирает, публикует и анализирует контент бренда.",
};

export default function DemoPage() {
  return <AdaptivePresenceDemo />;
}
