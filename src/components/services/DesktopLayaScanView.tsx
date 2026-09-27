import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FileUp,
  FileText,
  Loader2,
  AlertCircle,
  Settings as SettingsIcon,
  Sparkles,
  CircleCheck,
  CircleAlert,
  CircleX,
  Info,
  Gauge,
  X,
  Tag,
  ArrowRight,
  RotateCw,
  Cpu,
} from "lucide-react";
import { extractTextFromFile } from "@/lib/parser";
import { getSavedClientConfig } from "@/lib/llm";
import { LAYA_MODEL } from "@/lib/laya/laya-service";
import {
  LAYA_MODEL_VARIANTS,
  getSelectedLayaModelVariant,
  setSelectedLayaModelVariant,
  LayaModelVariant,
} from "@/lib/laya/laya-model-registry";
import {
  runLayaScan,
  type LayaScanResult,
} from "@/lib/laya/laya-scan";
import JournalCombobox from "@/components/JournalCombobox";
import { fetchLiveJournalScope } from "@/lib/journal-scope-service";
import { DesktopLayaDashboardView } from "./DesktopLayaDashboardView";
import { useScanManager } from "@/context/ScanContext";
import type { PaperItem } from "@/components/DesktopSidebar";

interface Props {
  onOpenSettings: () => void;
}

export function DesktopLayaScanView({ onOpenSettings }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<LayaModelVariant>(() =>
    getSelectedLayaModelVariant()
  );
  const [text, setText] = useState("");
  const [targetJournal, setTargetJournal] = useState("");
  const [targetJournalError, setTargetJournalError] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LayaScanResult | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startScan } = useScanManager();

  const handleSelectVariant = (variantId: LayaModelVariant["id"]) => {
    setSelectedLayaModelVariant(variantId);
    setSelectedVariant(getSelectedLayaModelVariant());
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsingFile(true);
    try {
      const extracted = await extractTextFromFile(file);
      setText(extracted);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runScan = async () => {
    if (!text.trim()) {
      setError("Paste manuscript text or upload a document first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStep("Fetching target journal aims and scope...");

    try {
      let journalScope: string | undefined;
      if (targetJournal.trim()) {
        const live = await fetchLiveJournalScope(targetJournal.trim()).catch(() => null);
        journalScope = live?.aimsAndScope;
      }

      setLoadingStep("Running Fast Scan parallel evaluation battery...");
      const scan = await runLayaScan(text, {
        model: selectedVariant.id,
        targetJournal: targetJournal.trim() || undefined,
        journalScope,
        filename: fileName || undefined,
      });
      setResult(scan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Laya Fast Scan failed.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const clearInput = () => {
    setText("");
    setFileName(null);
    setTargetJournal("");
    setResult(null);
    setError(null);
  };

  // If result is ready, render the full Laya Dashboard!
  if (result) {
    const isNonAcademic =
      !result.isAcademic ||
      result.classification?.isAcademicManuscript === false;

    const syntheticPaper: PaperItem = {
      id: `laya-preview-${Date.now()}`,
      title: fileName ? fileName.replace(/\.[^/.]+$/, "") : "Laya Manuscript Audit",
      shortName: (fileName || "Manuscript").split(" ").slice(0, 3).join(" "),
      journal: targetJournal.trim() || "Target Journal",
      score: isNonAcademic ? undefined : result.readiness,
      scanType: "laya",
      layaResult: result,
      typesafeResult: result,
      isEligibleForReview: !isNonAcademic,
      ineligibilityReason: isNonAcademic ? "non_academic_document" : undefined,
      classification: result.classification,
      status: "completed",
    };

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top return bar */}
        <div className="px-6 py-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161F30] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              Laya Fast Scan Results
            </span>
          </div>
          <button
            type="button"
            onClick={clearInput}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-[#1E293B] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#26344a] transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Audit Another Manuscript</span>
          </button>
        </div>

        <DesktopLayaDashboardView
          paper={syntheticPaper}
          scanResult={result}
          onOpenSettings={onOpenSettings}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 text-[#111827] dark:text-[#F8FAFC]">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Header Hero */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#161F30] border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
                    Fast Scan
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    Laya Decision Model (On-Device)
                  </span>
                </div>

                {/* Model Selector: INT8 vs FP32 */}
                <div className="flex items-center gap-1.5 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 pl-2 pr-1 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-blue-500" />
                    <span>Model:</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {LAYA_MODEL_VARIANTS.map((variant) => {
                      const isSelected = selectedVariant.id === variant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => handleSelectVariant(variant.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-xs border border-blue-500/30 font-semibold"
                              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                          }`}
                        >
                          <span>{variant.id === "laya-system1-int8" ? "INT8 Quantized" : "FP32 Full"}</span>
                          <span className="text-[10px] opacity-75 font-mono">({variant.size})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                Objective, typed document diagnostics powered by Laya (ModernBERT-large, 421M params). Evaluates 27 checks in parallel across screening, methodology reproducibility, statistical reporting, and journal scope alignment with calibrated confidence — 100% on-device with zero external API calls.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Card: Target Journal */}
        <div className="rounded-3xl bg-white dark:bg-[#161F30] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs sm:text-sm">
            <span className="w-44 shrink-0 flex items-center gap-1.5 font-semibold text-neutral-600 dark:text-neutral-400">
              <Tag className="w-4 h-4 text-purple-500" />
              <span>Target Venue (Optional)</span>
            </span>
            <div className="flex-1 max-w-lg">
              <JournalCombobox
                value={targetJournal}
                onChange={(val) => setTargetJournal(val)}
                hasError={targetJournalError}
                placeholder="Search journal for scope and rigor alignment..."
              />
              <span className="text-[11px] text-neutral-400 mt-1 block">
                Laya will audit whether your manuscript topic and methodology fit this journal.
              </span>
            </div>
          </div>
        </div>

        {/* Manuscript Input Card */}
        <div className="rounded-3xl bg-white dark:bg-[#161F30] border border-black/[0.06] dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Manuscript Content
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.tex"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingFile || loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-[#1E293B] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-[#26344a] transition cursor-pointer disabled:opacity-50"
              >
                {parsingFile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileUp className="w-3.5 h-3.5" />
                )}
                Upload Document
              </button>
              {(text || fileName) && (
                <button
                  type="button"
                  onClick={clearInput}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-[#1E293B] transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {fileName && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-200">
              <FileText className="w-4 h-4 shrink-0 text-blue-600" />
              <span className="font-semibold truncate">{fileName}</span>
              <span className="text-[11px] text-blue-600/80 dark:text-blue-300/80 ml-auto shrink-0">
                Extracted &amp; Ready
              </span>
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your manuscript text here, or upload a .pdf / .docx file above..."
            rows={12}
            className="w-full p-4 rounded-2xl border border-neutral-200 dark:border-[#334155] bg-neutral-50/50 dark:bg-[#0F172A]/40 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition resize-y font-sans leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-neutral-400">
              {wordCount.toLocaleString()} words • Model: {selectedVariant.name}
            </span>

            <button
              type="button"
              onClick={runScan}
              disabled={loading || !text.trim() || parsingFile}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 transition shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{loadingStep || "Evaluating..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Run Fast Diagnostic Scan</span>
                  <ArrowRight className="w-4 h-4 text-white/80" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const DesktopTypeSafeScanView = DesktopLayaScanView;

