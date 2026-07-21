"use client";

import { useState } from "react";
import { updateGeoAudit } from "@/app/actions";
import { PendingSubmitButton } from "@/app/pending-submit-button";

export type GeoAuditFormValues = {
  id: string;
  auditDateISO: string;
  periodLabel: string;
  presenceIndex: number;
  sovScore: number;
  sovMax: number;
  positionScore: number;
  positionMax: number;
  toneScore: number;
  toneMax: number;
  accuracyScore: number;
  accuracyMax: number;
  sovPercent: number;
  mentionPercent: number;
  queriesTotal: number;
  queriesCategorical: number;
  queriesBrand: number;
  notes: string;
  engineResults: Array<{ engine: string; mentions: number; spontaneous: number }>;
  competitors: Array<{ name: string; mentions: number; sharePercent: number | null; note: string | null }>;
  sources: Array<{ domain: string; citations: number | null }>;
  growthPoints: Array<{ area: string; citations: number | null; note: string | null }>;
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const labelClass = "grid gap-1.5 text-xs font-bold text-stone-600";
const rowRemoveClass = "rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs font-semibold text-stone-500 transition hover:border-rose-200 hover:text-rose-700";
const addRowClass = "justify-self-start rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100";

function NumberField({ label, name, defaultValue }: { label: string; name: string; defaultValue: number }) {
  return (
    <label className={labelClass}>
      {label}
      <input type="number" name={name} defaultValue={defaultValue} className={inputClass} />
    </label>
  );
}

export function GeoAuditForm({ audit }: { audit: GeoAuditFormValues }) {
  const [engines, setEngines] = useState(audit.engineResults);
  const [competitors, setCompetitors] = useState(audit.competitors);
  const [sources, setSources] = useState(audit.sources);
  const [growth, setGrowth] = useState(audit.growthPoints);

  return (
    <form action={updateGeoAudit} className="grid gap-6">
      <input type="hidden" name="geoAuditId" value={audit.id} />
      <input type="hidden" name="engineResults" value={JSON.stringify(engines)} />
      <input type="hidden" name="competitors" value={JSON.stringify(competitors)} />
      <input type="hidden" name="sources" value={JSON.stringify(sources)} />
      <input type="hidden" name="growthPoints" value={JSON.stringify(growth)} />

      <section className="grid gap-3">
        <p className="text-sm font-bold text-stone-950">Период и индекс присутствия</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>
            Дата аудита
            <input type="date" name="auditDate" defaultValue={audit.auditDateISO.slice(0, 10)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Период (подпись)
            <input type="text" name="periodLabel" defaultValue={audit.periodLabel} className={inputClass} placeholder="Июнь 2026" />
          </label>
          <NumberField label="Индекс присутствия (0-100)" name="presenceIndex" defaultValue={audit.presenceIndex} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="SoV балл" name="sovScore" defaultValue={audit.sovScore} />
            <NumberField label="из" name="sovMax" defaultValue={audit.sovMax} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Позиция балл" name="positionScore" defaultValue={audit.positionScore} />
            <NumberField label="из" name="positionMax" defaultValue={audit.positionMax} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Тональность балл" name="toneScore" defaultValue={audit.toneScore} />
            <NumberField label="из" name="toneMax" defaultValue={audit.toneMax} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Точность балл" name="accuracyScore" defaultValue={audit.accuracyScore} />
            <NumberField label="из" name="accuracyMax" defaultValue={audit.accuracyMax} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className={labelClass}>
            Share of Voice, %
            <input type="text" name="sovPercent" defaultValue={audit.sovPercent} className={inputClass} placeholder="44.4" />
          </label>
          <label className={labelClass}>
            Упоминания бренда, %
            <input type="text" name="mentionPercent" defaultValue={audit.mentionPercent} className={inputClass} placeholder="60" />
          </label>
          <NumberField label="Запросов всего" name="queriesTotal" defaultValue={audit.queriesTotal} />
          <NumberField label="Категорийных" name="queriesCategorical" defaultValue={audit.queriesCategorical} />
          <NumberField label="Брендовых" name="queriesBrand" defaultValue={audit.queriesBrand} />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-stone-950">По нейросетям</p>
        </div>
        <div className="grid gap-2">
          {engines.map((entry, index) => (
            <div key={index} className="grid grid-cols-[1fr_90px_90px_auto] items-end gap-2">
              <label className={labelClass}>
                {index === 0 ? "Движок" : ""}
                <input
                  className={inputClass}
                  value={entry.engine}
                  onChange={(event) => setEngines((prev) => prev.map((row, i) => (i === index ? { ...row, engine: event.target.value } : row)))}
                  placeholder="perplexity"
                />
              </label>
              <label className={labelClass}>
                {index === 0 ? "Упоминаний" : ""}
                <input type="number" className={inputClass} value={entry.mentions}
                  onChange={(event) => setEngines((prev) => prev.map((row, i) => (i === index ? { ...row, mentions: Number(event.target.value) } : row)))} />
              </label>
              <label className={labelClass}>
                {index === 0 ? "Спонтанных" : ""}
                <input type="number" className={inputClass} value={entry.spontaneous}
                  onChange={(event) => setEngines((prev) => prev.map((row, i) => (i === index ? { ...row, spontaneous: Number(event.target.value) } : row)))} />
              </label>
              <button type="button" className={rowRemoveClass} onClick={() => setEngines((prev) => prev.filter((_, i) => i !== index))}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className={addRowClass} onClick={() => setEngines((prev) => [...prev, { engine: "", mentions: 0, spontaneous: 0 }])}>+ Движок</button>
      </section>

      <section className="grid gap-3">
        <p className="text-sm font-bold text-stone-950">Конкуренты (кого ИИ советует вместо бренда)</p>
        <div className="grid gap-2">
          {competitors.map((entry, index) => (
            <div key={index} className="grid grid-cols-[1fr_90px_90px_auto] items-end gap-2">
              <label className={labelClass}>
                {index === 0 ? "Название" : ""}
                <input className={inputClass} value={entry.name}
                  onChange={(event) => setCompetitors((prev) => prev.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))} placeholder="Almaz Club" />
              </label>
              <label className={labelClass}>
                {index === 0 ? "Упоминаний" : ""}
                <input type="number" className={inputClass} value={entry.mentions}
                  onChange={(event) => setCompetitors((prev) => prev.map((row, i) => (i === index ? { ...row, mentions: Number(event.target.value) } : row)))} />
              </label>
              <label className={labelClass}>
                {index === 0 ? "Доля, %" : ""}
                <input type="number" className={inputClass} value={entry.sharePercent ?? ""}
                  onChange={(event) => setCompetitors((prev) => prev.map((row, i) => (i === index ? { ...row, sharePercent: event.target.value === "" ? null : Number(event.target.value) } : row)))} />
              </label>
              <button type="button" className={rowRemoveClass} onClick={() => setCompetitors((prev) => prev.filter((_, i) => i !== index))}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className={addRowClass} onClick={() => setCompetitors((prev) => [...prev, { name: "", mentions: 0, sharePercent: null, note: null }])}>+ Конкурент</button>
      </section>

      <section className="grid gap-3">
        <p className="text-sm font-bold text-stone-950">Источники (домены, на которые ссылается ИИ)</p>
        <div className="grid gap-2">
          {sources.map((entry, index) => (
            <div key={index} className="grid grid-cols-[1fr_110px_auto] items-end gap-2">
              <label className={labelClass}>
                {index === 0 ? "Домен" : ""}
                <input className={inputClass} value={entry.domain}
                  onChange={(event) => setSources((prev) => prev.map((row, i) => (i === index ? { ...row, domain: event.target.value } : row)))} placeholder="strelagym.ru" />
              </label>
              <label className={labelClass}>
                {index === 0 ? "Цитирований" : ""}
                <input type="number" className={inputClass} value={entry.citations ?? ""}
                  onChange={(event) => setSources((prev) => prev.map((row, i) => (i === index ? { ...row, citations: event.target.value === "" ? null : Number(event.target.value) } : row)))} />
              </label>
              <button type="button" className={rowRemoveClass} onClick={() => setSources((prev) => prev.filter((_, i) => i !== index))}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className={addRowClass} onClick={() => setSources((prev) => [...prev, { domain: "", citations: null }])}>+ Источник</button>
      </section>

      <section className="grid gap-3">
        <p className="text-sm font-bold text-stone-950">Точки роста</p>
        <div className="grid gap-2">
          {growth.map((entry, index) => (
            <div key={index} className="grid grid-cols-[1fr_110px_auto] items-end gap-2">
              <label className={labelClass}>
                {index === 0 ? "Направление" : ""}
                <input className={inputClass} value={entry.area}
                  onChange={(event) => setGrowth((prev) => prev.map((row, i) => (i === index ? { ...row, area: event.target.value } : row)))} placeholder="Медиа и контент" />
              </label>
              <label className={labelClass}>
                {index === 0 ? "Цитирований" : ""}
                <input type="number" className={inputClass} value={entry.citations ?? ""}
                  onChange={(event) => setGrowth((prev) => prev.map((row, i) => (i === index ? { ...row, citations: event.target.value === "" ? null : Number(event.target.value) } : row)))} />
              </label>
              <button type="button" className={rowRemoveClass} onClick={() => setGrowth((prev) => prev.filter((_, i) => i !== index))}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className={addRowClass} onClick={() => setGrowth((prev) => [...prev, { area: "", citations: null, note: null }])}>+ Точка роста</button>
      </section>

      <label className={labelClass}>
        Заметка (необязательно)
        <input type="text" name="notes" defaultValue={audit.notes} className={inputClass} placeholder="Комментарий менеджера" />
      </label>

      <PendingSubmitButton pendingLabel="Сохраняем..." className="justify-self-start rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-[0.99]">
        Сохранить аудит
      </PendingSubmitButton>
    </form>
  );
}
