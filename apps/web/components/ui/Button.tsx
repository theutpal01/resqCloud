import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
const styles = cva("button", {
  variants: {
    variant: {
      default:
        "border border-transparent bg-primary text-primary-foreground hover:brightness-95",
      secondary:
        "border border-border bg-card text-card-foreground hover:bg-background",
      destructive:
        "border border-destructive bg-destructive text-destructive-foreground hover:brightness-95",
      ghost:
        "border border-transparent bg-transparent text-muted-foreground hover:bg-background",
    },
  },
  defaultVariants: { variant: "default" },
});
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof styles> {
  asChild?: boolean;
}
/** Shared shadcn button variants with native keyboard and disabled behavior. */
export function Button({
  asChild = false,
  variant,
  className = "",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-3 text-[0.825rem] font-semibold whitespace-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
        styles({ variant }),
        className,
      )}
      {...props}
    />
  );
}
