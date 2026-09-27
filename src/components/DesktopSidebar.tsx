"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Settings,
  PanelLeft,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Sparkles,
  Cpu,
  Check,
} from "lucide-react";
import { isDesktopApp } from "@/lib/desktop";
import { useTheme } from "@/context/ThemeContext";
import { EditorialTriageOutcome, DocumentClassification, PublishedArticleDetails } from "@/lib/types";
import {
  type TimeCategory,
  type GroupedPapers,
  getTimeCategory,
  groupPapersByTime,
} from "./sidebar/sidebarUtils";
import { SidebarCollapsedView } from "./sidebar/SidebarCollapsedView";
import { SidebarPaperList } from "./sidebar/SidebarPaperList";

export type DesktopActiveView =
  | "overview"
  | "personas"
  | "dimensions"
  | "issues"
  | "journals"
  | "citations"
  | "recommendations";

export interface PaperItem {
  id: string;
  title: string;
  shortName: string;
  journal: string;
  score?: number;
  isEligibleForReview?: boolean;
  ineligibilityReason?: "already_published" | "non_academic_document" | "scope_mismatch";
  isPublished?: boolean;
  publishedJournal?: string;
  publishedDetails?: PublishedArticleDetails;
  editorialTriage?: EditorialTriageOutcome;
  targetJournalEvaluation?: any;
  isDeskReject?: boolean;
  classification?: DocumentClassification;
  scanType?: "persona" | "laya" | "typesafe";
  layaResult?: any;
  typesafeResult?: any;
  provider?: string;
  model?: string;
  aiEngine?: string;
  createdAt?: string;
  updatedAt?: string;

  // Background Scanning Lifecycle status:
  status?: "completed" | "reviewing" | "failed";
  scanStep?: string;
  scanPercent?: number;
  scanError?: {
    title: string;
    explanation: string;
    action: string;
    technical?: string;
    category?: string;
  };
  scanParams?: {
    title: string;
    abstract?: string;
    keywords?: string;
    targetJournal: string;
    rawText?: string;
  };
}

export { getTimeCategory, groupPapersByTime };
export type { TimeCategory, GroupedPapers };

interface DesktopSidebarProps {
  papers: PaperItem[];
  activePaperId: string | null;
  activeView: DesktopActiveView;
  isConnected?: boolean;
  isLoading?: boolean;
  provider?: string | null;
  activeModelName?: string | null;
  isCollapsed?: boolean;
  isScanning?: boolean;
  onToggleCollapse?: () => void;
  onSelectPaper: (id: string) => void;
  onSelectView: (view: DesktopActiveView) => void;
  onOpenSearch: () => void;
  onNewReview: () => void;
  onOpenSettings: () => void;
  onOpenLocalModel?: () => void;
  onSelectService?: (serviceId: string) => void;
  onDeletePaper?: (paper: PaperItem, e: React.MouseEvent) => void;
  onDeleteMultiplePapers?: (papers: PaperItem[]) => void;
  onGoHome?: () => void;
  selectedPaperIds?: Set<string>;
  onToggleSelectPaper?: (id: string) => void;
  onClearSelectedPapers?: () => void;
}

export function DesktopSidebar({
  papers,
  activePaperId,
  activeView,
  isConnected = false,
  isLoading = false,
  provider,
  activeModelName,
  isCollapsed = false,
  isScanning = false,
  onToggleCollapse,
  onSelectPaper,
  onSelectView,
  onOpenSearch,
  onNewReview,
  onOpenSettings,
  onOpenLocalModel,
  onSelectService,
  onDeletePaper,
  onDeleteMultiplePapers,
  onGoHome,
  selectedPaperIds: controlledSelectedPaperIds,
  onToggleSelectPaper,
  onClearSelectedPapers,
}: DesktopSidebarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const appearanceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (appearanceRef.current && !appearanceRef.current.contains(e.target as Node)) {
        setAppearanceOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [localSelectedPaperIds, setLocalSelectedPaperIds] = useState<Set<string>>(new Set());
  const selectedPaperIds = controlledSelectedPaperIds ?? localSelectedPaperIds;

  const handleToggleSelect = (paperId: string) => {
    if (onToggleSelectPaper) {
      onToggleSelectPaper(paperId);
    } else {
      setLocalSelectedPaperIds((prev) => {
        const next = new Set(prev);
        if (next.has(paperId)) next.delete(paperId);
        else next.add(paperId);
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    if (onClearSelectedPapers) {
      onClearSelectedPapers();
    } else {
      setLocalSelectedPaperIds(new Set());
    }
  };

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

  const [isTransitioning, setIsTransitioning] = useState(false);
  const isFirstRender = useRef(true);
  const prevCollapsedRef = useRef(isCollapsed);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (prevCollapsedRef.current !== isCollapsed) {
      prevCollapsedRef.current = isCollapsed;
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 520);
      return () => clearTimeout(timer);
    }
  }, [isCollapsed]);

  // Connection status: "connected" (green) | "connecting" (orange/yellow) | "disconnected" (red)
  const connectionStatus = isLoading
    ? "connecting"
    : isConnected
    ? "connected"
    : "disconnected";

  const connectionLabel =
    connectionStatus === "connected"
      ? activeModelName || "AI Connected"
      : connectionStatus === "connecting"
      ? "Connecting..."
      : "Connect AI";

  const groupedPapers = useMemo(() => {
    return groupPapersByTime(papers);
  }, [papers]);

  return (
    <aside
      className={`h-full select-none shrink-0 flex flex-col relative liquid-glass-sidebar text-[#1F2937] dark:text-[#E2E8F0] sidebar-elastic-spring ${
        isCollapsed ? "w-[68px] z-40" : "w-64 z-30"
      } ${
        isTransitioning
          ? "overflow-hidden"
          : "overflow-visible"
      }`}
    >
      {/* ------------------------------------------------------------- */}
      {/* COLLAPSED SIDEBAR VIEW LAYER                                  */}
      {/* ------------------------------------------------------------- */}
      <SidebarCollapsedView
        isCollapsed={isCollapsed}
        isTransitioning={isTransitioning}
        onToggleCollapse={onToggleCollapse}
        activePaperId={activePaperId}
        activeView={activeView}
        papers={papers}
        groupedPapers={groupedPapers}
        connectionStatus={connectionStatus}
        connectionLabel={connectionLabel}
        onSelectPaper={onSelectPaper}
        onSelectView={onSelectView}
        onNewReview={onNewReview}
        onOpenSettings={onOpenSettings}
        onOpenLocalModel={onOpenLocalModel}
        onDeletePaper={onDeletePaper}
        isScanning={isScanning}
      />

      {/* ------------------------------------------------------------- */}
      {/* EXPANDED SIDEBAR VIEW LAYER                                   */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`absolute inset-y-0 left-0 w-64 flex flex-col h-full transition-opacity duration-200 ease-in-out ${
          !isCollapsed
            ? "opacity-100 pointer-events-auto z-20"
            : "opacity-0 pointer-events-none z-10"
        } overflow-hidden`}
      >
        {/* 1. COMPANY HEADER: Logo + Title + Collapse Button (Desktop only: web mode shows this in DesktopHeader) */}
        {isDesktopApp() && (
          <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="h-[46px] flex items-center justify-between px-2 py-1.5 rounded-xl liquid-glass-card shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0 select-none">
                <img
                  src="/icon.svg"
                  alt="ManuView Logo"
                  className="w-7 h-7 rounded-lg shadow-xs shrink-0 select-none"
                />
                <div className="truncate min-w-0">
                  <div className="font-bold text-xs text-[#0F172A] dark:text-white tracking-tight">
                    ManuView Desktop
                  </div>
                  <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                    Research &amp; Review Suite
                  </div>
                </div>
              </div>
              {/* Collapse sidebar icon replacing the gear icon */}
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.1] text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TOP SECTION: OVERVIEW (Matching PureMac Smart Care overview item) */}
        <div className="px-3 pt-3 pb-1 space-y-1 shrink-0">
          <div className="text-[10px] font-bold text-[#94A3B8] dark:text-neutral-500 uppercase tracking-wider px-2">
            OVERVIEW
          </div>
          <button
            type="button"
            onClick={onNewReview}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all duration-200 cursor-pointer text-left ${
              !activePaperId
                ? "liquid-glass-tab-active font-bold text-[#0F172A] dark:text-white shadow-xs"
                : "text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-transparent font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="truncate font-semibold">
                Pre-Submission Scan
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
              New
            </span>
          </button>
        </div>

        {/* SCROLLABLE MAIN CONTENT: ARTICLES LIST */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 [scrollbar-width:thin]">
          <SidebarPaperList
            papers={papers}
            groupedPapers={groupedPapers}
            activePaperId={activePaperId}
            activeView={activeView}
            selectedPaperIds={selectedPaperIds}
            onToggleSelectPaper={handleToggleSelect}
            onClearSelection={handleClearSelection}
            onSelectPaper={onSelectPaper}
            onSelectView={onSelectView}
            onNewReview={onNewReview}
            onDeleteMultiplePapers={onDeleteMultiplePapers}
            isScanning={isScanning}
          />
        </div>

        {/* 2. DOCKED BOTTOM SECTION: STATUS CARD & APPEARANCE */}
        <div className="px-3 pt-2 pb-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2 shrink-0">
          {/* AI ENGINE & LOCAL AI CONTROLS */}
          <div className="flex items-center gap-2">
            <div
              onClick={onOpenSettings}
              className="flex-1 p-2.5 rounded-xl liquid-glass-card shadow-xs flex items-center gap-2.5 cursor-pointer hover:scale-[1.01] transition-all duration-200 min-w-0"
              title="AI Engine Status - Click to configure"
            >
              <div className="relative flex items-center justify-center shrink-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    connectionStatus === "connected"
                      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                      : connectionStatus === "connecting"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-rose-500"
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                  {connectionStatus === "connected"
                    ? "Ready to review"
                    : connectionStatus === "connecting"
                    ? "Connecting..."
                    : "Engine Disconnected"}
                </div>
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate font-medium">
                  {connectionStatus === "connected"
                    ? provider === "laya" || provider === "typesafe"
                      ? "Fast Scan • Laya On-Device"
                      : `${activeModelName || "Local AI"} • 100% Private`
                    : "Configure provider"}
                </div>
              </div>
            </div>

            {onOpenLocalModel && (
              <button
                type="button"
                disabled={isScanning}
                onClick={onOpenLocalModel}
                title={
                  isScanning
                    ? "Model switching is disabled during an active scan"
                    : "Local On-Device AI (WebGPU SLM)"
                }
                className={`h-[46px] px-2.5 rounded-xl liquid-glass-btn-secondary text-purple-700 dark:text-purple-300 transition-all flex flex-col items-center justify-center gap-0.5 shrink-0 shadow-xs ${
                  isScanning
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer active:scale-95"
                }`}
              >
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-[9px] font-bold tracking-tight">Local AI</span>
              </button>
            )}
          </div>

          {/* APPEARANCE SELECTOR (3-Way: Light, Dark, System) */}
          <div className="relative" ref={appearanceRef}>
            <button
              type="button"
              onClick={() => setAppearanceOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
              title={`Appearance: ${theme} (Active: ${resolvedTheme}). Click to change.`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {theme === "system" ? (
                  <Monitor className="w-4 h-4 text-blue-500 shrink-0" />
                ) : theme === "dark" ? (
                  <Moon className="w-4 h-4 text-purple-400 shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className="font-semibold text-xs">Appearance</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] capitalize text-neutral-400 dark:text-neutral-500 font-semibold px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.08]">
                  {theme === "system" ? `System (${resolvedTheme})` : theme}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-150 ${
                    appearanceOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {appearanceOpen && (
              <div className="absolute bottom-full mb-1.5 left-0 right-0 p-1.5 rounded-2xl liquid-glass-modal shadow-2xl z-50 animate-fade-in backdrop-blur-2xl space-y-0.5 border border-black/10 dark:border-white/10">
                {[
                  {
                    id: "light",
                    label: "Light",
                    icon: Sun,
                    iconColor: "text-amber-500",
                  },
                  {
                    id: "dark",
                    label: "Dark",
                    icon: Moon,
                    iconColor: "text-purple-400",
                  },
                  {
                    id: "system",
                    label: "System",
                    icon: Monitor,
                    iconColor: "text-blue-500",
                  },
                ].map((opt) => {
                  const isSelected = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={(e) => {
                        setTheme(opt.id as any, e);
                        setAppearanceOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <opt.icon className={`w-3.5 h-3.5 ${opt.iconColor}`} />
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
