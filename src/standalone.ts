import { resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { startManager } from "./server.ts";

const argument = process.argv.indexOf("--agent-dir");
if (argument >= 0 && !process.argv[argument + 1]) throw new Error("--agent-dir needs a directory.");
// Development mode defaults to an isolated sandbox. --real-config is explicit.
const dir = argument >= 0 ? resolve(process.argv[argument + 1])
  : process.argv.includes("--real-config") ? getAgentDir() : resolve(".sandbox", "agent");
const manager = await startManager(dir);
console.log(`Pi Provider Manager\nConfig: ${dir}\nOpen: ${manager.url}\nCtrl+C to stop.`);
const keepAlive = setInterval(() => {}, 60000);
const stop = async () => { clearInterval(keepAlive); await manager.close(); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
