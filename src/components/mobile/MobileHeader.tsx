import React from "react";
import { ChevronLeft, Sun, Moon, Plus, Cpu, Sparkles } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  activeModelName?: string | null;
  isConnected?: boolean;
  isLoading?: boolean;
  onOpenNewScan?: () => void;
  onOpenSettings?: () => void;
  rightAction?: React.ReactNode;
}

export function MobileHeader({
  title,
  subtitle,
  onBack,
  activeModelName,
  isConnected = false,
  isLoading = false,
  onOpenNewScan,
  onOpenSettings,
  rightAction,
}: MobileHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="sticky top-0 left-0 right-0 z-40 backdrop-blur-2xl bg-white/85 dark:bg-[#161618]/90 border-b border-black/[0.08] dark:border-white/[0.12] select-none transition-colors"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 8px)",
      }}
    >
      <div className="h-12 px-3.5 flex items-center justify-between gap-2">
        {/* Left Side: Back button or Brand */}
        <div className="flex items-center min-w-0 flex-1">
          {onBack ? (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-[#007AFF] dark:text-[#0A84FF] text-[15px] font-medium active:opacity-60 transition-opacity -ml-1 pr-2 py-1"
            >
              <ChevronLeft className="w-5 h-5 -mr-1" />
              <span>Back</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-bold text-base tracking-tight text-neutral-900 dark:text-white">
                ManuView
              </span>
            </div>
          )}
        </div>

        {/* Center: Model Status Chip (Tap opens settings) */}
        {activeModelName && (
          <button
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800/80 border border-black/5 dark:border-white/10 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 active:scale-95 transition-transform shrink-0 max-w-[130px] truncate"
            title="Configure Model & Provider"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isLoading
                  ? "bg-amber-500 animate-ping"
                  : isConnected
                  ? "bg-emerald-500"
                  : "bg-neutral-400"
              }`}
            />
            <span className="truncate">{activeModelName.replace("gemini-", "").replace("-instruct", "")}</span>
          </button>
        )}

        {/* Right Side: Quick Action & Theme Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          {rightAction ? (
            rightAction
          ) : (
            <>
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-90 transition-transform"
                aria-label="Toggle Theme"
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              {onOpenNewScan && (
                <button
                  onClick={onOpenNewScan}
                  className="w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center shadow-xs active:scale-90 transition-transform"
                  aria-label="New Scan"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Optional Large Title header bar for iOS top list views */}
      {subtitle && (
        <div className="px-4 pb-2 pt-0.5">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white truncate">
            {title}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{subtitle}</p>
        </div>
      )}
    </header>
  );
}
