"use client";
import { Button } from "../components/ui/Button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="page-loading">
      <h1>Workspace unavailable</h1>
      <p role="alert">The page could not be loaded.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
