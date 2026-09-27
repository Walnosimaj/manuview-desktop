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
    name: "Laya System 1 (INT8 Quantized)",
    tag: "Fast & Lightweight",
    filename: "laya_system1_int8.onnx",
    sizeMB: 22.9,
    size: "22.9 MB",
    precision: "int8",
    speed: "~1-3 ms / sentence",
    description: "8-bit quantized neural weights for rapid on-device inference with low memory footprint.",
    isRecommended: true,
  },
  {
    id: "laya-system1-fp32",
    name: "Laya System 1 (FP32 Full Precision)",
    tag: "Full Precision",
    filename: "laya_system1_fp32.onnx",
    sizeMB: 90.4,
    size: "90.4 MB",
    precision: "fp32",
    speed: "~5-10 ms / sentence",
    description: "Uncompressed 32-bit floating-point weights offering maximum numerical fidelity.",
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
