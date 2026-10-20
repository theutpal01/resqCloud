import { LoadingState } from "../components/ui/LoadingState";
export default function Loading() {
  return (
    <main id="main" className="page-loading" aria-busy="true">
      <h1>ResQCloud</h1>
      <LoadingState label="Loading your response workspace…" />
    </main>
  );
}
