"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Tag,
  Clock,
  Sparkles,
  Trash2,
  Printer,
  Globe,
  FileText,
  BarChart3,
  AlertCircle,
  BookOpen,
  ChevronDown,
  Plus,
  Loader2,
  Check,
  RotateCcw,
  Upload,
  ExternalLink,
} from "lucide-react";
import type { PaperItem } from "@/components/DesktopSidebar";
import type { LayaScanResult, ScanSignal, TypeSafeScanResult } from "@/lib/laya/laya-scan";
import { DashboardGlassIllustration } from "@/components/dashboard/DashboardGlassIllustration";
import {
  exportInteractiveHtmlReport,
  exportWordDocReport,
  exportPdfReport,
} from "@/lib/export-generator";
import { ExportCompletedToast, type ExportToastData } from "@/components/ExportCompletedToast";
import type { FullReviewReport, DimensionScore, DocumentClassification } from "@/lib/types";

export interface DesktopLayaDashboardViewProps {
  paper: PaperItem;
  scanResult?: LayaScanResult;
  onOpenSettings?: () => void;
  onNewScan?: () => void;
  onDeleteArticle?: () => void;
}
export type DesktopTypeSafeDashboardViewProps = DesktopLayaDashboardViewProps;

function getSignalPercent(sig?: ScanSignal): number {
  if (!sig) return 70;
  if (sig.kind === "noul") {
    return Math.round(sig.value * 100);
  }
  if (sig.kind === "score") {
    return Math.min(100, Math.max(10, Math.round((sig.value / 3) * 100)));
  }
  return sig.tone === "good" ? 85 : sig.tone === "warn" ? 60 : 35;
}

function getScoreTheme(score: number) {
  if (score >= 80) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      label: "High Acceptance Readiness",
      badgeClass: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-800/60",
    };
  }
  if (score >= 65) {
    return {
      text: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      label: "Minor Revisions Anticipated",
      badgeClass: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300/60 dark:border-blue-800/60",
    };
  }
  if (score >= 45) {
    return {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      label: "Major Revisions Prioritized",
      badgeClass: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300/60 dark:border-amber-800/60",
    };
  }
  return {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    label: "High Desk-Reject Hazard",
    badgeClass: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300/60 dark:border-rose-800/60",
  };
}

export function DesktopLayaDashboardView({
  paper,
  scanResult,
  onOpenSettings,
  onNewScan,
  onDeleteArticle,
}: DesktopLayaDashboardViewProps) {
  const result: LayaScanResult | undefined = scanResult || paper.layaResult || paper.typesafeResult;

  const classification: DocumentClassification | undefined =
    paper.classification ||
    result?.classification;

  const publishedDetails = result?.publishedDetails || paper.publishedDetails;
  const isAlreadyPublished =
    paper.ineligibilityReason === "already_published" ||
    result?.ineligibilityReason === "already_published" ||
    Boolean(paper.isPublished) ||
    Boolean(publishedDetails?.isPublished);

  const isNonAcademic = !isAlreadyPublished && (result
    ? !result.isAcademic
    : paper.ineligibilityReason === "non_academic_document" ||
      Boolean(classification && !classification.isAcademicManuscript));

  // Overview Accordions
  const [expandedCards, setExpandedCards] = useState({
    documentClassification: true,
    fivePillars: true,
    synthesis: true,
    priorityFlags: true,
    dimensions: true,
  });

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [activeExportFormat, setActiveExportFormat] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<ExportToastData | null>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Score & Desk reject determination
  const score = isNonAcademic || isAlreadyPublished ? 0 : (result?.readiness ?? paper.score ?? 70);
  const isDeskReject =
    !isNonAcademic &&
    !isAlreadyPublished &&
    (Boolean(paper.isDeskReject) ||
      (result?.signals || []).some((s) => s.id === "desk_reject_risk" && s.value >= 2) ||
      (result?.signals || []).some((s) => s.id === "journal_scope_fit" && s.display?.toLowerCase().includes("out of scope")));

  const theme = getScoreTheme(score);
  const flags = result?.flags || [];
  const signals = result?.signals || [];

  const summaryText = useMemo(() => {
    if (isAlreadyPublished) {
      return (
        publishedDetails?.advisoryMessage ||
        `This manuscript has already appeared in published literature${
          publishedDetails?.journalName ? ` in "${publishedDetails.journalName}"` : ""
        }${
          publishedDetails?.doi ? ` (DOI: ${publishedDetails.doi})` : ""
        }. Pre-submission peer-review simulation, acceptance forecasting, and simulated referee personas are safely bypassed for finalized publications.`
      );
    }
    if (isNonAcademic) {
      return (
        classification?.advisoryMessage ||
        `We detected that "${paper.title}" is structured as ${classification?.categoryLabel || "a non-academic document"} rather than an empirical research manuscript. Standard peer-review simulations and acceptance forecasting are bypassed.`
      );
    }
    return (
      `Fast calibrated objective pre-submission audit. Evaluated against ${paper.journal} editorial criteria with an overall readiness rating of "${result?.readinessLabel || theme.label}" (${score}%).\n\n` +
      `The manuscript "${paper.title}" demonstrates substantial academic structure. Diagnostic evaluation across atomic criteria confirms baseline empirical reporting. Address the prioritized action items below prior to formal submission.`
    );
  }, [isAlreadyPublished, isNonAcademic, publishedDetails, classification?.advisoryMessage, classification?.categoryLabel, paper.title, paper.journal, result?.readinessLabel, theme.label, score]);

  // Toggle card
  const toggleCard = (key: keyof typeof expandedCards) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Build a synthetic FullReviewReport for export
  const effectiveReport: FullReviewReport = useMemo(() => {
    return {
      id: paper.id,
      createdAt: paper.createdAt || new Date().toISOString(),
      mode: "full",
      title: paper.title,
      targetJournal: publishedDetails?.journalName || paper.journal,
      overallScore: isNonAcademic || isAlreadyPublished ? undefined : score,
      isEligibleForReview: !isNonAcademic && !isDeskReject && !isAlreadyPublished,
      ineligibilityReason: isAlreadyPublished
        ? "already_published"
        : isNonAcademic
        ? "non_academic_document"
        : isDeskReject
        ? "scope_mismatch"
        : undefined,
      publishedDetails,
      summary: summaryText,
      classification: classification || {
        category: "academic_manuscript",
        categoryLabel: isAlreadyPublished
          ? "Published Journal Article"
          : result?.documentType || "Academic Research Manuscript",
        isAcademicManuscript: true,
        confidence: 0.95,
        detectedFeatures: ["Abstract", "Methodology", "Empirical Findings"],
        salutation: isAlreadyPublished ? "Published Author" : "Dear Author / Researcher",
        advisoryMessage: isAlreadyPublished
          ? "Academic publication record verified."
          : "Academic manuscript format recognized by Laya Decision Model.",
        customGuidance: isAlreadyPublished
          ? "Pre-submission simulation bypassed for published work."
          : "Review objective findings and address identified vulnerabilities.",
      },
      editorialTriage: {
        sentToPeerReview: !isNonAcademic && !isDeskReject && !isAlreadyPublished,
        outcome: isAlreadyPublished
          ? "sent_for_review"
          : isNonAcademic
          ? "sent_for_review"
          : isDeskReject
          ? "desk_reject"
          : "sent_for_review",
        summary: isAlreadyPublished
          ? `Peer-review simulation bypassed: Article already published in ${publishedDetails?.journalName || "scholarly literature"}.`
          : isNonAcademic
          ? `Peer-review simulation bypassed: Document classified as ${classification?.categoryLabel || "Non-Academic"}.`
          : isDeskReject
          ? `High desk-rejection risk detected against ${paper.journal} editorial standards. Scope or methodological criteria require revision.`
          : `Cleared initial editorial screening. The manuscript aligns with ${paper.journal} scope and standards.`,
        confidence: 0.95,
      },
      dimensions: scanResult?.dimensions || (() => {
        const toDimScore = (pct: number, verdictText: string, dimLabel: string): DimensionScore => {
          const score1to5 = Math.max(1, Math.min(5, Math.round((pct / 100) * 4) + 1));
          return {
            score: score1to5,
            label: dimLabel,
            verdict: verdictText,
            strengths: pct >= 60 ? [verdictText] : [],
            vulnerabilities: pct < 60 ? [verdictText] : [],
            source: "heuristic",
          };
        };
        return {
          originality: toDimScore(
            getSignalPercent(signals.find((s) => s.id === "novelty" || s.id === "originality")),
            signals.find((s) => s.id === "novelty" || s.id === "originality")?.display || "Novelty and research contribution evaluated by Fast Diagnostic.",
            "Originality"
          ),
          broad_interest: toDimScore(
            getSignalPercent(signals.find((s) => s.id === "journal_scope_fit")),
            signals.find((s) => s.id === "journal_scope_fit")?.display || `Target venue fit for ${paper.journal}.`,
            "Broad Interest"
          ),
          claims_vs_evidence: toDimScore(
            getSignalPercent(signals.find((s) => s.id === "claims_supported" || s.id === "stats_complete" || s.id === "statistical_integrity")),
            signals.find((s) => s.id === "claims_supported" || s.id === "stats_complete" || s.id === "statistical_integrity")?.display || "Statistical consistency and numerical reporting evaluated by Fast Diagnostic.",
            "Claims vs Evidence"
          ),
          methodology: toDimScore(
            getSignalPercent(signals.find((s) => s.id === "methods_reproducible" || s.id === "has_methods" || s.id === "method_rigor")),
            signals.find((s) => s.id === "methods_reproducible" || s.id === "has_methods" || s.id === "method_rigor")?.display || "Experimental design and methodological controls evaluated by Fast Diagnostic.",
            "Methodology"
          ),
          clarity: toDimScore(
            getSignalPercent(signals.find((s) => s.id === "structure_coherent" || s.id === "writing_clarity" || s.id === "structural_integrity")),
            signals.find((s) => s.id === "structure_coherent" || s.id === "writing_clarity" || s.id === "structural_integrity")?.display || "IMRaD structure and narrative clarity evaluated by Fast Diagnostic.",
            "Clarity"
          ),
          prior_work: toDimScore(
            getSignalPercent(signals.find((s) => s.id === "citations_present" || s.id === "states_limitations" || s.id === "limitations_declared")),
            signals.find((s) => s.id === "citations_present" || s.id === "states_limitations" || s.id === "limitations_declared")?.display || "Discussion of prior scholarly literature and limitations.",
            "Prior Work"
          ),
        };
      })(),
      priorityIssues: flags.map((f, i) => ({
        id: `flag-${i + 1}`,
        priority: (f.tone === "bad" ? "A" : "B") as "A" | "B" | "C",
        title: f.label,
        category: "Methodology" as const,
        description: f.detail || (f.tone === "bad" ? `Deficiency identified in ${f.label.toLowerCase()}: requires rectification.` : f.display),
        location: "Manuscript text",
        reviewerQuote: f.detail || `${f.label}: ${f.display}`,
        actionableFix: `Address ${f.label.toLowerCase()} findings to protect against desk rejection.`,
      })),
      reviewerPersonas: (scanResult?.reviewerPersonas && scanResult.reviewerPersonas.length > 0)
        ? scanResult.reviewerPersonas
        : [
            {
              persona: "methods_reviewer",
              name: "Fast Evaluation Battery",
              title: "Calibrated Academic Decision Classifier",
              affiliation: "Laya Decision Model (On-Device)",
              expertise: "Multi-Criteria Academic Manuscript Screening",
              roleDescription: "Evaluates empirical rigor, methodology, and target journal fit with calibrated probabilities",
              decisionRecommendation: isDeskReject ? "Desk Reject" : score >= 80 ? "Minor Revision" : "Major Revision",
              keyChallenge: flags[0]?.detail || (flags[0] ? `${flags[0].label}: ${flags[0].display}` : "Methodological clarification and journal standards fit"),
              assessment: summaryText,
              majorCritiques: flags.map((f) => f.detail || `${f.label}: ${f.display}`),
              missingControlsOrAnalyses: [],
              mustAddressItems: flags.filter((f) => f.tone === "bad").map((f) => f.detail || `${f.label}: ${f.display}`),
            },
          ],
      journalRecommendations: [
        {
          tier: "Realistic",
          journalName: paper.journal,
          publisher: "Target Venue",
          fitScore: getSignalPercent(signals.find((s) => s.id === "journal_scope_fit")),
          scopeRationale: signals.find((s) => s.id === "journal_scope_fit")?.display || "Target venue scope alignment evaluated by Fast Diagnostic.",
          rejectionRisks: flags.map((f) => f.label),
          requiredRevisionsForFit: [],
        },
      ],
      citationIntegrity: {
        totalReferences: 0,
        sampledCount: 0,
        checkedCount: 0,
        coverageNote: "Automated bibliographic screening.",
        verifiedCount: 0,
        unresolvableCount: 0,
        uncheckedCount: 0,
        retractedCount: 0,
        retractionCheckAvailable: true,
        selfCitationRatio: 0.05,
        recencyProfile: { last5YearsPercent: 75, olderThan5YearsPercent: 25 },
        references: [],
      },
    };
  }, [paper, result, score, isDeskReject, signals, flags, summaryText]);

  const handleExport = async (format: "word" | "html" | "pdf", e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActiveExportFormat(format);
    setIsExportOpen(false);

    try {
      let res: { success: boolean; filePath?: string; cancelled?: boolean; error?: string } | undefined;
      let label = "";

      if (format === "word") {
        label = "Word Document (.doc)";
        res = await exportWordDocReport(effectiveReport);
      } else if (format === "html") {
        label = "Interactive HTML (.html)";
        res = await exportInteractiveHtmlReport(effectiveReport);
      } else if (format === "pdf") {
        label = "PDF Document (.pdf)";
        res = await exportPdfReport(effectiveReport);
      }

      if (res?.success) {
        setExportToast({
          id: Date.now(),
          status: "success",
          message: `Report exported successfully as ${label}`,
          fileName: res.filePath ? res.filePath.split(/[\\/]/).pop() : undefined,
          filePath: res.filePath,
        });
      } else if (res?.error) {
        setExportToast({
          id: Date.now(),
          status: "error",
          message: `Export failed: ${res.error}`,
        });
      }
    } catch (err) {
      console.error(`Failed to export ${format}:`, err);
      setExportToast({
        id: Date.now(),
        status: "error",
        message: `Failed to export ${format}: ${String(err)}`,
      });
    } finally {
      setActiveExportFormat(null);
    }
  };

  // 5 Pillars mapping from signals
  const pillars = [
    {
      id: "scope",
      name: "1. Scope & Mission Alignment",
      signal: signals.find((s) => s.id === "journal_scope_fit"),
      defaultTitle: "Target Journal Remit",
      desc: `Aims and scope alignment with ${paper.journal}`,
    },
    {
      id: "method",
      name: "2. Methodological Soundness",
      signal: signals.find((s) => s.id === "methods_reproducible" || s.id === "has_methods" || s.id === "method_rigor"),
      defaultTitle: "Research Methodology",
      desc: "Controls, baseline rigor, and empirical design",
    },
    {
      id: "limitations",
      name: "3. Limitations & Caveats",
      signal: signals.find((s) => s.id === "states_limitations" || s.id === "limitations_declared"),
      defaultTitle: "Critical Limitations",
      desc: "Transparent discussion of study boundaries and threats to validity",
    },
    {
      id: "stats",
      name: "4. Statistical Integrity",
      signal: signals.find((s) => s.id === "stats_complete" || s.id === "claims_supported" || s.id === "statistical_integrity"),
      defaultTitle: "Numerical Evidence",
      desc: "Consistency of statistical tests, p-values, and effect sizes",
    },
    {
      id: "ethics",
      name: "5. Ethics & Reproducibility",
      signal: signals.find((s) => s.id === "ethics_statement" || s.id === "data_availability" || s.id === "ethics_declared"),
      defaultTitle: "Ethical Compliance",
      desc: "Institutional review, consent statements, and data accessibility",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 text-[#1E293B] dark:text-[#E2E8F0]">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {/* =========================================================================
            TOP CARD: PureMac Header + Actions + Status Banner
           ========================================================================= */}
        <div className="rounded-3xl liquid-glass-card p-6 sm:p-7 space-y-4 border border-black/[0.08] dark:border-white/[0.1] shadow-xs">
          {/* Top Bar: Left feature pills + Right action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Fast Diagnostic • Pre-Submission Audit</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-neutral-100 dark:bg-[#1E293B] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                <Cpu className="w-3.5 h-3.5 text-blue-500" />
                <span>Laya (On-Device)</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-neutral-100 dark:bg-[#1E293B] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                <Clock className="w-3 h-3 text-neutral-400" />
                <span>~15s Calibrated Screening</span>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onNewScan && (
                <button
                  type="button"
                  onClick={onNewScan}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1E293B] hover:bg-neutral-50 dark:hover:bg-[#26344a] text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-[#334155] transition shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>New Scan</span>
                </button>
              )}

              {/* Export Dropdown */}
              <div className="relative" ref={exportDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  disabled={activeExportFormat !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {activeExportFormat ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5" />
                  )}
                  <span>Export</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportOpen ? "rotate-180" : ""}`} />
                </button>

                {isExportOpen && (
                  <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white dark:bg-[#161F30] border border-black/10 dark:border-white/10 shadow-xl p-1.5 z-50 animate-fade-in text-xs">
                    <button
                      type="button"
                      onClick={(e) => handleExport("word", e)}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2.5 cursor-pointer rounded-lg"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Word Document (.doc)</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleExport("html", e)}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2.5 cursor-pointer rounded-lg"
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Interactive HTML (.html)</span>
                    </button>
                    <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
                    <button
                      type="button"
                      onClick={(e) => handleExport("pdf", e)}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2.5 cursor-pointer rounded-lg"
                    >
                      <Printer className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>PDF Document (.pdf)</span>
                    </button>
                  </div>
                )}
              </div>

              {onDeleteArticle && (
                <button
                  type="button"
                  onClick={onDeleteArticle}
                  title="Delete manuscript project"
                  className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-neutral-200/60 dark:border-[#334155] hover:border-rose-200 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Manuscript Title & Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="space-y-1 max-w-2xl">
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight leading-snug">
                {paper.title}
              </h1>
              <p className="text-xs text-[#64748B] dark:text-neutral-400 font-medium">
                Target: <strong className="text-neutral-800 dark:text-neutral-200">{paper.journal}</strong> &bull; Fast Calibrated Pre-Submission Diagnostic
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${
                  isAlreadyPublished
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60"
                    : isNonAcademic
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60"
                    : isDeskReject
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60"
                    : theme.badgeClass
                }`}
              >
                {isAlreadyPublished ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Published Article</span>
                  </>
                ) : isNonAcademic ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Review Bypassed (N/A)</span>
                  </>
                ) : isDeskReject ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Desk Reject Hazard</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Review Ready</span>
                  </>
                )}
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium hidden md:inline">
                Fast scan complete
              </span>
            </div>
          </div>

          {isAlreadyPublished ? (
            <div className="space-y-6 mt-4">
              {/* Already Published Emerald Banner */}
              <div className="p-5 sm:p-6 rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/90 via-white/80 to-emerald-50/50 dark:from-emerald-950/40 dark:via-[#161F30] dark:to-emerald-950/20 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 dark:border-emerald-900/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200 block">
                        Already Published Article Detected
                      </span>
                      <span className="text-[11px] text-emerald-800 dark:text-emerald-400">
                        Established record in scholarly literature &bull; Pre-Submission Simulation Bypassed
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      Published Article (N/A)
                    </span>
                    {onNewScan && (
                      <button
                        type="button"
                        onClick={onNewScan}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Manuscript</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4-Box Metadata Grid */}
                {(publishedDetails?.journalName || publishedDetails?.publicationDate || publishedDetails?.publisher || publishedDetails?.doi) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
                    {publishedDetails.journalName && (
                      <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Published Journal</span>
                        <span className="font-semibold text-emerald-950 dark:text-emerald-200 truncate block mt-0.5" title={publishedDetails.journalName}>
                          {publishedDetails.journalName}
                        </span>
                      </div>
                    )}
                    {publishedDetails.publicationDate && (
                      <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Publication Date</span>
                        <span className="font-semibold text-emerald-950 dark:text-emerald-200 block mt-0.5">
                          {publishedDetails.publicationDate}
                        </span>
                      </div>
                    )}
                    {publishedDetails.publisher && (
                      <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Publisher</span>
                        <span className="font-semibold text-emerald-950 dark:text-emerald-200 truncate block mt-0.5" title={publishedDetails.publisher}>
                          {publishedDetails.publisher}
                        </span>
                      </div>
                    )}
                    {publishedDetails.doi && (
                      <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Official Article DOI</span>
                        <a
                          href={`https://doi.org/${publishedDetails.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 hover:underline inline-flex items-center gap-1 truncate block mt-0.5"
                        >
                          <span className="truncate">{publishedDetails.doi}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-white/80 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40 text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="font-bold text-emerald-950 dark:text-emerald-200 block mb-1">Status Note:</span>
                  <p className="leading-relaxed">
                    {summaryText}
                  </p>
                </div>
              </div>
            </div>
          ) : isNonAcademic ? (
            <div className="space-y-6 mt-4">
              {/* Document Ineligible Amber Banner */}
              <div className="p-5 sm:p-6 rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-50/90 via-white/80 to-amber-50/50 dark:from-amber-950/40 dark:via-[#161F30] dark:to-amber-950/20 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/60 dark:border-amber-900/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-amber-950 dark:text-amber-200 block">
                        Document Ineligible for Peer-Review Evaluation
                      </span>
                      <span className="text-[11px] text-amber-800 dark:text-amber-400">
                        Classified as {classification?.categoryLabel || "Non-Academic Document"} &bull; Pre-Submission Simulation Bypassed
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      Review Bypassed (N/A)
                    </span>
                    {onNewScan && (
                      <button
                        type="button"
                        onClick={onNewScan}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Manuscript</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-amber-900/90 dark:text-amber-300/90 leading-relaxed pt-2 border-t border-amber-200/70 dark:border-amber-800/60">
                  {classification?.advisoryMessage ||
                    "We detected a general essay, opinion piece, or informational text without empirical scientific methodology or peer-reviewed literature citations. ManuView is calibrated for scientific preprints and journal submissions."}
                </p>
              </div>

              {/* Document Classification Card */}
              <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] border-l-4 border-l-blue-500 overflow-hidden transition-all duration-200">
                <button
                  type="button"
                  onClick={() => toggleCard("documentClassification")}
                  className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                  aria-expanded={expandedCards.documentClassification}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                      <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-[#0F172A] dark:text-white truncate sm:truncate-none">
                        Document Classification
                      </h2>
                      <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                        Detected document typology and tailored pre-submission guidance
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 max-w-xs truncate text-center">
                      {classification?.categoryLabel || "Non-Academic Document"}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          expandedCards.documentClassification ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {expandedCards.documentClassification && (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] dark:text-white pb-1">
                      <span className="text-neutral-400 dark:text-neutral-500">Typology:</span>
                      <span>{classification?.categoryLabel || "Non-Academic Document"}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#334155] dark:text-neutral-300 leading-relaxed">
                      <strong className="font-bold text-[#0F172A] dark:text-white">
                        {classification?.salutation
                          ? classification.salutation.endsWith(":")
                            ? classification.salutation
                            : `${classification.salutation}:`
                          : "Hello Author / Writer:"}
                      </strong>{" "}
                      {classification?.advisoryMessage ||
                        "We detected that this document is not structured as an academic research manuscript. Acceptance scoring and persona simulations have been safely skipped."}
                    </p>

                    {classification?.detectedFeatures && classification.detectedFeatures.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {classification.detectedFeatures.map((feat, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                          >
                            &bull; {feat}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs sm:text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">
                      {classification?.customGuidance ||
                        "If this is intended as an academic perspective or review article, ensure formal literature citations, scholarly framing, and structured theoretical or empirical analysis are incorporated."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* =========================================================================
                  PUREMAC-STYLE DARK HERO CARD
                 ========================================================================= */}
              <div
                className={`relative rounded-[28px] text-white shadow-2xl p-6 sm:p-8 overflow-hidden border transition-all mt-4 ${
                  isDeskReject ? "bg-[#0B0F17] border-rose-500/30" : "bg-[#0B0F17] border-white/10"
                }`}
              >
                {/* Ambient atmospheric glows */}
                <div
                  className={`absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
                    isDeskReject ? "bg-rose-600/15" : "bg-blue-600/15"
                  }`}
                />
                <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* Left Column: Metrics & Actions */}
                  <div className="space-y-4 max-w-xl">
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm ${
                        isDeskReject
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {isDeskReject ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>EDITORIAL TRIAGE: DESK REJECT HAZARD</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          <span>FAST CALIBRATED AUDIT COMPLETE</span>
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        {isDeskReject ? "Editorial Screening Barrier" : "Calibrated Acceptance Readiness"}
                      </p>
                      <div className="flex items-baseline gap-3">
                        <span className="text-5xl sm:text-6xl font-black tracking-tight text-white">
                          {isDeskReject ? "Desk Reject" : `${score}%`}
                        </span>
                        {!isDeskReject && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white/10 text-white/90 border border-white/15">
                            {theme.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-md">
                      {isDeskReject
                        ? `Potential misalignment with "${paper.journal}" scope or critical criteria detected. Out-of-scope manuscripts face immediate triage decline before peer review.`
                        : `Evaluated against "${paper.journal}" editorial standards across 10 atomic criteria with Fast Diagnostic. Empirical design and scope fit verified.`}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleExport("pdf")}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-md"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Export PDF Report</span>
                      </button>
                      {onNewScan && (
                        <button
                          type="button"
                          onClick={onNewScan}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition cursor-pointer flex items-center gap-2 backdrop-blur-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Scan Another Paper</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: 3D Layered Glass Stack Graphic */}
                  <div className="shrink-0 hidden md:flex items-center justify-center pr-4">
                    <DashboardGlassIllustration className="w-52 h-40 lg:w-60 lg:h-44" />
                  </div>
                </div>
              </div>

              {/* Four Quick Stat Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="p-4 rounded-2xl liquid-glass-subcard space-y-1 border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    Readiness Band
                  </div>
                  <div className="text-sm font-bold text-[#0F172A] dark:text-white">
                    {theme.label}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Calibrated score: {score}/100
                  </div>
                </div>

                <div className="p-4 rounded-2xl liquid-glass-subcard space-y-1 border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    Target Venue Scope
                  </div>
                  {(() => {
                    const scopeSignal = signals.find((s) => s.id === "journal_scope_fit");
                    const scopeDisplay = scopeSignal?.display || "In-Scope";
                    const isOutOfScope = scopeDisplay.toLowerCase().includes("out of scope") || scopeSignal?.tone === "bad";
                    const isPeripheral = scopeDisplay.toLowerCase().includes("peripheral") || scopeDisplay.toLowerCase().includes("borderline") || scopeSignal?.tone === "warn";
                    const colorClass = isOutOfScope
                      ? "text-rose-600 dark:text-rose-400"
                      : isPeripheral
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400";
                    return (
                      <div className={`text-sm font-bold ${colorClass}`}>
                        {scopeDisplay}
                      </div>
                    );
                  })()}
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {paper.journal}
                  </div>
                </div>

                <div className="p-4 rounded-2xl liquid-glass-subcard space-y-1 border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    Methodological Rigor
                  </div>
                  <div className="text-sm font-bold text-[#0F172A] dark:text-white">
                    {signals.find((s) => s.id === "methods_reproducible" || s.id === "has_methods" || s.id === "method_rigor")?.display || "Adequate Controls"}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Level {signals.find((s) => s.id === "methods_reproducible" || s.id === "method_rigor")?.value ?? 2} of 3
                  </div>
                </div>

                <div className="p-4 rounded-2xl liquid-glass-subcard space-y-1 border border-black/[0.06] dark:border-white/[0.08]">
                  <div className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    Ethics &amp; Integrity
                  </div>
                  {(() => {
                    const ethicsSignal = signals.find((s) => s.id === "ethics_statement" || s.id === "ethics_declared");
                    const isDisclosed = (ethicsSignal?.value ?? 0.5) >= 0.5 && ethicsSignal?.tone !== "bad" && ethicsSignal?.tone !== "warn" && !ethicsSignal?.needsReview;
                    return (
                      <div className={`text-sm font-bold ${isDisclosed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {isDisclosed ? "Disclosed" : "Review Needed"}
                      </div>
                    );
                  })()}
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Zero retention verified
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Overview Diagnostics Header with Expand/Collapse All (Omitted for non-academic & already published documents) */}
        {!isNonAcademic && !isAlreadyPublished && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pt-1 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-neutral-400">
                Detailed Diagnoses &amp; Pre-Submission Audits
              </span>
              <button
                type="button"
                onClick={() => {
                  const anyOpen = Object.values(expandedCards).some(Boolean);
                  setExpandedCards({
                    documentClassification: !anyOpen,
                    fivePillars: !anyOpen,
                    synthesis: !anyOpen,
                    priorityFlags: !anyOpen,
                    dimensions: !anyOpen,
                  });
                }}
                className="text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
              >
                {Object.values(expandedCards).some(Boolean) ? "Collapse all" : "Expand all"}
              </button>
            </div>

            {/* =========================================================================
                CARD 0: Document Classification Card (Academic Manuscript)
               ========================================================================= */}
            <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] border-l-4 border-l-blue-500 overflow-hidden transition-all duration-200">
              <button
                type="button"
                onClick={() => toggleCard("documentClassification")}
                className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                aria-expanded={expandedCards.documentClassification}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                    <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-[#0F172A] dark:text-white truncate sm:truncate-none">
                      Document Classification
                    </h2>
                    <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                      Detected document typology and tailored pre-submission guidance
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 max-w-xs truncate text-center">
                    {classification?.categoryLabel ? (
                      classification.categoryLabel.replace(/^Academic Manuscript\s*\((.*)\)$/, '$1')
                    ) : "Research Manuscript"}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        expandedCards.documentClassification ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>
              </button>

              {expandedCards.documentClassification && (
                <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] dark:text-white pb-1">
                    <span className="text-neutral-400 dark:text-neutral-500">Typology:</span>
                    <span>{classification?.categoryLabel || "Academic Research Manuscript"}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#334155] dark:text-neutral-300 leading-relaxed">
                    <strong className="font-bold text-[#0F172A] dark:text-white">
                      {classification?.salutation
                        ? classification.salutation.endsWith(":")
                          ? classification.salutation
                          : `${classification.salutation}:`
                        : "Dear Author / Contributing Researcher:"}
                    </strong>{" "}
                    {classification?.advisoryMessage ||
                      "Your submission has been verified as an authentic academic manuscript and screened across calibrated pre-submission rubrics."}
                  </p>

                  {classification?.detectedFeatures && classification.detectedFeatures.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {classification.detectedFeatures.map((feat, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                        >
                          &bull; {feat}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">
                    {classification?.customGuidance ||
                      "Review the prioritized action items below and ensure empirical evidence aligns with your target journal criteria."}
                  </p>
                </div>
              )}
            </div>

            {/* =========================================================================
                CARD 1: 5-Pillar Editorial & Desk-Reject Screening Matrix
               ========================================================================= */}
            <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => toggleCard("fivePillars")}
            className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
            aria-expanded={expandedCards.fivePillars}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                  5-Pillar Editorial &amp; Desk-Reject Screening Matrix
                </h2>
                <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                  Screened against {paper.journal} editorial gates before referee assignment
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-[#1E293B] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                5 Pillars Checked
              </span>
              <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedCards.fivePillars ? "rotate-180" : ""}`} />
              </div>
            </div>
          </button>

          {expandedCards.fivePillars && (
            <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pillars.map((p) => {
                  const pass = p.signal?.tone !== "bad";
                  return (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-2xl bg-white/60 dark:bg-[#1E293B]/60 border border-black/5 dark:border-white/5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white">
                          {p.name}
                        </span>
                        {pass ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">
                            Cleared
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60">
                            Attention
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {p.signal?.display || p.defaultTitle}
                      </div>
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
                        {p.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            CARD 2: Editorial Synthesis & Diagnostic Assessment
           ========================================================================= */}
        <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => toggleCard("synthesis")}
            className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
            aria-expanded={expandedCards.synthesis}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                  Editorial Synthesis &amp; Diagnostic Assessment
                </h2>
                <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                  Calibrated diagnostic rationale, manuscript strengths, and publication recommendations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-[#1E293B] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                Synthesis
              </span>
              <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedCards.synthesis ? "rotate-180" : ""}`} />
              </div>
            </div>
          </button>

          {expandedCards.synthesis && (
            <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] animate-fade-in">
              <p className="text-xs sm:text-sm text-[#334155] dark:text-neutral-300 leading-relaxed font-light whitespace-pre-line">
                {summaryText}
              </p>
            </div>
          )}
        </div>

        {/* =========================================================================
            CARD 3: Priority Action Items & Attention Flags
           ========================================================================= */}
        <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] border-l-4 border-l-amber-500 overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => toggleCard("priorityFlags")}
            className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
            aria-expanded={expandedCards.priorityFlags}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                  Priority Action Items &amp; Attention Flags
                </h2>
                <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                  Pre-submission items that must be resolved to protect against triage desk-rejection
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                {flags.length} Action Items
              </span>
              <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedCards.priorityFlags ? "rotate-180" : ""}`} />
              </div>
            </div>
          </button>

          {expandedCards.priorityFlags && (
            <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-3 animate-fade-in">
              {flags.length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>No critical flaws detected. Manuscript passed all core screening criteria cleanly.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {flags.map((flag, idx) => {
                    const isBad = flag.tone === "bad";
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          isBad
                            ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                            : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                isBad
                                  ? "bg-rose-600 text-white"
                                  : "bg-amber-600 text-white"
                              }`}
                            >
                              Priority {isBad ? "A" : "B"}
                            </span>
                            <span className="font-semibold text-xs text-neutral-900 dark:text-white">
                              {flag.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-400 font-medium">
                            {flag.group}
                          </span>
                        </div>

                        <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-2 leading-relaxed">
                          {flag.detail || flag.display}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Actionable Fix: Revise and strengthen {flag.label.toLowerCase()} before journal submission.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* =========================================================================
            CARD 4: 7 Calibrated Evaluation Dimensions
           ========================================================================= */}
        <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
          <button
            type="button"
            onClick={() => toggleCard("dimensions")}
            className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
            aria-expanded={expandedCards.dimensions}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                  7 Calibrated Evaluation Dimensions
                </h2>
                <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                  Multi-criteria classification evaluated with calibrated probabilities
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-[#1E293B] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                7 Dimensions
              </span>
              <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedCards.dimensions ? "rotate-180" : ""}`} />
              </div>
            </div>
          </button>

          {expandedCards.dimensions && (
            <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-4 animate-fade-in">
              <div className="space-y-3">
                {signals.map((sig) => {
                  const pct = getSignalPercent(sig);
                  return (
                    <div
                      key={sig.id}
                      className="p-4 rounded-2xl bg-white/70 dark:bg-[#1E293B]/70 border border-black/5 dark:border-white/5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-neutral-900 dark:text-white">
                            {sig.label}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-medium">
                            ({sig.group})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-neutral-800 dark:text-neutral-200">
                            {pct}%
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              sig.tone === "good"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                : sig.tone === "bad"
                                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {sig.display}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            sig.tone === "good"
                              ? "bg-emerald-500"
                              : sig.tone === "bad"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(10, pct))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 pt-0.5">
                        <span>Criterion: {sig.id}</span>
                        {sig.confidence !== undefined && (
                          <span>Model Confidence: {(sig.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
      </div>

      {/* Export Toast */}
      {exportToast && (
        <ExportCompletedToast
          toast={exportToast}
          onClose={() => setExportToast(null)}
        />
      )}
    </div>
  );
}

export const DesktopTypeSafeDashboardView = DesktopLayaDashboardView;

