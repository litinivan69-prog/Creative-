import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { selfServiceMembershipWhere } from "@/lib/self-service/workspace";
import { BRAND_BRAIN_QUESTIONS, answeredBrandBrainKeys } from "@/lib/self-service/brand-brain";
import { addBrandBrainFile, answerBrandBrainQuestion } from "@/lib/self-service/brand-brain-actions";
import { darkCardClass, SelfServiceAppShell } from "@/app/(self-service)/app/self-service-app-shell";

export const dynamic = "force-dynamic";

export default async function BrandBrainPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) redirect("/sign-in?callbackUrl=/app/brand-brain");
  const membership = await prisma.workspaceMembership.findFirst({
    where: await selfServiceMembershipWhere(email),
    include: { client: { include: { brandAssets: { where: { status: "active" }, orderBy: { createdAt: "asc" } } } } },
  });
  if (!membership) redirect("/start");
  const answers = membership.client.brandAssets.filter((asset) => asset.assetType === "brand_knowledge");
  const answered = answeredBrandBrainKeys(answers);
  const nextQuestion = BRAND_BRAIN_QUESTIONS.find((question) => !answered.has(question.key));
  const progress = Math.round((answered.size / BRAND_BRAIN_QUESTIONS.length) * 100);
  const files = membership.client.brandAssets.filter((asset) => asset.assetType !== "brand_knowledge");

  return <SelfServiceAppShell brandName={membership.client.name} active="brain" eyebrow="Знания о бренде" title="Мозг бренда" description="Не анкета: Ribes задаёт один вопрос за раз и запоминает ответы для следующих материалов.">
    <section className="mx-auto max-w-4xl">
      <div className="mb-4 rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-white/65">Насколько хорошо Ribes знает бренд</span><span className="text-violet-300">{progress}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} /></div></div>
      {query.notice === "saved" ? <p className="mb-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.06] p-3 text-xs text-emerald-200">Запомнил. Следующий вопрос уже готов.</p> : null}
      {query.notice === "file_saved" ? <p className="mb-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.06] p-3 text-xs text-emerald-200">Материал сохранён и будет использоваться в новых генерациях.</p> : null}
      <div className="space-y-3">
        {answers.map((answer) => <div key={answer.id}><div className="max-w-[86%] rounded-2xl rounded-bl-md bg-white/[.045] p-4 text-sm leading-6 text-white/65">{answer.title}</div><div className="ml-auto mt-2 max-w-[86%] rounded-2xl rounded-br-md bg-violet-500/15 p-4 text-sm leading-6 text-white/80">{answer.textContent}</div></div>)}
        {nextQuestion ? <div className="pt-3"><div className="max-w-[90%] rounded-2xl rounded-bl-md border border-violet-400/15 bg-[linear-gradient(135deg,rgba(124,92,255,.14),rgba(255,255,255,.035))] p-5"><p className="text-lg font-semibold tracking-[-.02em]">{nextQuestion.text}</p><p className="mt-2 text-xs leading-5 text-white/38">{nextQuestion.hint}</p></div>
          {nextQuestion.choices ? <div className="mt-3 flex flex-wrap gap-2">{nextQuestion.choices.map((choice) => <form action={answerBrandBrainQuestion} key={choice}><input type="hidden" name="questionKey" value={nextQuestion.key}/><input type="hidden" name="answer" value={choice}/><button className="rounded-full border border-white/[.09] bg-white/[.035] px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-violet-400/35 hover:text-white">{choice}</button></form>)}</div> : null}
          <form action={answerBrandBrainQuestion} className="mt-3"><input type="hidden" name="questionKey" value={nextQuestion.key}/><textarea name="answer" required minLength={2} maxLength={5000} rows={4} placeholder="Ответьте как удобно…" className="w-full resize-y rounded-2xl border border-white/[.09] bg-white/[.035] p-4 text-sm leading-6 text-white outline-none placeholder:text-white/20 focus:border-violet-400/45"/><div className="mt-2 flex justify-end"><button className="rounded-full bg-violet-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-400">Отправить →</button></div></form>
        </div> : <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/[.055] p-6"><p className="text-xl font-semibold">Основа собрана</p><p className="mt-2 text-sm leading-6 text-white/45">Ribes будет использовать эти знания во всех новых постах, статьях и визуалах. Возвращайтесь сюда, когда у бренда что-то изменится.</p></div>}
      </div>
      <section className={`${darkCardClass} mt-6 p-5`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Материалы бренда</h2><p className="mt-1 text-xs text-white/30">Логотипы, реальные фото, брендбук и удачные старые публикации.</p></div><span className="rounded-full bg-white/[.04] px-3 py-1 text-[10px] text-white/35">{files.length} файлов</span></div><form action={addBrandBrainFile} className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_auto]"><select name="assetType" className="rounded-xl border border-white/[.08] bg-[#111016] px-3 py-3 text-xs text-white"><option value="photo">Фотография</option><option value="logo">Логотип</option><option value="brandbook">Брендбук</option><option value="old_post">Старый пост</option><option value="reference">Референс</option></select><input required name="file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,text/plain" className="rounded-xl border border-white/[.08] bg-white/[.025] p-2 text-xs text-white/45 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"/><button className="rounded-xl bg-white px-4 py-3 text-xs font-semibold text-black">Добавить</button></form>{files.length ? <div className="mt-4 flex flex-wrap gap-2">{files.map((file) => <span key={file.id} className="max-w-full truncate rounded-full border border-white/[.07] px-3 py-1.5 text-[10px] text-white/40">{file.title}</span>)}</div> : null}</section>
    </section>
  </SelfServiceAppShell>;
}
