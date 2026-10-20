import { Skeleton } from "./Skeleton";

export interface LoadingStateProps {
  label?: string;
}

/** A stable placeholder announces progress without distracting motion. */
export function LoadingState({
  label = "Loading workspace…",
}: LoadingStateProps) {
  return (
    <section className="panel loading-state" role="status" aria-busy="true">
      <p className="muted small">{label}</p>
      <div className="loading-lines" aria-hidden="true">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </section>
  );
}
