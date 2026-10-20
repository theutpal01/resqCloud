"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type Actor } from "../../../../packages/shared/src/index";
import type { z } from "zod";
import { useAuth } from "../../components/providers/AuthProvider";
import { cognitoEnabled, startCitizenLogin } from "../../lib/cognito";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { Alert } from "../../components/ui/Alert";
export function Login({ isRestoring = false }: { isRestoring?: boolean }) {
  const { signIn, demoSignIn } = useAuth();
  const [error, setError] = useState("");
  const [demoBusyRole, setDemoBusyRole] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  return (
    <section className="login-card">
      <p className="eyebrow">SECURE WORKSPACE</p>
      <h2>Welcome back</h2>
      <p className="muted">
        Sign in to follow your reports or coordinate your team’s response.
      </p>
      {cognitoEnabled && (
        <Button
          className="mb-5 w-full"
          type="button"
          variant="secondary"
          disabled={isRestoring || isSubmitting}
          onClick={() =>
            startCitizenLogin().catch((e) => setError(e.message))
          }
        >
          Citizen sign-in / registration
        </Button>
      )}
      {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
        <section className="demo-login" aria-labelledby="demo-login-title" aria-busy={!!demoBusyRole}>
          <h3 id="demo-login-title">Explore a demo role</h3>
          <p>
            Sample accounts are ready. Choose a role to enter the workspace.
          </p>
          <div className="demo-login-options">
            {[
              ["citizen", "Citizen"],
              ["dispatcher", "Dispatcher"],
              ["responder", "Responder"],
              ["supervisor", "Supervisor"],
              ["admin", "Administrator"],
            ].map(([role, label]) => (
              <Button
                key={role}
                type="button"
                aria-pressed={demoBusyRole === role}
                variant="secondary"
                disabled={isRestoring || isSubmitting || !!demoBusyRole}
                onClick={async () => {
                  setDemoBusyRole(role);
                  setError("");
                  try {
                    await demoSignIn(role as Parameters<typeof demoSignIn>[0]);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Demo sign-in failed",
                    );
                  } finally {
                    setDemoBusyRole(null);
                  }
                }}
              >
                {demoBusyRole === role ? "Opening…" : label}
              </Button>
            ))}
          </div>
          <p className="demo-login-note">Fictional data · local demo only</p>
        </section>
      )}
      <form
        aria-busy={isSubmitting || isRestoring}
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            await signIn(values);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign in failed");
          }
        })}
      >
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          disabled={isRestoring || isSubmitting}
          {...register("email")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email?.message && (
          <span id="email-error" className="field-error" aria-live="polite">
            {errors.email.message}
          </span>
        )}
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={isRestoring || isSubmitting}
          {...register("password")}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        {errors.password?.message && (
          <span id="password-error" className="field-error" aria-live="polite">
            {errors.password.message}
          </span>
        )}
        <details className="auth-otp">
          <summary>Use an authenticator code</summary>
          <Label htmlFor="otp">
            Authenticator code <span className="muted">(if enabled)</span>
          </Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={isRestoring || isSubmitting}
            maxLength={6}
            {...register("otp", {
              setValueAs: (value: string) => value || undefined,
            })}
            aria-invalid={!!errors.otp}
            aria-describedby={errors.otp ? "otp-error" : undefined}
          />
          {errors.otp?.message && (
            <span id="otp-error" className="field-error" aria-live="polite">
              {errors.otp.message}
            </span>
          )}
        </details>
        {error && (
          <Alert role="alert" variant="destructive">
            {error}
          </Alert>
        )}
        <Button disabled={isSubmitting || isRestoring}>
          {isRestoring
            ? "Restoring session…"
            : isSubmitting
              ? "Signing in…"
              : "Sign in"}
        </Button>
      </form>
    </section>
  );
}
export function Register() {
  const { register: registerAccount } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (cognitoEnabled)
    return (
      <section className="panel">
        <h2>Citizen services</h2>
        <p>
          Use Citizen sign-in to register, recover your account or sign in
          securely.
        </p>
      </section>
    );
  return (
    <form
      className="registration-form"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await registerAccount({
            name: String(f.get("name")),
            email: String(f.get("email")),
            password: String(f.get("password")),
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Registration failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Label htmlFor="new-name">Full name</Label>
      <Input
        id="new-name"
        name="name"
        autoComplete="name"
        required
        minLength={2}
      />
      <Label htmlFor="new-email">Email</Label>
      <Input
        id="new-email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Label htmlFor="new-password">Password (12 or more characters)</Label>
      <Input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
      />
      {error && (
        <Alert role="alert" variant="destructive">
          {error}
        </Alert>
      )}
      <Button disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
    </form>
  );
}
export type SignedInUser = Actor;
