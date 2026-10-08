import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Shows a busy state and disables the button. */
  pending?: boolean;
}

/** Pixel buttons: square, hard shadow, and they "press down" when clicked. */
const VARIANTS: Record<Variant, string> = {
  primary:
    "border-2 border-bg bg-primary text-bg shadow-pixel-primary hover:brightness-110 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
  ghost:
    "border-2 border-transparent bg-transparent text-muted hover:border-surface-2 hover:bg-surface-2 hover:text-text",
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
      className={`inline-flex h-11 items-center justify-center gap-2 px-5 font-display font-semibold tracking-wide transition-[filter,translate,box-shadow] focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-0 ${VARIANTS[variant]} ${className}`}
      {...button}
    >
      {/* A blinking pixel cursor while busy. */}
      {pending ? (
        <span aria-hidden className="size-2 bg-current motion-safe:animate-blink" />
      ) : null}
      {children}
    </button>
  );
}
