/**
 * Laya Decision Engine Types & Strict Schema Contract
 * Follows Convai Innovations' Laya System One Decision Model Architecture
 */

export type LayaQuestionType = "choice" | "noul" | "score";

export interface LayaChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

export interface LayaNoulQuestion {
  type: "noul";
  instructions: string;
}

export interface LayaScoreQuestion {
  type: "score";
  instructions: string;
  range?: [number, number];
}

export type LayaQuestion =
  | LayaChoiceQuestion
  | LayaNoulQuestion
  | LayaScoreQuestion;

export interface LayaPayload {
  state: string;
  questions: Record<string, LayaQuestion>;
}

export interface LayaChoiceResult {
  selection: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface LayaNoulResult {
  probability: number;
}

export interface LayaScoreResult {
  score: number;
  confidence: number;
}

export type LayaQuestionResult =
  | LayaChoiceResult
  | LayaNoulResult
  | LayaScoreResult;

export type LayaDecisionResponse = Record<string, LayaQuestionResult>;

// Type guards
export function isChoiceResult(res: LayaQuestionResult): res is LayaChoiceResult {
  return "selection" in res && "probabilities" in res;
}

export function isNoulResult(res: LayaQuestionResult): res is LayaNoulResult {
  return "probability" in res && !("selection" in res);
}

export function isScoreResult(res: LayaQuestionResult): res is LayaScoreResult {
  return "score" in res && !("selection" in res);
}
