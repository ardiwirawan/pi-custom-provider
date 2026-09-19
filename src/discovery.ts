import { AppError, object, type Protocol } from "./types.ts";
import { endpointLimits, LIMIT_FIELDS, mergeEndpointLimits, type ListedModel } from "./limits.ts";

export function endpointUrls(baseUrl: string, api: Protocol) {
  const root = baseUrl.replace(/\/+$/, "");
  // Matches the SDK URL concatenation. Explicit prefixes are preserved.
  return api === "anthropic-messages"
    ? { models: `${root}/v1/models`, chat: `${root}/v1/messages` }
    : { models: `${root}/models`, chat: `${root}/${api === "openai-responses" ? "responses" : "chat/completions"}` };
}

export function requestHeaders(api: Protocol, apiKey?: string, extra?: Record<string, string | null>): Headers {
  const headers = new Headers({ Accept: "application/json" });
  if (api === "anthropic-messages") {
    headers.set("anthropic-version", "2023-06-01");
    if (apiKey) headers.set("x-api-key", apiKey);
  } else if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value === null) headers.delete(key); else headers.set(key, value);
  }
  return headers;
}

export function statusMessage(status: number): string {
  if (status === 401 || status === 403) return "Endpoint refused access. Check the API key and account permissions.";
  if (status === 404 || status === 405) return "Model-list endpoint is unavailable. Verify the URL or add models manually; chat may still work.";
  if (status === 429) return "Provider rate or concurrency limit reached. Try again after active requests finish.";
  if (status >= 500) return "Provider returned a server error. Try again later.";
  if (status >= 300 && status < 400) return "Endpoint redirected. Enter the final base URL explicitly.";
  return `Endpoint returned HTTP ${status}.`;
}

async function readLimited(response: Response, maxBytes = 8_000_000): Promise<unknown> {
  if (!response.body) throw new AppError("Endpoint returned an empty response.", 502);
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new AppError("Model-list response is too large.", 502);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError("Expected a JSON model list; the endpoint returned another format.", 502); }
}

export interface DiscoveryOptions {
  api: Protocol;
  baseUrl: string;
  headers: Headers;
  allPages: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function discover(options: DiscoveryOptions) {
  const started = Date.now();
  const signal = AbortSignal.any([AbortSignal.timeout(options.timeoutMs ?? 30000), ...(options.signal ? [options.signal] : [])]);
  const target = endpointUrls(options.baseUrl, options.api).models;
  const models = new Map<string, ListedModel>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;
  let complete = false;
  let warning: string | undefined;
  try {
    while (pages < 100 && models.size < 10000) {
      const url = new URL(target);
      if (options.api === "anthropic-messages") {
        url.searchParams.set("limit", "100");
        if (cursor) url.searchParams.set("after_id", cursor);
      } else if (cursor) url.searchParams.set("after", cursor);
      const response = await fetch(url, { headers: options.headers, signal, redirect: "manual" });
      if (!response.ok) {
        await response.body?.cancel();
        throw new AppError(statusMessage(response.status), response.status);
      }
      const data = await readLimited(response);
      if (!object(data) || !Array.isArray(data.data)) throw new AppError("Response must contain a data array of models.", 502);
      pages++;
      let truncated = false;
      for (const entry of data.data) {
        if (!object(entry) || typeof entry.id !== "string" || !entry.id.trim() || entry.id.length > 300 || /[\x00-\x1f]/.test(entry.id)) continue;
        const model: ListedModel = { ...models.get(entry.id.trim()), id: entry.id.trim() };
        if (typeof entry.display_name === "string" && entry.display_name) model.name = entry.display_name;
        model.limitHints = mergeEndpointLimits(model.limitHints, endpointLimits(entry, options.api));
        for (const field of LIMIT_FIELDS) if (model.limitHints[field]) model[field] = model.limitHints[field]!.value;
        // Only map documented capability fields; IDs alone imply no capabilities.
        if (options.api === "anthropic-messages") {
          if (typeof entry.capabilities?.thinking?.supported === "boolean") model.reasoning = entry.capabilities.thinking.supported;
          if (typeof entry.capabilities?.image_input?.supported === "boolean") model.input = entry.capabilities.image_input.supported ? ["text", "image"] : ["text"];
        }
        if (!models.has(model.id) && models.size >= 10000) { truncated = true; break; }
        models.set(model.id, model);
      }
      if (truncated) { warning = "Discovery limit reached. Results are incomplete."; break; }
      if (data.has_more !== true) {
        // Do not silently claim completeness for alternate pagination formats.
        if (data.links?.next || (Number.isSafeInteger(data.total_count) && data.total_count > models.size)) {
          warning = "Endpoint reports additional results using unsupported pagination. Results are incomplete.";
        } else complete = true;
        break;
      }
      if (!options.allPages) { warning = "Connection verified. Fetch models to retrieve remaining pages."; break; }
      const next = data.last_id;
      if (typeof next !== "string" || !next || cursors.has(next)) {
        warning = "Endpoint indicates more models but has no usable pagination cursor. Results are incomplete.";
        break;
      }
      cursors.add(next);
      cursor = next;
    }
    if (!complete && !warning) warning = "Discovery limit reached. Results are incomplete.";
  } catch (error) {
    const message = error instanceof AppError ? error.message : signal.aborted ? "Request cancelled or timed out." : "Cannot reach the endpoint. Check URL, DNS, TLS and network access.";
    if (!pages) throw error instanceof AppError ? error : new AppError(message, 502);
    warning = `${message} Results are incomplete.`;
  }
  return { ok: true, url: target, status: 200, durationMs: Date.now() - started, pages, complete, warning, models: [...models.values()] };
}
