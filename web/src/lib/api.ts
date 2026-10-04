// Talks to the FastAPI backend (backend/v2.py) when it's reachable.
// Rule: on localhost / 127.0.0.1 we look for the API at http://127.0.0.1:4711 (override with
// ?api=http://host:port, remembered in localStorage). Anywhere else (GitHub Pages) we stay static.
const TOKEN_KEY = "genmedics:token";
const API_KEY = "genmedics:apiUrl";

export let API: string | null = null;

function candidate(): string | null {
  try {
    const q = new URLSearchParams(location.search).get("api");
    if (q === "off") { localStorage.setItem(API_KEY, "off"); return null; }
    if (q) { localStorage.setItem(API_KEY, q.replace(/\/$/, "")); return q.replace(/\/$/, ""); }
    const saved = localStorage.getItem(API_KEY);
    if (saved === "off") return null;
    if (saved) return saved;
  } catch {}
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? "http://127.0.0.1:4711" : null;
}

/** Resolves to the API base URL if a GenMedics backend answers, else null (demo mode). */
export async function detectApi(): Promise<string | null> {
  const base = candidate();
  if (!base) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(base + "/v2/health", { signal: ctl.signal });
    clearTimeout(t);
    if (r.ok && (await r.json()).service === "genmedics-api") { API = base; return base; }
  } catch {}
  return null;
}
export const apiCandidate = candidate;

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t: string | null) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function api<T = any>(path: string, opts: { method?: string; body?: any; form?: FormData } = {}): Promise<T> {
  if (!API) throw new ApiError("Backend not connected", 0);
  const headers: Record<string, string> = {};
  const tok = getToken();
  if (tok) headers.Authorization = "Bearer " + tok;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let r: Response;
  try {
    r = await fetch(API + path, { method: opts.method || (opts.body !== undefined || opts.form ? "POST" : "GET"), headers, body: opts.form || (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
  } catch {
    throw new ApiError("Can't reach the GenMedics server. Is the backend running?", 0);
  }
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) {
    const d = data?.detail;
    throw new ApiError(typeof d === "string" ? d : Array.isArray(d) ? d.map((x: any) => x.msg).join(", ") : `Request failed (${r.status})`, r.status);
  }
  return data as T;
}

/** Prescription images are served by the backend under /uploads. */
export const assetUrl = (p?: string | null) => (p && p.startsWith("/uploads") && API ? API + p : p || undefined);
