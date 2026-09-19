import type { FormatMeta } from "./types";

const STORAGE_KEY = "resume-ats-checker:inputs:v1";

export interface PersistedInputs {
  resumeText: string;
  formatMeta: FormatMeta | null;
  resumeFileName: string;
  jobMode: "url" | "text";
  jobUrl: string;
  jobTextInput: string;
  jobText: string;
}

const EMPTY: PersistedInputs = {
  resumeText: "",
  formatMeta: null,
  resumeFileName: "",
  jobMode: "text",
  jobUrl: "",
  jobTextInput: "",
  jobText: "",
};

/**
 * Persists resume + job posting inputs to the browser's own localStorage — never a
 * server, never even the pooled AI providers — so refreshing the tab or coming back
 * later doesn't mean re-uploading and re-pasting everything. Wrapped defensively:
 * private browsing, storage quotas, or disabled storage should degrade to "nothing
 * persists" rather than crash the app. Deliberately does not include the BYOK field
 * (an API key) — that stays session-only, as documented in the plan.
 */
export function loadPersistedInputs(): PersistedInputs {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

export function savePersistedInputs(inputs: PersistedInputs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    // Storage full, disabled, or private-browsing — persistence is a convenience,
    // not a requirement, so fail silently rather than interrupt the user.
  }
}

export function clearPersistedInputs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
