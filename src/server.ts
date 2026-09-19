import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ProviderService } from "./service.ts";
import { AppError, object } from "./types.ts";

async function body(request: IncomingMessage) {
  if (!request.headers["content-type"]?.startsWith("application/json")) throw new AppError("JSON content type required.", 415);
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_000_000) throw new AppError("Request too large.", 413);
    chunks.push(chunk);
  }
  try { const value = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (object(value)) return value; }
  catch { /* handled below */ }
  throw new AppError("Invalid JSON body.");
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

export async function startManager(dir: string, onSaved?: () => Promise<void>) {
  const token = randomBytes(32).toString("hex");
  const service = new ProviderService(dir, onSaved);
  await service.initialize();
  const lifecycle = new AbortController();
  let origin = "";
  let mutationPending = false;
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin)) {
        throw new AppError("Origin not allowed.", 403);
      }
      const path = new URL(request.url ?? "/", origin).pathname;
      if (!path.startsWith("/api/")) {
        if (request.method !== "GET") throw new AppError("Method not allowed.", 405);
        const assets: Record<string, [string, string]> = {
          "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/style.css": ["style.css", "text/css"],
        };
        const asset = assets[path];
        if (!asset) throw new AppError("Not found.", 404);
        const content = await readFile(fileURLToPath(new URL(`../web/${asset[0]}`, import.meta.url)));
        response.writeHead(200, { "Content-Type": `${asset[1]}; charset=utf-8` });
        response.end(content);
        return;
      }
      const candidate = request.headers["x-manager-token"];
      if (typeof candidate !== "string" || !/^[a-f0-9]{64}$/.test(candidate) || !timingSafeEqual(Buffer.from(candidate), Buffer.from(token))) {
        throw new AppError("Open the manager using the link printed by Pi.", 401);
      }
      if (path === "/api/state" && request.method === "GET") { json(response, 200, await service.state()); return; }
      if (request.method !== "POST") throw new AppError("Method not allowed.", 405);
      const input = await body(request);
      const controller = new AbortController();
      response.on("close", () => { if (!response.writableEnded) controller.abort(); });
      const signal = AbortSignal.any([controller.signal, lifecycle.signal]);
      const writes = ["/api/save", "/api/delete", "/api/remove-key", "/api/default"];
      const isWrite = writes.includes(path);
      if (isWrite && mutationPending) throw new AppError("Another save is in progress. Try again.", 409);
      if (isWrite) mutationPending = true;
      try {
        let result: unknown;
        switch (path) {
          case "/api/preview": result = await service.preview(input); break;
          case "/api/model-limits": result = service.modelLimits(input.modelId); break;
          case "/api/connection": result = await service.fetchModels(input, false, signal); break;
          case "/api/discover": result = await service.fetchModels(input, true, signal); break;
          case "/api/test-model": result = await service.testModel(input.provider, input.modelId, signal, input.capability); break;
          case "/api/save": result = await service.save(input); break;
          case "/api/delete": result = await service.remove(input.id, input.revision); break;
          case "/api/remove-key": result = await service.removeKey(input.id); break;
          case "/api/default": result = await service.setDefault(input.id, input.modelId); break;
          default: throw new AppError("Not found.", 404);
        }
        json(response, 200, result);
      } finally { if (isWrite) mutationPending = false; }
    } catch (error) {
      if (!response.destroyed && !response.headersSent) {
        json(response, error instanceof AppError ? error.status : 500,
          { error: error instanceof AppError ? error.message : "Operation failed. Check the configuration and filesystem permissions." });
      }
    }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start manager.");
  origin = `http://127.0.0.1:${address.port}`;
  server.unref();
  let closing: Promise<void> | undefined;
  return {
    url: `${origin}/#token=${token}`, origin, token,
    close() {
      if (!closing) {
        lifecycle.abort();
        closing = new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
      }
      return closing;
    },
  };
}
