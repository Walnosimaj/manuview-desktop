import React from "react";
import { FileText, Zap, Layers, Settings } from "lucide-react";

export type MobileTab = "articles" | "scan" | "tools" | "settings";

interface MobileTabBarProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  articlesCount?: number;
  isScanning?: boolean;
}

export function MobileTabBar({
  activeTab,
  onSelectTab,
  articlesCount = 0,
  isScanning = false,
}: MobileTabBarProps) {
  const tabs = [
    {
      id: "articles" as MobileTab,
      label: "Articles",
      icon: FileText,
      badge: articlesCount > 0 ? articlesCount : undefined,
    },
    {
      id: "scan" as MobileTab,
      label: "Fast Scan",
      icon: Zap,
      pulse: isScanning,
    },
    {
      id: "tools" as MobileTab,
      label: "Tools",
      icon: Layers,
    },
    {
      id: "settings" as MobileTab,
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl bg-white/85 dark:bg-[#161618]/90 border-t border-black/[0.08] dark:border-white/[0.12] transition-colors"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
      }}
      aria-label="Bottom Navigation"
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 select-none transition-transform active:scale-90 ${
                isActive
                  ? "text-[#007AFF] dark:text-[#0A84FF]"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              <div className="relative flex items-center justify-center w-7 h-7">
                <Icon
                  className={`w-[22px] h-[22px] transition-colors ${
                    isActive ? "stroke-[2.25]" : "stroke-[1.75]"
                  } ${tab.pulse ? "animate-pulse text-amber-500" : ""}`}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full min-w-[16px] text-center shadow-xs">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
                {tab.pulse && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight font-medium transition-colors ${
                  isActive
                    ? "font-semibold text-[#007AFF] dark:text-[#0A84FF]"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
