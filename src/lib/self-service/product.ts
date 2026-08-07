export const SELF_SERVICE_FORMATS = [
  {
    id: "vk_post",
    label: "Посты VK",
    shortLabel: "VK",
    description: "Содержательные посты с понятной структурой и нативной подачей для сообщества.",
    kind: "post",
    platform: "VK",
    core: true,
  },
  {
    id: "telegram_post",
    label: "Посты Telegram",
    shortLabel: "Telegram",
    description: "Более короткая и живая версия темы без механического копирования текста из VK.",
    kind: "post",
    platform: "Telegram",
    core: true,
  },
  {
    id: "dzen_article",
    label: "Статьи Дзен",
    shortLabel: "Дзен",
    description: "Полноценные экспертные статьи с обложкой, структурой и готовым текстом.",
    kind: "article",
    platform: "Дзен",
    core: true,
  },
  {
    id: "vcru_article",
    label: "Статьи VC.ru",
    shortLabel: "VC.ru",
    description: "Деловые статьи, кейсы и разборы, адаптированные под аудиторию площадки.",
    kind: "article",
    platform: "VC.ru",
    core: true,
  },
  {
    id: "quick_announcement",
    label: "Быстрый анонс",
    shortLabel: "Анонс",
    description: "Короткая новость, событие или предложение вне основного плана — по запросу.",
    kind: "helper",
    platform: null,
    core: false,
  },
  {
    id: "review_reply",
    label: "Ответ на отзыв",
    shortLabel: "Отзывы",
    description: "Спокойный ответ в тоне бренда: вставьте отзыв и получите готовую формулировку.",
    kind: "helper",
    platform: null,
    core: false,
  },
] as const;

export type SelfServiceFormatId = (typeof SELF_SERVICE_FORMATS)[number]["id"];

export const SELF_SERVICE_POST_RHYTHMS = [
  {
    id: "calm",
    postsPerWeek: 1,
    label: "1 тема в неделю",
    description: "Минимальное стабильное присутствие — четыре темы в месяц.",
  },
  {
    id: "regular",
    postsPerWeek: 2,
    label: "2 темы в неделю",
    description: "Основной режим — до восьми тем в месяц без контентного шума.",
  },
] as const;

export const SELF_SERVICE_ARTICLE_RHYTHMS = [
  { id: "none", articlesPerMonth: 0, label: "Без статей" },
  { id: "one", articlesPerMonth: 1, label: "1 статья в месяц" },
  { id: "two", articlesPerMonth: 2, label: "2 статьи в месяц" },
] as const;

export type SelfServicePostRhythmId = (typeof SELF_SERVICE_POST_RHYTHMS)[number]["id"];
export type SelfServiceArticleRhythmId = (typeof SELF_SERVICE_ARTICLE_RHYTHMS)[number]["id"];

export type SelfServiceSelection = {
  formatIds: SelfServiceFormatId[];
  postRhythmId: SelfServicePostRhythmId;
  articleRhythmId: SelfServiceArticleRhythmId;
};

export const DEFAULT_SELF_SERVICE_SELECTION: SelfServiceSelection = {
  formatIds: ["vk_post", "telegram_post", "dzen_article", "vcru_article"],
  postRhythmId: "regular",
  articleRhythmId: "two",
};

function isFormatId(value: string): value is SelfServiceFormatId {
  return SELF_SERVICE_FORMATS.some((format) => format.id === value);
}

function isPostRhythmId(value: string): value is SelfServicePostRhythmId {
  return SELF_SERVICE_POST_RHYTHMS.some((rhythm) => rhythm.id === value);
}

function isArticleRhythmId(value: string): value is SelfServiceArticleRhythmId {
  return SELF_SERVICE_ARTICLE_RHYTHMS.some((rhythm) => rhythm.id === value);
}

export function parseSelfServiceSelection(input: {
  formats?: string;
  posts?: string;
  articles?: string;
}): SelfServiceSelection {
  const formatIds = Array.from(
    new Set((input.formats ?? "").split(",").map((value) => value.trim()).filter(isFormatId)),
  );

  return {
    formatIds: formatIds.length > 0 ? formatIds : DEFAULT_SELF_SERVICE_SELECTION.formatIds,
    postRhythmId: input.posts && isPostRhythmId(input.posts) ? input.posts : DEFAULT_SELF_SERVICE_SELECTION.postRhythmId,
    articleRhythmId:
      input.articles && isArticleRhythmId(input.articles)
        ? input.articles
        : DEFAULT_SELF_SERVICE_SELECTION.articleRhythmId,
  };
}

export function selfServiceBriefHref(selection: SelfServiceSelection) {
  const params = new URLSearchParams({
    formats: selection.formatIds.join(","),
    posts: selection.postRhythmId,
    articles: selection.articleRhythmId,
  });

  return `/start/brief?${params.toString()}`;
}

export const SELF_SERVICE_ROUTES = {
  start: "/start",
  signIn: "/sign-in",
  checkout: "/checkout",
  home: "/app",
  month: "/app/month",
  brand: "/app/brand",
  settings: "/app/settings",
} as const;
