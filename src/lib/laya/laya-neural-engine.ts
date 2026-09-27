/**
 * Laya Neural Inference Engine
 * Runs on-device ONNX inference for Laya System 1 models (INT8 and FP32)
 * using onnxruntime-web with WebAssembly / WebGPU execution.
 */

import * as ort from "onnxruntime-web";
import {
  getSelectedLayaModelVariant,
  LayaModelVariant,
} from "./laya-model-registry";
import {
  loadTokenizerVocab,
  encodeTextWithVocab,
} from "./laya-tokenizer";

let activeSession: ort.InferenceSession | null = null;
let activeVariantId: string | null = null;
let isLoadingSession = false;

/**
 * Loads or returns the cached ONNX session for the currently selected model variant.
 */
export async function getLayaNeuralSession(): Promise<ort.InferenceSession> {
  const currentVariant = getSelectedLayaModelVariant();

  if (activeSession && activeVariantId === currentVariant.id) {
    return activeSession;
  }

  if (isLoadingSession) {
    // Wait for in-flight load
    let attempts = 0;
    while (isLoadingSession && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
    if (activeSession && activeVariantId === currentVariant.id) {
      return activeSession;
    }
  }

  isLoadingSession = true;

  try {
    const filename = currentVariant.filename;
    let modelSource: string | Uint8Array = `/models/laya/${filename}`;

    // If running in Node.js / test environment
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const localPath = path.join(process.cwd(), "public", "models", "laya", filename);
        if (fs.existsSync(localPath)) {
          modelSource = localPath;
        }
      } catch {}
    }

    // In browser/Tauri, fetch model array buffer if needed
    if (typeof window !== "undefined" && typeof modelSource === "string" && modelSource.startsWith("/")) {
      try {
        const resp = await fetch(modelSource);
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          modelSource = new Uint8Array(ab);
        }
      } catch (err) {
        console.warn("Could not fetch model buffer via HTTP, passing URL directly to ONNX:", err);
      }
    }

    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    };

    const session =
      typeof modelSource === "string"
        ? await ort.InferenceSession.create(modelSource, options)
        : await ort.InferenceSession.create(modelSource, options);

    activeSession = session;
    activeVariantId = currentVariant.id;
    return activeSession;
  } finally {
    isLoadingSession = false;
  }
}

export interface NeuralInferenceResult {
  aiProbability: number;
  isAiFiller: boolean;
  choiceProbabilities: number[];
  toneScore: number;
  qualityScores?: number[];
  acceptProb?: number;
  modelUsed: string;
  latencyMs: number;
}

/**
 * Computes softmax over a numeric array.
 */
function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / (sum || 1));
}

/**
 * Executes a neural forward pass on a single sentence or text chunk.
 */
export async function runLayaNeuralInference(
  text: string
): Promise<NeuralInferenceResult> {
  const t0 = performance.now();
  const session = await getLayaNeuralSession();
  const vocab = await loadTokenizerVocab();

  const { input_ids, attention_mask, tokensCount } = encodeTextWithVocab(text, vocab, 256);

  const feeds: Record<string, ort.Tensor> = {
    input_ids: new ort.Tensor("int64", input_ids, [1, tokensCount]),
    attention_mask: new ort.Tensor("int64", attention_mask, [1, tokensCount]),
  };

  const results = await session.run(feeds);
  const latencyMs = Math.max(1, Math.round(performance.now() - t0));

  // Extract Noul (clean vs AI filler)
  let aiProbability = 0.05;
  if (results.noul_logits) {
    const rawNoul = Array.from(results.noul_logits.data as Float32Array);
    if (rawNoul.length >= 2) {
      const probs = softmax(rawNoul);
      aiProbability = Number(probs[1].toFixed(4)); // Index 1 = AI filler
    }
  }

  // Extract Choice (4 classes)
  let choiceProbabilities = [0.25, 0.25, 0.25, 0.25];
  if (results.choice_logits) {
    const rawChoice = Array.from(results.choice_logits.data as Float32Array);
    if (rawChoice.length >= 4) {
      choiceProbabilities = softmax(rawChoice).map((p) => Number(p.toFixed(4)));
    }
  }

  // Extract Quality Scores (6 dimensions in v2)
  let qualityScores: number[] | undefined;
  let toneScore = 0.75;
  if (results.quality_scores) {
    const rawQuality = Array.from(results.quality_scores.data as Float32Array);
    qualityScores = rawQuality.map((q) => Number(q.toFixed(3)));
    if (qualityScores.length > 0) {
      const avg = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
      toneScore = Number(avg.toFixed(3));
    }
  }

  // Extract Tone (v1 backwards compatibility)
  if (results.tone_score) {
    const rawTone = Array.from(results.tone_score.data as Float32Array);
    if (rawTone.length > 0) {
      toneScore = Number(rawTone[0].toFixed(3));
    }
  }

  // Extract Acceptance Probability (v2)
  let acceptProb: number | undefined;
  if (results.accept_prob) {
    const rawAccept = Array.from(results.accept_prob.data as Float32Array);
    if (rawAccept.length > 0) {
      acceptProb = Number(rawAccept[0].toFixed(3));
    }
  }

  const currentVariant = getSelectedLayaModelVariant();

  return {
    aiProbability,
    isAiFiller: aiProbability >= 0.50,
    choiceProbabilities,
    toneScore,
    qualityScores,
    acceptProb,
    modelUsed: currentVariant.name,
    latencyMs,
  };
}
