type RibesMarkProps = {
  className?: string;
  compact?: boolean;
};

export function RibesMark({ className = "h-10 w-10", compact = false }: RibesMarkProps) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[30%] bg-[linear-gradient(145deg,#8b5cf6_0%,#6d3fe7_55%,#5325bd_100%)] shadow-[0_14px_38px_rgba(109,63,231,.3)] ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className={`${compact ? "h-[72%] w-[72%]" : "h-[76%] w-[76%]"} overflow-visible`} fill="none">
        <path d="M28.5 10.5c3.8-4.2 8.2-4.8 11.8-3.4-1.1 4.5-4.8 7.4-10.3 7.2" fill="#B9F15F" />
        <path d="M29.5 14.3c-1.8-2.7-3.9-4.5-6.6-5.8" stroke="#D6FF96" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="23.5" cy="26" r="13.2" fill="white" fillOpacity=".96" />
        <circle cx="18.2" cy="22.1" r="2.15" fill="#7C3AED" />
        <circle cx="25.3" cy="19.8" r="1.7" fill="#9A76F3" />
        <circle cx="29.1" cy="26.3" r="2.35" fill="#7040D7" />
        <circle cx="20.6" cy="29" r="1.75" fill="#A78BFA" />
        <circle cx="25.6" cy="33" r="1.25" fill="#7C3AED" />
      </svg>
    </span>
  );
}

export function RibesBrand({
  compact = false,
  dark = true,
  className = "",
}: {
  compact?: boolean;
  dark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <RibesMark className="h-10 w-10" compact={compact} />
      {!compact ? (
        <span>
          <span className={`block font-heading text-[15px] font-semibold tracking-[-0.025em] ${dark ? "text-white" : "text-slate-950"}`}>Ribes</span>
          <span className={`block text-[10px] ${dark ? "text-white/35" : "text-slate-400"}`}>продукт Creative Command</span>
        </span>
      ) : null}
    </span>
  );
}
