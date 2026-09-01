"use client";

import { useState } from "react";

export function ArticleCopyButton({ targetId }: { targetId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyArticle() {
    const article = document.getElementById(targetId);
    if (!article) return;

    const plainText = article.innerText.trim();
    const clone = article.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("img").forEach((image) => {
      image.src = new URL(image.getAttribute("src") || image.src, window.location.href).href;
      image.setAttribute("style", "display:block;max-width:100%;height:auto;margin:24px auto;border-radius:12px;");
    });
    clone.querySelectorAll("h1,h2,h3,h4").forEach((heading) => heading.setAttribute("style", "font-family:Arial,sans-serif;font-weight:700;line-height:1.2;margin:28px 0 12px;"));
    clone.querySelectorAll("p,li").forEach((paragraph) => paragraph.setAttribute("style", "font-family:Arial,sans-serif;font-size:16px;line-height:1.65;margin:0 0 14px;"));
    clone.querySelectorAll("ul,ol").forEach((list) => list.setAttribute("style", "font-family:Arial,sans-serif;margin:14px 0 20px;padding-left:24px;"));
    const html = `<article style="font-family:Arial,sans-serif;color:#111;max-width:760px;">${clone.innerHTML.trim()}</article>`;

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
