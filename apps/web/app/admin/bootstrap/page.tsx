"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, post } from "../../../lib/api";
import { authenticatorUri, generateMfaSecret } from "../../../lib/mfa";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";

export default function AdminBootstrapPage() {
  const [available, setAvailable] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ available: boolean }>("/auth/admin-bootstrap-status")
      .then(({ available: isAvailable }) => setAvailable(isAvailable))
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Administrator setup status is unavailable.",
        ),
      )
      .finally(() => setStatusLoaded(true));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await post("/auth/admin-bootstrap", {
        token: values.get("token"),
        name: values.get("name"),
        email: values.get("email"),
        password: values.get("password"),
        mfaSecret,
        otp: values.get("otp"),
      });
      window.location.assign("/");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Administrator setup could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const uri = authenticatorUri(mfaSecret, email);

  return (
    <main id="main" className="page-loading" aria-labelledby="bootstrap-title">
      <h1 id="bootstrap-title">Set up the first administrator</h1>
      <p>
        This one-time setup creates a staff administrator with password and
        authenticator protection. Citizens continue to use Cognito sign-in.
      </p>
      {error && <Alert role="alert" variant="destructive">{error}</Alert>}
      {!statusLoaded ? (
        <p role="status">Checking setup status…</p>
      ) : !available ? (
        <section>
          <p role="status">
            First administrator setup is unavailable or already complete.
          </p>
          <Link href="/">Return to sign in</Link>
        </section>
      ) : (
        <form className="registration-form" onSubmit={submit} aria-busy={busy}>
          <p>
            Retrieve the bootstrap token from AWS Secrets Manager at
            <code> resqcloud/production/admin-bootstrap-token</code>. Keep it
            private; it only works before the first administrator is created.
          </p>
          <Label htmlFor="bootstrap-token">Bootstrap token</Label>
          <Input id="bootstrap-token" name="token" type="password" autoComplete="off" minLength={32} required />
          <Label htmlFor="bootstrap-name">Full name</Label>
          <Input id="bootstrap-name" name="name" autoComplete="name" minLength={2} required />
          <Label htmlFor="bootstrap-email">Staff email address</Label>
          <Input id="bootstrap-email" name="email" type="email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} required />
          <Label htmlFor="bootstrap-password">Password (12 or more characters)</Label>
          <Input id="bootstrap-password" name="password" type="password" autoComplete="new-password" minLength={12} required />

          <section className="action-panel" aria-labelledby="bootstrap-mfa-title">
            <h2 id="bootstrap-mfa-title">Authenticator setup</h2>
            <p>
              Generate a secret, add it to an authenticator app, then enter the
              current six-digit code to verify setup.
            </p>
            <Button type="button" variant="secondary" onClick={() => setMfaSecret(generateMfaSecret())}>
              {mfaSecret ? "Generate a new secret" : "Generate authenticator secret"}
            </Button>
            {mfaSecret && (
              <>
                <Label htmlFor="bootstrap-mfa-secret">Manual setup key</Label>
                <Input id="bootstrap-mfa-secret" value={mfaSecret} readOnly autoComplete="off" />
                <Label htmlFor="bootstrap-otp">Current authenticator code</Label>
                <Input id="bootstrap-otp" name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
                <details>
                  <summary>Authenticator setup URI</summary>
                  <Input value={uri} readOnly aria-label="Authenticator setup URI" />
                </details>
              </>
            )}
          </section>
          <Button disabled={busy || !mfaSecret}>
            {busy ? "Setting up administrator…" : "Create administrator"}
          </Button>
        </form>
      )}
    </main>
  );
}
