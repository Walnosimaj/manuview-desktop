import React, { useState } from "react";
import {
  FileText,
  Users,
  CheckCircle2,
  BookOpen,
  Plus,
  BarChart3,
  AlertCircle,
  Trash2,
  Clock,
  Check,
  X,
  Square,
  Loader2,
  AlertTriangle,
  FileQuestion,
  ChevronDown,
} from "lucide-react";
import type { PaperItem, DesktopActiveView } from "@/components/DesktopSidebar";
import {
  type GroupedPapers,
  getPaperApiLabel,
  getApiBadgeStyle,
  getSidebarIconBgClass,
  getSidebarScoreBadgeStyle,
} from "./sidebarUtils";
import { classifyDocument } from "@/lib/parser";
import { ApiProviderIcon } from "@/components/BrandLogos";

interface SidebarPaperListProps {
  papers: PaperItem[];
  groupedPapers: GroupedPapers[];
  activePaperId: string | null;
  activeView: DesktopActiveView;
  selectedPaperIds: Set<string>;
  isScanning?: boolean;
  onToggleSelectPaper: (paperId: string) => void;
  onClearSelection: () => void;
  onSelectPaper: (id: string) => void;
  onSelectView: (view: DesktopActiveView) => void;
  onNewReview: () => void;
  onDeleteMultiplePapers?: (papers: PaperItem[]) => void;
}

export function SidebarPaperList({
  papers,
  groupedPapers,
  activePaperId,
  activeView,
  selectedPaperIds,
  isScanning = false,
  onToggleSelectPaper,
  onClearSelection,
  onSelectPaper,
  onSelectView,
  onNewReview,
  onDeleteMultiplePapers,
}: SidebarPaperListProps) {
  const [isArticlesExpanded, setIsArticlesExpanded] = useState(true);

  return (
    <div>
      <div className="flex items-center justify-between px-2 mb-1.5">
        <button
          type="button"
          onClick={() => setIsArticlesExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#9CA3AF] dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 uppercase tracking-wider transition cursor-pointer select-none group"
          title={isArticlesExpanded ? "Collapse articles list" : "Expand articles list"}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isArticlesExpanded ? "" : "-rotate-90"
            }`}
          />
          <span>ARTICLES</span>
          <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 normal-case">
            ({papers.length})
          </span>
        </button>
        <div className="flex items-center gap-1">
          {/* Trash can icon button in place of text "Select" */}
          {papers.length > 0 && (
            <button
              type="button"
              disabled={selectedPaperIds.size === 0}
              onClick={() => {
                if (selectedPaperIds.size > 0) {
                  const targets = papers.filter((p) => selectedPaperIds.has(p.id));
                  if (onDeleteMultiplePapers) {
                    onDeleteMultiplePapers(targets);
                  }
                }
              }}
              title={
                selectedPaperIds.size > 0
                  ? `Delete ${selectedPaperIds.size} selected article${selectedPaperIds.size > 1 ? "s" : ""}`
                  : "Hover over file icon to select and delete"
              }
              className={`p-1 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                selectedPaperIds.size > 0
                  ? "text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 bg-rose-500/10 cursor-pointer active:scale-95 animate-in fade-in"
                  : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 opacity-40 hover:opacity-75 cursor-default"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {selectedPaperIds.size > 0 && (
                <span className="text-[10px] font-bold leading-none">
                  {selectedPaperIds.size}
                </span>
              )}
            </button>
          )}
          {selectedPaperIds.size > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              title="Clear selection"
              className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isArticlesExpanded && (
        <div className="space-y-1">
          {papers.length === 0 ? (
            <div className="px-3 py-4 text-center rounded-xl bg-white dark:bg-[#111827] border border-dashed border-[#E5E7EB] dark:border-[#1F2937]">
              <FileText className="w-5 h-5 mx-auto text-neutral-300 dark:text-neutral-600 mb-1.5" />
              <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">No manuscripts yet</p>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Run a review to track your paper</p>
              <button
                type="button"
                disabled={isScanning}
                onClick={onNewReview}
                title={isScanning ? "A manuscript review is currently running in the background" : "Start Review"}
                className={`mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                  isScanning
                    ? "opacity-50 cursor-not-allowed bg-neutral-200 dark:bg-neutral-800 text-neutral-400"
                    : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>{isScanning ? "Reviewing..." : "Start Review"}</span>
              </button>
            </div>
          ) : (
            groupedPapers.map(({ category, papers: groupPapers }) => (
              <div key={category} className="space-y-1 mb-3 last:mb-0">
                <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5 text-[10px] font-semibold text-[#9CA3AF] dark:text-neutral-400 tracking-wider uppercase">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
                    <span>{category}</span>
                  </div>
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-neutral-500 dark:text-neutral-400">
                    {groupPapers.length}
                  </span>
                </div>

                {groupPapers.map((paper) => {
                  const isSelected = paper.id === activePaperId;
                  const isSelectedInBatch = selectedPaperIds.has(paper.id);
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
                  const isAlreadyPublished =
                    paper.ineligibilityReason === "already_published" ||
                    paper.isPublished === true ||
                    paper.publishedDetails?.isPublished === true;

                  const isNonAcademic =
                    !isAlreadyPublished &&
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
                    !isAlreadyPublished &&
                    (paper.editorialTriage?.outcome === "desk_reject" ||
                      paper.ineligibilityReason === "scope_mismatch" ||
                      paper.targetJournalEvaluation?.isDisciplinaryMismatch === true ||
                      paper.isDeskReject === true);

                  const apiLabel = getPaperApiLabel(paper);

                  return (
                    <div key={paper.id} className="space-y-0.5 group/article">
                      <div
                        onClick={() => {
                          if (selectedPaperIds.size > 0) {
                            onToggleSelectPaper(paper.id);
                          } else {
                            if (!isSelected) {
                              onSelectPaper(paper.id);
                            }
                            onSelectView("overview");
                          }
                        }}
                        className={`group/item w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-xs text-left transition cursor-pointer select-none ${
                          isSelected && activeView === "overview" && selectedPaperIds.size === 0
                            ? "liquid-glass-tab-active font-semibold text-[#111827] dark:text-white shadow-xs"
                            : isSelected && selectedPaperIds.size === 0
                            ? "liquid-glass-card font-medium text-[#111827] dark:text-white"
                            : isSelectedInBatch
                            ? "bg-blue-50/80 dark:bg-blue-950/30 font-medium text-blue-900 dark:text-blue-200"
                            : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1.5">
                        {/* Squircle container with icon OR hover checkbox */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelectPaper(paper.id);
                          }}
                          className={`relative w-6 h-6 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition shadow-2xs ${getSidebarIconBgClass(
                            paper,
                            isReviewing,
                            isFailed,
                            isDeskReject,
                            isNonAcademic
                          )} ${isSelected ? "ring-2 ring-blue-500/40" : ""}`}
                          title={isSelectedInBatch ? "Deselect article" : "Select article"}
                        >
                          {/* Checkbox visible when batch selected or hover */}
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                              isSelectedInBatch
                                ? "bg-blue-600 text-white opacity-100 scale-100"
                                : "border border-neutral-400 dark:border-neutral-500 hover:border-blue-500 bg-white dark:bg-[#1e293b] opacity-0 group-hover/article:opacity-100 scale-95 hover:scale-100"
                            }`}
                          >
                            {isSelectedInBatch ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              <Square className="w-3 h-3 opacity-40 text-neutral-400 hover:text-blue-600" />
                            )}
                          </div>

                          {/* Squircle Icon visible when NOT batch selected */}
                          {!isSelectedInBatch && (
                            <div className="absolute inset-0 flex items-center justify-center transition-opacity group-hover/article:opacity-0">
                              {isReviewing ? (
                                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                              ) : isFailed || isDeskReject ? (
                                <AlertCircle className="w-3.5 h-3.5 text-white" />
                              ) : isAlreadyPublished || (paper.isEligibleForReview === false && paper.ineligibilityReason === "already_published") ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              ) : paper.isEligibleForReview === false || isNonAcademic ? (
                                <FileQuestion className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-white" />
                              )}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            <span className="truncate">{paper.shortName}</span>
                          </div>
                          {isReviewing && (
                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-normal truncate mt-0.5">
                              {paper.scanStep || "Reviewing manuscript..."}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center shrink-0">
                        {isReviewing ? (
                          <span
                            title="Background review in progress"
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 flex items-center gap-1.5 shrink-0 shadow-2xs"
                          >
                            <Loader2 className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                            <span>Reviewing</span>
                          </span>
                        ) : isFailed ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                            Failed
                          </span>
                        ) : (
                          <span
                            title={`Reviewed with ${apiLabel}`}
                            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 opacity-75 group-hover/item:opacity-100 transition"
                          >
                            <ApiProviderIcon apiLabel={apiLabel} className="w-3.5 h-3.5 shrink-0" />
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedPaperIds.size === 0 && isSelected && isFailed && (
                      <div className="pl-4 pr-2 py-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 font-medium bg-rose-500/10 px-2 py-1.5 rounded-lg border border-rose-500/20">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span className="truncate">{paper.scanError?.title || "Review interrupted"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
      )}
    </div>
  );
}
