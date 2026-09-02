"use client";

import { useFormStatus } from "react-dom";
import { regenerateSelfServiceVisual } from "@/lib/self-service/material-actions";

function RevisionSubmitButton({ costLabel }: { costLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="w-full rounded-xl bg-violet-500 px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Вносим правки · обычно 1–3 минуты…" : `Внести правки · ${costLabel}`}
    </button>
  );
}

export function VisualRevisionForm({
  itemId,
  creativeAssetId,
  label,
  costLabel,
  availabilityLabel,
}: {
  itemId: string;
  creativeAssetId: string;
  label: string;
  costLabel: string;
  availabilityLabel: string;
}) {
  return (
    <details className="group rounded-xl border border-violet-400/15 bg-violet-500/[0.07] p-3">
      <summary className="cursor-pointer list-none text-[10px] font-semibold text-violet-200">
        Внести правки в {label}
        <span className="float-right text-white/25 transition group-open:rotate-45">+</span>
      </summary>
      <form action={regenerateSelfServiceVisual} className="mt-3 space-y-2">
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="creativeAssetId" value={creativeAssetId} />
        <textarea
          name="revisionInstruction"
          required
          minLength={5}
          maxLength={1000}
          rows={3}
          placeholder="Например: заменить фон на светлый, убрать человека и оставить точный текст без изменений"
          className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[11px] leading-5 text-white/70 outline-none placeholder:text-white/20 focus:border-violet-400/35"
        />
        <p className="text-[9px] leading-4 text-white/28">{availabilityLabel}. Предыдущий вариант останется в истории.</p>
        <RevisionSubmitButton costLabel={costLabel} />
      </form>
    </details>
  );
}
