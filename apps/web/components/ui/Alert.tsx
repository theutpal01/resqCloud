import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const alertStyles = cva(
  "relative w-full rounded-[var(--radius-sm)] border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-current [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        destructive: "border-danger-border bg-danger-soft text-destructive",
        warning: "border-amber-border bg-amber-soft text-amber",
        success: "border-green-border bg-green-soft text-green",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertStyles> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="status"
      className={cn(alertStyles({ variant }), className)}
      {...props}
    />
  );
}
