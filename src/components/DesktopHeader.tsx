"use client";

import React from "react";
import {
  X,
  FileText,
  Compass,
  CheckCircle2,
  ShieldCheck,
  Layers,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  PanelLeft,
  ChevronDown,
  Download,
  Cpu,
  LayoutGrid,
  AlertTriangle,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTheme } from "@/context/ThemeContext";
import { isDesktopApp } from "@/lib/desktop";
import {
  PLATFORMS,
  PlatformId,
  PlatformOption,
  detectPlatform,
  triggerPlatformDownload,
} from "@/lib/platform";

export interface TabItem {
  id: string;
  type: "article" | "tool";
  title: string;
  shortName: string;
  toolType?: string;
}

interface DesktopHeaderProps {
  openTabs: TabItem[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onNewTab?: () => void;
  isConnected?: boolean;
  isLoading?: boolean;
  activeModelName?: string | null;
  latencyMs?: number | null;
  onOpenSettings?: () => void;
  onOpenLocalModel?: () => void;
  onSelectService?: (serviceId: string) => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onGoHome?: () => void;
  isScanning?: boolean;
}

const AppleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 170 170" className={className} fill="currentColor">
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.7-7.83-12-14.36-6.19-9.35-11-20.35-14.42-33-3.42-12.65-5.13-24.3-5.13-34.95 0-14.36 3.6-26.35 10.8-35.97 7.2-9.62 16.4-14.53 27.6-14.75 5.26 0 11.05 1.41 17.37 4.23 6.32 2.82 10.22 4.3 11.7 4.43 1.96-.24 5.98-1.78 12.06-4.63 6.08-2.85 11.66-4.14 16.74-3.87 12.72.65 22.86 5.48 30.42 14.49-11.09 6.74-16.52 16.03-16.3 27.87.22 9.35 3.86 17.17 10.92 23.48 7.06 6.3 15.43 9.89 25.1 10.76-2.17 6.74-4.89 13.59-8.15 20.55zM119.22 31.84c0-7.18 2.61-13.91 7.83-20.2 5.22-6.29 11.74-10.43 19.56-12.43.22 1.3.33 2.39.33 3.26 0 7.18-2.67 14.13-8.01 20.87-5.34 6.74-12.06 10.76-20.17 12.06-.22-.76-.33-1.42-.33-2.07l.79-1.49z" />
  </svg>
);

const WindowsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 88 88" className={className} fill="currentColor">
    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.202L0 12.402zm35.67 33.529l.028 34.453L0 75.48v-29.75l35.67.201zm4.326-39.027L87.914 0v41.527l-47.918.375V6.904zm47.918 38.928v42.168l-47.918-6.735V45.629l47.918.203z" />
  </svg>
);

const LinuxIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12.002 0c-3.13 0-5.67 2.54-5.67 5.67 0 .58.09 1.14.25 1.67-1.74.83-2.95 2.6-2.95 4.66 0 1.25.44 2.4 1.18 3.3-.23.67-.37 1.39-.37 2.14 0 3.63 3.37 6.56 7.56 6.56s7.56-2.93 7.56-6.56c0-.75-.14-1.47-.37-2.14.74-.9 1.18-2.05 1.18-3.3 0-2.06-1.21-3.83-2.95-4.66.16-.53.25-1.09.25-1.67 0-3.13-2.54-5.67-5.67-5.67z" />
  </svg>
);

const HEADER_SERVICES = [
  {
    id: "ai-review",
    name: "Pre-Submission AI Scan",
    description: "5-persona AI review & diagnostic rubric",
    icon: Sparkles,
    squircleBg: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xs",
  },
  {
    id: "ai-detection",
    name: "AI Phrasing & Disclosures",
    description: "Laya System 1 neural decision scan",
    icon: Sparkles,
    squircleBg: "bg-violet-600 text-white shadow-xs",
  },
  {
    id: "journal-fit",
    name: "Target Journal Fit",
    description: "48,000+ scholarly venues scope analysis",
    icon: Compass,
    squircleBg: "bg-emerald-500 text-white shadow-xs",
  },
  {
    id: "reference-checker",
    name: "Reference Integrity Audit",
    description: "Crossref & Retraction Watch checks",
    icon: CheckCircle2,
    squircleBg: "bg-teal-500 text-white shadow-xs",
  },
  {
    id: "citation-claim",
    name: "Citation Claim Validator",
    description: "Evidence claim alignment & causal rigor",
    icon: ShieldCheck,
    squircleBg: "bg-amber-500 text-white shadow-xs",
  },
  {
    id: "prisma",
    name: "PRISMA Flow Diagram",
    description: "Systematic review flowchart generator",
    icon: Layers,
    squircleBg: "bg-purple-500 text-white shadow-xs",
  },
  {
    id: "cover-letter",
    name: "Journal Cover Letter",
    description: "Formal editor submission letter",
    icon: FileText,
    squircleBg: "bg-sky-500 text-white shadow-xs",
  },
  {
    id: "response-builder",
    name: "Review Response Builder",
    description: "Point-by-point rebuttal matrix",
    icon: MessageSquare,
    squircleBg: "bg-rose-500 text-white shadow-xs",
  },
];

export function DesktopHeader({
  openTabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onSelectService,
  onToggleSidebar,
  sidebarOpen = true,
  onGoHome,
  isScanning = false,
}: DesktopHeaderProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const tabsScrollRef = React.useRef<HTMLDivElement>(null);
  const activeTabRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [hasOverflow, setHasOverflow] = React.useState(false);

  // Services dropdown state
  const [servicesDropdownOpen, setServicesDropdownOpen] = React.useState(false);
  const servicesDropdownRef = React.useRef<HTMLDivElement>(null);

  // OS Platform download state (for Web mode top bar)
  const [detectedPlatformId, setDetectedPlatformId] = React.useState<PlatformId>("mac-silicon");
  const [selectedPlatform, setSelectedPlatform] = React.useState<PlatformOption>(PLATFORMS[0]);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = React.useState(false);
  const downloadDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const detected = detectPlatform();
    setDetectedPlatformId(detected);
    const matched = PLATFORMS.find((p) => p.id === detected) || PLATFORMS[0];
    setSelectedPlatform(matched);
  }, []);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        downloadDropdownRef.current &&
        !downloadDropdownRef.current.contains(e.target as Node)
      ) {
        setDownloadDropdownOpen(false);
      }
      if (
        servicesDropdownRef.current &&
        !servicesDropdownRef.current.contains(e.target as Node)
      ) {
        setServicesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Window drag handler for Tauri native window
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      target.closest("[data-no-drag]")
    ) {
      return;
    }
    try {
      const appWin = getCurrentWindow();
      if (appWin) {
        appWin.startDragging();
      }
    } catch {}
  };

  const checkScroll = React.useCallback(() => {
    const scrollEl = tabsScrollRef.current;
    const containerEl = containerRef.current;
    if (!scrollEl || !containerEl) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
    const overflow = scrollWidth > clientWidth + 2;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && scrollLeft > 2);
    setCanScrollRight(overflow && scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  React.useEffect(() => {
    checkScroll();
    const scrollEl = tabsScrollRef.current;
    if (!scrollEl) return;

    const ro = new ResizeObserver(() => checkScroll());
    ro.observe(scrollEl);
    window.addEventListener("resize", checkScroll);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, openTabs.length]);

  // Scroll active tab into view when selected
  React.useEffect(() => {
    if (activeTabRef.current && tabsScrollRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      setTimeout(checkScroll, 300);
    }
  }, [activeTabId, checkScroll]);

  const handleScrollLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollBy({ left: -200, behavior: "smooth" });
      setTimeout(checkScroll, 250);
    }
  };

  const handleScrollRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollBy({ left: 200, behavior: "smooth" });
      setTimeout(checkScroll, 250);
    }
  };

  const getTabIcon = (tab: TabItem, isActive: boolean) => {
    const activeClass = isActive
      ? "text-blue-600 dark:text-blue-400 font-semibold"
      : "text-neutral-400";

    if (tab.type === "tool" && tab.toolType) {
      switch (tab.toolType) {
        case "journal-fit":
          return <Compass className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-600" : "text-neutral-400"}`} />;
        case "reference-checker":
          return <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-teal-600" : "text-neutral-400"}`} />;
        case "citation-claim":
          return <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-amber-600" : "text-neutral-400"}`} />;
        case "prisma":
          return <Layers className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-purple-600" : "text-neutral-400"}`} />;
        case "cover-letter":
          return <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-indigo-600" : "text-neutral-400"}`} />;
        case "response-builder":
          return <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-rose-600" : "text-neutral-400"}`} />;
        case "ai-review":
        case "pre-submission":
          return <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-600" : "text-neutral-400"}`} />;
        case "ai-detection":
          return <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-violet-600" : "text-neutral-400"}`} />;
        default:
          return <FileText className={`w-3.5 h-3.5 shrink-0 ${activeClass}`} />;
      }
    }
    return <FileText className={`w-3.5 h-3.5 shrink-0 ${activeClass}`} />;
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      className="h-[52px] liquid-glass-header flex items-center select-none shrink-0 z-50 cursor-default relative transition-colors duration-150 border-b border-black/[0.06] dark:border-white/[0.08]"
    >
      {/* Top Left: In Web mode, render Company Brand + Sidebar Toggle (Exact match with screenshot) */}
      {!isDesktopApp() ? (
        <div
          className={`h-full border-r border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between px-3 shrink-0 transition-all duration-300 ${
            sidebarOpen ? "w-64" : "w-[68px]"
          }`}
        >
          {sidebarOpen ? (
            <>
              {onGoHome && !isDesktopApp() ? (
                <button
                  type="button"
                  data-no-drag
                  onClick={onGoHome}
                  className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition cursor-pointer"
                  title="Back to Landing Page"
                >
                  <img
                    src="/icon.svg"
                    alt="ManuView Logo"
                    className="w-7 h-7 rounded-lg shadow-xs shrink-0 select-none"
                  />
                  <div className="truncate min-w-0">
                    <div className="font-bold text-xs text-[#0F172A] dark:text-white tracking-tight leading-tight">
                      ManuView Desktop
                    </div>
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium leading-tight">
                      Research &amp; Review Suite
                    </div>
                  </div>
                </button>
              ) : (
                <div
                  data-no-drag
                  className="flex items-center gap-2.5 min-w-0 text-left select-none"
                >
                  <img
                    src="/icon.svg"
                    alt="ManuView Logo"
                    className="w-7 h-7 rounded-lg shadow-xs shrink-0 select-none"
                  />
                  <div className="truncate min-w-0">
                    <div className="font-bold text-xs text-[#0F172A] dark:text-white tracking-tight leading-tight">
                      ManuView Desktop
                    </div>
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium leading-tight">
                      Research &amp; Review Suite
                    </div>
                  </div>
                </div>
              )}
              <button
                type="button"
                data-no-drag
                onClick={onToggleSidebar}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.1] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer shrink-0 ml-1"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                data-no-drag
                onClick={onToggleSidebar}
                title="Expand sidebar"
                className="w-8 h-8 rounded-lg bg-white dark:bg-[#161F30] border border-black/10 dark:border-white/10 hover:border-neutral-300 dark:hover:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* macOS desktop native traffic light spacer */
        <div data-tauri-drag-region className="w-[84px] h-full shrink-0" />
      )}

      {/* CENTER: BROWSER-STYLE SCROLLABLE TAB BAR WITH OVERFLOW ARROWS */}
      <div
        ref={containerRef}
        data-tauri-drag-region
        className="flex-1 h-full flex items-end pb-1 min-w-0 px-2 relative"
      >
        {/* Left Scroll Arrow */}
        {hasOverflow && canScrollLeft && (
          <button
            type="button"
            onClick={handleScrollLeft}
            title="Scroll tabs left"
            className="w-6 h-[38px] flex items-center justify-center rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-neutral-600 dark:text-neutral-300 transition shrink-0 z-10 mr-1 cursor-pointer liquid-glass-card"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Scrollable Tabs Container */}
        <div
          ref={tabsScrollRef}
          onScroll={checkScroll}
          data-tauri-drag-region
          className="flex-1 flex items-center gap-1.5 h-[42px] min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth overflow-x-auto"
        >
          {openTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                data-no-drag
                ref={isActive ? activeTabRef : undefined}
                onClick={() => onSelectTab(tab.id)}
                title={tab.title}
                className={`group flex items-center gap-2 h-[38px] px-3 rounded-lg text-xs transition cursor-pointer max-w-[210px] min-w-[120px] shrink-0 ${
                  isActive
                    ? "liquid-glass-tab-active text-[#111827] dark:text-[#F8FAFC] font-semibold"
                    : "bg-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-transparent"
                }`}
              >
                {getTabIcon(tab, isActive)}
                <span className="truncate text-xs">{tab.shortName}</span>
                <button
                  type="button"
                  title="Close tab"
                  onClick={(e) => onCloseTab(tab.id, e)}
                  className={`p-0.5 rounded-md hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 transition opacity-0 group-hover:opacity-100 ${
                    isActive ? "opacity-70" : ""
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Scroll Arrow */}
        {hasOverflow && canScrollRight && (
          <button
            type="button"
            onClick={handleScrollRight}
            title="Scroll tabs right"
            className="w-6 h-[38px] flex items-center justify-center rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-neutral-600 dark:text-neutral-300 transition shrink-0 z-10 ml-1 cursor-pointer liquid-glass-card"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Top Right: Services Icon Dropdown Button + OS Download Button */}
      <div className="flex items-center gap-2 h-full pl-2 pr-3 shrink-0 relative z-50">
        {/* Services Dropdown Button (Replacing theme toggle & local AI button) */}
        <div className="relative inline-flex items-center" ref={servicesDropdownRef}>
          <button
            type="button"
            data-no-drag
            onClick={() => setServicesDropdownOpen((prev) => !prev)}
            title="Manuscript Intelligence Services"
            aria-label="Manuscript Intelligence Services"
            className={`w-8 h-8 flex items-center justify-center rounded-lg border border-black/10 dark:border-white/15 transition cursor-pointer active:scale-95 ${
              servicesDropdownOpen
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-400/40"
                : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {servicesDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl liquid-glass-modal bg-white/95 dark:bg-[#0f172a]/95 p-2.5 shadow-2xl border border-black/10 dark:border-white/10 z-[100] animate-fade-in backdrop-blur-2xl">
              <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                <span>Manuscript Services</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                  {HEADER_SERVICES.length} Tools
                </span>
              </div>
              <div className="space-y-0.5 mt-1.5">
                {HEADER_SERVICES.map((srv) => {
                  const isServiceDisabled = isScanning && (srv.id === "ai-review" || srv.id === "pre-submission" || srv.id === "triage");
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      data-no-drag
                      disabled={isServiceDisabled}
                      onClick={() => {
                        if (!isServiceDisabled) {
                          setServicesDropdownOpen(false);
                          onSelectService?.(srv.id);
                        }
                      }}
                      title={isServiceDisabled ? "A manuscript scan is already in progress" : undefined}
                      className={`w-full text-left p-2 rounded-xl transition flex items-center gap-2.5 ${
                        isServiceDisabled
                          ? "opacity-50 cursor-not-allowed text-neutral-400 dark:text-neutral-500"
                          : "hover:bg-black/5 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200 group cursor-pointer"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${srv.squircleBg}`}
                      >
                        <srv.icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-semibold truncate ${
                            isServiceDisabled
                              ? ""
                              : "group-hover:text-blue-600 dark:group-hover:text-blue-400"
                          } transition`}
                        >
                          {srv.name}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                          {isServiceDisabled ? "Review scan in progress..." : srv.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Integrated AI Advisory & Disclaimer Footer */}
              <div className="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                <div className="p-2.5 rounded-xl bg-amber-500/[0.06] dark:bg-amber-500/[0.1] border border-amber-500/20 text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-[11px] font-bold text-[#0F172A] dark:text-white truncate">
                        AI Advisory &amp; Disclaimer
                      </span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      100% BYOK
                    </span>
                  </div>

                  <div className="space-y-1 text-[10px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                    <div className="flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <p>
                        <strong className="text-[#0F172A] dark:text-white font-semibold">Caution:</strong> Generative AI can hallucinate. Independently verify all citations and methodological claims.
                      </p>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <p>
                        <strong className="text-[#0F172A] dark:text-white font-semibold">Diagnostic Support:</strong> Assistive pre-submission simulation; does not replace domain peer review.
                      </p>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                      <p>
                        <strong className="text-[#0F172A] dark:text-white font-semibold">Editorial Discretion:</strong> Acceptance is never guaranteed; final decisions rest solely with journal editors.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-amber-500/15 flex items-center justify-between text-[9px] text-neutral-400 dark:text-neutral-500">
                    <span>COPE &amp; ICMJE Guidelines</span>
                    <span>Decision Support Only</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Download for OS Split Button (Web Mode Only - exact match with screenshot) */}
        {!isDesktopApp() && (
          <div className="relative inline-flex items-center" ref={downloadDropdownRef}>
            <div className="inline-flex items-center h-8 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white shadow-xs transition-all duration-200 overflow-hidden">
              <button
                type="button"
                data-no-drag
                onClick={() => setDownloadDropdownOpen((prev) => !prev)}
                className="inline-flex items-center h-full gap-1.5 px-3 font-semibold text-xs cursor-pointer hover:bg-blue-700/40 transition active:scale-[0.98]"
                title={`Download ManuView for ${selectedPlatform.label} (Coming Soon)`}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Download for {selectedPlatform.label}</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-white/20 text-white leading-none">
                  Coming Soon
                </span>
              </button>
              <button
                type="button"
                data-no-drag
                onClick={(e) => {
                  e.stopPropagation();
                  setDownloadDropdownOpen((prev) => !prev);
                }}
                aria-label="Other operating system downloads"
                className="h-full px-2 border-l border-white/20 hover:bg-blue-700/50 cursor-pointer transition flex items-center justify-center"
                title="Choose other operating system (MacOS Intel, Windows, Linux)"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${
                    downloadDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* Dropdown Menu for Other Operating Systems */}
            {downloadDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl liquid-glass-modal bg-white dark:bg-[#0f172a] p-2 shadow-2xl border border-black/10 dark:border-white/10 z-50 animate-fade-in backdrop-blur-2xl">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                  <span>Operating Systems</span>
                  <span className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400">
                    Desktop v0.3.97
                  </span>
                </div>
                <div className="space-y-1 mt-1.5">
                  {PLATFORMS.map((plat) => {
                    const isCurrentSelected = plat.id === selectedPlatform.id;
                    const isDetected = plat.id === detectedPlatformId;
                    return (
                      <div
                        key={plat.id}
                        className={`w-full text-left p-2 rounded-xl transition flex items-center justify-between group ${
                          isCurrentSelected
                            ? "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold"
                            : "hover:bg-black/5 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              plat.id.startsWith("mac")
                                ? "bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white"
                                : plat.id === "windows"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {plat.id.startsWith("mac") ? (
                              <AppleIcon className="w-3.5 h-3.5 fill-current" />
                            ) : plat.id === "windows" ? (
                              <WindowsIcon className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <LinuxIcon className="w-3.5 h-3.5 fill-current" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate flex items-center gap-1">
                              <span>{plat.label}</span>
                              {isDetected && (
                                <span className="text-[8px] px-1 py-0.2 rounded font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Detected
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                              {plat.sublabel} ({plat.extension})
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 whitespace-nowrap shrink-0 ml-1.5">
                          Coming Soon
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dedicated Window Drag Region at the far right */}
      <div
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
        className="w-3 h-full shrink-0"
      />
    </header>
  );
}
