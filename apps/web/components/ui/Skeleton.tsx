import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-sm bg-border motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
