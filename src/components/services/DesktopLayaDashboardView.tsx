"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
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
  Users,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Copy,
  Layers,
} from "lucide-react";
import type { PaperItem, DesktopActiveView } from "@/components/DesktopSidebar";
import type { LayaScanResult, ScanSignal, TypeSafeScanResult } from "@/lib/laya/laya-scan";
import { DashboardGlassIllustration } from "@/components/dashboard/DashboardGlassIllustration";
import { EditorialTriageBanner } from "@/components/dashboard/EditorialTriageBanner";
import {
  exportInteractiveHtmlReport,
  exportWordDocReport,
  exportPdfReport,
  exportBibTeX,
} from "@/lib/export-generator";
import { ExportCompletedToast, type ExportToastData } from "@/components/ExportCompletedToast";
import type {
  FullReviewReport,
  DimensionScore,
  DocumentClassification,
  ReviewerPersonaFeedback,
  PriorityIssue,
  CitationIntegritySummary,
  JournalRecommendation,
  ReferenceVerification,
  ReferenceStatus,
} from "@/lib/types";
import { DashboardPersonasSection } from "@/components/dashboard/DashboardPersonasSection";
import { DashboardDimensionsSection } from "@/components/dashboard/DashboardDimensionsSection";
import { DashboardIssuesSection } from "@/components/dashboard/DashboardIssuesSection";
import { DashboardJournalsSection } from "@/components/dashboard/DashboardJournalsSection";
import { DashboardCitationsSection } from "@/components/dashboard/DashboardCitationsSection";
import { findMatchingJournals } from "@/lib/journals";
import { openJournalWebsite } from "@/lib/journal-scope-service";
import { computeCitationIntegrity } from "@/lib/engine/citation-audit";
import { extractReferencesFromText } from "@/lib/utils";
import { checkRetractionStatus } from "@/lib/retractions";

export interface DesktopLayaDashboardViewProps {
  paper: PaperItem;
  scanResult?: LayaScanResult;
  fullReport?: FullReviewReport | null;
  activeView?: DesktopActiveView;
  onSelectView?: (view: DesktopActiveView) => void;
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
  fullReport,
  activeView,
  onSelectView,
  onOpenSettings,
  onNewScan,
  onDeleteArticle,
}: DesktopLayaDashboardViewProps) {
  const result: LayaScanResult | undefined = scanResult || paper.layaResult || paper.typesafeResult;

  const [currentView, setCurrentView] = useState<DesktopActiveView>(activeView || "overview");
  useEffect(() => {
    if (activeView) {
      setCurrentView(activeView);
    }
  }, [activeView]);

  const handleSelectView = (view: DesktopActiveView) => {
    setCurrentView(view);
    onSelectView?.(view);
  };

  const [selectedPersona, setSelectedPersona] = useState<number>(0);
  const [copiedReportIndex, setCopiedReportIndex] = useState<number | null>(null);
  const [copiedSnippetIndex, setCopiedSnippetIndex] = useState<number | null>(null);

  const handleCopyRefereeReport = (p: ReviewerPersonaFeedback, idx: number) => {
    let md = `# Formal Referee Diagnostic Report: ${p.name}\n\n`;
    md += `**Referee Role**: ${p.title} (${p.affiliation})\n`;
    md += `**Area of Expertise**: ${p.expertise}\n`;
    md += `**Triage Recommendation**: **${p.decisionRecommendation}**\n\n`;
    md += `## Key Evaluation Challenge\n> ${p.keyChallenge}\n\n`;
    md += `## Detailed Assessment\n${p.assessment}\n\n`;
    if (p.strengths && p.strengths.length > 0) {
      md += `## Core Strengths\n`;
      p.strengths.forEach((s) => {
        md += `- ${s}\n`;
      });
      md += `\n`;
    }
    if (p.majorCritiques && p.majorCritiques.length > 0) {
      md += `## Critical Deficiencies\n`;
      p.majorCritiques.forEach((c) => {
        md += `- ${c}\n`;
      });
      md += `\n`;
    }
    if (p.concreteSolutions && p.concreteSolutions.length > 0) {
      md += `## Actionable Fixes & Solutions\n`;
      p.concreteSolutions.forEach((sol, i) => {
        md += `### ${i + 1}. Issue: ${sol.issue}\n- **Proposed Fix**: ${sol.proposedFix}\n\n`;
      });
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(md);
      setCopiedReportIndex(idx);
      setTimeout(() => setCopiedReportIndex(null), 2500);
    }
  };

  const handleCopySnippet = (text: string, snippetIdx: number) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedSnippetIndex(snippetIdx);
      setTimeout(() => setCopiedSnippetIndex(null), 2000);
    }
  };

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    }
    if (isExportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportOpen]);

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

  // Resolve references dynamically from fullReport, result, or raw text
  const resolvedReferences: ReferenceVerification[] = useMemo(() => {
    if (fullReport?.citationIntegrity?.references && fullReport.citationIntegrity.references.length > 0) {
      return fullReport.citationIntegrity.references;
    }
    if ((result as any)?.citationIntegrity?.references && (result as any).citationIntegrity.references.length > 0) {
      return (result as any).citationIntegrity.references;
    }
    const rawText = paper.scanParams?.rawText || "";
    if (rawText) {
      const extracted = extractReferencesFromText(rawText);
      if (extracted.length > 0) {
        return extracted.map((raw) => {
          const doiMatch = raw.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
          const doi = doiMatch ? doiMatch[1].replace(/[.,;)\]]+$/, "") : undefined;
          const yearMatch = raw.match(/\b(19\d\d|20\d\d)\b/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
          const quoteMatch = raw.match(/["“]([^"”]+)["”]/);
          let title: string | undefined = quoteMatch ? quoteMatch[1] : undefined;
          if (!title) {
            const parts = raw.split(/\.\s+/);
            if (parts.length >= 2) title = parts[1];
          }

          const retraction = checkRetractionStatus(doi, raw);
          const status: ReferenceStatus = retraction.isRetracted
            ? "retracted"
            : retraction.isExpressionOfConcern
            ? "expression_of_concern"
            : "valid";

          return {
            raw,
            doi,
            year,
            title: title || raw,
            status,
            isRetracted: retraction.isRetracted,
            isRetractionNotice: retraction.isRetractionNotice,
            retractionDetails: retraction.reason,
            resolutionMethod: doi ? ("doi" as const) : ("bibliographic_search" as const),
          };
        });
      }
    }
    return [];
  }, [fullReport, result, paper.scanParams?.rawText]);

  // Citation integrity state
  const [activeCitationIntegrity, setActiveCitationIntegrity] = useState<CitationIntegritySummary>(() => {
    if (fullReport?.citationIntegrity && fullReport.citationIntegrity.references.length > 0) {
      return fullReport.citationIntegrity;
    }
    if ((result as any)?.citationIntegrity && (result as any).citationIntegrity.references.length > 0) {
      return (result as any).citationIntegrity;
    }
    if (resolvedReferences.length > 0) {
      return computeCitationIntegrity(resolvedReferences, resolvedReferences.length);
    }
    return {
      totalReferences: 0,
      sampledCount: 0,
      checkedCount: 0,
      verifiedCount: 0,
      unresolvableCount: 0,
      uncheckedCount: 0,
      retractedCount: 0,
      retractionCheckAvailable: true,
      selfCitationRatio: 0,
      recencyProfile: { last5YearsPercent: 0, olderThan5YearsPercent: 0 },
      coverageNote: "No bibliography references detected in manuscript text.",
      references: [],
    };
  });

  useEffect(() => {
    if (fullReport?.citationIntegrity && fullReport.citationIntegrity.references.length > 0) {
      setActiveCitationIntegrity(fullReport.citationIntegrity);
    } else if ((result as any)?.citationIntegrity && (result as any).citationIntegrity.references.length > 0) {
      setActiveCitationIntegrity((result as any).citationIntegrity);
    } else if (resolvedReferences.length > 0) {
      setActiveCitationIntegrity(computeCitationIntegrity(resolvedReferences, resolvedReferences.length));
    }
  }, [fullReport?.citationIntegrity, (result as any)?.citationIntegrity, resolvedReferences]);

  const handleUpdateCitationIntegrity = (updated: CitationIntegritySummary) => {
    setActiveCitationIntegrity(updated);
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
      reviewerPersonas: (scanResult?.reviewerPersonas && scanResult.reviewerPersonas.length >= 5)
        ? scanResult.reviewerPersonas
        : [
            {
              persona: "journal_editor",
              name: "Reviewer 1: Lead Handling Editor",
              title: `Senior Handling Editor (${paper.journal})`,
              affiliation: `Editorial Review Board, ${paper.journal}`,
              expertise: "Aims & Scope, Desk-Reject Triage & Editorial Standards",
              roleDescription: "Aims & Scope Screening",
              decisionRecommendation: isDeskReject
                ? "Desk Reject"
                : score >= 80
                ? "Minor Revision"
                : "Major Revision",
              keyChallenge: isDeskReject
                ? "Disciplinary scope mismatch with target journal remit"
                : flags[0]?.detail || "Aims and scope alignment with target journal readership",
              assessment: summaryText,
              strengths: [
                "Manuscript organization adheres to academic IMRaD conventions.",
                "Presents identifiable empirical research questions and objectives.",
              ],
              majorCritiques: isDeskReject
                ? [`Topic diverges from editorial scope of ${paper.journal}. Retarget submission.`]
                : flags.filter((f) => f.tone === "bad").map((f) => f.detail || `${f.label}: ${f.display}`),
              concreteSolutions: [
                {
                  issue: isDeskReject ? "Scope mismatch" : "Editorial framing",
                  proposedFix: isDeskReject
                    ? "Redirect submission to a specialist venue aligned with this discipline."
                    : "Sharpen abstract takeaway metrics to emphasize direct empirical contributions.",
                },
              ],
              missingControlsOrAnalyses: [],
              mustAddressItems: isDeskReject
                ? ["Consult the Target Journals tab to retarget before formal submission."]
                : [],
              minorComments: [],
              source: "llm",
              evidenceAnchors: [],
              counterArguments: [],
            },
            {
              persona: "domain_expert",
              name: "Reviewer 2: Target Domain Specialist",
              title: "Senior Subject Matter Referee",
              affiliation: "Specialist Editorial Board",
              expertise: "Theoretical Advance & Domain State-of-the-Art",
              roleDescription: "Domain Depth Evaluation",
              decisionRecommendation: score >= 75 ? "Minor Revision" : "Major Revision",
              keyChallenge: "Theoretical and empirical contribution to domain literature",
              assessment: `Domain evaluation indicates structured academic grounding for ${paper.journal}. Literature positioning is established.`,
              strengths: [
                "Grounds the study within contemporary academic literature.",
                "Addresses a clearly defined research challenge.",
              ],
              majorCritiques: [
                "Delineate clear differences from existing published baselines in introduction.",
              ],
              concreteSolutions: [
                {
                  issue: "Baseline comparison",
                  proposedFix: "Include an explicit comparison against existing state-of-the-art benchmarks in discussion.",
                },
              ],
              missingControlsOrAnalyses: [],
              mustAddressItems: [],
              minorComments: [],
              source: "llm",
              evidenceAnchors: [],
              counterArguments: [],
            },
            {
              persona: "methods_reviewer",
              name: "Reviewer 3: Research Methodology Referee",
              title: "Methodological Referee",
              affiliation: "Academic Panel",
              expertise: "Experimental Design, Controls & Reproducibility",
              roleDescription: "Methodology Verification",
              decisionRecommendation: score >= 70 ? "Minor Revision" : "Major Revision",
              keyChallenge: "Procedural controls, replication protocol, and data transparency",
              assessment: "Methodological soundness evaluated by on-device decision model. Core controls and parameters verified.",
              strengths: [
                "Methodological procedures and experimental parameters are documented.",
                "Design conforms to standard domain conventions.",
              ],
              majorCritiques: [
                "Document full environment parameters, cohort inclusion criteria, and random seeds to guarantee independent reproduction.",
              ],
              concreteSolutions: [
                {
                  issue: "Reproducibility documentation",
                  proposedFix: "Add comprehensive reproducibility parameters and link data repository with persistent DOI.",
                },
              ],
              missingControlsOrAnalyses: [],
              mustAddressItems: [],
              minorComments: [],
              source: "llm",
              evidenceAnchors: [],
              counterArguments: [],
            },
            {
              persona: "statistician",
              name: "Reviewer 4: Statistical & Quantitative Auditor",
              title: "Quantitative Auditor",
              affiliation: "Academic Panel",
              expertise: "Statistical Testing, Effect Sizes & Uncertainty Bounds",
              roleDescription: "Quantitative Rigor",
              decisionRecommendation: score >= 75 ? "Minor Revision" : "Major Revision",
              keyChallenge: "Statistical power, confidence intervals, and effect size reporting",
              assessment: "Numerical reporting and claims-vs-evidence evaluated across empirical sections.",
              strengths: [
                "Reports quantitative metrics and substantiates claims with empirical data.",
              ],
              majorCritiques: [
                "Report exact p-values accompanied by 95% confidence intervals and effect sizes.",
              ],
              concreteSolutions: [
                {
                  issue: "Exact statistical values",
                  proposedFix: "Provide exact p-values (e.g., p = 0.003) and confidence intervals rather than isolated inequality statements.",
                },
              ],
              missingControlsOrAnalyses: [],
              mustAddressItems: [],
              minorComments: [],
              source: "llm",
              evidenceAnchors: [],
              counterArguments: [],
            },
            {
              persona: "devils_advocate",
              name: "Reviewer 5: Adversarial Translation Referee",
              title: "Adversarial Translation Referee",
              affiliation: "Academic Panel",
              expertise: "Falsification, Robustness & Threats to Validity",
              roleDescription: "Stress-Testing Claims",
              decisionRecommendation: isDeskReject ? "Desk Reject" : "Major Revision",
              keyChallenge: "Generalizability, unstated assumptions, and alternative interpretations",
              assessment: "Critical stress-testing of central claims, boundary conditions, and threats to internal validity.",
              strengths: [
                "Central hypotheses and conclusions are clearly articulated.",
              ],
              majorCritiques: [
                "Ensure conclusions do not overclaim beyond empirical data; articulate boundary conditions and limitations.",
              ],
              concreteSolutions: [
                {
                  issue: "Threats to validity",
                  proposedFix: "Add a dedicated 'Limitations & Threats to Validity' subsection prior to discussion.",
                },
              ],
              missingControlsOrAnalyses: [],
              mustAddressItems: [],
              minorComments: [],
              source: "llm",
              evidenceAnchors: [],
              counterArguments: [],
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
      citationIntegrity: activeCitationIntegrity,
    };
  }, [paper, result, score, isDeskReject, signals, flags, summaryText, scanResult?.reviewerPersonas, activeCitationIntegrity]);

  // Match journals from catalog to guarantee 3 tiered cards + 10+ list matches
  const matchingJournalsData = useMemo(() => {
    return findMatchingJournals(
      paper.title,
      typeof summaryText === "string" ? summaryText : "",
      paper.journal,
      []
    );
  }, [paper.title, summaryText, paper.journal]);

  const displayJournals = useMemo(() => {
    return [
      {
        tier: "Reach" as const,
        journalName: matchingJournalsData.reach.name,
        impactFactor: matchingJournalsData.reach.impactFactor,
        publisher: matchingJournalsData.reach.publisher,
        fitScore: matchingJournalsData.reachFitScore,
        scopeRationale: matchingJournalsData.reach.aimsAndScope,
        rejectionRisks: matchingJournalsData.reach.deskRejectHazards,
        requiredRevisionsForFit: matchingJournalsData.reach.keyExpectations,
      },
      {
        tier: "Realistic" as const,
        journalName: matchingJournalsData.realistic.name,
        impactFactor: matchingJournalsData.realistic.impactFactor,
        publisher: matchingJournalsData.realistic.publisher,
        fitScore: matchingJournalsData.realisticFitScore,
        scopeRationale: matchingJournalsData.realistic.aimsAndScope,
        rejectionRisks: matchingJournalsData.realistic.deskRejectHazards,
        requiredRevisionsForFit: matchingJournalsData.realistic.keyExpectations,
      },
      {
        tier: "Fallback" as const,
        journalName: matchingJournalsData.fallback.name,
        impactFactor: matchingJournalsData.fallback.impactFactor,
        publisher: matchingJournalsData.fallback.publisher,
        fitScore: matchingJournalsData.fallbackFitScore,
        scopeRationale: matchingJournalsData.fallback.aimsAndScope,
        rejectionRisks: matchingJournalsData.fallback.deskRejectHazards,
        requiredRevisionsForFit: matchingJournalsData.fallback.keyExpectations,
      },
    ];
  }, [matchingJournalsData]);

  const otherJournals = useMemo(() => {
    return matchingJournalsData.otherMatches || [];
  }, [matchingJournalsData]);

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

  const isIneligible = Boolean(isAlreadyPublished || isNonAcademic);

  const renderActionButtons = () => (
    <div className="flex items-center gap-2 shrink-0">
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
  );

  return (
    <div className="flex-1 overflow-y-auto text-[#1E293B] dark:text-[#E2E8F0]">
      {/* ========================================================= */}
      {/* STICKY TOP TAB NAVIGATION BAR (FIXED ON SCROLL)           */}
      {/* ========================================================= */}
      {!isIneligible && (
        <div className="sticky top-0 z-40 px-6 sm:px-10 py-3 transition-colors pointer-events-none">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 pointer-events-auto">
            {/* Tab Navigation (Pill container) */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/80 dark:bg-[#161F30]/80 border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md overflow-x-auto no-scrollbar shadow-xs">
              <button
                type="button"
                onClick={() => handleSelectView("overview")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  currentView === "overview"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectView("personas")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  currentView === "personas"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>5 Reviewers</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectView("dimensions")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  currentView === "dimensions"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>6 Dimensions &amp; Radar</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectView("issues")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  currentView === "issues"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Priority Issues ({effectiveReport.priorityIssues?.length || flags.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectView("journals")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  currentView === "journals" || currentView === "recommendations"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Target Journals</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectView("citations")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  currentView === "citations"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Retraction Shield</span>
              </button>
            </div>

            {/* Right Action Buttons: Export Dropdown + Delete */}
            {renderActionButtons()}
          </div>
        </div>
      )}

      {/* Main Content Area (Scrolls Underneath) */}
      <div className={isIneligible ? "p-6 sm:p-10 pt-4" : "p-6 sm:p-10 pt-2"}>
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
          {/* ========================================================= */}
          {/* TAB 1: OVERVIEW                                           */}
          {/* ========================================================= */}
          {currentView === "overview" && (
            <div className="space-y-6">
              {/* CARD 1: ManuView Diagnostic Suite Header Card */}
              <div className="rounded-3xl liquid-glass-card p-6 sm:p-8 space-y-6">
                {/* Brand line & Target badge */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]/80 dark:border-[#1F2937]">
                  <div className="flex items-center">
                    <span className="font-bold text-base tracking-tight text-[#0F172A] dark:text-white">
                      Manu<span className="text-[#2563EB] dark:text-blue-400">View</span> Diagnostic Suite
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openJournalWebsite(paper.journal)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EFF6FF] dark:bg-blue-950/50 border border-[#BFDBFE]/70 dark:border-blue-800/70 text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
                      title="Click to visit official journal website via OpenAlex"
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Target: {paper.journal}</span>
                    </button>

                    {isIneligible && renderActionButtons()}
                  </div>
                </div>

                {/* Manuscript Title & Status Header (PureMac style) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="space-y-1 max-w-2xl">
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight leading-snug">
                      {paper.title}
                    </h1>
                    <p className="text-xs text-[#64748B] dark:text-neutral-400 font-medium">
                      Target: <strong className="text-neutral-800 dark:text-neutral-200">{paper.journal}</strong> &bull; Peer-Review Calibrated Pre-Submission Diagnostic
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${
                        isDeskReject
                          ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60"
                          : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60"
                      }`}
                    >
                      {isDeskReject ? (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Desk Reject Hazard</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Review ready</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium hidden md:inline">
                      Local scan complete
                    </span>
                  </div>
                </div>

                {/* Acceptance Potential Banner OR Ineligibility / Desk Reject Banner */}
                <EditorialTriageBanner
                  isDeskReject={isDeskReject}
                  isAlreadyPublished={isAlreadyPublished}
                  isNonAcademic={isNonAcademic}
                  editorialTriage={effectiveReport.editorialTriage}
                  publishedDetails={publishedDetails}
                  classification={classification}
                  targetJournal={paper.journal}
                  detectedDiscipline={matchingJournalsData.detectedDiscipline}
                  targetJournalEvaluation={matchingJournalsData.targetJournalEvaluation}
                  overallScore={score}
                  citationIntegrity={effectiveReport.citationIntegrity}
                  reviewerCount={effectiveReport.reviewerPersonas?.length || 5}
                  journalCount={displayJournals.length + (matchingJournalsData.otherMatches?.length || 0)}
                  onSelectView={handleSelectView}
                  onNewScan={onNewScan}
                  handlePrint={() => handleExport("pdf")}
                />
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
        )}

        {/* ========================================================= */}
        {/* TAB 2: 5 REVIEWER PERSONAS (ADVERSARIAL PANEL)            */}
        {/* ========================================================= */}
        {currentView === "personas" && (
          <DashboardPersonasSection
            personas={effectiveReport.reviewerPersonas || []}
            selectedPersona={selectedPersona}
            setSelectedPersona={setSelectedPersona}
            fullReport={effectiveReport}
            currentReport={effectiveReport}
            editorialTriage={effectiveReport.editorialTriage}
            matchingJournalsData={matchingJournalsData}
            targetJournal={paper.journal}
            title={paper.title}
            copiedReportIndex={copiedReportIndex}
            handleCopyRefereeReport={handleCopyRefereeReport}
            copiedSnippetIndex={copiedSnippetIndex}
            handleCopySnippet={handleCopySnippet}
            onSelectView={handleSelectView}
            journalsCount={displayJournals.length}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 3: 6 SCORING DIMENSIONS & RADAR                       */}
        {/* ========================================================= */}
        {currentView === "dimensions" && (
          <DashboardDimensionsSection dimensions={effectiveReport.dimensions} />
        )}

        {/* ========================================================= */}
        {/* TAB 4: ACTION PLAN & PRIORITY ISSUES                      */}
        {/* ========================================================= */}
        {currentView === "issues" && (
          <DashboardIssuesSection issues={effectiveReport.priorityIssues || []} />
        )}

        {/* ========================================================= */}
        {/* TAB 5: TARGET JOURNAL RECOMMENDATIONS                     */}
        {/* ========================================================= */}
        {(currentView === "journals" || currentView === "recommendations") && (
          <DashboardJournalsSection
            isDeskReject={isDeskReject}
            matchingJournalsData={matchingJournalsData}
            targetJournal={paper.journal}
            displayJournals={displayJournals}
            otherJournals={otherJournals}
            openJournalWebsite={openJournalWebsite}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 6: CITATION INTEGRITY & RETRACTION SHIELD AUDIT       */}
        {/* ========================================================= */}
        {currentView === "citations" && (
          <DashboardCitationsSection
            citationIntegrity={activeCitationIntegrity}
            dataCitationAudit={{
              totalCount: activeCitationIntegrity.totalReferences,
              verifiedCount: activeCitationIntegrity.verifiedCount,
              retractedCount: activeCitationIntegrity.retractedCount,
              notes: activeCitationIntegrity.coverageNote || "Offline Retraction Shield verified.",
            }}
            authors={fullReport?.authors || []}
            effectiveReport={effectiveReport}
            onUpdateCitationIntegrity={handleUpdateCitationIntegrity}
            onExportBibTeX={async () => {
              await exportBibTeX(effectiveReport);
            }}
          />
        )}
        </div>
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

