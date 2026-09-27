"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Tag,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Trash2,
  Printer,
  Globe,
  FileText,
  Users,
  BarChart3,
  AlertCircle,
  BookOpen,
  GraduationCap,
  CheckSquare,
  FlaskConical,
  Info,
  ExternalLink,
  ArrowLeft,
  MessageSquare,
  FileCode,
  ShieldAlert,
  Scale,
  Upload,
  Download,
  ChevronDown,
  Bookmark,
  Lock,
  Search,
  Plus,
  ChevronLeft,
  X,
  Loader2,
  Copy,
  Check,
  Clock,
} from "lucide-react";
import { DesktopActiveView } from "./DesktopSidebar";
import { EditorialTriageBanner } from "./dashboard/EditorialTriageBanner";
import { CalibratedAcceptanceCard } from "./dashboard/CalibratedAcceptanceCard";
import { FivePillarTriageCard } from "./dashboard/FivePillarTriageCard";
import { DashboardDimensionsSection } from "./dashboard/DashboardDimensionsSection";
import { DashboardIssuesSection } from "./dashboard/DashboardIssuesSection";
import { DashboardPersonasSection } from "./dashboard/DashboardPersonasSection";
import { DashboardJournalsSection } from "./dashboard/DashboardJournalsSection";
import { DashboardCitationsSection } from "./dashboard/DashboardCitationsSection";
import { ArtifactAuditCard } from "./dashboard/ArtifactAuditCard";
import { FigureAuditCard } from "./dashboard/FigureAuditCard";
import {
  FullReviewReport,
  ReviewerPersonaFeedback,
  PriorityIssue,
  DimensionScore,
  EditorialTriageOutcome,
  CalibratedAcceptanceRating,
  DeskRejectPillarEvaluation,
  PublishedArticleDetails,
} from "@/lib/types";
import { isSubstantiveReviewerObservation, extractReferencesFromText } from "@/lib/utils";
import { batchVerifyReferences } from "@/lib/crossref";
import { computeCitationIntegrity } from "@/lib/engine/citation-audit";
import {
  exportInteractiveHtmlReport,
  exportWordDocReport,
  exportBibTeX,
  exportPdfReport,
} from "@/lib/export-generator";
import { ExportCompletedToast, type ExportToastData } from "./ExportCompletedToast";
import { DimensionRadarChart } from "@/components/charts/DimensionRadarChart";
import { SegmentedReadinessGauge } from "@/components/charts/SegmentedReadinessGauge";
import { DecisionDistributionBar } from "@/components/charts/DecisionDistributionBar";
import type { ScoreDimension } from "@/lib/types";
import { DesktopJournalMatchesListView } from "./DesktopJournalMatchesListView";
import { findMatchingJournals, JournalEntry, MatchedJournalItem } from "@/lib/journals";
import { openJournalWebsite } from "@/lib/journal-scope-service";

export interface DesktopDashboardData {
  paperTitle: string;
  headlineTitle: string;
  targetJournal: string;
  aiEngine: string;
  latencyMs: number;
  score?: number;
  statusText: string;
  isDeskReject?: boolean;
  editorialTriage?: EditorialTriageOutcome;
  calibratedAcceptance?: CalibratedAcceptanceRating;
  isPublished?: boolean;
  publishedDetails?: PublishedArticleDetails;
  ineligibilityReason?: "already_published" | "non_academic_document" | "scope_mismatch";
  vulnerabilities: Array<{
    type: "overclaim" | "sample_size" | "control" | "generic";
    title: string;
    description: string;
    severity: "critical" | "warning";
  }>;
  reviewers: Array<{
    name: string;
    role: string;
    tag: "Major" | "Minor" | "Critical";
    quote: string;
    detail?: string;
  }>;
  citationAudit: {
    verifiedCount: number;
    totalCount: number;
    retractedCount: number;
    notes?: string;
  };
}

interface DesktopDashboardProps {
  data: DesktopDashboardData;
  fullReport?: FullReviewReport | null;
  activeView: DesktopActiveView;
  isConnected?: boolean;
  isLoading?: boolean;
  activeModelName?: string | null;
  latencyMs?: number | null;
  onSelectView: (view: DesktopActiveView) => void;
  onNewScan: () => void;
  onOpenSettings?: () => void;
  onDeleteArticle?: () => void;
  onUpdateFullReport?: (updatedReport: FullReviewReport, updatedData?: DesktopDashboardData) => void;
}

export function DesktopDashboard({
  data,
  fullReport,
  activeView,
  isConnected = false,
  isLoading = false,
  activeModelName,
  latencyMs,
  onSelectView,
  onNewScan,
  onOpenSettings,
  onDeleteArticle,
  onUpdateFullReport,
}: DesktopDashboardProps) {
  const [activeReport, setActiveReport] = useState<FullReviewReport | null>(fullReport || null);
  useEffect(() => {
    setActiveReport(fullReport || null);
  }, [fullReport]);

  const [selectedPersona, setSelectedPersona] = useState<number>(0);
  const [copiedReportIndex, setCopiedReportIndex] = useState<number | null>(null);
  const [copiedSnippetIndex, setCopiedSnippetIndex] = useState<number | null>(null);

  const handleCopyRefereeReport = (p: ReviewerPersonaFeedback, idx: number) => {
    const fallbackRoleName =
      p.persona === "journal_editor"
        ? "Reviewer 1: Lead Handling Editor"
        : p.persona === "domain_expert"
        ? "Reviewer 2: Target Domain Specialist"
        : p.persona === "methods_reviewer"
        ? "Reviewer 3: Research Methodology Referee"
        : p.persona === "statistician"
        ? "Reviewer 4: Statistical & Quantitative Auditor"
        : "Reviewer 5: Adversarial Translation Referee";

    const roleName = p.name?.startsWith("Reviewer") ? p.name : fallbackRoleName;

    let md = `# REFEREE REPORT: ${roleName}\n\n`;
    md += `**Role**: ${p.title || "Peer Reviewer"} (${p.affiliation || "Editorial Board"})\n`;
    if (p.decisionRecommendation) md += `**Recommendation**: ${p.decisionRecommendation}\n`;
    if (p.expertise) md += `**Scope & Expertise**: ${p.expertise}\n\n`;

    if (p.keyChallenge) {
      md += `## Primary Objection & Reviewer Challenge\n${p.keyChallenge}\n\n`;
    }

    if (p.strengths && p.strengths.length > 0) {
      md += `## Scholarly Merits & Recognized Strengths\n`;
      p.strengths.forEach((s) => {
        md += `- ${s}\n`;
      });
      md += `\n`;
    }

    if (p.assessment) {
      md += `## Detailed Peer-Review Assessment\n${p.assessment}\n\n`;
    }

    if (p.majorCritiques && p.majorCritiques.length > 0) {
      md += `## Major Scholarly Critiques\n`;
      p.majorCritiques.forEach((c, i) => {
        md += `${i + 1}. ${c}\n`;
      });
      md += `\n`;
    }

    if (p.concreteSolutions && p.concreteSolutions.length > 0) {
      md += `## Concrete Actionable Solutions & Suggested Rewrites\n`;
      p.concreteSolutions.forEach((sol, i) => {
        md += `### ${i + 1}. Issue: ${sol.issue}\n`;
        md += `- **Proposed Fix**: ${sol.proposedFix}\n`;
        if (sol.exampleRewrite) {
          md += `- **Example Text Rewrite**:\n> ${sol.exampleRewrite.replace(/\n/g, "\n> ")}\n`;
        }
        md += `\n`;
      });
    }

    if (p.missingControlsOrAnalyses && p.missingControlsOrAnalyses.length > 0) {
      md += `## Missing Controls & Required Analyses\n`;
      p.missingControlsOrAnalyses.forEach((m) => {
        md += `- [ ] ${m}\n`;
      });
      md += `\n`;
    }

    if (p.mustAddressItems && p.mustAddressItems.length > 0) {
      md += `## Must-Address Pre-Submission Punchlist\n`;
      p.mustAddressItems.forEach((item) => {
        md += `- [ ] ${item}\n`;
      });
      md += `\n`;
    }

    if (p.minorComments && p.minorComments.length > 0) {
      md += `## Minor Comments & Presentation Remarks\n`;
      p.minorComments.forEach((mc) => {
        md += `- ${mc}\n`;
      });
      md += `\n`;
    }

    if (p.evidenceAnchors && p.evidenceAnchors.length > 0) {
      md += `## Manuscript Grounding Anchors\n`;
      p.evidenceAnchors.forEach((ea) => {
        md += `- \`${ea}\`\n`;
      });
      md += `\n`;
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
  const [issueFilter, setIssueFilter] = useState<"all" | "A" | "B" | "C">("all");
  const [selectedRadarDimension, setSelectedRadarDimension] = useState<ScoreDimension | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [exportToast, setExportToast] = useState<ExportToastData | null>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Overview Tab Accordion State (Top card always open; 2nd card onwards collapsible)
  const [expandedOverviewCards, setExpandedOverviewCards] = useState<Record<string, boolean>>({
    calibratedAcceptance: false,
    fivePillars: false,
    editorialSynthesis: false,
    documentClassification: false,
    reportingGuideline: false,
    complianceAudit: false,
    statcheck: false,
    hedgingAudit: false,
    citationHealth: false,
    artifactAudit: false,
    figureAudit: false,
  });

  const toggleOverviewCard = (cardKey: string) => {
    setExpandedOverviewCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  // Citation update handler
  const handleUpdateCitationIntegrity = (updatedCit: any) => {
    const updatedReport: FullReviewReport = {
      ...(effectiveReport || ({} as FullReviewReport)),
      citationIntegrity: updatedCit,
    };
    const updatedData: DesktopDashboardData = {
      ...data,
      citationAudit: {
        verifiedCount: updatedCit.verifiedCount,
        totalCount: updatedCit.totalReferences,
        retractedCount: updatedCit.retractedCount,
        notes: `Verified ${updatedCit.verifiedCount} DOIs via CrossRef Open API.`,
      },
    };
    setActiveReport(updatedReport);
    if (onUpdateFullReport) {
      onUpdateFullReport(updatedReport, updatedData);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentReport = activeReport || fullReport;

  // Normalized values prioritizing fullReport
  const title = currentReport?.title || data.paperTitle || data.headlineTitle;
  const targetJournal =
    currentReport?.targetJournal || data.targetJournal || "Target Journal";
  const summary = currentReport?.summary;
  const classification = currentReport?.classification;
  const dimensions = currentReport?.dimensions || {};

  // Extract cited journals from full report if available
  const citedJournals = useMemo(() => {
    const refs = fullReport?.citationIntegrity?.references || [];
    return refs.map((r) => r.journal || "").filter(Boolean);
  }, [fullReport]);

  // Match journals from catalog to guarantee 3 tiered cards + 10+ list matches
  const matchingJournalsData = useMemo(() => {
    return findMatchingJournals(title, typeof summary === "string" ? summary : "", targetJournal, citedJournals);
  }, [title, summary, targetJournal, citedJournals]);

  const isExplicitlySentForReview =
    currentReport?.editorialTriage?.outcome === "sent_for_review" ||
    fullReport?.editorialTriage?.outcome === "sent_for_review" ||
    Boolean(currentReport?.editorialTriage?.summary?.includes("Cleared editorial triage")) ||
    Boolean(fullReport?.editorialTriage?.summary?.includes("Cleared editorial triage"));

  const targetJournalEval =
    currentReport?.targetJournalEvaluation ||
    fullReport?.targetJournalEvaluation ||
    (isExplicitlySentForReview ? undefined : matchingJournalsData?.targetJournalEvaluation);

  const isScopeMismatch =
    !isExplicitlySentForReview &&
    (Boolean(targetJournalEval?.isDisciplinaryMismatch) ||
      currentReport?.ineligibilityReason === "scope_mismatch" ||
      fullReport?.ineligibilityReason === "scope_mismatch");

  const rawClassification = currentReport?.classification || fullReport?.classification || classification;

  // Protect evaluated papers: if reviewer personas, dimensions, or a score exist,
  // the paper was already substantively reviewed and should never show the ineligibility banner.
  const hasSubstantiveEvaluation =
    isExplicitlySentForReview ||
    (data.score != null && data.score > 0) ||
    (currentReport?.overallScore != null && currentReport.overallScore > 0) ||
    (fullReport?.overallScore != null && fullReport.overallScore > 0) ||
    (currentReport?.reviewerPersonas && currentReport.reviewerPersonas.length > 0) ||
    (fullReport?.reviewerPersonas && fullReport.reviewerPersonas.length > 0) ||
    (currentReport?.dimensions != null) ||
    (fullReport?.dimensions != null);

  const ineligibilityReason = hasSubstantiveEvaluation
    ? (currentReport?.ineligibilityReason === "non_academic_document" ? undefined : currentReport?.ineligibilityReason) ||
      (fullReport?.ineligibilityReason === "non_academic_document" ? undefined : fullReport?.ineligibilityReason)
    : currentReport?.ineligibilityReason ||
      fullReport?.ineligibilityReason ||
      (rawClassification && !rawClassification.isAcademicManuscript ? "non_academic_document" : undefined);

  const isNonAcademic =
    !hasSubstantiveEvaluation && (
      ineligibilityReason === "non_academic_document" ||
      Boolean(rawClassification && !rawClassification.isAcademicManuscript)
    );

  const isDeskReject =
    !isNonAcademic &&
    !isExplicitlySentForReview &&
    (isScopeMismatch ||
      currentReport?.editorialTriage?.outcome === "desk_reject" ||
      fullReport?.editorialTriage?.outcome === "desk_reject" ||
      data?.editorialTriage?.outcome === "desk_reject" ||
      data?.statusText?.includes("Desk Reject") ||
      data?.isDeskReject === true);

  const publishedDetails =
    currentReport?.publishedDetails ||
    fullReport?.publishedDetails ||
    data?.publishedDetails;

  const isAlreadyPublished =
    !isDeskReject &&
    !isNonAcademic &&
    (ineligibilityReason === "already_published" ||
      data?.ineligibilityReason === "already_published" ||
      Boolean(data?.isPublished) ||
      Boolean(publishedDetails?.isPublished));

  const isReviewEligible =
    !isDeskReject &&
    !isNonAcademic &&
    !isAlreadyPublished &&
    (isExplicitlySentForReview || currentReport?.isEligibleForReview !== false);

  const overallScore = isDeskReject || isNonAcademic || isAlreadyPublished
    ? undefined
    : (currentReport?.overallScore ?? (isReviewEligible ? data.score : undefined));

  const rawCalibratedAcceptance: CalibratedAcceptanceRating | undefined =
    currentReport?.calibratedAcceptance ||
    fullReport?.calibratedAcceptance ||
    data.calibratedAcceptance;

  const calibratedAcceptance: CalibratedAcceptanceRating | undefined = useMemo(() => {
    if (!rawCalibratedAcceptance) return undefined;
    if (isDeskReject) {
      return {
        ...rawCalibratedAcceptance,
        readinessBand: "Desk Reject Hazard",
        decisionOutcome: "Desk Reject Hazard",
        primaryHazard:
          rawCalibratedAcceptance.primaryHazard ||
          "Out-of-Scope Target Venue: Manuscript domain diverges from target journal editorial remit.",
        keyOpportunity:
          rawCalibratedAcceptance.keyOpportunity ||
          "Retarget submission to a discipline-aligned journal to immediately eliminate the scope triage barrier.",
        decisionDistribution: {
          p_desk_reject: 85,
          p_reject_after_review: 12,
          p_major_revision: 3,
          p_minor_revision: 0,
          p_accept: 0,
          confidence: "high",
          messy_middle_flag: false,
          baseRateDisclaimer: undefined,
        },
      };
    }
    return rawCalibratedAcceptance;
  }, [rawCalibratedAcceptance, isDeskReject]);

  // Synchronize desk reject state back to persistent storage if dynamically discovered via scope evaluation
  useEffect(() => {
    if (isDeskReject && !isExplicitlySentForReview && onUpdateFullReport && currentReport) {
      const needsReportUpdate =
        currentReport.isEligibleForReview !== false ||
        currentReport.overallScore !== undefined ||
        currentReport.ineligibilityReason !== "scope_mismatch";
      const needsDataUpdate = data.isDeskReject !== true || data.score !== undefined;
      if (needsReportUpdate || needsDataUpdate) {
        const updatedReport: FullReviewReport = {
          ...currentReport,
          isEligibleForReview: false,
          ineligibilityReason: "scope_mismatch",
          overallScore: undefined,
          targetJournalEvaluation: targetJournalEval || currentReport.targetJournalEvaluation,
          editorialTriage: currentReport.editorialTriage?.outcome === "desk_reject"
            ? currentReport.editorialTriage
            : {
                outcome: "desk_reject",
                sentToPeerReview: false,
                deskRejectReason: "scope_mismatch",
                handlingEditorDecision: "Desk Reject",
                summary:
                  currentReport.editorialTriage?.summary ||
                  targetJournalEval?.mismatchWarning ||
                  `Desk rejected at editorial triage: "${targetJournal}" remit is outside the substantive domain of this manuscript.`,
                scopeComparison: currentReport.editorialTriage?.scopeComparison || {
                  manuscriptDiscipline: matchingJournalsData.detectedDiscipline,
                  manuscriptTopics: [matchingJournalsData.detectedDiscipline],
                  journalName: targetJournal,
                  journalDiscipline: targetJournalEval?.journalDiscipline || "Target Domain",
                  isScopeMatch: false,
                  suggestedVenues: [
                    matchingJournalsData.realistic.name,
                    matchingJournalsData.reach.name,
                    matchingJournalsData.fallback.name,
                  ],
                },
              },
        };
        const updatedData: DesktopDashboardData = {
          ...data,
          isDeskReject: true,
          score: undefined,
          statusText: "Editorial Desk Reject (Scope Mismatch)",
        };
        onUpdateFullReport(updatedReport, updatedData);
      }
    }
  }, [isDeskReject, isExplicitlySentForReview, onUpdateFullReport, currentReport, data, targetJournalEval, targetJournal, matchingJournalsData]);

  const personas: ReviewerPersonaFeedback[] = useMemo(() => {
    if (isDeskReject) {
      const triage = currentReport?.editorialTriage || fullReport?.editorialTriage || data.editorialTriage;
      const mismatchReason =
        targetJournalEval?.mismatchWarning ||
        `The manuscript domain is outside the publication remit of "${targetJournal}". In accordance with editorial policy, out-of-scope submissions cannot proceed to external peer review.`;
      return [{
        persona: "journal_editor" as const,
        name: "Reviewer 1: Lead Handling Editor",
        title: `Senior Handling Editor (${targetJournal})`,
        affiliation: `Editorial Office, ${targetJournal}`,
        expertise: "Aims & Scope, Editorial Screening & Desk-Reject Triage",
        roleDescription: "Preliminary Screening & Scope Triage",
        decisionRecommendation: "Desk Reject" as const,
        keyChallenge: "Disciplinary scope mismatch with target journal remit.",
        assessment: triage?.summary || mismatchReason,
        majorCritiques: [
          `Substantive research remit falls outside the aims and scope of ${targetJournal}.`,
          "Redirect submission to a discipline-appropriate journal before engaging external peer reviewers.",
        ],
        missingControlsOrAnalyses: [],
        mustAddressItems: ["Consult the Matching Journals tab and retarget prior to external peer review."],
        evidenceAnchors: [],
        counterArguments: [],
        confidentialEditorNote: undefined,
      }];
    }
    if (fullReport?.reviewerPersonas && fullReport.reviewerPersonas.length > 0) {
      return fullReport.reviewerPersonas;
    }
    if (data?.reviewers && data.reviewers.length > 0) {
      return data.reviewers.map((r, idx) => ({
        persona: (idx === 0
          ? "journal_editor"
          : idx === 1
          ? "domain_expert"
          : idx === 2
          ? "methods_reviewer"
          : idx === 3
          ? "statistician"
          : "devils_advocate") as ReviewerPersonaFeedback["persona"],
        name: r.name || `Reviewer ${idx + 1}`,
        title: r.role || "Peer Reviewer",
        affiliation: "Editorial Review Panel",
        expertise: "Scholarly Evaluation",
        roleDescription: r.role || "Peer Reviewer",
        decisionRecommendation: (r.tag === "Critical"
          ? "Reject / Resubmit"
          : "Major Revision") as ReviewerPersonaFeedback["decisionRecommendation"],
        keyChallenge: r.quote || "Methodological rigor",
        assessment: r.detail || r.quote || "Detailed evaluation required.",
        majorCritiques: [r.quote || "Rigorous evaluation required."],
        missingControlsOrAnalyses: [],
        mustAddressItems: [],
        evidenceAnchors: [],
        counterArguments: [],
        confidentialEditorNote: undefined,
      }));
    }
    return [];
  }, [isDeskReject, fullReport?.reviewerPersonas, fullReport?.editorialTriage, currentReport?.editorialTriage, data?.reviewers, data?.editorialTriage, targetJournal, targetJournalEval]);
  const issues = fullReport?.priorityIssues || [];
  const journals = fullReport?.journalRecommendations || [];

  const otherJournals = useMemo(() => {
    return matchingJournalsData.otherMatches || [];
  }, [matchingJournalsData]);

  const displayJournals = useMemo(() => {
    if (journals && journals.length >= 3) return journals;
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
  }, [journals, matchingJournalsData]);

  // Filter issues based on priority filter pill
  const filteredIssues = issues.filter(
    (iss) => issueFilter === "all" || iss.priority === issueFilter
  );

  // Synthesize fallback FullReviewReport if fullReport was not loaded into state
  const effectiveReport: FullReviewReport = useMemo(() => {
    const baseReport = activeReport || fullReport;
    if (baseReport) {
      return {
        ...baseReport,
        isDeskReject,
        isEligibleForReview: isReviewEligible,
        overallScore: isDeskReject ? undefined : (overallScore ?? baseReport.overallScore),
        targetJournalEvaluation: baseReport.targetJournalEvaluation
          ? {
              ...baseReport.targetJournalEvaluation,
              isDisciplinaryMismatch: isDeskReject ? true : (isExplicitlySentForReview ? false : Boolean(baseReport.targetJournalEvaluation.isDisciplinaryMismatch)),
            }
          : undefined,
      };
    }
    return {
      id: "report-current",
      createdAt: new Date().toISOString(),
      title: title || "Manuscript Diagnostic Report",
      targetJournal: targetJournal || "Target Journal",
      editorialTriage: currentReport?.editorialTriage || fullReport?.editorialTriage || data.editorialTriage,
      overallScore: isDeskReject ? undefined : (overallScore ?? 78),
      isEligibleForReview: isReviewEligible,
      isDeskReject: isDeskReject,
      ineligibilityReason: ineligibilityReason,
      summary: typeof summary === "string" ? summary : "Manuscript diagnostic analysis generated by ManuView.",
      classification: classification || {
        category: "academic_manuscript",
        categoryLabel: "Empirical Research Manuscript",
        isAcademicManuscript: true,
        confidence: 0.95,
        detectedFeatures: ["Abstract", "Methodology", "Empirical Findings"],
        salutation: "Dear Author / Researcher",
        advisoryMessage: "Academic manuscript format successfully recognized.",
        customGuidance: "Proceed with diagnostic review and journal alignment.",
      },
      dimensions: fullReport?.dimensions,
      priorityIssues: issues.length > 0 ? issues : (data.vulnerabilities || []).map((v, i) => ({
        id: `issue-${i + 1}`,
        priority: (v.severity === "critical" ? "A" : "B") as "A" | "B" | "C",
        title: v.title || v.type,
        category: "Methodology" as const,
        description: v.description,
        location: "Main Text / Methods",
        reviewerQuote: `The treatment of ${v.title || v.type} requires methodological clarification before submission.`,
        actionableFix: `Revise and strengthen ${v.title || v.type} addressing the identified vulnerability.`,
      })),
      reviewerPersonas: personas.length > 0 ? personas : [
        {
          persona: "methods_reviewer" as const,
          name: "Reviewer 3: Research Methodology Referee",
          title: "Senior Methodology Reviewer",
          affiliation: "Editorial Board Reviewer",
          expertise: "Research Methodology and Experimental Rigor",
          roleDescription: "Evaluates methodological validity and control measures",
          decisionRecommendation: "Minor Revision" as const,
          keyChallenge: "Methodological rigor and contribution clarity",
          assessment: "The manuscript demonstrates a solid foundation. Address the highlighted issues before final journal submission.",
          majorCritiques: ["Clarify sample selection and baseline controls."],
          missingControlsOrAnalyses: [],
          mustAddressItems: ["Address priority methodological remarks."],
        },
      ],
      journalRecommendations: journals,
      citationIntegrity: fullReport?.citationIntegrity || {
        totalReferences: data.citationAudit?.totalCount ?? 0,
        sampledCount: data.citationAudit?.totalCount ?? 0,
        checkedCount: data.citationAudit?.verifiedCount ?? 0,
        coverageNote: "Automated bibliographic screening.",
        verifiedCount: data.citationAudit?.verifiedCount ?? 0,
        unresolvableCount: 0,
        uncheckedCount: 0,
        retractedCount: data.citationAudit?.retractedCount ?? 0,
        retractionCheckAvailable: true,
        selfCitationRatio: 0.05,
        recencyProfile: {
          last5YearsPercent: 75,
          olderThan5YearsPercent: 25,
        },
        references: [],
      },
    };
  }, [
    activeReport,
    fullReport,
    title,
    targetJournal,
    overallScore,
    isReviewEligible,
    isDeskReject,
    isExplicitlySentForReview,
    ineligibilityReason,
    summary,
    classification,
    dimensions,
    issues,
    personas,
    journals,
    data.vulnerabilities,
    data.citationAudit,
  ]);

  const isExportingRef = useRef<boolean>(false);
  const [activeExportFormat, setActiveExportFormat] = useState<string | null>(null);

  const handleExportFormat = async (
    format: "word" | "html" | "pdf",
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Prevent double invocation or concurrent exports
    if (isExportingRef.current) return;
    isExportingRef.current = true;
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
      setTimeout(() => {
        isExportingRef.current = false;
      }, 400);
    }
  };

  const handlePrint = (e?: React.MouseEvent) => {
    handleExportFormat("pdf", e);
  };

  const isIneligible = Boolean(isAlreadyPublished || isNonAcademic);

  const renderActionButtons = () => (
    <div className="flex items-center gap-2 shrink-0">
      {/* Export Dropdown */}
      <div className="relative" ref={exportDropdownRef}>
        <button
          type="button"
          onClick={() => setIsExportOpen((prev) => !prev)}
          disabled={activeExportFormat !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
          title="Export diagnostic report in multiple academic formats"
          aria-expanded={isExportOpen}
        >
          {activeExportFormat ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>Export</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportOpen ? "rotate-180" : ""}`} />
        </button>

        {isExportOpen && (
          <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white dark:bg-[#161F30] border border-black/10 dark:border-white/10 shadow-xl p-1.5 z-50 animate-fade-in text-xs">
            <button
              type="button"
              disabled={activeExportFormat !== null}
              onClick={(e) => handleExportFormat("word", e)}
              className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2.5 cursor-pointer disabled:opacity-50 rounded-lg"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>{activeExportFormat === "word" ? "Exporting Word..." : "Word Document (.doc)"}</span>
            </button>
            <button
              type="button"
              disabled={activeExportFormat !== null}
              onClick={(e) => handleExportFormat("html", e)}
              className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2.5 cursor-pointer disabled:opacity-50 rounded-lg"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{activeExportFormat === "html" ? "Exporting HTML..." : "Interactive HTML (.html)"}</span>
            </button>
            <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
            <button
              type="button"
              disabled={activeExportFormat !== null}
              onClick={(e) => handleExportFormat("pdf", e)}
              className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2.5 cursor-pointer disabled:opacity-50 rounded-lg"
            >
              <Printer className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>{activeExportFormat === "pdf" ? "Exporting PDF..." : "PDF Document (.pdf)"}</span>
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

  // --- Section 1: The 6 Evaluation Dimensions ---
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
                onClick={() => onSelectView("overview")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeView === "overview"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectView("personas")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeView === "personas"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{isDeskReject ? (personas.length <= 1 ? "Editorial Decision" : `${personas.length || 5} Reviewers`) : `${personas.length || 5} Reviewers`}</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectView("dimensions")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeView === "dimensions"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>6 Dimensions &amp; Radar</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectView("issues")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeView === "issues"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Priority Issues ({issues.length})</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectView("journals")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeView === "journals" || activeView === "recommendations"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Target Journals</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectView("citations")}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeView === "citations"
                    ? "bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs border border-blue-100 dark:border-blue-900/50"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Retraction Shield</span>
              </button>
            </div>

            {/* Right Action Buttons */}
            {renderActionButtons()}
          </div>
        </div>
      )}

      {/* Main Content Area (Scrolls Underneath) */}
      <div className={isIneligible ? "p-6 sm:p-10 pt-4" : "p-6 sm:p-10 pt-2"}>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* ========================================================= */}
          {/* MAIN ARTICLE VIEW (EXACTLY 3 CARDS AS PER DESIGN SPEC)   */}
          {/* ========================================================= */}
          {activeView === "overview" && (
            <div className="space-y-6 animate-fade-in">
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
                      onClick={() => openJournalWebsite(targetJournal)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EFF6FF] dark:bg-blue-950/50 border border-[#BFDBFE]/70 dark:border-blue-800/70 text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
                      title="Click to visit official journal website via OpenAlex"
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Target: {targetJournal}</span>
                    </button>

                    {isIneligible && renderActionButtons()}
                  </div>
                </div>

              {/* Manuscript Title & Status Header (PureMac style) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="space-y-1 max-w-2xl">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight leading-snug">
                    {title}
                  </h1>
                  <p className="text-xs text-[#64748B] dark:text-neutral-400 font-medium">
                    Target: <strong className="text-neutral-800 dark:text-neutral-200">{targetJournal}</strong> &bull; Peer-Review Calibrated Pre-Submission Diagnostic
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
                editorialTriage={currentReport?.editorialTriage || fullReport?.editorialTriage || data.editorialTriage}
                publishedDetails={publishedDetails}
                classification={classification}
                targetJournal={targetJournal}
                detectedDiscipline={matchingJournalsData.detectedDiscipline}
                targetJournalEvaluation={targetJournalEval}
                overallScore={overallScore}
                onSelectView={onSelectView}
                onNewScan={onNewScan}
                handlePrint={handlePrint}
              />
            </div>

            {/* Overview Diagnostics & Audits Accordion Header */}
            {!isNonAcademic && !isAlreadyPublished && (
              <div className="flex items-center justify-between pt-1 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-neutral-400">
                  Detailed Diagnoses &amp; Pre-Submission Audits
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const anyOpen = Object.values(expandedOverviewCards).some(Boolean);
                    setExpandedOverviewCards({
                      calibratedAcceptance: !anyOpen,
                      fivePillars: !anyOpen,
                      editorialSynthesis: !anyOpen,
                      documentClassification: !anyOpen,
                      reportingGuideline: !anyOpen,
                      complianceAudit: !anyOpen,
                      statcheck: !anyOpen,
                      hedgingAudit: !anyOpen,
                      citationHealth: !anyOpen,
                      artifactAudit: !anyOpen,
                    });
                  }}
                  className="text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {Object.values(expandedOverviewCards).some(Boolean) ? "Collapse all" : "Expand all"}
                </button>
              </div>
            )}

            {/* CARD 1B: Calibrated Pre-Submission Acceptance Probability & Selectivity Analysis */}
            {!isNonAcademic && !isAlreadyPublished && calibratedAcceptance && (
              <CalibratedAcceptanceCard
                calibratedAcceptance={calibratedAcceptance}
                targetJournal={targetJournal}
                isExpanded={expandedOverviewCards.calibratedAcceptance}
                onToggle={() => toggleOverviewCard("calibratedAcceptance")}
              />
            )}

            {/* CARD 1C: 5-Pillar Editorial Screening Matrix */}
            {!isNonAcademic && !isAlreadyPublished && (
              <FivePillarTriageCard
                triage={currentReport?.editorialTriage || fullReport?.editorialTriage || data.editorialTriage}
                isDeskReject={isDeskReject}
                isAccordion={true}
                isExpanded={expandedOverviewCards.fivePillars}
                onToggle={() => toggleOverviewCard("fivePillars")}
              />
            )}

            {/* CARD 2: Editorial Synthesis & Triage Assessment Card (Omitted for non-academic documents) */}
            {!isNonAcademic && !isAlreadyPublished && (
              <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
                <button
                  type="button"
                  onClick={() => toggleOverviewCard("editorialSynthesis")}
                  className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                  aria-expanded={expandedOverviewCards.editorialSynthesis}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                        Editorial Synthesis &amp; Triage Assessment
                      </h2>
                      <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                        High-level summary of editorial decisions, peer readiness, and recommendations
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-[#1E293B] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                      Editorial Review
                    </span>
                    <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedOverviewCards.editorialSynthesis ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>

                {expandedOverviewCards.editorialSynthesis && (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] animate-fade-in">
                    <p className="text-xs sm:text-sm text-[#334155] dark:text-neutral-300 leading-relaxed font-light whitespace-pre-line">
                      {summary || data.statusText}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CARD 3: Document Classification Card (Rendered for review-eligible manuscripts and non-academic documents) */}
            {(isReviewEligible || isNonAcademic) && (
              <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] border-l-4 border-l-[#2563EB] dark:border-l-blue-500 overflow-hidden transition-all duration-200">
                <button
                  type="button"
                  onClick={() => toggleOverviewCard("documentClassification")}
                  className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                  aria-expanded={expandedOverviewCards.documentClassification}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                      <Tag className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
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
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedOverviewCards.documentClassification ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>

                {expandedOverviewCards.documentClassification && (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] dark:text-white pb-1">
                      <span className="text-neutral-400 dark:text-neutral-500">Typology:</span>
                      <span>{classification?.categoryLabel || "Academic Research Manuscript"}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#334155] dark:text-neutral-300 leading-relaxed">
                      <strong className="font-bold text-[#0F172A] dark:text-white">
                        {classification?.salutation ? (classification.salutation.endsWith(":") ? classification.salutation : `${classification.salutation}:`) : "Dear Author / Contributing Researcher:"}
                      </strong>{" "}
                      {classification?.advisoryMessage ||
                        "This manuscript has undergone rigorous pre-submission peer-review calibration across core methodological, empirical, and bibliographic dimensions against the target journal's editorial standards."}
                    </p>

                    {/* Detected Academic Features Pills */}
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
                        "Review prioritized action items and simulated referee assessments before submitting to your target journal."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CARD 4: Reporting Guideline Compliance Audit (Only for eligible manuscripts) */}
            {isReviewEligible && fullReport?.reportingGuideline && (
              <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
                <button
                  type="button"
                  onClick={() => toggleOverviewCard("reportingGuideline")}
                  className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                  aria-expanded={expandedOverviewCards.reportingGuideline}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                      <Scale className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#0F172A] dark:text-white truncate">
                          Reporting Guideline Compliance: {fullReport.reportingGuideline.guidelineName}
                        </h2>
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                        Standard: {fullReport.reportingGuideline.standardType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                    <span className="text-xs font-semibold text-[#64748B] dark:text-neutral-400 whitespace-nowrap hidden sm:inline">Audit Score:</span>
                    <span className="text-xs sm:text-base font-extrabold text-[#2563EB] dark:text-blue-400 bg-[#EFF6FF] dark:bg-blue-950/50 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 shrink-0 whitespace-nowrap">
                      {fullReport.reportingGuideline.itemSetScope === "core_subset"
                        ? `${fullReport.reportingGuideline.evidencedCount}/${fullReport.reportingGuideline.totalItems} core (${fullReport.reportingGuideline.scorePercent}%)`
                        : fullReport.reportingGuideline.evidencedCount !== undefined && fullReport.reportingGuideline.totalItems !== undefined
                        ? `${fullReport.reportingGuideline.evidencedCount}/${fullReport.reportingGuideline.totalItems} (${fullReport.reportingGuideline.scorePercent}%)`
                        : `${fullReport.reportingGuideline.scorePercent}%`}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedOverviewCards.reportingGuideline ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>

                {expandedOverviewCards.reportingGuideline && (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-4 animate-fade-in">
                    {fullReport.reportingGuideline.standardUrl && (
                      <div className="text-xs text-[#64748B] dark:text-neutral-400 pb-1">
                        <a
                          href={fullReport.reportingGuideline.standardUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-blue-600 dark:hover:text-blue-300 text-neutral-600 dark:text-neutral-400 inline-flex items-center gap-1"
                        >
                          Official Checklist &amp; Guidelines &rarr;
                        </a>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/30 border border-[#BBF7D0] dark:border-emerald-800/60 space-y-2">
                        <span className="text-xs font-bold text-[#166534] dark:text-emerald-300 uppercase tracking-wider block">
                          Compliant Checklist Items:
                        </span>
                        <ul className="space-y-2 text-xs text-[#166534] dark:text-emerald-300">
                          {fullReport.reportingGuideline.compliantItems.map((item, idx) => {
                            const [heading, ...rest] = item.split(" — ");
                            const excerpt = rest.join(" — ");
                            return (
                              <li key={idx} className="flex items-start gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#16A34A] dark:text-emerald-400" />
                                <div className="space-y-0.5">
                                  <span className="font-semibold">{heading}</span>
                                  {excerpt && (
                                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 italic pl-2 border-l-2 border-emerald-300 dark:border-emerald-700">
                                      {excerpt}
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl bg-[#FFFBEB] dark:bg-amber-950/30 border border-[#FDE68A] dark:border-amber-800/60 space-y-2">
                        <span className="text-xs font-bold text-[#92400E] dark:text-amber-300 uppercase tracking-wider block">
                          Missing or Partial Reporting Items:
                        </span>
                        <ul className="space-y-2 text-xs text-[#92400E] dark:text-amber-300">
                          {fullReport.reportingGuideline.missingOrPartialItems.map((item, idx) => {
                            const [heading, ...rest] = item.split(" — ");
                            const recommendation = rest.join(" — ");
                            return (
                              <li key={idx} className="flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#D97706] dark:text-amber-400" />
                                <div className="space-y-0.5">
                                  <span className="font-semibold">{heading}</span>
                                  {recommendation && (
                                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 pl-2 border-l-2 border-amber-300 dark:border-amber-700">
                                      {recommendation}
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {(() => {
                        const substantiveObservations = (
                          fullReport.reportingGuideline.additionalReviewerObservations || []
                        ).filter(isSubstantiveReviewerObservation);

                        if (substantiveObservations.length === 0) return null;

                        return (
                          <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-[#E2E8F0] dark:border-[#334155] space-y-2 text-xs md:col-span-2">
                            <span className="font-semibold text-[#475569] dark:text-neutral-300 uppercase tracking-wider text-[10px] block">
                              Additional Reviewer Observations:
                            </span>
                            <ul className="space-y-1 text-[#334155] dark:text-neutral-300">
                              {substantiveObservations.map((obs, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-gray-400">&bull;</span>
                                  <span>{obs}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CARD 5: Deterministic Compliance Audit (P0-1) */}
            {fullReport?.complianceAudit && fullReport.complianceAudit.items && fullReport.complianceAudit.items.length > 0 && (
              <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
                <button
                  type="button"
                  onClick={() => toggleOverviewCard("complianceAudit")}
                  className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                  aria-expanded={expandedOverviewCards.complianceAudit}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                          Deterministic Compliance Audit
                        </h2>
                        <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                          Rule-Based
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                        Automated manuscript checks across structure, ethics, data, and citations
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                    <div className="flex items-center gap-2 text-xs font-medium bg-neutral-50 dark:bg-[#161F30] px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">{fullReport.complianceAudit.passedCount} Passed</span>
                      <span className="text-neutral-300 dark:text-neutral-700">•</span>
                      <span className="text-amber-700 dark:text-amber-400 font-bold">{fullReport.complianceAudit.warnCount} Warn</span>
                      <span className="text-neutral-300 dark:text-neutral-700">•</span>
                      <span className="text-rose-700 dark:text-rose-400 font-bold">{fullReport.complianceAudit.failedCount} Fail</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedOverviewCards.complianceAudit ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>

                {expandedOverviewCards.complianceAudit && (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fullReport.complianceAudit.items.map((item) => (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border transition shadow-2xs ${
                            item.status === "pass"
                              ? "bg-white border-[#E5E7EB] dark:bg-[#111827] dark:border-[#1F2937]"
                              : item.status === "warn"
                              ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40"
                              : "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold text-neutral-900 dark:text-white">{item.name}</span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border shrink-0 ${
                                item.status === "pass"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                  : item.status === "warn"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{item.detail}</p>
                          {item.actionableRecommendation && (
                            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-start gap-1.5">
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200 shrink-0">Remedy:</span>
                              <span>{item.actionableRecommendation}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CARD 7: Statistical Integrity & P-Value Audit (statcheck) */}
            {!isNonAcademic && fullReport?.statcheck && fullReport.statcheck.totalTestsFound > 0 && (
              <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
                <button
                  type="button"
                  onClick={() => toggleOverviewCard("statcheck")}
                  className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                  aria-expanded={expandedOverviewCards.statcheck}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
                      <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                          Statistical Integrity &amp; P-Value Audit (Statcheck)
                        </h2>
                        <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                          Mathematical Verification
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                        Theoretical distribution recalculation of reported test statistics (t, F, χ², Z, r)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                    <div className="flex items-center gap-2 text-xs font-medium bg-neutral-50 dark:bg-[#161F30] px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">{fullReport.statcheck.consistentCount} Consistent</span>
                      {fullReport.statcheck.inconsistentCount > 0 && (
                        <>
                          <span className="text-neutral-300 dark:text-neutral-700">•</span>
                          <span className="text-amber-700 dark:text-amber-400 font-bold">{fullReport.statcheck.inconsistentCount} Rounding Diff</span>
                        </>
                      )}
                      {fullReport.statcheck.grossInconsistencyCount > 0 && (
                        <>
                          <span className="text-neutral-300 dark:text-neutral-700">•</span>
                          <span className="text-rose-700 dark:text-rose-400 font-bold">{fullReport.statcheck.grossInconsistencyCount} Gross Conflict</span>
                        </>
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedOverviewCards.statcheck ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>

                {expandedOverviewCards.statcheck && (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-4 animate-fade-in">
                    <p className="text-xs text-[#64748B] dark:text-neutral-400 leading-relaxed">
                      {fullReport.statcheck.summary}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fullReport.statcheck.tests.map((test) => (
                        <div
                          key={test.id}
                          className={`p-4 rounded-2xl border transition shadow-2xs ${
                            test.isGrossInconsistency
                              ? "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800/40"
                              : !test.isConsistent
                              ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40"
                              : "bg-white border-[#E5E7EB] dark:bg-[#111827] dark:border-[#1F2937]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white">{test.rawText}</span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border shrink-0 ${
                                test.isGrossInconsistency
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                                  : !test.isConsistent
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                              }`}
                            >
                              {test.isGrossInconsistency ? "Gross Conflict" : !test.isConsistent ? "Rounding Diff" : "Consistent"}
                            </span>
                          </div>
                          <div className="text-[11px] space-y-1 text-neutral-600 dark:text-neutral-300">
                            <p>Reported p: <strong className="font-mono">{test.reportedOperator} {test.reportedP}</strong> | Theoretical computed p: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{test.computedP}</strong></p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{test.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CARD 8: Causal Overclaim & Epistemic Hedging Balance */}
            {!isNonAcademic && fullReport?.hedgingAudit && fullReport.hedgingAudit.totalOverclaimsFound > 0 && (
              <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
                <button
                  type="button"
                  onClick={() => toggleOverviewCard("hedgingAudit")}
                  className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                  aria-expanded={expandedOverviewCards.hedgingAudit}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                          Causal Claims &amp; Epistemic Hedging Audit
                        </h2>
                        <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                          Hyland Corpus
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                        Detection of unhedged causal assertions, superlatives, and observational overclaiming
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                    <div className="flex items-center gap-2 text-xs font-medium bg-neutral-50 dark:bg-[#161F30] px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">Hedging Index: <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">{fullReport.hedgingAudit.epistemicBalanceIndex}/100</strong></span>
                      {fullReport.hedgingAudit.criticalCount > 0 && (
                        <>
                          <span className="text-neutral-300 dark:text-neutral-700">•</span>
                          <span className="text-rose-700 dark:text-rose-400 font-bold">{fullReport.hedgingAudit.criticalCount} Critical</span>
                        </>
                      )}
                      {fullReport.hedgingAudit.warningCount > 0 && (
                        <>
                          <span className="text-neutral-300 dark:text-neutral-700">•</span>
                          <span className="text-amber-700 dark:text-amber-400 font-bold">{fullReport.hedgingAudit.warningCount} Warning</span>
                        </>
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedOverviewCards.hedgingAudit ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>

                {expandedOverviewCards.hedgingAudit && (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-4 animate-fade-in">
                    <p className="text-xs text-[#64748B] dark:text-neutral-400 leading-relaxed">
                      {fullReport.hedgingAudit.summary}
                    </p>
                    <div className="space-y-2.5">
                      {fullReport.hedgingAudit.matches.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">&ldquo;{item.matchedPhrase}&rdquo;</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border shrink-0 ${
                              item.severity === "critical"
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                            }`}>
                              {item.category.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 italic leading-relaxed">&ldquo;...{item.sentenceSnippet}...&rdquo;</p>
                          <div className="text-[11px] pt-1.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-start gap-1.5">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">Hedged Rewrite:</span>
                            <span className="text-neutral-800 dark:text-neutral-200 font-medium">&ldquo;{item.suggestedRewrite}&rdquo;</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CARD 9: Citation Recency & Half-Life Profile */}
            {!isNonAcademic && fullReport?.citationHealth && fullReport.citationHealth.totalReferences > 0 && (
              <div className="rounded-3xl liquid-glass-card border border-black/[0.08] dark:border-white/[0.1] overflow-hidden transition-all duration-200">
                <button
                  type="button"
                  onClick={() => toggleOverviewCard("citationHealth")}
                  className="w-full text-left p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition select-none"
                  aria-expanded={expandedOverviewCards.citationHealth}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                          Citation Recency &amp; Half-Life Profile
                        </h2>
                        <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                          Bibliometric Age
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                        Publication year distribution, literature recency benchmarks, and orphan citation audit
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                    <div className="flex items-center gap-2 text-xs font-medium bg-neutral-50 dark:bg-[#161F30] px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                      <span className="text-neutral-700 dark:text-neutral-300">Median: <strong className="font-bold text-[#0F172A] dark:text-white">{fullReport.citationHealth.medianYear || "N/A"}</strong></span>
                      <span className="text-neutral-300 dark:text-neutral-700">•</span>
                      <span className="text-teal-700 dark:text-teal-400 font-bold">{fullReport.citationHealth.last5YearsPercent}% Last 5 Yrs</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-[#1E293B] flex items-center justify-center text-neutral-500 dark:text-neutral-400 ml-1 shrink-0">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedOverviewCards.citationHealth ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>

                {expandedOverviewCards.citationHealth && (
                  <div className="px-6 pb-6 sm:px-7 sm:pb-7 pt-2 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-4 animate-fade-in">
                    <p className="text-xs text-[#64748B] dark:text-neutral-400 leading-relaxed">
                      {fullReport.citationHealth.summary}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Citation Half-Life</span>
                        <span className="text-base font-bold text-neutral-900 dark:text-white">{fullReport.citationHealth.citationHalfLifeYears ?? "N/A"} yrs</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Last 3 Years</span>
                        <span className="text-base font-bold text-teal-600 dark:text-teal-400">{fullReport.citationHealth.last3YearsPercent}% ({fullReport.citationHealth.last3YearsCount})</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Self-Citation Rate</span>
                        <span className="text-base font-bold text-neutral-900 dark:text-white">{fullReport.citationHealth.selfCitationPercent}%</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Orphan Citations</span>
                        <span className={`text-base font-bold ${fullReport.citationHealth.orphanReferencesCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {fullReport.citationHealth.orphanReferencesCount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CARD 10: Code, Data & Artifact Reproducibility Auditor */}
            {!isNonAcademic && fullReport?.artifactAudit && (
              <ArtifactAuditCard
                artifactAudit={fullReport.artifactAudit}
                isExpanded={expandedOverviewCards.artifactAudit}
                onToggle={() => toggleOverviewCard("artifactAudit")}
              />
            )}

            {/* CARD 11: Display Items, Figures & Visual Pre-Flight Auditor */}
            {!isNonAcademic && fullReport?.displayItemAudit && (
              <FigureAuditCard
                displayItemAudit={fullReport.displayItemAudit}
                isExpanded={expandedOverviewCards.figureAudit}
                onToggle={() => toggleOverviewCard("figureAudit")}
              />
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* INELIGIBILITY NOTICE FOR PEER-REVIEW SUBVIEWS            */}
        {/* ========================================================= */}
        {activeView !== "overview" && activeView !== "citations" && !isReviewEligible && !isDeskReject && (
          <div className="rounded-3xl liquid-glass-card p-8 sm:p-12 text-center space-y-4 shadow-xs animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">
                {isAlreadyPublished ? "Already Published Article" : "Ineligible for Pre-Submission Simulation"}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
                {isAlreadyPublished
                  ? "This article has already been published in the peer-reviewed scientific literature. Simulated referee personas, scoring dimensions, and pre-submission action items are not applicable."
                  : "Simulated peer-reviewer personas, scoring dimensions, and target journal calibrations are only generated for empirical research manuscripts."}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => onSelectView("overview")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold liquid-glass-btn-primary transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Overview</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: 5 REVIEWER PERSONAS (ADVERSARIAL PANEL)            */}
        {/* ========================================================= */}
        {activeView === "personas" && (isReviewEligible || isDeskReject) && (
          <DashboardPersonasSection
            personas={personas}
            selectedPersona={selectedPersona}
            setSelectedPersona={setSelectedPersona}
            fullReport={fullReport}
            currentReport={currentReport}
            editorialTriage={data.editorialTriage}
            matchingJournalsData={matchingJournalsData}
            targetJournal={targetJournal}
            title={title}
            copiedReportIndex={copiedReportIndex}
            handleCopyRefereeReport={handleCopyRefereeReport}
            copiedSnippetIndex={copiedSnippetIndex}
            handleCopySnippet={handleCopySnippet}
            onSelectView={onSelectView}
            journalsCount={journals.length}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 3: 6 SCORING DIMENSIONS                               */}
        {/* ========================================================= */}
        {activeView === "dimensions" && (isReviewEligible || isDeskReject) && (
          <DashboardDimensionsSection dimensions={dimensions} />
        )}

        {/* ========================================================= */}
        {/* TAB 4: ACTION PLAN & CRITICAL ISSUES                      */}
        {/* ========================================================= */}
        {activeView === "issues" && (isReviewEligible || isDeskReject) && (
          <DashboardIssuesSection issues={issues} />
        )}

        {/* ========================================================= */}
        {/* TAB 5: TARGET JOURNAL RECOMMENDATIONS                     */}
        {/* ========================================================= */}
        {activeView === "journals" && (isReviewEligible || isDeskReject) && (
          <DashboardJournalsSection
            isDeskReject={isDeskReject}
            matchingJournalsData={matchingJournalsData}
            targetJournal={targetJournal}
            displayJournals={displayJournals}
            otherJournals={otherJournals}
            openJournalWebsite={openJournalWebsite}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 6: CITATION INTEGRITY AUDIT                           */}
        {/* ========================================================= */}
        {activeView === "citations" && (
          <DashboardCitationsSection
            citationIntegrity={effectiveReport?.citationIntegrity}
            dataCitationAudit={data.citationAudit}
            authors={effectiveReport?.authors}
            effectiveReport={effectiveReport}
            onUpdateCitationIntegrity={handleUpdateCitationIntegrity}
            onExportBibTeX={async () => {
              if (effectiveReport) {
                await exportBibTeX(effectiveReport);
              }
            }}
          />
        )}
        </div>
      </div>

      {/* Export Toast Notification */}
      <ExportCompletedToast
        toast={exportToast}
        onClose={() => setExportToast(null)}
      />
    </div>
  );
}
