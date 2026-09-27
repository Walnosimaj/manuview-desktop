/**
 * AI-Detection & Pre-Submission Mandatory Requirements Service
 * Uses Laya's System One Decision Engine over IPC to detect AI-generated filler phrasing,
 * verify mandatory administrative disclosures (Ethics, Data Availability, Funding, COI),
 * and screen for plagiarism & academic phrasing similarity.
 */

import { invokeDecision } from "./laya-ipc";
import { LayaPayload, isChoiceResult, isNoulResult } from "./laya-engine-types";
import { chunkManuscriptText, ManuscriptChunk, SentenceChunk } from "./text-chunker";
import { getSelectedLayaModelVariant } from "./laya-model-registry";
import { runLayaNeuralInference } from "./laya-neural-engine";

export interface AiHighlightSpan {
  id: string;
  sentenceText: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  probability: number;
  severity: "high" | "moderate" | "clean";
  context: string;
}

export interface SimilaritySpan {
  id: string;
  sentenceText: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  matchType: "boilerplate" | "verbatim_overlap" | "unanchored_claim";
  similarityPct: number;
  reason: string;
  recommendation: string;
}

export type DisclosureType =
  | "Conflict_Of_Interest"
  | "Data_Availability"
  | "Funding_Statement"
  | "Ethics_Statement";

export interface DisclosureItem {
  key: DisclosureType;
  title: string;
  description: string;
  status: "verified" | "manual_review" | "missing";
  confidence: number;
  probabilities: Record<string, number>;
  excerpt?: string;
  paragraphIndex?: number;
  startOffset?: number;
  endOffset?: number;
  calibrationAdvisory?: string;
}

export interface AiDetectionReport {
  overallAiProbability: number;
  aiRiskLevel: "High AI Density" | "Moderate AI Patterns" | "Low / Human Grounded";
  originalityScore: number;
  originalityLevel: "High Originality (Safe)" | "Moderate Academic Overlap" | "Elevated Similarity Risk";
  totalSentencesScanned: number;
  flaggedSentencesCount: number;
  averageLatencyMs: number;
  modelUsed: string;
  qualityScores?: number[];
  acceptProb?: number;
  disclosures: Record<DisclosureType, DisclosureItem>;
  highlights: AiHighlightSpan[];
  similarityMatches: SimilaritySpan[];
  chunks: ManuscriptChunk[];
  fullText: string;
  scannedAt: string;
}

const COMMON_BOILERPLATES = [
  {
    regex: /\bthe\s+remainder\s+of\s+this\s+paper\s+is\s+organized\s+as\s+follows\b/i,
    reason: "Standard structural template cliché",
    recommendation: "Replace with a narrative roadmap linking sections to your research questions.",
  },
  {
    regex: /\bhas\s+received\s+(?:considerable|significant|increasing|widespread)\s+attention\s+in\s+recent\s+years\b/i,
    reason: "Generic academic opening cliché",
    recommendation: "Cite specific milestone publications rather than using passive popularity claims.",
  },
  {
    regex: /\bdue\s+to\s+the\s+lack\s+of\s+(?:prior\s+)?research\s+in\s+this\s+area\b/i,
    reason: "Overgeneralized literature void claim",
    recommendation: "Carefully delineate the precise technical gap rather than claiming a total research vacuum.",
  },
  {
    regex: /\bto\s+the\s+best\s+of\s+our\s+knowledge,\s+(?:this\s+is\s+the\s+first|no\s+prior)\b/i,
    reason: "Routine novelty assertion template",
    recommendation: "State the unique structural or empirical difference explicitly (e.g. 'unlike prior cohorts...').",
  },
  {
    regex: /\bfurther\s+(?:research|investigation|studies)\s+is\s+needed\s+to\s+fully\s+understand\b/i,
    reason: "Vague closing boilerplate",
    recommendation: "Specify the exact future hypotheses, clinical parameters, or experiments needed.",
  },
];

export async function scanManuscriptForAiAndDisclosures(
  fullText: string,
  onProgress?: (percent: number, statusText: string) => void
): Promise<AiDetectionReport> {
  const startTime = Date.now();
  const currentVariant = getSelectedLayaModelVariant();

  onProgress?.(5, `Loading ${currentVariant.name}...`);

  // 1. Chunk full text into semantic units
  const chunks = chunkManuscriptText(fullText);

  // Initialize disclosure states
  const disclosures: Record<DisclosureType, DisclosureItem> = {
    Conflict_Of_Interest: {
      key: "Conflict_Of_Interest",
      title: "Conflict of Interest",
      description: "Declaration of financial or personal relationships.",
      status: "missing",
      confidence: 0,
      probabilities: {},
    },
    Data_Availability: {
      key: "Data_Availability",
      title: "Data Availability",
      description: "Information regarding where the research data can be found.",
      status: "missing",
      confidence: 0,
      probabilities: {},
    },
    Funding_Statement: {
      key: "Funding_Statement",
      title: "Funding & Financial Support",
      description: "Declarations of grant support or institutional funding.",
      status: "missing",
      confidence: 0,
      probabilities: {},
    },
    Ethics_Statement: {
      key: "Ethics_Statement",
      title: "Ethics & IRB Approval",
      description: "Ethics committee clearance and human/animal subject compliance.",
      status: "missing",
      confidence: 0,
      probabilities: {},
    },
  };

  const highlights: AiHighlightSpan[] = [];
  const similarityMatches: SimilaritySpan[] = [];
  let totalSentences = 0;
  let totalAiProbSum = 0;
  let evaluationCount = 0;

  // Track sentence texts for verbatim internal repetition
  const sentenceOccurrences = new Map<string, number>();

  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = Math.round(((i + 1) / chunks.length) * 85);
    onProgress?.(progress, `Evaluating paragraph ${i + 1} of ${chunks.length}...`);

    // 1. Evaluate chunk for administrative disclosures (Choice primitive)
    const disclosurePayload: LayaPayload = {
      state: chunk.text,
      questions: {
        section_type: {
          type: "choice",
          instructions: "Identify the administrative purpose of this statement.",
          criteria: {
            Conflict_Of_Interest: "Declarations of financial or personal relationships.",
            Data_Availability: "Where the data can be found.",
            Funding_Statement: "Financial or grant support.",
            Ethics_Statement: "Ethics committee or IRB approvals.",
            None: "Standard manuscript text.",
          },
        },
      },
    };

    const chunkResult = await invokeDecision(disclosurePayload);
    const sectionRes = chunkResult.section_type;

    if (sectionRes && isChoiceResult(sectionRes) && sectionRes.selection !== "None") {
      const matchedKey = sectionRes.selection as DisclosureType;
      if (disclosures[matchedKey]) {
        const existing = disclosures[matchedKey];
        if (sectionRes.confidence > existing.confidence) {
          const status = sectionRes.confidence >= 0.60 ? "verified" : "manual_review";
          const advisory =
            sectionRes.confidence < 0.60
              ? `Low confidence (${Math.round(sectionRes.confidence * 100)}%). Manual verification recommended.`
              : undefined;

          disclosures[matchedKey] = {
            ...existing,
            status,
            confidence: sectionRes.confidence,
            probabilities: sectionRes.probabilities,
            excerpt: chunk.text.slice(0, 300),
            paragraphIndex: chunk.paragraphIndex,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            calibrationAdvisory: advisory,
          };
        }
      }
    }

    // 2. Evaluate individual sentences within chunk
    for (const sentence of chunk.sentences) {
      totalSentences++;
      const sText = sentence.text.trim();
      const normalizedSent = sText.toLowerCase();

      // Check verbatim repetition
      const prevCount = sentenceOccurrences.get(normalizedSent) || 0;
      sentenceOccurrences.set(normalizedSent, prevCount + 1);

      if (prevCount > 0 && sText.length > 30) {
        similarityMatches.push({
          id: `sim_rep_${sentence.startOffset}`,
          sentenceText: sText,
          paragraphIndex: chunk.paragraphIndex,
          startOffset: sentence.startOffset,
          endOffset: sentence.endOffset,
          matchType: "verbatim_overlap",
          similarityPct: 95,
          reason: "Identical sentence repeated verbatim in manuscript.",
          recommendation: "Rephrase or consolidate redundant statements to avoid self-duplication.",
        });
      }

      // Check common academic boilerplates
      for (const bp of COMMON_BOILERPLATES) {
        if (bp.regex.test(sText)) {
          similarityMatches.push({
            id: `sim_bp_${sentence.startOffset}`,
            sentenceText: sText,
            paragraphIndex: chunk.paragraphIndex,
            startOffset: sentence.startOffset,
            endOffset: sentence.endOffset,
            matchType: "boilerplate",
            similarityPct: 80,
            reason: bp.reason,
            recommendation: bp.recommendation,
          });
          break;
        }
      }

      // Evaluate AI filler phrasing (Noul primitive)
      const aiPayload: LayaPayload = {
        state: sentence.text,
        questions: {
          is_ai_filler: {
            type: "noul",
            instructions: "Does this text rely heavily on AI-generated filler words?",
          },
        },
      };

      const sentenceResult = await invokeDecision(aiPayload);
      evaluationCount++;
      const aiRes = sentenceResult.is_ai_filler;

      if (aiRes && isNoulResult(aiRes)) {
        const p = aiRes.probability;
        totalAiProbSum += p;

        if (p >= 0.40) {
          highlights.push({
            id: `hl_${sentence.startOffset}_${sentence.endOffset}`,
            sentenceText: sentence.text,
            paragraphIndex: chunk.paragraphIndex,
            startOffset: sentence.startOffset,
            endOffset: sentence.endOffset,
            probability: p,
            severity: p >= 0.65 ? "high" : "moderate",
            context: chunk.sectionContext,
          });
        }
      }
    }
  }

  // 3. Overall Manuscript Neural Forward Pass for Quality & Acceptance Probability
  onProgress?.(92, "Running Laya v2 overall quality & acceptance pass...");
  let qualityScores: number[] | undefined;
  let acceptProb: number | undefined;

  try {
    const headSample = fullText.slice(0, 1500);
    const overallNeural = await runLayaNeuralInference(headSample);
    qualityScores = overallNeural.qualityScores;
    acceptProb = overallNeural.acceptProb;
  } catch (err) {
    console.debug("Overall neural inference pass fallback:", err);
  }

  const elapsedMs = Date.now() - startTime;
  const avgLatency = evaluationCount > 0 ? Math.max(1, Math.round(elapsedMs / evaluationCount)) : 2;
  const overallProb = totalSentences > 0 ? Number((totalAiProbSum / totalSentences).toFixed(4)) : 0;

  const aiRiskLevel =
    overallProb >= 0.40
      ? "High AI Density"
      : overallProb >= 0.18
      ? "Moderate AI Patterns"
      : "Low / Human Grounded";

  // Calculate Originality Index
  const overlapRatio = totalSentences > 0 ? similarityMatches.length / totalSentences : 0;
  const originalityScore = Number(Math.max(0.65, Math.min(0.99, 1 - overlapRatio * 0.4)).toFixed(3));
  const originalityLevel =
    originalityScore >= 0.90
      ? "High Originality (Safe)"
      : originalityScore >= 0.80
      ? "Moderate Academic Overlap"
      : "Elevated Similarity Risk";

  onProgress?.(100, "Audit complete!");

  return {
    overallAiProbability: overallProb,
    aiRiskLevel,
    originalityScore,
    originalityLevel,
    totalSentencesScanned: totalSentences,
    flaggedSentencesCount: highlights.length,
    averageLatencyMs: avgLatency,
    modelUsed: currentVariant.name,
    qualityScores,
    acceptProb,
    disclosures,
    highlights,
    similarityMatches,
    chunks,
    fullText,
    scannedAt: new Date().toISOString(),
  };
}
