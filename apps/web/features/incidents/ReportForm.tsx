"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  LocateFixed,
  UserRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  reportSchema,
  categories as supportedCategories,
  severities,
  type ReportInput,
  type IncidentView,
} from "../../../../packages/shared/src/index";
import { useAuth } from "../../components/providers/AuthProvider";
import { api, post } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Label } from "../../components/ui/Label";
import { Select } from "../../components/ui/Select";
import { Alert } from "../../components/ui/Alert";
import { queueReport } from "../../lib/offlineQueue";

const REPORT_STEPS = [
  {
    title: "Incident",
    description: "What happened?",
    fields: [
      "title",
      "description",
      "category",
      "severity",
      "peopleAffected",
      "incidentTime",
    ] as const,
  },
  {
    title: "Location",
    description: "Where did it happen?",
    fields: ["jurisdictionCode", "location", "latitude", "longitude"] as const,
  },
  {
    title: "Contact",
    description: "Privacy and evidence",
    fields: ["anonymous", "contact"] as const,
  },
] as const;

export function ReportForm() {
  const { user } = useAuth();
  const [activeCategories, setActiveCategories] = useState<string[]>([
    ...supportedCategories,
  ]);
  const [reportJurisdictions, setReportJurisdictions] = useState<
    { code: string; name: string }[]
  >([]);
  const [jurisdictionSuggestion, setJurisdictionSuggestion] = useState<{
    status: "suggested" | "ambiguous" | "outside" | "unavailable";
    jurisdictionCode: string | null;
    candidates: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    incident: IncidentView;
    trackingToken: string;
  } | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [step, setStep] = useState(0);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      anonymous: !user,
      severity: "medium",
      category: "accident",
      jurisdictionCode: user?.jurisdictionCode ?? "",
      peopleAffected: 0,
      incidentTime: new Date().toISOString(),
      clientId: crypto.randomUUID(),
    },
  });
  const latitude = watch("latitude");
  const longitude = watch("longitude");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ categories: string[] }>("/policy"),
      api<{ code: string; name: string }[]>("/jurisdictions"),
    ])
      .then(([policy, availableJurisdictions]) => {
        if (cancelled) return;
        const nextCategories = policy.categories.length
          ? policy.categories
          : [...supportedCategories];
        setActiveCategories(nextCategories);
        setReportJurisdictions(availableJurisdictions);
        if (!nextCategories.includes("accident"))
          setValue("category", nextCategories[0] ?? "");
        const assigned = availableJurisdictions.find(
          (item) => item.code === user?.jurisdictionCode,
        );
        setValue(
          "jurisdictionCode",
          assigned?.code ?? availableJurisdictions[0]?.code ?? "",
        );
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [setValue, user?.jurisdictionCode]);

  useEffect(() => {
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setJurisdictionSuggestion(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
      });
      api<{
        status: "suggested" | "ambiguous" | "outside" | "unavailable";
        jurisdictionCode: string | null;
        candidates: string[];
      }>(`/jurisdictions/suggest?${query}`)
        .then((suggestion) => {
          if (!cancelled) setJurisdictionSuggestion(suggestion);
        })
        .catch(() => {
          if (!cancelled) setJurisdictionSuggestion(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [latitude, longitude]);

  async function continueStep() {
    setError("");
    const valid = await trigger(REPORT_STEPS[step].fields);
    if (valid)
      setStep((current) => Math.min(current + 1, REPORT_STEPS.length - 1));
  }

  async function submit(data: ReportInput) {
    setError("");
    if (!navigator.onLine) {
      if (!user) {
        setError(
          "Anonymous reports need connectivity so you can receive a private tracking key.",
        );
        return;
      }
      if (photo) {
        setError(
          "Remove the attachment to queue an offline report. Add evidence after syncing.",
        );
        return;
      }
      try {
        await queueReport(user.id, data);
        setError(
          "Saved in the encrypted offline queue. It will sync when you reconnect while signed in. Drafts expire after 24 hours.",
        );
        setValue("clientId", crypto.randomUUID());
      } catch {
        setError("Could not save an offline draft on this device.");
      }
      return;
    }
    try {
      const created = await post<{
        incident: IncidentView;
        trackingToken: string;
      }>("/incidents", data);
      setResult(created);
      if (photo && user) {
        try {
          const upload = await post<{
            mediaId: string;
            url: string;
            fields: Record<string, string>;
          }>(`/incidents/${created.incident.id}/media`, {
            contentType: photo.type,
            size: photo.size,
          });
          const body = new FormData();
          Object.entries(upload.fields).forEach(([k, v]) => body.append(k, v));
          body.append("file", photo);
          const response = await fetch(upload.url, { method: "POST", body });
          if (!response.ok) throw new Error("Upload failed");
          await post(`/media/${upload.mediaId}/confirm`);
        } catch {
          setError(
            "Report saved, but evidence upload failed. You can add evidence from the incident later.",
          );
        }
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Report could not be submitted",
      );
    }
  }

  if (result)
    return (
      <section
        className="panel receipt mx-auto w-full max-w-2xl space-y-5 p-5 sm:p-8"
        aria-labelledby="receipt-title"
      >
        <div
          className="grid size-14 place-items-center rounded-full bg-green-soft text-green"
          aria-hidden="true"
        >
          <CheckCircle2 size={30} />
        </div>
        <div className="space-y-2">
          <Badge variant="secondary">Submission complete</Badge>
          <h2
            id="receipt-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Report received
          </h2>
          <p className="muted">
            Keep both credentials somewhere safe to track this incident
            privately.
          </p>
        </div>
        <div className="space-y-4 rounded-sm border border-border bg-muted/50 p-4 sm:p-5">
          <div>
            <Label htmlFor="tracking-id">Tracking ID</Label>
            <Input
              className="mt-2 font-mono"
              id="tracking-id"
              readOnly
              value={result.incident.trackingId}
            />
          </div>
          <div>
            <Label htmlFor="tracking-secret">Private tracking key</Label>
            <Input
              className="mt-2 font-mono"
              id="tracking-secret"
              readOnly
              value={
                result.trackingToken ??
                "Already submitted — use your previously saved key"
              }
            />
          </div>
        </div>
        <p className="small muted">
          Do not share the private key publicly. This service does not contact
          external emergency numbers.
        </p>
        {error && (
          <Alert role="alert" variant="destructive">
            {error}
          </Alert>
        )}
        <Button
          onClick={() => {
            setResult(null);
            setValue("clientId", crypto.randomUUID());
          }}
        >
          Report another incident
        </Button>
      </section>
    );

  const field = (
    name: keyof ReportInput,
    label: string,
    type = "text",
    hint?: string,
  ) => (
    <div className="min-w-0">
      <Label htmlFor={name}>{label}</Label>
      <Input
        className="mt-2"
        id={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        {...register(name, {
          valueAsNumber: ["peopleAffected", "latitude", "longitude"].includes(
            name,
          ),
        })}
        aria-invalid={!!errors[name]}
        aria-describedby={
          [hint && `${name}-hint`, errors[name] && `${name}-error`]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      {hint && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errors[name]?.message && (
        <p
          className="mt-1 text-sm text-destructive"
          id={`${name}-error`}
          role="alert"
        >
          {errors[name]?.message}
        </p>
      )}
    </div>
  );

  return (
    <form
      className="panel report-form mx-auto w-full max-w-3xl space-y-7 p-4 sm:space-y-8 sm:p-8"
      onSubmit={handleSubmit(submit)}
      aria-busy={isSubmitting}
    >
      <header className="space-y-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow normal-case tracking-normal text-sm">
            Citizen report
          </p>
          <Badge variant="secondary" className="normal-case">
            Private by default
          </Badge>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Tell us what happened
          </h2>
          <p className="muted max-w-2xl">
            Share the details you know. You can submit a report even if some
            information is uncertain.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-sm border border-amber-border bg-amber-soft p-3 text-sm text-amber sm:p-4">
          <AlertTriangle
            className="mt-0.5 shrink-0"
            size={18}
            aria-hidden="true"
          />
          <p>
            <strong>Immediate danger?</strong> Contact your local emergency
            service directly. This portal does not dispatch emergency services.
          </p>
        </div>
        <nav aria-label="Report progress" className="space-y-3 pt-1">
          <ol className="grid grid-cols-3 gap-2 sm:gap-4">
            {REPORT_STEPS.map((item, index) => {
              const isCurrent = index === step;
              const isComplete = index < step;
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-sm text-left text-xs disabled:cursor-default sm:text-sm"
                    onClick={() => index < step && setStep(index)}
                    disabled={index >= step}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold ${isCurrent ? "border-primary bg-primary text-primary-foreground" : isComplete ? "border-green bg-green text-white" : "border-border bg-background text-muted-foreground"}`}
                    >
                      {isComplete ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={
                        isCurrent
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {item.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div
            className="h-1 overflow-hidden rounded-full bg-secondary"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${((step + 1) / REPORT_STEPS.length) * 100}%` }}
            />
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            Step {step + 1} of {REPORT_STEPS.length}: {REPORT_STEPS[step].title}
          </p>
        </nav>
      </header>

      <section
        hidden={step !== 0}
        aria-labelledby="incident-section-title"
        className="space-y-5"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-sm bg-secondary text-primary">
            <ClipboardList size={19} aria-hidden="true" />
          </span>
          <div>
            <h3 id="incident-section-title" className="font-semibold">
              Incident details
            </h3>
            <p className="text-sm text-muted-foreground">
              Describe the event and its immediate impact.
            </p>
          </div>
        </div>
        {field(
          "title",
          "Short title",
          "text",
          "A brief summary helps response teams scan reports.",
        )}
        <div>
          <Label htmlFor="description">What happened?</Label>
          <Textarea
            className="mt-2 min-h-32"
            id="description"
            rows={5}
            placeholder="Include what you observed, when it began, and any relevant details."
            {...register("description")}
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? "description-error" : undefined
            }
          />
          {errors.description?.message && (
            <p
              id="description-error"
              className="mt-1 text-sm text-destructive"
              role="alert"
            >
              {errors.description.message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="category">Incident category</Label>
            <Select className="mt-2" id="category" {...register("category")}>
              {activeCategories.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="severity">Initial severity</Label>
            <Select className="mt-2" id="severity" {...register("severity")}>
              {severities.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          {field(
            "peopleAffected",
            "People affected",
            "number",
            "Enter 0 if unknown or not applicable.",
          )}
          <div>
            <Label htmlFor="incident-time">When did it happen?</Label>
            <Input
              className="mt-2"
              id="incident-time"
              type="datetime-local"
              defaultValue={new Date(
                Date.now() - new Date().getTimezoneOffset() * 60000,
              )
                .toISOString()
                .slice(0, 16)}
              onChange={(e) => {
                if (e.target.value)
                  setValue(
                    "incidentTime",
                    new Date(e.target.value).toISOString(),
                  );
              }}
            />
          </div>
        </div>
      </section>

      <section
        hidden={step !== 1}
        aria-labelledby="location-section-title"
        className="space-y-5 border-t border-border pt-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-sm bg-secondary text-primary">
              <MapPin size={19} aria-hidden="true" />
            </span>
            <div>
              <h3 id="location-section-title" className="font-semibold">
                Where did it happen?
              </h3>
              <p className="text-sm text-muted-foreground">
                A clear place description helps responders locate the incident.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  setValue("latitude", p.coords.latitude, {
                    shouldValidate: true,
                  });
                  setValue("longitude", p.coords.longitude, {
                    shouldValidate: true,
                  });
                  setError("");
                },
                () =>
                  setError(
                    "Location permission unavailable. Enter the coordinates manually.",
                  ),
              );
            }}
          >
            <LocateFixed size={16} aria-hidden="true" />
            Use my location
          </Button>
        </div>
        <div>
          <Label htmlFor="jurisdictionCode">
            State, union territory, or active district
          </Label>
          <Select
            className="mt-2"
            id="jurisdictionCode"
            {...register("jurisdictionCode")}
            aria-invalid={!!errors.jurisdictionCode}
          >
            <option value="">Select an active reporting area</option>
            {reportJurisdictions.map((jurisdiction) => (
              <option key={jurisdiction.code} value={jurisdiction.code}>
                {jurisdiction.name} · {jurisdiction.code}
              </option>
            ))}
          </Select>
          {errors.jurisdictionCode?.message && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {errors.jurisdictionCode.message}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Select the state or district where this happened. The selected area
            scopes who can view and coordinate the report.
          </p>
          {jurisdictionSuggestion?.status === "suggested" &&
            jurisdictionSuggestion.jurisdictionCode && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-border p-3 text-sm">
                <span>
                  Location hint:{" "}
                  {reportJurisdictions.find(
                    (item) =>
                      item.code === jurisdictionSuggestion.jurisdictionCode,
                  )?.name ?? jurisdictionSuggestion.jurisdictionCode}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setValue(
                      "jurisdictionCode",
                      jurisdictionSuggestion.jurisdictionCode!,
                      {
                        shouldValidate: true,
                      },
                    )
                  }
                >
                  Use suggested area
                </Button>
                <span className="text-xs text-muted-foreground">
                  Check the area before submitting. This hint does not verify
                  agency responsibility.
                </span>
              </div>
            )}
          {jurisdictionSuggestion?.status === "ambiguous" && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              This location is on an area boundary. Select the reporting area
              yourself.
            </p>
          )}
          {jurisdictionSuggestion?.status === "outside" && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              No approved district boundary contains this location. Select the
              reporting area yourself.
            </p>
          )}
          {jurisdictionSuggestion?.status === "unavailable" && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              Verified district boundary hints are not available for this area.
            </p>
          )}
        </div>
        {field(
          "location",
          "Address or place description",
          "text",
          "Add a street, landmark, village, or nearby reference point.",
        )}
        <div className="space-y-3 rounded-sm bg-muted/50 p-4 sm:p-5">
          <p className="text-sm font-medium">
            Incident coordinates are required
          </p>
          <p className="text-xs text-muted-foreground">
            Use your device location or enter both coordinates manually. No
            location is prefilled.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("latitude", "Latitude", "number")}
            {field("longitude", "Longitude", "number")}
          </div>
        </div>
      </section>

      <section
        hidden={step !== 2}
        aria-labelledby="contact-section-title"
        className="space-y-5 border-t border-border pt-6"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-sm bg-secondary text-primary">
            <UserRound size={19} aria-hidden="true" />
          </span>
          <div>
            <h3 id="contact-section-title" className="font-semibold">
              Privacy and contact
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose how your identity appears to response teams.
            </p>
          </div>
        </div>
        {user ? (
          <>
            <Label className="check-label min-h-11 items-center rounded-sm border border-border px-3 py-2">
              <Input
                className="size-4"
                type="checkbox"
                {...register("anonymous")}
              />
              Hide my identity from response views
            </Label>
            {field(
              "contact",
              "Contact information (optional)",
              "text",
              "Only add details you are comfortable sharing with the response team.",
            )}
            <div>
              <Label htmlFor="evidence">Add evidence (optional)</Label>
              <Input
                className="mt-2"
                id="evidence"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4"
                aria-describedby="evidence-hint"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPhotoError("");
                  if (
                    file &&
                    ![
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                      "video/mp4",
                    ].includes(file.type)
                  ) {
                    setPhoto(null);
                    setPhotoError("Choose a JPEG, PNG, WebP or MP4 file.");
                    e.target.value = "";
                  } else if (file && file.size > 20 * 1024 * 1024) {
                    setPhoto(null);
                    setPhotoError("Evidence files must be 20 MB or smaller.");
                    e.target.value = "";
                  } else {
                    setPhoto(file);
                  }
                }}
              />
              <p
                id="evidence-hint"
                className="mt-1 text-xs text-muted-foreground"
              >
                JPEG, PNG, WebP or MP4 · Up to 20 MB
                {photo ? ` · Selected: ${photo.name}` : ""}
              </p>
              {photoError && (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {photoError}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="rounded-sm border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            You are reporting anonymously. Save the private tracking key shown
            after submission to follow up on this report.
          </p>
        )}
      </section>

      <footer className="space-y-4 border-t border-border pt-6">
        {error && (
          <Alert
            role="status"
            aria-live="polite"
            variant={
              error.startsWith("Saved in") || error.startsWith("Report saved")
                ? "default"
                : "destructive"
            }
          >
            {error}
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                setError("");
                setStep((current) => Math.max(current - 1, 0));
              }}
            >
              <ChevronLeft size={17} aria-hidden="true" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < REPORT_STEPS.length - 1 ? (
            <Button
              type="button"
              className="w-full sm:w-auto sm:min-w-44"
              disabled={isSubmitting}
              onClick={continueStep}
            >
              Continue
              <ChevronRight size={17} aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="submit"
              className="w-full sm:min-w-56"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting report…" : "Submit incident report"}
            </Button>
          )}
        </div>
      </footer>
    </form>
  );
}
