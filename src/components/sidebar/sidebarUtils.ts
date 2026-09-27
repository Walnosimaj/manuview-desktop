import {
  Compass,
  CheckCircle2,
  ShieldCheck,
  Layers,
  FileText,
  MessageSquare,
  Gauge,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { PaperItem, DesktopActiveView } from "@/components/DesktopSidebar";

export type TimeCategory =
  | "Today"
  | "Yesterday"
  | "Previous 7 Days"
  | "Previous 30 Days"
  | "Older";

export interface GroupedPapers {
  category: TimeCategory;
  papers: PaperItem[];
}

export interface SidebarServiceItem {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  squircleBg?: string;
  action: () => void;
}

/**
 * Categorizes an ISO date string or timestamp into human time buckets:
 * "Today" | "Yesterday" | "Previous 7 Days" | "Previous 30 Days" | "Older"
 */
export function getTimeCategory(dateInput?: string | number | Date, paperId?: string): TimeCategory {
  let date: Date | null = null;
  if (dateInput) {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      date = d;
    }
  }
  if (!date && paperId) {
    // Try to extract 13-digit millisecond timestamp from id suffix (e.g. paper-1726300000000)
    const match = paperId.match(/(\d{13})/);
    if (match) {
      const ts = parseInt(match[1], 10);
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        date = d;
      }
    }
  }
  if (!date) return "Today";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const sevenDaysAgoStart = todayStart - 6 * 86400000;
  const thirtyDaysAgoStart = todayStart - 29 * 86400000;

  const itemTime = date.getTime();

  if (itemTime >= todayStart) {
    return "Today";
  } else if (itemTime >= yesterdayStart) {
    return "Yesterday";
  } else if (itemTime >= sevenDaysAgoStart) {
    return "Previous 7 Days";
  } else if (itemTime >= thirtyDaysAgoStart) {
    return "Previous 30 Days";
  } else {
    return "Older";
  }
}

/**
 * Groups a list of PaperItems by their review/creation time in chronological bucket order.
 * Within each category, papers are sorted newest first.
 */
export function groupPapersByTime(papers: PaperItem[]): GroupedPapers[] {
  const categoriesOrder: TimeCategory[] = [
    "Today",
    "Yesterday",
    "Previous 7 Days",
    "Previous 30 Days",
    "Older",
  ];

  const map = new Map<TimeCategory, PaperItem[]>();
  for (const cat of categoriesOrder) {
    map.set(cat, []);
  }

  for (const paper of papers) {
    const cat = getTimeCategory(paper.createdAt || paper.updatedAt, paper.id);
    map.get(cat)!.push(paper);
  }

  const result: GroupedPapers[] = [];
  for (const cat of categoriesOrder) {
    const list = map.get(cat)!;
    if (list.length > 0) {
      list.sort((a, b) => {
        let timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        if (isNaN(timeA) || timeA === 0) {
          const matchA = a.id?.match(/(\d{13})/);
          if (matchA) timeA = parseInt(matchA[1], 10);
        }
        let timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        if (isNaN(timeB) || timeB === 0) {
          const matchB = b.id?.match(/(\d{13})/);
          if (matchB) timeB = parseInt(matchB[1], 10);
        }
        return (timeB || 0) - (timeA || 0);
      });
      result.push({ category: cat, papers: list });
    }
  }

  return result;
}

export function buildSidebarServices(params: {
  onSelectService?: (serviceId: string) => void;
  onSelectView: (view: DesktopActiveView) => void;
  onNewReview: () => void;
}): SidebarServiceItem[] {
  const { onSelectService, onSelectView, onNewReview } = params;

  return [
    {
      id: "laya-scan",
      name: "Fast Scan (Laya)",
      description: "On-device 27-point audit",
      icon: Gauge,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400",
      squircleBg: "bg-blue-600 text-white shadow-xs",
      action: () => {
        if (onSelectService) onSelectService("laya-scan");
        else onNewReview();
      },
    },
    {
      id: "ai-detection",
      name: "AI Phrasing & Disclosures",
      description: "Laya System 1 neural scan",
      icon: Sparkles,
      color: "text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-400",
      squircleBg: "bg-violet-600 text-white shadow-xs",
      action: () => {
        if (onSelectService) onSelectService("ai-detection");
        else onNewReview();
      },
    },
    {
      id: "journal-fit",
      name: "Journal Fit Predictor",
      description: "48,000+ catalog matcher",
      icon: Compass,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400",
      squircleBg: "bg-emerald-500 text-white shadow-xs",
      action: () => {
        if (onSelectService) onSelectService("journal-fit");
        else onNewReview();
      },
    },
    {
      id: "reference-checker",
      name: "Reference Integrity Audit",
      description: "Crossref & Retraction Watch",
      icon: CheckCircle2,
      color: "text-teal-600 bg-teal-50 dark:bg-teal-950/50 dark:text-teal-400",
      squircleBg: "bg-teal-500 text-white shadow-xs",
      action: () => {
        if (onSelectService) onSelectService("reference-checker");
        else onSelectView("citations");
      },
    },
    {
      id: "citation-claim",
      name: "Citation Claim Validator",
      description: "Evidence claim alignment",
      icon: ShieldCheck,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400",
      squircleBg: "bg-amber-500 text-white shadow-xs",
      action: () => {
        if (onSelectService) onSelectService("citation-claim");
        else onNewReview();
      },
    },
    {
      id: "prisma",
      name: "PRISMA Flow Diagram",
      description: "Systematic review generator",
      icon: Layers,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-400",
      squircleBg: "bg-purple-500 text-white shadow-xs",
      action: () => {
        if (onSelectService) onSelectService("prisma");
        else onNewReview();
      },
    },
    {
      id: "cover-letter",
      name: "Journal Cover Letter",
      description: "Formal editor submission letter",
      icon: FileText,
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400",
      squircleBg: "bg-sky-500 text-white shadow-xs",
      action: () => {
        if (onSelectService) onSelectService("cover-letter");
        else onNewReview();
      },
    },
    {
      id: "response-builder",
      name: "Review Response Builder",
      description: "Point-by-point rebuttal matrix",
      icon: MessageSquare,
      color: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400",
      squircleBg: "bg-rose-500 text-white shadow-xs",
      action: () => {
        if (onSelectService) onSelectService("response-builder");
        else onSelectView("personas");
      },
    },
  ];
}

/**
 * Extract clean, human-friendly API provider name.
 * e.g., gemini-2.0-flash / gemini-1.5-pro -> "Gemini"
 * gpt-4o / gpt-4o-mini / o1 / o3 -> "OpenAI"
 * claude-3-5-sonnet -> "Claude"
 * laya -> "Laya"
 */
export function getPaperApiLabel(paper: PaperItem): string {
  // 1. Explicit Laya / decision scan check
  if (
    paper.scanType === "laya" ||
    paper.scanType === "typesafe" ||
    paper.layaResult != null ||
    paper.typesafeResult != null ||
    paper.provider === "laya" ||
    paper.provider === "typesafe"
  ) {
    return "Laya";
  }

  // 2. Direct provider field
  const prov = (paper.provider || "").toLowerCase();
  if (prov === "gemini") return "Gemini";
  if (prov === "openai") return "OpenAI";
  if (prov === "anthropic") return "Claude";
  if (prov === "groq") return "Groq";
  if (prov === "deepseek") return "DeepSeek";
  if (prov === "mistral") return "Mistral";
  if (prov === "ollama") return "Ollama";
  if (prov === "webllm") return "Local SLM";

  // 3. Inspect aiEngine and model strings
  const raw = `${paper.model || ""} ${paper.aiEngine || ""}`.toLowerCase();
  if (raw.includes("laya") || raw.includes("typesafe") || raw.includes("fast scan")) return "Laya";
  if (raw.includes("gemini")) return "Gemini";
  if (
    raw.includes("gpt") ||
    raw.includes("openai") ||
    raw.includes("o1") ||
    raw.includes("o3") ||
    raw.includes("o4")
  ) {
    return "OpenAI";
  }
  if (raw.includes("claude") || raw.includes("anthropic")) return "Claude";
  if (raw.includes("deepseek")) return "DeepSeek";
  if (raw.includes("groq")) return "Groq";
  if (raw.includes("mistral")) return "Mistral";
  if (raw.includes("ollama")) return "Ollama";
  if (raw.includes("webllm") || raw.includes("slm")) return "Local SLM";
  if (raw.includes("qwen")) return "Qwen";
  if (raw.includes("llama")) return "Llama";

  // 4. Default for persona reviews in ManuView: Gemini
  return "Gemini";
}

/**
 * Returns tailored badge colors for the API provider pill
 */
export function getApiBadgeStyle(apiLabel: string): string {
  switch (apiLabel) {
    case "Laya":
    case "TypeSafe":
      return "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/60";
    case "Gemini":
      return "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800/60";
    case "OpenAI":
      return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60";
    case "Claude":
      return "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60";
    case "Ollama":
    case "Local SLM":
      return "bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border-teal-200/60 dark:border-teal-800/60";
    default:
      return "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700";
  }
}

/**
 * Computes the squircle icon background in the sidebar:
 * - Reviewing: Blue animate-pulse
 * - Desk Reject / Failed: Red
 * - N/A (non-academic / ineligible): Slate
 * - Score >= 75%: Green
 * - Score < 75%: Orange
 */
export function getSidebarIconBgClass(
  paper: PaperItem,
  isReviewing: boolean,
  isFailed: boolean,
  isDeskReject: boolean,
  isNonAcademic: boolean
): string {
  if (isReviewing) {
    return "bg-blue-600 text-white animate-pulse";
  }
  if (isFailed || isDeskReject) {
    return "bg-rose-500 text-white";
  }
  if (
    paper.ineligibilityReason === "already_published" ||
    paper.isPublished === true ||
    paper.publishedDetails?.isPublished === true
  ) {
    return "bg-emerald-500 text-white";
  }
  if (paper.isEligibleForReview === false || isNonAcademic) {
    return "bg-slate-500 text-white";
  }
  if (paper.score != null) {
    if (paper.score >= 75) {
      return "bg-emerald-500 text-white";
    } else {
      return "bg-amber-500 text-white";
    }
  }
  return "bg-slate-500 text-white";
}

/**
 * Returns matching score badge pill style for sidebar items
 */
export function getSidebarScoreBadgeStyle(score?: number): string {
  if (score != null) {
    if (score >= 75) {
      return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60";
    }
    return "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60";
  }
  return "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60";
}

