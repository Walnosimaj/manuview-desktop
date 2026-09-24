import React, { useState, useEffect } from "react";
import { DesktopHeader, TabItem } from "@/components/DesktopHeader";
import {
  DesktopSidebar,
  DesktopActiveView,
  PaperItem,
} from "@/components/DesktopSidebar";
import {
  DesktopDashboard,
  DesktopDashboardData,
} from "@/components/DesktopDashboard";
import { DesktopSearchModal } from "@/components/DesktopModals";
import { DesktopScanModal } from "@/components/services/DesktopScanModal";
import { DesktopPreSubmissionScanView } from "@/components/services/DesktopPreSubmissionScanView";
import { DesktopJournalFitView } from "@/components/services/DesktopJournalFitView";
import { DesktopReferenceView } from "@/components/services/DesktopReferenceView";
import { DesktopCitationClaimView } from "@/components/services/DesktopCitationClaimView";
import { DesktopPrismaView } from "@/components/services/DesktopPrismaView";
import { DesktopReportingChecklistView } from "@/components/services/DesktopReportingChecklistView";
import { DesktopCoverLetterView } from "@/components/services/DesktopCoverLetterView";
import { DesktopResponseBuilderView } from "@/components/services/DesktopResponseBuilderView";
import { DesktopLayaScanView } from "@/components/services/DesktopLayaScanView";
import { DesktopLayaDashboardView } from "@/components/services/DesktopLayaDashboardView";
import { DesktopEmptyDashboard } from "@/components/DesktopEmptyDashboard";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { ProviderSettingsModal } from "@/components/ProviderSettingsModal";
import { LocalModelManagerModal } from "@/components/LocalModelManagerModal";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { ThemeProvider } from "@/context/ThemeContext";
import { ScanProvider, useScanManager } from "@/context/ScanContext";
import { ScanProgressView } from "@/components/dashboard/ScanProgressView";
import { ScanErrorView } from "@/components/dashboard/ScanErrorView";
import { HumanReadableScanError } from "@/lib/scanErrorTranslator";
import { useApiConnection } from "@/lib/useApiConnection";
import { FullReviewReport } from "@/lib/types";
import { isDesktopApp } from "@/lib/desktop";
import { useIsMobile } from "@/lib/useIsMobile";
import { DesktopWebLandingPage } from "@/components/landing/DesktopWebLandingPage";
import { MobileAppWorkspace } from "@/components/mobile/MobileAppWorkspace";
import {
  loadSavedProjects,
  saveProject,
  deleteProject,
  deleteProjects,
  loadSession,
  saveSession,
  purgeLegacyDummyData,
  initIndexedDBStorage,
} from "@/lib/projectStorage";
import { migrateLegacyLocalStorageKeys } from "@/lib/secureStorage";

export default function App() {
  const isMobile = useIsMobile();

  // Web vs Desktop workspace view state (Mobile screens default directly to app mode)
  const [viewMode, setViewMode] = useState<"landing" | "app">(() => {
    if (isDesktopApp()) return "app";
    try {
      const saved = sessionStorage.getItem("manuview_web_view_mode");
      if (saved === "app") return "app";
      if (saved === "landing") return "landing";
    } catch {}
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "app";
    }
    return "landing";
  });

  // Manage body scroll behaviour depending on mode and ensure desktop app stays in app mode
  useEffect(() => {
    if (isDesktopApp() && viewMode !== "app") {
      setViewMode("app");
      return;
    }
    try {
      sessionStorage.setItem("manuview_web_view_mode", viewMode);
    } catch {}
    if (viewMode === "landing") {
      document.body.classList.remove("overflow-hidden", "select-none");
    } else {
      if (isDesktopApp()) {
        document.body.classList.add("overflow-hidden", "select-none");
      }
    }
  }, [viewMode]);

  // Purge legacy mock data, synchronize IndexedDB & dismiss splash screen
  useEffect(() => {
    if (!isDesktopApp()) {
      const splash = document.getElementById("app-splash");
      if (splash) splash.remove();
    }

    purgeLegacyDummyData();
    migrateLegacyLocalStorageKeys();
    const startTime = Date.now();

    initIndexedDBStorage()
      .then((syncedProjects) => {
        if (syncedProjects && syncedProjects.length > papers.length) {
          setPapers(syncedProjects.map((s) => s.paper));
          setDashboardStore((prev) => {
            const next = { ...prev };
            for (const item of syncedProjects) {
              if (!next[item.paper.id]) {
                next[item.paper.id] = item.dashboardData;
              }
            }
            return next;
          });
          setFullReportsStore((prev) => {
            const next = { ...prev };
            for (const item of syncedProjects) {
              if (item.fullReport && !next[item.paper.id]) {
                next[item.paper.id] = item.fullReport;
              }
            }
            return next;
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        const vid = document.getElementById("intro-video") as HTMLVideoElement | null;
        // If an intro video is actively loaded and playing, let it play until ended or skipped
        const isVideoActive = vid && vid.style.display !== "none" && !vid.ended;
        if (!isVideoActive) {
          const elapsed = Date.now() - startTime;
          const delay = Math.max(0, 650 - elapsed);
          setTimeout(() => {
            dismissSplash();
          }, delay);
        }
      });

    const dismissSplash = (immediate?: boolean) => {
      const splash = document.getElementById("app-splash");
      if (splash) {
        splash.style.opacity = "0";
        splash.style.pointerEvents = "none";
        setTimeout(() => splash.remove(), 500);
      }
    };
    (window as any).__dismissSplash = dismissSplash;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Space") {
        dismissSplash(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Saved papers loaded from local storage
  const [papers, setPapers] = useState<PaperItem[]>(() => {
    purgeLegacyDummyData();
    const saved = loadSavedProjects();
    return saved.map((s) => s.paper);
  });

  const [dashboardStore, setDashboardStore] = useState<Record<string, DesktopDashboardData>>(() => {
    const saved = loadSavedProjects();
    const store: Record<string, DesktopDashboardData> = {};
    for (const item of saved) {
      store[item.paper.id] = item.dashboardData;
    }
    return store;
  });

  const [fullReportsStore, setFullReportsStore] = useState<Record<string, FullReviewReport>>(() => {
    const saved = loadSavedProjects();
    const store: Record<string, FullReviewReport> = {};
    for (const item of saved) {
      if (item.fullReport) {
        store[item.paper.id] = item.fullReport;
      }
    }
    return store;
  });

  // Open tabs list restored from user's last session
  const [openTabs, setOpenTabs] = useState<TabItem[]>(() => {
    const session = loadSession();
    return session?.openTabs || [];
  });

  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    const session = loadSession();
    return session?.activeTabId || null;
  });

  const [activeView, setActiveView] = useState<DesktopActiveView>(() => {
    const session = loadSession();
    return session?.activeView || "overview";
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Live API Connection state
  const {
    isConnected,
    isLoading: isApiLoading,
    modelName,
    latencyMs,
    provider,
  } = useApiConnection();

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLocalModelOpen, setIsLocalModelOpen] = useState(false);
  const [papersToDelete, setPapersToDelete] = useState<PaperItem[] | null>(null);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());

  // Auto-prune any selected IDs when papers are removed or deleted
  useEffect(() => {
    const validIds = new Set(papers.map((p) => p.id));
    setSelectedPaperIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [papers]);

  const handleToggleSelectPaper = (id: string) => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelectedPapers = () => {
    setSelectedPaperIds(new Set());
  };

  const handleSelectAllPapers = () => {
    if (selectedPaperIds.size === papers.length) {
      setSelectedPaperIds(new Set());
    } else {
      setSelectedPaperIds(new Set(papers.map((p) => p.id)));
    }
  };

  // Automatically persist user session state (open tabs, active tab, active view)
  useEffect(() => {
    saveSession({
      openTabs,
      activeTabId,
      activeView,
      lastActiveAt: new Date().toISOString(),
    });
  }, [openTabs, activeTabId, activeView]);

  // Current active paper if activeTab is an article
  const currentPaper = papers.find((p) => p.id === activeTabId) || null;
  const currentDashboardData =
    (activeTabId && dashboardStore[activeTabId]) || null;

  // Open an article in a tab
  const handleOpenArticle = (id: string) => {
    const paper = papers.find((p) => p.id === id);
    if (!paper) return;

    if (!openTabs.some((t) => t.id === id)) {
      setOpenTabs((prev) => [
        ...prev,
        {
          id: paper.id,
          type: "article",
          title: paper.title,
          shortName: paper.shortName,
        },
      ]);
    }
    setActiveTabId(id);
    setActiveView("overview");
  };

  // Open a service tool in a tab
  const handleOpenService = (serviceId: string) => {
    const normalizedServiceId =
      serviceId === "triage" || serviceId === "pre-submission"
        ? "ai-review"
        : serviceId;

    const toolMap: Record<string, { title: string; shortName: string }> = {
      "ai-review": { title: "Pre-Submission AI Review", shortName: "AI Review" },
      "journal-fit": { title: "Journal Fit Predictor", shortName: "Journal Fit" },
      "reference-checker": { title: "Reference Integrity Audit", shortName: "Reference Audit" },
      "citation-claim": { title: "Citation Claim Validator", shortName: "Citation Claim" },
      prisma: { title: "PRISMA Flow Diagram", shortName: "PRISMA 2020" },
      "cover-letter": { title: "Journal Cover Letter", shortName: "Cover Letter" },
      "response-builder": { title: "Review Response Builder", shortName: "Response Matrix" },
      "laya-scan": { title: "Fast Scan (Laya)", shortName: "Fast Scan" },
      "typesafe-scan": { title: "Fast Scan (Laya)", shortName: "Fast Scan" },
    };

    const toolInfo = toolMap[normalizedServiceId];
    if (!toolInfo) return;

    const tabId = `tool-${normalizedServiceId}`;
    if (!openTabs.some((t) => t.id === tabId)) {
      setOpenTabs((prev) => [
        ...prev,
        {
          id: tabId,
          type: "tool",
          title: toolInfo.title,
          shortName: toolInfo.shortName,
          toolType: normalizedServiceId,
        },
      ]);
    }
    setActiveTabId(tabId);
  };

  // Close a tab
  const handleCloseTab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const remaining = openTabs.filter((t) => t.id !== id);
    setOpenTabs(remaining);
    if (activeTabId === id) {
      if (remaining.length > 0) {
        setActiveTabId(remaining[remaining.length - 1].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  // Scan lifecycle callbacks for non-blocking background scanner
  const handleScanStarted = (pendingPaper: PaperItem) => {
    setPapers((prev) => [pendingPaper, ...prev.filter((p) => p.id !== pendingPaper.id)]);
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === pendingPaper.id)) return prev;
      return [
        ...prev,
        {
          id: pendingPaper.id,
          type: "article",
          title: pendingPaper.title,
          shortName: pendingPaper.shortName,
        },
      ];
    });
    setActiveTabId(pendingPaper.id);
    setActiveView("overview");
  };

  const handleScanProgress = (paperId: string, step: string, percent?: number) => {
    setPapers((prev) =>
      prev.map((p) =>
        p.id === paperId
          ? {
              ...p,
              status: "reviewing",
              scanStep: step,
              scanPercent: percent ?? p.scanPercent,
            }
          : p
      )
    );
  };

  const handleScanCompleted = (
    paperId: string,
    updatedPaper: PaperItem,
    data: DesktopDashboardData,
    fullReport?: FullReviewReport
  ) => {
    saveProject(updatedPaper, data, fullReport);
    setPapers((prev) =>
      prev.map((p) => (p.id === paperId ? updatedPaper : p))
    );
    setDashboardStore((prev) => ({ ...prev, [paperId]: data }));
    if (fullReport) {
      setFullReportsStore((prev) => ({ ...prev, [paperId]: fullReport }));
    }
  };

  const handleScanFailed = (paperId: string, error: HumanReadableScanError) => {
    setPapers((prev) =>
      prev.map((p) =>
        p.id === paperId
          ? {
              ...p,
              status: "failed",
              scanError: error,
              scanStep: "Review halted",
            }
          : p
      )
    );
  };

  // Handle project deletion confirmed by user
  const handleDeleteProjectConfirm = () => {
    if (!papersToDelete || papersToDelete.length === 0) return;
    const ids = papersToDelete.map((p) => p.id);
    const idSet = new Set(ids);

    // 1. Delete from local persistent storage on user's computer in batch
    deleteProjects(ids);

    // 2. Remove from React state
    setPapers((prev) => prev.filter((p) => !idSet.has(p.id)));
    setDashboardStore((prev) => {
      const copy = { ...prev };
      for (const id of ids) delete copy[id];
      return copy;
    });
    setFullReportsStore((prev) => {
      const copy = { ...prev };
      for (const id of ids) delete copy[id];
      return copy;
    });

    // 3. Close open tabs if present
    setOpenTabs((prev) => {
      const remaining = prev.filter((t) => !idSet.has(t.id));
      if (idSet.has(activeTabId || "")) {
        setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
      }
      return remaining;
    });

    // 4. Prune/clear deleted IDs from selectedPaperIds
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });

    setPapersToDelete(null);
  };

  // When live scan completes manually from modal
  const handleScanComplete = (
    newPaper: PaperItem,
    data: DesktopDashboardData,
    fullReport?: FullReviewReport
  ) => {
    saveProject(newPaper, data, fullReport);
    setPapers((prev) => [newPaper, ...prev]);
    setDashboardStore((prev) => ({ ...prev, [newPaper.id]: data }));
    if (fullReport) {
      setFullReportsStore((prev) => ({ ...prev, [newPaper.id]: fullReport }));
    }
    setOpenTabs((prev) => [
      ...prev,
      {
        id: newPaper.id,
        type: "article",
        title: newPaper.title,
        shortName: newPaper.shortName,
      },
    ]);
    setActiveTabId(newPaper.id);
    setActiveView("overview");
  };

  // Render Web Landing Page in browser mode (or when navigated to landing)
  if (viewMode === "landing") {
    return (
      <ThemeProvider>
        <DesktopWebLandingPage
          onLaunchApp={() => setViewMode("app")}
          onOpenScan={() => {
            setViewMode("app");
            setIsScanOpen(true);
          }}
          onOpenService={(serviceId) => {
            setViewMode("app");
            handleOpenService(serviceId);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isConnected={isConnected}
          isApiLoading={isApiLoading}
          modelName={modelName}
          latencyMs={latencyMs}
        />
        <ProviderSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onOpenLocalModel={() => setIsLocalModelOpen(true)}
        />
        <LocalModelManagerModal
          isOpen={isLocalModelOpen}
          onClose={() => setIsLocalModelOpen(false)}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ScanProvider
        onScanStarted={handleScanStarted}
        onScanProgress={handleScanProgress}
        onScanCompleted={handleScanCompleted}
        onScanFailed={handleScanFailed}
      >
        {isMobile ? (
          <MobileAppWorkspace
            papers={papers}
            dashboardStore={dashboardStore}
            fullReportsStore={fullReportsStore}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            isConnected={isConnected}
            isApiLoading={isApiLoading}
            modelName={modelName}
            latencyMs={latencyMs}
            onScanComplete={handleScanComplete}
            onOpenArticle={handleOpenArticle}
            onOpenService={handleOpenService}
            onDeletePaper={(paper) => setPapersToDelete([paper])}
          />
        ) : (
          <AppWorkspace
            papers={papers}
            setPapers={setPapers}
            dashboardStore={dashboardStore}
            setDashboardStore={setDashboardStore}
            fullReportsStore={fullReportsStore}
            setFullReportsStore={setFullReportsStore}
            openTabs={openTabs}
            setOpenTabs={setOpenTabs}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            activeView={activeView}
            setActiveView={setActiveView}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            isConnected={isConnected}
            isApiLoading={isApiLoading}
            modelName={modelName}
            latencyMs={latencyMs}
            provider={provider}
            selectedPaperIds={selectedPaperIds}
            onToggleSelectPaper={handleToggleSelectPaper}
            onClearSelectedPapers={handleClearSelectedPapers}
            onSelectAllPapers={handleSelectAllPapers}
            papersToDelete={papersToDelete}
            setPapersToDelete={setPapersToDelete}
            handleDeleteProjectConfirm={handleDeleteProjectConfirm}
            handleScanComplete={handleScanComplete}
            handleOpenArticle={handleOpenArticle}
            handleOpenService={handleOpenService}
            handleCloseTab={handleCloseTab}
            setViewMode={setViewMode}
          />
        )}
      </ScanProvider>
    </ThemeProvider>
  );
}

interface AppWorkspaceProps {
  papers: PaperItem[];
  setPapers: React.Dispatch<React.SetStateAction<PaperItem[]>>;
  dashboardStore: Record<string, DesktopDashboardData>;
  setDashboardStore: React.Dispatch<React.SetStateAction<Record<string, DesktopDashboardData>>>;
  fullReportsStore: Record<string, FullReviewReport>;
  setFullReportsStore: React.Dispatch<React.SetStateAction<Record<string, FullReviewReport>>>;
  openTabs: TabItem[];
  setOpenTabs: React.Dispatch<React.SetStateAction<TabItem[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  activeView: DesktopActiveView;
  setActiveView: React.Dispatch<React.SetStateAction<DesktopActiveView>>;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isConnected: boolean;
  isApiLoading: boolean;
  modelName: string | null;
  latencyMs: number | null;
  provider: any;
  selectedPaperIds: Set<string>;
  onToggleSelectPaper: (id: string) => void;
  onClearSelectedPapers: () => void;
  onSelectAllPapers: () => void;
  papersToDelete: PaperItem[] | null;
  setPapersToDelete: React.Dispatch<React.SetStateAction<PaperItem[] | null>>;
  handleDeleteProjectConfirm: () => void;
  handleScanComplete: (newPaper: PaperItem, data: DesktopDashboardData, fullReport?: FullReviewReport) => void;
  handleOpenArticle: (id: string) => void;
  handleOpenService: (serviceId: string) => void;
  handleCloseTab: (id: string, e?: React.MouseEvent) => void;
  setViewMode: React.Dispatch<React.SetStateAction<"landing" | "app">>;
}

function AppWorkspace({
  papers,
  setPapers,
  dashboardStore,
  setDashboardStore,
  fullReportsStore,
  setFullReportsStore,
  openTabs,
  setOpenTabs,
  activeTabId,
  setActiveTabId,
  activeView,
  setActiveView,
  sidebarOpen,
  setSidebarOpen,
  isConnected,
  isApiLoading,
  modelName,
  latencyMs,
  provider,
  selectedPaperIds,
  onToggleSelectPaper,
  onClearSelectedPapers,
  onSelectAllPapers,
  papersToDelete,
  setPapersToDelete,
  handleDeleteProjectConfirm,
  handleScanComplete,
  handleOpenArticle,
  handleOpenService,
  handleCloseTab,
  setViewMode,
}: AppWorkspaceProps) {
  const { isScanning } = useScanManager();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLocalModelOpen, setIsLocalModelOpen] = useState(false);

  // Global desktop keyboard shortcuts (Cmd/Ctrl + K, N, W, comma)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !isInput) {
        e.preventDefault();
        if (!isScanning) {
          setIsScanOpen(true);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w" && !isInput) {
        e.preventDefault();
        if (activeTabId) {
          handleCloseTab(activeTabId);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
    };
    const handleOpenLocal = () => setIsLocalModelOpen(true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("manuview_open_local_models", handleOpenLocal);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("manuview_open_local_models", handleOpenLocal);
    };
  }, [activeTabId, openTabs, isScanning, handleCloseTab]);

  const currentPaper = papers.find((p) => p.id === activeTabId) || null;
  const currentDashboardData =
    (activeTabId && dashboardStore[activeTabId]) || null;

  // Render view corresponding to active tab
  const renderActiveTabContent = () => {
    if (!activeTabId) {
      return (
        <DesktopEmptyDashboard
          papers={papers}
          onOpenArticle={handleOpenArticle}
          onOpenService={handleOpenService}
          onDeletePaper={(paper) => setPapersToDelete([paper])}
          onDeleteMultiplePapers={(targets) => setPapersToDelete(targets)}
          selectedPaperIds={selectedPaperIds}
          onToggleSelectPaper={onToggleSelectPaper}
          onSelectAllPapers={onSelectAllPapers}
          onClearSelectedPapers={onClearSelectedPapers}
          isScanning={isScanning}
        />
      );
    }

    if (activeTabId === "tool-ai-review" || activeTabId === "tool-pre-submission") {
      return (
        <DesktopPreSubmissionScanView
          onComplete={handleScanComplete}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenLocalModel={() => setIsLocalModelOpen(true)}
        />
      );
    }
    if (activeTabId === "tool-journal-fit") {
      return <DesktopJournalFitView />;
    }
    if (activeTabId === "tool-reference-checker") {
      return <DesktopReferenceView />;
    }
    if (activeTabId === "tool-citation-claim") {
      return <DesktopCitationClaimView onOpenSettings={() => setIsSettingsOpen(true)} />;
    }
    if (activeTabId === "tool-prisma") {
      return <DesktopPrismaView />;
    }
    if (activeTabId === "tool-reporting-checklist") {
      return <DesktopReportingChecklistView />;
    }
    if (activeTabId === "tool-cover-letter") {
      return <DesktopCoverLetterView onOpenSettings={() => setIsSettingsOpen(true)} />;
    }
    if (activeTabId === "tool-response-builder") {
      return <DesktopResponseBuilderView onOpenSettings={() => setIsSettingsOpen(true)} />;
    }
    if (activeTabId === "tool-laya-scan" || activeTabId === "tool-typesafe-scan") {
      return <DesktopLayaScanView onOpenSettings={() => setIsSettingsOpen(true)} />;
    }

    // Article Review Lifecycle: Active in-progress background scan
    if (currentPaper && currentPaper.status === "reviewing") {
      return (
        <ScanProgressView
          paper={currentPaper}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      );
    }

    // Article Review Lifecycle: Scan halted / failed with actionable guidance
    if (currentPaper && currentPaper.status === "failed") {
      return (
        <ScanErrorView
          paper={currentPaper}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onDeleteArticle={() => setPapersToDelete([currentPaper])}
          onOpenService={handleOpenService}
        />
      );
    }

    // Default: Completed Article Review Dashboard
    if (currentPaper && (currentPaper.scanType === "laya" || currentPaper.scanType === "typesafe")) {
      return (
        <DashboardErrorBoundary fallbackTitle="Laya Dashboard Display Error">
          <DesktopLayaDashboardView
            paper={currentPaper}
            scanResult={currentPaper.layaResult || currentPaper.typesafeResult}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onNewScan={() => !isScanning && handleOpenService("ai-review")}
            onDeleteArticle={() => setPapersToDelete(currentPaper ? [currentPaper] : null)}
          />
        </DashboardErrorBoundary>
      );
    }

    if (currentPaper && (currentDashboardData || (activeTabId && fullReportsStore[activeTabId]))) {
      return (
        <DashboardErrorBoundary fallbackTitle="Review Dashboard Display Error">
          <DesktopDashboard
            data={
              currentDashboardData || {
                paperTitle: currentPaper.title,
                headlineTitle: currentPaper.title,
                targetJournal: currentPaper.journal,
                aiEngine: "Gemini 2.5 Flash",
                latencyMs: 820,
                score: currentPaper.score,
                statusText: "Submission Ready",
                vulnerabilities: [],
                reviewers: [],
                citationAudit: { verifiedCount: 52, totalCount: 52, retractedCount: 0 },
              }
            }
            fullReport={activeTabId ? fullReportsStore[activeTabId] : null}
            activeView={activeView}
            isConnected={isConnected}
            isLoading={isApiLoading}
            activeModelName={modelName}
            latencyMs={latencyMs}
            onSelectView={(view) => setActiveView(view)}
            onNewScan={() => !isScanning && handleOpenService("ai-review")}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onDeleteArticle={() => setPapersToDelete(currentPaper ? [currentPaper] : null)}
            onUpdateFullReport={(updatedReport, updatedData) => {
              if (activeTabId) {
                setFullReportsStore((prev) => ({ ...prev, [activeTabId]: updatedReport }));
                if (updatedData) {
                  setDashboardStore((prev) => ({ ...prev, [activeTabId]: updatedData }));
                }
                const paper = papers.find((p) => p.id === activeTabId);
                if (paper) {
                  const isExplicitlySent =
                    (updatedReport.editorialTriage?.outcome === "sent_for_review" ||
                      Boolean(updatedReport.editorialTriage?.summary?.includes("Cleared editorial triage"))) &&
                    updatedReport.isEligibleForReview !== false;
                  const isReportDeskReject =
                    !isExplicitlySent &&
                    (updatedReport.editorialTriage?.outcome === "desk_reject" ||
                      updatedReport.ineligibilityReason === "scope_mismatch" ||
                      updatedReport.targetJournalEvaluation?.isDisciplinaryMismatch === true ||
                      updatedData?.isDeskReject === true);
                  const updatedPaper: PaperItem = {
                    ...paper,
                    isDeskReject: isReportDeskReject,
                    score: isReportDeskReject ? undefined : (updatedReport.overallScore ?? paper.score),
                    isEligibleForReview: !isReportDeskReject,
                    ineligibilityReason: isReportDeskReject ? "scope_mismatch" : undefined,
                    targetJournalEvaluation: updatedReport.targetJournalEvaluation || paper.targetJournalEvaluation,
                  };
                  setPapers((prev) => prev.map((p) => (p.id === activeTabId ? updatedPaper : p)));
                  saveProject(updatedPaper, updatedData || currentDashboardData || ({} as any), updatedReport);
                }
              }
            }}
          />
        </DashboardErrorBoundary>
      );
    }

    return (
      <DesktopEmptyDashboard
        papers={papers}
        onOpenArticle={handleOpenArticle}
        onOpenService={handleOpenService}
        onDeletePaper={(paper) => setPapersToDelete([paper])}
        onDeleteMultiplePapers={(targets) => setPapersToDelete(targets)}
        selectedPaperIds={selectedPaperIds}
        onToggleSelectPaper={onToggleSelectPaper}
        onSelectAllPapers={onSelectAllPapers}
        onClearSelectedPapers={onClearSelectedPapers}
        isScanning={isScanning}
      />
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col liquid-glass-canvas text-[#111827] dark:text-[#F8FAFC] overflow-hidden select-none font-sans relative">
      {/* Top Window Header with Browser-style Tabs */}
      <DesktopHeader
        openTabs={openTabs}
        activeTabId={activeTabId}
        onSelectTab={(id) => setActiveTabId(id)}
        onCloseTab={handleCloseTab}
        onNewTab={() => !isScanning && handleOpenService("ai-review")}
        onSelectService={handleOpenService}
        isConnected={isConnected}
        isLoading={isApiLoading}
        activeModelName={modelName}
        latencyMs={latencyMs}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        sidebarOpen={sidebarOpen}
        onGoHome={!isDesktopApp() ? () => setViewMode("landing") : undefined}
        isScanning={isScanning}
      />

      {/* Main Layout: Sidebar + Active View */}
      <div className="flex-1 flex overflow-hidden">
        <DesktopSidebar
          papers={papers}
          activePaperId={activeTabId}
          activeView={activeView}
          isConnected={isConnected}
          isLoading={isApiLoading}
          provider={provider}
          activeModelName={modelName}
          isCollapsed={!sidebarOpen}
          onToggleCollapse={() => setSidebarOpen((prev) => !prev)}
          onSelectPaper={handleOpenArticle}
          onSelectView={(view) => setActiveView(view)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onNewReview={() => !isScanning && handleOpenService("ai-review")}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenLocalModel={() => setIsLocalModelOpen(true)}
          onSelectService={handleOpenService}
          onDeletePaper={(paper) => setPapersToDelete([paper])}
          onDeleteMultiplePapers={(targets) => setPapersToDelete(targets)}
          onGoHome={!isDesktopApp() ? () => setViewMode("landing") : undefined}
          selectedPaperIds={selectedPaperIds}
          onToggleSelectPaper={onToggleSelectPaper}
          onClearSelectedPapers={onClearSelectedPapers}
          isScanning={isScanning}
        />

        {/* View Content */}
        {renderActiveTabContent()}
      </div>

      {/* Modals */}
      <DesktopSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        papers={papers}
        onSelectItem={(id) => {
          if (papers.some((p) => p.id === id)) {
            handleOpenArticle(id);
          } else if (id.startsWith("tool-")) {
            handleOpenService(id.replace("tool-", ""));
          }
        }}
      />

      {/* Live Pre-Submission AI Review Scan Modal */}
      <DesktopScanModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onComplete={handleScanComplete}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Project Deletion Confirmation Modal */}
      <DeleteConfirmationModal
        papers={papersToDelete}
        isOpen={Boolean(papersToDelete && papersToDelete.length > 0)}
        onClose={() => setPapersToDelete(null)}
        onConfirm={handleDeleteProjectConfirm}
      />

      <ProviderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenLocalModel={() => setIsLocalModelOpen(true)}
        isScanning={isScanning}
      />

      <LocalModelManagerModal
        isOpen={isLocalModelOpen}
        onClose={() => setIsLocalModelOpen(false)}
        isScanning={isScanning}
      />
    </div>
  );
}
