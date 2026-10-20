export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
let accessToken: string | null = null;
let refreshing: Promise<void> | null = null;
export const setToken = (token: string | null) => {
  accessToken = token;
};
export const getToken = () => accessToken;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function refresh() {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await fetch(`${API}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new ApiError("Sign in to continue", 401);
      const data = await res.json();
      setToken(data.accessToken);
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
/** One API boundary for timeouts, cookie refresh and normalized errors. Never retries mutations automatically. */
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const res = await fetch(`${API}/api/v1${path}`, {
    ...options,
    credentials: "include",
    signal: options.signal ?? AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    try {
      await refresh();
      return api<T>(path, options, false);
    } catch {
      setToken(null);
      throw new ApiError("Your session ended. Sign in again.", 401);
    }
  }
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ error: "Service unavailable" }));
    throw new ApiError(data.error ?? "Request failed", res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export async function restoreSession() {
  try {
    await refresh();
    return true;
  } catch {
    return false;
  }
}
export async function download(path: string, filename: string, retry = true) {
  const res = await fetch(`${API}/api/v1${path}`, {
    credentials: "include",
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 && retry) {
    try {
      await refresh();
      return download(path, filename, false);
    } catch {
      setToken(null);
      throw new ApiError("Your session ended. Sign in again.", 401);
    }
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Download failed" }));
    throw new ApiError(data.error ?? "Download failed", res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
