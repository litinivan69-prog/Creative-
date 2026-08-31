"use client";

import { useState } from "react";

export function ArticleCopyButton({ targetId }: { targetId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyArticle() {
    const article = document.getElementById(targetId);
    if (!article) return;

    const plainText = article.innerText.trim();
    const html = article.innerHTML.trim();

    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([plainText], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      setState("copied");
      window.setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 2600);
    }
  }

  return (
    <button
      type="button"
      onClick={copyArticle}
      className="rounded-xl bg-violet-500 px-4 py-3 text-xs font-semibold text-white transition hover:bg-violet-400"
    >
      {state === "copied" ? "Статья скопирована" : state === "failed" ? "Не удалось скопировать" : "Скопировать с форматированием"}
    </button>
  );
}
