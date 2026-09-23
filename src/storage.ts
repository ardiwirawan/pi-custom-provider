import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink, readdir } from "node:fs/promises";
import { join } from "node:path";
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import lockfile from "proper-lockfile";
import { AppError, mergeCompat, object, type JsonObject, type ModelInput, type ProviderDraft } from "./types.ts";

function storedModel(model: ModelInput) {
  const { compat: edits, ...fields } = model;
  const compat = mergeCompat(undefined, edits);
  return { ...fields, ...(Object.keys(compat).length ? { compat } : {}) };
}

export function parseDocument(text: string): JsonObject {
  const errors: ParseError[] = [];
  const value = parse(text.replace(/^\uFEFF/, ""), errors, { allowTrailingComma: false });
  if (errors.length || !object(value)) throw new AppError("Configuration contains invalid JSON. Fix it before saving.", 409);
  return value;
}

export function patch(text: string, path: (string | number)[], value: unknown): string {
  return applyEdits(text, modify(text, path, value, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: text.includes("\r\n") ? "\r\n" : "\n" },
  }));
}

export function revision(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function readText(path: string, fallback = "{}\n"): Promise<string> {
  try { return await readFile(path, "utf8"); }
  catch (error: any) { if (error.code === "ENOENT") return fallback; throw error; }
}

export async function atomicWrite(path: string, content: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
}

export class ExtensionConfigStore {
  readonly path: string;
  constructor(readonly dir: string) { this.path = join(dir, "pi-custom-provider.json"); }

  async read() {
    const text = await readText(this.path, "{}\n");
    return { text, data: parseDocument(text), revision: revision(text) };
  }

  async saveVisionFallback(expected: string, value: { provider: string; model: string } | undefined) {
    await mkdir(this.dir, { recursive: true });
    const release = await lockfile.lock(this.path, { realpath: false, retries: { retries: 20, minTimeout: 20, maxTimeout: 100 } });
    try {
      const current = await this.read();
      if (current.revision !== expected) throw new AppError("Fallback configuration changed in another window. Reload before saving.", 409);
      const next = patch(current.text, ["visionFallback"], value);
      parseDocument(next);
      if (next !== current.text) await atomicWrite(this.path, next);
      return revision(next);
    } finally { await release(); }
  }
}

export class ConfigStore {
  readonly path: string;
  constructor(readonly dir: string) { this.path = join(dir, "models.json"); }

  async read() {
    const text = await readText(this.path, '{"providers":{}}\n');
    const data = parseDocument(text);
    if (!object(data.providers)) throw new AppError("models.json must contain a providers object.", 409);
    return { text, data, revision: revision(text) };
  }

  async update(expected: string, transform: (text: string, data: JsonObject) => string) {
    await mkdir(this.dir, { recursive: true });
    const release = await lockfile.lock(this.path, { realpath: false, retries: { retries: 20, minTimeout: 20, maxTimeout: 100 } });
    try {
      const current = await this.read();
      if (current.revision !== expected) throw new AppError("Configuration changed in another window. Reload before saving.", 409);
      const next = transform(current.text, current.data);
      parseDocument(next);
      if (next === current.text) return current.revision;
      const backupDir = join(this.dir, "provider-manager-backups");
      await mkdir(backupDir, { recursive: true, mode: 0o700 });
      await writeFile(join(backupDir, `${Date.now()}-${randomUUID()}.json`), current.text, { mode: 0o600 });
      // Catch edits made by a non-cooperating editor during backup creation.
      if ((await this.read()).revision !== current.revision) throw new AppError("Configuration changed while saving. Reload and retry.", 409);
      await atomicWrite(this.path, next);
      const backups = (await readdir(backupDir)).filter((f) => /^\d+-[\da-f-]+\.json$/.test(f)).sort().reverse();
      await Promise.all(backups.slice(10).map((f) => unlink(join(backupDir, f)).catch(() => {})));
      return revision(next);
    } finally { await release(); }
  }

  async save(draft: ProviderDraft) {
    if (!draft.revision) throw new AppError("Reload configuration before saving.", 409);
    return this.update(draft.revision, (text, data) => {
      const path = ["providers", draft.id];
      const existing = data.providers[draft.id];
      const compat = mergeCompat(undefined, draft.compat);
      if (!existing) return patch(text, path, {
        baseUrl: draft.baseUrl, api: draft.api,
        ...(Object.keys(compat).length ? { compat } : {}),
        ...(draft.authHeader === undefined ? {} : { authHeader: draft.authHeader }), models: draft.models.map(storedModel),
      });
      let next = patch(patch(text, [...path, "baseUrl"], draft.baseUrl), [...path, "api"], draft.api);
      if (draft.authHeader !== undefined) next = patch(next, [...path, "authHeader"], draft.authHeader);
      if (draft.compat?.supportsDeveloperRole !== undefined && (draft.compat.supportsDeveloperRole !== null || existing.compat?.supportsDeveloperRole !== undefined)) {
        next = patch(next, [...path, "compat", "supportsDeveloperRole"], draft.compat.supportsDeveloperRole ?? undefined);
      }
      // Update by ID, preserving hidden fields and comments on surviving models.
      let oldModels = existing.models ?? [];
      const keep = new Set(draft.models.map((m) => m.id));
      for (let i = oldModels.length - 1; i >= 0; i--) {
        if (!keep.has(oldModels[i].id)) next = patch(next, [...path, "models", i], undefined);
      }
      oldModels = parseDocument(next).providers[draft.id].models ?? [];
      if (!existing.models) next = patch(next, [...path, "models"], []);
      for (const model of draft.models) {
        const index = oldModels.findIndex((m: JsonObject) => m.id === model.id);
        if (index < 0) {
          next = patch(next, [...path, "models", -1], storedModel(model));
          oldModels.push(model);
        } else {
          for (const field of ["name", "contextWindow", "maxTokens", "reasoning", "input"] as const) {
            next = patch(next, [...path, "models", index, field], model[field]);
          }
          if (model.compat?.supportsDeveloperRole !== undefined && (model.compat.supportsDeveloperRole !== null || oldModels[index].compat?.supportsDeveloperRole !== undefined)) {
            next = patch(next, [...path, "models", index, "compat", "supportsDeveloperRole"], model.compat.supportsDeveloperRole ?? undefined);
          }
        }
      }
      return next;
    });
  }
}
