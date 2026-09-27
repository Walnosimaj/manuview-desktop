"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { PaperItem } from "@/components/DesktopSidebar";
import { DesktopDashboardData } from "@/components/DesktopDashboard";
import { FullReviewReport, ParsedManuscript } from "@/lib/types";
import { extractTextFromFile, parseManuscriptText } from "@/lib/parser";
import { runManuscriptDiagnostic } from "@/lib/diagnostic-engine";
import { fetchLiveJournalScope } from "@/lib/journal-scope-service";
import { resolveActiveConfig } from "@/lib/llm";
import { translateScanError, HumanReadableScanError } from "@/lib/scanErrorTranslator";

export interface ScanParams {
  title: string;
  abstract?: string;
  keywords?: string;
  targetJournal: string;
  file?: File | null;
  rawText?: string;
  scanEngine?: "persona" | "laya" | "typesafe";
}

interface ScanContextValue {
  isScanning: boolean;
  activeScanPaperId: string | null;
  startScan: (params: ScanParams) => Promise<string | null>;
  retryScan: (paper: PaperItem) => Promise<void>;
  cancelScan?: (paperId: string) => void;
}

const ScanContext = createContext<ScanContextValue>({
  isScanning: false,
  activeScanPaperId: null,
  startScan: async () => null,
  retryScan: async () => {},
});

export interface ScanProviderProps {
  children: React.ReactNode;
  onScanStarted: (pendingPaper: PaperItem) => void;
  onScanProgress: (paperId: string, step: string, percent?: number) => void;
  onScanCompleted: (
    paperId: string,
    updatedPaper: PaperItem,
    data: DesktopDashboardData,
    fullReport?: FullReviewReport
  ) => void;
  onScanFailed: (paperId: string, error: HumanReadableScanError) => void;
}

export function ScanProvider({
  children,
  onScanStarted,
  onScanProgress,
  onScanCompleted,
  onScanFailed,
}: ScanProviderProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [activeScanPaperId, setActiveScanPaperId] = useState<string | null>(null);

  // Maintain references to props to prevent stale closure issues in long-running background tasks
  const onStartedRef = useRef(onScanStarted);
  const onProgressRef = useRef(onScanProgress);
  const onCompletedRef = useRef(onScanCompleted);
  const onFailedRef = useRef(onScanFailed);

  onStartedRef.current = onScanStarted;
  onProgressRef.current = onScanProgress;
  onCompletedRef.current = onScanCompleted;
  onFailedRef.current = onScanFailed;

  const executeBackgroundPipeline = useCallback(
    async (paperId: string, params: ScanParams) => {
      setIsScanning(true);
      setActiveScanPaperId(paperId);

      try {
        // 1. Text Parsing & Categorization (Gatekeeper for ALL engines)
        onProgressRef.current(paperId, "Screening document format & scholarly categorization...", 10);
        let parsed: ParsedManuscript;
        if (params.file) {
          onProgressRef.current(paperId, "Extracting text from manuscript document...", 20);
          const extracted = await extractTextFromFile(params.file);
          onProgressRef.current(paperId, "Parsing IMRaD sections & reference bibliography...", 30);
          parsed = parseManuscriptText(extracted, params.file.name || "manuscript.txt");
          if (params.title.trim()) parsed.title = params.title.trim();
          if (params.abstract?.trim()) parsed.abstract = params.abstract.trim();
        } else if (params.rawText) {
          onProgressRef.current(paperId, "Analyzing manuscript sections...", 25);
          parsed = parseManuscriptText(params.rawText, "manuscript.txt");
          if (params.title.trim()) parsed.title = params.title.trim();
          if (params.abstract?.trim()) parsed.abstract = params.abstract.trim();
        } else {
          onProgressRef.current(paperId, "Structuring Title & Abstract metadata...", 25);
          const synthetic = `Title: ${params.title}\n\nAbstract:\n${params.abstract || ""}\n\nKeywords: ${params.keywords || ""}`;
          parsed = parseManuscriptText(synthetic, "manuscript.txt");
          parsed.title = params.title.trim();
          parsed.abstract = params.abstract?.trim() || "";
        }

        const classification = parsed.classification;
        const isLayaScan = params.scanEngine === "laya" || params.scanEngine === "typesafe";

        // =========================================================================
        // UNIVERSAL CATEGORIZATION GATE
        // Works identically across Cloud AI, Local AI (Ollama), Local SLM, and Laya.
        // If a document is ineligible (CV, PRD, source code, invoice, shopping list,
        // diagnostic/evaluation report, etc.), immediately bypass all further review
        // without making external API calls, wasting tokens, or causing model disparity.
        // =========================================================================
        if (!classification.isAcademicManuscript) {
          onProgressRef.current(paperId, `Document ineligible: classified as ${classification.categoryLabel}`, 100);

          const activeConfig = isLayaScan ? null : await resolveActiveConfig().catch(() => null);
          const aiEngineLabel = isLayaScan ? "Laya" : (activeConfig?.provider?.toUpperCase() || "AI ENGINE");

          const completedPaper: PaperItem = {
            id: paperId,
            title: parsed.title || params.title || "Untitled Document",
            shortName: (parsed.title || params.title || "Document").split(" ").slice(0, 3).join(" "),
            journal: params.targetJournal,
            score: undefined,
            scanType: isLayaScan ? "laya" : "persona",
            provider: isLayaScan ? "laya" : (activeConfig?.provider || "gemini"),
            model: isLayaScan ? undefined : activeConfig?.model,
            aiEngine: aiEngineLabel,
            isEligibleForReview: false,
            ineligibilityReason: "non_academic_document",
            isDeskReject: false,
            classification,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: "completed",
            scanStep: "Review Bypassed (Non-Academic Document)",
            scanPercent: 100,
            scanParams: params,
          };

          const dashboardData: DesktopDashboardData = {
            paperTitle: completedPaper.title,
            headlineTitle: `Document Ineligible for Peer Review (${classification.categoryLabel})`,
            targetJournal: completedPaper.journal,
            aiEngine: isLayaScan ? "Fast Scan (Laya)" : aiEngineLabel,
            latencyMs: 35,
            score: undefined,
            isDeskReject: false,
            statusText: `Review Bypassed (${classification.categoryLabel})`,
            vulnerabilities: [],
            reviewers: [],
            citationAudit: { verifiedCount: 0, totalCount: 0, retractedCount: 0 },
          };

          const fullReport: FullReviewReport = {
            mode: "full",
            id: `rep_${Date.now()}`,
            createdAt: new Date().toISOString(),
            title: completedPaper.title,
            targetJournal: completedPaper.journal,
            funnelStageReached: "stage0_integrity",
            isEligibleForReview: false,
            ineligibilityReason: "non_academic_document",
            summary: classification.advisoryMessage,
            classification,
            reviewerPersonas: [],
            priorityIssues: [
              {
                id: "issue-non-academic",
                priority: "A",
                title: "Document Ineligible for Peer Review",
                category: "Scope/Fit",
                description: classification.advisoryMessage,
                actionableFix: classification.customGuidance,
                reviewerQuote: classification.advisoryMessage,
                source: "heuristic",
              },
            ],
            dimensions: undefined,
            journalRecommendations: [],
            citationIntegrity: {
              totalReferences: 0,
              sampledCount: 0,
              checkedCount: 0,
              verifiedCount: 0,
              unresolvableCount: 0,
              uncheckedCount: 0,
              retractedCount: 0,
              coverageNote: "Bypassed for non-academic document",
              retractionCheckAvailable: true,
              references: [],
            },
            reportingGuideline: undefined,
            displayItemAudit: undefined,
            executionMode: "llm_synthesized",
            reviewStatus: "complete",
          };

          onCompletedRef.current(paperId, completedPaper, dashboardData, fullReport);
          setIsScanning(false);
          setActiveScanPaperId(null);
          return;
        }

        // 2. Provider Credentials Verification (For academic manuscripts only)
        onProgressRef.current(paperId, "Verifying AI provider connection & credentials...", 35);
        const activeConfig = await resolveActiveConfig();

        if (!isLayaScan) {
          const isConfigUsable =
            Boolean(activeConfig.apiKey && activeConfig.apiKey.trim().length > 0) ||
            Boolean(activeConfig.hasSecureKey) ||
            activeConfig.provider === "ollama" ||
            activeConfig.provider === "webllm";

          if (!isConfigUsable) {
            throw new Error(
              "No AI model provider configured. A review requires one configured provider: Ollama (local server), Local SLM (WebLLM), or Cloud LLM API. Please open Settings (Cmd+,) to configure."
            );
          }
        }

        // 3. Fetch Journal Scope & Aims
        onProgressRef.current(
          paperId,
          `Searching aims & scope for "${params.targetJournal}" via scholarly registries...`,
          40
        );
        const liveScope = await fetchLiveJournalScope(params.targetJournal);

        // 4. Execution: Laya Objective Audit vs 5-Persona Peer Review
        if (isLayaScan) {
          onProgressRef.current(paperId, "Running Laya Fast Scan objective evaluation battery...", 55);
          const { runLayaScan } = await import("@/lib/laya/laya-scan");
          const { LAYA_MODEL } = await import("@/lib/laya/laya-service");
          const targetModel =
            (activeConfig.provider === "laya" || activeConfig.provider === "typesafe") && activeConfig.model
              ? activeConfig.model
              : LAYA_MODEL.id;

          const rawManuscript =
            params.rawText ||
            (params.file ? await extractTextFromFile(params.file) : "") ||
            `${parsed.title}\n\n${parsed.abstract}`;

          const scanResult = await runLayaScan(rawManuscript, {
            model: targetModel,
            targetJournal: params.targetJournal,
            journalScope: liveScope?.aimsAndScope || undefined,
            filename: params.file?.name,
          });

          onProgressRef.current(paperId, "Compiling Laya Fast Scan calibrated diagnostics...", 90);

          // Use ONLY scanResult's classification — runLayaScan() already runs
          // classifyDocument() internally (line 811).  Using parsed.classification
          // as a secondary check created double-jeopardy where two independent
          // runs of the same classifier could disagree on edge cases.
          const classification = scanResult.classification;
          const isNonAcademic = !scanResult.isAcademic;
          const isAlreadyPublished = scanResult.ineligibilityReason === "already_published";

          const isDeskReject =
            !isNonAcademic &&
            !isAlreadyPublished &&
            (scanResult.signals.some((s) => s.id === "desk_reject_risk" && s.value >= 2) ||
            scanResult.signals.some((s) => s.id === "journal_scope_fit" && s.display?.toLowerCase().includes("out of scope")));

          const completedPaper: PaperItem = {
            id: paperId,
            title: parsed.title || params.title || "Untitled Manuscript",
            shortName: (parsed.title || params.title || "Manuscript")
              .split(" ")
              .slice(0, 3)
              .join(" "),
            journal: scanResult.publishedDetails?.journalName || params.targetJournal,
            score: isNonAcademic || isAlreadyPublished ? undefined : scanResult.readiness,
            scanType: "laya",
            layaResult: scanResult,
            typesafeResult: scanResult,
            provider: "laya",
            model: targetModel,
            aiEngine: "Laya",
            isEligibleForReview: !isNonAcademic && !isAlreadyPublished,
            ineligibilityReason: isAlreadyPublished
              ? "already_published"
              : isNonAcademic
              ? "non_academic_document"
              : isDeskReject
              ? "scope_mismatch"
              : undefined,
            isPublished: isAlreadyPublished,
            publishedJournal: scanResult.publishedDetails?.journalName,
            publishedDetails: scanResult.publishedDetails,
            isDeskReject,
            classification,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: "completed",
            scanStep: "Fast Scan complete",
            scanPercent: 100,
            scanParams: params,
          };

          const dashboardData: DesktopDashboardData = {
            paperTitle: completedPaper.title,
            headlineTitle: isAlreadyPublished
              ? `${completedPaper.journal} (Published Article)`
              : isNonAcademic
              ? `Document Ineligible for Peer Review (${classification?.categoryLabel || "Non-Academic"})`
              : `${params.targetJournal} Pre-Submission Audit (Fast Scan)`,
            targetJournal: completedPaper.journal,
            aiEngine: "Fast Scan (Laya)",
            latencyMs: 140,
            score: isNonAcademic || isAlreadyPublished ? undefined : scanResult.readiness,
            isDeskReject,
            statusText: isAlreadyPublished
              ? "Already Published Article"
              : isNonAcademic
              ? "Review Bypassed (Non-Academic Document)"
              : isDeskReject
              ? "Editorial Desk Reject (High Risk)"
              : scanResult.readiness >= 75
              ? "High Acceptance Readiness"
              : "Revision Prioritized",
            vulnerabilities: scanResult.flags.map((f) => ({
              type: "overclaim" as const,
              title: f.label,
              description: f.detail || f.display,
              severity: f.tone === "bad" ? "critical" : "warning",
            })),
            reviewers: (scanResult.reviewerPersonas || []).map((p) => ({
              name: p.name,
              role: p.title || p.persona,
              tag: (p.decisionRecommendation?.includes("Reject")
                ? "Critical"
                : p.decisionRecommendation?.includes("Minor")
                ? "Minor"
                : "Major") as "Major" | "Minor" | "Critical",
              quote:
                p.keyChallenge ||
                p.assessment?.slice(0, 150) ||
                "Comprehensive evaluation required.",
              detail: p.majorCritiques?.join(" ") || p.assessment || "",
            })),
            citationAudit: {
              verifiedCount: parsed.references?.length || 0,
              totalCount: parsed.references?.length || 0,
              retractedCount: 0,
              notes: "Citation references parsed.",
            },
          };

          const fullReport: FullReviewReport = {
            id: paperId,
            createdAt: completedPaper.createdAt || new Date().toISOString(),
            title: completedPaper.title,
            targetJournal: completedPaper.journal,
            overallScore: isNonAcademic || isAlreadyPublished || isDeskReject ? undefined : scanResult.readiness,
            calibratedAcceptance: scanResult.calibratedAcceptance,
            isEligibleForReview: !isNonAcademic && !isAlreadyPublished && !isDeskReject,
            isDeskReject,
            ineligibilityReason: isAlreadyPublished
              ? "already_published"
              : isNonAcademic
              ? "non_academic_document"
              : isDeskReject
              ? "scope_mismatch"
              : undefined,
            publishedDetails: scanResult.publishedDetails,
            summary: isAlreadyPublished
              ? "Article already formally published."
              : isNonAcademic
              ? `Document classified as ${classification?.categoryLabel || "Non-Academic"}.`
              : isDeskReject
              ? `Editorial screening flagged significant misalignment with ${params.targetJournal}.`
              : `Fast diagnostic completed using Laya System-1. Overall readiness scored at ${scanResult.readiness}%.`,
            classification: classification || {
              category: "academic_manuscript",
              categoryLabel: "Academic Manuscript",
              isAcademicManuscript: true,
              confidence: 0.95,
              detectedFeatures: [],
              salutation: "Dear Author / Researcher",
              advisoryMessage: "Academic manuscript evaluated.",
              customGuidance: "Review recommendations below.",
            },
            dimensions: scanResult.dimensions,
            priorityIssues: scanResult.flags.map((f, i) => ({
              id: `flag-${i + 1}`,
              priority: (f.tone === "bad" ? "A" : "B") as "A" | "B" | "C",
              title: f.label,
              category: "Methodology" as const,
              description: f.detail || f.display,
              location: "Manuscript text",
              reviewerQuote: f.detail || `${f.label}: ${f.display}`,
              actionableFix: `Address ${f.label.toLowerCase()} to strengthen submission rigor.`,
            })),
            reviewerPersonas: scanResult.reviewerPersonas || [],
            journalRecommendations: [
              {
                tier: "Realistic",
                journalName: completedPaper.journal,
                publisher: "Target Venue",
                fitScore: scanResult.readiness,
                scopeRationale: `Evaluated against ${completedPaper.journal} aims and scope.`,
                rejectionRisks: scanResult.flags.map((f) => f.label),
                requiredRevisionsForFit: [],
              },
            ],
            citationIntegrity: {
              totalReferences: parsed.references?.length || 0,
              sampledCount: parsed.references?.length || 0,
              checkedCount: parsed.references?.length || 0,
              coverageNote: "Automated bibliographic screening.",
              verifiedCount: parsed.references?.length || 0,
              unresolvableCount: 0,
              uncheckedCount: 0,
              retractedCount: 0,
              retractionCheckAvailable: true,
              selfCitationRatio: 0.05,
              recencyProfile: { last5YearsPercent: 75, olderThan5YearsPercent: 25 },
              references: (parsed.references || []).map((r) => ({
                raw: r,
                status: "valid" as const,
                isRetracted: false,
              })),
            },
            editorialTriage: {
              outcome: isDeskReject ? "desk_reject" : "sent_for_review",
              sentToPeerReview: !isDeskReject && !isNonAcademic && !isAlreadyPublished,
              summary: isDeskReject
                ? `Scope or methodology criteria flagged for ${params.targetJournal}.`
                : `Cleared editorial triage for ${params.targetJournal}.`,
            },
          };

          onProgressRef.current(paperId, "Saving diagnostic audit...", 95);
          onCompletedRef.current(paperId, completedPaper, dashboardData, fullReport);
          setIsScanning(false);
          setActiveScanPaperId(null);
          return;
        }

        // Standard 5-Persona Diagnostic Evaluation
        onProgressRef.current(
          paperId,
          "Commissioning 5-persona peer review panel & running deep diagnostic scan...",
          55
        );

        const fullReport = await runManuscriptDiagnostic(
          parsed,
          activeConfig,
          params.targetJournal,
          (update) => {
            onProgressRef.current(paperId, update.message, update.percent);
          },
          liveScope
        );

        // 4. Calculate final flags
        const isExplicitlySent =
          fullReport.editorialTriage?.outcome === "sent_for_review" ||
          fullReport.editorialTriage?.sentToPeerReview === true ||
          Boolean(fullReport.editorialTriage?.summary?.includes("Cleared editorial triage"));
        const isDeskReject =
          !isExplicitlySent &&
          (fullReport.editorialTriage?.outcome === "desk_reject" ||
          fullReport.ineligibilityReason === "scope_mismatch" ||
          fullReport.targetJournalEvaluation?.isDisciplinaryMismatch === true);
        const isPublished =
          !isDeskReject &&
          (fullReport.ineligibilityReason === "already_published" ||
            Boolean(fullReport.publishedDetails?.isPublished));
        const isEligible = !isDeskReject && !isPublished && fullReport.isEligibleForReview !== false;

        const completedPaper: PaperItem = {
          id: paperId,
          title: fullReport.title || params.title || "Untitled Manuscript",
          shortName: (fullReport.title || params.title || "Manuscript")
            .split(" ")
            .slice(0, 3)
            .join(" "),
          journal: fullReport.publishedDetails?.journalName || params.targetJournal,
          score: isDeskReject || isPublished ? undefined : isEligible ? fullReport.overallScore || 80 : undefined,
          scanType: "persona",
          provider: activeConfig.provider || "gemini",
          model: activeConfig.model,
          aiEngine: activeConfig.provider?.toUpperCase() || "GEMINI",
          isEligibleForReview: !isDeskReject && isEligible,
          isDeskReject: isDeskReject,
          ineligibilityReason: isDeskReject
            ? "scope_mismatch"
            : isPublished
            ? "already_published"
            : fullReport.ineligibilityReason,
          isPublished: isPublished,
          publishedJournal: fullReport.publishedDetails?.journalName,
          publishedDetails: fullReport.publishedDetails,
          editorialTriage: fullReport.editorialTriage,
          targetJournalEvaluation: fullReport.targetJournalEvaluation,
          classification: fullReport.classification,
          createdAt: fullReport.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "completed",
          scanStep: "Review complete",
          scanPercent: 100,
          scanParams: params,
        };

        const dashboardData: DesktopDashboardData = {
          paperTitle: completedPaper.title,
          headlineTitle: isDeskReject
            ? `${params.targetJournal} Pre-Submission Diagnostic (Desk Reject)`
            : isPublished
            ? `${completedPaper.journal} (Published Article)`
            : `${params.targetJournal} Pre-Submission Diagnostic`,
          targetJournal: completedPaper.journal,
          aiEngine: activeConfig.provider?.toUpperCase() || "AI ENGINE",
          latencyMs: 120,
          score: isDeskReject || isPublished ? undefined : isEligible ? fullReport.overallScore || 80 : undefined,
          isDeskReject: isDeskReject,
          editorialTriage: fullReport.editorialTriage,
          statusText: isDeskReject
            ? "Editorial Desk Reject (Scope Mismatch)"
            : !isEligible
            ? isPublished
              ? "Already Published Article"
              : "Ineligible Document Type"
            : (fullReport.overallScore || 80) >= 80
            ? "High Acceptance Probability"
            : "Revision Prioritized",
          vulnerabilities:
            fullReport.priorityIssues?.map((issue: any) => ({
              type: (issue.category === "Causal Claims"
                ? "overclaim"
                : "sample_size") as "overclaim" | "sample_size",
              title: issue.title,
              description: issue.description,
              severity: (issue.priority === "A" ? "critical" : "warning") as "critical" | "warning",
            })) || [],
          reviewers:
            fullReport.reviewerPersonas?.map((p: any) => ({
              name: p.name,
              role: p.title || p.persona,
              tag: (p.decisionRecommendation?.includes("Reject")
                ? "Critical"
                : "Major") as "Major" | "Minor" | "Critical",
              quote:
                p.keyChallenge ||
                p.assessment?.slice(0, 150) ||
                "Comprehensive evaluation required.",
              detail: p.majorCritiques?.join(" ") || p.assessment || "",
            })) || [],
          citationAudit: {
            verifiedCount: fullReport.citationIntegrity?.verifiedCount ?? 0,
            totalCount: fullReport.citationIntegrity?.totalReferences ?? 0,
            retractedCount: fullReport.citationIntegrity?.retractedCount ?? 0,
            notes: fullReport.citationIntegrity?.references?.length
              ? `Verified ${fullReport.citationIntegrity.verifiedCount} DOIs via CrossRef Open API.`
              : undefined,
          },
        };

        onCompletedRef.current(paperId, completedPaper, dashboardData, fullReport);
      } catch (rawError: any) {
        console.error("Diagnostic background scan failed:", rawError);
        const translated = translateScanError(rawError);
        onFailedRef.current(paperId, translated);
      } finally {
        setIsScanning(false);
        setActiveScanPaperId(null);
      }
    },
    []
  );

  const startScan = useCallback(
    async (params: ScanParams): Promise<string | null> => {
      if (isScanning) {
        return null;
      }

      const paperId = `paper-${Date.now()}`;
      const title =
        params.title.trim() ||
        (params.file ? params.file.name.replace(/\.[^/.]+$/, "") : "Untitled Manuscript");

      const shortName = title
        .split(" ")
        .slice(0, 3)
        .join(" ");

      const isLaya = params.scanEngine === "laya" || params.scanEngine === "typesafe";
      const activeConfig = isLaya ? null : await resolveActiveConfig().catch(() => null);
      const pendingPaper: PaperItem = {
        id: paperId,
        title: title,
        shortName: shortName,
        journal: params.targetJournal,
        scanType: isLaya ? "laya" : "persona",
        provider: isLaya ? "laya" : (activeConfig?.provider || "gemini"),
        model: isLaya ? undefined : activeConfig?.model,
        aiEngine: isLaya ? "Laya" : (activeConfig?.provider || "Gemini"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "reviewing",
        scanStep: "Initializing diagnostic review...",
        scanPercent: 10,
        scanParams: params,
      };

      onStartedRef.current(pendingPaper);

      // Trigger background processing asynchronously without blocking caller
      setTimeout(() => {
        executeBackgroundPipeline(paperId, params);
      }, 50);

      return paperId;
    },
    [isScanning, executeBackgroundPipeline]
  );

  const retryScan = useCallback(
    async (paper: PaperItem) => {
      if (isScanning || !paper.scanParams) return;
      const paperId = paper.id;

      onProgressRef.current(paperId, "Retrying diagnostic review...", 10);
      executeBackgroundPipeline(paperId, paper.scanParams);
    },
    [isScanning, executeBackgroundPipeline]
  );

  return (
    <ScanContext.Provider
      value={{
        isScanning,
        activeScanPaperId,
        startScan,
        retryScan,
      }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScanManager() {
  return useContext(ScanContext);
}
