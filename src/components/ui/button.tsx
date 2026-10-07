import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Shows a busy state and disables the button. */
  pending?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-bg shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110 active:brightness-95",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-text",
};

export function Button({
  variant = "primary",
  pending = false,
  className = "",
  disabled,
  children,
  ...button
}: ButtonProps) {
  return (
    <button
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 font-display font-semibold transition focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...button}
    >
      {children}
    </button>
  );
}
