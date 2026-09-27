import React from "react";
import {
  BookOpen,
  PanelLeft,
  Settings,
  Plus,
  Clock,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  BarChart3,
  Cpu,
  Loader2,
  FileQuestion,
} from "lucide-react";
import { isDesktopApp } from "@/lib/desktop";
import type { PaperItem, DesktopActiveView } from "@/components/DesktopSidebar";
import {
  type GroupedPapers,
  type SidebarServiceItem,
  getPaperApiLabel,
  getApiBadgeStyle,
  getSidebarIconBgClass,
  getSidebarScoreBadgeStyle,
} from "./sidebarUtils";
import { classifyDocument } from "@/lib/parser";
import { ApiProviderIcon } from "@/components/BrandLogos";

interface SidebarCollapsedViewProps {
  isCollapsed: boolean;
  isTransitioning: boolean;
  onToggleCollapse?: () => void;
  activePaperId: string | null;
  activeView: DesktopActiveView;
  papers: PaperItem[];
  groupedPapers: GroupedPapers[];
  services?: SidebarServiceItem[];
  connectionStatus: "connected" | "connecting" | "disconnected";
  connectionLabel: string;
  isScanning?: boolean;
  onSelectPaper: (id: string) => void;
  onSelectView: (view: DesktopActiveView) => void;
  onNewReview: () => void;
  onOpenSettings: () => void;
  onOpenLocalModel?: () => void;
  onDeletePaper?: (paper: PaperItem, e: React.MouseEvent) => void;
}

export function SidebarCollapsedView({
  isCollapsed,
  isTransitioning,
  onToggleCollapse,
  activePaperId,
  activeView,
  papers,
  groupedPapers,
  services,
  connectionStatus,
  connectionLabel,
  isScanning = false,
  onSelectPaper,
  onSelectView,
  onNewReview,
  onOpenSettings,
  onOpenLocalModel,
  onDeletePaper,
}: SidebarCollapsedViewProps) {
  const isServiceActive = (serviceId: string) => {
    return activePaperId === `tool-${serviceId}` || activePaperId === serviceId;
  };

  return (
    <div
      className={`absolute inset-y-0 left-0 w-[68px] flex flex-col h-full transition-opacity duration-200 ease-in-out ${
        isCollapsed
          ? "opacity-100 pointer-events-auto z-20"
          : "opacity-0 pointer-events-none z-10"
      } ${isTransitioning ? "overflow-hidden" : "overflow-visible"}`}
    >
      {/* LOGO: Hover reveals expand icon (Desktop only, in web mode it is rendered in DesktopHeader) */}
      {isDesktopApp() && (
        <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.08] flex justify-center">
          <div className="relative group flex justify-center w-full">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              className="w-full h-[46px] rounded-xl liquid-glass-card shadow-xs flex items-center justify-center transition cursor-pointer relative overflow-hidden group/btn hover:border-neutral-300 dark:hover:border-neutral-700"
            >
              {/* Official ManuView Icon */}
              <img
                src="/icon.svg"
                alt="ManuView Logo"
                className="w-7 h-7 rounded-lg shadow-xs transition-all duration-150 group-hover/btn:opacity-0 group-hover/btn:scale-75 select-none"
              />
              {/* Expand sidebar icon on hover */}
              <div className="absolute inset-0 flex items-center justify-center text-[#0F172A] dark:text-white opacity-0 group-hover/btn:opacity-100 transition-all duration-150 group-hover/btn:scale-100">
                <PanelLeft className="w-4 h-4" />
              </div>
            </button>

            {/* Tooltip outside overflow-hidden button */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-[#111827] text-white text-xs font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
              Expand sidebar
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#111827]" />
            </div>
          </div>
        </div>
      )}

      {/* ICONS BENEATH LOGO (overflow-visible so tooltips and submenus fly out cleanly) */}
      <div className="flex-1 overflow-visible px-2 py-3 space-y-3">
        {/* Articles Icon with Right-side Submenu */}
        <div className="relative group flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Articles - Click to expand sidebar"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shadow-2xs ${
              activePaperId
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                : "bg-white dark:bg-[#161F30] border border-[#E5E7EB] dark:border-[#1E293B] hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
          </button>

          {/* Submenu popover on hover */}
          <div className="absolute left-full top-0 ml-2 w-64 liquid-glass-modal border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 backdrop-blur-2xl before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-3 before:content-['']">
            <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Articles ({papers.length})
              </span>
              <button
                type="button"
                onClick={onNewReview}
                disabled={isScanning}
                className={`flex items-center gap-1 text-[11px] font-semibold transition ${
                  isScanning
                    ? "text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-50"
                    : "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 [scrollbar-width:thin]">
              {papers.length === 0 ? (
                <div className="text-xs text-neutral-400 dark:text-neutral-500 py-2 text-center">
                  No articles yet
                </div>
              ) : (
                groupedPapers.map(({ category, papers: groupPapers }) => (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between px-1.5 pt-1.5 pb-0.5 text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-neutral-400 dark:text-neutral-500" />
                        <span>{category}</span>
                      </div>
                      <span className="text-[8px] font-medium px-1 py-0.2 rounded-full bg-neutral-100 dark:bg-[#1E293B] text-neutral-500 dark:text-neutral-400">
                        {groupPapers.length}
                      </span>
                    </div>
                    {groupPapers.map((paper) => {
                      const isSelected = paper.id === activePaperId;
                      const isReviewing = paper.status === "reviewing";
                      const isFailed = paper.status === "failed";
                      const hasSubstantiveEvaluation =
                        (paper.score != null && paper.score > 0) ||
                        paper.editorialTriage?.outcome === "sent_for_review" ||
                        paper.editorialTriage?.sentToPeerReview === true ||
                        Boolean(paper.editorialTriage?.summary?.includes("Cleared editorial triage"));

                      const heuristic = paper.classification || (
                        Boolean(paper.scanParams?.rawText?.trim())
                          ? classifyDocument(paper.scanParams!.rawText!, paper.title)
                          : undefined
                      );
                      const isNonAcademic =
                        !hasSubstantiveEvaluation && (
                          paper.ineligibilityReason === "non_academic_document" ||
                          (paper.classification != null &&
                            !paper.classification.isAcademicManuscript &&
                            paper.classification.category !== "academic_manuscript") ||
                          (paper.layaResult?.classification != null &&
                            !paper.layaResult.classification.isAcademicManuscript &&
                            paper.layaResult.classification.category !== "academic_manuscript") ||
                          (paper.typesafeResult?.classification != null &&
                            !paper.typesafeResult.classification.isAcademicManuscript &&
                            paper.typesafeResult.classification.category !== "academic_manuscript") ||
                          (heuristic != null &&
                            !heuristic.isAcademicManuscript &&
                            heuristic.category !== "academic_manuscript")
                        );
                      const isDeskReject =
                        !isReviewing &&
                        !isFailed &&
                        !isNonAcademic &&
                        (paper.editorialTriage?.outcome === "desk_reject" ||
                          paper.ineligibilityReason === "scope_mismatch" ||
                          paper.targetJournalEvaluation?.isDisciplinaryMismatch === true ||
                          paper.isDeskReject === true);
                      const apiLabel = getPaperApiLabel(paper);
                      return (
                        <div key={paper.id} className="space-y-0.5">
                          <div
                            onClick={() => {
                              onSelectPaper(paper.id);
                              onSelectView("overview");
                            }}
                            className={`group/item w-full flex items-center justify-between p-2 rounded-lg text-xs text-left transition cursor-pointer ${
                              isSelected && activeView === "overview"
                                ? "bg-[#E5E7EB] dark:bg-[#1E293B] font-semibold text-[#111827] dark:text-white"
                                : isSelected
                                ? "bg-[#F3F4F6] dark:bg-[#161F30] font-medium text-[#111827] dark:text-white"
                                : "hover:bg-neutral-50 dark:hover:bg-[#1E293B]/50 text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${getSidebarIconBgClass(
                                  paper,
                                  isReviewing,
                                  isFailed,
                                  isDeskReject,
                                  isNonAcademic
                                )} ${isSelected ? "ring-2 ring-blue-500/40" : ""}`}
                              >
                                {isReviewing ? (
                                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                ) : isFailed || isDeskReject ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-white" />
                                ) : paper.isEligibleForReview === false && paper.ineligibilityReason === "already_published" ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                ) : paper.isEligibleForReview === false || isNonAcademic ? (
                                  <FileQuestion className="w-3.5 h-3.5 text-white" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 text-white" />
                                )}
                              </div>
                              <div className="truncate">
                                <div className="truncate font-medium text-xs text-[#111827] dark:text-neutral-100">
                                  {paper.shortName}
                                </div>
                                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                                  {isReviewing ? (
                                    <span className="text-blue-600 dark:text-blue-400 font-medium truncate">
                                      {paper.scanStep || "Reviewing..."}
                                    </span>
                                  ) : (
                                    <span>{paper.journal}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isReviewing ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  <Loader2 className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                                  <span>Reviewing</span>
                                </span>
                              ) : isFailed ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                                  Failed
                                </span>
                              ) : (
                                <span
                                  title={`Reviewed with ${apiLabel}`}
                                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 opacity-75 group-hover/item:opacity-100 transition"
                                >
                                  <ApiProviderIcon apiLabel={apiLabel} className="w-3.5 h-3.5 shrink-0" />
                                </span>
                              )}
                              {onDeletePaper && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeletePaper(paper, e);
                                  }}
                                  title="Delete manuscript project"
                                  className="p-1 rounded text-neutral-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition opacity-0 group-hover/item:opacity-100 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {isSelected && isFailed && (
                            <div className="pl-3 pr-1 py-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[10px] text-rose-700 dark:text-rose-400 font-medium bg-rose-50/70 dark:bg-rose-950/40 px-2 py-1 rounded border border-rose-200/50 dark:border-rose-800/50">
                                <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span className="truncate">Scan Halted</span>
                              </div>
                            </div>
                          )}

                          {/* Status notification when selected for ineligible papers */}
                          {isSelected && !isReviewing && !isFailed && paper.isEligibleForReview === false && !isDeskReject && (
                            <div className="pl-3 pr-1 py-1 space-y-0.5">
                              {paper.ineligibilityReason === "already_published" ? (
                                <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50/70 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-200/50 dark:border-emerald-800/50">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span className="truncate">Already Published</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-400 font-medium bg-amber-50/70 dark:bg-amber-950/40 px-2 py-1 rounded border border-amber-200/50 dark:border-amber-800/50">
                                  <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span className="truncate">Review Bypassed</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER: Compact Settings & Local AI Pills */}
      <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08] flex flex-col items-center gap-2">
        {onOpenLocalModel && (
          <div className="relative group">
            <button
              type="button"
              onClick={onOpenLocalModel}
              disabled={isScanning}
              title={isScanning ? "Model switching is disabled during an active scan" : "Local On-Device AI (WebGPU SLM)"}
              className={`w-10 h-10 rounded-full border transition liquid-glass-btn-secondary flex items-center justify-center ${
                isScanning
                  ? "border-neutral-200 dark:border-neutral-800 text-neutral-400 cursor-not-allowed opacity-50"
                  : "border-purple-500/20 text-purple-600 dark:text-purple-400 cursor-pointer active:scale-95"
              }`}
            >
              <Cpu className="w-4 h-4" />
            </button>
            <div className="absolute left-full bottom-1 ml-3 px-2.5 py-1 bg-[#111827] text-white text-xs font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex items-center gap-1.5">
              <span>Local On-Device AI</span>
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#111827]" />
            </div>
          </div>
        )}

        <div className="relative group">
          <button
            type="button"
            onClick={onOpenSettings}
            title={
              connectionStatus === "connected"
                ? "AI Connected - Provider Settings"
                : connectionStatus === "connecting"
                ? "Connecting to AI..."
                : "Connect AI - Provider Settings"
            }
            className={`w-10 h-10 rounded-full border transition liquid-glass-btn-secondary flex items-center justify-center cursor-pointer relative ${
              connectionStatus === "connected"
                ? "border-[#86efac] dark:border-[#065f46] text-[#065f46] dark:text-[#34d399]"
                : connectionStatus === "connecting"
                ? "border-[#fde68a] dark:border-[#78350f] text-[#92400e] dark:text-[#fbbf24]"
                : "border-[#fecaca] dark:border-[#7f1d1d] text-[#991b1b] dark:text-[#f87171]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full absolute top-1.5 right-1.5 ${
                connectionStatus === "connected"
                  ? "bg-[#10b981]"
                  : connectionStatus === "connecting"
                  ? "bg-[#f59e0b] animate-pulse"
                  : "bg-[#ef4444]"
              }`}
            />
            <Settings
              className={`w-4 h-4 ${
                connectionStatus === "connected"
                  ? "text-[#047857] dark:text-[#34d399]"
                  : connectionStatus === "connecting"
                  ? "text-[#b45309] dark:text-[#fbbf24]"
                  : "text-[#dc2626] dark:text-[#f87171]"
              }`}
            />
          </button>
          <div className="absolute left-full bottom-1 ml-3 px-2.5 py-1 bg-[#111827] text-white text-xs font-medium rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-[#10b981]"
                  : connectionStatus === "connecting"
                  ? "bg-[#f59e0b]"
                  : "bg-[#ef4444]"
              }`}
            />
            <span>{connectionLabel}</span>
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#111827]" />
          </div>
        </div>
      </div>
    </div>
  );
}
