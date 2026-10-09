export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0b1220" />
      <path d="M22.5 11.2A8 8 0 1 0 24 16h-7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="22.6" cy="10.9" r="2.2" fill="#ff5a36" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[1.6rem] leading-none font-semibold tracking-tight">giro</span>
    </span>
  );
}
