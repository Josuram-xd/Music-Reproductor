/** Curled-up sleeping cat for empty states (decorative). */
export function SleepingCat({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 80" fill="none" className={className}>
      {/* body */}
      <ellipse cx="62" cy="54" rx="42" ry="20" fill="var(--surface-2)" />
      {/* tail wrapped around */}
      <path
        d="M22 58c-6 10 8 18 30 16"
        stroke="var(--secondary)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* head */}
      <circle cx="36" cy="44" r="16" fill="var(--surface-2)" />
      {/* ears */}
      <path d="M24 34l2-14 10 9z" fill="var(--surface-2)" />
      <path d="M40 29l8-11 3 15z" fill="var(--surface-2)" />
      <path d="M27 31l1-6 4 4z" fill="var(--primary)" opacity=".7" />
      <path d="M43 30l4-5 1 6z" fill="var(--primary)" opacity=".7" />
      {/* closed eyes */}
      <path
        d="M28 45q3 3 6 0M38 45q3 3 6 0"
        stroke="var(--muted)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* blush */}
      <circle cx="27" cy="50" r="2.5" fill="var(--primary)" opacity=".5" />
      <circle cx="46" cy="50" r="2.5" fill="var(--primary)" opacity=".5" />
      {/* z z */}
      <path
        d="M70 18h8l-8 8h8M86 8h6l-6 6h6"
        stroke="var(--secondary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
