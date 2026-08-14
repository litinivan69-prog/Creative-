"use client";

import { useEffect, useRef, useState } from "react";
import { saveSelfServiceMaterialText } from "@/lib/self-service/material-actions";

export function MaterialEditor(props: { itemId: string; initialBody: string; ready: boolean; article?: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(props.initialBody);
  const [copied, setCopied] = useState(false);
  const changed = body.trim() !== props.initialBody.trim();
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 180));

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(320, textarea.scrollHeight)}px`;
  }, [body]);

  async function copyText() {
    if (!body) return;
    await navigator.clipboard.writeText(body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!props.ready) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-[22px] border border-dashed border-white/[0.08] bg-black/15 p-8 text-center">
        <div><span className="mx-auto block h-2.5 w-2.5 animate-pulse rounded-full bg-violet-400" /><p className="mt-4 text-sm font-semibold text-white/75">Текст ещё готовится</p><p className="mt-2 text-xs leading-5 text-white/30">Он появится здесь автоматически.</p></div>
      </div>
    );
  }

  return (
    <form action={saveSelfServiceMaterialText} className="space-y-3">
      <input type="hidden" name="itemId" value={props.itemId} />
      <textarea
        ref={textareaRef}
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className={`${props.article ? "min-h-[720px]" : "min-h-[420px]"} w-full resize-none overflow-hidden rounded-[20px] border border-white/[0.07] bg-black/20 px-5 py-5 text-[15px] leading-7 text-white/72 outline-none transition placeholder:text-white/20 focus:border-violet-400/35 focus:bg-black/30 focus:ring-4 focus:ring-violet-500/[0.06]`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={copyText} className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-2.5 text-xs font-semibold text-white/52 transition hover:bg-white/[0.06] hover:text-white/80">{copied ? "Скопировано" : "Скопировать"}</button>{props.article ? <span className="text-[10px] text-white/25">{wordCount.toLocaleString("ru-RU")} слов · ≈ {readingMinutes} мин</span> : null}</div>
        <div className="flex items-center gap-3"><span className="text-[10px] text-white/22">{changed ? "есть изменения" : "сохранено"}</span><button disabled={!changed} className="rounded-xl bg-violet-500 px-5 py-2.5 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(124,92,255,.18)] transition hover:bg-violet-400 disabled:cursor-default disabled:bg-white/[0.06] disabled:text-white/25 disabled:shadow-none">Сохранить</button></div>
      </div>
    </form>
  );
}
