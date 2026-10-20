import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type LabelProps = ComponentProps<"label">;

export function Label({ className, htmlFor, ...props }: LabelProps) {
  return (
    <label
      className={cn("text-sm font-semibold leading-none", className)}
      htmlFor={htmlFor}
      {...props}
    />
  );
}
