"use client";
import { useEffect, useState } from "react";
import { api, post, download, ApiError } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";
import { FileImage, FileVideo, Trash2, Upload } from "lucide-react";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4"];
interface Evidence {
  id: string;
  contentType: string;
  size: number;
  createdAt: string;
}
export function EvidencePanel({ incidentId }: { incidentId: string }) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function selectFile(nextFile: File | null) {
    setError("");
    setNotice("");
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setFile(null);
      setError("Choose a JPEG, PNG, WebP or MP4 file.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("Evidence files must be 20 MB or smaller.");
      return;
    }
    setFile(nextFile);
  }
  async function openEvidence(id: string) {
    setError("");
    try {
      const { url } = await api<{ url: string }>(`/media/${id}/url`);
      window.location.assign(url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        try {
          await download(`/media/${id}/download`, "incident-evidence");
          return;
        } catch (downloadError) {
          setError((downloadError as Error).message);
          return;
        }
      }
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let active = true;
    setItems([]);
    setError("");
    setNotice("");
    api<Evidence[]>(`/incidents/${incidentId}/media`)
      .then((evidence) => {
        if (active) setItems(evidence);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [incidentId]);
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const policy = await post<{
        mediaId: string;
        url: string;
        fields: Record<string, string>;
      }>(`/incidents/${incidentId}/media`, {
        contentType: file.type,
        size: file.size,
      });
      const body = new FormData();
      for (const [key, value] of Object.entries(policy.fields))
        body.append(key, value);
      body.append("file", file);
      const response = await fetch(policy.url, { method: "POST", body });
      if (!response.ok)
        throw new Error("Evidence upload failed. Please retry.");
      await post(`/media/${policy.mediaId}/confirm`);
      setItems(await api(`/incidents/${incidentId}/media`));
      setNotice("Evidence saved privately");
      setFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-semibold">Private evidence</h3>
          <p className="mt-1 text-sm text-muted-foreground">Files are stored privately with this incident.</p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{items.length} {items.length === 1 ? "file" : "files"}</span>
      </div>
      {items.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-background p-3 text-sm text-muted-foreground">No confirmed evidence files yet.</p>
      )}
      {items.map((item) => (
        <div className="my-2 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3" key={item.id}>
          <span className="flex min-w-0 items-center gap-2 text-sm">
            {item.contentType.startsWith("video/") ? <FileVideo aria-hidden="true" className="shrink-0 text-primary" size={19} /> : <FileImage aria-hidden="true" className="shrink-0 text-primary" size={19} />}
            <span className="min-w-0 break-all">{item.contentType} <span className="text-muted-foreground">· {(item.size / 1024).toFixed(0)} KB</span></span>
          </span>
          <Button variant="secondary" onClick={() => openEvidence(item.id)}>
            View evidence
          </Button>
        </div>
      ))}
      <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-background p-3 sm:p-4">
        <label className="mb-2 mt-0" htmlFor="detail-evidence">Add photo or video</label>
        <Input id="detail-evidence" className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-semibold file:text-secondary-foreground" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" aria-describedby="evidence-help evidence-selected" onChange={(e) => selectFile(e.target.files?.[0] ?? null)} />
        <p className="mt-2 text-xs text-muted-foreground" id="evidence-help">JPEG, PNG, WebP or MP4 · Maximum 20 MB</p>
        {file && <div className="mt-3 flex min-w-0 items-center justify-between gap-2 rounded-md bg-card p-2.5 text-sm" id="evidence-selected"><span className="min-w-0 break-all">{file.name}<span className="block text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span></span><Button type="button" variant="ghost" className="shrink-0 px-2" aria-label="Remove selected evidence" onClick={() => selectFile(null)}><Trash2 aria-hidden="true" size={18} /></Button></div>}
        <Button className="mt-3 w-full sm:w-auto" disabled={!file || busy} onClick={upload}>
          <Upload aria-hidden="true" size={17} />{busy ? "Uploading…" : "Upload evidence"}
        </Button>
      </div>
      {error && (
        <Alert role="alert" variant="destructive">
          {error}
        </Alert>
      )}
      {notice && <Alert variant="success">{notice}</Alert>}
    </section>
  );
}
