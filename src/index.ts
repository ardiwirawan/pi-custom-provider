import { spawn } from "node:child_process";
import { getAgentDir, VERSION, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { startManager } from "./server.ts";

function openBrowser(url: string) {
  const [program, args] = process.platform === "win32"
    ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
    : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  const child = spawn(program, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => {});
  child.unref();
}

export default function (pi: ExtensionAPI) {
  let manager: Awaited<ReturnType<typeof startManager>> | undefined;
  let starting: Promise<Awaited<ReturnType<typeof startManager>>> | undefined;
  let pendingModelSync = false;
  const syncActiveModel = async (ctx: ExtensionContext) => {
    if (!pendingModelSync || !ctx.isIdle()) return;
    const current = ctx.model;
    const fresh = current && ctx.modelRegistry.find(current.provider, current.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(current) && !await pi.setModel(fresh)) {
      throw new Error("Reselect the saved model using Pi /model.");
    }
    pendingModelSync = false;
  };
  const refreshModels = async (ctx: ExtensionContext) => {
    await ctx.modelRegistry.refresh({ allowNetwork: false });
    pendingModelSync = true;
    await syncActiveModel(ctx);
  };
  pi.on("session_start", async (event, ctx) => {
    if (event.reason === "reload") await refreshModels(ctx);
  });
  pi.on("agent_settled", async (_event, ctx) => {
    if (pendingModelSync) await syncActiveModel(ctx);
  });
  pi.registerCommand("custom-provider", {
    description: "Manage custom providers, API keys and models in a local browser",
    handler: async (args, ctx) => {
      if (args.trim() === "stop") {
        if (starting) await starting;
        await manager?.close(); manager = undefined;
        ctx.ui.notify("Provider manager stopped.", "info"); return;
      }
      const [major, minor, patch] = VERSION.split(".").map(Number);
      if (major === 0 && (minor < 85 || (minor === 85 && patch < 1))) {
        ctx.ui.notify("Pi Custom Provider requires Pi 0.85.1 or later.", "error"); return;
      }
      if (!manager) {
        starting ??= startManager(getAgentDir(), () => refreshModels(ctx));
        try { manager = await starting; } finally { starting = undefined; }
      }
      ctx.ui.notify(`Provider manager: ${manager.url}`, "info");
      if (!args.includes("--no-browser")) openBrowser(manager.url);
    },
  });
  pi.on("session_shutdown", async () => {
    pendingModelSync = false;
    if (starting) await starting.catch(() => {});
    await manager?.close(); manager = undefined;
  });
}
