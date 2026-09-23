import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { ProviderService } from "../src/service.ts";
import { startManager } from "../src/server.ts";
import { endpointUrls, discover, requestHeaders } from "../src/discovery.ts";
import { mockProvider, temporaryAgent } from "./fixtures.ts";

test("OpenAI discovery, auth.json save, native Pi availability and streaming for both OpenAI protocols", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider(); t.after(upstream.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "gateway", baseUrl: `${upstream.base}/v1`, api: "openai-completions", apiKey: "test-secret", models: [], revision: (await service.state()).revision };
  const found = await service.fetchModels(draft, true);
  assert.equal(found.complete, true); assert.equal(found.models.length, 2);
  assert.equal(upstream.requests[0].headers.authorization, "Bearer test-secret");
  assert.equal(found.models[0].contextWindow, undefined);
  const saved = await service.save({ ...draft, models: [{ id: "model-a" }] });
  assert.equal(saved.warning, undefined);
  const auth = JSON.parse(await readFile(join(temp.dir, "auth.json"), "utf8"));
  assert.deepEqual(auth.gateway, { type: "api_key", key: "test-secret" });
  assert.equal((await readFile(join(temp.dir, "models.json"), "utf8")).includes("test-secret"), false);
  const runtime = await ModelRuntime.create({ authPath: join(temp.dir, "auth.json"), modelsPath: join(temp.dir, "models.json") });
  assert.ok((await runtime.getAvailable("gateway")).some((m) => m.id === "model-a"));
  const probeDraft = { ...draft, apiKey: undefined, models: [{ id: "model-a" }] };
  assert.equal((await service.testModel(probeDraft, "model-a")).ok, true);
  assert.equal(upstream.requests.at(-1)?.path, "/v1/chat/completions");
  assert.equal(upstream.requests.at(-1)?.body.stream, true);
  assert.equal(upstream.requests.at(-1)?.body.tools, undefined);
  assert.equal((await service.testModel({ ...probeDraft, api: "openai-responses" }, "model-a")).ok, true);
  assert.equal(upstream.requests.at(-1)?.path, "/v1/responses");
});

test("Anthropic discovery follows all pages and native SDK preserves gateway prefix", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider(); t.after(upstream.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "claude-gateway", baseUrl: `${upstream.base}/anthropic`, api: "anthropic-messages", apiKey: "test-secret", models: [] };
  const found = await service.fetchModels(draft, true);
  assert.equal(found.pages, 2); assert.equal(found.complete, true);
  assert.deepEqual(found.models.map((m) => m.id), ["claude-test-a", "claude-test-b"]);
  assert.equal(found.models[0].contextWindow, 200000);
  assert.deepEqual(found.models[0].input, ["text", "image"]);
  assert.equal(upstream.requests[0].headers["x-api-key"], "test-secret");
  assert.equal(upstream.requests[0].headers["anthropic-version"], "2023-06-01");
  assert.match(upstream.requests[1].path, /after_id=claude-test-a/);
  const result = await service.testModel({ ...draft, models: [{ id: "claude-test-a" }] }, "claude-test-a");
  assert.equal(result.ok, true); assert.equal(new URL(result.url).pathname, "/anthropic/v1/messages");
  assert.equal(upstream.requests.at(-1)?.body.max_tokens, 256);
  assert.deepEqual(endpointUrls("https://proxy.example/anthropic", "anthropic-messages"), {
    models: "https://proxy.example/anthropic/v1/models", chat: "https://proxy.example/anthropic/v1/messages",
  });
});

test("saving preserves comments, advanced fields, unrelated keys and refuses stale revisions", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const original = `{
  // handwritten context
  "providers": {
    "gateway": { "api": "openai-completions", "baseUrl": "https://old.example/v1", "headers": {"X-Private":"hidden-header"}, "compat": {"supportsDeveloperRole": false},
      "models": [{"id":"model-a", "contextWindow":32000, "compat":{"supportsStore":false}, "futureField":42}] },
    "other": { "api": "openai-completions", "baseUrl": "https://other.example/v1", "models": [{"id":"other"}] }
  }, "futureTopLevel": true
}\n`;
  await writeFile(join(temp.dir, "models.json"), original);
  const unrelated = { type: "oauth", access: "oauth-secret", refresh: "refresh-secret", expires: 9999999999999 };
  await writeFile(join(temp.dir, "auth.json"), JSON.stringify({ other: unrelated }));
  const service = new ProviderService(temp.dir); await service.initialize();
  const before = await service.state();
  assert.equal(JSON.stringify(before).includes("hidden-header"), false);
  assert.equal(JSON.stringify(before).includes("oauth-secret"), false);
  const draft = { id: "gateway", api: "openai-completions", baseUrl: "https://new.example/v1", apiKey: "new-secret", models: [{ id: "model-a", contextWindow: 64000 }], revision: before.revision };
  await service.save(draft);
  const afterText = await readFile(join(temp.dir, "models.json"), "utf8");
  assert.match(afterText, /handwritten context/); assert.match(afterText, /futureField/);
  assert.match(afterText, /hidden-header/); assert.match(afterText, /futureTopLevel/);
  assert.deepEqual(JSON.parse(await readFile(join(temp.dir, "auth.json"), "utf8")).other, unrelated);
  await assert.rejects(service.save(draft), /changed in another window/);
  assert.equal((await readdir(join(temp.dir, "provider-manager-backups"))).length, 1);
  await writeFile(join(temp.dir, "settings.json"), '{"theme":"dark","futureSetting":42}\n');
  await service.setDefault("gateway", "model-a");
  const settings = JSON.parse(await readFile(join(temp.dir, "settings.json"), "utf8"));
  assert.equal(settings.theme, "dark"); assert.equal(settings.futureSetting, 42); assert.equal(settings.defaultModel, "model-a");
});

test("endpoint failure diagnostics, redirects and incomplete pagination are explicit", async (t) => {
  const upstream = await mockProvider(); t.after(upstream.close);
  const headers = requestHeaders("openai-completions", "secret");
  for (const [prefix, match] of [["unauthorized", /refused access/], ["missing", /unavailable/], ["html", /JSON/], ["redirect", /redirected/]] as const) {
    await assert.rejects(discover({ api: "openai-completions", baseUrl: `${upstream.base}/${prefix}`, headers, allPages: true }), match);
  }
  assert.ok(!upstream.requests.some((r) => r.path === "/should-not-follow"));
  const result = await discover({ api: "anthropic-messages", baseUrl: `${upstream.base}/repeated`, headers, allPages: true });
  assert.equal(result.complete, false); assert.match(result.warning!, /incomplete/); assert.equal(result.pages, 2);
});

test("local HTTP API requires token and same origin, with no secrets in browser state", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const manager = await startManager(temp.dir); t.after(manager.close);
  assert.equal((await fetch(`${manager.origin}/`)).status, 200);
  assert.equal((await fetch(`${manager.origin}/api/state`)).status, 401);
  assert.equal((await fetch(`${manager.origin}/api/state`, { headers: { "X-Manager-Token": manager.token, Origin: "https://other.example" } })).status, 403);
  const headers = { "X-Manager-Token": manager.token, "Content-Type": "application/json" };
  const state = await (await fetch(`${manager.origin}/api/state`, { headers })).json() as any;
  const response = await fetch(`${manager.origin}/api/save`, { method: "POST", headers, body: JSON.stringify({
    id: "gateway", api: "openai-completions", baseUrl: "https://example.com/v1", apiKey: "PRIVATE-secret", models: [{ id: "model-a" }], revision: state.revision,
  }) });
  assert.equal(response.status, 200); assert.equal((await response.text()).includes("PRIVATE-secret"), false);
  const body = await (await fetch(`${manager.origin}/api/state`, { headers })).text();
  assert.equal(body.includes("PRIVATE-secret"), false);
  assert.match(body, /auth.json/);
});

test("model edits merge by ID, preserve key on blank input, and literal keys survive Pi interpolation", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const key = "!prefix-$SOME_VARIABLE-${ALSO_LITERAL}";
  const draft = { id: "custom", api: "openai-completions", baseUrl: "https://example.com/v1", apiKey: key,
    models: [{ id: "a" }, { id: "b" }], revision: (await service.state()).revision };
  const first = await service.save(draft); assert.equal(first.warning, undefined);
  await service.save({ ...draft, apiKey: undefined, models: [{ id: "b" }, { id: "c" }], revision: first.state.revision });
  const runtime = await ModelRuntime.create({ authPath: join(temp.dir, "auth.json"), modelsPath: join(temp.dir, "models.json") });
  assert.equal((await runtime.getAuth("custom"))?.auth.apiKey, key);
  assert.deepEqual(runtime.getModels("custom").map((m) => m.id), ["b", "c"]);
  await service.removeKey("custom");
  assert.equal(JSON.parse(await readFile(join(temp.dir, "auth.json"), "utf8")).custom, undefined);
  const state = await service.state();
  await service.remove("custom", state.revision);
  assert.equal((await service.state()).providers.length, 0);
});

test("vision fallback configuration only accepts authenticated image models and preserves unrelated fields", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider(); t.after(upstream.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  let saved = await service.save({ id: "gateway", api: "openai-completions", baseUrl: `${upstream.base}/v1`, apiKey: "test-secret",
    models: [{ id: "text-model", input: ["text"] }, { id: "vision-model", input: ["text", "image"] }], revision: (await service.state()).revision });
  const before = await service.state();
  await assert.rejects(service.setVisionFallback("gateway", "text-model", before.visionFallbackRevision), /support images/);
  const configured = await service.setVisionFallback("gateway", "vision-model", before.visionFallbackRevision);
  assert.deepEqual(configured.state.visionFallback, { provider: "gateway", model: "vision-model" });
  assert.ok(configured.state.visionModels.some((model: any) => model.provider === "gateway" && model.id === "vision-model"));
  const path = join(temp.dir, "pi-custom-provider.json");
  const text = await readFile(path, "utf8");
  await writeFile(path, text.replace(/\{/, '{\n  "futureSetting": true,'));
  const refreshed = await service.state();
  const disabled = await service.setVisionFallback("", "", refreshed.visionFallbackRevision);
  assert.equal(disabled.state.visionFallback, null);
  assert.equal(JSON.parse(await readFile(path, "utf8")).futureSetting, true);
  assert.ok(saved.state.providers.length);
});

test("invalid files and provider IDs are not overwritten", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "__proto__", api: "openai-completions", baseUrl: "https://example.com/v1", models: [{ id: "a" }] };
  await assert.rejects(service.save(draft), /Provider ID/);
  await assert.rejects(service.save({ ...draft, id: "openai" }), /managed by Pi/);
  await writeFile(join(temp.dir, "models.json"), "{broken-json");
  await assert.rejects(service.save({ ...draft, id: "custom" }), /invalid JSON/);
  assert.equal(await readFile(join(temp.dir, "models.json"), "utf8"), "{broken-json");
});

test("saving automatic role settings works when provider and model have no compat object", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  await writeFile(join(temp.dir, "models.json"), JSON.stringify({ providers: { gateway: {
    api: "openai-completions", baseUrl: "https://example.com/v1", models: [{ id: "model" }],
  } } }));
  const service = new ProviderService(temp.dir); await service.initialize();
  await service.save({ id: "gateway", api: "openai-completions", baseUrl: "https://example.com/v1",
    compat: { supportsDeveloperRole: null }, models: [{ id: "model", compat: { supportsDeveloperRole: null }, contextWindow: 200000, maxTokens: 32000 }],
    revision: (await service.state()).revision });
  const saved = JSON.parse(await readFile(join(temp.dir, "models.json"), "utf8"));
  assert.equal(saved.providers.gateway.compat, undefined);
  assert.equal(saved.providers.gateway.models[0].compat, undefined);
  assert.equal(saved.providers.gateway.models[0].maxTokens, 32000);
});
