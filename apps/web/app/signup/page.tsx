"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startCitizenSignup } from "../../lib/cognito";
import { Button } from "../../components/ui/Button";
import { cognitoEnabled } from "../../lib/cognito";

export default function SignupPage() {
  const started = useRef(false);
  const [error, setError] = useState("");

  const beginSignup = useCallback(() => {
    setError("");
    startCitizenSignup().catch((reason: unknown) => {
      setError(
        reason instanceof Error
          ? reason.message
          : "Account creation could not be opened.",
      );
    });
  }, []);

  useEffect(() => {
    if (!started.current && cognitoEnabled) {
      started.current = true;
      beginSignup();
    }
  }, [beginSignup]);

  return (
    <main id="main" className="page-loading" aria-labelledby="signup-title">
      <h1 id="signup-title">Create your citizen account</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : cognitoEnabled ? (
        <p role="status">Opening secure account creation…</p>
      ) : (
        <p role="alert">
          Citizen account creation is not configured. Please try again later.
        </p>
      )}
      {cognitoEnabled && (
        <Button type="button" onClick={beginSignup}>
          Continue to secure sign up
        </Button>
      )}
      <p>
        Already have an account? <Link href="/">Return to sign in</Link>
      </p>
    </main>
  );
}
