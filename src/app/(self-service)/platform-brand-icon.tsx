import type { ReactNode } from "react";

export type PlatformBrand = "VK" | "Telegram" | "Дзен" | "VC.ru";

const brandNames: Record<PlatformBrand, string> = {
  VK: "VK",
  Telegram: "Telegram",
  "Дзен": "Дзен",
  "VC.ru": "VC.ru",
};

function BrandTile({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px] shadow-[0_8px_24px_rgba(15,23,42,.10)] ${className}`}>
      {children}
    </span>
  );
}

export function PlatformBrandIcon({ platform, className = "" }: { platform: PlatformBrand; className?: string }) {
  const icon = platform === "VK" ? (
    <BrandTile className="bg-white">
      <svg viewBox="0 0 24 24" role="img" aria-label="VK" className="h-full w-full" fill="#0077ff">
        <path d="m9.489.004.729-.003h3.564l.73.003.914.01.433.007.418.011.403.014.388.016.374.021.36.025.345.03.333.033c1.74.196 2.933.616 3.833 1.516.9.9 1.32 2.092 1.516 3.833l.034.333.029.346.025.36.02.373.025.588.012.41.013.644.009.915.004.98-.001 3.313-.003.73-.01.914-.007.433-.011.418-.014.403-.016.388-.021.374-.025.36-.03.345-.033.333c-.196 1.74-.616 2.933-1.516 3.833-.9.9-2.092 1.32-3.833 1.516l-.333.034-.346.029-.36.025-.373.02-.588.025-.41.012-.644.013-.915.009-.98.004-3.313-.001-.73-.003-.914-.01-.433-.007-.418-.011-.403-.014-.388-.016-.374-.021-.36-.025-.345-.03-.333-.033c-1.74-.196-2.933-.616-3.833-1.516-.9-.9-1.32-2.092-1.516-3.833l-.034-.333-.029-.346-.025-.36-.02-.373-.025-.588-.012-.41-.013-.644-.009-.915-.004-.98.001-3.313.003-.73.01-.914.007-.433.011-.418.014-.403.016-.388.021-.374.025-.36.03-.345.033-.333c.196-1.74.616-2.933 1.516-3.833.9-.9 2.092-1.32 3.833-1.516l.333-.034.346-.029.36-.025.373-.02.588-.025.41-.012.644-.013.915-.009.98-.004ZM6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z" />
      </svg>
    </BrandTile>
  ) : platform === "Telegram" ? (
    <BrandTile className="bg-white p-1.5">
      <svg viewBox="0 0 24 24" role="img" aria-label="Telegram" className="h-full w-full" fill="#26a5e4">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    </BrandTile>
  ) : platform === "Дзен" ? (
    <BrandTile className="bg-[#202022]">
      <svg viewBox="0 0 168 168" role="img" aria-label="Дзен" className="h-full w-full">
        <path d="M148 82.7c0-.6-.5-1.1-1.2-1.2-23-.8-36.9-3.8-46.7-13.5S87.4 44.2 86.5 21.2c0-.7-.5-1.2-1.2-1.2h-2.7c-.6 0-1.1.5-1.2 1.2-.8 23-3.8 37-13.6 46.8S44.1 80.7 21.2 81.5c-.7.1-1.2.6-1.2 1.2v2.7c0 .6.5 1.1 1.2 1.2 22.9.9 36.9 3.8 46.7 13.6s12.7 23.7 13.6 46.6c0 .7.5 1.2 1.2 1.2h2.7c.6 0 1.1-.5 1.2-1.2.8-22.9 3.8-36.8 13.6-46.6s23.7-12.7 46.7-13.6c.6 0 1.1-.5 1.1-1.2v-2.7Z" fill="white" />
      </svg>
    </BrandTile>
  ) : (
    <BrandTile className="bg-[#ff5c35] text-white">
      <span className="text-[17px] font-black tracking-[-0.08em]">vc.ru</span>
    </BrandTile>
  );

  return <span className={className} title={brandNames[platform]}>{icon}</span>;
}

export function platformBrandFromFormatId(formatId: string): PlatformBrand | null {
  if (formatId === "vk_post") return "VK";
  if (formatId === "telegram_post") return "Telegram";
  if (formatId === "dzen_article") return "Дзен";
  if (formatId === "vcru_article") return "VC.ru";
  return null;
}
