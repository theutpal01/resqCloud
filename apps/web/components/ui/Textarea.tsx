import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "block min-h-24 w-full resize-y rounded-[var(--radius-sm)] border border-input bg-card px-4 py-3 text-[0.9rem] text-card-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
