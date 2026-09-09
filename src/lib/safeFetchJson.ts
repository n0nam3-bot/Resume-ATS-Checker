/**
 * fetch() responses aren't guaranteed to be JSON even when your own API route always
 * returns JSON — a platform-level timeout, a crash before your route handler runs, or
 * a proxy/auth wall in front of the app can all return an HTML error page instead.
 * Calling res.json() on that throws an unhelpful "Unexpected token '<'..." error.
 * This checks first and throws a message worth showing a user instead.
 */
export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    console.error("[parseJsonResponse] Non-JSON response:", res.status, text.slice(0, 300));

    if (res.status === 504 || res.status === 408) {
      throw new Error(
        "That request timed out — the site may be slow or blocking automated access. Try \"Paste text\" instead of a link."
      );
    }
    throw new Error(
      `Something went wrong (status ${res.status}). Try again, or switch to "Paste text" for the job posting.`
    );
  }

  const data = (await res.json()) as T;
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || `Request failed (status ${res.status}).`);
  }
  return data;
}
