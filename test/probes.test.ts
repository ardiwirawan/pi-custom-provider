import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ProviderService } from "../src/service.ts";
import { APIS } from "../src/types.ts";
import { CAPABILITIES } from "../src/probes.ts";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { parseDocument } from "../src/storage.ts";
import { mockProvider, temporaryAgent } from "./fixtures.ts";

for (const api of APIS) test(`${api}: verifies tool round-trip, reasoning and image content without changing model metadata`, async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider(); t.after(upstream.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "probe-gateway", api, baseUrl: `${upstream.base}/${api === "anthropic-messages" ? "anthropic" : "v1"}`, apiKey: "probe-secret", models: [{ id: "probe-model", reasoning: false, input: ["text"] }] };
  await service.save({ ...draft, revision: (await service.state()).revision });
  const before = await readFile(join(temp.dir, "models.json"), "utf8");
  for (const capability of CAPABILITIES) {
    const result = await service.testModel(draft, "probe-model", undefined, capability);
    assert.equal(result.outcome, "supported", `${capability}: ${JSON.stringify(result)}`);
    assert.equal(result.requests, capability === "tools" ? 2 : 1);
    assert.equal(JSON.stringify(result).includes("probe-secret"), false);
    assert.equal(JSON.stringify(result).includes("Private simulated thinking"), false);
  }
  assert.equal(upstream.requests.length, 5);
  const [chat, tool, followup, reasoning, vision] = upstream.requests;
  assert.equal(chat.body.tools, undefined);
  assert.ok(chat.body.system || (chat.body.messages || chat.body.input)[0].role === "system");
  assert.equal(tool.body.tools.length, 1);
  assert.match(JSON.stringify(followup.body), /receipt/);
  assert.ok(reasoning.body.reasoning_effort || reasoning.body.reasoning || reasoning.body.thinking);
  assert.ok((reasoning.body.max_tokens || reasoning.body.max_completion_tokens || reasoning.body.max_output_tokens) <= 2048);
  assert.match(JSON.stringify(vision.body), /image/);
  assert.equal(await readFile(join(temp.dir, "models.json"), "utf8"), before);
});

test("HTTP 200 without capability evidence stays unconfirmed; malformed tool arguments are not executed", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "gateway", api: "openai-completions", apiKey: "secret", models: [{ id: "model" }] };
  for (const [behavior, capability, code] of [
    ["ignored", "tools", "no_tool_call"], ["invalid-tools", "tools", "invalid_tool_call"],
    ["hidden-reasoning", "reasoning", "no_reasoning_evidence"], ["wrong-vision", "vision", "vision_unconfirmed"],
  ] as const) {
    const upstream = await mockProvider({ behavior }); t.after(upstream.close);
    const result = await service.testModel({ ...draft, baseUrl: `${upstream.base}/v1` }, "model", undefined, capability);
    assert.equal(result.status, 200); assert.equal(result.outcome, "inconclusive"); assert.equal(result.code, code);
    assert.equal(upstream.requests.length, 1);
  }
});

test("reasoning token usage is evidence even without visible thinking; low budgets and invalid probes send nothing", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider({ behavior: "usage-reasoning" }); t.after(upstream.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "gateway", api: "openai-completions", baseUrl: `${upstream.base}/v1`, apiKey: "secret", models: [{ id: "model" }] };
  const result = await service.testModel(draft, "model", undefined, "reasoning");
  assert.equal(result.outcome, "supported"); assert.equal(result.reasoningTokens, 8);
  const limited = await service.testModel({ ...draft, models: [{ id: "model", maxTokens: 512 }] }, "model", undefined, "reasoning");
  assert.equal(limited.code, "reasoning_budget"); assert.equal(limited.requests, 0);
  await assert.rejects(service.testModel(draft, "model", undefined, "unknown"), /supported capability/);
  assert.equal(upstream.requests.length, 1);
});

test("probe failures are sanitized, redirects are not followed, and cancellation stops upstream work", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider(); t.after(upstream.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "gateway", api: "openai-completions", apiKey: "secret", models: [{ id: "model" }] };
  for (const [path, code, status] of [["rejected", "request_rejected", 400], ["unprocessable", "request_rejected", 422], ["bad-gateway", "gateway_error", 502], ["unauthorized", "auth_failed", 401], ["redirect", "redirect", 302]] as const) {
    const result = await service.testModel({ ...draft, baseUrl: `${upstream.base}/${path}` }, "model", undefined, "tools");
    assert.equal(result.outcome, "failed"); assert.equal(result.code, code); assert.equal(result.status, status);
    assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  }
  assert.equal(upstream.requests.some((r) => r.path === "/should-not-follow"), false);
  const slow = await mockProvider({ delayMs: 500 }); t.after(slow.close);
  const controller = new AbortController();
  const pending = service.testModel({ ...draft, baseUrl: `${slow.base}/v1` }, "model", controller.signal, "tools");
  while (!slow.requests.length) await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();
  assert.equal((await pending).code, "cancelled"); assert.equal(slow.requests.length, 1);
});

test("system role override resolves gateway 422 in probes and native Pi, preserving other settings and inheritance", async (t) => {
  const upstream = await mockProvider({ rejectDeveloperRole: true }); t.after(upstream.close);
  for (const api of ["openai-completions", "openai-responses"] as const) {
    const temp = await temporaryAgent(); t.after(temp.close);
    const draft = { id: "gateway", api, baseUrl: `${upstream.base}/v1`, apiKey: "role-test-secret",
      models: [{ id: "reasoning-model", reasoning: true }] };
    const original = `{
      // preserve provider and model compatibility
      "providers": { "gateway": {
        "api": "${api}", "baseUrl": "${upstream.base}/v1",
        "compat": { "supportsDeveloperRole": true },
        "models": [{ "id": "reasoning-model", "reasoning": true,
          "headers": {"X-Private": "PRIVATE HEADER"},
          "compat": { "supportsStrictMode": false, "supportsDeveloperRole": true } }]
      } }
    }`;
    await writeFile(join(temp.dir, "models.json"), original);
    const service = new ProviderService(temp.dir); await service.initialize();
    const rejected = await service.testModel(draft, "reasoning-model");
    assert.equal(rejected.status, 422); assert.equal(rejected.code, "developer_role_unsupported");
    assert.equal(rejected.outcome, "failed"); assert.equal(rejected.requests, 1);
    assert.equal(JSON.stringify(rejected).includes("PRIVATE"), false);
    const fixed = { ...draft, models: [{ ...draft.models[0], compat: { supportsDeveloperRole: false } }] };
    for (const capability of CAPABILITIES) {
      const result = await service.testModel(fixed, "reasoning-model", undefined, capability);
      assert.equal(result.outcome, "supported", `${api} ${capability}: ${JSON.stringify(result)}`);
      const body = upstream.requests.at(-1)!.body;
      assert.equal((body.messages || body.input)[0].role, "system");
    }
    assert.equal(await readFile(join(temp.dir, "models.json"), "utf8"), original);
    const saved = await service.save({ ...fixed, revision: (await service.state()).revision });
    const text = await readFile(join(temp.dir, "models.json"), "utf8");
    const config = parseDocument(text).providers.gateway;
    assert.match(text, /preserve provider and model compatibility/);
    assert.equal(config.compat.supportsDeveloperRole, true);
    assert.deepEqual(config.models[0].compat, { supportsStrictMode: false, supportsDeveloperRole: false });
    assert.equal(config.models[0].reasoning, true);
    assert.deepEqual(saved.state.providers[0].models[0].compat, { supportsDeveloperRole: false });
    assert.equal(JSON.stringify(saved.state).includes("PRIVATE HEADER"), false);
    const runtime = await ModelRuntime.create({ authPath: join(temp.dir, "auth.json"), modelsPath: join(temp.dir, "models.json"), refreshOnCreate: false });
    const model = runtime.getModel("gateway", "reasoning-model")!;
    const reply = await runtime.completeSimple(model, { systemPrompt: "You are a helpful assistant.", messages: [{ role: "user", content: "Reply OK.", timestamp: Date.now() }] }, { maxTokens: 256, maxRetries: 0 });
    assert.equal(reply.stopReason, "stop");
    assert.equal((upstream.requests.at(-1)!.body.messages || upstream.requests.at(-1)!.body.input)[0].role, "system");
    // Old clients that omit the editable override must not erase the saved fix.
    const preserved = await service.save({ ...draft, apiKey: undefined, revision: saved.state.revision });
    assert.equal(preserved.state.providers[0].models[0].compat?.supportsDeveloperRole, false);
    const inherited = { ...draft, apiKey: undefined, models: [{ ...draft.models[0], compat: { supportsDeveloperRole: null } }] };
    assert.equal((await service.testModel(inherited, "reasoning-model")).code, "developer_role_unsupported");
    await service.save({ ...inherited, revision: preserved.state.revision });
    assert.deepEqual(parseDocument(await readFile(join(temp.dir, "models.json"), "utf8")).providers.gateway.models[0].compat, { supportsStrictMode: false });
    await assert.rejects(service.testModel({ ...draft, models: [{ id: "reasoning-model", compat: { supportsDeveloperRole: "false" } }] }, "reasoning-model"), /Invalid developer-role/);
  }
});

test("provider role defaults cover current and new models, with explicit model overrides and reset support", async (t) => {
  const upstream = await mockProvider({ rejectDeveloperRole: true }); t.after(upstream.close);
  for (const api of ["openai-completions", "openai-responses"] as const) {
    const temp = await temporaryAgent(); t.after(temp.close);
    const original = `{
      // keep provider compatibility and routing private
      "providers": { "gateway": { "api": "${api}", "baseUrl": "${upstream.base}/v1",
        "compat": { "supportsStrictMode": false, "supportsDeveloperRole": true,
          "openRouterRouting": { "only": ["PRIVATE ROUTING"] } },
        "models": [{ "id": "inherited", "reasoning": true },
          { "id": "override", "reasoning": true, "compat": { "supportsDeveloperRole": true } }]
      } }
    }`;
    await writeFile(join(temp.dir, "models.json"), original);
    const service = new ProviderService(temp.dir); await service.initialize();
    const draft = { id: "gateway", api, baseUrl: `${upstream.base}/v1`, apiKey: "test-secret",
      compat: { supportsDeveloperRole: false },
      models: [{ id: "inherited", reasoning: true }, { id: "override", reasoning: true }, { id: "new-model", reasoning: true }] };
    for (const id of ["inherited", "new-model"]) {
      assert.equal((await service.testModel(draft, id)).outcome, "supported");
      assert.equal((upstream.requests.at(-1)!.body.messages || upstream.requests.at(-1)!.body.input)[0].role, "system");
    }
    assert.equal((await service.testModel(draft, "override")).code, "developer_role_unsupported");
    assert.equal(await readFile(join(temp.dir, "models.json"), "utf8"), original);
    const saved = await service.save({ ...draft, revision: (await service.state()).revision });
    assert.deepEqual(saved.state.providers[0].compat, { supportsDeveloperRole: false });
    assert.equal(JSON.stringify(saved.state).includes("PRIVATE ROUTING"), false);
    const native = await ModelRuntime.create({ authPath: join(temp.dir, "auth.json"), modelsPath: join(temp.dir, "models.json"), refreshOnCreate: false });
    for (const [id, expected] of [["inherited", false], ["new-model", false], ["override", true]] as const) {
      const compat = native.getModel("gateway", id)!.compat;
      assert.ok(compat && "supportsDeveloperRole" in compat);
      assert.equal(compat.supportsDeveloperRole, expected);
    }
    const preserved = await service.save({ ...draft, compat: undefined, revision: saved.state.revision });
    assert.equal(preserved.state.providers[0].compat?.supportsDeveloperRole, false);
    const reset = { ...draft, compat: { supportsDeveloperRole: null } };
    assert.equal((await service.testModel(reset, "inherited")).code, "developer_role_unsupported");
    await service.save({ ...reset, revision: preserved.state.revision });
    const text = await readFile(join(temp.dir, "models.json"), "utf8");
    const config = parseDocument(text).providers.gateway;
    assert.match(text, /keep provider compatibility and routing private/);
    assert.equal(config.compat.supportsDeveloperRole, undefined);
    assert.equal(config.compat.supportsStrictMode, false);
    assert.deepEqual(config.compat.openRouterRouting, { only: ["PRIVATE ROUTING"] });
    assert.equal(config.models[1].compat.supportsDeveloperRole, true);
    await assert.rejects(service.testModel({ ...draft, compat: { supportsDeveloperRole: "false" } }, "inherited"), /Invalid developer-role/);
  }
});
