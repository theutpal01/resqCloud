import Link from "next/link";

export const metadata = {
  title: "Privacy and data use | ResQCloud",
  description: "Learn what information ResQCloud handles and how it is used.",
};

export default function PrivacyPage() {
  return (
    <main
      id="main"
      className="min-h-screen bg-[var(--canvas)] px-5 py-12 text-[var(--ink)] sm:px-8"
    >
      <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:p-10">
        <header className="space-y-3">
          <p className="eyebrow">RESQCLOUD · INFORMATION</p>
          <h1 className="font-display text-4xl">Privacy and data use</h1>
          <p className="text-sm text-[var(--muted)]">
            This page describes the information handled by the current
            application. Retention periods, legal basis, and the operating data
            controller have not yet been approved.
          </p>
        </header>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Information you provide</h2>
          <p>
            Incident reports can include a description, category, severity,
            time, location, number of people affected, and optional contact
            details. Account holders provide a name and email address. Evidence
            may be attached to a report.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How the application uses it</h2>
          <p>
            Report details support review, assignment, response coordination,
            status updates, and aggregate operational reporting. Contact details
            are used to associate a report with its reporter or provide
            requested follow-up. Access to operational records is limited by
            account role and scope.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Public information</h2>
          <p>
            Only records approved for public display may appear on the public
            incident map. The application uses a privacy-safe public projection,
            including approximate coordinates. Private tracking receipts grant
            access to a report’s progress; keep them confidential.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Retention and requests</h2>
          <p>
            Approved retention and deletion periods, the responsible
            organization, and a contact for access or deletion requests are not
            configured yet. Do not use this development service for real
            emergency reports or sensitive personal information.
          </p>
        </section>
        <p className="border-t border-[var(--line)] pt-5 text-sm text-[var(--muted)]">
          This is an interim product notice, not an approved legal privacy
          policy. Operational use requires review and publication of
          jurisdiction-specific privacy, retention, and contact details.
        </p>
        <Link
          className="inline-flex font-medium text-[var(--primary)] underline underline-offset-4"
          href="/"
        >
          Return to ResQCloud
        </Link>
      </article>
    </main>
  );
}
