"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ribes_cookie_choice_v1";

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!window.localStorage.getItem(STORAGE_KEY)); }, []);
  const choose = (value: "essential" | "analytics") => { window.localStorage.setItem(STORAGE_KEY, value); setOpen(false); };
  useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener("ribes:cookie-settings", listener);
    return () => window.removeEventListener("ribes:cookie-settings", listener);
  }, []);
  if (!open) return null;
  return <aside role="dialog" aria-label="Настройки cookie" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-[22px] border border-white/10 bg-[#17131f]/95 p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-xl"><p className="text-xs leading-5 text-white/65">Мы используем необходимые cookie для входа и работы Ribes. Аналитика включается только с вашего согласия. <Link href="/legal/cookies" className="text-violet-300 underline">Подробнее</Link></p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => choose("analytics")} className="rounded-full bg-white px-4 py-2.5 text-[11px] font-semibold text-black">Разрешить аналитику</button><button type="button" onClick={() => choose("essential")} className="rounded-full border border-white/10 px-4 py-2.5 text-[11px] font-semibold text-white/65">Только необходимые</button></div></aside>;
}
