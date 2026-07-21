export type GeoDashboardAudit = {
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
  reportFileUrl: string | null;
  notes: string | null;
  engineResults: Array<{ engine: string; mentions: number; spontaneous: number }>;
  competitors: Array<{ name: string; mentions: number; sharePercent: number | null; note: string | null }>;
  sources: Array<{ domain: string; citations: number | null }>;
  growthPoints: Array<{ area: string; citations: number | null; note: string | null }>;
};

const ENGINE_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  yandexgpt: "YandexGPT",
  gigachat: "GigaChat",
  chatgpt: "ChatGPT",
  alice: "Алиса",
};

function engineLabel(engine: string) {
  return ENGINE_LABELS[engine] ?? engine;
}

function presenceTone(index: number) {
  if (index >= 80) return { label: "Сильная позиция", text: "text-violet-700" };
  if (index >= 60) return { label: "Хорошая позиция", text: "text-violet-700" };
  if (index >= 40) return { label: "Средняя позиция", text: "text-amber-700" };
  return { label: "Зона роста", text: "text-amber-700" };
}

function GeoRing({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid h-40 w-40 place-items-center">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#7c3aed ${safe * 3.6}deg, #ede9fe 0)` }} />
      <div className="relative grid h-32 w-32 place-items-center rounded-full bg-white shadow-[inset_0_2px_12px_rgba(88,75,135,0.10)]">
        <span className="font-heading text-4xl font-bold tabular-nums text-slate-950">{safe}</span>
        <span className="text-[11px] font-semibold text-slate-400">из 100</span>
      </div>
    </div>
  );
}

function Bar({ value, max, label, detail }: { value: number; max: number; label: string; detail?: string }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="rounded-2xl bg-[#faf7ff] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
        <p className="text-sm font-bold tabular-nums text-slate-950">{value}<span className="text-slate-400">/{max}</span></p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
        <div className="h-full rounded-full bg-violet-600" style={{ width: `${percent}%` }} />
      </div>
      {detail ? <p className="mt-1.5 text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

function TrendChart({ audits, goalPresence, goalSov }: { audits: GeoDashboardAudit[]; goalPresence?: number; goalSov?: number }) {
  const points = [...audits].sort((a, b) => a.auditDateISO.localeCompare(b.auditDateISO));
  if (points.length < 2) return null;

  const width = 640;
  const height = 180;
  const padX = 36;
  const padY = 24;
  const maxX = points.length - 1;

  const line = (getY: (audit: GeoDashboardAudit) => number, maxVal: number) =>
    points
      .map((audit, index) => {
        const x = padX + (index / maxX) * (width - padX * 2);
        const y = height - padY - (Math.max(0, Math.min(maxVal, getY(audit))) / maxVal) * (height - padY * 2);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const presenceLine = line((audit) => audit.presenceIndex, 100);
  const sovLine = line((audit) => audit.sovPercent, 100);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[520px]" role="img" aria-label="Динамика Индекса присутствия и SoV по месяцам">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - padY - (tick / 100) * (height - padY * 2);
          return (
            <g key={tick}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#ede9fe" strokeWidth={1} />
              <text x={8} y={y + 3} fontSize={9} fill="#94a3b8">{tick}</text>
            </g>
          );
        })}
        {goalPresence ? (
          <line x1={padX} y1={height - padY - (goalPresence / 100) * (height - padY * 2)} x2={width - padX} y2={height - padY - (goalPresence / 100) * (height - padY * 2)} stroke="#c4b5fd" strokeWidth={1.5} strokeDasharray="4 4" />
        ) : null}
        <path d={presenceLine} fill="none" stroke="#7c3aed" strokeWidth={2.5} />
        <path d={sovLine} fill="none" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 3" />
        {points.map((audit, index) => {
          const x = padX + (index / maxX) * (width - padX * 2);
          const y = height - padY - (audit.presenceIndex / 100) * (height - padY * 2);
          return <circle key={audit.id} cx={x} cy={y} r={3.5} fill="#7c3aed" />;
        })}
        {points.map((audit, index) => {
          const x = padX + (index / maxX) * (width - padX * 2);
          return <text key={`${audit.id}-lbl`} x={x} y={height - 6} fontSize={9} fill="#94a3b8" textAnchor="middle">{audit.periodLabel}</text>;
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-violet-600" /> Индекс присутствия</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-violet-300" /> Share of Voice, %</span>
        {goalPresence ? <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t border-dashed border-violet-300" /> Цель по индексу{goalSov ? ` · SoV ${goalSov}%` : ""}</span> : null}
      </div>
    </div>
  );
}

const cardClass = "rounded-[24px] border border-violet-100 bg-white p-5 shadow-[0_10px_28px_rgba(88,75,135,0.05)] sm:p-6";

/**
 * «Видимость в нейросетях» — the shared GEO dashboard used by the manager
 * console and the client portal. Pure presentation; no data-fetching here.
 */
export function GeoDashboard({
  audits,
  selected,
  goalPresence,
  goalSov,
  clientName,
}: {
  audits: GeoDashboardAudit[];
  selected: GeoDashboardAudit | null;
  goalPresence?: number;
  goalSov?: number;
  clientName?: string;
}) {
  if (!selected) {
    return (
      <div className={`${cardClass} text-center`}>
        <p className="font-heading text-xl font-bold text-slate-950">Видимость в нейросетях</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          GEO-аудитов пока нет. Как только Creative Command проведёт аудит присутствия {clientName ? `${clientName} ` : ""}в Perplexity, YandexGPT и GigaChat, здесь появятся Индекс присутствия, доля голоса и динамика по месяцам.
        </p>
      </div>
    );
  }

  const tone = presenceTone(selected.presenceIndex);
  const spontaneousTotal = selected.engineResults.reduce((sum, entry) => sum + entry.spontaneous, 0);
  const maxCompetitorMentions = Math.max(1, ...selected.competitors.map((entry) => entry.mentions));
  const maxSourceCitations = Math.max(1, ...selected.sources.map((entry) => entry.citations ?? 0));

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-12">
        <section className={`${cardClass} lg:col-span-5`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Индекс присутствия</p>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">{selected.periodLabel}</span>
          </div>
          <div className="mt-4 flex items-center gap-5">
            <GeoRing value={selected.presenceIndex} />
            <div>
              <p className={`text-base font-bold ${tone.text}`}>{tone.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">Составная метрика: SoV, позиция в ответе, тональность и точность фактов.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Bar value={selected.sovScore} max={selected.sovMax} label="Share of Voice" />
            <Bar value={selected.positionScore} max={selected.positionMax} label="Позиция" />
            <Bar value={selected.toneScore} max={selected.toneMax} label="Тональность" />
            <Bar value={selected.accuracyScore} max={selected.accuracyMax} label="Точность" />
          </div>
        </section>

        <section className={`${cardClass} lg:col-span-7`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Доля голоса и упоминания</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#faf7ff] p-5">
              <p className="font-heading text-4xl font-bold tabular-nums text-slate-950">{selected.sovPercent}%</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Share of Voice</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Как часто ИИ сам называет бренд в категорийных запросах.</p>
            </div>
            <div className="rounded-2xl bg-[#faf7ff] p-5">
              <p className="font-heading text-4xl font-bold tabular-nums text-slate-950">{selected.mentionPercent}%</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Упоминания бренда</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Доля из {selected.queriesTotal} запросов с упоминанием бренда.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white p-3 ring-1 ring-violet-50">
              <p className="text-lg font-bold tabular-nums text-slate-950">{selected.queriesTotal}</p>
              <p className="text-[11px] font-semibold text-slate-400">запросов</p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-violet-50">
              <p className="text-lg font-bold tabular-nums text-slate-950">{selected.queriesCategorical}</p>
              <p className="text-[11px] font-semibold text-slate-400">категорийных</p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-violet-50">
              <p className="text-lg font-bold tabular-nums text-slate-950">{selected.queriesBrand}</p>
              <p className="text-[11px] font-semibold text-slate-400">брендовых</p>
            </div>
          </div>
        </section>
      </div>

      {audits.length >= 2 ? (
        <section className={cardClass}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Динамика по месяцам</p>
            <p className="text-xs font-semibold text-slate-400">{audits.length} аудит{audits.length > 4 ? "ов" : "а"}</p>
          </div>
          <div className="mt-4">
            <TrendChart audits={audits} goalPresence={goalPresence} goalSov={goalSov} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cardClass}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">По нейросетям</p>
          <p className="mt-1 text-xs text-slate-400">Спонтанных упоминаний всего: {spontaneousTotal}</p>
          <div className="mt-4 grid gap-2">
            {selected.engineResults.length === 0 ? <p className="text-sm text-slate-400">Нет данных по движкам.</p> : null}
            {selected.engineResults.map((entry) => (
              <div key={entry.engine} className="flex items-center justify-between gap-3 rounded-xl bg-[#faf7ff] px-4 py-3">
                <p className="text-sm font-bold text-slate-950">{engineLabel(entry.engine)}</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold tabular-nums text-slate-950">{entry.mentions}</span>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">{entry.spontaneous} спонтанных</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Кого ИИ советует вместо бренда</p>
          <div className="mt-4 grid gap-2">
            {selected.competitors.length === 0 ? <p className="text-sm text-slate-400">Конкуренты не заданы.</p> : null}
            {selected.competitors.map((entry, index) => (
              <div key={index} className="rounded-xl bg-[#faf7ff] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-950">{entry.name}</p>
                  <p className="text-sm font-bold tabular-nums text-slate-950">{entry.mentions}{entry.sharePercent != null ? <span className="ml-1 text-xs font-semibold text-slate-400">· {entry.sharePercent}%</span> : null}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
                  <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.round((entry.mentions / maxCompetitorMentions) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Источники ИИ</p>
          <p className="mt-1 text-xs text-slate-400">Домены, на которые нейросеть ссылается при ответах.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.sources.length === 0 ? <p className="text-sm text-slate-400">Источники не заданы.</p> : null}
            {selected.sources.map((entry, index) => (
              <span key={index} className="inline-flex items-center gap-1.5 rounded-full bg-[#faf7ff] px-3 py-1.5 text-sm font-semibold text-slate-700">
                {entry.domain}
                {entry.citations != null ? <span className="rounded-full bg-violet-100 px-1.5 text-[11px] font-bold text-violet-700">{entry.citations}</span> : null}
              </span>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">Точки роста</p>
          <div className="mt-4 grid gap-2">
            {selected.growthPoints.length === 0 ? <p className="text-sm text-slate-400">Точки роста не заданы.</p> : null}
            {selected.growthPoints.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-3 rounded-xl bg-[#faf7ff] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{entry.area}</p>
                  {entry.note ? <p className="truncate text-xs text-slate-400">{entry.note}</p> : null}
                </div>
                {entry.citations != null ? <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">{entry.citations} цит.</span> : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      {selected.reportFileUrl ? (
        <a
          href={selected.reportFileUrl}
          target="_blank"
          rel="noreferrer"
          className="justify-self-start rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-[0.99]"
        >
          Скачать GEO-отчёт (PPTX)
        </a>
      ) : null}
    </div>
  );
}
