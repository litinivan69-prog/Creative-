import Link from "next/link";
import { RibesBrand } from "@/app/(self-service)/ribes-brand";

export const company = {
  name: "ООО «Криэйтив Комманд»",
  inn: "7816761274",
  ogrn: "1257800117409",
  kpp: "781601001",
  address: "192236, г. Санкт-Петербург, вн. тер. г. муниципальный округ Волковское, ул. Софийская, д. 17, литера А, помещ. 8-Н, офис 330В",
  email: "hello@creative-command.ru",
};

export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#09080d] px-4 py-6 text-white sm:px-7 sm:py-9">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5"><Link href="/"><RibesBrand dark /></Link><Link href="/" className="text-xs font-semibold text-white/45 transition hover:text-white">← На главную</Link></header>
        <article className="py-10 sm:py-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">Юридическая информация</p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">{title}</h1>
          <p className="mt-4 text-xs text-white/30">Редакция от 7 сентября 2026 года</p>
          <div className="mt-10 space-y-8 text-sm leading-7 text-white/58 [&_a]:text-violet-300 [&_h2]:mb-3 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white/88 [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3">{children}</div>
        </article>
        <footer className="border-t border-white/[0.08] py-8 text-[10px] leading-5 text-white/30">
          <p className="font-semibold text-white/55">{company.name}</p><p>ИНН {company.inn} · ОГРН {company.ogrn} · КПП {company.kpp}</p><p>{company.address}</p><a className="text-violet-300" href={`mailto:${company.email}`}>{company.email}</a>
          <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2"><Link href="/legal/privacy">Обработка данных</Link><Link href="/legal/consent">Согласие</Link><Link href="/legal/cookies">Cookie</Link><Link href="/legal/terms">Условия и оферта</Link></nav>
        </footer>
      </div>
    </main>
  );
}
