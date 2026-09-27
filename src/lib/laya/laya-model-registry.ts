/**
 * Laya Model Registry & Selection Manager
 * Manages the available local ONNX model variants (INT8 Quantized vs FP32 Full Precision)
 */

export interface LayaModelVariant {
  id: "laya-system1-int8" | "laya-system1-fp32";
  name: string;
  tag: string;
  filename: string;
  sizeMB: number;
  size: string;
  precision: "int8" | "fp32";
  speed: string;
  description: string;
  isRecommended: boolean;
}

export const LAYA_MODEL_VARIANTS: LayaModelVariant[] = [
  {
    id: "laya-system1-int8",
    name: "Laya System 1 v3 (INT8 Quantized)",
    tag: "Fast & Lightweight",
    filename: "laya_v3_int8.onnx",
    sizeMB: 22.0,
    size: "22.0 MB",
    precision: "int8",
    speed: "~1-3 ms / sentence",
    description: "8-bit quantized neural weights with 7 multi-task heads for rapid, highly-validated on-device inference.",
    isRecommended: true,
  },
  {
    id: "laya-system1-fp32",
    name: "Laya System 1 v3 (FP32 Full Precision)",
    tag: "Full Precision",
    filename: "laya_v3_fp32.onnx",
    sizeMB: 86.4,
    size: "86.4 MB",
    precision: "fp32",
    speed: "~5-10 ms / sentence",
    description: "Uncompressed 32-bit floating-point weights with full numerical fidelity across all 7 evaluation heads.",
    isRecommended: false,
  },
];

const STORAGE_KEY = "manuview_laya_selected_model_variant";
let inMemorySelectedId: string | null = null;

export function getSelectedLayaModelVariant(): LayaModelVariant {
  if (inMemorySelectedId) {
    const found = LAYA_MODEL_VARIANTS.find((m) => m.id === inMemorySelectedId);
    if (found) return found;
  }
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const found = LAYA_MODEL_VARIANTS.find((m) => m.id === saved);
        if (found) return found;
      }
    } catch {}
  }
  return LAYA_MODEL_VARIANTS[0]; // Default to INT8
}

export function setSelectedLayaModelVariant(id: "laya-system1-int8" | "laya-system1-fp32"): void {
  inMemorySelectedId = id;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, id);
      window.dispatchEvent(new CustomEvent("manuview_laya_model_changed", { detail: id }));
    } catch {}
  }
}
