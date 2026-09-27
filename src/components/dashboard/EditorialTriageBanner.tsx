import React from "react";
import {
  ShieldAlert,
  ChevronRight,
  BookOpen,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RotateCcw,
  BarChart3,
  Users,
  ShieldCheck,
  CheckSquare,
  ExternalLink,
} from "lucide-react";
import type { EditorialTriageOutcome, CitationIntegritySummary } from "@/lib/types";
import { DashboardGlassIllustration } from "./DashboardGlassIllustration";

interface EditorialTriageBannerProps {
  isDeskReject: boolean;
  isAlreadyPublished: boolean;
  isNonAcademic: boolean;
  editorialTriage?: EditorialTriageOutcome;
  publishedDetails?: any;
  classification?: any;
  targetJournal?: string;
  detectedDiscipline?: string;
  targetJournalEvaluation?: any;
  overallScore?: number;
  citationIntegrity?: CitationIntegritySummary;
  reviewerCount?: number;
  journalCount?: number;
  onSelectView: (view: any) => void;
  onNewScan?: () => void;
  handlePrint: (e?: React.MouseEvent) => void;
}

export const EditorialTriageBanner: React.FC<EditorialTriageBannerProps> = ({
  isDeskReject,
  isAlreadyPublished,
  isNonAcademic,
  editorialTriage,
  publishedDetails,
  classification,
  targetJournal = "Target Journal",
  detectedDiscipline = "Target Domain",
  targetJournalEvaluation,
  overallScore,
  citationIntegrity,
  reviewerCount,
  journalCount,
  onSelectView,
  onNewScan,
  handlePrint,
}) => {
  const isExplicitlySentForReview =
    editorialTriage?.outcome === "sent_for_review" ||
    Boolean(editorialTriage?.summary?.includes("Cleared editorial triage"));

  const isEffectiveDeskReject =
    !isExplicitlySentForReview &&
    (isDeskReject || Boolean(targetJournalEvaluation?.isDisciplinaryMismatch));

  if (isAlreadyPublished) {
    const journalName = publishedDetails?.journalName || publishedDetails?.journal || targetJournal;
    const doi = publishedDetails?.doi;
    const publisher = publishedDetails?.publisher;
    const pubDate = publishedDetails?.publicationDate;

    return (
      <div className="p-5 sm:p-6 rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/90 via-white/80 to-emerald-50/50 dark:from-emerald-950/40 dark:via-[#161F30] dark:to-emerald-950/20 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 dark:border-emerald-900/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2 flex-wrap">
                <span>Already Published Article Detected</span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300/60 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Verified Scholarly Record
                </span>
              </h3>
              <p className="text-xs text-emerald-800/90 dark:text-emerald-400">
                Established record in scholarly literature &bull; Pre-submission peer-review simulation safely bypassed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              Published Article (N/A)
            </span>
            {onNewScan && (
              <button
                type="button"
                onClick={onNewScan}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Manuscript</span>
              </button>
            )}
          </div>
        </div>

        {/* 4-Box Publication Metadata Grid */}
        {(journalName || pubDate || publisher || doi) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
            {journalName && (
              <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Published Journal</span>
                <span className="font-semibold text-emerald-950 dark:text-emerald-200 truncate block mt-0.5" title={journalName}>
                  {journalName}
                </span>
              </div>
            )}
            {pubDate && (
              <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Publication Date</span>
                <span className="font-semibold text-emerald-950 dark:text-emerald-200 block mt-0.5">
                  {pubDate}
                </span>
              </div>
            )}
            {publisher && (
              <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Publisher</span>
                <span className="font-semibold text-emerald-950 dark:text-emerald-200 truncate block mt-0.5" title={publisher}>
                  {publisher}
                </span>
              </div>
            )}
            {doi && (
              <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">Official Article DOI</span>
                <a
                  href={`https://doi.org/${doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 hover:underline inline-flex items-center gap-1 truncate block mt-0.5"
                >
                  <span className="truncate">{doi}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-white/80 border border-emerald-200/60 dark:bg-[#111827] dark:border-emerald-800/40 text-xs text-neutral-700 dark:text-neutral-300">
          <span className="font-bold text-emerald-950 dark:text-emerald-200 block mb-1">Status Note:</span>
          <p className="leading-relaxed">
            {publishedDetails?.advisoryMessage ||
              `This manuscript has already appeared in published literature${
                journalName ? ` in "${journalName}"` : ""
              }${
                doi ? ` (DOI: ${doi})` : ""
              }. Standard pre-submission peer-review simulation, acceptance forecasting, and simulated referee personas are bypassed for finalized publications.`}
          </p>
        </div>
      </div>
    );
  }

  if (isNonAcademic) {
    return (
      <div className="p-5 sm:p-6 rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-50/90 via-white/80 to-amber-50/50 dark:from-amber-950/40 dark:via-[#161F30] dark:to-amber-950/20 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/60 dark:border-amber-900/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-amber-950 dark:text-amber-200 block">
                Document Ineligible for Peer-Review Evaluation
              </span>
              <span className="text-[11px] text-amber-800 dark:text-amber-400">
                Classified as {classification?.categoryLabel || "Non-Academic Document"} • Pre-Submission Simulation Bypassed
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              Review Bypassed (N/A)
            </span>
            {onNewScan && (
              <button
                type="button"
                onClick={onNewScan}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Manuscript</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-amber-900/90 dark:text-amber-300/90 leading-relaxed pt-2 border-t border-amber-200/70 dark:border-amber-800/60">
          {classification?.advisoryMessage ||
            "This document does not contain empirical scientific research, IMRaD sections, or scholarly bibliography citations. Acceptance scoring and persona simulations have been safely skipped."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* PUREMAC-STYLE DARK HERO CARD */}
      <div
        className={`relative rounded-[28px] text-white shadow-2xl p-6 sm:p-8 overflow-hidden border transition-all ${
          isEffectiveDeskReject
            ? "bg-[#0B0F17] border-rose-500/30"
            : "bg-[#0B0F17] border-white/10"
        }`}
      >
        {/* Ambient atmospheric glows */}
        <div
          className={`absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
            isEffectiveDeskReject ? "bg-rose-600/15" : "bg-blue-600/15"
          }`}
        />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left Column: Metrics & Actions */}
          <div className="space-y-4 max-w-xl">
            {/* Status Tag */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm ${
                isEffectiveDeskReject
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "bg-white/10 text-white/90 border border-white/15"
              }`}
            >
              {isEffectiveDeskReject ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>EDITORIAL TRIAGE: DESK REJECT HAZARD</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SCAN COMPLETE</span>
                </>
              )}
            </div>

            {/* Main Metric Heading */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                {isEffectiveDeskReject ? "Editorial Screening Barrier" : "Ready to submit"}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl sm:text-6xl font-black tracking-tight text-white">
                  {isEffectiveDeskReject
                    ? "Desk Reject"
                    : overallScore !== undefined
                    ? `${overallScore}%`
                    : "Ready"}
                </span>
              </div>
            </div>

            {/* Sub-stat description */}
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-md">
              {isEffectiveDeskReject
                ? `Disciplinary remit mismatch with "${targetJournal}". Out-of-scope manuscripts are declined at editorial triage before peer review.`
                : `Target journal aims and scope aligned with "${targetJournal}". Cleared triage across 6 diagnostic pillars and multi-referee adversarial panel.`}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {isEffectiveDeskReject ? (
                <>
                  <button
                    type="button"
                    onClick={() => onSelectView("journals")}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-md"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>View In-Scope Journals</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectView("personas")}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition cursor-pointer flex items-center gap-2 backdrop-blur-sm"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>Triage Rationale</span>
                  </button>
                </>
              ) : (
                <>
                  {onNewScan && (
                    <button
                      type="button"
                      onClick={onNewScan}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition cursor-pointer flex items-center gap-2 backdrop-blur-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Scan Again</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-md"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Column: 3D Layered Glass Stack Graphic */}
          <div className="shrink-0 flex items-center justify-center md:pr-4">
            <DashboardGlassIllustration isDeskReject={isEffectiveDeskReject} />
          </div>
        </div>
      </div>

      {/* "REVIEW WHAT WAS FOUND" SECTION (Matching PureMac card grid) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">
            Review what was found
          </h2>
          <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
            Detailed breakdown across peer review scoring dimensions, triage, reviewer panel, and journal fit
          </p>
        </div>

        {/* 5-Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: 6 Scoring Dimensions */}
          <div className="rounded-2xl p-5 border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-[#0F172A] dark:text-white">
                  6 Scoring Dimensions
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-2xl font-black tracking-tight text-[#0F172A] dark:text-white">
                {isEffectiveDeskReject ? "Suppressed" : overallScore !== undefined ? `${overallScore} / 100` : "Audit Pass"}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isEffectiveDeskReject ? "Bypassed by desk reject" : "6 of 6 dimensions evaluated"}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-amber-200/40 dark:border-amber-900/30">
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                Methodology &amp; Novelty
              </span>
              <button
                type="button"
                onClick={() => onSelectView("dimensions")}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-black/10 dark:border-white/10 shadow-2xs transition cursor-pointer"
              >
                Review
              </button>
            </div>
          </div>

          {/* Card 2: Editorial Triage */}
          <div
            className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between space-y-4 ${
              isEffectiveDeskReject
                ? "border-rose-200/60 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20"
                : "border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare
                  className={`w-4 h-4 shrink-0 ${
                    isEffectiveDeskReject ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                />
                <span className="text-xs font-bold text-[#0F172A] dark:text-white">
                  Editorial Triage
                </span>
              </div>
              <div
                className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shadow-xs shrink-0 ${
                  isEffectiveDeskReject ? "bg-rose-500" : "bg-emerald-500"
                }`}
              >
                {isEffectiveDeskReject ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </div>
            </div>

            <div className="space-y-0.5">
              <div
                className={`text-2xl font-black tracking-tight ${
                  isEffectiveDeskReject ? "text-rose-600 dark:text-rose-400" : "text-[#0F172A] dark:text-white"
                }`}
              >
                {isEffectiveDeskReject ? "Desk Reject" : "Cleared"}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {isEffectiveDeskReject ? "Scope mismatch with target" : `Matched "${targetJournal}"`}
              </p>
            </div>

            <div
              className={`flex items-center justify-between pt-1 border-t ${
                isEffectiveDeskReject
                  ? "border-rose-200/40 dark:border-rose-900/30"
                  : "border-emerald-200/40 dark:border-emerald-900/30"
              }`}
            >
              <span
                className={`text-[11px] font-semibold ${
                  isEffectiveDeskReject ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                Preliminary screening
              </span>
              <button
                type="button"
                onClick={() => onSelectView("personas")}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-black/10 dark:border-white/10 shadow-2xs transition cursor-pointer"
              >
                Review
              </button>
            </div>
          </div>

          {/* Card 3: Adversarial Reviewers */}
          <div className="rounded-2xl p-5 border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="text-xs font-bold text-[#0F172A] dark:text-white">
                  Adversarial Panel
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-2xl font-black tracking-tight text-[#0F172A] dark:text-white">
                {reviewerCount ? `${reviewerCount} Personas` : "3 Personas"}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Editor, Methodologist, Domain Expert
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-purple-200/40 dark:border-purple-900/30">
              <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400">
                Simulated peer review
              </span>
              <button
                type="button"
                onClick={() => onSelectView("personas")}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-black/10 dark:border-white/10 shadow-2xs transition cursor-pointer"
              >
                Review
              </button>
            </div>
          </div>

          {/* Card 4: Reference & Citation Integrity */}
          <div className="rounded-2xl p-5 border border-teal-200/60 dark:border-teal-900/40 bg-teal-50/50 dark:bg-teal-950/20 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="text-xs font-bold text-[#0F172A] dark:text-white">
                  Reference Integrity
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-2xl font-black tracking-tight text-[#0F172A] dark:text-white">
                {citationIntegrity && citationIntegrity.totalReferences > 0
                  ? `${citationIntegrity.totalReferences} Checked`
                  : "52 Checked"}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {citationIntegrity
                  ? `${citationIntegrity.retractedCount ?? 0} Retractions detected • ${
                      citationIntegrity.totalReferences > 0
                        ? Math.round((citationIntegrity.verifiedCount / citationIntegrity.totalReferences) * 100)
                        : 94
                    }% verified`
                  : "0 Retractions detected • 94% verified"}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-teal-200/40 dark:border-teal-900/30">
              <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                Crossref &amp; Retraction Watch
              </span>
              <button
                type="button"
                onClick={() => onSelectView("citations")}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-black/10 dark:border-white/10 shadow-2xs transition cursor-pointer"
              >
                Review
              </button>
            </div>
          </div>

          {/* Card 5: Target Journal Fit */}
          <div className="rounded-2xl p-5 border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-[#0F172A] dark:text-white">
                  Journal Fit Recommendations
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-2xl font-black tracking-tight text-[#0F172A] dark:text-white">
                {journalCount ? `${journalCount} Venues` : "13 Venues"}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Reach, Realistic, Fallback tiers
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-blue-200/40 dark:border-blue-900/30">
              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                48,000+ catalog grounded
              </span>
              <button
                type="button"
                onClick={() => onSelectView("journals")}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-black/10 dark:border-white/10 shadow-2xs transition cursor-pointer"
              >
                Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
