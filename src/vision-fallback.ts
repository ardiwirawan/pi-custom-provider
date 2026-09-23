import { join } from "node:path";
import type { AssistantMessage, ImageContent, Model, TextContent, Usage } from "@earendil-works/pi-ai";
import type { ExtensionContext, InputEventResult } from "@earendil-works/pi-coding-agent";
import { parseDocument, readText } from "./storage.ts";

export interface VisionFallbackConfig { provider: string; model: string }

const SYSTEM_PROMPT = `You are a visual inspection component for a coding agent. Describe every supplied image accurately and concretely. Preserve visible text, errors, labels, UI layout, charts, code, file contents, spatial relationships, and details relevant to the user's request. Do not solve the broader task or claim actions. Return only a concise but sufficiently detailed description.`;

export async function readVisionFallback(dir: string): Promise<VisionFallbackConfig | undefined> {
  const data = parseDocument(await readText(join(dir, "pi-custom-provider.json")));
  const value = data.visionFallback;
  if (!value || typeof value.provider !== "string" || typeof value.model !== "string") return;
  if (!value.provider.trim() || !value.model.trim()) return;
  return { provider: value.provider, model: value.model };
}

function textOf(message: AssistantMessage): string {
  return message.content.filter((block): block is TextContent => block.type === "text").map((block) => block.text).join("\n").trim();
}

function sumUsage(items: Usage[]): Usage {
  const total: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  for (const usage of items) {
    total.input += usage.input; total.output += usage.output; total.cacheRead += usage.cacheRead; total.cacheWrite += usage.cacheWrite;
    total.totalTokens += usage.totalTokens; total.cost.input += usage.cost.input; total.cost.output += usage.cost.output;
    total.cost.cacheRead += usage.cost.cacheRead; total.cost.cacheWrite += usage.cost.cacheWrite; total.cost.total += usage.cost.total;
    if (usage.reasoning !== undefined) total.reasoning = (total.reasoning ?? 0) + usage.reasoning;
    if (usage.cacheWrite1h !== undefined) total.cacheWrite1h = (total.cacheWrite1h ?? 0) + usage.cacheWrite1h;
  }
  return total;
}

function assertFallbackModel(ctx: ExtensionContext, config: VisionFallbackConfig): Model<any> {
  const model = ctx.modelRegistry.find(config.provider, config.model);
  if (!model) throw new Error(`Vision fallback model ${config.provider}/${config.model} is unavailable.`);
  if (!model.input.includes("image")) throw new Error(`Vision fallback model ${config.provider}/${config.model} is not configured for image input.`);
  return model;
}

async function describeImages(ctx: ExtensionContext, config: VisionFallbackConfig, images: ImageContent[], request: string, signal?: AbortSignal) {
  const model = assertFallbackModel(ctx, config);
  const timeout = AbortSignal.any([AbortSignal.timeout(60000), ...(signal ? [signal] : [])]);
  const response = await ctx.modelRegistry.complete(model, { systemPrompt: SYSTEM_PROMPT, messages: [{ role: "user", timestamp: Date.now(), content: [
    { type: "text", text: `User request/context: ${request || "No additional text."}\nDescribe the attached image(s) for another model that cannot see them. Distinguish multiple images by order.` },
    ...images,
  ] }] }, { signal: timeout, maxTokens: Math.min(model.maxTokens, 2048), cacheRetention: "none", maxRetries: 0, timeoutMs: 60000 });
  if (response.stopReason === "error" || response.stopReason === "aborted") throw new Error("The fallback vision model could not analyze the image.");
  const description = textOf(response);
  if (!description) throw new Error("The fallback vision model returned no image description.");
  return { description, usage: response.usage, model: `${model.provider}/${model.id}` };
}

export async function transformUserImages(dir: string, event: { text: string; images?: ImageContent[] }, ctx: ExtensionContext): Promise<InputEventResult | void> {
  if (!event.images?.length || !ctx.model || ctx.model.input.includes("image")) return;
  const config = await readVisionFallback(dir);
  if (!config) return;
  try {
    ctx.ui.setWorkingMessage(`Analyzing image with ${config.provider}/${config.model}…`);
    const result = await describeImages(ctx, config, event.images, event.text, ctx.signal);
    ctx.ui.notify(`Image analyzed with ${result.model}; continuing with ${ctx.model.provider}/${ctx.model.id}.`, "info");
    return { action: "transform", text: `${event.text}\n\n[Vision fallback analysis from ${result.model}]\n${result.description}`, images: [] };
  } catch (error) {
    ctx.ui.notify(`${error instanceof Error ? error.message : "Vision fallback failed."} The prompt was stopped so the image is not silently omitted.`, "error");
    return { action: "handled" };
  } finally { ctx.ui.setWorkingMessage(); }
}

export async function transformToolImages(dir: string, event: { content: (TextContent | ImageContent)[]; usage?: Usage }, ctx: ExtensionContext): Promise<{ content?: (TextContent | ImageContent)[]; usage?: Usage } | void> {
  const images = event.content.filter((block): block is ImageContent => block.type === "image");
  if (!images.length || !ctx.model || ctx.model.input.includes("image")) return;
  const config = await readVisionFallback(dir);
  if (!config) return;
  const originalText = event.content.filter((block): block is TextContent => block.type === "text").map((block) => block.text).join("\n");
  try {
    const result = await describeImages(ctx, config, images, originalText || "Image returned by a tool.", ctx.signal);
    return { content: [
      ...event.content.filter((block): block is TextContent => block.type === "text"),
      { type: "text", text: `[Vision fallback analysis from ${result.model}]\n${result.description}` },
    ], usage: sumUsage([...(event.usage ? [event.usage] : []), result.usage]) };
  } catch (error) {
    return { content: [
      ...event.content.filter((block): block is TextContent => block.type === "text"),
      { type: "text", text: `[Vision fallback failed: ${error instanceof Error ? error.message : "unknown error"}]` },
    ] };
  }
}
