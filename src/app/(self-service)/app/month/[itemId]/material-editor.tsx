"use client";

import { useEffect, useRef, useState } from "react";
import { saveSelfServiceMaterialText } from "@/lib/self-service/material-actions";

export function MaterialEditor(props: { itemId: string; initialBody: string; ready: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(props.initialBody);
  const [copied, setCopied] = useState(false);

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
      <div className="grid min-h-[360px] place-items-center rounded-[24px] border border-dashed border-violet-200 bg-violet-50/45 p-8 text-center">
        <div><span className="mx-auto block h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500" /><p className="mt-4 text-sm font-semibold text-slate-900">Текст ещё готовится</p><p className="mt-2 text-xs leading-5 text-slate-500">Он появится здесь автоматически после завершения текущего шага.</p></div>
      </div>
    );
  }

  return (
    <form action={saveSelfServiceMaterialText} className="space-y-4">
      <input type="hidden" name="itemId" value={props.itemId} />
      <textarea
        ref={textareaRef}
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="min-h-[320px] w-full resize-none overflow-hidden rounded-[24px] border border-slate-200 bg-[#fcfcfd] px-5 py-5 text-[15px] leading-7 text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/60"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={copyText} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700">{copied ? "Скопировано" : "Скопировать текст"}</button>
        <button className="rounded-2xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(124,58,237,0.2)] transition hover:bg-violet-700">Сохранить изменения</button>
      </div>
    </form>
  );
}
