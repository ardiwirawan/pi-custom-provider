export const APIS = ["openai-completions", "openai-responses", "anthropic-messages"] as const;
export type Protocol = (typeof APIS)[number];
export type JsonObject = Record<string, any>;
export interface CompatibilityInput { supportsDeveloperRole?: boolean | null }

export interface ModelInput {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  input?: ("text" | "image")[];
  compat?: CompatibilityInput;
}

// Omitted edits preserve existing overrides; null explicitly restores inheritance.
export function mergeCompat(existing: JsonObject | undefined, edits: CompatibilityInput | undefined): JsonObject {
  const compat = { ...existing };
  if (edits?.supportsDeveloperRole === null) delete compat.supportsDeveloperRole;
  else if (edits?.supportsDeveloperRole !== undefined) compat.supportsDeveloperRole = edits.supportsDeveloperRole;
  return compat;
}

export interface ProviderDraft {
  id: string;
  baseUrl: string;
  api: Protocol;
  apiKey?: string;
  authHeader?: boolean;
  compat?: CompatibilityInput;
  models: ModelInput[];
  revision?: string;
}

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function object(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateCompat(value: unknown): CompatibilityInput | undefined {
  if (value === undefined) return undefined;
  if (!object(value)) throw new AppError("Invalid compatibility settings.");
  const role = value.supportsDeveloperRole;
  if (role === undefined) return undefined;
  if (role !== null && typeof role !== "boolean") throw new AppError("Invalid developer-role compatibility setting.");
  return { supportsDeveloperRole: role };
}

export function validateId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value) ||
      ["constructor", "prototype", "__proto__"].includes(value)) {
    throw new AppError("Provider ID must use 1–80 letters, numbers, dots, dashes or underscores.");
  }
  return value;
}

export function validateDraft(value: unknown): ProviderDraft {
  if (!object(value)) throw new AppError("Expected a provider object.");
  const id = validateId(value.id);
  if (!APIS.includes(value.api)) throw new AppError("Select a supported API protocol.");
  if (typeof value.baseUrl !== "string") throw new AppError("Base URL is required.");
  let url: URL;
  try { url = new URL(value.baseUrl.trim()); } catch { throw new AppError("Enter a valid HTTP(S) base URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new AppError("Use an HTTP(S) base URL without credentials, query parameters or fragments.");
  }
  if (value.apiKey !== undefined && (typeof value.apiKey !== "string" || value.apiKey.length > 8192 || /[\r\n]/.test(value.apiKey))) {
    throw new AppError("API key must be a single line.");
  }
  if (!Array.isArray(value.models) || value.models.length > 10000) throw new AppError("Invalid model list.");
  const seen = new Set<string>();
  const models: ModelInput[] = value.models.map((m: unknown) => {
    if (!object(m) || typeof m.id !== "string" || !m.id.trim() || m.id.length > 300 || /[\x00-\x1f]/.test(m.id)) {
      throw new AppError("Each model needs a valid model ID.");
    }
    const model: ModelInput = { id: m.id.trim() };
    if (seen.has(model.id)) throw new AppError(`Duplicate model ID: ${model.id}`);
    seen.add(model.id);
    if (m.name !== undefined) {
      if (typeof m.name !== "string" || !m.name.trim()) throw new AppError("Model name cannot be empty.");
      model.name = m.name.trim();
    }
    for (const field of ["contextWindow", "maxTokens"] as const) {
      if (m[field] !== undefined) {
        if (!Number.isSafeInteger(m[field]) || m[field] <= 0) throw new AppError(`${field} must be a positive integer.`);
        model[field] = m[field];
      }
    }
    if (m.reasoning !== undefined) {
      if (typeof m.reasoning !== "boolean") throw new AppError("Invalid reasoning flag.");
      model.reasoning = m.reasoning;
    }
    if (m.input !== undefined) {
      if (!Array.isArray(m.input) || !m.input.includes("text") || m.input.some((i: unknown) => i !== "text" && i !== "image")) {
        throw new AppError("Input must include text and optionally image.");
      }
      model.input = [...new Set(m.input)] as ModelInput["input"];
    }
    const compat = validateCompat(m.compat);
    if (compat) model.compat = compat;
    return model;
  });
  return {
    id, baseUrl: url.toString().replace(/\/$/, ""), api: value.api, models, compat: validateCompat(value.compat),
    ...(value.apiKey ? { apiKey: value.apiKey.trim() } : {}),
    ...(typeof value.authHeader === "boolean" ? { authHeader: value.authHeader } : {}),
    ...(typeof value.revision === "string" ? { revision: value.revision } : {}),
  };
}
