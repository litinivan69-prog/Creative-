"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SELF_SERVICE_SELECTION,
  SELF_SERVICE_ARTICLE_RHYTHMS,
  SELF_SERVICE_FORMATS,
  SELF_SERVICE_POST_RHYTHMS,
  selfServiceBriefHref,
  type SelfServiceFormatId,
} from "@/lib/self-service/product";
import { PlatformBrandIcon, platformBrandFromFormatId, type PlatformBrand } from "@/app/(self-service)/platform-brand-icon";
import { RibesBrand } from "@/app/(self-service)/ribes-brand";

const coreFormats = SELF_SERVICE_FORMATS.filter((format) => format.core);
const helperFormats = SELF_SERVICE_FORMATS.filter((format) => !format.core);
const START_SELECTION_STORAGE_KEY = "adaptive-presence:start-selection:v1";

const iconPaths: Record<string, React.ReactNode> = {
  mark: <path d="M4.75 12.25 9.1 16.6 19.25 6.45" />,
  arrow: <path d="m9 5 7 7-7 7" />,
  sparkle: <path d="M12 3.5 13.7 8l4.8 1.7-4.8 1.7L12 16l-1.7-4.6-4.8-1.7L10.3 8 12 3.5Z" />,
};

function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof iconPaths; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {iconPaths[name]}
    </svg>
  );
}

function SelectCard({
  active,
  title,
  description,
  platform,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  platform?: PlatformBrand | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group min-w-0 rounded-[22px] border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 ${
        active
          ? "border-violet-400 bg-violet-50/90 shadow-[0_14px_45px_rgba(109,82,171,0.12)]"
          : "border-slate-200/80 bg-white/80 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-[0_12px_30px_rgba(77,61,112,.07)]"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-3.5">
          {platform ? <PlatformBrandIcon platform={platform} /> : null}
          <span className="min-w-0 pt-0.5">
          <span className="block text-sm font-semibold text-slate-950">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
          </span>
        </span>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
            active ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-transparent"
          }`}
        >
          <Icon name="mark" className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}

export function SelfServiceStart() {
  const router = useRouter();
  const [storageReady, setStorageReady] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<SelfServiceFormatId[]>(DEFAULT_SELF_SERVICE_SELECTION.formatIds);
  const [postRhythm, setPostRhythm] = useState<(typeof SELF_SERVICE_POST_RHYTHMS)[number]["id"]>(
    DEFAULT_SELF_SERVICE_SELECTION.postRhythmId,
  );
  const [articleRhythm, setArticleRhythm] = useState<(typeof SELF_SERVICE_ARTICLE_RHYTHMS)[number]["id"]>(
    DEFAULT_SELF_SERVICE_SELECTION.articleRhythmId,
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(START_SELECTION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          formatIds?: unknown;
          postRhythmId?: unknown;
          articleRhythmId?: unknown;
        };
        const validFormatIds = new Set(SELF_SERVICE_FORMATS.map((format) => format.id));
        const restoredFormats = Array.isArray(parsed.formatIds)
          ? parsed.formatIds.filter((id): id is SelfServiceFormatId => typeof id === "string" && validFormatIds.has(id as SelfServiceFormatId))
          : [];
        if (restoredFormats.length > 0) setSelectedFormats(restoredFormats);
        if (SELF_SERVICE_POST_RHYTHMS.some((rhythm) => rhythm.id === parsed.postRhythmId)) {
          setPostRhythm(parsed.postRhythmId as (typeof SELF_SERVICE_POST_RHYTHMS)[number]["id"]);
        }
        if (SELF_SERVICE_ARTICLE_RHYTHMS.some((rhythm) => rhythm.id === parsed.articleRhythmId)) {
          setArticleRhythm(parsed.articleRhythmId as (typeof SELF_SERVICE_ARTICLE_RHYTHMS)[number]["id"]);
        }
      }
    } catch {
      window.localStorage.removeItem(START_SELECTION_STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(
      START_SELECTION_STORAGE_KEY,
      JSON.stringify({ formatIds: selectedFormats, postRhythmId: postRhythm, articleRhythmId: articleRhythm }),
    );
  }, [articleRhythm, postRhythm, selectedFormats, storageReady]);

  const selectedPostRhythm = SELF_SERVICE_POST_RHYTHMS.find((option) => option.id === postRhythm)!;
  const selectedArticleRhythm = SELF_SERVICE_ARTICLE_RHYTHMS.find((option) => option.id === articleRhythm)!;
  const selectedCoreFormats = coreFormats.filter((format) => selectedFormats.includes(format.id));
  const selectedArticleFormats = selectedCoreFormats.filter((format) => format.kind === "article");
  const selectedPostFormats = selectedCoreFormats.filter((format) => format.kind === "post");
  const effectiveArticlesPerMonth = selectedArticleFormats.length > 0 ? selectedArticleRhythm.articlesPerMonth : 0;
  const selectedLabels = useMemo(
    () => SELF_SERVICE_FORMATS.filter((format) => selectedFormats.includes(format.id)).map((format) => format.shortLabel),
    [selectedFormats],
  );

  const toggleFormat = (formatId: SelfServiceFormatId) => {
    const next = selectedFormats.includes(formatId)
      ? selectedFormats.filter((id) => id !== formatId)
      : [...selectedFormats, formatId];
    const toggledFormat = SELF_SERVICE_FORMATS.find((format) => format.id === formatId);

    setSelectedFormats(next);

    if (toggledFormat?.kind === "article") {
      const hasArticlePlatform = SELF_SERVICE_FORMATS.some(
        (format) => format.kind === "article" && next.includes(format.id),
      );
      if (!hasArticlePlatform) setArticleRhythm("none");
      if (hasArticlePlatform && articleRhythm === "none") setArticleRhythm("one");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_18%_0%,rgba(139,92,246,0.16),transparent_38%),radial-gradient(circle_at_82%_12%,rgba(196,181,253,0.22),transparent_34%)]" />

      <div className="relative mx-auto max-w-[1180px]">
        <header className="flex items-center justify-between gap-4 rounded-[24px] border border-white/80 bg-white/75 px-4 py-3 shadow-[0_18px_55px_rgba(77,61,112,0.07)] backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <RibesBrand dark={false} />
          </div>
          <div className="flex items-center gap-2">
            <a href="/demo" className="rounded-full border border-violet-100 bg-white px-3.5 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50">Посмотреть демо</a>
            <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Новый лёгкий продукт
            </div>
          </div>
        </header>

        <section className="grid gap-7 py-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(520px,1.12fr)] lg:items-start lg:gap-12 lg:py-16">
          <div className="pt-2 lg:sticky lg:top-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/75 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm">
              <Icon name="sparkle" className="h-4 w-4" />
              Контент без агентского кабинета
            </div>
            <h1 className="mt-6 max-w-xl font-heading text-[42px] font-semibold leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-6xl">
              Спокойная система присутствия вашего бренда.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Один короткий бриф — и каждый месяц у вас есть темы, готовые тексты, статьи, визуалы и понятный календарь.
            </p>

            <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ["5–7 минут", "на настройку бренда"],
                ["до 2 тем", "в неделю"],
                ["1 кабинет", "без сложных ролей"],
              ].map(([value, label]) => (
                <div key={value} className="rounded-[20px] border border-white/90 bg-white/65 px-4 py-3 backdrop-blur">
                  <p className="text-sm font-semibold text-slate-950">{value}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/90 bg-white/90 p-5 shadow-[0_30px_100px_rgba(77,61,112,0.11)] backdrop-blur sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Шаг 1 из 4</p>
                <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.025em] text-slate-950">Настроим ваш ритм</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">Без десятков тарифных опций — только то, что действительно будете использовать.</p>
              </div>
              <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">25%</span>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Где вы хотите быть</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Выберите только нужные площадки.</p>
                </div>
                <span className="text-xs font-medium text-slate-400">{selectedCoreFormats.length} выбрано</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {coreFormats.map((format) => (
                  <SelectCard
                    key={format.id}
                    active={selectedFormats.includes(format.id)}
                    title={format.label}
                    description={format.description}
                    platform={platformBrandFromFormatId(format.id)}
                    onClick={() => toggleFormat(format.id)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-7 grid gap-6 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Публикации</h3>
                <div className="mt-3 grid gap-2">
                  {SELF_SERVICE_POST_RHYTHMS.map((option) => (
                    <SelectCard
                      key={option.id}
                      active={postRhythm === option.id}
                      title={option.label}
                      description={option.description}
                      onClick={() => setPostRhythm(option.id)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Длинные статьи</h3>
                <div className="mt-3 grid gap-2">
                  {SELF_SERVICE_ARTICLE_RHYTHMS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setArticleRhythm(option.id)}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        articleRhythm === option.id
                          ? "border-violet-300 bg-violet-50 text-violet-800"
                          : "border-slate-200/80 bg-white text-slate-700 hover:border-violet-200"
                      }`}
                    >
                      {option.label}
                      <span className={`h-2 w-2 rounded-full ${articleRhythm === option.id ? "bg-violet-600" : "bg-slate-200"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-7 border-t border-slate-100 pt-6">
              <h3 className="text-sm font-semibold text-slate-950">Простые инструменты по запросу</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Они не усложняют календарь и открываются отдельной быстрой кнопкой.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {helperFormats.map((format) => (
                  <SelectCard
                    key={format.id}
                    active={selectedFormats.includes(format.id)}
                    title={format.label}
                    description={format.description}
                    onClick={() => toggleFormat(format.id)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-7 rounded-[22px] bg-slate-950 px-5 py-4 text-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-300">Ваш будущий набор</p>
                  <p className="mt-1 text-sm font-semibold">
                    {selectedPostFormats.length > 0
                      ? `${selectedPostRhythm.postsPerWeek} ${selectedPostRhythm.postsPerWeek === 1 ? "тема" : "темы"} в неделю`
                      : "без постов"}
                    {" · "}
                    {effectiveArticlesPerMonth === 0
                      ? "без статей"
                      : `${effectiveArticlesPerMonth} ${effectiveArticlesPerMonth === 1 ? "статья" : "статьи"} в месяц`}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">{selectedLabels.length > 0 ? selectedLabels.join(" · ") : "Выберите хотя бы один формат"}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      selfServiceBriefHref({
                        formatIds: selectedFormats,
                        postRhythmId: postRhythm,
                        articleRhythmId: articleRhythm,
                      }),
                    )
                  }
                  disabled={selectedCoreFormats.length === 0}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  Дальше к брифу
                  <Icon name="arrow" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
