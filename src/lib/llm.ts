import { ProviderConfig, LLMProvider, AvailableModel } from "./types";
import { getSecureApiKey } from "./secureStorage";
import { isDesktopApp } from "./desktop";

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCallOptions {
  /**
   * Explicitly request (or suppress) provider-native JSON output mode.
   * When omitted, the mode is inferred from the prompt via {@link inferJsonMode}.
   */
  jsonMode?: boolean;
}

/**
 * Heuristically infers whether the caller wants provider-native JSON output.
 * Requires an explicit JSON/schema mention AND the absence of an opt-out
 * directive ("do not return json", "plain text"), so a prose prompt that
 * merely says "Do NOT return JSON" is correctly treated as non-JSON.
 */
export function inferJsonMode(messages: LLMMessage[]): boolean {
  const mentionsJson = messages.some((m) => /\bjson\b|\bschema\b/i.test(m.content));
  if (!mentionsJson) return false;
  const optsOut = messages.some((m) =>
    /do\s+not\s+(?:return|output|produce|wrap)[^.]*json|plain\s*text|not\s+json/i.test(m.content)
  );
  return !optsOut;
}

/**
 * Validates and normalizes an API base URL (Audit Finding #4).
 * Strictly requires HTTPS for all remote endpoints.
 * Allows plain HTTP exclusively for loopback hosts (localhost, 127.0.0.1, [::1]).
 */
export function validateBaseUrl(rawUrl: string | undefined | null): { valid: boolean; normalized?: string; error?: string } {
  if (!rawUrl || !rawUrl.trim()) {
    return { valid: true, normalized: undefined };
  }
  let urlStr = rawUrl.trim();
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }
  try {
    const parsed = new URL(urlStr);
    const isLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
    if (parsed.protocol === "http:" && !isLoopback) {
      return {
        valid: false,
        error: `Insecure HTTP is only permitted for loopback hosts (localhost, 127.0.0.1). Remote endpoint "${parsed.hostname}" must use HTTPS (https://).`
      };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: `Invalid URL protocol: ${parsed.protocol}. Only HTTPS (or local HTTP) is allowed.` };
    }
    return { valid: true, normalized: urlStr.replace(/\/+$/, "") };
  } catch {
    return { valid: false, error: `Malformed API base URL: "${rawUrl}"` };
  }
}

/**
 * Executes a network request using the native Rust backend in desktop mode
 * to bypass browser Origin headers and eliminate the need for dangerous browser flags.
 */
async function nativeFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  if (isDesktopApp()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const cleanHeaders: Record<string, string> = {};
      if (init.headers) {
        for (const [k, v] of Object.entries(init.headers)) {
          // Exclude dangerous direct browser access flag from native requests (Audit Finding #3)
          if (k.toLowerCase() === "anthropic-dangerous-direct-browser-access") continue;
          cleanHeaders[k] = v;
        }
      }
      const res = await invoke<{ status: number; body: string; ok: boolean }>("call_llm_native", {
        url,
        method: init.method || "POST",
        headers: cleanHeaders,
        body: init.body || null,
      });
      return {
        ok: res.ok,
        status: res.status,
        text: async () => res.body,
        json: async () => JSON.parse(res.body),
      };
    } catch (err) {
      console.warn("Native LLM IPC call failed, falling back to standard fetch:", err);
    }
  }

  // Web fallback
  const cleanHeaders: Record<string, string> = { ...(init.headers || {}) };
  // Remove dangerous header completely
  delete cleanHeaders["anthropic-dangerous-direct-browser-access"];
  const res = await fetch(url, {
    method: init.method,
    headers: cleanHeaders,
    body: init.body,
    signal: init.signal,
  });
  return {
    ok: res.ok,
    status: res.status,
    text: async () => res.text(),
    json: async () => res.json(),
  };
}

export function getEnv(key: string): string {
  try {
    const g = (typeof window !== "undefined" ? window : globalThis) as any;
    if (g?.process?.env?.[key]) return String(g.process.env[key]).trim();
    const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : undefined;
    if (metaEnv) {
      if (metaEnv[key]) return String(metaEnv[key]).trim();
      if (metaEnv[`VITE_${key}`]) return String(metaEnv[`VITE_${key}`]).trim();
    }
  } catch {}
  return "";
}

export function getSavedClientConfig(): ProviderConfig | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("manuview_provider_config");
    if (raw) {
      const parsed: ProviderConfig = JSON.parse(raw);
      let modified = false;
      if (parsed.model && parsed.model.startsWith("models/")) {
        parsed.model = parsed.model.replace(/^models\//, "");
        modified = true;
      }
      if (parsed.provider === "gemini" && (!parsed.model || parsed.model.startsWith("gemini-2.0") || parsed.model.startsWith("gemini-1.0") || parsed.model === "gemini-pro")) {
        parsed.model = "gemini-2.5-flash";
        modified = true;
      }
      if (modified) {
        try {
          localStorage.setItem("manuview_provider_config", JSON.stringify(parsed));
        } catch {}
      }
      return parsed;
    }
  } catch (err: any) {
    console.debug("Failed to read saved client config:", err?.message);
  }
  return undefined;
}

/**
 * Resolves full client configuration including API credentials asynchronously
 * from native OS Keychain, secure storage, or environment variables.
 */
export async function resolveActiveConfig(config?: ProviderConfig): Promise<ProviderConfig> {
  const base = config || getSavedClientConfig() || { provider: "gemini", model: "gemini-2.5-flash", baseUrl: "http://localhost:11434" };
  let provider: LLMProvider = base.provider || "gemini";
  let apiKey = (base.apiKey || "").trim();
  let model = (base.model || "").trim();
  let baseUrl = (base.baseUrl || "").trim();

  // 1. If no apiKey provided by caller, query native OS Keychain / secure memory store
  if (!apiKey && provider !== "ollama" && provider !== "webllm") {
    try {
      const secureKey = await getSecureApiKey(provider);
      if (secureKey && secureKey.trim().length > 0) {
        apiKey = secureKey.trim();
      }
    } catch (e) {
      console.warn(`Failed to retrieve secure key for ${provider}:`, e);
    }
  }

  // 2. If still no apiKey, query environment variables
  if (!apiKey && provider !== "ollama" && provider !== "webllm") {
    if (provider === "gemini") apiKey = getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY');
    else if (provider === "groq") apiKey = getEnv('GROQ_API_KEY');
    else if (provider === "openai") apiKey = getEnv('OPENAI_API_KEY');
    else if (provider === "anthropic") apiKey = getEnv('ANTHROPIC_API_KEY');
    else if (provider === "laya" || provider === "typesafe") {
      apiKey = "on-device-laya";
    }
  }

  return {
    ...base,
    provider,
    apiKey,
    model: model || (
      provider === "webllm" ? "Qwen2.5-0.5B-Instruct-q4f16_1-MLC" :
      provider === "gemini" ? "gemini-2.5-flash" :
      provider === "groq" ? "llama-3.3-70b-versatile" :
      provider === "openai" ? "gpt-4o-mini" :
      (provider === "laya" || provider === "typesafe") ? "laya-system1-int8" :
      "claude-3-5-sonnet-20241022"
    ),
    baseUrl: baseUrl || (
      provider === "openai" ? "https://api.openai.com/v1" :
      (provider === "laya" || provider === "typesafe") ? "local://laya" :
      "http://localhost:11434"
    ),
    hasSecureKey: provider === "webllm" || provider === "ollama" || provider === "laya" || provider === "typesafe" || Boolean(apiKey),
  };
}

/**
 * Sanitizes sensitive credentials (API keys, authorization tokens) from error strings (REQ-SEC-01)
 */
export function sanitizeErrorMessage(msg: unknown): string {
  if (!msg) return "";
  let str: string;
  if (typeof msg === "string") {
    str = msg;
  } else if (msg instanceof Error) {
    str = msg.message;
  } else if (Array.isArray(msg)) {
    str = msg
      .map((item) =>
        typeof item === "string"
          ? item
          : (item as any)?.msg || (item as any)?.message || JSON.stringify(item)
      )
      .join("; ");
  } else if (typeof msg === "object") {
    const anyMsg = msg as any;
    str = anyMsg.message || anyMsg.detail || anyMsg.error || JSON.stringify(msg);
  } else {
    str = String(msg);
  }

  if (typeof str !== "string") {
    str = typeof str === "object" ? JSON.stringify(str) : String(str);
  }

  return str
    .replace(/([?&](?:key|apiKey|api_key|token|auth)=)[a-zA-Z0-9_\-]+/gi, "$1[REDACTED]")
    .replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]")
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]")
    .replace(/(?:x-api-key|authorization|api[-_]?key)\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]+["']?/gi, "api-key: [REDACTED]")
    .replace(/sk-ant-[a-zA-Z0-9_\-]{20,}/gi, "sk-ant-[REDACTED]")
    .replace(/nvapi-[a-zA-Z0-9_\-]{15,}/gi, "nvapi-[REDACTED]")
    .replace(/sk-[a-zA-Z0-9_\-]{20,}/gi, "sk-[REDACTED]")
    .replace(/AIza[a-zA-Z0-9_\-]{30,}/gi, "AIza[REDACTED]")
    .replace(/gsk_[a-zA-Z0-9_\-]{20,}/gi, "gsk_[REDACTED]");
}

/**
 * Sanitizes untrusted user/author text before LLM prompt injection (REQ-SEC-02).
 * Disarms custom delimiter sequences, fake XML boundary tags, and common prompt injection directives.
 */
export function sanitizeAuthorText(text: unknown): string {
  if (!text) return "";
  if (typeof text !== "string") {
    if (typeof (text as any).raw === "string") return sanitizeAuthorText((text as any).raw);
    return String(text);
  }
  return text
    // Neutralize custom boundary tags and XML wrapper impersonations
    .replace(/<{3,}[^>]+>{3,}/gi, "[delimiter neutralized]")
    .replace(/<\/?(?:untrusted_[a-zA-Z0-9_-]+|system|instructions|prompt|admin|evaluator)[^>]*>/gi, "[tag neutralized]")
    // Neutralize prompt injection attempts targeting instruction overrides
    .replace(/\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|directives|prompts|rules)\b/gi, "[filtered injection attempt: ignore instructions]")
    .replace(/\b(?:system\s+prompt\s+override|override\s+system\s+prompt)\b/gi, "[filtered injection attempt: system prompt override]")
    .replace(/\byou\s+are\s+now\s+(?:in\s+debug\s+mode|an?\s+unrestricted|DAN|jailbroken)\b/gi, "[filtered injection attempt: jailbreak]")
    .replace(/\boutput\s+(?:only\s+|strictly\s+)?(?:a\s+)?score\s+(?:of\s+)?100\b/gi, "[filtered injection attempt: forced score]");
}

export function getServerConfigStatus(): {
  hasServerKey: boolean;
  hasClientKey?: boolean;
  activeProvider: LLMProvider | 'none';
  availableProviders: string[];
  baseUrl?: string;
  model?: string;
} {
  const saved = getSavedClientConfig();
  const serverProviders: string[] = [];
  let serverActiveProvider: LLMProvider | 'none' = 'none';

  if (getEnv('OPENAI_API_KEY')) {
    serverProviders.push('openai');
    if (serverActiveProvider === 'none') serverActiveProvider = 'openai';
  }
  if (getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY')) {
    serverProviders.push('gemini');
    if (serverActiveProvider === 'none') serverActiveProvider = 'gemini';
  }
  if (getEnv('GROQ_API_KEY')) {
    serverProviders.push('groq');
    if (serverActiveProvider === 'none') serverActiveProvider = 'groq';
  }
  if (getEnv('ANTHROPIC_API_KEY')) {
    serverProviders.push('anthropic');
    if (serverActiveProvider === 'none') serverActiveProvider = 'anthropic';
  }
  if (getEnv('TYPESAFE_API_KEY')) {
    serverProviders.push('typesafe');
    if (serverActiveProvider === 'none') serverActiveProvider = 'typesafe';
  }

  const hasServerKey = serverProviders.length > 0;
  const hasClientKey = Boolean(saved && (saved.apiKey || saved.hasSecureKey || saved.provider === "ollama" || saved.provider === "webllm" || saved.provider === "laya" || saved.provider === "typesafe"));

  if (hasClientKey && saved) {
    return {
      hasServerKey,
      hasClientKey: true,
      activeProvider: saved.provider,
      availableProviders: Array.from(new Set([saved.provider, ...serverProviders])),
      baseUrl: saved.baseUrl,
      model: saved.model,
    };
  }

  return {
    hasServerKey,
    hasClientKey: false,
    activeProvider: serverActiveProvider,
    availableProviders: serverProviders,
    baseUrl: getEnv('OPENAI_BASE_URL') || undefined,
    model: getEnv('OPENAI_MODEL') || getEnv('GEMINI_MODEL') || getEnv('GROQ_MODEL') || undefined,
  };
}

const LLM_TIMEOUT_MS = 90_000;

/**
 * Creates an AbortController backed by an *idle* timeout: the abort fires only
 * after `ms` of inactivity. Call `reset()` on each sign of progress (e.g. a
 * streamed chunk) to keep a long-but-healthy request alive.
 */
function createIdleTimeout(ms: number): {
  controller: AbortController;
  reset: () => void;
  cancel: () => void;
} {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const reset = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => controller.abort(), ms);
  };
  const cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
  reset();
  return { controller, reset, cancel };
}

async function readStream(
  response: Response,
  onChunk: (delta: string, accumulated: string) => void,
  extractDelta: (line: string) => string | null,
  onActivity?: () => void
): Promise<string> {
  if (!response.body) {
    throw new Error("Response body is null, cannot stream.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let accumulated = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Reset the idle-timeout watchdog on every received chunk so a long but
      // healthy stream is not aborted mid-generation by the wall-clock timeout.
      onActivity?.();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const delta = extractDelta(trimmed);
        if (delta) {
          accumulated += delta;
          onChunk(delta, accumulated);
        }
      }
    }

    if (buffer.trim()) {
      const delta = extractDelta(buffer.trim());
      if (delta) {
        accumulated += delta;
        onChunk(delta, accumulated);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}

function extractGeminiDelta(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const jsonStr = line.replace(/^data:\s*/, "");
  if (!jsonStr || jsonStr === "[DONE]") return null;
  try {
    const data = JSON.parse(jsonStr);
    const parts = data.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      return parts.map((p: any) => p.text || "").join("") || null;
    }
    return null;
  } catch {
    return null;
  }
}

function extractOpenAIDelta(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.replace(/^data:\s*/, "");
  if (!payload || payload === "[DONE]") return null;
  try {
    const data = JSON.parse(payload);
    return data.choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

function extractAnthropicDelta(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.replace(/^data:\s*/, "");
  if (!payload || payload === "[DONE]") return null;
  try {
    const data = JSON.parse(payload);
    if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
      return data.delta.text || null;
    }
    return null;
  } catch {
    return null;
  }
}

function extractOllamaDelta(line: string): string | null {
  if (!line.startsWith("{")) return null;
  try {
    const data = JSON.parse(line);
    return data.message?.content || null;
  } catch {
    return null;
  }
}

export async function callLLM(
  messages: LLMMessage[],
  config?: ProviderConfig,
  onChunk?: (delta: string, accumulated: string) => void,
  options?: LLMCallOptions
): Promise<string> {
  // Resolve JSON output mode once: explicit option wins, otherwise infer from
  // the prompt with a guard against prose prompts that say "Do NOT return JSON".
  const jsonMode = options?.jsonMode ?? inferJsonMode(messages);
  // 1. Resolve Provider and Credentials
  const resolvedConfig = await resolveActiveConfig(config);
  let provider: LLMProvider = resolvedConfig.provider || "gemini";
  let apiKey: string = resolvedConfig.apiKey || "";
  let model: string = resolvedConfig.model || "";
  let baseUrl: string = resolvedConfig.baseUrl || "http://localhost:11434";

  // Laya is a non-autoregressive decision model, not a generative text LLM.
  // Route structured document audits through the Fast Scan service instead.
  if (provider === "laya" || provider === "typesafe") {
    throw new Error(
      "Laya is an on-device decision model, not a generative chat LLM. Use the Fast Scan service to review manuscripts with Laya, and select a text model (e.g. Gemini, OpenAI, Claude, or Ollama) for persona peer review."
    );
  }

  if (!apiKey && provider !== "ollama" && provider !== "webllm") {
    throw new Error(`No API key configured for ${provider.toUpperCase()}. Please configure your API key in AI Settings.`);
  }

  // -----------------------------------------------------------
  // 0. On-Device WebGPU SLM (WebLLM)
  // -----------------------------------------------------------
  if (provider === "webllm") {
    const { generateWithLocalSLM, DEFAULT_LOCAL_MODEL } = await import("./webllm/webllm-service");
    const targetModel = model || DEFAULT_LOCAL_MODEL;
    return await generateWithLocalSLM(messages, targetModel, onChunk);
  }

  // -----------------------------------------------------------
  // 1. Google Gemini API
  // -----------------------------------------------------------
  if (provider === "gemini" && apiKey) {
    let geminiModel = (model || "gemini-2.5-flash").trim();
    if (geminiModel.startsWith("models/")) {
      geminiModel = geminiModel.replace(/^models\//, "");
    }
    // Upgrade discontinued models to latest 2.5 flash
    if (
      geminiModel.startsWith("gemini-2.0") ||
      geminiModel.startsWith("gemini-1.0") ||
      geminiModel === "gemini-pro" ||
      geminiModel === "gemini-pro-vision"
    ) {
      geminiModel = "gemini-2.5-flash";
    }
    const cleanKey = apiKey.trim();
    const action = onChunk ? "streamGenerateContent?alt=sse" : "generateContent";
    let cleanModel = encodeURIComponent(geminiModel);
    let geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:${action}`;
    const { controller, reset: resetTimeout, cancel: cancelTimeout } = createIdleTimeout(LLM_TIMEOUT_MS);
    try {
      const systemMessage = messages.find(m => m.role === 'system')?.content;
      const nonSystemMessages = messages.filter(m => m.role !== 'system');

      // Ensure alternating turns without consecutive duplicate roles
      let contents: any[] = [];
      if (nonSystemMessages.length === 0 && systemMessage) {
        contents = [{ role: 'user', parts: [{ text: systemMessage }] }];
      } else {
        nonSystemMessages.forEach(m => {
          const role = m.role === 'assistant' ? 'model' : 'user';
          if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts[0].text += `\n\n${m.content}`;
          } else {
            contents.push({ role, parts: [{ text: m.content }] });
          }
        });
      }

      const requestPayload: any = {
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      };

      if (systemMessage) {
        requestPayload.systemInstruction = {
          parts: [{ text: systemMessage }],
        };
      }

      let response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cleanKey,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      // Fallback: If requested model returns 404 (e.g. legacy or discontinued model ID), auto-fallback to latest working model
      if (!response.ok && response.status === 404) {
        const fallbackTarget = geminiModel !== "gemini-2.5-flash" ? "gemini-2.5-flash" : "gemini-1.5-flash";
        console.warn(`Gemini model "${geminiModel}" returned 404, auto-falling back to ${fallbackTarget}...`);
        geminiModel = fallbackTarget;
        cleanModel = encodeURIComponent(geminiModel);
        geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:${action}`;
        response = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": cleanKey,
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
      }

      // Fallback: If systemInstruction or responseMimeType is rejected on legacy models with 400, retry merged
      if (!response.ok && response.status === 400 && systemMessage) {
        console.warn("Gemini rejected systemInstruction/json mode, retrying with prepended prompt...");
        const mergedText = `[SYSTEM INSTRUCTIONS]\n${systemMessage}\n\n[USER INPUT]\n${nonSystemMessages.map(m => m.content).join("\n\n")}`;
        response = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": cleanKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: mergedText }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
          }),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        let errText = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          errText = errJson.error?.message || errText;
        } catch {
          errText = (await response.text()) || errText;
        }
        const safeErr = sanitizeErrorMessage(errText);
        console.error("Gemini API error:", response.status, safeErr);
        throw new Error(`Gemini API error (${response.status}): ${safeErr}`);
      }

      if (onChunk) {
        try {
          const text = await readStream(response, onChunk, extractGeminiDelta, resetTimeout);
          if (text && text.trim().length > 0) return text;
        } catch (streamErr) {
          console.warn("Gemini stream failed, attempting resilient non-streaming fallback:", streamErr);
        }

        // Resilient non-streaming fallback if stream returned empty or had socket/SSE interruption
        const nonStreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;
        const fallbackRes = await fetch(nonStreamUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": cleanKey,
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          const fbParts = fbData.candidates?.[0]?.content?.parts;
          const fbText = Array.isArray(fbParts) ? fbParts.map((p: any) => p.text || "").join("") : "";
          if (fbText && fbText.trim().length > 0) {
            onChunk(fbText, fbText);
            return fbText;
          }
        }
        throw new Error("Gemini stream returned empty content.");
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p: any) => p.text || "").join("") : "";
      if (text) return text;
      throw new Error("Gemini returned empty candidate response.");
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Google Gemini call timed out after ${LLM_TIMEOUT_MS / 1000}s`);
      }
      const safeMsg = sanitizeErrorMessage(err.message);
      console.error("Gemini call failed:", safeMsg);
      throw new Error(`Google Gemini call failed: ${safeMsg}`);
    } finally {
      cancelTimeout();
    }
  }

  // -----------------------------------------------------------
  // 2. Groq / Mistral / OpenAI Compatible API (including OpenRouter & NVIDIA NIM)
  // -----------------------------------------------------------
  if ((provider === "groq" || provider === "openai" || provider === "mistral") && apiKey) {
    let customBase = config?.baseUrl || getEnv('OPENAI_BASE_URL');
    const isNvidia = Boolean(apiKey?.startsWith("nvapi-") || (customBase && customBase.includes("nvidia.com")));
    const isOpenRouter = !isNvidia && Boolean(apiKey?.startsWith("sk-or-") || (customBase && customBase.includes("openrouter.ai")));
    if (!customBase) {
      if (isNvidia) {
        customBase = "https://integrate.api.nvidia.com/v1";
      } else if (isOpenRouter) {
        customBase = "https://openrouter.ai/api/v1";
      }
    }

    let endpoint = "https://api.openai.com/v1/chat/completions";
    if (provider === "groq") {
      endpoint = "https://api.groq.com/openai/v1/chat/completions";
    } else if (provider === "mistral") {
      endpoint = "https://api.mistral.ai/v1/chat/completions";
    } else if (customBase) {
      const validated = validateBaseUrl(customBase);
      if (!validated.valid) {
        throw new Error(validated.error || `Invalid OpenAI base URL: ${customBase}`);
      }
      let cleanBase = validated.normalized || customBase.trim().replace(/\/+$/, "");
      endpoint = cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`;
    }
    let chosenModel = (model || getEnv('OPENAI_MODEL') || (provider === "groq" ? "llama-3.3-70b-versatile" : provider === "mistral" ? "mistral-large-latest" : isNvidia ? "nvidia/llama-3.1-nemotron-70b-instruct" : (isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini"))).trim();
    if (isNvidia && (!chosenModel.includes("/") || chosenModel === "gpt-4o" || chosenModel === "gpt-4o-mini")) {
      chosenModel = "nvidia/llama-3.1-nemotron-70b-instruct";
    }
    if (chosenModel.startsWith("models/")) {
      chosenModel = chosenModel.replace(/^models\//, "");
    }
    const isReasoningModel = /^o[13](?:-|$)/i.test(chosenModel);

    const { controller, reset: resetTimeout, cancel: cancelTimeout } = createIdleTimeout(LLM_TIMEOUT_MS);

    try {
      const formattedMessages = messages.map(m => {
        if (isReasoningModel && m.role === 'system') {
          return { role: 'developer', content: m.content };
        }
        return m;
      });

      const maxTokens = provider === "groq" || isNvidia ? 4096 : 8192;

      const requestPayload: any = {
        model: chosenModel,
        messages: formattedMessages,
        stream: Boolean(onChunk),
      };

      if (isReasoningModel) {
        requestPayload.max_completion_tokens = 8192;
        // Reasoning models reject temperature parameter
      } else {
        requestPayload.temperature = 0.2;
        requestPayload.max_tokens = maxTokens;
      }

      // Only request native JSON output when the caller actually wants JSON.
      // (Previously Groq forced json_object unconditionally, which broke prose
      // reviews and caused 400 bad request errors).
      if (jsonMode && !isReasoningModel) {
        requestPayload.response_format = { type: "json_object" };
      }

      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
      };
      if (isOpenRouter) {
        requestHeaders["HTTP-Referer"] = "https://manuview.app";
        requestHeaders["X-Title"] = "ManuView";
      }

      let response = await fetch(endpoint, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      // 400/422 Fallback: if json_object response_format was rejected by provider, retry without response_format
      if (!response.ok && (response.status === 400 || response.status === 422) && requestPayload.response_format) {
        console.warn(`${provider} rejected response_format: json_object, retrying without response_format...`);
        delete requestPayload.response_format;
        response = await fetch(endpoint, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          errMessage = errJson.detail || errJson.error?.message || errJson.message || errJson.title || errMessage;
        } catch {
          errMessage = (await response.text()) || errMessage;
        }
        const safeErr = sanitizeErrorMessage(errMessage);
        const providerName = customBase && !customBase.includes("api.openai.com") ? "OpenAI Compatible" : provider.toUpperCase();
        console.error(`${providerName} API error:`, response.status, safeErr);
        throw new Error(`${providerName} API error (${response.status}): ${safeErr}`);
      }

      if (onChunk) {
        try {
          const content = await readStream(response, onChunk, extractOpenAIDelta, resetTimeout);
          if (content && content.trim().length > 0) return content;
        } catch (streamErr) {
          console.warn(`${provider} stream failed, attempting resilient non-streaming fallback:`, streamErr);
        }

        // Resilient non-streaming fallback
        const fallbackPayload = { ...requestPayload, stream: false };
        const fallbackRes = await fetch(endpoint, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(fallbackPayload),
          signal: controller.signal,
        });
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          const content = fbData.choices?.[0]?.message?.content;
          if (content && content.trim().length > 0) {
            onChunk(content, content);
            return content;
          }
        }
        throw new Error(`${provider.toUpperCase()} stream returned empty content.`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
      throw new Error(`${provider.toUpperCase()} returned empty completion response.`);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`${provider.toUpperCase()} call timed out after ${LLM_TIMEOUT_MS / 1000}s`);
      }
      const safeMsg = sanitizeErrorMessage(err.message);
      console.error(`${provider} call failed:`, safeMsg);
      throw new Error(`${provider.toUpperCase()} call failed: ${safeMsg}`);
    } finally {
      cancelTimeout();
    }
  }

  // -----------------------------------------------------------
  // 3. Anthropic Claude API
  // -----------------------------------------------------------
  if (provider === "anthropic" && apiKey) {
    const { controller, reset: resetTimeout, cancel: cancelTimeout } = createIdleTimeout(LLM_TIMEOUT_MS);
    try {
      const systemMessage = messages.find(m => m.role === 'system')?.content || "";
      const userAssistantMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const isLongSystem = systemMessage && systemMessage.length > 500;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
          model: model || "claude-3-5-sonnet-20241022",
          max_tokens: 8192,
          stream: Boolean(onChunk),
          system: isLongSystem
            ? [
                {
                  type: "text",
                  text: systemMessage,
                  cache_control: { type: "ephemeral" },
                },
              ]
            : systemMessage || undefined,
          messages: userAssistantMessages,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          errMessage = errJson.error?.message || errMessage;
        } catch {
          errMessage = (await response.text()) || errMessage;
        }
        const safeErr = sanitizeErrorMessage(errMessage);
        console.error("Anthropic API error:", response.status, safeErr);
        throw new Error(`Anthropic API error (${response.status}): ${safeErr}`);
      }

      if (onChunk) {
        try {
          const text = await readStream(response, onChunk, extractAnthropicDelta, resetTimeout);
          if (text && text.trim().length > 0) return text;
        } catch (streamErr) {
          console.warn("Anthropic stream failed, attempting resilient non-streaming fallback:", streamErr);
        }

        // Resilient non-streaming fallback
        const fallbackRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey.trim(),
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
          },
          body: JSON.stringify({
            model: (model || "claude-3-5-sonnet-20241022").replace(/^models\//, ""),
            max_tokens: 8192,
            stream: false,
            system: isLongSystem
              ? [
                  {
                    type: "text",
                    text: systemMessage,
                    cache_control: { type: "ephemeral" },
                  },
                ]
              : systemMessage || undefined,
            messages: userAssistantMessages,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          const fbText = fbData.content?.[0]?.text;
          if (fbText && fbText.trim().length > 0) {
            onChunk(fbText, fbText);
            return fbText;
          }
        }
        throw new Error("Anthropic stream returned empty content.");
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (text) return text;
      throw new Error("Anthropic returned empty message response.");
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Anthropic call timed out after ${LLM_TIMEOUT_MS / 1000}s`);
      }
      const safeMsg = sanitizeErrorMessage(err.message);
      console.error("Anthropic call failed:", safeMsg);
      throw new Error(`Anthropic call failed: ${safeMsg}`);
    } finally {
      cancelTimeout();
    }
  }

  // -----------------------------------------------------------
  // 4. Local Ollama (100% Offline & Free)
  // -----------------------------------------------------------
  if (provider === "ollama") {
    const { controller, reset: resetTimeout, cancel: cancelTimeout } = createIdleTimeout(LLM_TIMEOUT_MS);
    try {
      let cleanBase = (baseUrl || "http://localhost:11434").trim();
      if (!cleanBase.startsWith("http://") && !cleanBase.startsWith("https://")) {
        cleanBase = `http://${cleanBase}`;
      }
      cleanBase = cleanBase.replace(/\/+$/, "");

      const requestPayload: any = {
        model: model || getEnv('OLLAMA_MODEL') || "llama3.3",
        messages,
        stream: Boolean(onChunk),
        options: {
          temperature: 0.2,
          num_predict: 8192,
          num_ctx: 16384,
        },
      };
      if (jsonMode) {
        requestPayload.format = "json";
      }

      const response = await fetch(`${cleanBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      if (response.ok) {
        if (onChunk) {
          const content = await readStream(response, onChunk, extractOllamaDelta, resetTimeout);
          return content;
        }
        const data = await response.json();
        return data.message?.content || "";
      }
      throw new Error(`Ollama service returned HTTP ${response.status}`);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Local Ollama service call timed out after ${LLM_TIMEOUT_MS / 1000}s`);
      }
      const safeMsg = sanitizeErrorMessage(err.message);
      throw new Error(`Local Ollama service unreachable at ${baseUrl}: ${safeMsg}`);
    } finally {
      cancelTimeout();
    }
  }

  throw new Error(`Unable to complete AI evaluation. Provider ${provider} is not configured.`);
}



export const CURATED_MODELS: Record<LLMProvider, AvailableModel[]> = {
  gemini: [
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "Google's latest flagship multimodal reasoning model. State-of-the-art academic triage & critique.",
      tag: "✨ Latest Flagship",
      recommended: true,
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      description: "Advanced reasoning with deep contextual understanding for complex empirical research.",
      tag: "🧠 Deep Reasoning",
      recommended: false,
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      description: "Proven lightweight production model with balanced quality and speed.",
      tag: "⚡ Fast & Stable",
      recommended: false,
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      description: "Massive 2M token context window for comprehensive manuscript + supplement analysis.",
      tag: "2M Context",
      recommended: false,
    },
  ],
  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4o (Omni)",
      description: "OpenAI flagship high-intelligence model for nuanced peer-review simulation.",
      tag: "✨ Recommended",
      recommended: true,
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      description: "Fast, cost-efficient model for quick pre-submission screening.",
      tag: "⚡ Fast & Affordable",
      recommended: false,
    },
    {
      id: "o3-mini",
      name: "o3-mini (STEM)",
      description: "Specialized STEM reasoning model for methodology, statistics, and sample power.",
      tag: "🧠 STEM Reasoning",
      recommended: false,
    },
    {
      id: "o1",
      name: "o1 (Full Reasoning)",
      description: "Deep reflective thinking for intricate causal claims and mechanism proofs.",
      tag: "🧠 Deep Thinking",
      recommended: false,
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      description: "Previous generation frontier model with 128k context.",
      tag: "Legacy",
      recommended: false,
    },
  ],
  anthropic: [
    {
      id: "claude-3-7-sonnet-20250219",
      name: "Claude 3.7 Sonnet",
      description: "Anthropic's latest hybrid reasoning model. Exceptional academic critique and editorial voice.",
      tag: "✨ Latest / Recommended",
      recommended: true,
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Renowned standard for scholarly writing, tone, and deep methodological critique.",
      tag: "Editorial Standard",
      recommended: false,
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      description: "Rapid inference for initial sanity checks and fast scans.",
      tag: "⚡ Ultra Fast",
      recommended: false,
    },
    {
      id: "claude-3-opus-20240229",
      name: "Claude 3 Opus",
      description: "Deep synthesis for complex, multidisciplinary manuscripts.",
      tag: "Nuanced",
      recommended: false,
    },
  ],
  groq: [
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B Versatile",
      description: "Meta 70B flagship model on Groq LPUs (~300 tokens/sec). Full peer-review fidelity.",
      tag: "✨ Recommended",
      recommended: true,
    },
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B Instant",
      description: "Blazing fast speed (~800 tokens/sec) for real-time section checks.",
      tag: "⚡ 800 tok/sec",
      recommended: false,
    },
    {
      id: "deepseek-r1-distill-llama-70b",
      name: "DeepSeek R1 Distill 70B",
      description: "Reasoning-distilled model for mathematical proof and control auditing.",
      tag: "🧠 Reasoning",
      recommended: false,
    },
    {
      id: "mixtral-8x7b-32768",
      name: "Mixtral 8x7B MoE",
      description: "Mistral MoE architecture with 32k context window.",
      tag: "MoE",
      recommended: false,
    },
  ],
  mistral: [
    {
      id: "mistral-large-latest",
      name: "Mistral Large (Latest)",
      description: "Mistral flagship model with deep academic reasoning capabilities.",
      tag: "⚡ Recommended",
      recommended: true,
    },
    {
      id: "mistral-small-latest",
      name: "Mistral Small (Latest)",
      description: "Fast, cost-efficient model for rapid manuscript pre-screening.",
      tag: "Fast",
      recommended: false,
    },
    {
      id: "codestral-latest",
      name: "Codestral (Latest)",
      description: "Specialized for computational methods, reproducible code, and data pipelines.",
      tag: "Code / Math",
      recommended: false,
    },
  ],
  ollama: [
    {
      id: "llama3.3",
      name: "Llama 3.3 (Local)",
      description: "Meta Llama 3.3 on local machine. 100% private & offline.",
      tag: "✨ Recommended Local",
      recommended: true,
    },
    {
      id: "deepseek-r1",
      name: "DeepSeek R1 (Local)",
      description: "Local reasoning model for methodology checks.",
      tag: "🧠 Reasoning",
      recommended: false,
    },
    {
      id: "mistral",
      name: "Mistral 7B (Local)",
      description: "Compact and fast local inference.",
      tag: "Fast Local",
      recommended: false,
    },
    {
      id: "phi3",
      name: "Phi-3 (Local)",
      description: "Microsoft Phi-3 lightweight local model.",
      tag: "Compact",
      recommended: false,
    },
  ],
  webllm: [
    {
      id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
      name: "Qwen 2.5 (0.5B Instruct)",
      description: "Smallest, fastest on-device SLM (~380 MB). Runs on WebGPU.",
      tag: "⚡ Recommended / 0.5B",
      recommended: true,
    },
    {
      id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
      name: "Llama 3.2 (1B Instruct)",
      description: "Meta's compact model (~750 MB) with strong academic reasoning.",
      tag: "Balanced / 1B",
      recommended: false,
    },
    {
      id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      name: "Qwen 2.5 (1.5B Instruct)",
      description: "Highest accuracy scientific reasoning in the compact class (~980 MB).",
      tag: "Reasoning / 1.5B",
      recommended: false,
    },
  ],
  laya: [
    {
      id: "laya-system1-int8",
      name: "Laya System 1 v2 (INT8 Quantized, 23 MB)",
      description: "Fast on-device decision model for structured screening & reporting. Shipped with app.",
      tag: "⚡ Fast (Bundled)",
      recommended: true,
      isDownloaded: true,
    },
    {
      id: "laya-system1-fp32",
      name: "Laya System 1 v2 (FP32 Full Precision, 90.6 MB)",
      description: "Full precision on-device decision model for maximum diagnostic fidelity. Shipped with app.",
      tag: "🎯 High Precision",
      recommended: false,
      isDownloaded: true,
    },
  ],
  typesafe: [
    {
      id: "laya-system1-int8",
      name: "Laya System 1 v2 (INT8 Quantized, 23 MB)",
      description: "Fast on-device decision model for structured screening & reporting. Shipped with app.",
      tag: "⚡ Fast (Bundled)",
      recommended: true,
      isDownloaded: true,
    },
    {
      id: "laya-system1-fp32",
      name: "Laya System 1 v2 (FP32 Full Precision, 90.6 MB)",
      description: "Full precision on-device decision model for maximum diagnostic fidelity. Shipped with app.",
      tag: "🎯 High Precision",
      recommended: false,
      isDownloaded: true,
    },
  ],
};

export async function fetchAvailableModels(
  config?: ProviderConfig,
  options?: { throwOnError?: boolean }
): Promise<AvailableModel[]> {
  const serverStatus = getServerConfigStatus();
  const provider: LLMProvider = config?.provider || (serverStatus.activeProvider !== "none" ? serverStatus.activeProvider : "gemini");
  let apiKey = config?.apiKey?.trim() || "";
  let baseUrl = config?.baseUrl?.trim() || "";

  if (!apiKey && provider !== "ollama" && provider !== "webllm") {
    try {
      const secureKey = await getSecureApiKey(provider);
      if (secureKey) {
        apiKey = secureKey;
      }
    } catch (e) {
      console.warn(`Failed to read secure key for ${provider}:`, e);
    }
  }

  if (!apiKey) {
    if (provider === "gemini") apiKey = getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY');
    else if (provider === "groq") apiKey = getEnv('GROQ_API_KEY');
    else if (provider === "openai") apiKey = getEnv('OPENAI_API_KEY');
    else if (provider === "anthropic") apiKey = getEnv('ANTHROPIC_API_KEY');
  }
  if (!baseUrl) {
    if (provider === "openai") baseUrl = getEnv('OPENAI_BASE_URL') || "https://api.openai.com/v1";
    else if (provider === "ollama") baseUrl = getEnv('OLLAMA_BASE_URL') || "http://localhost:11434";
  }

  const defaultList = CURATED_MODELS[provider] || CURATED_MODELS.gemini;

  if (options?.throwOnError && !apiKey && provider !== "ollama" && provider !== "webllm") {
    throw new Error(`Please enter your ${provider.toUpperCase()} API key first.`);
  }

  try {
    if (provider === "gemini" && apiKey) {
      const cleanKey = apiKey.trim();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cleanKey,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          // Compatibility Filter: Only include active, supported generative text/chat models
          // Exclude: deprecated 1.0 models and discontinued 2.0 models that return 404
          // Exclude: embeddings, aqa, imagen, audio/speech, experimental robot models
          const isCompatibleGemini = (id: string) => {
            const lower = id.toLowerCase();
            if (!lower.startsWith("gemini-")) return false;
            if (
              lower.startsWith("gemini-1.0") ||
              lower === "gemini-pro" ||
              lower === "gemini-pro-vision" ||
              lower.startsWith("gemini-2.0")
            ) {
              return false;
            }
            if (
              lower.includes("embedding") ||
              lower.includes("aqa") ||
              lower.includes("imagen") ||
              lower.includes("learnlm") ||
              lower.includes("vision-latest")
            ) {
              return false;
            }
            // Must belong to 1.5, 2.5, or newer 3.x series
            return /gemini-(?:1\.5|2\.5|[3-9]\.\d)/.test(lower);
          };

          const liveModels: AvailableModel[] = data.models
            .filter((m: any) => {
              const id = m.name?.replace(/^models\//, "") || "";
              return isCompatibleGemini(id) && m.supportedGenerationMethods?.includes("generateContent");
            })
            .map((m: any) => {
              const id = m.name.replace(/^models\//, "");
              const existing = defaultList.find((d) => d.id === id);
              const isFlagship = id === "gemini-2.5-flash" || id.includes("3.");
              return {
                id,
                name: m.displayName || existing?.name || id,
                description: existing?.description || m.description || "Google Generative AI Model",
                tag: existing?.tag || (isFlagship ? "✨ Latest Flagship" : id.includes("2.5") ? "✨ Latest" : id.includes("flash") ? "⚡ Fast" : id.includes("pro") ? "🧠 Frontier" : undefined),
                recommended: isFlagship || existing?.recommended || false,
                isLive: true,
              };
            });
          if (liveModels.length > 0) {
            return liveModels.sort((a, b) => {
              if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
              const getWeight = (id: string) => {
                if (id.includes("3.")) return 30;
                if (id.includes("2.5")) return 25;
                if (id.includes("1.5")) return 15;
                return 10;
              };
              const diff = getWeight(b.id) - getWeight(a.id);
              if (diff !== 0) return diff;
              if (a.id.includes("flash") && !b.id.includes("flash")) return -1;
              if (!a.id.includes("flash") && b.id.includes("flash")) return 1;
              return a.name.localeCompare(b.name);
            });
          }
        }
      } else if (options?.throwOnError) {
        let errMessage = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errMessage = errJson.error?.message || errMessage;
        } catch {
          errMessage = (await res.text()) || errMessage;
        }
        throw new Error(`Gemini API error (${res.status}): ${errMessage}`);
      }
    } else if (provider === "openai" && apiKey) {
      let cleanBase = (baseUrl || "").trim();
      const isOfficialOpenAI = !cleanBase || cleanBase.includes("api.openai.com");

      // Optional Base URL fallback if user left it empty:
      if (!cleanBase) {
        if (apiKey.startsWith("nvapi-")) cleanBase = "https://integrate.api.nvidia.com/v1";
        else if (apiKey.startsWith("sk-or-")) cleanBase = "https://openrouter.ai/api/v1";
        else cleanBase = "https://api.openai.com/v1";
      }

      const validated = validateBaseUrl(cleanBase);
      if (!validated.valid) {
        if (options?.throwOnError) {
          throw new Error(validated.error || `Invalid API base URL: ${cleanBase}`);
        }
        cleanBase = "https://api.openai.com/v1";
      } else if (validated.normalized) {
        cleanBase = validated.normalized;
      }
      cleanBase = cleanBase.replace(/\/+$/, "");
      const endpoint = cleanBase.endsWith("/models") ? cleanBase : `${cleanBase}/models`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey.trim()}` };
      if (cleanBase.includes("openrouter.ai") || apiKey.startsWith("sk-or-")) {
        headers["HTTP-Referer"] = "https://manuview.app";
        headers["X-Title"] = "ManuView";
      }
      const res = await fetch(endpoint, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const rawList: any[] = data.data;
          const chatModels = rawList.filter((m: any) => {
            const id = typeof m === "string" ? m : m.id;
            if (!id || typeof id !== "string") return false;
            const lower = id.toLowerCase();
            // Disallow non-generative / specialized endpoints
            if (
              lower.includes("embed") ||
              lower.includes("clip") ||
              lower.includes("reward") ||
              lower.includes("safety-guard") ||
              lower.includes("content-safety") ||
              lower.includes("topic-control") ||
              lower.includes("rerank") ||
              lower.includes("detector") ||
              lower.includes("parse") ||
              lower.includes("calibration") ||
              lower.includes("whisper") ||
              lower.includes("tts") ||
              lower.includes("dall-e") ||
              lower.includes("moderation") ||
              lower.includes("realtime") ||
              lower.includes("audio") ||
              lower.includes("instruct") ||
              lower.startsWith("davinci") ||
              lower.startsWith("babbage")
            ) {
              return false;
            }
            if (isOfficialOpenAI) {
              return lower.startsWith("gpt-4") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("gpt-3.5-turbo");
            }
            return true;
          });

          if (chatModels.length > 0) {
            const mapped: AvailableModel[] = chatModels.map((m: any) => {
              const id = typeof m === "string" ? m : m.id;
              const existing = defaultList.find((d) => d.id === id);
              const name = m.name || existing?.name || id;
              const desc = m.description ? `${m.description.slice(0, 100)}...` : existing?.description || `Model ${id}`;
              const isRecommended = existing?.recommended || id === "gpt-4o" || id.includes("llama-3.3-70b") || id.includes("nemotron-70b");
              return {
                id,
                name,
                description: desc,
                tag: existing?.tag || (id.startsWith("o") ? "🧠 Reasoning" : id.includes("nemotron") ? "⚡ Nemotron" : id.includes("free") ? "🎁 Free" : id.includes("mini") ? "⚡ Fast" : undefined),
                recommended: isRecommended,
                isLive: true,
              };
            });
            return mapped.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
          }
        }
      } else if (options?.throwOnError) {
        let errMessage = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errMessage = errJson.detail || errJson.error?.message || errJson.message || errJson.title || errMessage;
        } catch {
          errMessage = (await res.text()) || errMessage;
        }
        const providerName = isOfficialOpenAI ? "OpenAI" : "OpenAI Compatible";
        throw new Error(`${providerName} API error (${res.status}): ${errMessage}`);
      }
    } else if (provider === "groq" && apiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const isCompatibleGroq = (id: string) => {
            const lower = id.toLowerCase();
            if (lower.includes("whisper") || lower.includes("guard") || lower.includes("vision-preview")) return false;
            if (lower.includes("8192") && lower.startsWith("llama3-")) return false; // Decommissioned Groq llama3
            return true;
          };
          const mapped: AvailableModel[] = data.data
            .filter((m: any) => m.active !== false && isCompatibleGroq(m.id))
            .map((m: any) => {
              const id = m.id;
              const existing = defaultList.find((d) => d.id === id);
              return {
                id,
                name: existing?.name || id,
                description: existing?.description || `Groq LPU accelerated model (${m.owned_by || "Meta"})`,
                tag: existing?.tag || (id.includes("70b") ? "✨ High Quality" : id.includes("8b") ? "⚡ Ultra Fast" : undefined),
                recommended: existing?.recommended || id.includes("llama-3.3-70b"),
                isLive: true,
              };
            });
          if (mapped.length > 0) {
            return mapped.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
          }
        }
      } else if (options?.throwOnError) {
        let errMessage = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errMessage = errJson.error?.message || errJson.message || errMessage;
        } catch {
          errMessage = (await res.text()) || errMessage;
        }
        throw new Error(`Groq API error (${res.status}): ${errMessage}`);
      }
    } else if (provider === "anthropic" && apiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const mapped: AvailableModel[] = data.data.map((m: any) => {
            const id = m.id;
            const existing = defaultList.find((d) => d.id === id);
            return {
              id,
              name: m.display_name || existing?.name || id,
              description: existing?.description || `Anthropic model ${id}`,
              tag: existing?.tag || (id.includes("sonnet") ? "🧠 Frontier" : id.includes("haiku") ? "⚡ Fast" : undefined),
              recommended: existing?.recommended || /3-7-sonnet|3-5-sonnet/.test(id),
              isLive: true,
            };
          });
          if (mapped.length > 0) {
            return mapped.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
          }
        }
      } else if (options?.throwOnError) {
        let errMessage = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errMessage = errJson.error?.message || errMessage;
        } catch {
          errMessage = (await res.text()) || errMessage;
        }
        throw new Error(`Anthropic API error (${res.status}): ${errMessage}`);
      }
    } else if (provider === "ollama") {
      let cleanBase = (baseUrl || "http://localhost:11434").trim();
      if (!cleanBase.startsWith("http://") && !cleanBase.startsWith("https://")) {
        cleanBase = `http://${cleanBase}`;
      }
      cleanBase = cleanBase.replace(/\/+$/, "");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${cleanBase}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          const installed: AvailableModel[] = data.models.map((m: any, idx: number) => ({
            id: m.name,
            name: `${m.name} (Installed)`,
            description: `Locally pulled model (${Math.round(((m.size || 0) / 1024 / 1024 / 1024) * 10) / 10} GB)`,
            tag: idx === 0 ? "✨ Active Local" : "Local",
            recommended: idx === 0,
            isLive: true,
            isDownloaded: true,
          }));
          return installed;
        } else if (options?.throwOnError) {
          throw new Error(`Connected to Ollama, but no local models were found. Run 'ollama pull llama3.3' in your terminal.`);
        }
      } else if (options?.throwOnError) {
        throw new Error(`Ollama server returned HTTP ${res.status}. Check that 'ollama serve' is running.`);
      }
    } else if (provider === "webllm") {
      const { isModelCached, SUPPORTED_LOCAL_MODELS } = await import("./webllm/webllm-service");
      return Promise.all(
        SUPPORTED_LOCAL_MODELS.map(async (m) => {
          let downloaded = false;
          try {
            downloaded = await isModelCached(m.id);
          } catch {
            downloaded = false;
          }
          return {
            id: m.id,
            name: m.name,
            description: `${m.description} (~${m.sizeMB} MB)`,
            tag: downloaded ? "✅ Downloaded" : "📥 Needs Download",
            recommended: Boolean(m.isDefault),
            isLive: true,
            isDownloaded: downloaded,
          };
        })
      );
    } else if (provider === "laya" || provider === "typesafe") {
      try {
        const { listTypeSafeModels } = await import("./typesafe");
        const live = await listTypeSafeModels(apiKey);
        if (Array.isArray(live) && live.length > 0) {
          const mapped: AvailableModel[] = live.map((m) => {
            const existing = defaultList.find((d) => d.id === m.name);
            return {
              id: m.name,
              name: existing?.name || m.name,
              description: existing?.description || m.description || "Laya On-Device Decision Model",
              tag: existing?.tag || (m.name.includes("laya") ? "✨ Recommended" : undefined),
              recommended: existing?.recommended || m.name === "convaiinnovations/laya",
              isLive: true,
            };
          });
          // Keep curated entries the API omitted
          for (const d of defaultList) {
            if (!mapped.some((x) => x.id === d.id)) mapped.push(d);
          }
          return mapped.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
        }
      } catch (tsErr) {
        if (options?.throwOnError) throw tsErr;
      }
      return defaultList;
    }
  } catch (err: any) {
    if (options?.throwOnError) {
      throw err;
    }
  }

  return defaultList;
}

export interface ConnectionTestResult {
  success: boolean;
  provider: LLMProvider;
  model: string;
  latencyMs: number;
  message: string;
  error?: string;
  availableModels: AvailableModel[];
  details?: {
    endpoint?: string;
    statusCode?: number;
  };
}


export async function testLLMConnection(
  config?: ProviderConfig
): Promise<ConnectionTestResult> {
  // 1. Resolve Provider and Credentials
  const serverStatus = getServerConfigStatus();
  let provider: LLMProvider = config?.provider || (serverStatus.activeProvider !== 'none' ? serverStatus.activeProvider : "ollama");
  let apiKey: string = config?.apiKey?.trim() || "";
  let model: string = config?.model?.trim() || "";
  let baseUrl: string = (config?.baseUrl || (provider === 'openai' ? getEnv('OPENAI_BASE_URL') : undefined) || getEnv('OLLAMA_BASE_URL') || "http://localhost:11434").trim();

  // If no apiKey provided, query secure storage first
  if (!apiKey && provider !== "ollama" && provider !== "webllm") {
    try {
      const secureKey = await getSecureApiKey(provider);
      if (secureKey) {
        apiKey = secureKey;
      }
    } catch (e) {
      console.warn(`Failed to read secure key for ${provider}:`, e);
    }
  }

  // If still no apiKey provided, resolve from environment
  if (!apiKey && provider !== "ollama" && provider !== "webllm") {
    if (provider === "gemini") {
      apiKey = getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY');
      model = model || getEnv('GEMINI_MODEL') || "gemini-2.5-flash";
    } else if (provider === "groq") {
      apiKey = getEnv('GROQ_API_KEY');
      model = model || getEnv('GROQ_MODEL') || "llama-3.3-70b-versatile";
    } else if (provider === "openai") {
      apiKey = getEnv('OPENAI_API_KEY');
      model = model || getEnv('OPENAI_MODEL') || "gpt-4o-mini";
      if (!config?.baseUrl && getEnv('OPENAI_BASE_URL')) {
        baseUrl = getEnv('OPENAI_BASE_URL');
      }
    } else if (provider === "anthropic") {
      apiKey = getEnv('ANTHROPIC_API_KEY');
      model = model || getEnv('ANTHROPIC_MODEL') || "claude-3-5-sonnet-20241022";
    } else if (provider === "laya" || provider === "typesafe") {
      const { resolveTypeSafeKey } = await import("./typesafe");
      apiKey = await resolveTypeSafeKey();
      model = model || "laya-system1-int8";
    }
  }

  // On-Device WebGPU SLM (WebLLM)
  if (provider === "webllm") {
    const { isWebGPUSupported, isModelCached, DEFAULT_LOCAL_MODEL } = await import("./webllm/webllm-service");
    const targetModel = model || DEFAULT_LOCAL_MODEL;
    if (!isWebGPUSupported()) {
      return {
        success: false,
        provider: "webllm",
        model: targetModel,
        latencyMs: 0,
        message: "WebGPU is not supported on this device/browser.",
        error: "Hardware acceleration via WebGPU is required for on-device SLMs.",
        availableModels: CURATED_MODELS.webllm,
      };
    }
    const cached = await isModelCached(targetModel);
    const localModels = await fetchAvailableModels({ provider: "webllm", model: targetModel });
    return {
      success: true,
      provider: "webllm",
      model: targetModel,
      latencyMs: 0,
      message: cached ? "Model is cached and ready for offline execution." : "WebGPU supported. Model requires one-time download.",
      availableModels: localModels,
    };
  }

  // If still no API key and provider requires one:
  if (!apiKey && provider !== "ollama") {
    return {
      success: false,
      provider,
      model: model || "unknown",
      latencyMs: 0,
      message: `No API key provided for ${provider.toUpperCase()}`,
      error: `Please provide a valid ${provider.toUpperCase()} API key or configure it in .env.local`,
      availableModels: CURATED_MODELS[provider] || CURATED_MODELS.gemini,
    };
  }

  const startTime = Date.now();
  const timeoutMs = 15000;
  const availableModels = await fetchAvailableModels({ provider, model, apiKey, baseUrl });

  try {
    // -----------------------------------------------------------
    // 0. Laya On-Device Decision Model Probe
    // -----------------------------------------------------------
    if (provider === "laya" || provider === "typesafe") {
      const tsModel = model || "laya-system1-int8";
      const { checkLayaWebGPUSupport } = await import("./laya/laya-service");
      const hasGpu = await checkLayaWebGPUSupport();
      const latencyMs = Math.max(1, Date.now() - startTime);

      return {
        success: true,
        provider: provider,
        model: tsModel,
        latencyMs,
        message: `Laya System 1 v2 Decision Model is built-in & ready for offline execution (${hasGpu ? "WebGPU" : "WASM"}). Zero API dependencies.`,
        availableModels,
      };
    }

    // -----------------------------------------------------------
    // 1. Google Gemini Ping Probe
    // -----------------------------------------------------------
    if (provider === "gemini") {
      let geminiModel = (model || "gemini-2.5-flash").trim();
      if (geminiModel.startsWith("models/")) {
        geminiModel = geminiModel.replace(/^models\//, "");
      }
      // Upgrade discontinued models to latest 2.5 flash
      if (
        geminiModel.startsWith("gemini-2.0") ||
        geminiModel.startsWith("gemini-1.0") ||
        geminiModel === "gemini-pro" ||
        geminiModel === "gemini-pro-vision"
      ) {
        geminiModel = "gemini-2.5-flash";
      }
      // Defensive fallback if a cross-provider model ID was passed
      if (
        geminiModel.includes("convaiinnovations") ||
        geminiModel.includes("laya") ||
        geminiModel.includes("Qwen") ||
        geminiModel.includes("llama") ||
        geminiModel.includes("gpt-") ||
        geminiModel.includes("claude-")
      ) {
        geminiModel = "gemini-2.5-flash";
      }
      const cleanKey = apiKey.trim();
      let cleanModel = encodeURIComponent(geminiModel);
      let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cleanKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 2 },
        }),
        signal: controller.signal,
      });

      // Auto-fallback: If requested model returns 404 (e.g. discontinued model) or 400, test working candidates
      let autoUpgraded = false;
      if (!response.ok && (response.status === 404 || response.status === 400)) {
        const liveFallback = availableModels?.find((m) => m.isLive && m.id !== geminiModel && !m.id.startsWith("gemini-2.0"))?.id;
        const fallbackCandidates = [liveFallback, "gemini-2.5-flash", "gemini-1.5-flash"].filter(Boolean) as string[];

        for (const candidate of fallbackCandidates) {
          if (candidate === geminiModel) continue;
          cleanModel = encodeURIComponent(candidate);
          endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;
          try {
            const fallbackRes = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": cleanKey,
              },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "ping" }] }],
                generationConfig: { maxOutputTokens: 2 },
              }),
              signal: controller.signal,
            });
            if (fallbackRes.ok) {
              response = fallbackRes;
              geminiModel = candidate;
              autoUpgraded = true;
              break;
            }
          } catch {}
        }
      }
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          provider: "gemini",
          model: geminiModel,
          latencyMs,
          message: autoUpgraded
            ? `Connected! Selected model is discontinued. Automatically upgraded to latest working model (${geminiModel}).`
            : `Connected to Google Gemini (${geminiModel}) in ${latencyMs}ms`,
          availableModels,
          details: { statusCode: response.status },
        };
      } else {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          errMessage = errJson.error?.message || errMessage;
        } catch {
          errMessage = await response.text() || errMessage;
        }
        return {
          success: false,
          provider: "gemini",
          model: geminiModel,
          latencyMs,
          message: `Gemini API returned error ${response.status}`,
          error: sanitizeErrorMessage(errMessage),
          availableModels,
          details: { statusCode: response.status },
        };
      }
    }

    // -----------------------------------------------------------
    // 2. OpenAI / Compatible Proxy / Groq Ping Probe
    // -----------------------------------------------------------
    if (provider === "openai" || provider === "groq") {
      let customBase = config?.baseUrl || getEnv('OPENAI_BASE_URL');
      if (!customBase) {
        if (apiKey?.startsWith("nvapi-")) customBase = "https://integrate.api.nvidia.com/v1";
        else if (apiKey?.startsWith("sk-or-")) customBase = "https://openrouter.ai/api/v1";
      }
      const isCustomEndpoint = Boolean(customBase && !customBase.includes("api.openai.com"));

      let chosenModel = model || (provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini");
      if (isCustomEndpoint && (!chosenModel || chosenModel === "gpt-4o-mini" || chosenModel === "gpt-4o")) {
        if (apiKey?.startsWith("nvapi-") || customBase?.includes("nvidia.com")) {
          chosenModel = "nvidia/llama-3.1-nemotron-70b-instruct";
        } else if (apiKey?.startsWith("sk-or-") || customBase?.includes("openrouter.ai")) {
          chosenModel = "openai/gpt-4o-mini";
        }
      }

      let endpoint = "https://api.openai.com/v1/chat/completions";
      if (provider === "groq") {
        endpoint = "https://api.groq.com/openai/v1/chat/completions";
      } else if (customBase) {
        const validated = validateBaseUrl(customBase);
        if (!validated.valid) {
          return {
            success: false,
            provider,
            model: chosenModel,
            latencyMs: Date.now() - startTime,
            message: `Custom base URL rejected: ${validated.error}`,
            error: validated.error,
            availableModels,
          };
        }
        let cleanBase = validated.normalized || customBase.trim().replace(/\/+$/, "");
        endpoint = cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
      };
      if (customBase?.includes("openrouter.ai") || apiKey?.startsWith("sk-or-")) {
        reqHeaders["HTTP-Referer"] = "https://manuview.app";
        reqHeaders["X-Title"] = "ManuView";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          model: chosenModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 2,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;
      const providerLabel = isCustomEndpoint ? "OpenAI Compatible" : provider.toUpperCase();

      if (response.ok) {
        return {
          success: true,
          provider,
          model: chosenModel,
          latencyMs,
          message: `Connected to ${providerLabel} (${chosenModel}) in ${latencyMs}ms`,
          availableModels,
          details: { endpoint, statusCode: response.status },
        };
      } else {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          errMessage = errJson.detail || errJson.error?.message || errJson.message || errJson.title || errMessage;
        } catch {
          errMessage = await response.text() || errMessage;
        }
        return {
          success: false,
          provider,
          model: chosenModel,
          latencyMs,
          message: `${providerLabel} connection failed (${response.status})`,
          error: sanitizeErrorMessage(errMessage),
          availableModels,
          details: { endpoint, statusCode: response.status },
        };
      }
    }

    // -----------------------------------------------------------
    // 3. Anthropic Claude Ping Probe
    // -----------------------------------------------------------
    if (provider === "anthropic") {
      const chosenModel = model || "claude-3-5-sonnet-20241022";
      const endpoint = "https://api.anthropic.com/v1/messages";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: chosenModel,
          max_tokens: 2,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          provider: "anthropic",
          model: chosenModel,
          latencyMs,
          message: `Connected to Anthropic (${chosenModel}) in ${latencyMs}ms`,
          availableModels,
          details: { statusCode: response.status },
        };
      } else {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          errMessage = errJson.error?.message || errMessage;
        } catch {
          errMessage = await response.text() || errMessage;
        }
        return {
          success: false,
          provider: "anthropic",
          model: chosenModel,
          latencyMs,
          message: `Anthropic API returned error ${response.status}`,
          error: sanitizeErrorMessage(errMessage),
          availableModels,
          details: { statusCode: response.status },
        };
      }
    }

    // -----------------------------------------------------------
    // 4. Local Ollama Ping Probe
    // -----------------------------------------------------------
    if (provider === "ollama") {
      let cleanBase = (baseUrl || "http://localhost:11434").trim();
      if (!cleanBase.startsWith("http://") && !cleanBase.startsWith("https://")) {
        cleanBase = `http://${cleanBase}`;
      }
      cleanBase = cleanBase.replace(/\/+$/, "");
      const tagsUrl = `${cleanBase}/api/tags`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(tagsUrl, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        let installedModels: string[] = [];
        try {
          const data = await response.json();
          if (Array.isArray(data.models)) {
            installedModels = data.models.map((m: any) => m.name);
          }
        } catch {}

        const chosenModel = model || "llama3.3";
        const hasModel = installedModels.some(m => m.includes(chosenModel));

        return {
          success: true,
          provider: "ollama",
          model: chosenModel,
          latencyMs,
          message: hasModel
            ? `Local Ollama is active with ${chosenModel} (${latencyMs}ms)`
            : `Local Ollama is reachable (${latencyMs}ms). ${installedModels.length} models installed.`,
          availableModels,
          details: { endpoint: cleanBase, statusCode: response.status },
        };
      } else {
        return {
          success: false,
          provider: "ollama",
          model: model || "llama3.3",
          latencyMs,
          message: `Ollama service returned status ${response.status}`,
          error: sanitizeErrorMessage(`Ollama at ${cleanBase} responded with status ${response.status}`),
          availableModels,
        };
      }
    }

    return {
      success: false,
      provider,
      model: model || "unknown",
      latencyMs: 0,
      message: `Unsupported provider: ${provider}`,
      error: `Unknown provider ${provider}`,
      availableModels: CURATED_MODELS[provider] || CURATED_MODELS.gemini,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === "AbortError" || err.message?.includes("abort");

    return {
      success: false,
      provider,
      model: model || "unknown",
      latencyMs,
      message: isTimeout ? `Connection timed out after ${timeoutMs / 1000}s` : `Connection failed`,
      error: isTimeout
        ? `Request timed out. Ensure the endpoint and network are reachable.`
        : sanitizeErrorMessage(err.message || "Network error: Unable to reach the API server."),
      availableModels: CURATED_MODELS[provider] || CURATED_MODELS.gemini,
    };
  }
}

