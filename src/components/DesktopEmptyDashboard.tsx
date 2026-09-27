"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Compass,
  CheckCircle2,
  ShieldCheck,
  Plus,
  FileText,
  Layers,
  ArrowRight,
  Trash2,
  MessageSquare,
  AlertTriangle,
  ShieldAlert,
  CheckSquare,
  Square,
  Check,
  X,
  Loader2,
  Gauge,
} from "lucide-react";
import { PaperItem } from "./DesktopSidebar";
import { DashboardGlassIllustration } from "./dashboard/DashboardGlassIllustration";

interface DesktopEmptyDashboardProps {
  papers: PaperItem[];
  onOpenArticle: (id: string) => void;
  onOpenService: (serviceId: string) => void;
  onDeletePaper?: (paper: PaperItem) => void;
  onDeleteMultiplePapers?: (papers: PaperItem[]) => void;
  selectedPaperIds?: Set<string>;
  onToggleSelectPaper?: (id: string) => void;
  onSelectAllPapers?: () => void;
  onClearSelectedPapers?: () => void;
  isScanning?: boolean;
}

export function DesktopEmptyDashboard({
  papers,
  onOpenArticle,
  onOpenService,
  onDeletePaper,
  onDeleteMultiplePapers,
  selectedPaperIds: controlledSelectedPaperIds,
  onToggleSelectPaper,
  onSelectAllPapers,
  onClearSelectedPapers,
  isScanning = false,
}: DesktopEmptyDashboardProps) {
  const [localSelectedPaperIds, setLocalSelectedPaperIds] = useState<Set<string>>(new Set());
  const selectedPaperIds = controlledSelectedPaperIds ?? localSelectedPaperIds;

  // Auto-prune any selected IDs when papers are removed or deleted
  useEffect(() => {
    const validIds = new Set(papers.map((p) => p.id));
    setLocalSelectedPaperIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [papers]);

  const toggleSelectPaper = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onToggleSelectPaper) {
      onToggleSelectPaper(id);
    } else {
      setLocalSelectedPaperIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  };

  const handleSelectAll = () => {
    if (onSelectAllPapers) {
      onSelectAllPapers();
    } else {
      if (selectedPaperIds.size === papers.length) {
        setLocalSelectedPaperIds(new Set());
      } else {
        setLocalSelectedPaperIds(new Set(papers.map((p) => p.id)));
      }
    }
  };

  const handleCancelSelect = () => {
    if (onClearSelectedPapers) {
      onClearSelectedPapers();
    } else {
      setLocalSelectedPaperIds(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPaperIds.size === 0) return;
    const targets = papers.filter((p) => selectedPaperIds.has(p.id));
    if (onDeleteMultiplePapers) {
      onDeleteMultiplePapers(targets);
    } else if (onDeletePaper && targets.length === 1) {
      onDeletePaper(targets[0]);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 text-[#111827] dark:text-[#F8FAFC]">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* PUREMAC-STYLE DARK HERO CARD */}
        <div className="relative rounded-[28px] bg-[#0B0F17] text-white shadow-2xl p-6 sm:p-8 overflow-hidden border border-white/10">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-white/90 border border-white/15 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>LOCAL INTELLIGENCE ACTIVE</span>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Pre-Submission Review Suite
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                    100% Private
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-md">
                Pre-submission diagnostics, multi-referee simulation panels, reference integrity audits, and target journal matching completely locally on your computer.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => !isScanning && onOpenService("ai-review")}
                  disabled={isScanning}
                  title={isScanning ? "A manuscript scan is already in progress" : undefined}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs shadow-xs transition flex items-center gap-2 ${
                    isScanning
                      ? "bg-neutral-600/70 text-neutral-400 cursor-not-allowed opacity-60 shadow-none pointer-events-none"
                      : "liquid-glass-btn-primary cursor-pointer active:scale-95"
                  }`}
                >
                  {isScanning ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white/80" />
                  ) : (
                    <Plus className="w-4 h-4 shrink-0 text-white/90" />
                  )}
                  <span>{isScanning ? "Review in Progress..." : "New Review Scan"}</span>
                </button>
                <span className="text-xs text-white/60 font-medium">
                  {papers.length} manuscript{papers.length === 1 ? "" : "s"} in library
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-center md:pr-4">
              <DashboardGlassIllustration isDeskReject={false} />
            </div>
          </div>
        </div>

        {/* SAVED MANUSCRIPTS SECTION (if any exist) */}
        {papers.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Your Manuscripts ({papers.length})
              </h2>

              <div className="flex items-center gap-2">
                {selectedPaperIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
                  >
                    {selectedPaperIds.size === papers.length ? "Deselect All" : "Select All"}
                  </button>
                )}

                {/* Trash can icon button in place of text "Select" */}
                {papers.length > 0 && (
                  <button
                    type="button"
                    disabled={selectedPaperIds.size === 0}
                    onClick={handleDeleteSelected}
                    title={
                      selectedPaperIds.size > 0
                        ? `Delete ${selectedPaperIds.size} selected manuscript${selectedPaperIds.size > 1 ? "s" : ""}`
                        : "Hover over manuscript icon to select and delete"
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      selectedPaperIds.size > 0
                        ? "text-white bg-rose-600 hover:bg-rose-500 shadow-xs cursor-pointer active:scale-95 animate-in fade-in"
                        : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 opacity-40 hover:opacity-75 cursor-default border border-black/[0.06] dark:border-white/[0.08]"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {selectedPaperIds.size > 0 ? (
                      <span>Delete ({selectedPaperIds.size})</span>
                    ) : (
                      <span className="hidden sm:inline">Delete</span>
                    )}
                  </button>
                )}

                {selectedPaperIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleCancelSelect}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {papers.map((paper) => {
                const isDeskReject =
                  paper.isDeskReject === true ||
                  paper.targetJournalEvaluation?.isDisciplinaryMismatch === true ||
                  paper.editorialTriage?.outcome === "desk_reject" ||
                  paper.ineligibilityReason === "scope_mismatch";
                const isSelected = selectedPaperIds.has(paper.id);

                return (
                  <div
                    key={paper.id}
                    onClick={() => {
                      if (selectedPaperIds.size > 0) {
                        toggleSelectPaper(paper.id);
                      } else {
                        onOpenArticle(paper.id);
                      }
                    }}
                    className={`group relative rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between space-y-4 shadow-xs border ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 ring-2 ring-blue-500/30"
                        : isDeskReject
                        ? "border-rose-200/70 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 hover:border-rose-300"
                        : "border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Checkbox */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectPaper(paper.id, e);
                          }}
                          className="w-4 h-4 shrink-0 flex items-center justify-center cursor-pointer"
                          title={isSelected ? "Deselect manuscript" : "Select manuscript"}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-xs"
                                : "border border-neutral-400 dark:border-neutral-500 bg-white dark:bg-[#1e293b]"
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              <Square className="w-2.5 h-2.5 opacity-30 text-neutral-400" />
                            )}
                          </div>
                        </div>

                        <span className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                          {paper.shortName || paper.title}
                        </span>
                      </div>

                      {/* Top Right Squircle Icon Badge */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-xs shrink-0 ${
                          isDeskReject
                            ? "bg-rose-500 text-white"
                            : paper.isEligibleForReview === false
                            ? "bg-amber-500 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {isDeskReject ? (
                          <ShieldAlert className="w-4 h-4" />
                        ) : paper.isEligibleForReview === false ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                    </div>

                    {/* Big Metric Display */}
                    <div className="space-y-0.5">
                      <div
                        className={`text-2xl font-black tracking-tight ${
                          isDeskReject
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[#0F172A] dark:text-white"
                        }`}
                      >
                        {isDeskReject
                          ? "Desk Reject"
                          : paper.isEligibleForReview === false
                          ? "Ineligible"
                          : `${paper.score ?? 0}%`}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        Target: {paper.journal}
                      </p>
                    </div>

                    {/* Bottom Row: Status text + Review Pill Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                      <span
                        className={`text-[11px] font-semibold truncate ${
                          isDeskReject
                            ? "text-rose-700 dark:text-rose-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {isDeskReject ? "Scope mismatch" : "Diagnostic ready"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenArticle(paper.id);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-black/10 dark:border-white/10 shadow-2xs transition cursor-pointer shrink-0"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EMPTY STATE ILLUSTRATION (when no manuscripts exist) */}
        {papers.length === 0 && (
          <div className="rounded-3xl liquid-glass-card p-8 sm:p-10 text-center space-y-4 border border-dashed border-black/[0.1] dark:border-white/[0.1]">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center animate-float-1 border border-blue-500/20">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                No Manuscripts in Workspace Yet
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Initiate a complete pre-submission review scan, or run standalone citation audits and journal matching from the specialized diagnostic tools below.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onOpenService("ai-review")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl liquid-glass-btn-primary text-white font-semibold text-xs transition cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4 shrink-0 text-white/90" />
                <span>Start First Review Scan</span>
              </button>
            </div>
          </div>
        )}

        {/* QUICK SERVICES */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1">
            Research &amp; Diagnostic Services
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* 0. Laya Fast Diagnostic Scan */}
            <div
              onClick={() => onOpenService("laya-scan")}
              className="rounded-2xl liquid-glass-card liquid-glass-card-interactive card-interactive-lift p-5 transition cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Gauge className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  Fast Scan · Laya
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111827] dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  Fast Scan (Laya)
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  Fast on-device diagnostics — desk-reject risk, methods, claims, and confidence — powered by Laya (ModernBERT-large) with zero API calls.
                </p>
              </div>
            </div>

            {/* 0b. AI Phrasing & Disclosures */}
            <div
              onClick={() => onOpenService("ai-detection")}
              className="rounded-2xl liquid-glass-card liquid-glass-card-interactive card-interactive-lift p-5 transition cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                  Neural · ModernBERT
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111827] dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition">
                  AI Phrasing &amp; Disclosures
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  Identify AI filler patterns and verify mandatory disclosures (Ethics, Data, Funding, COI) on-device with INT8/FP32 models.
                </p>
              </div>
            </div>

            {/* 1. Journal Fit Predictor */}
            <div
              onClick={() => onOpenService("journal-fit")}
              className="rounded-2xl liquid-glass-card liquid-glass-card-interactive card-interactive-lift p-5 transition cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  48,000+ Catalogs
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111827] dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                  Journal Fit Predictor
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  Match title and abstract against high-impact journals, acceptance odds, and editorial scopes.
                </p>
              </div>
            </div>

            {/* 2. Reference Integrity Audit */}
            <div
              onClick={() => onOpenService("reference-checker")}
              className="rounded-2xl liquid-glass-card liquid-glass-card-interactive card-interactive-lift p-5 transition cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  CrossRef &amp; Retractions
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111827] dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                  Reference Integrity Audit
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  Audit bibliography DOIs in real-time, detect retracted citations, and verify bibliographic accuracy.
                </p>
              </div>
            </div>

            {/* 3. Citation Claim Validator */}
            <div
              onClick={() => onOpenService("citation-claim")}
              className="rounded-2xl liquid-glass-card liquid-glass-card-interactive card-interactive-lift p-5 transition cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Evidence Alignment
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111827] dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                  Citation Claim Validator
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  Verify empirical assertions against cited literature to protect against misleading overgeneralization.
                </p>
              </div>
            </div>

            {/* 4. PRISMA Flow Diagram */}
            <div
              onClick={() => onOpenService("prisma")}
              className="rounded-2xl liquid-glass-card liquid-glass-card-interactive card-interactive-lift p-5 transition cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  Systematic Review
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111827] dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                  PRISMA Flow Diagram
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  Interactive PRISMA 2020 flow generator for systematic reviews and meta-analyses with SVG export.
                </p>
              </div>
            </div>

            {/* 5. Journal Cover Letter */}
            <div
              onClick={() => onOpenService("cover-letter")}
              className="rounded-2xl liquid-glass-card liquid-glass-card-interactive card-interactive-lift p-5 transition cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                  Editor Submission
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111827] dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  Journal Cover Letter
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  Draft calibrated, formal submission letters to journal editors highlighting novelty and ethical compliance.
                </p>
              </div>
            </div>

            {/* 6. Review Response Builder */}
            <div
              onClick={() => onOpenService("response-builder")}
              className="rounded-2xl liquid-glass-card liquid-glass-card-interactive card-interactive-lift p-5 transition cursor-pointer group space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                  Rebuttal Matrix
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111827] dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                  Review Response Builder
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  Structure point-by-point rebuttal matrices and author response letters addressing referee critiques.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FULL DETAILED AI DISCLAIMER & SCHOLARLY USAGE SECTION */}
        <div className="rounded-2xl liquid-glass-card p-6 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                  AI Advisory &amp; Publication Disclaimer
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Scholarly Decision-Support System &bull; Guidelines for Responsible Academic Use
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2.5 py-1 rounded-full font-medium bg-neutral-100 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-300 border border-black/[0.05] dark:border-white/[0.08]">
                Adheres to COPE &amp; ICMJE Standards
              </span>
              <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                100% Local &amp; Private
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Disclaimer Point 1 */}
            <div className="p-4 rounded-xl bg-amber-500/[0.04] dark:bg-amber-500/[0.06] border border-amber-500/15 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <h4>Use AI with Caution</h4>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed text-[11px]">
                Generative AI models can produce hallucinations, factual inaccuracies, or imprecise critique points. Authors and researchers must exercise independent scholarly judgment and independently verify all cited literature, methodological critiques, and statistical bounds before acting upon diagnostic feedback.
              </p>
            </div>

            {/* Disclaimer Point 2 */}
            <div className="p-4 rounded-xl bg-blue-500/[0.04] dark:bg-blue-500/[0.06] border border-blue-500/15 space-y-2">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <h4>Supporting Purpose Only</h4>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed text-[11px]">
                ManuView is an assistive pre-submission diagnostic simulation platform designed to aid editorial triage preparation. It is not an automated co-author, does not substitute for domain expertise, and cannot replace formal institutional review, ethical approvals, or human peer review.
              </p>
            </div>

            {/* Disclaimer Point 3 */}
            <div className="p-4 rounded-xl bg-rose-500/[0.04] dark:bg-rose-500/[0.06] border border-rose-500/15 space-y-2">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <h4>No Acceptance Guarantee</h4>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed text-[11px]">
                No diagnostic platform or algorithmic review can guarantee manuscript acceptance, favorable peer review outcomes, or publication in any academic journal. Editorial decisions remain solely within the exclusive authority of journal editors and external peer reviewers.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-400 dark:text-neutral-500">
            <span>
              All evaluations are processed locally on your hardware. Your unpublished manuscripts and research findings are never uploaded or retained by external servers.
            </span>
            <span className="font-medium text-neutral-500 dark:text-neutral-400">
              ManuView Scholarly Integrity
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
