import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { endpointLimits, LimitCatalog } from "../src/limits.ts";
import { ProviderService } from "../src/service.ts";
import { mockProvider, temporaryAgent } from "./fixtures.ts";

test("limit matching uses exact IDs and per-field consensus; endpoint bounds take priority", () => {
  const catalog = new LimitCatalog([
    { id: "precise-v1", contextWindow: 256000, maxTokens: 32000 },
    { id: "precise-v1", contextWindow: 256000, maxTokens: 32000 },
    { id: "ambiguous", contextWindow: 128000, maxTokens: 16000 },
    { id: "ambiguous", contextWindow: 256000, maxTokens: 16000 },
  ]);
  assert.deepEqual(catalog.lookup("precise-v1"), {
    contextWindow: { value: 256000, source: "catalog" }, maxTokens: { value: 32000, source: "catalog" },
  });
  for (const id of ["precise", "Precise-v1", "precise.v1", "vendor/precise-v1", "precise-v1-latest"]) assert.deepEqual(catalog.lookup(id), {});
  assert.deepEqual(catalog.lookup("ambiguous"), { ambiguous: ["contextWindow"], maxTokens: { value: 16000, source: "catalog" } });
  const hints = catalog.lookup("precise-v1", endpointLimits({ context_length: 32000, max_output_tokens: 8192 }, "openai-completions"));
  assert.equal(hints.contextWindow?.value, 32000); assert.equal(hints.contextWindow?.source, "endpoint");
  assert.equal(hints.maxTokens?.value, 8192);
});

test("metadata parser respects gateway caps and ignores invalid values and ambiguous max_tokens", () => {
  const hints = endpointLimits({ context_length: 200000, top_provider: { context_length: 128000, max_completion_tokens: 32000 },
    per_request_limits: { prompt_tokens: 64000, completion_tokens: 8192 } }, "openai-completions");
  assert.deepEqual(hints.contextWindow, { value: 64000, source: "endpoint", field: "per_request_limits.prompt_tokens" });
  assert.deepEqual(hints.maxTokens, { value: 8192, source: "endpoint", field: "per_request_limits.completion_tokens" });
  for (const value of [0, -1, 1.5, "32000", null, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = endpointLimits({ context_length: value, max_output_tokens: value, max_tokens: 90000 }, "openai-responses");
    assert.equal(invalid.contextWindow, undefined); assert.equal(invalid.maxTokens, undefined);
  }
  const anthropic = endpointLimits({ max_input_tokens: 200000, max_tokens: 64000 }, "anthropic-messages");
  assert.equal(anthropic.contextWindow?.value, 200000); assert.equal(anthropic.maxTokens?.value, 64000);
});

test("discovery enriches limits without inference or config writes, deduplicates metadata, and saves native numeric fields only", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const catalog = new LimitCatalog();
  const builtin = getBuiltinModels("openai").find((m) => catalog.lookup(m.id).contextWindow && catalog.lookup(m.id).maxTokens)!;
  assert.ok(builtin);
  const upstream = await mockProvider({ modelList: [
    { id: builtin.id },
    { id: "metadata-model", context_length: 256000, max_output_tokens: 48000 },
    { id: "metadata-model" },
    { id: "unmapped-private-model", max_tokens: 999999 },
  ] }); t.after(upstream.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "gateway", api: "openai-completions", baseUrl: `${upstream.base}/v1`, apiKey: "test-secret", models: [] };
  const before = await service.store.read();
  const found = await service.fetchModels(draft, true);
  assert.equal(found.models.length, 3); assert.equal(upstream.requests.length, 1);
  assert.equal(found.models[0].contextWindow, catalog.lookup(builtin.id).contextWindow?.value);
  assert.equal(found.models[0].limitHints?.contextWindow?.source, "catalog");
  assert.equal(found.models[0].reasoning, undefined); assert.equal(found.models[0].input, undefined);
  assert.equal(found.models[1].contextWindow, 256000); assert.equal(found.models[1].maxTokens, 48000);
  assert.equal(found.models[2].contextWindow, undefined); assert.equal(found.models[2].maxTokens, undefined);
  assert.equal((await service.store.read()).text, before.text);
  const saved = await service.save({ ...draft, revision: before.revision, models: found.models });
  const text = await readFile(join(temp.dir, "models.json"), "utf8");
  assert.equal(text.includes("limitHints"), false); assert.equal(text.includes("limitSources"), false);
  assert.equal(saved.state.providers[0].models[1].maxTokens, 48000);
  assert.equal(JSON.parse(text).providers.gateway.models[2].maxTokens, undefined);
  assert.deepEqual(service.modelLimits(builtin.id), catalog.lookup(builtin.id));
  assert.throws(() => service.modelLimits("bad\nmodel"), /valid model ID/);
});

test("model endpoint overrides do not inherit limits advertised for the provider's different endpoint", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider({ modelList: [{ id: "custom-overridden-model", context_length: 256000, max_output_tokens: 32000 }] }); t.after(upstream.close);
  await writeFile(join(temp.dir, "models.json"), JSON.stringify({ providers: { gateway: {
    api: "openai-completions", baseUrl: `${upstream.base}/v1`, models: [{ id: "custom-overridden-model", baseUrl: `${upstream.base}/different` }],
  } } }));
  const service = new ProviderService(temp.dir); await service.initialize();
  const found = await service.fetchModels({ id: "gateway", api: "openai-completions", baseUrl: `${upstream.base}/v1`, apiKey: "test-secret", models: [{ id: "custom-overridden-model" }] }, true);
  assert.equal(found.models[0].contextWindow, undefined); assert.equal(found.models[0].maxTokens, undefined);
  assert.equal(upstream.requests.length, 1);
});
