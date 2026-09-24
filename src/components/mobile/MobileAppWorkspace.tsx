import React, { useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileTabBar, MobileTab } from "./MobileTabBar";
import { MobileArticleList } from "./MobileArticleList";
import { MobileToolsView } from "./MobileToolsView";
import { MobileArticleDetailView } from "./MobileArticleDetailView";
import { MobileBottomSheet } from "./MobileBottomSheet";
import type { PaperItem } from "@/components/DesktopSidebar";
import type { DesktopDashboardData } from "@/components/DesktopDashboard";
import type { FullReviewReport } from "@/lib/types";
import { DesktopLayaScanView } from "@/components/services/DesktopLayaScanView";
import { DesktopPreSubmissionScanView } from "@/components/services/DesktopPreSubmissionScanView";
import { DesktopJournalFitView } from "@/components/services/DesktopJournalFitView";
import { DesktopReferenceView } from "@/components/services/DesktopReferenceView";
import { DesktopCitationClaimView } from "@/components/services/DesktopCitationClaimView";
import { DesktopPrismaView } from "@/components/services/DesktopPrismaView";
import { DesktopReportingChecklistView } from "@/components/services/DesktopReportingChecklistView";
import { DesktopCoverLetterView } from "@/components/services/DesktopCoverLetterView";
import { DesktopResponseBuilderView } from "@/components/services/DesktopResponseBuilderView";
import { ScanProgressView } from "@/components/dashboard/ScanProgressView";
import { ProviderSettingsModal } from "@/components/ProviderSettingsModal";
import { LocalModelManagerModal } from "@/components/LocalModelManagerModal";
import {
  exportInteractiveHtmlReport,
  exportWordDocReport,
  exportBibTeX,
  exportPdfReport,
} from "@/lib/export-generator";
import { FileText, Download, Code, Sparkles, BookOpen } from "lucide-react";

interface MobileAppWorkspaceProps {
  papers: PaperItem[];
  dashboardStore: Record<string, DesktopDashboardData>;
  fullReportsStore: Record<string, FullReviewReport>;
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  isConnected?: boolean;
  isApiLoading?: boolean;
  modelName?: string | null;
  latencyMs?: number | null;
  onScanComplete: (newPaper: PaperItem, data: DesktopDashboardData, fullReport?: FullReviewReport) => void;
  onOpenArticle: (id: string) => void;
  onOpenService: (serviceId: string) => void;
  onDeletePaper?: (paper: PaperItem) => void;
  isScanning?: boolean;
}

export function MobileAppWorkspace({
  papers,
  dashboardStore,
  fullReportsStore,
  activeTabId,
  setActiveTabId,
  isConnected = false,
  isApiLoading = false,
  modelName,
  latencyMs,
  onScanComplete,
  onOpenArticle,
  onOpenService,
  onDeletePaper,
  isScanning = false,
}: MobileAppWorkspaceProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("articles");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLocalModelOpen, setIsLocalModelOpen] = useState(false);
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false);

  const currentPaper = papers.find((p) => p.id === activeTabId) || null;
  const currentDashboardData = activeTabId ? dashboardStore[activeTabId] : null;
  const currentFullReport = activeTabId ? fullReportsStore[activeTabId] : null;

  // Handle Bottom Tab Navigation
  const handleSelectTab = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === "settings") {
      setIsSettingsOpen(true);
    } else if (tab === "scan") {
      // Switch to scan view
      setActiveTabId("tool-laya-scan");
    } else if (tab === "articles") {
      // If was viewing a tool, close tool and view articles
      if (activeTabId && activeTabId.startsWith("tool-")) {
        setActiveTabId(null);
      }
    } else if (tab === "tools") {
      // Clear active paper to show tools directory
      if (activeTabId && !activeTabId.startsWith("tool-")) {
        setActiveTabId(null);
      }
    }
  };

  // Handle header back action
  const handleBack = () => {
    if (activeTabId) {
      setActiveTabId(null);
    }
  };

  // Determine header title
  const getHeaderTitle = () => {
    if (currentPaper) {
      return currentPaper.shortName || currentPaper.title || "Manuscript";
    }
    if (activeTabId?.startsWith("tool-")) {
      switch (activeTabId) {
        case "tool-laya-scan":
          return "Laya Fast Scan";
        case "tool-ai-review":
        case "tool-pre-submission":
          return "5-Persona AI Review";
        case "tool-journal-fit":
          return "Journal Scope Fit";
        case "tool-reference-checker":
          return "DOI & Reference Audit";
        case "tool-citation-claim":
          return "Citation Claim Verifier";
        case "tool-prisma":
          return "PRISMA 2020 Flowchart";
        case "tool-reporting-checklist":
          return "Reporting Guidelines";
        case "tool-cover-letter":
          return "Cover Letter Drafter";
        case "tool-response-builder":
          return "Rebuttal Matrix";
        default:
          return "Manuscript Tool";
      }
    }
    return "ManuView";
  };

  // Export handlers
  const handleExport = (format: "pdf" | "word" | "html" | "bibtex") => {
    if (!currentPaper || !currentDashboardData) return;
    const report: FullReviewReport = (currentFullReport || {
      mode: "full" as const,
      id: `rep_${Date.now()}`,
      createdAt: new Date().toISOString(),
      title: currentPaper.title,
      targetJournal: currentPaper.journal,
      overallScore: currentDashboardData.score,
      summary: currentDashboardData.statusText,
      dimensions: {},
      reviewerPersonas: [],
      priorityIssues: [],
      journalRecommendations: [],
      classification: currentPaper.classification || {
        isAcademicManuscript: true,
        category: "academic_manuscript" as const,
        categoryLabel: "Research Manuscript",
        confidence: 0.9,
        advisoryMessage: "",
        detectedFeatures: [],
        salutation: "",
        customGuidance: "",
      },
      citationIntegrity: {
        totalReferences: currentDashboardData.citationAudit?.totalCount || 0,
        sampledCount: 0,
        checkedCount: currentDashboardData.citationAudit?.verifiedCount || 0,
        verifiedCount: currentDashboardData.citationAudit?.verifiedCount || 0,
        unresolvableCount: 0,
        uncheckedCount: 0,
        retractedCount: currentDashboardData.citationAudit?.retractedCount || 0,
        coverageNote: "Exported from ManuView",
        retractionCheckAvailable: true,
        references: [],
      },
    }) as FullReviewReport;

    switch (format) {
      case "pdf":
        exportPdfReport(report);
        break;
      case "word":
        exportWordDocReport(report);
        break;
      case "html":
        exportInteractiveHtmlReport(report);
        break;
      case "bibtex":
        exportBibTeX(report);
        break;
    }
    setIsExportSheetOpen(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F2F2F7] dark:bg-[#000000] text-[#111827] dark:text-[#F8FAFC] overflow-hidden select-none font-sans relative">
      {/* Top iOS Navigation Bar */}
      <MobileHeader
        title={getHeaderTitle()}
        onBack={activeTabId ? handleBack : undefined}
        activeModelName={modelName}
        isConnected={isConnected}
        isLoading={isApiLoading}
        onOpenNewScan={() => {
          setActiveTabId("tool-laya-scan");
          setMobileTab("scan");
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Scrollable View Area */}
      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-24 overscroll-contain">
        {/* State 1: Active background scan */}
        {currentPaper && currentPaper.status === "reviewing" ? (
          <ScanProgressView
            paper={currentPaper}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : /* State 2: Active Article Detail View */
        currentPaper && currentDashboardData ? (
          <MobileArticleDetailView
            paper={currentPaper}
            dashboardData={currentDashboardData}
            fullReport={currentFullReport}
            onOpenExportSheet={() => setIsExportSheetOpen(true)}
          />
        ) : /* State 3: Active Tool View */
        activeTabId === "tool-laya-scan" || activeTabId === "tool-typesafe-scan" ? (
          <DesktopLayaScanView onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : activeTabId === "tool-ai-review" || activeTabId === "tool-pre-submission" ? (
          <DesktopPreSubmissionScanView
            onComplete={onScanComplete}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenLocalModel={() => setIsLocalModelOpen(true)}
          />
        ) : activeTabId === "tool-journal-fit" ? (
          <DesktopJournalFitView />
        ) : activeTabId === "tool-reference-checker" ? (
          <DesktopReferenceView />
        ) : activeTabId === "tool-citation-claim" ? (
          <DesktopCitationClaimView onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : activeTabId === "tool-prisma" ? (
          <DesktopPrismaView />
        ) : activeTabId === "tool-reporting-checklist" ? (
          <DesktopReportingChecklistView />
        ) : activeTabId === "tool-cover-letter" ? (
          <DesktopCoverLetterView onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : activeTabId === "tool-response-builder" ? (
          <DesktopResponseBuilderView onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : /* State 4: Root Tabs */
        mobileTab === "tools" ? (
          <MobileToolsView
            onSelectService={(serviceId) => {
              setActiveTabId(`tool-${serviceId}`);
            }}
          />
        ) : (
          /* Default: Articles List */
          <MobileArticleList
            papers={papers}
            activePaperId={activeTabId}
            onSelectPaper={(id) => onOpenArticle(id)}
            onDeletePaper={onDeletePaper}
            onOpenFastScan={() => {
              setActiveTabId("tool-laya-scan");
              setMobileTab("scan");
            }}
          />
        )}
      </main>

      {/* iOS Bottom Navigation Bar */}
      <MobileTabBar
        activeTab={mobileTab}
        onSelectTab={handleSelectTab}
        articlesCount={papers.length}
        isScanning={isScanning}
      />

      {/* iOS Export Action Sheet */}
      <MobileBottomSheet
        isOpen={isExportSheetOpen}
        onClose={() => setIsExportSheetOpen(false)}
        title="Export Publication Report"
      >
        <div className="space-y-2 py-2">
          <button
            onClick={() => handleExport("pdf")}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-sm text-neutral-900 dark:text-white block">
                  Print-Ready PDF
                </span>
                <span className="text-xs text-neutral-500">
                  Styled report with charts & editorial notes
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-neutral-400" />
          </button>

          <button
            onClick={() => handleExport("word")}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-sm text-neutral-900 dark:text-white block">
                  Microsoft Word (.docx)
                </span>
                <span className="text-xs text-neutral-500">
                  Formatted document for track changes with co-authors
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-neutral-400" />
          </button>

          <button
            onClick={() => handleExport("html")}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-sm text-neutral-900 dark:text-white block">
                  Interactive HTML Report
                </span>
                <span className="text-xs text-neutral-500">
                  Standalone web bundle with interactive radar charts
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-neutral-400" />
          </button>

          <button
            onClick={() => handleExport("bibtex")}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-sm text-neutral-900 dark:text-white block">
                  BibTeX Library (.bib)
                </span>
                <span className="text-xs text-neutral-500">
                  Verified reference DOIs for Overleaf and LaTeX
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
      </MobileBottomSheet>

      {/* Settings & Model Manager Modals */}
      <ProviderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenLocalModel={() => setIsLocalModelOpen(true)}
      />
      <LocalModelManagerModal
        isOpen={isLocalModelOpen}
        onClose={() => setIsLocalModelOpen(false)}
      />
    </div>
  );
}
