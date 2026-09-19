import { randomBytes, randomInt } from "node:crypto";
import { deflateSync } from "node:zlib";
import { Type, validateToolCall, type Api, type AssistantMessage, type Context, type Model, type Tool } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { endpointUrls } from "./discovery.ts";
import { APIS, AppError, type Protocol } from "./types.ts";

export const CAPABILITIES = ["chat", "tools", "reasoning", "vision"] as const;
export type Capability = typeof CAPABILITIES[number];
export interface ProbeResult {
  capability: Capability;
  outcome: "supported" | "inconclusive" | "failed";
  code: string;
  ok: boolean;
  url: string;
  status?: number;
  durationMs: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  stopReason?: string;
}

// Generate a fresh, lossless image locally. The answer is never supplied in text.
function visionChallenge() {
  const palette: [string, number[]][] = [
    ["red", [255, 0, 0]], ["green", [0, 180, 0]], ["blue", [0, 0, 255]],
    ["yellow", [255, 255, 0]], ["black", [0, 0, 0]], ["white", [255, 255, 255]],
  ];
  const colors = Array.from({ length: 4 }, () => palette.splice(randomInt(palette.length), 1)[0]);
  const pixels = Buffer.alloc(128 * (128 * 3 + 1));
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const rgb = colors[(y >= 64 ? 2 : 0) + (x >= 64 ? 1 : 0)][1];
    for (let c = 0; c < 3; c++) pixels[y * 385 + 1 + x * 3 + c] = rgb[c];
  }
  const chunk = (type: string, data: Buffer) => {
    const content = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, content, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(128, 0); header.writeUInt32BE(128, 4); header[8] = 8; header[9] = 2;
  const image = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
  return { image: image.toString("base64"), answer: colors.map(([name]) => name) };
}

const textOf = (message: AssistantMessage) => message.content.filter((c) => c.type === "text").map((c) => c.text).join("").trim();
const displayUrl = (url: string) => { const parsed = new URL(url); return `${parsed.origin}${parsed.pathname}`; };

export async function probeModel(runtime: ModelRuntime, original: Model<Api>, apiKey: string | undefined, capability: Capability, signal?: AbortSignal): Promise<ProbeResult> {
  if (!APIS.includes(original.api as Protocol)) throw new AppError("This model's API override cannot be tested here.");
  const started = Date.now();
  const timeout = AbortSignal.any([AbortSignal.timeout(capability === "chat" ? 30000 : 60000), ...(signal ? [signal] : [])]);
  const model = { ...original, maxTokens: Math.min(original.maxTokens, capability === "reasoning" ? 2048 : 256) };
  // Enable only in this transient runtime so Pi actually sends the capability probe.
  if (capability === "reasoning") model.reasoning = true;
  if (capability === "vision") model.input = ["text", "image"];
  let status: number | undefined;
  let url = displayUrl(endpointUrls(model.baseUrl, model.api as Protocol).chat);
  let requests = 0, inputTokens = 0, outputTokens = 0;
  let reasoningTokens: number | undefined, stopReason: string | undefined;
  let developerRoleRejected = false;
  const report = (outcome: ProbeResult["outcome"], code: string): ProbeResult => ({
    capability, outcome, code, ok: outcome === "supported", url, status, durationMs: Date.now() - started,
    requests, inputTokens, outputTokens, reasoningTokens, stopReason,
  });
  const complete = async (context: Context) => {
    // Exercise Pi's system/developer-role serialization, not just a bare user message.
    const result = await runtime.completeSimple(model, { ...context, systemPrompt: "Follow the user's instructions for this synthetic capability check." }, {
      apiKey, signal: timeout, maxTokens: model.maxTokens, maxRetries: 0, timeoutMs: 60000,
      transport: "sse", cacheRetention: "none",
      ...(capability === "reasoning" ? { reasoning: "low" as const, thinkingBudgets: { low: 1024 } } : {}),
      fetch: async (request, init) => {
        const target = new URL(request instanceof Request ? request.url : String(request));
        // Never expose credentials in model-override query strings or URL userinfo.
        url = displayUrl(target.toString());
        status = undefined; requests++;
        const response = await fetch(request, { ...init, redirect: "manual" });
        status = response.status;
        return response;
      },
    });
    inputTokens += result.usage.input; outputTokens += result.usage.output;
    if (result.usage.reasoning !== undefined) reasoningTokens = (reasoningTokens ?? 0) + result.usage.reasoning;
    stopReason = result.stopReason;
    if ((status === 400 || status === 422) && result.errorMessage) {
      // Inspect only for a known compatibility error; never return upstream text.
      developerRoleRejected = /unknown variant\s+[`'"]developer[`'"]/i.test(result.errorMessage)
        || /(?:unsupported|invalid)\s+(?:message\s+)?role\s*:?\s*[`'"]?developer\b/i.test(result.errorMessage)
        || /(?:role\s*:?\s*)?[`'"]?developer[`'"]?\s+(?:role\s+)?(?:is\s+)?not supported/i.test(result.errorMessage);
    }
    if (result.stopReason === "error" || result.stopReason === "aborted" || (status !== undefined && status >= 300)) throw new Error("probe failed");
    return result;
  };
  const user = (text: string): Context => ({ messages: [{ role: "user", content: text, timestamp: Date.now() }] });
  try {
    if (capability === "chat") {
      const result = await complete(user("Reply with the single word OK."));
      return textOf(result) ? report("supported", "chat_reply") : report("inconclusive", "no_text");
    }
    if (capability === "tools") {
      const nonce = randomBytes(8).toString("hex");
      const tool: Tool = { name: "provider_probe", description: "A harmless local capability check. Returns a receipt to repeat verbatim.",
        parameters: Type.Object({ nonce: Type.Literal(nonce) }, { additionalProperties: false }) };
      const context = user(`Call provider_probe once with nonce "${nonce}". After receiving its result, reply with only the receipt value.`);
      context.tools = [tool];
      const first = await complete(context);
      const calls = first.content.filter((c) => c.type === "toolCall");
      if (!calls.length) return report("inconclusive", "no_tool_call");
      if (first.stopReason !== "toolUse" || calls.length !== 1) return report("inconclusive", "invalid_tool_call");
      try { validateToolCall([tool], calls[0]); } catch { return report("inconclusive", "invalid_tool_call"); }
      const receipt = randomBytes(12).toString("hex");
      context.messages.push(first, { role: "toolResult", toolCallId: calls[0].id, toolName: tool.name,
        content: [{ type: "text", text: JSON.stringify({ receipt }) }], isError: false, timestamp: Date.now() });
      const second = await complete(context);
      return second.stopReason === "stop" && textOf(second) === receipt ? report("supported", "tool_roundtrip") : report("inconclusive", "tool_result_unconfirmed");
    }
    if (capability === "reasoning") {
      if (model.maxTokens < 2048) return report("inconclusive", "reasoning_budget");
      const result = await complete(user("Solve this carefully: a box has 17 red and 23 blue balls. How many must be drawn without looking to guarantee 3 of each color? Give a concise answer."));
      const observed = result.content.some((c) => c.type === "thinking" && (!!c.thinking.trim() || !!c.thinkingSignature || c.redacted));
      return observed || (result.usage.reasoning ?? 0) > 0 ? report("supported", "reasoning_observed") : report("inconclusive", "no_reasoning_evidence");
    }
    const challenge = visionChallenge();
    const result = await complete({ messages: [{ role: "user", timestamp: Date.now(), content: [
      { type: "text", text: 'Identify the four solid quadrant colors in the image: top-left, top-right, bottom-left, bottom-right. Reply only with a JSON array of four lowercase color names. Use red, green, blue, yellow, black or white.' },
      { type: "image", mimeType: "image/png", data: challenge.image },
    ] }] });
    let answer: unknown;
    try { answer = JSON.parse(textOf(result).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); } catch { /* inconclusive */ }
    return Array.isArray(answer) && answer.length === 4 && answer.every((c, i) => c === challenge.answer[i])
      ? report("supported", "vision_matched") : report("inconclusive", "vision_unconfirmed");
  } catch {
    // Fixed codes only: upstream text, thinking, tool arguments and errors stay private.
    const code = timeout.aborted ? (signal?.aborted ? "cancelled" : "timeout")
      : status === 401 || status === 403 ? "auth_failed"
      : status === 429 ? "rate_limited"
      : status && status >= 300 && status < 400 ? "redirect"
      : developerRoleRejected ? "developer_role_unsupported"
      : status && status >= 500 ? "gateway_error"
      : status && status >= 400 ? "request_rejected" : status ? "invalid_stream" : "connection_failed";
    return report("failed", code);
  }
}
