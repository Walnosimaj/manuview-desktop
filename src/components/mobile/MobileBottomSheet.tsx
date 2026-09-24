import React, { useEffect } from "react";
import { X } from "lucide-react";

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = "max-h-[88vh]",
}: MobileBottomSheetProps) {
  // Prevent background body scroll when bottom sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        className={`relative z-10 w-full ${maxHeight} flex flex-col bg-white dark:bg-[#1C1C1E] rounded-t-[28px] shadow-2xl border-t border-black/5 dark:border-white/10 transition-transform duration-300 ease-out overflow-hidden`}
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        {/* iOS Grab Handle */}
        <div className="w-full flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        {/* Header Bar */}
        {title && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-black/[0.06] dark:border-white/[0.08]">
            <h3 className="font-semibold text-base text-neutral-900 dark:text-white truncate">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sheet Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
