const $ = (id) => document.getElementById(id);
const translations = {
  id: {
    local:"Workspace lokal",providers:"Provider",addProvider:"+ Tambah provider",configuration:"KONFIGURASI",docs:"Dokumentasi resmi Pi ↗",connections:"KONEKSI",subtitle:"Endpoint dan model pilihanmu. Konfigurasi asli Pi.",refresh:"Muat ulang konfigurasi",visionFallback:"Fallback vision",globalSetting:"Pengaturan global",visionFallbackHelp:"Ketika model Pi yang aktif tidak dapat menerima gambar, model ini akan mendeskripsikan gambar dari pengguna dan tool terlebih dahulu. Model aktif tetap dipilih dan melakukan reasoning utama.",visionFallbackModel:"Model vision fallback",visionFallbackOff:"Nonaktif",visionFallbackCredentialHelp:"Hanya model dengan dukungan gambar dan kredensial yang terkonfigurasi yang ditampilkan.",saveVisionFallback:"Simpan fallback",visionFallbackSaved:"Pengaturan vision fallback tersimpan.",connection:"Koneksi",native:"Format Pi",readonly:"Provider ini dikelola Pi atau integrasi lain. Buat provider custom untuk mengedit di sini.",defaultProviderBadge:"Default Pi",defaultProviderNote:"Provider ini adalah default Pi dan belum dapat dihapus. Untuk menghapusnya, buka provider lain lalu pilih ‘Jadikan default’ pada salah satu modelnya.",defaultActionHelp:"‘Jadikan default’ pada Aksi model menetapkan model dan provider tersebut sebagai default Pi untuk pembukaan berikutnya.",providerId:"ID provider",idHelp:"Nama unik di Pi, misalnya my-gateway.",protocol:"Protokol API",protocolHelp:"Pilih protokol yang didukung endpoint.",requestPreview:"PREVIEW REQUEST",credentialSource:"SUMBER KREDENSIAL",removeKey:"Hapus key tersimpan",bearer:"Tambahkan header Authorization: Bearer secara eksplisit (Pi authHeader)",advanced:"Field lanjutan dan header custom yang sudah ada dipertahankan. Override per model dapat mengubah request efektif.",testConnection:"Tes koneksi",fetchModels:"Tarik model ↗",testHint:"Memeriksa daftar model. Tanpa request generasi.",models:"Model",addModel:"+ Model manual",modelHint:"Pilih model untuk disimpan. ID yang terdaftar belum menjamin dukungan chat, vision, atau tools.",selectAll:"Pilih yang terlihat",modelId:"ID model",context:"Konteks",input:"Input",actions:"Aksi",noModels:"Hubungkan model pertamamu",noModelsHint:"Tarik model dari endpoint atau tambahkan ID secara manual.",saveHelp:"Model → models.json · Key → auth.json",deleteProvider:"Hapus provider",save:"Simpan provider",footnote:"Konfigurasi disimpan lokal. Buka /model di Pi untuk memilih model. Default berlaku saat Pi dibuka kembali.",editModel:"Pengaturan model",displayName:"Nama tampilan (opsional)",maxOutput:"Maksimal token output",vision:"Input gambar",reasoning:"Dukungan reasoning",defaultText:"Default Pi (teks)",defaultOff:"Default Pi (nonaktif)",textOnly:"Teks saja",textImage:"Teks + gambar",off:"Nonaktif",on:"Aktif",metadataHelp:"Biarkan nilai yang belum diketahui memakai default Pi. Mengaktifkan opsi tidak menambahkan kemampuan pada model upstream.",applyModel:"Terapkan pengaturan",newProvider:"Provider baru",selected:"dipilih",edit:"Edit",test:"Tes",setDefault:"Jadikan default",default:"Default",remove:"Hapus",unsaved:"Ada perubahan yang belum disimpan. Lanjutkan?",keyHelp:"Kosongkan untuk mempertahankan key. Key baru disimpan di auth.json.",openaiHelp:"URL asli Pi. Biasanya diakhiri /v1; SDK menambahkan /chat/completions atau /responses.",anthropicHelp:"URL asli Pi. Biasanya tanpa /v1 di akhir; SDK menambahkan /v1/messages. Prefix gateway seperti /anthropic tetap dipakai.",busy:"Sedang memproses…",saved:"Provider tersimpan. Buka /model di Pi untuk memilihnya.",confirmDelete:"Hapus konfigurasi provider ini? Kredensialnya tetap tersimpan.",confirmKey:"Hapus key provider dari auth.json? Sumber key lain tetap dapat dipakai Pi.",confirmTest:"Kirim prompt singkat ke model ini? Tes memakai token, tanpa mengirim file atau percakapan proyek.",defaultSaved:"Default tersimpan untuk sesi Pi berikutnya.",fetchDone:"Daftar model diterima",allFetched:"Semua halaman yang dilaporkan endpoint telah diambil.",removeModel:"Hapus model ini dari pilihan? Perubahan berlaku setelah disimpan.",missingToken:"Buka manager dari link yang ditampilkan Pi.",search:"Cari ID model…",noProviders:"Belum ada provider custom.",saveFirst:"Simpan provider dahulu.",duplicate:"ID model sudah ada.",fallback:"default Pi",keyRemoved:"Key di auth.json dihapus.",working:"Bekerja",connectionOk:"Endpoint daftar model merespons.",refreshDone:"Konfigurasi dimuat ulang.",defaultHelp:"Berlaku saat Pi dibuka kembali.",partial:"Sebagian hasil",matches:"terlihat",
  },
  en: {
    visionFallback:"Vision fallback",globalSetting:"Global setting",visionFallbackHelp:"When the active Pi model cannot accept images, this model describes user and tool images first. The active model remains selected and performs the main reasoning.",visionFallbackModel:"Fallback vision model",visionFallbackOff:"Disabled",visionFallbackCredentialHelp:"Only image-capable models with configured credentials are listed.",saveVisionFallback:"Save fallback",visionFallbackSaved:"Vision fallback setting saved.",newProvider:"New provider",selected:"selected",edit:"Edit",test:"Test",setDefault:"Set default",default:"Default",defaultProviderBadge:"Pi default",defaultProviderNote:"This provider is Pi's default and cannot be deleted yet. To delete it, open another provider and choose ‘Set default’ on one of its models.",defaultActionHelp:"‘Set default’ in a model's Actions makes that model and provider Pi's default for new launches.",remove:"Remove",unsaved:"You have unsaved changes. Continue?",keyHelp:"Leave blank to keep the current key. New keys are stored in auth.json.",openaiHelp:"Pi-native URL. Usually ends in /v1; the SDK appends /chat/completions or /responses.",anthropicHelp:"Pi-native URL. Usually no trailing /v1; the SDK appends /v1/messages. Gateway prefixes such as /anthropic are preserved.",busy:"Working…",saved:"Provider saved. Open /model in Pi to select it.",confirmDelete:"Delete this provider configuration? Its credentials will be kept.",confirmKey:"Remove this provider's key from auth.json? Pi may still use other configured key sources.",confirmTest:"Send a short prompt to this model? This uses tokens, but sends no project files or chat history.",defaultSaved:"Default saved for new Pi launches.",fetchDone:"Model list received",allFetched:"All pages reported by the endpoint have been fetched.",removeModel:"Remove this model from the selection? Changes take effect after saving.",missingToken:"Open the manager using the link printed by Pi.",search:"Search model IDs…",noProviders:"No custom providers yet.",saveFirst:"Save the provider first.",duplicate:"This model ID already exists.",fallback:"Pi default",keyRemoved:"Saved key removed from auth.json.",working:"Working",connectionOk:"Model-list endpoint responded.",refreshDone:"Configuration reloaded.",defaultHelp:"Applies to new Pi launches.",partial:"Partial results",matches:"visible",
  },
};
const original = new Map([...document.querySelectorAll("[data-i18n]")].map((el) => [el, el.textContent]));
Object.assign(translations.en, {
  testChat: "Test chat", checkCapabilities: "Check capabilities", testResults: "Model test results", hideResults: "Hide results", showResults: "Show results",
  chat: "Chat / streaming", tools: "Tool calling", reasoning: "Reasoning", vision: "Image input",
  supported: "Verified", inconclusive: "Unconfirmed", failed: "Test failed", untested: "Not tested", queued: "Queued", running: "Testing…",
  stopTests: "Stop tests", testsFinished: "Tests finished", testsStopped: "Tests stopped", testingModel: "Testing model",
  probeScope: "Results apply to this endpoint and configuration. Unconfirmed or failed tests do not prove a capability is unsupported.",
  applyVerified: "Apply verified capabilities", verifiedApplied: "Verified vision/reasoning added to the draft. Save provider to keep these settings.",
  requests: "request(s)", tokenUsage: "tokens in / out",
  chat_reply: "Pi received a streaming text reply.", no_text: "No text within the 256-token budget. This model may require more reasoning tokens.",
  tool_roundtrip: "A valid tool call was received and the model correctly read its result in a second turn.",
  no_tool_call: "The model replied without calling the test tool. Tool support is not confirmed.",
  invalid_tool_call: "The returned tool call did not match the required name, arguments or completion state.",
  tool_result_unconfirmed: "A valid tool call was received, but the follow-up did not confirm its result.",
  reasoning_observed: "Pi received a thinking block or reported reasoning-token usage.",
  no_reasoning_evidence: "Reasoning was requested, but no thinking block or reasoning tokens were reported. The gateway may hide or ignore them.",
  reasoning_budget: "The configured output limit is below the 2,048 tokens required for this reasoning check.",
  vision_matched: "The model correctly identified all four colors in a generated test image.",
  vision_unconfirmed: "An image was sent, but the answer did not match the visual challenge. Image support is not confirmed.",
  auth_failed: "The endpoint refused access. Check the API key and model permissions.", rate_limited: "The endpoint rate-limited the request. Retry later.",
  redirect: "The endpoint redirected the request. Check its base URL.", request_rejected: "The endpoint rejected this request. Check model access, capability parameters and Pi compatibility settings.",
  invalid_stream: "Pi could not parse a completed streaming reply.", connection_failed: "Could not connect to the model endpoint.",
  timeout: "The test reached its time limit. Support is not determined.", cancelled: "Test stopped.",
  developer_role_unsupported: "The gateway rejects Pi's developer role. Edit this model, choose system under System prompt role, then test again and save the provider.",
  gateway_error: "The gateway or upstream server returned an HTTP 5xx error. Retry later; this does not establish model support or identify the failing parameter.",
  fixSystemRole: "Edit system prompt role",
  systemRole: "System prompt role (OpenAI)", roleAuto: "Follow Pi / provider settings", roleSystem: "system — compatible gateways", roleDeveloper: "developer — when reasoning is enabled",
  roleHelp: "For gateways that reject the developer role with HTTP 400/422, choose system. Saved as compat.supportsDeveloperRole; reasoning remains enabled.",
  providerSystemRole: "Default system prompt role — this provider", providerRoleAuto: "Pi automatic detection",
  providerRoleHelp: "For OpenAI-compatible APIs. Applies to existing and newly added models that follow the provider setting. Model-specific overrides take priority.",
  inheritedRole: "Provider default", modelRoleOverride: "Model override",
  fillLimits: "Fill missing limits", useLimits: "Use detected limits", tokenLimits: "Token limits",
  limitsHelp: "Context/output defaults come from endpoint metadata, then exact, unambiguous matches in Pi's bundled catalog. Gateway limits can differ. Existing values are kept; save the provider to persist filled defaults.",
  limitEndpoint: "Endpoint metadata", limitCatalog: "Pi catalog reference", limitConfigured: "Saved / custom value", limitManual: "Manual value",
  limitUnknown: "Maximum unknown · Pi fallback", limitAmbiguous: "Catalog values disagree; maximum unknown", limitSuggestion: "Detected value",
  limitsFilled: "Missing known limits filled in the draft. Existing values kept. Save provider to apply.",
  limitsUnchanged: "No missing known limits to fill. Fetch models for endpoint metadata; unknown maxima stay at Pi defaults.",
  limitsLookup: "Looking up Pi catalog…", limitsLookupFailed: "Catalog lookup failed. You can enter limits manually.",
  limitsCaveat: "Metadata reference, not a measured maximum. Output may also be limited by remaining context and your gateway/account.",
});
Object.assign(translations.id, {
  probeHelp: "Tes chat mengirim satu request singkat. Cek kemampuan menguji chat, tool dua giliran, reasoning, dan gambar buatan (maksimal 5 request). Memakai token API: maksimal 256 token output per request, 2.048 untuk reasoning. Hasil tampil di bawah masing-masing model.",
  testChat: "Tes chat", checkCapabilities: "Cek kemampuan", testResults: "Hasil tes model", hideResults: "Tutup hasil", showResults: "Lihat hasil",
  chat: "Chat / streaming", tools: "Tool calling", reasoning: "Reasoning", vision: "Input gambar",
  supported: "Terverifikasi", inconclusive: "Belum terkonfirmasi", failed: "Tes gagal", untested: "Belum diuji", queued: "Menunggu", running: "Menguji…",
  stopTests: "Hentikan tes", testsFinished: "Tes selesai", testsStopped: "Tes dihentikan", testingModel: "Menguji model",
  probeScope: "Hasil berlaku untuk endpoint dan konfigurasi ini. Tes gagal atau belum terkonfirmasi bukan bukti bahwa kemampuan tidak didukung.",
  applyVerified: "Terapkan kemampuan terverifikasi", verifiedApplied: "Vision/reasoning terverifikasi ditambahkan ke draft. Simpan provider untuk menyimpan pengaturan ini.",
  requests: "request", tokenUsage: "token masuk / keluar",
  chat_reply: "Pi menerima balasan teks streaming.", no_text: "Tidak ada teks dalam batas 256 token. Model mungkin memerlukan token reasoning lebih banyak.",
  tool_roundtrip: "Tool call valid diterima dan model membaca hasil tool dengan benar pada giliran kedua.",
  no_tool_call: "Model membalas tanpa memanggil tool uji. Dukungan tool belum terkonfirmasi.",
  invalid_tool_call: "Tool call tidak sesuai nama, argumen, atau status penyelesaian yang diminta.",
  tool_result_unconfirmed: "Tool call valid diterima, tetapi balasan berikutnya belum mengonfirmasi hasilnya.",
  reasoning_observed: "Pi menerima blok thinking atau laporan penggunaan token reasoning.",
  no_reasoning_evidence: "Reasoning diminta, tetapi tidak ada blok thinking atau token reasoning yang dilaporkan. Gateway mungkin menyembunyikan atau mengabaikannya.",
  reasoning_budget: "Batas output model kurang dari 2.048 token yang diperlukan untuk pemeriksaan reasoning ini.",
  vision_matched: "Model mengenali keempat warna dalam gambar uji yang dibuat secara lokal dengan benar.",
  vision_unconfirmed: "Gambar telah dikirim, tetapi jawaban tidak sesuai gambar uji. Dukungan gambar belum terkonfirmasi.",
  auth_failed: "Endpoint menolak akses. Periksa API key dan izin model.", rate_limited: "Endpoint membatasi request. Coba lagi nanti.",
  redirect: "Endpoint mengalihkan request. Periksa base URL.", request_rejected: "Endpoint menolak request. Periksa akses model, parameter kemampuan, dan pengaturan kompatibilitas Pi.",
  invalid_stream: "Pi tidak dapat membaca balasan streaming yang selesai.", connection_failed: "Tidak dapat terhubung ke endpoint model.",
  timeout: "Waktu tes habis. Dukungan belum dapat ditentukan.", cancelled: "Tes dihentikan.",
  developer_role_unsupported: "Gateway menolak role developer dari Pi. Edit model ini, pilih system pada Role system prompt, lalu tes ulang dan simpan provider.",
  gateway_error: "Gateway atau server upstream mengembalikan error HTTP 5xx. Coba lagi nanti; hasil ini belum menentukan dukungan model atau parameter yang bermasalah.",
  fixSystemRole: "Edit role system prompt",
  systemRole: "Role system prompt (OpenAI)", roleAuto: "Ikuti pengaturan Pi / provider", roleSystem: "system — gateway kompatibel", roleDeveloper: "developer — saat reasoning aktif",
  roleHelp: "Jika gateway menolak role developer dengan HTTP 400/422, pilih system. Disimpan sebagai compat.supportsDeveloperRole; reasoning tetap aktif.",
  providerSystemRole: "Default role system prompt — provider ini", providerRoleAuto: "Deteksi otomatis Pi",
  providerRoleHelp: "Untuk API kompatibel OpenAI. Berlaku bagi model lama dan baru yang mengikuti pengaturan provider. Override per model diprioritaskan.",
  inheritedRole: "Default provider", modelRoleOverride: "Override model",
  fillLimits: "Isi batas yang kosong", useLimits: "Gunakan batas terdeteksi", tokenLimits: "Batas token",
  limitsHelp: "Default konteks/output diambil dari metadata endpoint, lalu kecocokan ID persis tanpa konflik di katalog bawaan Pi. Batas gateway bisa berbeda. Nilai yang sudah diisi dipertahankan; simpan provider untuk menerapkan default.",
  limitEndpoint: "Metadata endpoint", limitCatalog: "Referensi katalog Pi", limitConfigured: "Nilai tersimpan / custom", limitManual: "Nilai manual",
  limitUnknown: "Maksimum belum diketahui · default Pi", limitAmbiguous: "Nilai katalog berbeda; maksimum belum diketahui", limitSuggestion: "Nilai terdeteksi",
  limitsFilled: "Batas kosong yang diketahui diisi pada draft. Nilai lama dipertahankan. Simpan provider untuk menerapkan.",
  limitsUnchanged: "Tidak ada batas kosong yang dapat diisi. Tarik model untuk metadata endpoint; maksimum yang belum diketahui memakai default Pi.",
  limitsLookup: "Mencari di katalog Pi…", limitsLookupFailed: "Pencarian katalog gagal. Batas dapat diisi manual.",
  limitsCaveat: "Referensi metadata, bukan maksimum yang diukur. Output juga dapat dibatasi sisa konteks dan gateway/akunmu.",
});
for (const [el, text] of original) translations.en[el.dataset.i18n] ??= text;
let language = localStorage.getItem("pi-manager-language") || "en";
let token = new URLSearchParams(location.hash.slice(1)).get("token") || sessionStorage.getItem("pi-manager-token") || "";
if (token) sessionStorage.setItem("pi-manager-token", token);
history.replaceState(null, "", location.pathname);
const state = { config: null, id: null, models: [], dirty: false, busy: false, readOnly: false, results: new Map() };
const capabilities = ["chat", "tools", "reasoning", "vision"];
let activeProbe;
let editedModel = null;
const limitFields = ["contextWindow", "maxTokens"];
const limitInputs = { contextWindow: "edit-context", maxTokens: "edit-max" };
const fallbackLimits = { contextWindow: 128000, maxTokens: 16384 };
let editingLimits;
let limitLookupTimer;
let limitLookupSequence = 0;
let submittingModel = false;
let previewTimer;
let previewSequence = 0;
let noticeTranslation;
const t = (key) => translations[language]?.[key] || translations.en[key] || key;

function translate() {
  document.documentElement.lang = language;
  $("language").value = language;
  original.forEach((text, el) => { el.textContent = translations[language]?.[el.dataset.i18n] || text; });
  $("model-search").placeholder = t("search");
  $("key-help").textContent = t("keyHelp");
  $("url-help").textContent = t($("api").value === "anthropic-messages" ? "anthropicHelp" : "openaiHelp");
  $("editor-title").textContent = state.id || t("newProvider");
  if (noticeTranslation) $("notice").textContent = t(noticeTranslation);
  if (editingLimits) renderLimitEditor();
  renderVisionFallback(); renderProviders(); renderDefaultProviderNote(); renderModels();
}

async function api(path, data, signal) {
  const response = await fetch(`/api/${path}`, {
    method: data === undefined ? "GET" : "POST", signal,
    headers: { "X-Manager-Token": token, ...(data === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function notify(message, kind = "success") {
  noticeTranslation = Object.keys(translations[language] || {}).find((key) => t(key) === message);
  $("notice").hidden = false; $("notice").className = kind; $("notice").textContent = message;
}

async function operation(fn, diagnostics = false) {
  if (state.busy) return;
  state.busy = true;
  setDisabled();
  if (diagnostics) { $("diagnostics").hidden = false; $("diagnostics").className = "diagnostics"; $("diagnostics").textContent = t("busy"); }
  try { await fn(); }
  catch (error) {
    if (diagnostics) { $("diagnostics").className = "diagnostics error"; $("diagnostics").textContent = error.message; }
    else notify(error.message, "error");
  } finally { state.busy = false; setDisabled(); }
}

function setDisabled() {
  document.querySelectorAll("button").forEach((button) => { button.disabled = state.busy; });
  $("vision-fallback").disabled = state.busy;
  $("connection-fields").disabled = state.busy || state.readOnly;
  $("provider-id").disabled = state.busy || !!state.id || state.readOnly;
  for (const id of ["test-connection", "fetch-models", "add-model", "fill-limits", "save-provider", "delete-provider", "remove-key"]) {
    $(id).disabled = state.busy || state.readOnly;
  }
  document.querySelectorAll("#models-body button,#models-body input").forEach((el) => { el.disabled = state.busy || state.readOnly; });
  $("select-all").disabled = state.busy || state.readOnly;
  document.querySelectorAll("[data-probe-toggle]").forEach((button) => { button.disabled = false; });
  document.querySelectorAll("[data-probe-cancel]").forEach((button) => { button.disabled = !activeProbe; });
  if (editingLimits) $("use-model-limits").disabled = !limitFields.some((field) => editingLimits.hints[field]);
}

function renderVisionFallback() {
  const select = $("vision-fallback");
  const selected = state.config?.visionFallback;
  select.replaceChildren();
  const off = document.createElement("option"); off.value = ""; off.textContent = t("visionFallbackOff"); select.append(off);
  for (const model of state.config?.visionModels || []) {
    const option = document.createElement("option"); option.value = `${model.provider}\n${model.id}`;
    option.textContent = `${model.provider} / ${model.id}${model.name && model.name !== model.id ? ` — ${model.name}` : ""}`;
    select.append(option);
  }
  select.value = selected ? `${selected.provider}\n${selected.model}` : "";
}

function renderProviders() {
  const list = $("provider-list"); list.replaceChildren();
  const providers = state.config?.providers || [];
  $("provider-count").textContent = providers.length;
  if (!providers.length) { const p = document.createElement("p"); p.className = "hint"; p.textContent = t("noProviders"); list.append(p); }
  for (const provider of providers) {
    const button = document.createElement("button"); button.type = "button";
    button.className = state.id === provider.id ? "active" : "";
    const title = document.createElement("strong"); title.textContent = provider.id;
    const detail = document.createElement("small"); detail.textContent = `${provider.models.length} models · ${provider.api || "Pi managed"}`;
    button.append(title);
    if (provider.id === state.config?.defaultProvider) {
      const badge = document.createElement("span"); badge.className = "provider-default-badge"; badge.textContent = t("defaultProviderBadge"); button.append(badge);
    }
    button.append(detail);
    button.onclick = () => { if (!state.dirty || confirm(t("unsaved"))) loadProvider(provider.id); };
    list.append(button);
  }
  setDisabled();
}

function renderDefaultProviderNote() {
  const isDefault = !!state.id && state.id === state.config?.defaultProvider;
  const note = $("default-provider-note");
  note.hidden = !isDefault;
  note.textContent = isDefault ? t("defaultProviderNote") : "";
  $("delete-provider").classList.toggle("delete-default-provider", isDefault);
}

function loadProvider(id = null, preserveResults = false) {
  const previous = preserveResults ? new Map(state.models.map((model) => [model.id, model])) : new Map();
  if (!preserveResults) state.results.clear();
  const provider = state.config?.providers.find((p) => p.id === id);
  state.id = provider?.id || null;
  state.readOnly = provider?.readOnly || false;
  state.models = (provider?.models || []).map((model) => {
    const old = previous.get(model.id);
    return { ...model, selected: true, limitHints: old?.limitHints || model.limitHints,
      limitSources: Object.fromEntries(limitFields.filter((field) => model[field] !== undefined).map((field) => [field, "configured"])) };
  });
  state.dirty = false;
  if (!state.readOnly && !preserveResults) for (const model of state.models) if (fillMissingLimits(model)) state.dirty = true;
  $("provider-id").value = provider?.id || "";
  $("base-url").value = provider?.baseUrl || "";
  $("api").value = provider?.api || "openai-completions";
  $("api-key").value = "";
  $("auth-header").checked = provider?.authHeader || false;
  const role = provider?.compat?.supportsDeveloperRole;
  $("provider-system-role").value = typeof role === "boolean" ? role ? "developer" : "system" : "";
  $("auth-source").textContent = provider?.authSource || "not configured";
  $("remove-key").hidden = provider?.credentialType !== "api_key";
  $("readonly-note").hidden = !state.readOnly;
  $("advanced-note").hidden = !provider?.hasHiddenSettings;
  $("delete-provider").hidden = !provider;
  renderDefaultProviderNote();
  $("model-search").value = "";
  $("diagnostics").hidden = true;
  translate(); preview();
}

function draft(onlySelected = true) {
  return {
    id: $("provider-id").value.trim(), baseUrl: $("base-url").value.trim(), api: $("api").value,
    apiKey: $("api-key").value.trim() || undefined, authHeader: $("auth-header").checked,
    compat: { supportsDeveloperRole: $("provider-system-role").value ? $("provider-system-role").value === "developer" : null },
    revision: state.config?.revision,
    models: state.models.filter((m) => !onlySelected || m.selected).map(({ selected, limitHints, limitSources, ...model }) => model),
  };
}

function validateConnection() {
  for (const id of ["provider-id", "base-url"]) if (!$(id).reportValidity()) return false;
  return true;
}

async function preview() {
  const sequence = ++previewSequence;
  $("url-help").textContent = t($("api").value === "anthropic-messages" ? "anthropicHelp" : "openaiHelp");
  if (!$("base-url").value.trim()) { $("models-url").textContent = "…"; $("chat-url").textContent = "…"; return; }
  try {
    const value = draft(); value.id ||= "preview"; value.apiKey = undefined;
    const result = await api("preview", value);
    if (sequence !== previewSequence) return;
    $("models-url").textContent = result.models; $("chat-url").textContent = result.chat;
  } catch { if (sequence === previewSequence) { $("models-url").textContent = "—"; $("chat-url").textContent = "—"; } }
}

function visibleModels() { const query = $("model-search").value.toLowerCase(); return state.models.filter((m) => `${m.id} ${m.name || ""}`.toLowerCase().includes(query)); }

function action(text, fn, className = "quiet") { const button = document.createElement("button"); button.type = "button"; button.textContent = text; button.className = className; button.onclick = fn; return button; }

function fillMissingLimits(model) {
  let changed = false;
  for (const field of limitFields) if (model[field] === undefined && model.limitHints?.[field]) {
    model[field] = model.limitHints[field].value;
    (model.limitSources ??= {})[field] = model.limitHints[field].source;
    changed = true;
  }
  if (changed) state.results.delete(model.id);
  return changed;
}

function limitSourceText(source, hint) {
  return t({ endpoint: "limitEndpoint", catalog: "limitCatalog", manual: "limitManual", configured: "limitConfigured" }[source] || "limitConfigured")
    + (source === "endpoint" && hint?.field ? ` · ${hint.field}` : "");
}

function renderLimitCell(model) {
  const cell = element("td", "model-limits");
  for (const field of limitFields) {
    const hint = model.limitHints?.[field];
    const value = model[field];
    const block = element("div", "model-limit"); block.dataset.limit = field;
    block.append(element("strong", "", `${t(field === "contextWindow" ? "context" : "maxOutput")}: ${(value ?? fallbackLimits[field]).toLocaleString()}`));
    block.append(element("small", "", value !== undefined ? limitSourceText(model.limitSources?.[field], hint)
      : model.limitHints?.ambiguous?.includes(field) ? t("limitAmbiguous") : t("limitUnknown")));
    cell.append(block);
  }
  return cell;
}

function renderModels() {
  const tbody = $("models-body"); tbody.replaceChildren();
  const visible = visibleModels();
  const count = state.models.filter((m) => m.selected).length;
  $("model-count").textContent = state.models.length;
  $("selected-count").textContent = `${count} ${t("selected")}`;
  $("save-summary").textContent = `${count} ${t("selected")}${state.dirty ? " · ●" : ""}`;
  $("empty-models").hidden = state.models.length > 0;
  $("select-all").checked = !!visible.length && visible.every((m) => m.selected);
  $("select-all").indeterminate = visible.some((m) => m.selected) && !$("select-all").checked;
  // Bounded DOM rendering; searching and select-visible still operate on all results.
  for (const model of visible.slice(0, 300)) {
    const tr = document.createElement("tr"); tr.className = "model-row"; tr.dataset.modelId = model.id;
    const checkCell = document.createElement("td");
    const check = document.createElement("input"); check.type = "checkbox"; check.checked = model.selected;
    check.setAttribute("aria-label", `Select ${model.id}`);
    check.onchange = () => { model.selected = check.checked; state.dirty = true; renderModels(); };
    checkCell.append(check);
    const nameCell = document.createElement("td"); const name = document.createElement("code"); name.textContent = model.id; nameCell.append(name);
    if (model.name) { const sub = document.createElement("small"); sub.textContent = model.name; nameCell.append(sub); }
    const roleOverride = model.compat?.supportsDeveloperRole;
    if (typeof roleOverride === "boolean" || $("provider-system-role").value) {
      nameCell.append(element("small", "", typeof roleOverride === "boolean"
        ? `${t("modelRoleOverride")}: ${roleOverride ? "developer" : "system"}`
        : `${t("inheritedRole")}: ${$("provider-system-role").value}`));
    }
    const context = renderLimitCell(model);
    const input = document.createElement("td"); input.textContent = model.input?.includes("image") ? t("textImage") : t("textOnly");
    input.dataset.label = t("input");
    if (!model.input) { const label = document.createElement("small"); label.textContent = t("fallback"); input.append(label); }
    const actions = document.createElement("td"); const row = document.createElement("div"); row.className = "action-row";
    row.append(action(t("testChat"), () => testModel(model, ["chat"])), action(t("checkCapabilities"), () => testModel(model, capabilities)), action(t("edit"), () => openModel(model)));
    if (state.id === state.config?.defaultProvider && model.id === state.config?.defaultModel) {
      const badge = document.createElement("span"); badge.className = "default-badge"; badge.textContent = t("default"); row.append(badge);
    } else row.append(action(t("setDefault"), () => setDefault(model)));
    row.append(action("×", () => { if (confirm(t("removeModel"))) { state.models = state.models.filter((m) => m !== model); state.results.delete(model.id); state.dirty = true; renderModels(); } }, "text-danger"));
    row.lastChild.setAttribute("aria-label", `${t("remove")} ${model.id}`);
    actions.append(row); tr.append(checkCell, nameCell, context, input, actions); tbody.append(tr);
    const result = state.results.get(model.id);
    if (result) {
      const summary = element("div", "probe-summary");
      for (const capability of capabilities) if (result.checks[capability]) {
        const outcome = result.checks[capability].outcome;
        summary.append(element("span", `probe-badge ${outcome}`, `${t(capability)} · ${t(outcome)}`));
      }
      nameCell.append(summary);
      const toggle = action(t(result.expanded ? "hideResults" : "showResults"), () => { result.expanded = !result.expanded; renderModels(); });
      toggle.dataset.probeToggle = ""; toggle.setAttribute("aria-expanded", String(result.expanded)); row.append(toggle);
      if (result.expanded) tbody.append(renderProbeResults(model, result));
    }
  }
  if (visible.length > 300) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 5; td.textContent = `300 / ${visible.length} ${t("matches")} — ${t("search")}`; tr.append(td); tbody.append(tr); }
  setDisabled();
}

function diagnostics(result, summary) {
  $("diagnostics").hidden = false; $("diagnostics").className = `diagnostics${result.warning ? " warning" : ""}`;
  $("diagnostics").textContent = `${summary}\nHTTP ${result.status} · ${result.durationMs} ms${result.pages ? ` · ${result.pages} page(s)` : ""}\n${result.url}\n${result.warning || result.message || (result.complete ? t("allFetched") : "")}`;
}

function element(tag, className, text) {
  const el = document.createElement(tag); el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function renderProbeResults(model, result) {
  const tr = element("tr", "model-results"); tr.dataset.resultModel = model.id;
  const td = document.createElement("td"); td.colSpan = 5;
  const panel = element("section", "probe-panel"); panel.setAttribute("aria-label", `${t("testResults")}: ${model.id}`);
  const header = element("div", "probe-header");
  const title = element("div", ""); title.append(element("h3", "", t("testResults")), element("code", "", model.id));
  const progress = element("span", "probe-progress", t(result.running ? "testingModel" : result.stopped ? "testsStopped" : "testsFinished"));
  progress.setAttribute("role", "status");
  if (result.running) {
    const done = Object.values(result.checks).filter((check) => check.outcome !== "running" && check.outcome !== "queued").length;
    progress.textContent += ` · ${done}/${Object.keys(result.checks).length}`;
  }
  header.append(title, progress);
  if (result.running) {
    const cancel = action(t("stopTests"), () => activeProbe?.abort()); cancel.dataset.probeCancel = ""; header.append(cancel);
  }
  panel.append(header);
  const grid = element("div", "probe-grid");
  for (const capability of capabilities) {
    const check = result.checks[capability]; const outcome = check?.outcome || "untested";
    const card = element("div", `probe-check ${outcome}`); card.dataset.capability = capability; card.dataset.outcome = outcome;
    const heading = element("div", "probe-check-heading");
    heading.append(element("strong", "", t(capability)), element("span", `probe-badge ${outcome}`, t(outcome)));
    card.append(heading);
    if (check?.code || check?.error) card.append(element("p", "", check.error || t(check.code)));
    if (check?.code === "developer_role_unsupported") card.append(action(t("fixSystemRole"), () => { openModel(model); $("edit-system-role").focus(); }));
    if (check?.durationMs !== undefined) {
      card.append(element("p", "probe-meta", `${check.status ? `HTTP ${check.status} · ` : ""}${check.durationMs.toLocaleString()} ms · ${check.requests} ${t("requests")}`));
      card.append(element("p", "probe-meta", `${check.inputTokens} / ${check.outputTokens} ${t("tokenUsage")}`));
      card.append(element("code", "probe-url", check.url));
    }
    grid.append(card);
  }
  panel.append(grid, element("p", "hint", t("probeScope")));
  if (result.applied) panel.append(element("p", "probe-applied", t("verifiedApplied")));
  else if (result.checks.vision?.outcome === "supported" || result.checks.reasoning?.outcome === "supported") {
    panel.append(action(t("applyVerified"), () => {
      if (result.checks.vision?.outcome === "supported") model.input = ["text", "image"];
      if (result.checks.reasoning?.outcome === "supported") model.reasoning = true;
      state.dirty = true; result.applied = true; renderModels();
    }));
  }
  td.append(panel); tr.append(td); return tr;
}

function openModel(model = null) {
  clearTimeout(limitLookupTimer); limitLookupSequence++;
  editedModel = model;
  editingLimits = { id: model?.id || "", hints: model?.limitHints || {}, sources: { ...model?.limitSources }, touched: new Set(), status: "" };
  $("edit-model-id").value = model?.id || ""; $("edit-model-id").disabled = !!model;
  $("edit-model-name").value = model?.name || "";
  $("edit-context").value = model?.contextWindow || ""; $("edit-max").value = model?.maxTokens || "";
  $("edit-vision").value = model?.input === undefined ? "" : model.input.includes("image") ? "yes" : "no";
  $("edit-reasoning").value = model?.reasoning === undefined ? "" : model.reasoning ? "yes" : "no";
  const developerRole = model?.compat?.supportsDeveloperRole;
  $("edit-system-role").value = typeof developerRole === "boolean" ? developerRole ? "developer" : "system" : "";
  renderLimitEditor();
  $("model-dialog").showModal();
}

function renderLimitEditor() {
  for (const field of limitFields) {
    const input = $(limitInputs[field]);
    const hint = editingLimits.hints[field];
    input.placeholder = `${t("fallback")}: ${fallbackLimits[field]}`;
    const source = editingLimits.sources[field];
    let text = input.value ? limitSourceText(source, hint) : editingLimits.hints.ambiguous?.includes(field) ? t("limitAmbiguous") : t("limitUnknown");
    if (hint && (!input.value || Number(input.value) !== hint.value || !["endpoint", "catalog"].includes(source))) {
      text += ` · ${t("limitSuggestion")}: ${hint.value.toLocaleString()} (${limitSourceText(hint.source, hint)})`;
    }
    $(`${limitInputs[field]}-source`).textContent = text;
  }
  $("use-model-limits").disabled = !limitFields.some((field) => editingLimits.hints[field]);
  $("limit-lookup-status").textContent = t(editingLimits.status || "limitsCaveat");
}

async function lookupEditorLimits() {
  const id = $("edit-model-id").value.trim();
  const sequence = ++limitLookupSequence;
  if (!id) return;
  editingLimits.status = "limitsLookup"; renderLimitEditor();
  try {
    const hints = await api("model-limits", { modelId: id });
    if (sequence !== limitLookupSequence || !$("model-dialog").open || id !== $("edit-model-id").value.trim()) return;
    editingLimits.hints = hints; editingLimits.status = "";
    for (const field of limitFields) if (!editingLimits.touched.has(field) && hints[field]) {
      $(limitInputs[field]).value = hints[field].value;
      editingLimits.sources[field] = hints[field].source;
    }
  } catch {
    if (sequence !== limitLookupSequence) return;
    editingLimits.status = "limitsLookupFailed";
  }
  renderLimitEditor();
}

$("edit-model-id").addEventListener("input", () => {
  clearTimeout(limitLookupTimer); limitLookupSequence++;
  editingLimits.id = $("edit-model-id").value.trim(); editingLimits.hints = {}; editingLimits.status = "";
  for (const field of limitFields) if (!editingLimits.touched.has(field)) { $(limitInputs[field]).value = ""; delete editingLimits.sources[field]; }
  renderLimitEditor(); limitLookupTimer = setTimeout(lookupEditorLimits, 200);
});
for (const field of limitFields) $(limitInputs[field]).addEventListener("input", () => {
  editingLimits.touched.add(field); editingLimits.sources[field] = "manual"; renderLimitEditor();
});
$("use-model-limits").onclick = () => {
  for (const field of limitFields) if (editingLimits.hints[field]) {
    $(limitInputs[field]).value = editingLimits.hints[field].value;
    editingLimits.sources[field] = editingLimits.hints[field].source;
    editingLimits.touched.delete(field);
  }
  renderLimitEditor();
};

$("model-form").onsubmit = async (event) => {
  event.preventDefault();
  if (submittingModel) return;
  const id = $("edit-model-id").value.trim();
  if (!id) return;
  if (!editedModel && state.models.some((m) => m.id === id)) { alert(t("duplicate")); return; }
  if (!editedModel && editingLimits.id === id && !limitFields.some((field) => editingLimits.hints[field])) {
    const editor = editingLimits;
    submittingModel = true;
    try { clearTimeout(limitLookupTimer); await lookupEditorLimits(); } finally { submittingModel = false; }
    if (editor !== editingLimits || !$("model-dialog").open || id !== $("edit-model-id").value.trim()) return;
  }
  const model = { id, selected: editedModel?.selected ?? true, limitHints: editingLimits.hints, limitSources: { ...editingLimits.sources } };
  if ($("edit-model-name").value.trim()) model.name = $("edit-model-name").value.trim();
  if ($("edit-context").value) model.contextWindow = Number($("edit-context").value);
  if ($("edit-max").value) model.maxTokens = Number($("edit-max").value);
  if ($("edit-vision").value) model.input = $("edit-vision").value === "yes" ? ["text", "image"] : ["text"];
  if ($("edit-reasoning").value) model.reasoning = $("edit-reasoning").value === "yes";
  const role = $("edit-system-role").value;
  if (role || editedModel?.compat?.supportsDeveloperRole !== undefined) model.compat = { supportsDeveloperRole: role ? role === "developer" : null };
  if (editedModel) state.models[state.models.indexOf(editedModel)] = model; else state.models.push(model);
  state.results.delete(model.id);
  limitLookupSequence++; state.dirty = true; $("model-dialog").close(); renderModels();
};
$("close-dialog").onclick = () => $("model-dialog").close();
$("model-dialog").addEventListener("close", () => { clearTimeout(limitLookupTimer); limitLookupSequence++; });
$("add-model").onclick = () => openModel();
$("new-provider").onclick = () => { if (!state.dirty || confirm(t("unsaved"))) loadProvider(); };
$("model-search").oninput = renderModels;
$("select-all").onchange = () => { visibleModels().forEach((m) => { m.selected = $("select-all").checked; }); state.dirty = true; renderModels(); };
$("language").onchange = () => { language = $("language").value; localStorage.setItem("pi-manager-language", language); translate(); };
for (const id of ["provider-id", "base-url", "api", "api-key", "auth-header", "provider-system-role"]) {
  $(id).addEventListener("input", () => {
    if (["provider-id", "base-url", "api", "api-key"].includes(id)) for (const model of state.models) for (const field of limitFields) {
      if (model.limitHints?.[field]?.source === "endpoint") delete model.limitHints[field];
      if (model.limitSources?.[field] === "endpoint") { delete model[field]; delete model.limitSources[field]; }
    }
    state.dirty = true; state.results.clear(); renderModels(); clearTimeout(previewTimer); previewTimer = setTimeout(preview, 200);
  });
}
$("fill-limits").onclick = () => {
  let changed = false;
  for (const model of state.models) if (fillMissingLimits(model)) changed = true;
  state.dirty ||= changed; renderModels(); notify(t(changed ? "limitsFilled" : "limitsUnchanged"));
};
$("test-connection").onclick = () => {
  if (!validateConnection()) return;
  operation(async () => { const result = await api("connection", draft(false)); diagnostics(result, t("connectionOk")); }, true);
};
$("fetch-models").onclick = () => {
  if (!validateConnection()) return;
  operation(async () => {
    const result = await api("discover", draft(false));
    const known = new Map(state.models.map((m) => [m.id, m]));
    for (const model of result.models) {
      const existing = known.get(model.id);
      if (existing) {
        // Endpoint metadata supersedes an unsaved catalog default, never a saved/manual value.
        for (const field of limitFields) if (["catalog", "endpoint"].includes(existing.limitSources?.[field]) && model.limitHints?.[field]) {
          if (existing[field] !== model[field]) { state.results.delete(existing.id); state.dirty = true; }
          existing[field] = model[field]; existing.limitSources[field] = model.limitHints[field].source;
        }
        existing.limitHints = model.limitHints;
        if (fillMissingLimits(existing)) state.dirty = true;
      } else {
        const added = { ...model, selected: false, limitSources: Object.fromEntries(limitFields.filter((field) => model.limitHints?.[field]).map((field) => [field, model.limitHints[field].source])) };
        state.models.push(added); known.set(model.id, added);
      }
    }
    diagnostics(result, `${t("fetchDone")}: ${result.models.length}`); renderModels();
  }, true);
};
async function testModel(model, checks) {
  if (state.busy || !validateConnection()) return;
  const provider = draft(false);
  const result = state.results.get(model.id) || { checks: {} };
  Object.assign(result, { expanded: true, running: true, stopped: false, applied: false });
  for (const capability of checks) result.checks[capability] = { outcome: "queued" };
  state.results.set(model.id, result); state.busy = true; activeProbe = new AbortController();
  renderModels();
  const panel = [...document.querySelectorAll(".model-results")].find((el) => el.dataset.resultModel === model.id);
  panel?.scrollIntoView({ block: "nearest" });
  try {
    for (const capability of checks) {
      if (activeProbe.signal.aborted) break;
      result.checks[capability] = { outcome: "running" }; renderModels();
      try {
        result.checks[capability] = await api("test-model", { provider, modelId: model.id, capability }, activeProbe.signal);
        if (["auth_failed", "rate_limited", "redirect", "connection_failed", "developer_role_unsupported", "gateway_error"].includes(result.checks[capability].code)) {
          result.stopped = true; break;
        }
      } catch (error) {
        result.checks[capability] = activeProbe.signal.aborted ? { outcome: "inconclusive", code: "cancelled" } : { outcome: "failed", error: error.message };
        result.stopped = true; break;
      }
      renderModels();
    }
  } finally {
    result.stopped ||= activeProbe.signal.aborted;
    for (const capability of checks) if (result.checks[capability].outcome === "queued") delete result.checks[capability];
    result.running = false; state.busy = false; activeProbe = undefined; renderModels();
  }
}
async function setDefault(model) {
  if (!state.id || state.dirty || !model.selected) { notify(t("saveFirst"), "warning"); return; }
  await operation(async () => { const result = await api("default", { id: state.id, modelId: model.id }); state.config = result.state; renderProviders(); renderDefaultProviderNote(); renderModels(); notify(t("defaultSaved")); });
}
$("provider-form").onsubmit = (event) => {
  event.preventDefault();
  operation(async () => {
    const value = draft(); const result = await api("save", value);
    state.config = result.state; loadProvider(value.id, true); notify(result.warning || t("saved"), result.warning ? "warning" : "success");
  });
};
$("delete-provider").onclick = () => {
  if (!state.id) return;
  if (state.id === state.config?.defaultProvider) {
    notify(t("defaultProviderNote"), "warning");
    $("default-provider-note").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!confirm(t("confirmDelete"))) return;
  operation(async () => { const result = await api("delete", { id: state.id, revision: state.config.revision }); state.config = result.state; loadProvider(); notify(result.message); });
};
$("remove-key").onclick = () => {
  if (state.dirty && !confirm(t("unsaved"))) return;
  if (!state.id || !confirm(t("confirmKey"))) return;
  operation(async () => { const result = await api("remove-key", { id: state.id }); state.config = result.state; loadProvider(state.id); notify(t("keyRemoved")); });
};
$("save-vision-fallback").onclick = () => {
  const [provider = "", modelId = ""] = $("vision-fallback").value.split("\n");
  operation(async () => {
    const result = await api("vision-fallback", { provider, modelId, revision: state.config.visionFallbackRevision });
    state.config = result.state; renderVisionFallback(); notify(t("visionFallbackSaved"));
  });
};
$("refresh-state").onclick = () => {
  if (state.dirty && !confirm(t("unsaved"))) return;
  operation(async () => { state.config = await api("state"); loadProvider(state.id); notify(t("refreshDone")); });
};
window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });

translate();
if (!token) notify(t("missingToken"), "error");
else operation(async () => {
  state.config = await api("state");
  $("config-path").textContent = state.config.dir; $("version").textContent = `Pi ${state.config.piVersion} · Manager ${state.config.managerVersion}`;
  loadProvider(state.config.providers.find((p) => !p.readOnly)?.id || null);
});
