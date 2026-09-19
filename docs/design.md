# v0.1 design and reference map

Status: local prototype. Pi compatibility baseline: 0.85.1. Package name/scope and public repository have not been chosen. `private: true` prevents accidental publication while retaining local/git installation and tarball inspection.

## Official Pi sources (version pinned)

- [Custom models](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/models.md): providers, baseUrl, api, models, defaults, compat, model overrides, key references.
- [Authentication](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/providers.md): auth.json credential format, key resolution and precedence.
- [Extensions](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/extensions.md): registerCommand, modelRegistry.refresh, getAgentDir, deferred resources and session_shutdown.
- [SDK](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/sdk.md): ModelRuntime and configurable credentials.
- [Pi AI SDK](https://github.com/earendil-works/pi/blob/v0.85.1/packages/ai/README.md): tools, `validateToolCall`, tool results, image input and `completeSimple` reasoning options. Public types define thinking blocks and `usage.reasoning`.
- [Settings](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/settings.md): defaultProvider/defaultModel.
- [Packages](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/packages.md): pi manifest, pi-package keyword, npm/git installs and peer dependencies.

API discovery complements Pi's documentation with [OpenAI Models](https://developers.openai.com/api/reference/resources/models/methods/list), [Anthropic Models](https://platform.claude.com/docs/en/api/models/list), and [OpenRouter model metadata](https://openrouter.ai/docs/api/api-reference/models/get-models). Local catalog lookup uses public `getBuiltinProviders()` / `getBuiltinModels()` exports from `@earendil-works/pi-ai/providers/all`.

## One vertical workflow

`/custom-provider` opens a local browser panel. Enter a custom provider ID, base URL, API protocol and key. Preview request endpoints, test connectivity, fetch all advertised model pages, select models, save, then select via Pi `/model`. Per-model SDK probes check streaming text, a harmless two-turn tool call, reasoning evidence and a generated image. Progress and results are displayed inline below each model.

- APIs: openai-completions, openai-responses, anthropic-messages.
- Base URL is Pi-native: OpenAI normally ends in `/v1`; Anthropic normally has no trailing `/v1` because its SDK appends `/v1/messages`. A gateway prefix such as `/anthropic` is preserved. Do not rewrite arbitrary URL paths. Show the resulting URLs before requesting.
- Discovery is additive: refresh never automatically deletes a locally configured model. Show all IDs (including non-chat models) and allow manual IDs when listing is unavailable. Anthropic pagination follows last_id/has_more. Bounded pagination/timeouts explicitly report incomplete lists.
- Absent metadata stays absent in models.json. Label Pi fallback values (128000 context, 16384 output, text-only, reasoning false). Never infer capabilities from a model name.
- Context/output defaults: endpoint-declared positive integer limits first, then exact-ID catalog matches with consensus per field. Never normalize aliases or take the largest of conflicting catalog values. Label catalog values as references rather than verified gateway maxima. Explicit per-request caps constrain endpoint values. Metadata-only reads make no inference calls.
- Fill missing limits in the draft during provider load, discovery and manual-ID entry. Preserve saved/manual values; endpoint metadata may supersede an unsaved catalog default. Both numeric fields and their sources appear per model; hints/sources are not serialized into native configuration. Unknown fields remain absent. Explicit “Use detected limits” replaces a model's limits; “Fill missing limits” does not replace existing values.
- Capability probes use temporary model copies to enable reasoning/image transport without saving inferred settings. Only evidence earns “Verified”; absent evidence is inconclusive, and request errors are failures rather than unsupported declarations. Optional application updates only successful vision/reasoning flags in the draft. Pi has no tool-support model flag.
- A full probe run is sequential (up to five requests); each result is returned separately so the UI can show progress and cancel. Use 256 output tokens per request, 2048 for reasoning, 30s for chat and 60s for other probes. Never return raw model text/thinking/tool arguments. Tool calls are schema-validated and receive an in-memory receipt, never arbitrary execution.
- Every probe includes a synthetic system prompt to exercise Pi's system/developer serialization. Recognize explicit developer-role rejection in 400/422 SDK errors using fixed diagnostics; distinguish HTTP 5xx gateway errors. Do not silently retry or infer role rejection from a generic 422/502.
- The provider and model editors expose only `compat.supportsDeveloperRole` from compatibility metadata. False forces `system` for OpenAI APIs without disabling reasoning. Provider defaults cover existing and future models; model overrides take priority and are labelled in model rows. Undefined edits preserve saved overrides; an explicit null edit removes this one field and restores provider/Pi inheritance. Merge other compat fields and preserve comments; never return arbitrary compat/header data to the browser.
- Registry refresh alone does not replace Pi's active model object. After panel saves and on `session_start` with reason `reload`, refresh without network and use public `pi.setModel()` for changed active-model metadata. Defer selection while busy until `agent_settled`; avoid reselecting unchanged metadata.
- API keys go through the public ModelRuntime login/logout interface using its native authPath-backed credential store. This keeps key interpolation and locking in Pi itself. No imports of private AuthStorage internals. API-key replacement follows Pi's /login semantics; unrelated providers and OAuth entries are preserved.
- All configuration updates merge into the latest document under lock, check revisions, keep unknown fields/comments, and back up models.json. Conflicting external edits return a conflict instead of replacing the latest version. Native OAuth entries remain managed by Pi /login.
- Existing built-in provider overrides are displayed read-only in v0.1. Manage custom provider definitions here.

## Components

- `src/index.ts`: Pi command and lifecycle integration.
- `src/server.ts`: on-demand localhost HTTP service and browser-safe endpoints.
- `src/service.ts`: provider workflow and native runtime adapter.
- `src/storage.ts`: comment-preserving configuration and credential storage.
- `src/discovery.ts`: protocol URL previews and remote catalog discovery.
- `src/limits.ts`: endpoint token-limit parsing, duplicate reconciliation, exact-ID local catalog references.
- `src/probes.ts`: Pi-native capability probes, synthetic PNG generation and evidence-based results.
- `web/`: dependency-free browser UI; English and Indonesian.
- `test/`: isolated mock-server integration and browser workflow checks.

## Local transport

Bind to 127.0.0.1 on a random port. A session token in the URL fragment is exchanged for request headers, never sent upstream. Validate Host/Origin and do not enable cross-origin access. Do not return credential values or provider/model headers in browser state. Test/discovery requests use only the endpoint explicitly selected by the user; redirects do not forward keys to another location.

## Publication checklist

Choose an available npm scope/name and repository; add repository metadata and changelog; verify Windows and CI on Linux/macOS; run tests and inspect npm pack; remove private only for an intentional public release. Include the prebuilt web assets (this prototype needs no frontend build). Gallery indexing uses npm's pi-package keyword; listing timing is outside this project's control.
