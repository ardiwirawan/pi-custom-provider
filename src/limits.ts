import { getBuiltinModels, getBuiltinProviders } from "@earendil-works/pi-ai/providers/all";
import type { JsonObject, ModelInput, Protocol } from "./types.ts";

export const LIMIT_FIELDS = ["contextWindow", "maxTokens"] as const;
export type LimitField = typeof LIMIT_FIELDS[number];
export interface LimitValue {
  value: number;
  source: "endpoint" | "catalog";
  field?: string;
}
export interface LimitHints {
  contextWindow?: LimitValue;
  maxTokens?: LimitValue;
  ambiguous?: LimitField[];
}
export interface ListedModel extends ModelInput { limitHints?: LimitHints }
const positiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function smallest(fields: [string, unknown][]): LimitValue | undefined {
  const valid = fields.filter((entry): entry is [string, number] => positiveInteger(entry[1]));
  valid.sort((a, b) => a[1] - b[1]);
  return valid.length ? { value: valid[0][1], source: "endpoint", field: valid[0][0] } : undefined;
}

export function endpointLimits(entry: JsonObject, api: Protocol): LimitHints {
  if (api === "anthropic-messages") return {
    contextWindow: smallest([["max_input_tokens", entry.max_input_tokens]]),
    maxTokens: smallest([["max_tokens", entry.max_tokens]]),
  };
  // Explicit metadata fields only. Bare max_tokens is ambiguous on generic gateways.
  return {
    contextWindow: smallest([
      ["context_length", entry.context_length], ["context_window", entry.context_window], ["contextWindow", entry.contextWindow],
      ["top_provider.context_length", entry.top_provider?.context_length],
      ["per_request_limits.prompt_tokens", entry.per_request_limits?.prompt_tokens],
    ]),
    maxTokens: smallest([
      ["max_output_tokens", entry.max_output_tokens], ["max_completion_tokens", entry.max_completion_tokens], ["maxTokens", entry.maxTokens],
      ["top_provider.max_completion_tokens", entry.top_provider?.max_completion_tokens],
      ["per_request_limits.completion_tokens", entry.per_request_limits?.completion_tokens],
    ]),
  };
}

export function mergeEndpointLimits(previous: LimitHints = {}, next: LimitHints = {}): LimitHints {
  const result: LimitHints = {};
  for (const field of LIMIT_FIELDS) {
    const a = previous[field], b = next[field];
    if (a || b) result[field] = a && b ? a.value <= b.value ? a : b : a ?? b;
  }
  return result;
}

// The bundled public catalog is read without network, credentials, or user overrides.
export class LimitCatalog {
  private entries = new Map<string, Pick<ModelInput, "id" | LimitField>[]>();
  constructor(models: readonly Pick<ModelInput, "id" | LimitField>[] = getBuiltinProviders().flatMap((provider) => getBuiltinModels(provider))) {
    for (const model of models) {
      const entries = this.entries.get(model.id) ?? [];
      entries.push(model); this.entries.set(model.id, entries);
    }
  }

  lookup(id: string, endpoint: LimitHints = {}): LimitHints {
    const result: LimitHints = {};
    const matches = this.entries.get(id) ?? [];
    for (const field of LIMIT_FIELDS) {
      if (endpoint[field]) { result[field] = endpoint[field]; continue; }
      const values = new Set(matches.map((m) => m[field]).filter(positiveInteger));
      if (values.size === 1) result[field] = { value: [...values][0], source: "catalog" };
      else if (values.size > 1) (result.ambiguous ??= []).push(field);
    }
    return result;
  }
}
