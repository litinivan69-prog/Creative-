import type { Metadata } from "next";
import { AdaptivePresenceDemo } from "@/app/(self-service)/demo/adaptive-presence-demo";

export const metadata: Metadata = {
  title: "Adaptive Presence · Контент-система для бренда",
  description: "Темы, посты, статьи, визуалы, календарь и автопостинг для VK, Telegram, Одноклассников, Дзена и VC.ru — в одном лёгком кабинете.",
};

export default function PublicProductPage() {
  return <AdaptivePresenceDemo />;
}
