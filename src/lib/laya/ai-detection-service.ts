/**
 * AI-Detection & Pre-Submission Mandatory Requirements Service
 * Uses Laya's System One Decision Engine over IPC to detect AI-generated filler phrasing
 * and verify mandatory administrative disclosures (Ethics, Data Availability, Funding, COI).
 */

import { invokeDecision } from "./laya-ipc";
import { LayaPayload, isChoiceResult, isNoulResult } from "./laya-engine-types";
import { chunkManuscriptText, ManuscriptChunk, SentenceChunk } from "./text-chunker";
import { getSelectedLayaModelVariant } from "./laya-model-registry";

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
  totalSentencesScanned: number;
  flaggedSentencesCount: number;
  averageLatencyMs: number;
  modelUsed: string;
  disclosures: Record<DisclosureType, DisclosureItem>;
  highlights: AiHighlightSpan[];
  chunks: ManuscriptChunk[];
  fullText: string;
  scannedAt: string;
}

const MANDATORY_DISCLOSURES: Array<{
  key: DisclosureType;
  title: string;
  description: string;
}> = [
  {
    key: "Conflict_Of_Interest",
    title: "Conflict of Interest",
    description: "Declaration of financial or personal relationships.",
  },
  {
    key: "Data_Availability",
    title: "Data Availability",
    description: "Information regarding where the research data can be found.",
  },
  {
    key: "Funding_Statement",
    title: "Funding & Financial Support",
    description: "Declarations of grant support or institutional funding.",
  },
  {
    key: "Ethics_Statement",
    title: "Ethics & IRB Approval",
    description: "Ethics committee clearance and human/animal subject compliance.",
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
  let totalSentences = 0;
  let totalAiProbSum = 0;
  let evaluationCount = 0;

  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = Math.round(((i + 1) / chunks.length) * 100);
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

    // 2. Evaluate individual sentences within chunk for AI filler phrasing (Noul primitive)
    for (const sentence of chunk.sentences) {
      totalSentences++;

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

  const elapsedMs = Date.now() - startTime;
  const avgLatency = evaluationCount > 0 ? Math.max(1, Math.round(elapsedMs / evaluationCount)) : 2;
  const overallProb = totalSentences > 0 ? Number((totalAiProbSum / totalSentences).toFixed(4)) : 0;

  const aiRiskLevel =
    overallProb >= 0.40
      ? "High AI Density"
      : overallProb >= 0.18
      ? "Moderate AI Patterns"
      : "Low / Human Grounded";

  return {
    overallAiProbability: overallProb,
    aiRiskLevel,
    totalSentencesScanned: totalSentences,
    flaggedSentencesCount: highlights.length,
    averageLatencyMs: avgLatency,
    modelUsed: currentVariant.name,
    disclosures,
    highlights,
    chunks,
    fullText,
    scannedAt: new Date().toISOString(),
  };
}
