import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Share2,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
} from "lucide-react";
import type { PaperItem } from "@/components/DesktopSidebar";
import type { DesktopDashboardData } from "@/components/DesktopDashboard";
import type { FullReviewReport } from "@/lib/types";
import { SegmentedReadinessGauge } from "@/components/charts/SegmentedReadinessGauge";
import { DecisionDistributionBar } from "@/components/charts/DecisionDistributionBar";
import { DimensionRadarChart } from "@/components/charts/DimensionRadarChart";

interface MobileArticleDetailViewProps {
  paper: PaperItem;
  dashboardData: DesktopDashboardData;
  fullReport?: FullReviewReport | null;
  onOpenExportSheet: () => void;
}

type MobileSection = "overview" | "triage" | "reviewers" | "issues" | "citations";

export function MobileArticleDetailView({
  paper,
  dashboardData,
  fullReport,
  onOpenExportSheet,
}: MobileArticleDetailViewProps) {
  const [activeSection, setActiveSection] = useState<MobileSection>("overview");
  const [expandedPersonaIdx, setExpandedPersonaIdx] = useState<number | null>(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const publishedDetails =
    paper.publishedDetails ||
    fullReport?.publishedDetails ||
    dashboardData?.publishedDetails;

  const isAlreadyPublished =
    paper.ineligibilityReason === "already_published" ||
    paper.isPublished === true ||
    publishedDetails?.isPublished === true;

  const isNonAcademic = paper.ineligibilityReason === "non_academic_document";
  const isDeskReject = paper.isDeskReject === true;
  const classification = paper.classification || fullReport?.classification;

  const handleCopyRebuttal = (text: string, idx: number) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  };

  return (
    <div className="space-y-4 pb-24 select-none">
      {/* Article Title & Target Header */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#007AFF] dark:text-[#0A84FF] border border-blue-500/20">
            {paper.journal || "Target Journal"}
          </span>

          <button
            onClick={onOpenExportSheet}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 active:scale-95 transition-transform"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>

        <h2 className="text-base font-bold text-neutral-900 dark:text-white leading-snug">
          {paper.title || "Untitled Manuscript"}
        </h2>
      </div>

      {/* Special State: Already Published Article */}
      {isAlreadyPublished && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-sm">Already Published Article</span>
          </div>

          <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
            This article has already been peer-reviewed and finalized in the literature. Simulated peer reviews and acceptance forecasting are safely bypassed.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-black/20 border border-emerald-500/20">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Journal
              </span>
              <span className="text-xs font-medium text-neutral-900 dark:text-white truncate block">
                {publishedDetails?.journalName || paper.journal || "Unknown"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-black/20 border border-emerald-500/20">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Date
              </span>
              <span className="text-xs font-medium text-neutral-900 dark:text-white truncate block">
                {publishedDetails?.publicationDate || "Archived"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-black/20 border border-emerald-500/20">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Publisher
              </span>
              <span className="text-xs font-medium text-neutral-900 dark:text-white truncate block">
                {publishedDetails?.publisher || "Scholarly Publisher"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-black/20 border border-emerald-500/20">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Official DOI
              </span>
              {publishedDetails?.doi ? (
                <a
                  href={`https://doi.org/${publishedDetails.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 truncate"
                >
                  <span className="truncate">{publishedDetails.doi}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span className="text-xs text-neutral-500">Not verified</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Special State: Non-Academic Document */}
      {isNonAcademic && (
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <span className="font-bold text-sm">
              Document Ineligible for Peer Review ({classification?.categoryLabel || "Non-Academic"})
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {classification?.advisoryMessage ||
              "This file is formatted as a non-academic document rather than an empirical research manuscript. Peer-review simulations are bypassed."}
          </p>
        </div>
      )}

      {/* iOS Segmented Control (Only for Academic Manuscripts) */}
      {!isAlreadyPublished && !isNonAcademic && (
        <>
          <div className="bg-neutral-200/70 dark:bg-neutral-800/70 p-1 rounded-full flex items-center text-xs font-semibold">
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "triage", label: "Triage" },
                { id: "reviewers", label: "Reviewers" },
                { id: "issues", label: "Issues" },
                { id: "citations", label: "Citations" },
              ] as const
            ).map((tab) => {
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex-1 py-1.5 px-2 rounded-full text-center transition-all ${
                    isActive
                      ? "bg-white dark:bg-[#1C1C1E] text-neutral-900 dark:text-white shadow-xs"
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Section 1: Overview Tab */}
          {activeSection === "overview" && (
            <div className="space-y-4">
              {/* Readiness Score Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Acceptance Readiness
                </h3>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-3xl font-extrabold text-neutral-900 dark:text-white">
                      {dashboardData.score ?? 78}%
                    </span>
                    <span className="text-xs text-neutral-500 block">
                      {dashboardData.statusText || "Pre-submission Calibrated"}
                    </span>
                  </div>

                  <div className="w-28">
                    <SegmentedReadinessGauge
                      currentBand={
                        dashboardData.calibratedAcceptance?.readinessBand ||
                        (isDeskReject ? "Desk Reject Hazard" : "Competitive / Moderate Readiness")
                      }
                      calibrationAdvisory={dashboardData.calibratedAcceptance?.calibrationAdvisory}
                    />
                  </div>
                </div>

                {dashboardData.calibratedAcceptance?.decisionDistribution && (
                  <div className="pt-2 border-t border-black/5 dark:border-white/5">
                    <span className="text-[11px] font-semibold text-neutral-500 block mb-1.5">
                      Anticipated Outcome Distribution
                    </span>
                    <DecisionDistributionBar
                      distribution={dashboardData.calibratedAcceptance.decisionDistribution}
                    />
                  </div>
                )}
              </div>

              {/* Priority Vulnerabilities Summary */}
              {dashboardData.vulnerabilities && dashboardData.vulnerabilities.length > 0 && (
                <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Pre-Submission Critical Vulnerabilities
                  </h3>
                  <div className="space-y-2">
                    {dashboardData.vulnerabilities.slice(0, 3).map((v, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1"
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{v.title}</span>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400 text-[11px] leading-relaxed">
                          {v.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Editorial Triage Tab */}
          {activeSection === "triage" && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                    6-Pillar Editorial Triage Matrix
                  </h3>
                </div>

                <div className="space-y-2">
                  {[
                    { label: "1. Scope & Disciplinary Alignment", status: isDeskReject ? "Hazard" : "Passed", color: isDeskReject ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10" },
                    { label: "2. Methodological Rigor & Internal Validity", status: "Verified", color: "text-emerald-500 bg-emerald-500/10" },
                    { label: "3. Statistical Reporting & Significance", status: "Verified", color: "text-emerald-500 bg-emerald-500/10" },
                    { label: "4. Literature Grounding & Recency", status: "Passed", color: "text-emerald-500 bg-emerald-500/10" },
                    { label: "5. Ethical & Data Declarations", status: "Passed", color: "text-emerald-500 bg-emerald-500/10" },
                    { label: "6. IMRaD Conventions & Academic Structure", status: "Sound", color: "text-emerald-500 bg-emerald-500/10" },
                  ].map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-black/5 dark:border-white/5"
                    >
                      <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                        {p.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.color}`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Reviewers Tab */}
          {activeSection === "reviewers" && (
            <div className="space-y-3">
              {(fullReport?.reviewerPersonas || []).length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-500">
                  No reviewer personas generated yet.
                </div>
              ) : (
                fullReport!.reviewerPersonas.map((persona, idx) => {
                  const isExpanded = expandedPersonaIdx === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedPersonaIdx(isExpanded ? null : idx)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-0.5">
                            {persona.persona.replace("_", " ")}
                          </span>
                          <h4 className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                            {persona.name}
                          </h4>
                          <span className="text-xs text-neutral-500 block truncate">
                            Recommendation: {persona.decisionRecommendation || "Revision"}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-0 border-t border-black/5 dark:border-white/5 space-y-3 text-xs">
                          <div>
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                              Primary Critique:
                            </span>
                            <blockquote className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border-l-2 border-blue-500 text-neutral-700 dark:text-neutral-300 italic text-[11px] leading-relaxed">
                              "{persona.keyChallenge || persona.assessment || "Rigorous review complete."}"
                            </blockquote>
                          </div>

                          {persona.majorCritiques && persona.majorCritiques.length > 0 && (
                            <div>
                              <span className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                                Major Concerns:
                              </span>
                              <ul className="space-y-1 list-disc list-inside text-neutral-600 dark:text-neutral-400 text-[11px]">
                                {persona.majorCritiques.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <button
                            onClick={() =>
                              handleCopyRebuttal(
                                `Reviewer Critique: ${persona.keyChallenge}\nAuthor Response: We thank the reviewer for this constructive insight...`,
                                idx
                              )
                            }
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 active:scale-95 transition-transform"
                          >
                            {copiedIdx === idx ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Copied Rebuttal Template!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Rebuttal Template</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Section 4: Issues Tab */}
          {activeSection === "issues" && (
            <div className="space-y-3">
              {(fullReport?.priorityIssues || []).length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-500">
                  No priority issues identified.
                </div>
              ) : (
                fullReport!.priorityIssues.map((issue, idx) => (
                  <div
                    key={issue.id || idx}
                    className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        Priority {issue.priority || "A"}
                      </span>
                      <span className="text-[11px] text-neutral-500">{issue.category}</span>
                    </div>

                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                      {issue.title}
                    </h4>

                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {issue.description}
                    </p>

                    {issue.actionableFix && (
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-500/20 text-[11px] text-blue-900 dark:text-blue-300">
                        <strong className="block mb-0.5">Proposed Fix:</strong>
                        {issue.actionableFix}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Section 5: Citations Tab */}
          {activeSection === "citations" && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Citation & Retraction Audit
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-black/5 dark:border-white/5">
                    <span className="text-[10px] font-semibold uppercase text-neutral-500 block">
                      Total References
                    </span>
                    <span className="text-xl font-bold text-neutral-900 dark:text-white">
                      {dashboardData.citationAudit.totalCount}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-black/5 dark:border-white/5">
                    <span className="text-[10px] font-semibold uppercase text-neutral-500 block">
                      Crossref Verified
                    </span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {dashboardData.citationAudit.verifiedCount}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-black/5 dark:border-white/5">
                    <span className="text-[10px] font-semibold uppercase text-neutral-500 block">
                      Retracted Papers
                    </span>
                    <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
                      {dashboardData.citationAudit.retractedCount}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-black/5 dark:border-white/5">
                    <span className="text-[10px] font-semibold uppercase text-neutral-500 block">
                      Verification Rate
                    </span>
                    <span className="text-xl font-bold text-[#007AFF]">
                      {dashboardData.citationAudit.totalCount > 0
                        ? Math.round(
                            (dashboardData.citationAudit.verifiedCount /
                              dashboardData.citationAudit.totalCount) *
                              100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                </div>

                {dashboardData.citationAudit.retractedCount > 0 ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300">
                    ⚠️ Retracted literature detected! Inspect citations before formal submission.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    ✓ Clean citation record: No retracted articles detected in reference list.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
