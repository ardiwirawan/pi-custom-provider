import { join } from "node:path";
import { ModelRuntime, readStoredCredential, SettingsManager, VERSION } from "@earendil-works/pi-coding-agent";
import { ConfigStore, parseDocument, patch, readText } from "./storage.ts";
import { discover, endpointUrls, requestHeaders } from "./discovery.ts";
import { CAPABILITIES, probeModel, type Capability } from "./probes.ts";
import { LimitCatalog, LIMIT_FIELDS } from "./limits.ts";
import { APIS, AppError, mergeCompat, validateDraft, validateId, type JsonObject, type ModelInput, type ProviderDraft } from "./types.ts";

function visibleCompat(entry: JsonObject): ModelInput["compat"] {
  return typeof entry.compat?.supportsDeveloperRole === "boolean" ? { supportsDeveloperRole: entry.compat.supportsDeveloperRole } : undefined;
}

function visibleModel(model: JsonObject): ModelInput {
  const visible = Object.fromEntries(["id", "name", "input", "reasoning", "contextWindow", "maxTokens"]
    .filter((key) => model[key] !== undefined).map((key) => [key, model[key]])) as unknown as ModelInput;
  const compat = visibleCompat(model);
  if (compat) visible.compat = compat;
  return visible;
}

export class ProviderService {
  readonly store: ConfigStore;
  private reserved: Set<string> = new Set();
  private limitCatalog = new LimitCatalog();
  constructor(readonly dir: string, private onSaved?: () => Promise<void>) { this.store = new ConfigStore(dir); }

  private async runtime() {
    return ModelRuntime.create({ authPath: join(this.dir, "auth.json"), modelsPath: this.store.path, refreshOnCreate: false });
  }

  async initialize() {
    const baseline = await ModelRuntime.create({ authPath: join(this.dir, "auth.json"), modelsPath: null, refreshOnCreate: false });
    this.reserved = new Set(baseline.getProviders().map((p) => p.id));
  }

  async state() {
    const current = await this.store.read();
    const settings = parseDocument(await readText(join(this.dir, "settings.json")));
    const providers = Object.entries(current.data.providers).map(([id, entry]) => {
      const p = entry as JsonObject;
      const credential = readStoredCredential(id, join(this.dir, "auth.json"));
      return {
        id, baseUrl: p.baseUrl ?? "", api: p.api ?? "", authHeader: p.authHeader ?? false,
        compat: visibleCompat(p),
        models: (p.models ?? []).map((model: JsonObject) => ({ ...visibleModel(model), limitHints: this.limitCatalog.lookup(model.id) })),
        readOnly: this.reserved.has(id) || !APIS.includes(p.api) || !!p.oauth,
        credentialType: credential?.type ?? null,
        authSource: credential ? `auth.json (${credential.type})` : p.apiKey ? "models.json" : "not configured",
        hasHiddenSettings: !!(p.headers || p.compat || p.modelOverrides || p.models?.some((m: JsonObject) => m.headers || m.api || m.baseUrl || m.compat)),
      };
    });
    return {
      dir: this.dir, piVersion: VERSION, revision: current.revision, providers,
      defaultProvider: settings.defaultProvider ?? "", defaultModel: settings.defaultModel ?? "",
      reservedIds: [...this.reserved],
    };
  }

  private assertEditable(id: string, entry?: JsonObject) {
    if (this.reserved.has(id) || entry?.oauth || (entry && !APIS.includes(entry.api))) {
      throw new AppError("This provider is managed by Pi or another integration. Use a new custom provider ID.");
    }
  }

  private async prepare(input: unknown, signal?: AbortSignal) {
    const draft = validateDraft(input);
    const current = await this.store.read();
    const existing = current.data.providers[draft.id];
    this.assertEditable(draft.id, existing);
    const credential = readStoredCredential(draft.id, join(this.dir, "auth.json"));
    if (credential?.type === "oauth") throw new AppError("Manage this provider's OAuth credentials using Pi /login.");
    const runtime = await this.runtime();
    const providerCompat = mergeCompat(existing?.compat, draft.compat);
    try {
      runtime.registerProvider(draft.id, {
        ...existing, baseUrl: draft.baseUrl, api: draft.api,
        compat: providerCompat,
        ...(draft.authHeader === undefined ? {} : { authHeader: draft.authHeader }),
        models: draft.models.map((model) => {
          const old = { ...(existing?.models?.find((m: JsonObject) => m.id === model.id) ?? {}) };
          for (const key of ["name", "input", "reasoning", "contextWindow", "maxTokens"]) delete old[key];
          const merged = { ...old, ...model };
          // registerProvider requires complete model metadata, unlike models.json.
          // These documented Pi defaults are only materialized for the test runtime.
          return {
            ...merged, name: model.name ?? model.id, input: model.input ?? ["text"],
            reasoning: model.reasoning ?? false, contextWindow: model.contextWindow ?? 128000,
            maxTokens: model.maxTokens ?? 16384,
            cost: merged.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            compat: { ...providerCompat, ...mergeCompat(old.compat, model.compat) },
          };
        }),
      });
      await runtime.refresh({ allowNetwork: false, providers: [draft.id], signal });
      if (!runtime.getProvider(draft.id)) throw new Error("Provider unavailable");
    } catch {
      throw new AppError("Pi rejected the provider configuration. Check model fields and any existing advanced settings.");
    }
    return { draft, runtime, existing, credential };
  }

  async preview(input: unknown) {
    const draft = validateDraft(input);
    return endpointUrls(draft.baseUrl, draft.api);
  }

  modelLimits(input: unknown) {
    if (typeof input !== "string" || !input.trim() || input.length > 300 || /[\x00-\x1f]/.test(input)) throw new AppError("Enter a valid model ID.");
    return this.limitCatalog.lookup(input.trim());
  }

  private async resolveAuth(runtime: ModelRuntime, draft: ProviderDraft, signal?: AbortSignal) {
    try {
      const auth = await runtime.getAuth(draft.id, { apiKey: draft.apiKey, signal });
      if (!auth) throw new Error("Missing auth");
      return auth;
    } catch {
      throw new AppError("No usable API key. Enter a key or check the provider's existing Pi credentials/environment variables.", 401);
    }
  }

  async fetchModels(input: unknown, allPages: boolean, signal?: AbortSignal) {
    const { draft, runtime, existing } = await this.prepare(input, signal);
    const auth = await this.resolveAuth(runtime, draft, signal);
    const result = await discover({ api: draft.api, baseUrl: draft.baseUrl,
      headers: requestHeaders(draft.api, auth.auth.apiKey, auth.auth.headers), allPages, signal });
    for (const model of result.models) {
      const override = existing?.models?.find((m: JsonObject) => m.id === model.id);
      const differentEndpoint = (override?.baseUrl && override.baseUrl !== draft.baseUrl) || (override?.api && override.api !== draft.api);
      model.limitHints = this.limitCatalog.lookup(model.id, differentEndpoint ? {} : model.limitHints);
      for (const field of LIMIT_FIELDS) {
        if (model.limitHints[field]) model[field] = model.limitHints[field]!.value;
        else delete model[field];
      }
    }
    return result;
  }

  async testModel(input: unknown, modelId: string, signal?: AbortSignal, capability: unknown = "chat") {
    if (!CAPABILITIES.includes(capability as Capability)) throw new AppError("Choose a supported capability test.");
    const { draft, runtime } = await this.prepare(input, signal);
    const model = runtime.getModel(draft.id, modelId);
    if (!model) throw new AppError("Choose a model first.");
    await this.resolveAuth(runtime, draft, signal);
    return probeModel(runtime, model, draft.apiKey, capability as Capability, signal);
  }

  async save(input: unknown) {
    const { draft, runtime, credential } = await this.prepare(input);
    if (!draft.models.length) throw new AppError("Select or add at least one model before saving.");
    const settings = parseDocument(await readText(join(this.dir, "settings.json")));
    if (settings.defaultProvider === draft.id && !draft.models.some((m) => m.id === settings.defaultModel)) {
      throw new AppError("Choose another default model before removing the current default from this provider.");
    }
    if (draft.apiKey && credential?.type === "api_key" && credential.env && Object.keys(credential.env).length) {
      throw new AppError("This credential has provider-scoped environment settings. Update its key with Pi's native auth configuration to preserve those settings.");
    }
    await this.store.save(draft);
    let warning: string | undefined;
    if (draft.apiKey) {
      try {
        // Let Pi own auth.json format, interpolation, locking and login semantics.
        // The form accepts a literal key. Escape Pi's template/command syntax on storage.
        const key = draft.apiKey.replace(/\$/g, "$$$$").replace(/^!/, "$!");
        await runtime.login(draft.id, "api_key", { prompt: async () => key, notify: () => {} });
      } catch { warning = "Models saved, but key storage did not finish successfully. Use Pi /login before using this provider."; }
    }
    try { await this.onSaved?.(); }
    catch { warning = [warning, "Configuration saved. Reopen Pi /model to refresh the active runtime."].filter(Boolean).join(" "); }
    return { ok: true, warning, state: await this.state() };
  }

  async remove(idInput: unknown, expected: string) {
    const id = validateId(idInput);
    const current = await this.store.read();
    this.assertEditable(id, current.data.providers[id]);
    const settings = parseDocument(await readText(join(this.dir, "settings.json")));
    if (settings.defaultProvider === id) throw new AppError("Choose another default provider before deleting this one.");
    await this.store.update(expected, (text) => patch(text, ["providers", id], undefined));
    await this.onSaved?.();
    return { ok: true, message: "Provider removed. Its credentials remain in auth.json; remove them separately if needed.", state: await this.state() };
  }

  async removeKey(idInput: unknown) {
    const id = validateId(idInput);
    const credential = readStoredCredential(id, join(this.dir, "auth.json"));
    if (credential?.type === "oauth") throw new AppError("Use Pi /logout to manage OAuth credentials.");
    const runtime = await this.runtime();
    await runtime.logout(id);
    await this.onSaved?.();
    return { ok: true, state: await this.state() };
  }

  async setDefault(idInput: unknown, modelId: unknown) {
    const id = validateId(idInput);
    const runtime = await this.runtime();
    if (typeof modelId !== "string" || !runtime.getModel(id, modelId)) throw new AppError("Save the provider and model before setting a default.");
    const settings = SettingsManager.create(this.dir, this.dir, { projectTrusted: false });
    if (settings.drainErrors().length) throw new AppError("Fix settings.json before setting a default.", 409);
    settings.setDefaultModelAndProvider(id, modelId);
    await settings.flush();
    if (settings.drainErrors().length) throw new AppError("Could not save default settings.", 500);
    return { ok: true, state: await this.state() };
  }
}
