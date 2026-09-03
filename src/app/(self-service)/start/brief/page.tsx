import type { Metadata } from "next";
import { SelfServiceBrief } from "@/app/(self-service)/start/brief/self-service-brief";
import { parseSelfServiceSelection } from "@/lib/self-service/product";

export const metadata: Metadata = {
  title: "Короткий бриф · Ribes",
  description: "Расскажите самое важное о бренде — без длинной анкеты.",
  robots: {
    index: false,
    follow: false,
  },
};

type BriefSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BriefPage({ searchParams }: { searchParams: BriefSearchParams }) {
  const params = await searchParams;
  const selection = parseSelfServiceSelection({
    formats: first(params.formats),
    posts: first(params.posts),
    articles: first(params.articles),
  });

  return <SelfServiceBrief selection={selection} resetDraft={first(params.reset) === "1"} />;
}
