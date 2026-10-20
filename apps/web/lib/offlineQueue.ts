import type { ReportInput } from "../../../packages/shared/src/index";
import { post } from "./api";
interface QueuedReport {
  id: string;
  ownerId: string;
  iv: Uint8Array<ArrayBuffer>;
  cipher: ArrayBuffer;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  state: "pending" | "syncing" | "failed";
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("resqcloud-offline", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("queue", { keyPath: "id" });
      req.result.createObjectStore("keys");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function operation<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = action(tx.objectStore(store));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
async function encryptionKey() {
  return navigator.locks.request(
    "resqcloud-offline-encryption-key",
    async () => {
      const stored = await operation<CryptoKey | undefined>(
        "keys",
        "readonly",
        (s) => s.get("device"),
      );
      if (stored) return stored;
      const generated = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      await operation("keys", "readwrite", (s) => s.put(generated, "device"));
      return generated;
    },
  );
}
/** Device-local, encrypted report drafts; identity is checked before syncing, and retention is 24 hours. */
export async function queueReport(ownerId: string, report: ReportInput) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(JSON.stringify(report)),
  );
  await operation("queue", "readwrite", (s) =>
    s.put({
      id: report.clientId,
      ownerId,
      iv,
      cipher,
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: Date.now(),
      state: "pending",
    } satisfies QueuedReport),
  );
}
export async function queueCount(ownerId: string) {
  const all = await operation<QueuedReport[]>("queue", "readonly", (s) =>
    s.getAll(),
  );
  const retentionCutoff = Date.now() - 86400000;
  return all.filter(
    (r) => r.ownerId === ownerId && r.createdAt > retentionCutoff,
  ).length;
}
export async function syncQueue(ownerId: string) {
  if (!navigator.onLine) return;
  const reports = await operation<QueuedReport[]>("queue", "readonly", (s) =>
    s.getAll(),
  );
  for (const item of reports) {
    if (Date.now() - item.createdAt > 86400000) {
      await operation("queue", "readwrite", (s) => s.delete(item.id));
      continue;
    }
    if (item.ownerId !== ownerId || item.nextAttemptAt > Date.now()) continue;
    try {
      await operation("queue", "readwrite", (s) =>
        s.put({ ...item, state: "syncing" }),
      );
      const bytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: item.iv },
        await encryptionKey(),
        item.cipher,
      );
      await post("/incidents", JSON.parse(new TextDecoder().decode(bytes)));
      await operation("queue", "readwrite", (s) => s.delete(item.id));
    } catch {
      await operation("queue", "readwrite", (s) =>
        s.put({
          ...item,
          state: "failed",
          attempts: item.attempts + 1,
          nextAttemptAt:
            Date.now() + Math.min(300000, 1000 * 2 ** item.attempts),
        }),
      );
    }
  }
}
