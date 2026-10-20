import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type InputProps = ComponentProps<"input">;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        type === "checkbox"
          ? "size-4 accent-primary"
          : "block min-h-11 w-full rounded-[var(--radius-sm)] border border-input bg-card px-4 py-3 text-[0.9rem] text-card-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
