# Pi Provider Manager

A small, local browser panel for configuring custom providers in [Pi](https://pi.dev). English and Indonesian UI. Built against the official **Pi 0.85.1** public extension and SDK APIs.

Published on npm as [`pi-custom-provider-model`](https://www.npmjs.com/package/pi-custom-provider-model). Development uses a local path install; tagged releases are published through GitHub Actions.

## What works

- Add, edit and remove custom providers using OpenAI Chat Completions, OpenAI Responses or Anthropic Messages.
- Enter a base URL and API key; preview the actual endpoint paths.
- Test the model-list endpoint; fetch all advertised pages with deduplication and explicit partial-result reporting.
- Select discovered models or add model IDs manually.
- Edit context window, output limit, input modalities and reasoning metadata.
- Fill context/output defaults from endpoint metadata or exact, unambiguous Pi catalog matches, with source labels and manual overrides.
- Run streaming chat, tool calling, reasoning and image-input checks through **Pi's SDK**, with results inline beneath each model.
- Save provider/model definitions to `models.json`, API keys through Pi's native `auth.json` handling, and startup defaults to `settings.json`.
- Preserve existing unknown settings/model overrides and JSON comments when editing; detect stale writes and retain the last 10 `models.json` backups.
- Show credential source without returning saved keys or headers to the browser.
- Optionally route images through an authenticated vision-capable fallback model while keeping the selected Pi model responsible for the main reasoning and tool loop.

## Install

Requires Node **22.19+** and Pi **0.85.1+**. Compatibility is currently tested with 0.85.1 on Windows/Edge.

For normal use:

```powershell
pi install npm:pi-custom-provider-model
```

To update later:

```powershell
pi update npm:pi-custom-provider-model
```

For a one-off local development run from this project directory:

```powershell
npm install --ignore-scripts
pi -e ./src/index.ts
```

Inside Pi:

```text
/custom-provider
```

A browser opens on a random loopback port. If it does not, copy the URL printed by Pi. The command can open before any model is authenticated.

```text
/custom-provider --no-browser
/custom-provider stop
```

For ongoing local use, run this in your terminal:

```powershell
pi install "C:\SERVER\pi-custom-provider"
```

Then `/reload` in Pi and use `/custom-provider`. Local installation references this folder in place. The panel stops when Pi exits, reloads, or switches sessions.

### Standalone development

```powershell
npm run dev
```

Open the printed URL. By default this uses **`.sandbox/agent`**, an isolated configuration directory. The backend prints which directory it is managing.

To manage your actual Pi configuration instead:

```powershell
npm run dev -- --real-config
```

Or select a directory explicitly:

```powershell
npm run dev -- --agent-dir "C:\path\to\agent"
```

The extension uses Pi's `getAgentDir()`, including `PI_CODING_AGENT_DIR`. It does not hardcode a Windows profile path.

## First provider

1. Click **Add provider** and choose a unique ID such as `my-gateway`.
2. Select the API protocol and enter the **Pi-native** base URL.
3. Enter an API key. The field is literal; leaving it empty on an existing provider preserves its credentials.
4. Click **Test connection**, then **Fetch models**.
5. Select the models you want to save, or use **Manual model** if listing is unavailable.
6. Use **Test chat** for a quick streaming check, or **Check capabilities** for chat, tools, reasoning and image input. Progress and results appear directly under that model; **Stop tests** cancels the remaining work.
7. Click **Save provider**, then select it in Pi's `/model` picker. **Set default** applies to future Pi launches.

### Vision fallback

Choose an authenticated image-capable model under **Vision fallback** and click **Save fallback**. When the active Pi model is text-only, the extension sends attached user images and images returned by tools to that fallback model for description. It then gives the description—not the image—to the active model, which remains selected and performs the main reasoning and tool loop.

Fallback is bypassed when the active model already declares image input. If fallback analysis fails, a direct image prompt is stopped rather than silently dropping the image; a tool image is replaced with an explicit failure note. The fallback makes an additional model request and may incur provider usage/cost. Configuration is stored separately in `<agentDir>/pi-custom-provider.json`; native `models.json`, `auth.json`, and `settings.json` formats are not extended.

### Base URL examples

| Protocol | Base URL | Model list | Chat |
| --- | --- | --- | --- |
| OpenAI Chat | `https://gateway.example/v1` | `/v1/models` | `/v1/chat/completions` |
| OpenAI Responses | `https://gateway.example/v1` | `/v1/models` | `/v1/responses` |
| Anthropic Messages | `https://api.anthropic.com` | `/v1/models` | `/v1/messages` |
| Anthropic gateway | `https://gateway.example/anthropic` | `/anthropic/v1/models` | `/anthropic/v1/messages` |

Pi's Anthropic SDK appends `/v1/messages` itself. For a gateway advertising `/anthropic/v1/messages`, enter a base URL ending in `/anthropic`. Path prefixes are never silently stripped. SDK-added query parameters can appear in actual test results.

**Test connection is not a chat test.** A provider can expose `/models` without authorizing inference, or support chat without supporting `/models`. API protocol selection does not restrict the model's brand: a gateway may serve Claude through OpenAI-compatible transport.

Unknown model metadata remains absent from the saved JSON. The UI labels Pi defaults (128000 context, 16384 output, text-only, reasoning off). A model ID alone does not verify capabilities. Fetch adds new IDs and fills missing context/output values without deleting models or overwriting saved/manual settings. Unchecking a saved model and saving explicitly removes it.

### Automatic context and output defaults

The panel fills known limits into the draft instead of using the same generic numbers for every model:

1. **Endpoint metadata** takes priority. Anthropic uses `max_input_tokens` and `max_tokens`. OpenAI-compatible lists may supply `context_length`, `context_window` / `contextWindow`, `max_output_tokens`, `max_completion_tokens` / `maxTokens`, or OpenRouter-style `top_provider` limits. Explicit `per_request_limits` also constrain the values. When several applicable bounds are supplied, the smallest positive integer is used.
2. **Pi catalog reference** fills missing fields using the installed Pi SDK's bundled catalog through its public exports. The ID must match exactly, and all matching catalog entries must agree on that field. There are no fuzzy aliases, guessed model-family limits, or background network catalog requests. This is the catalog's configured limit, which may differ from a model's theoretical maximum or your gateway's limit.
3. **Maximum unknown** remains on Pi's fallback (128000 context / 16384 output). Conflicting catalog entries are labelled explicitly. Standard OpenAI `/models` returns IDs/ownership, not token limits; generic `max_tokens` alone is ambiguous and is not interpreted as an output maximum.

Use **Fetch models** to obtain endpoint metadata and fill existing empty values as well as new models. Existing saved values and manual edits win. Endpoint metadata can replace an unsaved catalog default. Opening an existing provider also fills empty fields from the local catalog into its draft. **Fill missing limits** fills known empty fields across the current provider; **Use detected limits** in a model's editor explicitly replaces that model's context/output values with the available metadata. Manual model entry looks up the exact ID in the local catalog without consuming API tokens.

Both context and maximum output are visible in each model row. Source labels distinguish endpoint, catalog, saved/custom and manual values. Metadata hints are browser/session information only: **Save provider** persists just the numeric native `contextWindow` / `maxTokens` fields. Reading metadata does not save configuration or verify the maximum through inference. Changing the connection clears endpoint hints and unsaved endpoint defaults; saved/manual values are kept. Model-specific endpoint/API overrides do not inherit metadata from a different provider endpoint.

The maximum output is a ceiling, not a requested answer length. A request may have a lower effective ceiling due to remaining context, provider routing, account limits, or Pi's request settings. Capability probes retain their small test budgets regardless of the configured maximum.

### Per-model capability checks

| Check | Evidence required for “Verified” |
| --- | --- |
| Chat / streaming | Pi parses a streaming text response. |
| Tool calling | Pi receives one schema-valid `provider_probe` call, supplies a generated receipt as its tool result, and the model repeats that receipt in a second turn. |
| Reasoning | With reasoning requested, Pi receives a thinking block (including opaque/redacted thinking) or positive reasoning-token usage. A normal text answer alone is insufficient. |
| Image input | The model correctly identifies the four quadrant colors in a fresh, locally generated PNG. Accepting an image parameter alone is insufficient. |

Checks send only short synthetic prompts, including a system prompt serialized by Pi, the harmless test-tool schema/result and a generated image. They do not use project files, session history or executable tools. A full run makes up to **5 requests**, sequentially. Each request asks for at most **256 output tokens**, except reasoning which uses a **2,048-token ceiling** and a 1,024-token thinking budget where supported. Existing Pi compatibility settings still apply; gateways may ignore token caps. Chat times out after 30 seconds; each other check after 60 seconds, including both tool turns. Retries are disabled.

**Unconfirmed** means the expected evidence was absent; **Test failed** means a request/transport error. Neither proves that the model lacks the capability. Gateways may hide reasoning, need different compatibility parameters, or require larger budgets. Checks validate this endpoint/configuration on a small sample, not every possible workload. Context-window limits, structured output, audio and combined reasoning-plus-tool behavior are not tested.

The panel shows HTTP status, duration, request count, token usage and endpoint for each check, without exposing raw answers, thinking, arguments or upstream errors. Results remain in browser memory during editing/saving and are cleared when the connection or model settings change, when switching/reloading providers, or when reloading the page.

**Apply verified capabilities** enables only successfully verified vision/reasoning in the draft. Click **Save provider** to persist those settings. Tests alone never alter model metadata, and failed checks never disable existing settings. Pi has no model-level tool-support switch; the tool result remains diagnostic information rather than an invented `models.json` field.

### Gateway rejects the `developer` role (HTTP 400/422)

Pi may serialize the system prompt as a `developer` message for reasoning-capable OpenAI models. Some gateways accept only `system`, `user`, `assistant` and `tool`. Chat working in another client does not guarantee identical Pi request compatibility.

1. In **Connection**, set **Default system prompt role — this provider** to **system — compatible gateways**.
2. Run **Test chat** / **Check capabilities**, then **Save provider**.
3. If upgrading the extension, run `/reload` in Pi and reopen `/custom-provider` to load the new controls.

This saves `"compat": { "supportsDeveloperRole": false }` on the provider, covering existing and newly added models that inherit its settings. Model rows show whether a role comes from the provider default or an individual override. You do not need to edit every model.

For an individual exception, click **Edit** on the model and set **System prompt role (OpenAI)**. Model overrides take priority over the provider default. **Follow Pi / provider settings** removes only that model's role override and restores inheritance. **Pi automatic detection** removes the provider's role override. These controls keep reasoning and other compatibility settings intact and apply to OpenAI Chat Completions and Responses; Anthropic has its own system-prompt format.

Saving through the extension refreshes the registry and reselects the current model with its updated configuration when Pi is idle. If an agent run is active, synchronization waits until it settles. `/reload` also refreshes the active model, so a previously cached model object does not retain the old role setting. In standalone mode, reopen `/model` in Pi and select the saved provider/model after saving.

All probes include a synthetic system prompt so they exercise Pi's role serialization. Recognized developer-role rejections show a specific repair hint without displaying the raw upstream error. HTTP 5xx (including 502 Bad Gateway) remains a separate gateway/upstream failure, not evidence of this particular role mismatch. Role rejections and 5xx stop the remaining capability checks; retry explicitly after adjusting the configuration or waiting.

## Configuration and credentials

The panel binds to `127.0.0.1`. It uses a per-launch token, same-origin requests and no external frontend assets. Entered keys are sent to the local backend and the selected upstream; existing saved keys are never returned to the browser. Test errors do not echo raw upstream bodies.

Provider-scoped API keys use Pi's public `ModelRuntime.login()` / `logout()` and native credential store. Native API-key precedence and existing environment-variable references are respected. OAuth is managed by Pi's `/login` and `/logout`. Providers defined only by other extensions and built-in provider overrides are outside the v0.1 editor.

Replacing a credential with provider-scoped `env` settings is currently refused to avoid losing that advanced state through Pi's login replacement behavior. Use Pi's native auth configuration for those entries. Deleting a provider retains its key; remove the key first if desired. Removing an `auth.json` key does not remove a fallback key from `models.json` or the environment.

Vision fallback selection lives in `<agentDir>/pi-custom-provider.json`. The file contains only provider/model IDs, never credentials.

Backups live in `<agentDir>/provider-manager-backups/`. To restore, stop the panel and copy the desired backup over `models.json`, then reopen `/model`. Backups can contain pre-existing secrets from models.json and are created with owner-only permissions where supported. Only `models.json` is backed up; authentication and defaults use Pi's own writers. A partial save reports which operation needs attention.

## Development and verification

```powershell
npm run verify
npm run pack:check
```

- TypeScript type checking.
- Mock HTTP tests for three protocols, pagination, credentials, preservation of config and stale-write handling.
- Test through Pi's official extension loader, including asset resolution and shutdown.
- Playwright browser workflow (installed Microsoft Edge on Windows; run `npx playwright install chromium` first on other platforms).
- Screenshots are produced under `test-results/` and excluded from the npm package.

Tests use isolated temporary directories and mock endpoints. Real gateway compatibility and RAM footprint have not been benchmarked yet.

See [`docs/design.md`](docs/design.md) for the version-pinned official documentation and release design. Tagged releases are published to npm as `pi-custom-provider-model` through GitHub Actions.

## License

MIT. Independent community project; not an official Pi product.
