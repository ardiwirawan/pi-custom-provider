# Pi Custom Provider

- Target the official Pi 0.85.1 public extension/SDK APIs. See `docs/design.md` for authoritative references. Never import private package internals.
- Use Pi's native models.json, auth.json and settings.json; respect getAgentDir()/PI_CODING_AGENT_DIR. Keep existing unknown fields, comments, credentials and model-specific overrides when editing.
- Provider discovery is not proof of chat, vision, reasoning or tool-call support. Use actual Pi SDK streaming for the chat probe. Follow Anthropic pagination; report incomplete discovery rather than claiming completeness.
- Token-limit defaults use endpoint metadata before exact-ID, per-field consensus from the public bundled Pi catalog. Do not guess aliases or call inference to find maxima. Preserve saved/manual values, label reference sources, and persist only native numeric limits after Save; missing/conflicting metadata stays unknown.
- Capability results belong inline with their model. Verify tools through a schema-valid call/result round-trip, vision through image contents, and reasoning through Pi thinking blocks or reported reasoning tokens. Missing evidence is inconclusive; tests must not silently rewrite metadata or invent a Pi tool-support flag.
- All probes include a synthetic system prompt so Pi's system/developer-role compatibility is exercised. `compat.supportsDeveloperRole: false` fixes gateways that reject developer messages without disabling reasoning; preserve other compat fields and keep generic 422/5xx failures distinct from an explicit role rejection.
- Role compatibility can be set once per provider; explicit model overrides take priority. Registry refresh does not refresh Pi's active model object: use public `pi.setModel()` for changed metadata after saves/reload, deferring until `agent_settled` while busy.
- Tests use temporary agent directories and mock HTTP endpoints. Never test against the developer's actual auth.json or keys.
- Start the loopback panel only on demand and close it on session_shutdown. Browser responses/logs must not contain saved keys or headers. Keep endpoint path handling identical to the native SDK.
- The user-facing Pi command is `/custom-provider`. Browser text must be at least 1rem (16px at default zoom), including helper text, badges, table actions and mobile layouts; use spacing and weight for hierarchy instead of small text.
- Run npm run verify and npm run pack:check. Publish only when explicitly requested; the npm scope and repository URL are still undecided.
