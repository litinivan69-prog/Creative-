"use client";

import { useState } from "react";

export function InstantResult({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="whitespace-pre-wrap rounded-2xl border border-white/[0.07] bg-black/20 p-5 text-sm leading-7 text-white/70">{text}</div>
      <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }} className="mt-3 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950">{copied ? "Скопировано" : "Скопировать текст"}</button>
    </div>
  );
}
