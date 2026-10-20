"use client";
import * as Primitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  trigger?: ReactNode;
}
/** Radix provides focus trapping, Escape dismissal and focus restoration. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
}: DialogProps) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>}
      <Primitive.Portal>
        <Primitive.Overlay className="dialog-overlay fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay)] opacity-100 transition-opacity data-[state=closed]:opacity-0" />
        <Primitive.Content className="dialog-content fixed left-1/2 top-1/2 z-[var(--z-dialog)] grid max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-[var(--radius)] border border-border bg-card p-[var(--inset-card)] text-card-foreground shadow-[var(--shadow)] transition-transform focus:outline-none data-[state=closed]:scale-95">
          <Primitive.Title className="pr-8 text-xl font-semibold leading-none tracking-tight">
            {title}
          </Primitive.Title>
          <Primitive.Description className="text-sm text-muted-foreground">
            {description}
          </Primitive.Description>
          <Primitive.Close
            className="dialog-close absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Close dialog"
          >
            <X size={20} />
          </Primitive.Close>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
