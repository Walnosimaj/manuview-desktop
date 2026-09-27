/**
 * Laya Local Decision Engine
 * Executes Convai Innovations' Laya System One Decision Model schemas
 * using on-device neural ONNX inference and structured criteria routing.
 */

import {
  LayaPayload,
  LayaDecisionResponse,
  LayaChoiceQuestion,
  LayaNoulQuestion,
  LayaScoreQuestion,
  LayaChoiceResult,
  LayaNoulResult,
  LayaScoreResult,
} from "./laya-engine-types";
import { runLayaNeuralInference } from "./laya-neural-engine";

// Stylistic and formulaic AI markers
const AI_MARKERS = [
  /\bdelv(?:e|es|ing|ed)\s+into\b/i,
  /\btestament\s+to\b/i,
  /\brich\s+tapestry\b/i,
  /\btapestry\s+of\b/i,
  /\bbeacon\s+of\b/i,
  /\bever[- ]evolving\s+(?:landscape|realm|world)\b/i,
  /\bin\s+(?:this|today's)\s+(?:fast[- ]paced|rapidly\s+(?:evolving|changing))\s+(?:digital\s+)?(?:era|age|landscape|world)\b/i,
  /\bplays?\s+a\s+(?:crucial|pivotal|vital|key)\s+role\b/i,
  /\bsheds?\s+light\s+on\b/i,
  /\bpaves?\s+the\s+way\b/i,
  /\bunderscores?\s+the\s+(?:importance|necessity|need|urgency)\b/i,
  /\bparamount\s+importance\b/i,
  /\bmultifaceted\s+(?:nature|approach|aspects|tapestry)\b/i,
  /\bcomprehensive\s+understanding\b/i,
  /\bgarnered\s+(?:significant|considerable)\s+attention\b/i,
  /\bpoised\s+to\s+(?:revolutionize|transform|redefine)\b/i,
  /\bit\s+is\s+worth\s+noting\s+that\b/i,
  /\bit\s+is\s+(?:crucial|essential|important)\s+to\s+note\b/i,
  /\bit\s+is\s+important\s+to\s+remember\s+that\b/i,
  /\bseamlessly\s+(?:navigating|bridges?|integrate|integrates|integrating|connecting)\b/i,
  /\bunleash(?:ing)?\s+the\s+(?:true\s+)?potential\b/i,
  /\btransformative\s+(?:potential|innovation|impact|journey)\b/i,
  /\bgame[- ]changer\b/i,
  /\bgroundbreaking\s+(?:advancement|discovery|innovation)\b/i,
  /\bmyriad\s+(?:of\s+)?(?:challenges|opportunities|ways)\b/i,
  /\bplethora\s+of\b/i,
  /\bharness(?:ing)?\s+the\s+power\s+of\b/i,
  /\bat\s+the\s+forefront\s+of\b/i,
  /\bparadigm\s+shift\b/i,
  /\bin\s+conclusion,\s+(?:our\s+findings|this\s+study)\s+(?:demonstrates|highlights|underscores)\b/i,
  /\bserves?\s+as\s+a\s+(?:crucial|potent|compelling)\s+reminder\b/i,
  /\bnuanced\s+understanding\b/i,
  /\bfoster\s+(?:collaboration|innovation|understanding)\b/i,
  /\bholistic\s+(?:approach|perspective|view)\b/i,
];

const EMPIRICAL_ANCHORS = [
  /\bp\s*[<=<]\s*0?\.\d+/i,
  /\b(?:95%|99%)\s*CI\b/i,
  /\b(?:SD|SEM|IQR)\s*[:=]\s*\d+/i,
  /\bn\s*=\s*\d+/i,
  /\bdf\s*=\s*\d+/i,
  /\b(?:ANOVA|t-test|Mann-Whitney|Wilcoxon|Kruskal-Wallis)\b/i,
  /\b(?:fig(?:ure)?|table)\s+\d+[a-z]?\b/i,
  /\b(?:ug|mg|ml|mmol|mol|kg|cm|mm|nm|hz|khz|ghz)\b/i,
  /\b(?:patients|participants|subjects|mice|cohort)\s+(?:were|underwent|received)\b/i,
  /\bprotocol\s+(?:approved\s+by|registered\s+at)\b/i,
];

/**
 * Evaluates a Noul (Yes/No) question on the given state text using the neural model.
 */
async function evaluateNoul(state: string, question: LayaNoulQuestion): Promise<LayaNoulResult> {
  const text = (state || "").trim();
  if (!text) {
    return { probability: 0.0 };
  }

  // Run neural model forward pass
  let neuralProb: number | null = null;
  try {
    const neural = await runLayaNeuralInference(text);
    neuralProb = neural.aiProbability;
  } catch (err) {
    console.debug("Neural forward pass fallback to heuristic evaluator:", err);
  }

  let aiHits = 0;
  for (const marker of AI_MARKERS) {
    if (marker.test(text)) aiHits++;
  }

  let empiricalHits = 0;
  for (const anchor of EMPIRICAL_ANCHORS) {
    if (anchor.test(text)) empiricalHits++;
  }

  let finalProb: number;
  if (neuralProb !== null) {
    if (aiHits > 0) {
      // Stylistic marker boost: ensure formulaic clichés are properly flagged
      const markerFloor = 0.45 + Math.min(0.50, (aiHits * 0.20) - (empiricalHits * 0.20));
      finalProb = Math.max(neuralProb, markerFloor);
    } else if (empiricalHits > 0) {
      // Empirical anchor dampening: rigorous statistics guarantee human/clean classification
      finalProb = Math.min(neuralProb, Math.max(0.005, neuralProb * 0.5));
    } else {
      finalProb = neuralProb;
    }
  } else {
    // Fast deterministic fallback if ONNX environment is initializing
    let rawProb = 0.04;
    if (aiHits > 0) {
      rawProb = 0.45 + Math.min(0.50, (aiHits * 0.22) - (empiricalHits * 0.15));
    } else if (empiricalHits > 1) {
      rawProb = 0.01;
    }
    finalProb = rawProb;
  }

  const probability = Number(Math.max(0.005, Math.min(0.99, finalProb)).toFixed(4));
  return { probability };
}

/**
 * Evaluates a Choice question on the given state text.
 */
function evaluateChoice(state: string, question: LayaChoiceQuestion): LayaChoiceResult {
  const text = (state || "").trim();
  const criteriaKeys = Object.keys(question.criteria);
  if (criteriaKeys.length === 0) {
    return { selection: "None", confidence: 1.0, probabilities: { None: 1.0 } };
  }

  const rawScores: Record<string, number> = {};

  for (const key of criteriaKeys) {
    const criterionDesc = question.criteria[key] || "";
    let score = 0.05;

    if (key === "Conflict_Of_Interest" || /conflict|competing/i.test(key)) {
      if (
        /\b(?:competing\s+interests?|conflicts?\s+of\s+interest|financial\s+interests?)\b/i.test(text) ||
        /\bauthors?\s+declare(?:\s+no)?\s+(?:competing|conflict)\b/i.test(text) ||
        /\bno\s+conflict(?:s)?\s+of\s+interest\b/i.test(text)
      ) {
        score = 8.5;
      }
    } else if (key === "Data_Availability" || /data/i.test(key)) {
      if (
        /\bdata\s+availability\b/i.test(text) ||
        /\bdata\s+(?:are|is|will\s+be)\s+(?:available|deposited|provided|accessible|shared)\b/i.test(text) ||
        /\bupon\s+(?:reasonable\s+)?request\b/i.test(text) ||
        /\baccession\s+codes?\b/i.test(text) ||
        /\bzenodo|dryad|figshare|github\.com\b/i.test(text)
      ) {
        score = 8.5;
      }
    } else if (key === "Funding_Statement" || /funding/i.test(key)) {
      if (
        /\bfund(?:ed|ing)\s+by\b/i.test(text) ||
        /\bgrant\s+(?:numbers?|support|no\.)\b/i.test(text) ||
        /\bfinancial\s+support\b/i.test(text) ||
        /\bthis\s+work\s+was\s+supported\s+by\b/i.test(text)
      ) {
        score = 8.5;
      }
    } else if (key === "Ethics_Statement" || /ethics|irb/i.test(key)) {
      if (
        /\bethic(?:al|s)\s+(?:approval|committee|standards)\b/i.test(text) ||
        /\binstitutional\s+review\s+board\b/i.test(text) ||
        /\birb\b/i.test(text) ||
        /\binformed\s+consent\s+(?:was\s+obtained|waived)\b/i.test(text) ||
        /\bdeclaration\s+of\s+helsinki\b/i.test(text)
      ) {
        score = 8.5;
      }
    } else if (key === "None" || /none|standard/i.test(key)) {
      score = 0.5;
    } else {
      const descWords = criterionDesc.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      let matches = 0;
      for (const w of descWords) {
        if (text.toLowerCase().includes(w)) matches++;
      }
      score = 0.1 + (matches * 0.4);
    }

    rawScores[key] = score;
  }

  // Softmax / Normalization
  let totalScore = 0;
  for (const s of Object.values(rawScores)) {
    totalScore += s;
  }
  const normFactor = totalScore > 0 ? totalScore : 1.0;

  const probabilities: Record<string, number> = {};
  let selectedChoice = criteriaKeys[0];
  let maxProb = -1;

  for (const key of criteriaKeys) {
    const p = Number((rawScores[key] / normFactor).toFixed(4));
    probabilities[key] = p;
    if (p > maxProb) {
      maxProb = p;
      selectedChoice = key;
    }
  }

  return {
    selection: selectedChoice,
    confidence: Number(maxProb.toFixed(4)),
    probabilities,
  };
}

/**
 * Evaluates a Score question on the given state text.
 */
async function evaluateScore(state: string, question: LayaScoreQuestion): Promise<LayaScoreResult> {
  const text = (state || "").trim();
  const min = question.range?.[0] ?? 0;
  const max = question.range?.[1] ?? 1;

  try {
    const neural = await runLayaNeuralInference(text);
    const scaled = min + (neural.toneScore * (max - min));
    return {
      score: Number(scaled.toFixed(2)),
      confidence: 0.90,
    };
  } catch {}

  let empiricalHits = 0;
  for (const a of EMPIRICAL_ANCHORS) {
    if (a.test(text)) empiricalHits++;
  }

  const baseScore = Math.min(max, min + ((max - min) * (0.65 + Math.min(0.30, empiricalHits * 0.08))));
  return {
    score: Number(baseScore.toFixed(2)),
    confidence: Number((0.80 + Math.min(0.18, empiricalHits * 0.05)).toFixed(2)),
  };
}

/**
 * Core Laya Execution Entrypoint
 */
export async function executeLayaDecision(payload: LayaPayload): Promise<LayaDecisionResponse> {
  const { state, questions } = payload;
  const response: LayaDecisionResponse = {};

  for (const [key, q] of Object.entries(questions)) {
    if (q.type === "noul") {
      response[key] = await evaluateNoul(state, q);
    } else if (q.type === "choice") {
      response[key] = evaluateChoice(state, q);
    } else if (q.type === "score") {
      response[key] = await evaluateScore(state, q);
    }
  }

  return response;
}
