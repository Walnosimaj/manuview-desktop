import React from "react";
import {
  Compass,
  CheckCircle2,
  ShieldCheck,
  Layers,
  FileText,
  MessageSquare,
  Sparkles,
  Zap,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

interface MobileToolsViewProps {
  onSelectService: (serviceId: string) => void;
}

export function MobileToolsView({ onSelectService }: MobileToolsViewProps) {
  const toolGroups = [
    {
      groupTitle: "Pre-Submission Diagnostics",
      items: [
        {
          id: "laya-scan",
          name: "Laya Fast Scan",
          description: "Instant on-device 27-question atomic triage (0 tokens)",
          icon: Zap,
          bgColor: "bg-amber-500",
        },
        {
          id: "ai-review",
          name: "5-Persona AI Peer Review",
          description: "Methodologist, Statistician, Domain & Editor simulation",
          icon: Sparkles,
          bgColor: "bg-blue-600",
        },
        {
          id: "journal-fit",
          name: "Journal Scope & Tier Matcher",
          description: "Benchmarked against 48,000+ indexed scholarly journals",
          icon: Compass,
          bgColor: "bg-emerald-600",
        },
      ],
    },
    {
      groupTitle: "Citation & Integrity Audit",
      items: [
        {
          id: "reference-checker",
          name: "DOI & Retraction Watch Audit",
          description: "Live Crossref resolution & 50,000+ retraction database",
          icon: CheckCircle2,
          bgColor: "bg-teal-600",
        },
        {
          id: "citation-claim",
          name: "Claim Grounding Verifier",
          description: "Verify cited evidence against empirical statements",
          icon: ShieldCheck,
          bgColor: "bg-cyan-600",
        },
        {
          id: "reporting-checklist",
          name: "Reporting Guidelines Auditor",
          description: "Audit against CONSORT 2010, ARRIVE 2.0 & PRISMA",
          icon: ClipboardList,
          bgColor: "bg-orange-500",
        },
      ],
    },
    {
      groupTitle: "Manuscript Submission Utilities",
      items: [
        {
          id: "prisma",
          name: "PRISMA 2020 Flow Diagram",
          description: "Interactive systematic review flowchart generator",
          icon: Layers,
          bgColor: "bg-purple-600",
        },
        {
          id: "cover-letter",
          name: "Journal Cover Letter Drafter",
          description: "Tailored editorial submission letter highlighting novelty",
          icon: FileText,
          bgColor: "bg-indigo-600",
        },
        {
          id: "response-builder",
          name: "Reviewer Rebuttal Matrix",
          description: "Point-by-point author revision response letter builder",
          icon: MessageSquare,
          bgColor: "bg-rose-600",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      {toolGroups.map((group) => (
        <div key={group.groupTitle} className="space-y-2">
          <h4 className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 px-1 uppercase tracking-wider">
            {group.groupTitle}
          </h4>

          <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xs divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
            {group.items.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => onSelectService(tool.id)}
                  className="w-full flex items-center justify-between p-3.5 text-left active:bg-neutral-50 dark:active:bg-[#2C2C2E] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`w-9 h-9 rounded-xl ${tool.bgColor} flex items-center justify-center text-white shadow-xs shrink-0`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-semibold text-[14px] text-neutral-900 dark:text-white truncate">
                        {tool.name}
                      </h5>
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
