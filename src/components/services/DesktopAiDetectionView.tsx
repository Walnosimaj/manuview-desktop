"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Filter,
  Eye,
  Info,
  Upload,
  FileUp,
  FileCode,
  BookOpen,
  X,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  LAYA_MODEL_VARIANTS,
  getSelectedLayaModelVariant,
  setSelectedLayaModelVariant,
  LayaModelVariant,
} from "@/lib/laya/laya-model-registry";
import {
  scanManuscriptForAiAndDisclosures,
  AiDetectionReport,
  AiHighlightSpan,
  SimilaritySpan,
  DisclosureType,
  DisclosureItem,
} from "@/lib/laya/ai-detection-service";
import { extractTextFromFile } from "@/lib/parser";

export interface DesktopAiDetectionViewProps {
  onOpenSettings?: () => void;
}

const SAMPLE_MANUSCRIPT = `In this rapidly evolving digital landscape, it is of paramount importance to delve into the rich tapestry of deep learning innovations, which serve as a beacon of progress and play a pivotal role in shaping modern scientific discovery. By seamlessly navigating complex multi-modal representations, these architectures foster collaboration across disparate empirical fields.

However, clinical translation requires rigorous statistical validation. We analyzed a cohort of 1,420 oncology patients (95% CI: [1.12, 1.48], p < 0.001) across 4 academic medical centers using a randomized double-blind protocol. Serum biomarker concentrations were quantified via high-performance liquid chromatography (mean = 4.2 mg/L, SD = 0.8). Figure 2 illustrates the Kaplan-Meier survival curves, demonstrating a 23% reduction in progression risk (hazard ratio = 0.77, 95% CI: [0.65, 0.91]).

The remainder of this paper is organized as follows. Section 2 discusses related work, Section 3 delineates experimental design, and Section 4 presents quantitative benchmarking. It is crucial to note that heuristic evaluation metrics can introduce unintended confounding factors if baseline calibration parameters are left unstandardized.

Ethics Statement:
This study was approved by the Institutional Review Board and Ethics Committee of Oxford University Hospitals (Protocol #IRB-2023-8891). Written informed consent was obtained from all human participants prior to enrollment in accordance with the Declaration of Helsinki.

Data Availability:
De-identified individual patient datasets, analysis scripts, and model weight checkpoints are publicly accessible on Zenodo under accession DOI: 10.5281/zenodo.8492019. Raw chromatographic spectrum files are available from the corresponding author upon reasonable request.

Funding:
This work was supported by Grant #HL149201 from the National Institutes of Health (NIH) and Wellcome Trust Senior Investigator Award #WT204910. The funders had no role in study design, data collection, or manuscript preparation.

Conflict of Interest:
The authors declare no competing financial or personal conflicts of interest related to the publication of this work.`;

export function DesktopAiDetectionView({ onOpenSettings }: DesktopAiDetectionViewProps = {}) {
  const [selectedVariant, setSelectedVariant] = useState<LayaModelVariant>(() =>
    getSelectedLayaModelVariant()
  );
  const [inputTab, setInputTab] = useState<"upload" | "text">("upload");
  const [inputText, setInputText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ percent: number; statusText: string }>({
    percent: 0,
    statusText: "",
  });
  const [report, setReport] = useState<AiDetectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inspector mode: "ai" vs "similarity"
  const [inspectorMode, setInspectorMode] = useState<"ai" | "similarity">("ai");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "moderate">("all");
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);
  const [selectedSimilarityId, setSelectedSimilarityId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedVariant(getSelectedLayaModelVariant());
  }, []);

  const handleSelectVariant = (variantId: LayaModelVariant["id"]) => {
    setSelectedLayaModelVariant(variantId);
    setSelectedVariant(getSelectedLayaModelVariant());
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_MANUSCRIPT);
    setUploadedFileName("sample_oncology_manuscript.pdf");
    setUploadedFileSize("148 KB");
    setInputTab("text");
    setError(null);
  };

  const handleProcessFile = async (file: File) => {
    setError(null);
    setIsParsingFile(true);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    try {
      const extracted = await extractTextFromFile(file);
      if (!extracted || extracted.trim().length < 50) {
        throw new Error("Extracted document contains insufficient readable text.");
      }
      setInputText(extracted);
      setInputTab("text");
    } catch (err: any) {
      console.error("File parse error:", err);
      setError(err?.message || "Could not read this document. Please ensure it is a valid PDF, Word (.docx), or plain text file.");
      setUploadedFileName(null);
      setUploadedFileSize(null);
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleRunScan = async () => {
    const textToScan = inputText.trim();
    if (!textToScan) {
      setError("Please upload a document or paste manuscript text before running the audit.");
      return;
    }

    setError(null);
    setIsScanning(true);
    setScanProgress({ percent: 5, statusText: `Loading ${selectedVariant.name}...` });

    try {
      const res = await scanManuscriptForAiAndDisclosures(textToScan, (percent, statusText) => {
        setScanProgress({ percent, statusText });
      });
      setReport(res);
      if (res.highlights.length > 0) {
        setSelectedSentenceId(res.highlights[0].id);
      }
      if (res.similarityMatches.length > 0) {
        setSelectedSimilarityId(res.similarityMatches[0].id);
      }
    } catch (err: any) {
      console.error("Laya scan failed:", err);
      setError(err?.message || "Failed to complete on-device evaluation.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopySummary = () => {
    if (!report) return;
    const summaryText = `ManuView - AI Phrasing, Originality & Disclosures Audit Report
Model Engine: ${report.modelUsed} (Local ONNX v2)
AI Phrasing Risk: ${report.aiRiskLevel} (${(report.overallAiProbability * 100).toFixed(1)}%)
Text Originality: ${report.originalityLevel} (${(report.originalityScore * 100).toFixed(1)}%)
Flagged Sentences: ${report.flaggedSentencesCount} of ${report.totalSentencesScanned}
Average Latency: ${report.averageLatencyMs}ms / sentence

Mandatory Disclosures:
- Conflict of Interest: ${report.disclosures.Conflict_Of_Interest.status.toUpperCase()} (${(report.disclosures.Conflict_Of_Interest.confidence * 100).toFixed(0)}%)
- Data Availability: ${report.disclosures.Data_Availability.status.toUpperCase()} (${(report.disclosures.Data_Availability.confidence * 100).toFixed(0)}%)
- Funding: ${report.disclosures.Funding_Statement.status.toUpperCase()} (${(report.disclosures.Funding_Statement.confidence * 100).toFixed(0)}%)
- Ethics: ${report.disclosures.Ethics_Statement.status.toUpperCase()} (${(report.disclosures.Ethics_Statement.confidence * 100).toFixed(0)}%)
`;
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Find active sentence in highlights
  const activeHighlight = report?.highlights.find((h) => h.id === selectedSentenceId) || null;
  const activeSimilarity = report?.similarityMatches.find((s) => s.id === selectedSimilarityId) || null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#070b14] overflow-y-auto [scrollbar-width:thin]">
      {/* Top Banner & Model Selector Bar */}
      <div className="shrink-0 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-500/20 shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">
                  AI Phrasing &amp; Mandatory Disclosures
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold border border-violet-500/20">
                  Laya v2 · ModernBERT
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Local on-device inference · Single-pass decision schemas · Plagiarism &amp; AI screening · Zero cloud egress
              </p>
            </div>
          </div>

          {/* Model Selector Pill */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto bg-black/[0.03] dark:bg-white/[0.05] p-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 pl-2 pr-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-violet-500" />
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-white dark:bg-neutral-800 text-violet-700 dark:text-violet-300 shadow-xs border border-violet-500/30 font-semibold"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
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
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Manuscript Input Card with File Upload & Direct Text Tabs */}
        <div className="liquid-glass-card rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Tab Switcher: Upload vs Text */}
            <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setInputTab("upload")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  inputTab === "upload"
                    ? "bg-white dark:bg-neutral-800 text-violet-700 dark:text-violet-300 shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </button>
              <button
                type="button"
                onClick={() => setInputTab("text")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  inputTab === "text"
                    ? "bg-white dark:bg-neutral-800 text-violet-700 dark:text-violet-300 shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste / Edit Text</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800/40 transition cursor-pointer"
              >
                Load Academic Sample
              </button>
              {inputText && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText("");
                    setUploadedFileName(null);
                    setUploadedFileSize(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Mode 1: Drag & Drop File Upload Dropzone */}
          {inputTab === "upload" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed transition cursor-pointer text-center space-y-3 ${
                isDraggingOver
                  ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20"
                  : "border-black/[0.1] dark:border-white/[0.1] hover:border-violet-400/60 hover:bg-black/[0.01] dark:hover:bg-white/[0.02]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.tex"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-500/20">
                {isParsingFile ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-violet-600" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  {isParsingFile
                    ? "Extracting document text..."
                    : "Drop manuscript file here or click to browse"}
                </h3>
                <p className="text-xs text-neutral-400">
                  Supports PDF (.pdf), Word (.docx), Plain Text (.txt, .md), and LaTeX (.tex)
                </p>
              </div>

              {uploadedFileName && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-100/80 dark:bg-violet-950/60 text-violet-800 dark:text-violet-200 text-xs font-medium border border-violet-200 dark:border-violet-800/40">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{uploadedFileName}</span>
                  <span className="text-[10px] opacity-75">({uploadedFileSize})</span>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Direct Text Area */}
          {inputTab === "text" && (
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste manuscript text, abstract, or full draft here to evaluate AI filler phrasing (Noul schema) and verify mandatory disclosure sections (Choice schema)..."
                rows={8}
                className="w-full text-xs font-sans p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white/70 dark:bg-black/40 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition resize-y leading-relaxed"
              />
              <div className="absolute right-3 bottom-3 text-[10px] font-mono text-neutral-400">
                {inputText.length} chars · {inputText.split(/\s+/).filter(Boolean).length} words
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>
                Engine: <strong className="font-semibold text-neutral-700 dark:text-neutral-300">{selectedVariant.name}</strong> · 100% on-device
              </span>
            </div>

            <button
              type="button"
              onClick={handleRunScan}
              disabled={isScanning || !inputText.trim() || isParsingFile}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold text-white shadow-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                isScanning || !inputText.trim() || isParsingFile
                  ? "bg-violet-400 dark:bg-violet-600/50 cursor-not-allowed opacity-70"
                  : "bg-violet-600 hover:bg-violet-700 active:scale-[0.98]"
              }`}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Evaluating Manuscript...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-white" />
                  <span>Run Complete Phrasing &amp; Disclosures Audit</span>
                </>
              )}
            </button>
          </div>

          {/* Scan Progress Bar */}
          {isScanning && (
            <div className="space-y-1.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] animate-fade-in">
              <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                <span>{scanProgress.statusText}</span>
                <span>{scanProgress.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/[0.05] dark:bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Scan Results View */}
        {report && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Metric Cards: 5 Cards (AI Risk, Originality, Flagged, Disclosures, Speed) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Card 1: AI Phrasing Density */}
              <div className="liquid-glass-card rounded-2xl p-4 border border-black/[0.06] dark:border-white/[0.08] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    AI Phrasing Risk
                  </span>
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      report.overallAiProbability >= 0.40
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : report.overallAiProbability >= 0.18
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-[#0F172A] dark:text-white">
                    {(report.overallAiProbability * 100).toFixed(1)}%
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      report.overallAiProbability >= 0.40
                        ? "text-rose-600 dark:text-rose-400"
                        : report.overallAiProbability >= 0.18
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {report.aiRiskLevel}
                  </span>
                </div>
                <p className="text-[9px] text-neutral-400">Noul filler probability</p>
              </div>

              {/* Card 2: Originality / Plagiarism Index */}
              <div className="liquid-glass-card rounded-2xl p-4 border border-black/[0.06] dark:border-white/[0.08] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Originality Index
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-[#0F172A] dark:text-white">
                    {(report.originalityScore * 100).toFixed(1)}%
                  </span>
                  <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                    Original
                  </span>
                </div>
                <p className="text-[9px] text-neutral-400">
                  {report.similarityMatches.length} boilerplates detected
                </p>
              </div>

              {/* Card 3: Flagged Sentences */}
              <div className="liquid-glass-card rounded-2xl p-4 border border-black/[0.06] dark:border-white/[0.08] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Flagged Phrasing
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <Filter className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold text-[#0F172A] dark:text-white">
                    {report.flaggedSentencesCount}
                  </span>
                  <span className="text-xs text-neutral-500">
                    / {report.totalSentencesScanned} sents
                  </span>
                </div>
                <p className="text-[9px] text-neutral-400">P &ge; 40% formulaic phrasing</p>
              </div>

              {/* Card 4: Audited Disclosures */}
              <div className="liquid-glass-card rounded-2xl p-4 border border-black/[0.06] dark:border-white/[0.08] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Disclosures
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                {(() => {
                  const verifiedCount = Object.values(report.disclosures).filter(
                    (d) => d.status === "verified"
                  ).length;
                  return (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-[#0F172A] dark:text-white">
                        {verifiedCount} / 4
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          verifiedCount === 4
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {verifiedCount === 4 ? "Compliant" : "Review"}
                      </span>
                    </div>
                  );
                })()}
                <p className="text-[9px] text-neutral-400">Ethics, Data, Funding, COI</p>
              </div>

              {/* Card 5: Engine Speed */}
              <div className="liquid-glass-card rounded-2xl p-4 border border-black/[0.06] dark:border-white/[0.08] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Latency
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-[#0F172A] dark:text-white">
                    {report.averageLatencyMs}
                  </span>
                  <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                    ms / sent
                  </span>
                </div>
                <p className="text-[9px] text-neutral-400">On-device CPU/WASM</p>
              </div>
            </div>

            {/* Section 1: Mandatory Disclosures Checklist (Choice Primitive) */}
            <div className="liquid-glass-card rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-500" />
                    <span>Mandatory Administrative Disclosures Checklist</span>
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Evaluated via Laya Choice decision schema. Major scholarly publishers mandate these 4 declarations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Copy Summary</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.entries(report.disclosures) as [DisclosureType, DisclosureItem][]).map(
                  ([key, item]) => {
                    const isVerified = item.status === "verified";
                    const isManual = item.status === "manual_review";

                    return (
                      <div
                        key={key}
                        className={`rounded-xl p-4 border transition ${
                          isVerified
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40"
                            : isManual
                            ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40"
                            : "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">
                                {item.title}
                              </h4>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isVerified
                                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                    : isManual
                                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                    : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                                }`}
                              >
                                {isVerified ? "Verified" : isManual ? "Manual Review" : "Missing"}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              {item.description}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-white">
                              {(item.confidence * 100).toFixed(0)}%
                            </span>
                            <span className="block text-[9px] text-neutral-400 uppercase">
                              Confidence
                            </span>
                          </div>
                        </div>

                        {item.excerpt ? (
                          <div className="mt-3 p-2.5 rounded-lg bg-white/70 dark:bg-black/30 border border-black/[0.04] dark:border-white/[0.06]">
                            <p className="text-[11px] text-neutral-700 dark:text-neutral-300 italic line-clamp-3 leading-relaxed">
                              &ldquo;{item.excerpt}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 p-2 rounded-lg bg-rose-100/50 dark:bg-rose-950/30 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>No dedicated section detected in manuscript text.</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Section 2: Interactive Inspector (AI Phrasing vs Originality & Similarity) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Manuscript Interactive Reading View (Left 7 cols) */}
              <div className="lg:col-span-7 liquid-glass-card rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Mode Switcher */}
                  <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setInspectorMode("ai")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                        inspectorMode === "ai"
                          ? "bg-white dark:bg-neutral-800 text-violet-700 dark:text-violet-300 shadow-xs font-semibold"
                          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Phrasing ({report.highlights.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorMode("similarity")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                        inspectorMode === "similarity"
                          ? "bg-white dark:bg-neutral-800 text-teal-700 dark:text-teal-300 shadow-xs font-semibold"
                          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Originality &amp; Similarity ({report.similarityMatches.length})</span>
                    </button>
                  </div>

                  {inspectorMode === "ai" && (
                    <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.05] p-1 rounded-xl">
                      {(["all", "high", "moderate"] as const).map((filterKey) => (
                        <button
                          key={filterKey}
                          type="button"
                          onClick={() => setSeverityFilter(filterKey)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition cursor-pointer ${
                            severityFilter === filterKey
                              ? "bg-white dark:bg-neutral-800 text-violet-700 dark:text-violet-300 shadow-2xs font-semibold"
                              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                          }`}
                        >
                          {filterKey}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Text Reader Container */}
                <div className="space-y-4 text-xs font-sans text-neutral-800 dark:text-neutral-200 leading-relaxed max-h-[460px] overflow-y-auto p-4 rounded-xl bg-white/60 dark:bg-black/30 border border-black/[0.04] dark:border-white/[0.06] [scrollbar-width:thin]">
                  {report.chunks.map((chunk, cIdx) => (
                    <p key={`chunk_${cIdx}`} className="leading-relaxed">
                      {chunk.sentences.map((sent, sIdx) => {
                        const highlight = report.highlights.find(
                          (h) => h.startOffset === sent.startOffset && h.endOffset === sent.endOffset
                        );
                        const similarity = report.similarityMatches.find(
                          (s) => s.startOffset === sent.startOffset
                        );

                        if (inspectorMode === "ai" && highlight) {
                          const isSelected = highlight.id === selectedSentenceId;
                          const isHigh = highlight.severity === "high";

                          return (
                            <span
                              key={highlight.id}
                              onClick={() => setSelectedSentenceId(highlight.id)}
                              className={`cursor-pointer px-1 py-0.5 rounded transition ${
                                isSelected ? "ring-2 ring-violet-500 font-semibold" : ""
                              } ${
                                isHigh
                                  ? "bg-rose-100/80 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-b-2 border-rose-400"
                                  : "bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-b-2 border-amber-400"
                              }`}
                              title={`AI Filler Prob: ${(highlight.probability * 100).toFixed(0)}%`}
                            >
                              {sent.text}{" "}
                            </span>
                          );
                        }

                        if (inspectorMode === "similarity" && similarity) {
                          const isSelected = similarity.id === selectedSimilarityId;
                          return (
                            <span
                              key={similarity.id}
                              onClick={() => setSelectedSimilarityId(similarity.id)}
                              className={`cursor-pointer px-1 py-0.5 rounded transition ${
                                isSelected ? "ring-2 ring-teal-500 font-semibold" : ""
                              } bg-teal-100/80 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-b-2 border-teal-400`}
                              title={`Boilerplate/Overlap: ${similarity.reason}`}
                            >
                              {sent.text}{" "}
                            </span>
                          );
                        }

                        return <span key={`s_${cIdx}_${sIdx}`}>{sent.text} </span>;
                      })}
                    </p>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 pt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {inspectorMode === "ai" ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>High AI Filler (&ge; 65%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span>Moderate AI Filler (40% - 64%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>Empirical Grounded</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                        <span>Academic Boilerplate / Formulaic Overlap</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>Original Scholarly Prose</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Inspector Detail Pane (Right 5 cols) */}
              <div className="lg:col-span-5 liquid-glass-card rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-violet-500" />
                      <span>{inspectorMode === "ai" ? "Sentence Inspector" : "Similarity & Attribution Inspector"}</span>
                    </h4>
                    {inspectorMode === "ai" && activeHighlight && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          activeHighlight.severity === "high"
                            ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                            : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {activeHighlight.severity === "high" ? "High Risk" : "Moderate Risk"}
                      </span>
                    )}
                    {inspectorMode === "similarity" && activeSimilarity && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                        Boilerplate Overlap
                      </span>
                    )}
                  </div>

                  {/* Mode 1: AI Inspector */}
                  {inspectorMode === "ai" && activeHighlight && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                          <span className="text-[10px] text-neutral-400 uppercase font-mono block">
                            Filler Probability
                          </span>
                          <span className="text-xl font-extrabold text-[#0F172A] dark:text-white">
                            {(activeHighlight.probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                          <span className="text-[10px] text-neutral-400 uppercase font-mono block">
                            Context
                          </span>
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 capitalize truncate block mt-1">
                            {activeHighlight.context}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                          Selected Sentence
                        </span>
                        <div className="p-3 rounded-xl bg-white/80 dark:bg-black/40 border border-black/[0.06] dark:border-white/[0.08] text-xs font-serif italic text-neutral-800 dark:text-neutral-200 leading-relaxed">
                          &ldquo;{activeHighlight.sentenceText}&rdquo;
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-violet-500" />
                          <span>Academic Refinement Guidance</span>
                        </span>
                        <div className="p-3.5 rounded-xl bg-violet-50/50 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40 text-xs text-neutral-700 dark:text-neutral-300 space-y-2">
                          <p>
                            Formulaic cadence typical of generic LLM writing (e.g. cliché metaphors, grandiose generalizations).
                          </p>
                          <div className="pt-1 border-t border-violet-200/40 dark:border-violet-800/30">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 block">
                              Suggested Action:
                            </span>
                            <span className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 block">
                              Replace rhetorical flourishes with concrete empirical mechanisms, confidence intervals, or sample sizes.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Similarity Inspector */}
                  {inspectorMode === "similarity" && activeSimilarity && (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/40 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 block">
                          Identified Pattern:
                        </span>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300">
                          {activeSimilarity.reason}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                          Flagged Passage
                        </span>
                        <div className="p-3 rounded-xl bg-white/80 dark:bg-black/40 border border-black/[0.06] dark:border-white/[0.08] text-xs font-serif italic text-neutral-800 dark:text-neutral-200 leading-relaxed">
                          &ldquo;{activeSimilarity.sentenceText}&rdquo;
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                          <span>Attribution &amp; Originality Recommendation</span>
                        </span>
                        <div className="p-3.5 rounded-xl bg-teal-50/30 dark:bg-teal-950/20 border border-teal-200/40 dark:border-teal-800/30 text-xs text-neutral-700 dark:text-neutral-300">
                          {activeSimilarity.recommendation}
                        </div>
                      </div>
                    </div>
                  )}

                  {!activeHighlight && inspectorMode === "ai" && (
                    <div className="p-8 text-center text-neutral-400 text-xs space-y-2">
                      <Sparkles className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600" />
                      <p>Select any highlighted sentence to inspect diagnostic probabilities.</p>
                    </div>
                  )}

                  {!activeSimilarity && inspectorMode === "similarity" && (
                    <div className="p-8 text-center text-neutral-400 text-xs space-y-2">
                      <BookOpen className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600" />
                      <p>Select any highlighted similarity span to inspect academic originality.</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Engine: {report.modelUsed}</span>
                  <span className="font-mono">Tauri IPC · ONNX Runtime</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
