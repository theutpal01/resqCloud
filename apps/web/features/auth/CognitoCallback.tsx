"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishCitizenLogin } from "../../lib/cognito";
import { useAuth } from "../../components/providers/AuthProvider";
export function CognitoCallback() {
  const started = useRef(false);
  const [error, setError] = useState("");
  const { cognito } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    finishCitizenLogin()
      .then(cognito)
      .then(() => router.replace("/"))
      .catch((e) => setError(e.message));
  }, [cognito, router]);
  return (
    <main id="main" className="page-loading">
      <h1>Citizen sign-in</h1>
      {error ? (
        <p role="alert">
          {error} <a href="/">Return to sign in</a>
        </p>
      ) : (
        <p role="status">Completing your secure sign-in…</p>
      )}
    </main>
  );
}
