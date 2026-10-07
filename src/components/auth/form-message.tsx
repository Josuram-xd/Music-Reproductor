interface FormMessageProps {
  tone: "error" | "notice";
  children: React.ReactNode;
}

export function FormMessage({ tone, children }: FormMessageProps) {
  const styles =
    tone === "error"
      ? "border-danger/40 bg-danger/10 text-danger"
      : "border-accent/40 bg-accent/10 text-accent";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}
    >
      {children}
    </p>
  );
}
