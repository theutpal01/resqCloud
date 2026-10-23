"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Search, ShieldCheck } from "lucide-react";
import { Login, Register } from "./Login";
import { cognitoEnabled } from "../../lib/cognito";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Card } from "../../components/ui/Card";

/** Public entry point keeps reporting available without an account. */
export function AuthLanding({
  isRestoring = false,
}: {
  isRestoring?: boolean;
}) {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  return (
    <div className="login-layout">
      <Card className="auth-panel">
        <Login isRestoring={isRestoring} />
        {cognitoEnabled ? (
          <div className="auth-register">
            <span>New to ResQCloud?</span>
            <Button asChild variant="ghost">
              <Link href="/signup">Create an account</Link>
            </Button>
          </div>
        ) : (
          <div className="auth-register">
            <span>New to ResQCloud?</span>
            <Dialog
              open={isRegisterOpen}
              onOpenChange={setIsRegisterOpen}
              title="Create your citizen account"
              description="Keep your reports and their progress together in one place."
              trigger={
                <Button variant="ghost" disabled={isRestoring}>
                  Create an account
                </Button>
              }
            >
              <Register />
            </Dialog>
          </div>
        )}
        <p className="auth-footnote">
          <ShieldCheck size={16} aria-hidden="true" /> Your workspace is limited
          to your role and scope.
        </p>
        <p className="auth-footnote">
          <Link href="/privacy">Privacy and data use</Link>
        </p>
      </Card>
      <section className="community-panel" aria-labelledby="community-title">
        <span className="community-mark">
          <ShieldCheck size={30} aria-hidden="true" />
        </span>
        <p className="eyebrow">EVERY RESPONSE MATTERS</p>
        <h2 id="community-title">
          From the first report
          <br />
          to the next step.
        </h2>
        <p className="community-description">
          Connect the people who need help with the teams ready to respond. Keep
          the details together and the next action clear.
        </p>
        <ol className="community-steps">
          {[
            [
              "01",
              "Report what happened",
              "Share the details and location of an incident.",
            ],
            [
              "02",
              "Coordinate the response",
              "Teams review, prioritize, and assign support.",
            ],
            [
              "03",
              "Stay informed",
              "Follow updates with your private tracking key.",
            ],
          ].map(([number, title, description]) => (
            <li key={number}>
              <span>{number}</span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="public-shortcuts">
          <Link href="/tracking">
            <Search size={20} aria-hidden="true" />
            <span>
              Track a report<small>Check its latest progress</small>
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/map">
            <MapPin size={20} aria-hidden="true" />
            <span>
              Explore the public map
              <small>See approved incident locations</small>
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
