"use client";

import React from "react";
import { Sparkles, Settings, ArrowLeft, Cpu, ShieldAlert, Zap, Globe, CheckCircle2 } from "lucide-react";

interface GenerativeModelRequiredViewProps {
  serviceName: string;
  onOpenSettings: () => void;
  onBack?: () => void;
}

export function GenerativeModelRequiredView({
  serviceName,
  onOpenSettings,
  onBack,
}: GenerativeModelRequiredViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 text-[#1E293B] dark:text-[#E2E8F0]">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-8">
        {/* Main Advisory Card */}
        <div className="rounded-3xl liquid-glass-card p-8 sm:p-10 border border-black/[0.08] dark:border-white/[0.1] shadow-md text-center space-y-6">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
            <Cpu className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Laya System 1 v3 Active (Diagnostic Engine)</span>
          </div>

          {/* Icon with glowing ring */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-blue-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-xs">
            <Sparkles className="w-8 h-8" />
          </div>

          {/* Title & Copy */}
          <div className="space-y-2 max-w-xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight">
              Generative AI Model Required
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">
              The currently selected model is <strong className="text-neutral-800 dark:text-neutral-200">Laya System 1 v3</strong>, which is an on-device calibrated diagnostic neural classifier designed for fast pre-submission screening and retraction checking.
            </p>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">
              <strong>{serviceName}</strong> requires an interactive generative language model (such as Google Gemini, OpenAI, Anthropic, or local Ollama) to synthesize natural language text and document drafts.
            </p>
          </div>

          {/* Comparison Cards: Fast Diagnostic vs Generative */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left text-xs">
            <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-white">
                <Cpu className="w-4 h-4 text-blue-500" />
                <span>Laya System 1 (Active)</span>
              </div>
              <ul className="space-y-1.5 text-neutral-600 dark:text-neutral-400 text-[11px]">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>On-device 100% private neural battery</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>61,000+ Retraction Shield verification</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>~15s calibrated acceptance probability</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/40 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-300">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Generative AI (Required)</span>
              </div>
              <ul className="space-y-1.5 text-neutral-600 dark:text-neutral-400 text-[11px]">
                <li className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Free-form prose &amp; cover letter drafting</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Reviewer rebuttal matrix synthesis</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Citation claim alignment verification</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Change to Generative Model in Settings</span>
            </button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl liquid-glass-btn-secondary text-neutral-700 dark:text-neutral-300 text-xs font-semibold shadow-xs cursor-pointer transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Overview</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
