import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { discoverAndLoadExtensions, ModelRegistry, ModelRuntime, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { mockProvider, temporaryAgent } from "./fixtures.ts";
import { ProviderService } from "../src/service.ts";
import { join } from "node:path";
import type { Api, ImageContent, Model } from "@earendil-works/pi-ai";
import { transformToolImages, transformUserImages } from "../src/vision-fallback.ts";

test("Pi's official loader registers the command, serves assets, and closes on session shutdown", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = temp.dir;
  t.after(() => { if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous; });
  const loaded = await discoverAndLoadExtensions([resolve("src/index.ts")], temp.dir, temp.dir);
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 1);
  const extension = loaded.extensions[0];
  const command = extension.commands.get("custom-provider");
  assert.ok(command);
  const notices: string[] = [];
  const ctx = { ui: { notify: (message: string) => notices.push(message) }, modelRegistry: { refresh: async () => {} } } as unknown as ExtensionCommandContext;
  const shutdown = async () => {
    for (const handler of extension.handlers.get("session_shutdown") ?? []) await handler({ type: "session_shutdown", reason: "quit" }, ctx);
  };
  t.after(shutdown);
  await command.handler("--no-browser", ctx);
  const url = notices.find((message) => message.startsWith("Provider manager: "))?.slice("Provider manager: ".length);
  assert.ok(url);
  const response = await fetch(url);
  assert.equal(response.status, 200); assert.match(await response.text(), /Provider Manager/);
  await shutdown();
  await assert.rejects(fetch(url));
});

test("vision fallback converts user and tool images while keeping the text model active", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider({ behavior: "ignored" }); t.after(upstream.close);
  const service = new ProviderService(temp.dir); await service.initialize();
  await service.save({ id: "gateway", api: "openai-completions", baseUrl: `${upstream.base}/v1`, apiKey: "test-secret",
    models: [{ id: "text-model", input: ["text"] }, { id: "vision-model", input: ["text", "image"] }], revision: (await service.state()).revision });
  const state = await service.state();
  await service.setVisionFallback("gateway", "vision-model", state.visionFallbackRevision);
  const runtime = await ModelRuntime.create({ authPath: join(temp.dir, "auth.json"), modelsPath: join(temp.dir, "models.json"), refreshOnCreate: false });
  const active = runtime.getModel("gateway", "text-model")!;
  const notifications: string[] = [];
  const ctx = { model: active, modelRegistry: new ModelRegistry(runtime), signal: undefined,
    ui: { notify: (message: string) => notifications.push(message), setWorkingMessage: () => {} } } as unknown as ExtensionCommandContext;
  const image: ImageContent = { type: "image", mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=" };
  const user = await transformUserImages(temp.dir, { text: "Inspect this", images: [image] }, ctx);
  assert.equal(user?.action, "transform", notifications.join(" | "));
  if (user?.action !== "transform") throw new Error("Expected transformed input");
  assert.deepEqual(user.images, []); assert.match(user.text, /Vision fallback analysis/);
  assert.equal(active.id, "text-model");
  assert.equal(upstream.requests.at(-1)?.body.model, "vision-model");
  assert.ok(upstream.requests.at(-1)?.body.messages[1].content.some((part: any) => part.type === "image_url"));
  const tool = await transformToolImages(temp.dir, { content: [{ type: "text", text: "tool context" }, image] }, ctx);
  assert.ok(tool?.content?.every((part) => part.type === "text"));
  assert.match((tool?.content?.at(-1) as any).text, /Vision fallback analysis/);
  assert.ok((tool?.usage?.totalTokens ?? 0) > 0);
  assert.match(notifications[0], /continuing with gateway\/text-model/);
  const native = { ...active, input: ["text", "image"] as ("text" | "image")[] };
  const nativeCtx = { ...ctx, model: native } as unknown as ExtensionCommandContext;
  assert.equal(await transformUserImages(temp.dir, { text: "Inspect", images: [image] }, nativeCtx), undefined);
});

test("panel saves and reload refresh the active model; busy sessions defer synchronization until settled", async (t) => {
  const temp = await temporaryAgent(); t.after(temp.close);
  const upstream = await mockProvider({ rejectDeveloperRole: true }); t.after(upstream.close);
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = temp.dir;
  t.after(() => { if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous; });
  const service = new ProviderService(temp.dir); await service.initialize();
  const draft = { id: "gateway", api: "openai-completions", baseUrl: `${upstream.base}/v1`, apiKey: "test-secret", models: [{ id: "model", reasoning: true }] };
  let saved = await service.save({ ...draft, revision: (await service.state()).revision });
  const runtime = await ModelRuntime.create({ authPath: join(temp.dir, "auth.json"), modelsPath: join(temp.dir, "models.json"), refreshOnCreate: false });
  let active = runtime.getModel("gateway", "model")!;
  const activeRole = () => active.compat && "supportsDeveloperRole" in active.compat ? active.compat.supportsDeveloperRole : undefined;
  let idle = true, selections = 0;
  const loaded = await discoverAndLoadExtensions([resolve("src/index.ts")], temp.dir, temp.dir);
  assert.deepEqual(loaded.errors, []);
  loaded.runtime.setModel = async (model: Model<Api>) => { active = model; selections++; return true; };
  const extension = loaded.extensions[0];
  const notices: string[] = [];
  const ctx = { ui: { notify: (message: string) => notices.push(message) }, modelRegistry: new ModelRegistry(runtime),
    get model() { return active; }, isIdle: () => idle } as unknown as ExtensionCommandContext;
  const shutdown = async () => {
    for (const handler of extension.handlers.get("session_shutdown") ?? []) await handler({ type: "session_shutdown", reason: "quit" }, ctx);
  };
  t.after(shutdown);
  await extension.commands.get("custom-provider")!.handler("--no-browser", ctx);
  const url = new URL(notices.find((message) => message.startsWith("Provider manager: "))!.slice("Provider manager: ".length));
  const headers = { "Content-Type": "application/json", "X-Manager-Token": new URLSearchParams(url.hash.slice(1)).get("token")! };
  const saveFromPanel = async (system: boolean) => {
    const response = await fetch(`${url.origin}/api/save`, { method: "POST", headers, body: JSON.stringify({ ...draft, apiKey: undefined,
      compat: { supportsDeveloperRole: !system }, revision: saved.state.revision }) });
    assert.equal(response.status, 200);
    saved = await response.json() as typeof saved;
    assert.equal(saved.warning, undefined);
  };
  await saveFromPanel(true);
  assert.equal(activeRole(), false); assert.equal(selections, 1);
  const reply = await runtime.completeSimple(active, { systemPrompt: "Follow the user instruction.", messages: [{ role: "user", content: "Reply OK.", timestamp: Date.now() }] }, { maxTokens: 256, maxRetries: 0 });
  assert.equal(reply.stopReason, "stop"); assert.equal(upstream.requests.at(-1)!.body.messages[0].role, "system");
  idle = false;
  await saveFromPanel(false);
  assert.equal(activeRole(), false); assert.equal(selections, 1);
  idle = true;
  for (const handler of extension.handlers.get("agent_settled") ?? []) await handler({ type: "agent_settled" }, ctx);
  assert.equal(activeRole(), true); assert.equal(selections, 2);
  // An external models.json change must also take effect after /reload.
  saved = await service.save({ ...draft, apiKey: undefined, compat: { supportsDeveloperRole: false }, revision: saved.state.revision });
  for (const handler of extension.handlers.get("session_start") ?? []) await handler({ type: "session_start", reason: "reload" }, ctx);
  assert.equal(activeRole(), false); assert.equal(selections, 3);
  for (const handler of extension.handlers.get("session_start") ?? []) await handler({ type: "session_start", reason: "reload" }, ctx);
  assert.equal(selections, 3);
});
