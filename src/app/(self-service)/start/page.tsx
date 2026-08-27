import type { Metadata } from "next";
import { SelfServiceStart } from "@/app/(self-service)/start/self-service-start";

export const metadata: Metadata = {
  title: "Начать · Ribes",
  description: "Соберите регулярную систему контента для своего бренда.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StartPage() {
  return <SelfServiceStart />;
}
