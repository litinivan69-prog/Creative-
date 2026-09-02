"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { selectSelfServiceVisualVariant } from "@/lib/self-service/material-actions";

export type VisualGalleryGroup = {
  creativeAssetId: string;
  label: string;
  variants: Array<{ id: string; src: string; status: string; downloadHref: string }>;
};

function SelectButton({ selected }: { selected: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={selected || pending} className="rounded-xl bg-violet-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-violet-400 disabled:bg-white/[0.07] disabled:text-white/35">{pending ? "Сохраняем…" : selected ? "Выбран для публикации" : "Выбрать этот вариант"}</button>;
}

export function VisualGallery({ itemId, groups }: { itemId: string; groups: VisualGalleryGroup[] }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const group = groups[slideIndex];

  useEffect(() => {
    const approved = group?.variants.findIndex((variant) => variant.status === "approved") ?? -1;
    setVariantIndex(approved >= 0 ? approved : 0);
  }, [slideIndex, group]);

  if (!group?.variants.length) return null;
  const variant = group.variants[Math.min(variantIndex, group.variants.length - 1)];
  const selected = variant.status === "approved" || (!group.variants.some((item) => item.status === "approved") && variantIndex === 0);
  const moveSlide = (direction: number) => setSlideIndex((current) => (current + direction + groups.length) % groups.length);
  const moveVariant = (direction: number) => setVariantIndex((current) => (current + direction + group.variants.length) % group.variants.length);

  const imagePanel = (modal = false) => <div className={`relative overflow-hidden rounded-[18px] bg-black/30 ${modal ? "max-h-[86vh]" : ""}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={variant.src} alt={`${group.label}, вариант ${variantIndex + 1}`} className={`${modal ? "max-h-[86vh] w-auto max-w-[92vw] object-contain" : "aspect-square h-full w-full object-cover"}`} />
    {groups.length > 1 ? <><button type="button" onClick={(event) => { event.stopPropagation(); moveSlide(-1); }} aria-label="Предыдущий слайд" className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-lg text-white backdrop-blur">‹</button><button type="button" onClick={(event) => { event.stopPropagation(); moveSlide(1); }} aria-label="Следующий слайд" className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-lg text-white backdrop-blur">›</button></> : null}
    <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-semibold text-white/80 backdrop-blur">{slideIndex + 1} / {groups.length}</span>
  </div>;

  return <div>
    <button type="button" onClick={() => setOpen(true)} className="block w-full text-left" aria-label="Открыть галерею">{imagePanel()}</button>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
      <div><p className="text-[10px] font-semibold text-white/60">{group.label}</p><p className="mt-0.5 text-[9px] text-white/25">Вариант {variantIndex + 1} из {group.variants.length}</p></div>
      <div className="flex items-center gap-2">
        {group.variants.length > 1 ? <div className="flex rounded-xl border border-white/[0.07] bg-black/20 p-1"><button type="button" onClick={() => moveVariant(-1)} className="grid h-7 w-7 place-items-center rounded-lg text-white/55 hover:bg-white/[0.06]">‹</button><button type="button" onClick={() => moveVariant(1)} className="grid h-7 w-7 place-items-center rounded-lg text-white/55 hover:bg-white/[0.06]">›</button></div> : null}
        <a href={variant.downloadHref} className="rounded-xl border border-white/[0.07] px-3 py-2 text-[9px] font-semibold text-white/50">Скачать</a>
      </div>
    </div>
    <form action={selectSelfServiceVisualVariant} className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-2.5">
      <input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="creativeAssetId" value={group.creativeAssetId} /><input type="hidden" name="variantId" value={variant.id} />
      <p className="text-[9px] leading-4 text-white/28">Именно этот вариант уйдёт при публикации.</p><SelectButton selected={selected} />
    </form>
    {groups.length > 1 ? <div className="mt-3 grid grid-cols-4 gap-2">{groups.map((item, index) => { const active = item.variants.find((entry) => entry.status === "approved") ?? item.variants[0]; return <button key={item.creativeAssetId} type="button" onClick={() => setSlideIndex(index)} className={`relative overflow-hidden rounded-xl border ${index === slideIndex ? "border-violet-400/60" : "border-white/[0.06]"}`}><img src={active.src} alt={item.label} className="aspect-square h-full w-full object-cover opacity-80" /><span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/65 px-1.5 py-1 text-[8px] text-white/75">{index + 1}</span></button>; })}</div> : null}
    {open ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}><button type="button" onClick={() => setOpen(false)} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl text-white">×</button><div onClick={(event) => event.stopPropagation()}>{imagePanel(true)}<div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-white/65"><span>{group.label}</span><span className="text-white/25">·</span><span>вариант {variantIndex + 1}/{group.variants.length}</span>{group.variants.length > 1 ? <><button type="button" onClick={() => moveVariant(-1)} className="rounded-lg bg-white/10 px-3 py-1.5">Предыдущий вариант</button><button type="button" onClick={() => moveVariant(1)} className="rounded-lg bg-white/10 px-3 py-1.5">Следующий вариант</button></> : null}</div></div></div> : null}
  </div>;
}
