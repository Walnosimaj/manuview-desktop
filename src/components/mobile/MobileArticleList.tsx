import React, { useState, useMemo } from "react";
import { Search, ChevronRight, FileText, CheckCircle2, AlertTriangle, Trash2, Zap, BookOpen } from "lucide-react";
import type { PaperItem } from "@/components/DesktopSidebar";
import { getTimeCategory } from "@/components/sidebar/sidebarUtils";

interface MobileArticleListProps {
  papers: PaperItem[];
  activePaperId: string | null;
  onSelectPaper: (id: string) => void;
  onDeletePaper?: (paper: PaperItem) => void;
  onOpenFastScan: () => void;
}

export function MobileArticleList({
  papers,
  activePaperId,
  onSelectPaper,
  onDeletePaper,
  onOpenFastScan,
}: MobileArticleListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return papers;
    const q = searchQuery.toLowerCase();
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.journal.toLowerCase().includes(q) ||
        p.shortName?.toLowerCase().includes(q)
    );
  }, [papers, searchQuery]);

  // Group papers by time bucket
  const grouped = useMemo(() => {
    const buckets: Record<string, PaperItem[]> = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: [],
    };

    filteredPapers.forEach((paper) => {
      const category = getTimeCategory(paper.createdAt || (paper as any).timestamp);
      if (category === "Today") buckets["Today"].push(paper);
      else if (category === "Yesterday") buckets["Yesterday"].push(paper);
      else if (category === "Previous 7 Days") buckets["Previous 7 Days"].push(paper);
      else buckets["Older"].push(paper);
    });

    return Object.entries(buckets).filter(([_, items]) => items.length > 0);
  }, [filteredPapers]);

  return (
    <div className="flex flex-col space-y-4 pb-20">
      {/* iOS Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-200/70 dark:bg-neutral-800/70 rounded-xl text-neutral-600 dark:text-neutral-400">
          <Search className="w-4 h-4 shrink-0 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search manuscripts or journals..."
            className="w-full bg-transparent text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-hidden text-neutral-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-300 dark:bg-neutral-700 rounded-full w-4 h-4 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {papers.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-[#007AFF] flex items-center justify-center mx-auto shadow-xs">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">No Manuscripts Yet</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto mt-1">
              Upload a research draft or run an instant on-device Laya scan to get pre-submission triage and peer reviews.
            </p>
          </div>
          <button
            onClick={onOpenFastScan}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#007AFF] text-white text-xs font-semibold shadow-xs active:scale-95 transition-transform"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Start Free Fast Scan</span>
          </button>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="text-center py-8 text-xs text-neutral-500">
          No manuscripts match "{searchQuery}".
        </div>
      ) : (
        /* Inset Grouped Paper Cards */
        grouped.map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h4 className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 px-1 uppercase tracking-wider">
              {category}
            </h4>

            <div className="space-y-2">
              {items.map((paper) => {
                const isSelected = activePaperId === paper.id;
                const isPublished =
                  paper.ineligibilityReason === "already_published" ||
                  paper.isPublished === true ||
                  paper.publishedDetails?.isPublished === true;
                const isDeskReject = paper.isDeskReject === true;
                const isNonAcademic = paper.ineligibilityReason === "non_academic_document";
                const isReviewing = paper.status === "reviewing";

                return (
                  <div
                    key={paper.id}
                    onClick={() => onSelectPaper(paper.id)}
                    className={`relative flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border transition-all active:scale-[0.99] select-none cursor-pointer ${
                      isSelected
                        ? "border-[#007AFF] ring-2 ring-[#007AFF]/20 shadow-xs"
                        : "border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 shadow-2xs"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 truncate max-w-[160px]">
                          {paper.journal || "General Venue"}
                        </span>

                        {/* Status Badge */}
                        {isReviewing ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white animate-pulse">
                            Reviewing...
                          </span>
                        ) : isPublished ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                            Published
                          </span>
                        ) : isDeskReject ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                            Desk Reject
                          </span>
                        ) : isNonAcademic ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25">
                            Ineligible
                          </span>
                        ) : paper.score != null ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              paper.score >= 75
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                            }`}
                          >
                            {paper.score}%
                          </span>
                        ) : null}
                      </div>

                      <h3 className="font-semibold text-[14px] text-neutral-900 dark:text-white line-clamp-2 leading-snug">
                        {paper.title || "Untitled Manuscript"}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 text-neutral-400">
                      {onDeletePaper && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePaper(paper);
                          }}
                          className="p-1.5 text-neutral-400 hover:text-rose-500 dark:hover:text-rose-400 active:scale-90 transition-transform"
                          aria-label="Delete Manuscript"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
