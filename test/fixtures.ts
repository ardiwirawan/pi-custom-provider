import { createServer } from "node:http";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { inflateSync } from "node:zlib";

export async function temporaryAgent() {
  const base = resolve(".sandbox", "tests");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(join(base, "agent-"));
  return { dir, close: () => rm(dir, { recursive: true, force: true }) };
}

export async function mockProvider(options: { behavior?: "ignored" | "invalid-tools" | "hidden-reasoning" | "wrong-vision" | "usage-reasoning"; delayMs?: number; rejectModel?: string; rejectDeveloperRole?: boolean; modelList?: Record<string, unknown>[] } = {}) {
  const requests: { path: string; headers: Record<string, any>; body?: any }[] = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    requests.push({ path: request.url!, headers: request.headers, body });
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (response.destroyed) return;
    if (options.rejectModel && body?.model === options.rejectModel) { response.writeHead(403); response.end("PRIVATE ERROR"); return; }
    const messages = body?.messages || body?.input || [];
    if (options.rejectDeveloperRole && messages.some((m: any) => m.role === "developer")) {
      response.writeHead(422, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: 'Failed to deserialize: messages[0].role: unknown variant `developer`, expected one of `system`, `user`, `assistant`, `tool`. PRIVATE ERROR', type: "invalid_request_error" } }));
      return;
    }
    if (url.pathname.includes("/unauthorized/")) { response.writeHead(401); response.end("PRIVATE KEY IN UPSTREAM ERROR"); return; }
    if (url.pathname.includes("/missing/")) { response.writeHead(404); response.end(); return; }
    if (url.pathname.includes("/rejected/")) { response.writeHead(400); response.end("PRIVATE KEY IN UPSTREAM ERROR"); return; }
    if (url.pathname.includes("/unprocessable/")) { response.writeHead(422); response.end("PRIVATE UNRELATED VALIDATION ERROR"); return; }
    if (url.pathname.includes("/bad-gateway/")) { response.writeHead(502); response.end("PRIVATE BAD GATEWAY ERROR"); return; }
    if (url.pathname.includes("/redirect/")) { response.writeHead(302, { Location: "/should-not-follow" }); response.end(); return; }
    if (url.pathname.includes("/html/")) { response.end("<html>Not an API</html>"); return; }
    if (url.pathname.endsWith("/models")) {
      response.setHeader("Content-Type", "application/json");
      if (options.modelList) { response.end(JSON.stringify({ data: options.modelList })); return; }
      if (url.pathname.includes("anthropic") || url.pathname.includes("repeated")) {
        if (url.searchParams.has("after_id")) response.end(JSON.stringify({
          data: [{ id: "claude-test-b" }], has_more: url.pathname.includes("repeated"), last_id: "claude-test-a",
        }));
        else response.end(JSON.stringify({ data: [{ id: "claude-test-a", display_name: "Claude test A",
          max_input_tokens: 200000, max_tokens: 4096, capabilities: { image_input: { supported: true }, thinking: { supported: true } } }],
          has_more: true, last_id: "claude-test-a" }));
      } else response.end(JSON.stringify({ object: "list", data: [{ id: "model-a" }, { id: "model-b" }, { id: "model-a" }] }));
      return;
    }
    response.setHeader("Content-Type", "text/event-stream");
    const event = (name: string, value: unknown) => response.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
    const last = messages.at(-1);
    const blocks = messages.flatMap((m: any) => Array.isArray(m.content) ? m.content : []);
    const toolResult = last?.role === "tool" ? last.content : last?.type === "function_call_output" ? last.output : blocks.find((b: any) => b.type === "tool_result")?.content;
    const tool = body?.tools?.[0]?.function || body?.tools?.[0];
    const schema = tool?.parameters || tool?.input_schema;
    const toolCall = !!tool && !toolResult && options.behavior !== "ignored";
    const args = { nonce: options.behavior === "invalid-tools" ? "wrong" : schema?.properties.nonce.const };
    const reasoning = !!(body?.reasoning_effort || body?.reasoning?.effort || ["enabled", "adaptive"].includes(body?.thinking?.type)) && options.behavior !== "ignored";
    const thinking = reasoning && options.behavior !== "hidden-reasoning" && options.behavior !== "usage-reasoning";
    const reasoningTokens = reasoning && options.behavior !== "hidden-reasoning" ? 8 : 0;
    let reply = "OK";
    if (toolResult) {
      const text = Array.isArray(toolResult) ? toolResult.map((b: any) => b.text || "").join("") : toolResult;
      reply = JSON.parse(text).receipt;
    }
    const image = blocks.find((b: any) => ["image_url", "input_image", "image"].includes(b.type));
    if (image && options.behavior !== "ignored" && options.behavior !== "wrong-vision") {
      const base64 = image.source?.data || (typeof image.image_url === "string" ? image.image_url : image.image_url.url).split(",")[1];
      const png = Buffer.from(base64, "base64"); const parts: Buffer[] = [];
      for (let offset = 8; offset < png.length;) {
        const length = png.readUInt32BE(offset);
        if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") parts.push(png.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
      }
      const pixels = inflateSync(Buffer.concat(parts));
      const palette: Record<string, string> = { "255,0,0": "red", "0,180,0": "green", "0,0,255": "blue", "255,255,0": "yellow", "0,0,0": "black", "255,255,255": "white" };
      reply = JSON.stringify([[32, 32], [96, 32], [32, 96], [96, 96]].map(([x, y]) => palette[[...pixels.subarray(y * 385 + 1 + x * 3, y * 385 + 4 + x * 3)].join(",")]));
    }
    if (url.pathname.endsWith("/chat/completions")) {
      response.write(`data: ${JSON.stringify({ id: "chat-test", object: "chat.completion.chunk", created: 1, model: body.model,
        choices: [{ index: 0, delta: { role: "assistant", ...(toolCall ? { tool_calls: [{ index: 0, id: "call_probe", type: "function", function: { name: tool.name, arguments: JSON.stringify(args) } }] }
          : { content: reply, ...(thinking ? { reasoning_content: "Private simulated thinking" } : {}) }), }, finish_reason: null }] })}\n\n`);
      response.write(`data: ${JSON.stringify({ id: "chat-test", object: "chat.completion.chunk", created: 1, model: body.model,
        choices: [{ index: 0, delta: {}, finish_reason: toolCall ? "tool_calls" : "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20, completion_tokens_details: { reasoning_tokens: reasoningTokens } } })}\n\n`);
      response.end("data: [DONE]\n\n"); return;
    }
    if (url.pathname.endsWith("/responses")) {
      const item = { id: "msg_test", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: reply, annotations: [] }] };
      event("response.created", { type: "response.created", response: { id: "resp_test", object: "response", status: "in_progress", output: [] } });
      const extra: any[] = [];
      if (toolCall) {
        const call = { id: "fc_probe", call_id: "call_probe", type: "function_call", name: tool.name, arguments: JSON.stringify(args), status: "completed" };
        event("response.output_item.added", { type: "response.output_item.added", output_index: 0, item: { ...call, arguments: "" } });
        event("response.function_call_arguments.delta", { type: "response.function_call_arguments.delta", item_id: call.id, output_index: 0, delta: call.arguments });
        event("response.output_item.done", { type: "response.output_item.done", output_index: 0, item: call }); extra.push(call);
      } else {
      if (thinking) {
        const thought = { id: "rs_probe", type: "reasoning", summary: [{ type: "summary_text", text: "Private simulated thinking" }] };
        event("response.output_item.added", { type: "response.output_item.added", output_index: 1, item: { ...thought, summary: [] } });
        event("response.reasoning_summary_part.added", { type: "response.reasoning_summary_part.added", item_id: thought.id, output_index: 1, summary_index: 0, part: { type: "summary_text", text: "" } });
        event("response.reasoning_summary_text.delta", { type: "response.reasoning_summary_text.delta", item_id: thought.id, output_index: 1, summary_index: 0, delta: "Private simulated thinking" });
        event("response.output_item.done", { type: "response.output_item.done", output_index: 1, item: thought }); extra.push(thought);
      }
      event("response.output_item.added", { type: "response.output_item.added", output_index: 0, item: { ...item, content: [] } });
      event("response.content_part.added", { type: "response.content_part.added", item_id: item.id, output_index: 0, content_index: 0, part: { type: "output_text", text: "", annotations: [] } });
      event("response.output_text.delta", { type: "response.output_text.delta", item_id: item.id, output_index: 0, content_index: 0, delta: reply });
      event("response.output_item.done", { type: "response.output_item.done", output_index: 0, item });
      }
      event("response.completed", { type: "response.completed", response: { id: "resp_test", object: "response", status: "completed", output: [...extra, ...(toolCall ? [] : [item])],
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: reasoningTokens } } } });
      response.end(); return;
    }
    if (url.pathname.endsWith("/messages")) {
      event("message_start", { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", content: [], model: body.model, stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } });
      if (toolCall) {
        event("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "call_probe", name: tool.name, input: {} } });
        event("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(args) } });
        event("content_block_stop", { type: "content_block_stop", index: 0 });
      } else {
      if (thinking) {
        event("content_block_start", { type: "content_block_start", index: 1, content_block: { type: "thinking", thinking: "" } });
        event("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "thinking_delta", thinking: "Private simulated thinking" } });
        event("content_block_stop", { type: "content_block_stop", index: 1 });
      }
      event("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
      event("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: reply } });
      event("content_block_stop", { type: "content_block_stop", index: 0 });
      }
      event("message_delta", { type: "message_delta", delta: { stop_reason: toolCall ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 10, thinking_tokens: reasoningTokens } });
      event("message_stop", { type: "message_stop" }); response.end(); return;
    }
    response.writeHead(404); response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  return { base: `http://127.0.0.1:${address.port}`, requests,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }) };
}
