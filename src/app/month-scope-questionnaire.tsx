"use client";

import { useState } from "react";
import { AutoTextarea } from "@/app/auto-textarea";

const postsPerWeekOptions = [
  { value: "2", label: "2 поста в неделю", description: "Спокойный ритм" },
  { value: "3", label: "3 поста в неделю", description: "Рекомендуем большинству" },
  { value: "5", label: "5 постов в неделю", description: "Активное присутствие" },
];

const articlesPerMonthOptions = [
  { value: "0", label: "Без статей", description: "Только посты" },
  { value: "2", label: "2 статьи в месяц", description: "Лёгкое GEO-ядро" },
  { value: "4", label: "4 статьи в месяц", description: "Рекомендуем для GEO" },
];

function OptionCards({
  options,
  selected,
  customValue,
  customLabel,
  onSelect,
  onCustom,
}: {
  options: Array<{ value: string; label: string; description: string }>;
  selected: string;
  customValue: string;
  customLabel: string;
  onSelect: (value: string) => void;
  onCustom: (value: string) => void;
}) {
  const isCustom = selected === "custom";

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          aria-pressed={selected === option.value}
          className={`rounded-xl border p-3.5 text-left transition active:scale-[0.99] ${
            selected === option.value
              ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
              : "border-stone-200 bg-white hover:border-violet-200"
          }`}
        >
          <p className={`text-sm font-bold ${selected === option.value ? "text-violet-800" : "text-stone-800"}`}>{option.label}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">{option.description}</p>
        </button>
      ))}
      <div
        className={`rounded-xl border p-3.5 transition ${
          isCustom ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200" : "border-stone-200 bg-white hover:border-violet-200"
        }`}
      >
        <button type="button" onClick={() => onSelect("custom")} className="w-full text-left" aria-pressed={isCustom}>
          <p className={`text-sm font-bold ${isCustom ? "text-violet-800" : "text-stone-800"}`}>Свой вариант</p>
        </button>
        <input
          type="number"
          min={0}
          max={30}
          value={customValue}
          onFocus={() => onSelect("custom")}
          onChange={(event) => onCustom(event.target.value)}
          placeholder={customLabel}
          className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-violet-400"
        />
      </div>
    </div>
  );
}

/**
 * Chat-assistant-style month scope: big option cards instead of raw textareas.
 * Emits the SAME form fields the plan generation action already reads
 * (scopeAllowedPlatforms / scopeCadenceRules / scopeStrategicThemes / ...),
 * so the server flow is untouched. Advanced textareas stay under «Дополнительно».
 */
export function MonthScopeQuestionnaire({
  platformOptions,
  defaultSelected,
}: {
  platformOptions: string[];
  defaultSelected: string[];
}) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(defaultSelected);
  const [customPlatform, setCustomPlatform] = useState("");
  const [postsChoice, setPostsChoice] = useState("3");
  const [postsCustom, setPostsCustom] = useState("");
  const [articlesChoice, setArticlesChoice] = useState("4");
  const [articlesCustom, setArticlesCustom] = useState("");

  const allPlatforms = [...platformOptions];
  for (const platform of selectedPlatforms) {
    if (!allPlatforms.includes(platform)) allPlatforms.push(platform);
  }

  const postsPerWeek = postsChoice === "custom" ? postsCustom.trim() : postsChoice;
  const articlesPerMonth = articlesChoice === "custom" ? articlesCustom.trim() : articlesChoice;
  const cadenceRules = [
    postsPerWeek ? `${postsPerWeek} поста в неделю на каждую площадку` : "",
    articlesPerMonth !== "" ? `статьи ${articlesPerMonth} в месяц` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((entry) => entry !== platform) : [...prev, platform],
    );
  };

  const addCustomPlatform = () => {
    const value = customPlatform.trim();
    if (!value) return;
    if (!selectedPlatforms.includes(value)) setSelectedPlatforms((prev) => [...prev, value]);
    setCustomPlatform("");
  };

  return (
    <div className="grid gap-7">
      <input type="hidden" name="scopeAllowedPlatforms" value={selectedPlatforms.join("\n")} />
      <input type="hidden" name="scopeCadenceRules" value={cadenceRules} />
      <input type="hidden" name="articlesPerMonth" value={articlesPerMonth} />

      <section>
        <p className="text-lg font-bold text-stone-950">Где публикуем?</p>
        <p className="mt-1 text-sm text-stone-500">Активные каналы месяца — можно добавить свой.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {allPlatforms.map((platform) => {
            const active = selectedPlatforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                  active
                    ? "border-violet-400 bg-violet-600 text-white"
                    : "border-stone-200 bg-white text-stone-700 hover:border-violet-300 hover:text-violet-700"
                }`}
              >
                {platform}
              </button>
            );
          })}
          <span className="inline-flex items-center gap-1.5">
            <input
              value={customPlatform}
              onChange={(event) => setCustomPlatform(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomPlatform();
                }
              }}
              placeholder="Свой канал…"
              className="w-36 rounded-full border border-dashed border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-700 outline-none focus:border-violet-400"
            />
            {customPlatform.trim() ? (
              <button type="button" onClick={addCustomPlatform} className="rounded-full bg-violet-100 px-3 py-2 text-sm font-bold text-violet-700">
                +
              </button>
            ) : null}
          </span>
        </div>
      </section>

      <section>
        <p className="text-lg font-bold text-stone-950">Как часто посты?</p>
        <p className="mt-1 text-sm text-stone-500">Лимит соблюдается автоматически: план не насыпет больше.</p>
        <div className="mt-3">
          <OptionCards
            options={postsPerWeekOptions}
            selected={postsChoice}
            customValue={postsCustom}
            customLabel="Постов/нед"
            onSelect={setPostsChoice}
            onCustom={setPostsCustom}
          />
        </div>
      </section>

      <section>
        <p className="text-lg font-bold text-stone-950">Сколько статей в месяц?</p>
        <p className="mt-1 text-sm text-stone-500">Статьи — GEO-ядро: их цитируют нейросети и поиск.</p>
        <div className="mt-3">
          <OptionCards
            options={articlesPerMonthOptions}
            selected={articlesChoice}
            customValue={articlesCustom}
            customLabel="Статей/мес"
            onSelect={setArticlesChoice}
            onCustom={setArticlesCustom}
          />
        </div>
      </section>

      <section>
        <p className="text-lg font-bold text-stone-950">Темы месяца</p>
        <p className="mt-1 text-sm text-stone-500">О чём говорим в этом месяце — своими словами, по строке на тему.</p>
        <AutoTextarea
          name="scopeStrategicThemes"
          rows={3}
          placeholder="Например: запуск нового продукта, сезонное предложение, экспертные советы, закулисье команды..."
          className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-4 py-3.5 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
      </section>

      <details className="rounded-2xl border border-stone-200 bg-white">
        <summary className="cursor-pointer px-5 py-3.5 text-sm font-bold text-stone-700">Дополнительно: что делаем / не делаем, репутация</summary>
        <div className="grid gap-4 border-t border-stone-200 p-5">
          <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
            Что делаем
            <AutoTextarea
              name="scopeAllowedDeliverables"
              rows={4}
              defaultValue={"VK post\nTelegram post\nДзен article\nPost visual\nArticle visual"}
              className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
            Что НЕ делаем
            <AutoTextarea
              name="scopeForbiddenDeliverables"
              rows={4}
              defaultValue={"рекламные макеты\nсайт бренда\nOzon Seller\nemail\nлендинг\nнаружная реклама"}
              className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-stone-700">
            Репутационные задачи
            <AutoTextarea
              name="scopeReputationTasks"
              rows={3}
              placeholder="Yandex Maps: ответы на новые отзывы при наличии текста отзыва"
              className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
            />
          </label>
        </div>
      </details>
    </div>
  );
}
