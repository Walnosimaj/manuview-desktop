"use client";

import React, { useState, useEffect, useRef } from "react";
import { ProviderConfig, LLMProvider, AvailableModel } from "@/lib/types";
import {
  fetchAvailableModels,
  testLLMConnection,
  validateBaseUrl,
} from "@/lib/llm";
import {
  saveSecureApiKey,
  getSecureApiKey,
  hasSecureApiKey,
  deleteSecureApiKey,
  maskApiKey,
} from "@/lib/secureStorage";
import { isModelCached, SUPPORTED_LOCAL_MODELS } from "@/lib/webllm/webllm-service";
import {
  LAYA_MODEL,
  subscribeToLayaStatus,
  getLayaStatus,
  isLayaCached,
  type LayaProgress,
} from "@/lib/laya/laya-service";
import {
  LAYA_MODEL_VARIANTS,
  getSelectedLayaModelVariant,
  setSelectedLayaModelVariant,
  type LayaModelVariant,
} from "@/lib/laya/laya-model-registry";
import { isDesktopApp, isMacOS } from "@/lib/desktop";
import { Settings, ShieldCheck, X, CheckCircle2, Activity, RefreshCw, AlertCircle, Zap, Check, ChevronDown, Sparkles, Search, KeyRound, Cpu, Download, Loader2, Info } from "lucide-react";
import { GeminiLogo, OpenAILogo, GroqLogo, AnthropicLogo, OllamaLogo, LayaLogo } from "./BrandLogos";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (config: ProviderConfig) => void;
  onOpenLocalModel?: () => void;
  isScanning?: boolean;
}

export const DEFAULT_CONFIG: ProviderConfig = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  baseUrl: "http://localhost:11434",
  apiKey: "",
};

export function ProviderSettingsModal({ isOpen, onClose, onSave, onOpenLocalModel, isScanning = false }: Props) {
  const [config, setConfig] = useState<ProviderConfig>(DEFAULT_CONFIG);
  const [providerCategory, setProviderCategory] = useState<"local" | "cloud">("local");
  const [cachedModels, setCachedModels] = useState<Record<string, boolean>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [hasFetchedLive, setHasFetchedLive] = useState(false);
  const [fetchFeedback, setFetchFeedback] = useState<{
    type: "success" | "error";
    message: string;
    count?: number;
  } | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    provider: string;
    model: string;
    latencyMs: number;
    message: string;
    error?: string;
  } | null>(null);
  const [hasSecureKey, setHasSecureKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isKeyDirty, setIsKeyDirty] = useState(false);
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null);

  const [layaCached, setLayaCached] = useState<boolean>(false);
  const [layaStatus, setLayaStatus] = useState<LayaProgress>(getLayaStatus());

  useEffect(() => {
    const unsub = subscribeToLayaStatus((prog) => setLayaStatus(prog));
    return unsub;
  }, []);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      isLayaCached().then((c) => active && setLayaCached(c));
    }
    return () => {
      active = false;
    };
  }, [isOpen, layaStatus.state, config.provider]);

  useEffect(() => {
    // Check browser local storage
    const saved = localStorage.getItem("manuview_provider_config");
    let currentConfig = DEFAULT_CONFIG;
    if (saved) {
      try {
        currentConfig = JSON.parse(saved);
        delete (currentConfig as any).apiKey;
        setConfig(currentConfig);
      } catch {}
    }

    setTestResult(null);
    setFetchFeedback(null);
    setHasFetchedLive(false);
    setApiKeyInput("");
    setIsKeyDirty(false);
    setBaseUrlError(null);
    const isLocal =
      currentConfig.provider === "laya" ||
      currentConfig.provider === "typesafe" ||
      currentConfig.provider === "webllm" ||
      currentConfig.provider === "ollama";
    setProviderCategory(isLocal ? "local" : "cloud");

    hasSecureApiKey(currentConfig.provider).then(setHasSecureKey);

    // Fetch models for current provider
    loadModelsForProvider(currentConfig);
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadModelsForProvider = async (targetConfig: ProviderConfig) => {
    setLoadingModels(true);
    try {
      if (targetConfig.provider === "webllm") {
        const cacheStatus: Record<string, boolean> = {};
        for (const m of SUPPORTED_LOCAL_MODELS) {
          try {
            cacheStatus[m.id] = await isModelCached(m.id);
          } catch {
            cacheStatus[m.id] = false;
          }
        }
        setCachedModels(cacheStatus);
      }

      const models = await fetchAvailableModels(targetConfig);
      if (Array.isArray(models) && models.length > 0) {
        setAvailableModels(models);
        if (models.some((m) => m.isLive)) {
          setHasFetchedLive(true);
        }
        // Self-heal model if current model is empty or invalid for the target provider
        setConfig((prev) => {
          if (prev.provider !== targetConfig.provider) return prev;
          const currentValid = models.some((m) => m.id === prev.model);
          if (!prev.model || !currentValid) {
            const rec = models.find((m: AvailableModel) => m.recommended) || models[0];
            return { ...prev, model: rec.id };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load models for provider:", err);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleFetchModels = async () => {
    let effectiveKey = isKeyDirty ? apiKeyInput.trim() : (await getSecureApiKey(config.provider)) || config.apiKey?.trim() || "";
    if (!effectiveKey && config.provider !== "ollama" && config.provider !== "webllm") {
      setFetchFeedback({
        type: "error",
        message: `Please enter your ${config.provider.toUpperCase()} API key first.`,
      });
      return;
    }

    if (isKeyDirty && apiKeyInput.trim()) {
      await saveSecureApiKey(config.provider, apiKeyInput.trim());
      setHasSecureKey(true);
      setIsKeyDirty(false);
    }

    setFetchingModels(true);
    setFetchFeedback(null);
    try {
      const targetConfig = { ...config, apiKey: effectiveKey };
      const models = await fetchAvailableModels(targetConfig, { throwOnError: true });
      if (Array.isArray(models) && models.length > 0) {
        setAvailableModels(models);
        setHasFetchedLive(true);
        setFetchFeedback({
          type: "success",
          message: `Successfully retrieved ${models.length} authorized models from ${config.provider.toUpperCase()}! Select a model below.`,
          count: models.length,
        });

        // If current model is not in the live list, pick the recommended or first
        const exists = models.some((m) => m.id === config.model);
        const resolvedModel = exists ? config.model : (models.find((m: AvailableModel) => m.recommended) || models[0]).id;
        const updatedConfig = { ...config, model: resolvedModel };
        delete (updatedConfig as any).apiKey;
        setConfig(updatedConfig);
        try {
          localStorage.setItem("manuview_provider_config", JSON.stringify(updatedConfig));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("manuview_config_changed"));
          }
          if (onSave) onSave(updatedConfig);
        } catch {}

        // Open the dropdown so the user can easily review the fetched models
        setModelDropdownOpen(true);
      } else {
        setFetchFeedback({
          type: "error",
          message: `No models returned from ${config.provider.toUpperCase()}.`,
        });
      }
    } catch (err: any) {
      setFetchFeedback({
        type: "error",
        message: err.message || `Failed to fetch models from ${config.provider.toUpperCase()}. Please check your API key.`,
      });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleProviderChange = (newProvider: LLMProvider) => {
    const defaultModel =
      newProvider === "gemini"
        ? "gemini-2.5-flash"
        : newProvider === "openai"
        ? "gpt-4o"
        : newProvider === "anthropic"
        ? "claude-3-7-sonnet-20250219"
        : newProvider === "groq"
        ? "llama-3.3-70b-versatile"
        : newProvider === "laya" || newProvider === "typesafe"
        ? "laya-system1-int8"
        : newProvider === "webllm"
        ? "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"
        : "llama3.3";

    const updated = {
      ...config,
      provider: newProvider,
      model: defaultModel,
    };
    delete (updated as any).apiKey;
    setConfig(updated);
    const isLocal =
      newProvider === "laya" ||
      newProvider === "typesafe" ||
      newProvider === "webllm" ||
      newProvider === "ollama";
    setProviderCategory(isLocal ? "local" : "cloud");
    setTestResult(null);
    setFetchFeedback(null);
    setHasFetchedLive(false);
    setApiKeyInput("");
    setIsKeyDirty(false);
    setBaseUrlError(null);
    hasSecureApiKey(newProvider).then(setHasSecureKey);
    loadModelsForProvider(updated);
  };

  const handleCheckConnection = async () => {
    if (config.provider === "openai" && config.baseUrl) {
      const urlCheck = validateBaseUrl(config.baseUrl);
      if (!urlCheck.valid) {
        setBaseUrlError(urlCheck.error || "Insecure Base URL");
        setTestResult({
          success: false,
          provider: config.provider,
          model: config.model,
          latencyMs: 0,
          message: "Validation Error",
          error: urlCheck.error,
        });
        return;
      }
    }

    let effectiveKey = isKeyDirty ? apiKeyInput.trim() : (await getSecureApiKey(config.provider)) || config.apiKey?.trim() || "";
    if (isKeyDirty && apiKeyInput.trim()) {
      await saveSecureApiKey(config.provider, apiKeyInput.trim());
      setHasSecureKey(true);
      setIsKeyDirty(false);
    }

    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLLMConnection({ ...config, apiKey: effectiveKey });
      setTestResult(result);
      if (config.provider === "webllm") {
        const cacheStatus: Record<string, boolean> = {};
        for (const m of SUPPORTED_LOCAL_MODELS) {
          try {
            cacheStatus[m.id] = await isModelCached(m.id);
          } catch {
            cacheStatus[m.id] = false;
          }
        }
        setCachedModels(cacheStatus);
      }
      if (Array.isArray(result.availableModels) && result.availableModels.length > 0) {
        setAvailableModels(result.availableModels);
        if (result.availableModels.some((m: AvailableModel) => m.isLive)) {
          setHasFetchedLive(true);
        }
      }
      if (result.success) {
        const verifiedConfig: ProviderConfig = {
          ...config,
          model: result.model || config.model,
        };
        delete (verifiedConfig as any).apiKey;
        setConfig(verifiedConfig);
        try {
          localStorage.setItem("manuview_provider_config", JSON.stringify(verifiedConfig));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("manuview_config_changed"));
          }
          if (onSave) onSave(verifiedConfig);
        } catch {}
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        provider: config.provider,
        model: config.model,
        latencyMs: 0,
        message: "Connection failed",
        error: err.message || "Failed to reach diagnostic test server",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (config.provider === "openai" && config.baseUrl) {
      const urlCheck = validateBaseUrl(config.baseUrl);
      if (!urlCheck.valid) {
        setBaseUrlError(urlCheck.error || "Insecure Base URL");
        return;
      }
    }

    if (isKeyDirty && apiKeyInput.trim()) {
      await saveSecureApiKey(config.provider, apiKeyInput.trim());
      setHasSecureKey(true);
      setIsKeyDirty(false);
      setApiKeyInput("");
    }

    const sanitizedConfig: ProviderConfig = {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
    };
    delete (sanitizedConfig as any).apiKey;

    localStorage.setItem("manuview_provider_config", JSON.stringify(sanitizedConfig));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("manuview_config_changed"));
    }
    if (onSave) onSave(sanitizedConfig);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-4 overflow-y-auto cursor-default"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-3xl liquid-glass-modal p-6 sm:p-7 text-[#2F3437] dark:text-neutral-200 my-6 max-h-[90vh] overflow-y-auto cursor-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] rounded-md transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="text-2xl select-none">⚙️</div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-[#2F3437] dark:text-white">
              AI Diagnostic Engine &amp; Models
            </h3>
            <p className="text-xs text-[#787774] dark:text-neutral-400 mt-0.5">
              Select your LLM provider, verify the connection, and pick verified diagnostic models.
            </p>
          </div>
        </div>

        {isScanning && (
          <div className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="font-semibold">Review Scan in Progress</div>
              <div className="text-[11px] text-amber-700 dark:text-amber-300">
                A manuscript scan is actively running in the background. Changing providers, keys, or models is locked until it finishes.
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {/* 1. Provider Selection Grid with Local & Offline vs Cloud AI (BYOK) Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-neutral-400">
                1. Select AI Provider
              </label>
              <span className="text-[10px] text-neutral-400 font-medium">
                {providerCategory === "local"
                  ? "On-Device & Local Execution (Zero API)"
                  : "Bring Your Own Key (BYOK Cloud)"}
              </span>
            </div>

            {/* Category Tabs: Local & Offline vs Cloud AI (BYOK) */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/5 dark:border-white/5 mb-3">
              <button
                type="button"
                onClick={() => {
                  setProviderCategory("local");
                  if (
                    config.provider !== "laya" &&
                    config.provider !== "typesafe" &&
                    config.provider !== "webllm" &&
                    config.provider !== "ollama"
                  ) {
                    handleProviderChange("laya");
                  }
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${
                  providerCategory === "local"
                    ? "bg-white dark:bg-[#1E293B] text-neutral-900 dark:text-white shadow-xs border border-black/5 dark:border-white/10"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="truncate">Local &amp; Offline</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProviderCategory("cloud");
                  if (
                    config.provider === "laya" ||
                    config.provider === "typesafe" ||
                    config.provider === "webllm" ||
                    config.provider === "ollama"
                  ) {
                    handleProviderChange("gemini");
                  }
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${
                  providerCategory === "cloud"
                    ? "bg-white dark:bg-[#1E293B] text-neutral-900 dark:text-white shadow-xs border border-black/5 dark:border-white/10"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Cloud AI (BYOK)</span>
              </button>
            </div>

            {/* Provider Grid */}
            {providerCategory === "local" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Laya */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => handleProviderChange("laya")}
                    title="ModernBERT 421M • Fast Diagnostic Scan • 100% On-Device & Zero API"
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      config.provider === "laya" || config.provider === "typesafe"
                        ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/50 text-neutral-900 dark:text-white shadow-2xs"
                        : "bg-white dark:bg-[#161F30] border-[#EBEBEA] dark:border-[#334155] hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white"
                    }`}
                  >
                    <span className="p-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                      <LayaLogo className="w-3.5 h-3.5" />
                    </span>
                    <span>Laya</span>
                  </button>

                  {/* Information Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-white text-[11px] shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed text-center border border-white/10">
                    <div className="font-semibold text-white">Laya Decision Model</div>
                    <div className="text-neutral-300 text-[10px] mt-0.5">
                      ModernBERT 421M &bull; Fast Diagnostic Scan &bull; 100% On-Device &bull; Zero API
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-800" />
                  </div>
                </div>

                {/* 2. Local SLM */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => handleProviderChange("webllm")}
                    title="On-device Qwen / Llama via WebGPU • Zero External API • Private"
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      config.provider === "webllm"
                        ? "bg-purple-500/10 border-purple-500 ring-1 ring-purple-500/50 text-neutral-900 dark:text-white shadow-2xs"
                        : "bg-white dark:bg-[#161F30] border-[#EBEBEA] dark:border-[#334155] hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white"
                    }`}
                  >
                    <span className="p-1 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
                      <Cpu className="w-3.5 h-3.5" />
                    </span>
                    <span>Local SLM</span>
                  </button>

                  {/* Information Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-white text-[11px] shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed text-center border border-white/10">
                    <div className="font-semibold text-white">Local SLM (WebGPU)</div>
                    <div className="text-neutral-300 text-[10px] mt-0.5">
                      On-device Qwen / Llama &bull; Hardware Accelerated &bull; Zero External API
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-800" />
                  </div>
                </div>

                {/* 3. Ollama */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => handleProviderChange("ollama")}
                    title="Local server (localhost:11434) • Self-hosted custom models"
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      config.provider === "ollama"
                        ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/50 text-neutral-900 dark:text-white shadow-2xs"
                        : "bg-white dark:bg-[#161F30] border-[#EBEBEA] dark:border-[#334155] hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white"
                    }`}
                  >
                    <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <OllamaLogo className="w-3.5 h-3.5" />
                    </span>
                    <span>Ollama</span>
                  </button>

                  {/* Information Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-white text-[11px] shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed text-center border border-white/10">
                    <div className="font-semibold text-white">Ollama (Self-Hosted)</div>
                    <div className="text-neutral-300 text-[10px] mt-0.5">
                      Local Server &bull; http://localhost:11434 &bull; Custom self-hosted models
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-800" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Gemini */}
                <button
                  type="button"
                  onClick={() => handleProviderChange("gemini")}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    config.provider === "gemini"
                      ? "bg-[#F7F7F5] dark:bg-[#1E293B] border-[#2F3437] dark:border-blue-500 ring-1 ring-[#2F3437] dark:ring-blue-500 text-[#2F3437] dark:text-white shadow-2xs"
                      : "bg-white dark:bg-[#161F30] border-[#EBEBEA] dark:border-[#334155] hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white"
                  }`}
                >
                  <GeminiLogo className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Gemini</span>
                </button>

                {/* ChatGPT */}
                <button
                  type="button"
                  onClick={() => handleProviderChange("openai")}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    config.provider === "openai"
                      ? "bg-[#F7F7F5] dark:bg-[#1E293B] border-[#2F3437] dark:border-blue-500 ring-1 ring-[#2F3437] dark:ring-blue-500 text-[#2F3437] dark:text-white shadow-2xs"
                      : "bg-white dark:bg-[#161F30] border-[#EBEBEA] dark:border-[#334155] hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white"
                  }`}
                >
                  <div className="p-0.5 rounded bg-[#000000] text-white flex items-center justify-center flex-shrink-0">
                    <OpenAILogo className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span>ChatGPT</span>
                </button>

                {/* Claude */}
                <button
                  type="button"
                  onClick={() => handleProviderChange("anthropic")}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    config.provider === "anthropic"
                      ? "bg-[#F7F7F5] dark:bg-[#1E293B] border-[#2F3437] dark:border-blue-500 ring-1 ring-[#2F3437] dark:ring-blue-500 text-[#2F3437] dark:text-white shadow-2xs"
                      : "bg-white dark:bg-[#161F30] border-[#EBEBEA] dark:border-[#334155] hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white"
                  }`}
                >
                  <AnthropicLogo className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Claude</span>
                </button>

                {/* Groq */}
                <button
                  type="button"
                  onClick={() => handleProviderChange("groq")}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    config.provider === "groq"
                      ? "bg-[#F7F7F5] dark:bg-[#1E293B] border-[#2F3437] dark:border-blue-500 ring-1 ring-[#2F3437] dark:ring-blue-500 text-[#2F3437] dark:text-white shadow-2xs"
                      : "bg-white dark:bg-[#161F30] border-[#EBEBEA] dark:border-[#334155] hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white"
                  }`}
                >
                  <GroqLogo className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Groq</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Provider Configuration & Authentication */}
          {config.provider === "laya" || config.provider === "typesafe" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-neutral-400">
                  2. Laya Decision Model (Bundled with App)
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Built-in &amp; Ready (100% Offline)
                </span>
              </div>

              {/* Model Variant Selector */}
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 space-y-3">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-blue-500" />
                    <span>Active Decision Model Variant</span>
                  </span>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Both trained Laya models ship directly with ManuView Desktop. No download or internet required.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {LAYA_MODEL_VARIANTS.map((variant) => {
                    const isSelected = config.model === variant.id || (!config.model && variant.id === "laya-system1-int8");
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedLayaModelVariant(variant.id);
                          setConfig({ ...config, model: variant.id });
                          setTestResult(null);
                        }}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer relative ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/50 text-neutral-900 dark:text-white shadow-2xs"
                            : "bg-white dark:bg-[#161F30] border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white">
                            {variant.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                            {variant.size}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                          {variant.description}
                        </p>
                        {isSelected && (
                          <div className="mt-2 text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Active Variant</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 gap-2">
                  <span>Architecture: ModernBERT-large (421M params)</span>
                  <span className="font-mono text-[10px] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
                    ONNX Runtime (WASM / WebGPU)
                  </span>
                </div>
              </div>
            </div>
          ) : config.provider === "webllm" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-neutral-400">
                  2. WebGPU On-Device Execution
                </label>
                {onOpenLocalModel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLocalModel();
                    }}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Manage Local Models</span>
                  </button>
                )}
              </div>
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>Hardware Accelerated GPU Execution</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300">
                      Zero External API
                    </span>
                    {isDesktopApp() && isMacOS() && (
                      <div className="relative group/macos inline-flex items-center">
                        <button
                          type="button"
                          className="p-0.5 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 transition cursor-help flex items-center justify-center"
                          title="macOS Notice: Webview limits WebGPU buffers. For peak performance, Ollama is recommended."
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-white text-[11px] shadow-xl pointer-events-none opacity-0 group-hover/macos:opacity-100 transition-opacity z-50 leading-relaxed text-left border border-white/10">
                          <div className="font-semibold text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            macOS Desktop Notice
                          </div>
                          <div className="text-neutral-300 text-[10px] mt-1">
                            Webview limits WebGPU buffers. For peak performance, <strong>Ollama</strong> is recommended.
                          </div>
                          <div className="absolute top-full right-2.5 -mt-1 border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-800" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  Small Language Models execute strictly on your local GPU via WebGPU. Completely confidential and offline.
                </p>
              </div>
            </div>
          ) : config.provider !== "ollama" ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-neutral-400">
                  2. {config.provider === "openai" ? "API Key" : `${config.provider === "gemini" ? "Google" : config.provider.toUpperCase()} API Key`}
                </label>
                {config.provider === "openai" && (
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#78510E] dark:text-amber-400 hover:underline font-medium"
                  >
                    Get OpenAI key &rarr;
                  </a>
                )}
                {config.provider === "gemini" && (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#0A85EA] dark:text-blue-400 hover:underline font-medium"
                  >
                    Get free Google key &rarr;
                  </a>
                )}
                {config.provider === "groq" && (
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#78510E] dark:text-amber-400 hover:underline font-medium"
                  >
                    Get free Groq key &rarr;
                  </a>
                )}
                {config.provider === "anthropic" && (
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#78510E] dark:text-amber-400 hover:underline font-medium"
                  >
                    Get Anthropic key &rarr;
                  </a>
                )}
              </div>

              {/* API Key Input and Fetch Models Button in the SAME LINE */}
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setIsKeyDirty(true);
                    setFetchFeedback(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFetchModels();
                    }
                  }}
                  placeholder={
                    hasSecureKey && !isKeyDirty
                      ? "•••••••• (Stored securely in OS Keychain)"
                      : config.provider === "gemini"
                      ? "AIzaSy..."
                      : config.provider === "anthropic"
                      ? "sk-ant-..."
                      : "Enter your API key..."
                  }
                  className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EBEBEA] dark:border-[#334155] focus:border-[#2F3437] dark:focus:border-blue-500 focus:outline-none text-xs text-[#2F3437] dark:text-white font-mono transition shadow-2xs placeholder:text-[#9B9A97] dark:placeholder:text-neutral-500"
                />

                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={fetchingModels || (!apiKeyInput.trim() && !hasSecureKey)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#2F3437] dark:bg-blue-600 text-white hover:bg-black dark:hover:bg-blue-500 disabled:bg-[#F7F7F5] dark:disabled:bg-[#1E293B] disabled:text-[#9B9A97] dark:disabled:text-neutral-600 disabled:border-[#EBEBEA] dark:disabled:border-[#334155] border border-[#2F3437] dark:border-blue-600 transition shadow-xs cursor-pointer disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                  title="Fetch verified models authorized for this API key"
                >
                  {fetchingModels ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-white/90 shrink-0" />
                      <span>Fetch Models</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between mt-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-[#787774] dark:text-neutral-400">
                    {hasSecureKey ? "Stored securely in native OS Keychain" : "Keys are persisted to the native OS Keychain."}
                  </span>
                  {hasSecureKey && !isKeyDirty && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteSecureApiKey(config.provider);
                        setHasSecureKey(false);
                        setApiKeyInput("");
                        setIsKeyDirty(false);
                      }}
                      className="text-red-500 hover:underline cursor-pointer"
                    >
                      Clear key
                    </button>
                  )}
                </div>
                {hasFetchedLive && (
                  <span className="text-[#1E5A2A] dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#1E5A2A] dark:text-emerald-400" />
                    {availableModels.length} models loaded
                  </span>
                )}
              </div>

              {config.provider === "openai" && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-[#2F3437] dark:text-white mb-1">
                    API Base URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={config.baseUrl || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig({ ...config, baseUrl: val });
                      setFetchFeedback(null);
                      if (val.trim()) {
                        const check = validateBaseUrl(val);
                        setBaseUrlError(check.valid ? null : (check.error || "Insecure Base URL"));
                      } else {
                        setBaseUrlError(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleFetchModels();
                      }
                    }}
                    placeholder="https://api.openai.com/v1 (leave blank for official OpenAI)"
                    className={`w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E293B] border ${
                      baseUrlError ? "border-red-500 dark:border-red-500" : "border-[#EBEBEA] dark:border-[#334155]"
                    } focus:border-[#2F3437] dark:focus:border-blue-500 focus:outline-none text-xs text-[#2F3437] dark:text-white font-mono transition shadow-2xs placeholder:text-[#9B9A97] dark:placeholder:text-neutral-500`}
                  />
                  <p className="text-[11px] text-[#787774] dark:text-neutral-400 mt-1">
                    Optional. Leave blank for official OpenAI, or provide a custom base URL for any OpenAI-compatible provider.
                  </p>
                  {baseUrlError && (
                    <p className="text-red-500 dark:text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{baseUrlError}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-neutral-400 mb-1.5">
                2. Local Ollama Server URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={config.baseUrl || "http://localhost:11434"}
                  onChange={(e) => {
                    setConfig({ ...config, baseUrl: e.target.value });
                    setFetchFeedback(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFetchModels();
                    }
                  }}
                  className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EBEBEA] dark:border-[#334155] focus:border-[#2F3437] dark:focus:border-blue-500 focus:outline-none text-xs text-[#2F3437] dark:text-white font-mono transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#2F3437] dark:bg-blue-600 text-white hover:bg-black dark:hover:bg-blue-500 disabled:bg-[#F7F7F5] dark:disabled:bg-[#1E293B] disabled:text-[#9B9A97] dark:disabled:text-neutral-600 disabled:border-[#EBEBEA] dark:disabled:border-[#334155] border border-[#2F3437] dark:border-blue-600 transition shadow-xs cursor-pointer disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                  title="Fetch local models installed in Ollama"
                >
                  {fetchingModels ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-white/90 shrink-0" />
                      <span>Fetch Models</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px]">
                <span className="text-[#787774] dark:text-neutral-400">
                  Ensure <code className="text-[#1E5A2A] dark:text-emerald-400 font-semibold">ollama serve</code> is running.
                </span>
                {hasFetchedLive && (
                  <span className="text-[#1E5A2A] dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#1E5A2A] dark:text-emerald-400" />
                    {availableModels.length} local models
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Fetch Status / Error Feedback Banner */}
          {fetchFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                fetchFeedback.type === "success"
                  ? "bg-[#EDF6EE] dark:bg-emerald-950/40 border-[#CBE7CE] dark:border-emerald-800 text-[#1E5A2A] dark:text-emerald-300"
                  : "bg-[#FDF0EF] dark:bg-rose-950/40 border-[#F7CECC] dark:border-rose-800 text-[#7C2D2B] dark:text-rose-300"
              }`}
            >
              {fetchFeedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-[#1E5A2A] dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#7C2D2B] dark:text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium leading-relaxed">
                {fetchFeedback.message}
              </div>
              <button
                type="button"
                onClick={() => setFetchFeedback(null)}
                className="text-[#787774] dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 3. Available Models Picker (Dropdown Selector) */}
          {config.provider !== "laya" && config.provider !== "typesafe" && (
            <div ref={dropdownRef} className="relative z-20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#787774] dark:text-neutral-400">
                  3. Select Model
                </label>
                {hasFetchedLive ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EDF6EE] dark:bg-emerald-950/40 border border-[#CBE7CE] dark:border-emerald-800 text-[#1E5A2A] dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3 text-[#1E5A2A] dark:text-emerald-400" />
                    {availableModels.length} Live Models
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#EBEBEA] dark:border-[#334155] text-[#787774] dark:text-neutral-400 font-medium">
                    {availableModels.length} available
                  </span>
                )}
                {fetchingModels && (
                  <RefreshCw className="w-3 h-3 text-[#787774] dark:text-neutral-400 animate-spin ml-1" />
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCustomInput(!showCustomInput);
                  setModelDropdownOpen(false);
                }}
                className="text-[11px] text-[#0A85EA] dark:text-blue-400 hover:underline font-medium cursor-pointer"
              >
                {showCustomInput ? "Show Model List" : "Manual Model ID"}
              </button>
            </div>

            {/* If user toggles custom input */}
            {showCustomInput ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => {
                    setConfig({ ...config, model: e.target.value });
                    setTestResult(null);
                    setFetchFeedback(null);
                  }}
                  placeholder="e.g. gemini-2.5-flash or custom-model-id"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EBEBEA] dark:border-[#334155] focus:border-[#2F3437] dark:focus:border-blue-500 focus:outline-none text-xs text-[#2F3437] dark:text-white font-mono transition shadow-2xs"
                />
                <p className="text-[11px] text-[#787774] dark:text-neutral-400">
                  Enter any model ID supported by your endpoint.
                </p>
              </div>
            ) : (
              /* Dropdown Trigger & Populated Models Menu */
              <div className="relative">
                {/* Dropdown Trigger Button */}
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="w-full text-left p-3 rounded-xl bg-white dark:bg-[#161F30] hover:bg-[#F7F7F5] dark:hover:bg-[#1E293B] border border-[#EBEBEA] dark:border-[#334155] hover:border-[#D0D0CE] dark:hover:border-[#475569] transition flex items-center justify-between gap-2 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0075eb]/20"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#2F3437] dark:text-white">
                        {config.model || "Select a model..."}
                      </span>
                      {config.provider === "webllm" && (
                        cachedModels[config.model] ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Downloaded &amp; Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Download className="w-3 h-3" /> Not Downloaded
                          </span>
                        )
                      )}
                      {(() => {
                        const cur = availableModels.find((m) => m.id === config.model);
                        if (cur?.tag && config.provider !== "webllm") {
                          return (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.2 rounded-md border ${
                                cur.recommended
                                  ? "bg-[#EBF3FB] dark:bg-blue-950/40 text-[#18569C] dark:text-blue-300 border-[#CDE1F8] dark:border-blue-800"
                                  : cur.tag.includes("Fast") || cur.tag.includes("Instant")
                                  ? "bg-[#EDF6EE] dark:bg-emerald-950/40 text-[#1E5A2A] dark:text-emerald-300 border-[#CBE7CE] dark:border-emerald-800"
                                  : cur.tag.includes("Reasoning") || cur.tag.includes("Frontier")
                                  ? "bg-[#F6F3F9] dark:bg-purple-950/40 text-[#57338C] dark:text-purple-300 border-[#DFD5F5] dark:border-purple-800"
                                  : "bg-[#FBF3DB] dark:bg-amber-950/40 text-[#78510E] dark:text-amber-300 border-[#F4E2B6] dark:border-amber-800"
                              }`}
                            >
                              {cur.tag}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-[11px] text-[#787774] dark:text-neutral-400 truncate mt-0.5">
                      {availableModels.find((m) => m.id === config.model)?.description ||
                        "Click to view and choose from available models"}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#787774] dark:text-neutral-400 flex-shrink-0 transition-transform ${
                      modelDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Populated Dropdown Menu */}
                {modelDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-full rounded-2xl bg-white dark:bg-[#111827] border border-[#EBEBEA] dark:border-[#1F2937] shadow-2xl p-2 z-50 text-xs animate-fadeIn">
                    {/* Search inside dropdown */}
                    <div className="relative mb-2 px-1">
                      <input
                        type="text"
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder={`Search ${availableModels.length} models...`}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#EBEBEA] dark:border-[#334155] text-xs text-[#2F3437] dark:text-white placeholder-[#9B9A97] dark:placeholder:text-neutral-500 focus:outline-none focus:bg-white dark:focus:bg-[#161F30] focus:ring-1 focus:ring-[#0075eb]"
                        autoFocus
                      />
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9B9A97] dark:text-neutral-500 pointer-events-none" />
                    </div>

                    {/* Header banner inside dropdown */}
                    {hasFetchedLive ? (
                      <div className="px-2.5 py-1.5 mb-1.5 border-b border-[#EBEBEA] dark:border-[#1F2937] flex items-center justify-between text-[11px] text-[#1E5A2A] dark:text-emerald-400 bg-[#EDF6EE]/70 dark:bg-emerald-950/40 rounded-lg">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Sparkles className="w-3 h-3 text-[#1E5A2A] dark:text-emerald-400" />
                          Verified live models from {config.provider.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-bold text-[#1E5A2A] dark:text-emerald-400">{availableModels.length} total</span>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1.5 mb-1.5 border-b border-[#EBEBEA] dark:border-[#1F2937] flex items-center justify-between text-[11px] text-[#78510E] dark:text-amber-400 bg-[#FBF3DB]/70 dark:bg-amber-950/40 rounded-lg">
                        <span>Curated preset models</span>
                        <span className="text-[10px] text-[#787774] dark:text-neutral-400">Click "Fetch Models" above to load live</span>
                      </div>
                    )}

                    {/* Populated Models List */}
                    <div className="max-h-60 overflow-y-auto divide-y divide-[#F7F7F5] dark:divide-[#1F2937] overscroll-contain">
                      {(() => {
                        const filtered = availableModels.filter(
                          (m) =>
                            m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                            (m.tag && m.tag.toLowerCase().includes(modelSearchQuery.toLowerCase())) ||
                            (m.description && m.description.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="p-4 text-center text-xs text-[#787774] dark:text-neutral-400">
                              No models matching "{modelSearchQuery}"
                            </div>
                          );
                        }

                        return filtered.map((m) => {
                          const isSelected = config.model === m.id;
                          const isWebLLM = config.provider === "webllm";
                          const isNotDownloaded = isWebLLM && !cachedModels[m.id];

                          const handleSelect = (e?: React.MouseEvent) => {
                            if (e) e.stopPropagation();
                            if (isNotDownloaded) {
                              if (onOpenLocalModel) onOpenLocalModel();
                              setModelDropdownOpen(false);
                              return;
                            }
                            setConfig({ ...config, model: m.id });
                            setTestResult(null); // Automatically clear any connection warning/error message!
                            setFetchFeedback(null);
                            setModelDropdownOpen(false);
                            setModelSearchQuery("");
                          };

                          return (
                            <div
                              key={m.id}
                              onClick={handleSelect}
                              className={`w-full text-left p-2.5 rounded-xl transition flex items-start justify-between gap-2.5 ${
                                isSelected
                                  ? "bg-[#F7F7F5] dark:bg-[#1E293B] text-[#2F3437] dark:text-white font-semibold cursor-pointer"
                                  : isNotDownloaded
                                  ? "text-[#787774] dark:text-neutral-400 bg-neutral-50/50 dark:bg-[#1E293B]/20 cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-[#1E293B]/40"
                                  : "text-[#2F3437] dark:text-neutral-300 hover:bg-[#FAF9F7] dark:hover:bg-[#161F30] cursor-pointer"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`font-mono text-xs font-semibold ${isNotDownloaded ? "text-neutral-500 dark:text-neutral-400" : "text-[#2F3437] dark:text-white"}`}>
                                    {m.id}
                                  </span>
                                  {isWebLLM && (
                                    cachedModels[m.id] ? (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-md border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" /> Downloaded
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-md border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1">
                                        <Download className="w-2.5 h-2.5" /> Not Downloaded
                                      </span>
                                    )
                                  )}
                                  {m.isLive && (
                                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-md border bg-[#EDF6EE] dark:bg-emerald-950/50 text-[#1E5A2A] dark:text-emerald-400 border-[#CBE7CE] dark:border-emerald-800">
                                      Live
                                    </span>
                                  )}
                                  {m.tag && config.provider !== "webllm" && (
                                    <span
                                      className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md border ${
                                        m.recommended
                                          ? "bg-[#EBF3FB] dark:bg-blue-950/50 text-[#18569C] dark:text-blue-300 border-[#CDE1F8] dark:border-blue-800"
                                          : m.tag.includes("Fast") || m.tag.includes("Instant")
                                          ? "bg-[#EDF6EE] dark:bg-emerald-950/50 text-[#1E5A2A] dark:text-emerald-300 border-[#CBE7CE] dark:border-emerald-800"
                                          : m.tag.includes("Reasoning") || m.tag.includes("Frontier")
                                          ? "bg-[#F6F3F9] dark:bg-purple-950/50 text-[#57338C] dark:text-purple-300 border-[#DFD5F5] dark:border-purple-800"
                                          : "bg-[#FBF3DB] dark:bg-amber-950/50 text-[#78510E] dark:text-amber-300 border-[#F4E2B6] dark:border-amber-800"
                                      }`}
                                    >
                                      {m.tag}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#787774] dark:text-neutral-400 truncate mt-0.5">
                                  {m.description || m.name}
                                </p>
                              </div>
                              {isSelected && !isNotDownloaded && (
                                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              )}
                              {isNotDownloaded && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenLocalModel) onOpenLocalModel();
                                    setModelDropdownOpen(false);
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] flex items-center gap-1 transition cursor-pointer shrink-0 shadow-2xs mt-0.5"
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  <span>Download</span>
                                </button>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

          {/* Connection Test Feedback Box (Notion Pastel & High Contrast) */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs animate-fade-in ${
                testResult.success
                  ? "bg-[#EDF6EE] dark:bg-emerald-950/40 border-[#CBE7CE] dark:border-emerald-800 text-[#1E5A2A] dark:text-emerald-300"
                  : "bg-[#FDF0EF] dark:bg-rose-950/40 border-[#F7CECC] dark:border-rose-800 text-[#7C2D2B] dark:text-rose-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1E5A2A] dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#9B2C2C] dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-bold leading-snug">
                      {testResult.success ? "Connection Operational" : "Connection Test Failed"}
                    </div>
                    <div className="text-[11px] opacity-90 leading-relaxed break-words">
                      {testResult.message}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded-md border font-bold inline-flex items-center gap-1 bg-white dark:bg-[#161F30] ${
                      testResult.success
                        ? "text-[#1E5A2A] dark:text-emerald-400 border-[#CBE7CE] dark:border-emerald-800"
                        : "text-[#7C2D2B] dark:text-rose-400 border-[#F7CECC] dark:border-rose-800"
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    {testResult.latencyMs} ms
                  </span>
                </div>
              </div>

              {!testResult.success && testResult.error && (
                <div className="mt-2.5 pt-2 border-t border-[#F7CECC] dark:border-rose-800/80 text-[11px] font-mono leading-relaxed break-words text-[#7C2D2B] dark:text-rose-300">
                  {testResult.error}
                </div>
              )}
            </div>
          )}

          {/* Privacy Footnote */}
          <div className="p-3 rounded-xl liquid-glass-card flex items-center gap-2 text-[11px] text-[#787774] dark:text-neutral-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>Zero data retention &bull; Processed strictly in memory &bull; Never trained on.</span>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
            {/* Check Connection Button */}
            <button
              type="button"
              onClick={handleCheckConnection}
              disabled={testing}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl liquid-glass-btn-secondary disabled:opacity-50 text-[#2F3437] dark:text-neutral-300 font-medium text-xs transition cursor-pointer"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0A85EA] dark:text-blue-400" />
                  <span>
                    {config.provider === "webllm"
                      ? "Checking WebGPU & Cache..."
                      : config.provider === "laya" || config.provider === "typesafe"
                      ? "Verifying Laya Engine..."
                      : "Pinging API & Fetching Models..."}
                  </span>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5 text-[#0A85EA] dark:text-blue-400" />
                  <span>
                    {config.provider === "webllm"
                      ? "Check WebGPU & Cache Status"
                      : config.provider === "laya" || config.provider === "typesafe"
                      ? "Verify Laya Engine Status"
                      : "Check Connection & Refresh Models"}
                  </span>
                </>
              )}
            </button>

            {/* Save & Cancel */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-[#2F3437] dark:hover:text-white rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isScanning}
                title={isScanning ? "Settings cannot be modified while a scan is in progress" : undefined}
                className={`px-5 py-2 rounded-xl font-medium text-xs transition ${
                  isScanning
                    ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-60"
                    : "liquid-glass-btn-primary cursor-pointer"
                }`}
              >
                {savedSuccess ? "Saved!" : "Save & Activate"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
