import { composeArticleFlow, type ArticleBlock, type InlineSpan } from "@/lib/article-markdown";
import type { ArticleCallout, ArticleFaqItem, ArticleImage, ArticleSource } from "@/lib/article-schema";

export type ArticleReaderData = {
  title: string;
  bodyMarkdown: string;
  images: ArticleImage[];
  callouts: ArticleCallout[];
  faq: ArticleFaqItem[];
  sources: ArticleSource[];
  metaTitle?: string | null;
  metaDescription?: string | null;
};

function InlineText({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold ? (
          <strong key={index} className="font-semibold text-slate-950">
            {span.text}
          </strong>
        ) : span.italic ? (
          <em key={index}>{span.text}</em>
        ) : (
          <span key={index}>{span.text}</span>
        ),
      )}
    </>
  );
}

function BlockView({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="mt-10 font-heading text-2xl font-bold tracking-tight text-slate-950">
          <InlineText spans={block.spans} />
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-7 font-heading text-lg font-bold tracking-tight text-slate-950">
          <InlineText spans={block.spans} />
        </h3>
      );
    case "quote":
      return (
        <blockquote className="mt-5 border-l-2 border-violet-300 pl-4 text-[15px] italic leading-7 text-slate-500">
          <InlineText spans={block.spans} />
        </blockquote>
      );
    case "ul":
      return (
        <ul className="mt-4 grid list-disc gap-2 pl-6 text-[15px] leading-7 text-slate-700 marker:text-violet-400">
          {block.items.map((item, index) => (
            <li key={index}>
              <InlineText spans={item} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-4 grid list-decimal gap-2 pl-6 text-[15px] leading-7 text-slate-700 marker:font-semibold marker:text-violet-500">
          {block.items.map((item, index) => (
            <li key={index}>
              <InlineText spans={item} />
            </li>
          ))}
        </ol>
      );
    case "p":
    default:
      return (
        <p className="mt-4 text-[15px] leading-7 text-slate-700">
          <InlineText spans={block.spans} />
        </p>
      );
  }
}

function ImageFigure({ image }: { image: ArticleImage }) {
  return (
    <figure className="mt-7">
      {image.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={image.caption} className="w-full rounded-[20px] object-cover" />
      ) : (
        <div className="grid min-h-[160px] place-items-center rounded-[20px] bg-[#f7f3fd] p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-violet-700">Иллюстрация готовится</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{image.prompt}</p>
          </div>
        </div>
      )}
      {image.caption ? (
        <figcaption className="mt-2 text-center text-xs leading-5 text-slate-400">{image.caption}</figcaption>
      ) : null}
    </figure>
  );
}

function CalloutView({ callout }: { callout: ArticleCallout }) {
  return (
    <aside className="mt-7 rounded-[20px] border-l-2 border-violet-500 bg-[#f7f3fd] px-5 py-4">
      <p className="text-sm font-bold text-violet-700">{callout.title}</p>
      <p className="mt-1.5 text-sm leading-6 text-slate-700">{callout.text}</p>
    </aside>
  );
}

export function ArticleReader({ article }: { article: ArticleReaderData }) {
  const flow = composeArticleFlow(article.bodyMarkdown, article.images, article.callouts);
  const sources = article.sources.filter((source) => source.title || source.url);

  return (
    <article className="mx-auto max-w-[680px]">
      <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
        {article.title}
      </h1>

      {flow.map((item, index) =>
        item.kind === "block" ? (
          <BlockView key={index} block={item.block} />
        ) : item.kind === "image" ? (
          <ImageFigure key={index} image={item.image} />
        ) : (
          <CalloutView key={index} callout={item.callout} />
        ),
      )}

      {article.faq.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-950">Частые вопросы</h2>
          <div className="mt-4 grid gap-3">
            {article.faq.map((item, index) => (
              <div key={index} className="rounded-[20px] bg-white p-5 ring-1 ring-slate-900/[0.045]">
                <p className="text-sm font-bold text-slate-950">{item.question}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sources.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-heading text-lg font-bold tracking-tight text-slate-950">Источники</h2>
          <ul className="mt-3 grid gap-1.5 text-sm leading-6 text-slate-500">
            {sources.map((source, index) => (
              <li key={index}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-700 underline decoration-violet-200 underline-offset-2 hover:decoration-violet-500"
                  >
                    {source.title || source.url}
                  </a>
                ) : (
                  source.title
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
