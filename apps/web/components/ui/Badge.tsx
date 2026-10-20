import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const badgeStyles = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-xs font-semibold capitalize whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        secondary:
          "border-primary-border bg-secondary text-secondary-foreground",
        destructive: "border-danger-border bg-danger-soft text-destructive",
        critical: "border-danger-border bg-danger-soft text-destructive",
        high: "border-amber-border bg-amber-soft text-amber",
        medium: "border-primary-border bg-secondary text-primary",
        low: "border-green-border bg-green-soft text-green",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeStyles> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeStyles({ variant }), className)} {...props} />
  );
}
