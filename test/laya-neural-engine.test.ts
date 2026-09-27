import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LAYA_MODEL_VARIANTS,
  getSelectedLayaModelVariant,
  setSelectedLayaModelVariant,
} from "../src/lib/laya/laya-model-registry";
import {
  loadTokenizerVocab,
  encodeTextWithVocab,
} from "../src/lib/laya/laya-tokenizer";
import { chunkManuscriptText } from "../src/lib/laya/text-chunker";
import { invokeDecision } from "../src/lib/laya/laya-ipc";
import { scanManuscriptForAiAndDisclosures } from "../src/lib/laya/ai-detection-service";
import { isNoulResult, isChoiceResult } from "../src/lib/laya/laya-engine-types";

describe("Laya Model Registry & Selection", () => {
  it("provides both INT8 and FP32 model variants", () => {
    assert.equal(LAYA_MODEL_VARIANTS.length, 2);
    const int8 = LAYA_MODEL_VARIANTS.find((v) => v.id === "laya-system1-int8");
    const fp32 = LAYA_MODEL_VARIANTS.find((v) => v.id === "laya-system1-fp32");

    assert.ok(int8, "INT8 variant must exist");
    assert.ok(fp32, "FP32 variant must exist");
    assert.equal(int8?.filename, "laya_v3_int8.onnx");
    assert.equal(fp32?.filename, "laya_v3_fp32.onnx");
    assert.equal(int8?.size, "22.0 MB");
    assert.equal(fp32?.size, "86.4 MB");
  });

  it("allows switching between INT8 and FP32 models", () => {
    setSelectedLayaModelVariant("laya-system1-fp32");
    assert.equal(getSelectedLayaModelVariant().id, "laya-system1-fp32");

    setSelectedLayaModelVariant("laya-system1-int8");
    assert.equal(getSelectedLayaModelVariant().id, "laya-system1-int8");
  });
});

describe("Laya Neural Tokenizer", () => {
  it("loads vocabulary and encodes text into input_ids and attention_mask", async () => {
    const vocab = await loadTokenizerVocab();
    assert.ok(vocab, "Vocab should load");
    assert.equal(typeof vocab["[CLS]"], "number");
    assert.equal(typeof vocab["[SEP]"], "number");

    const sample = "Deep residual learning for healthcare diagnostics.";
    const encoded = encodeTextWithVocab(sample, vocab, 128);

    assert.ok(encoded.tokensCount > 0, "Tokens count must be positive");
    assert.equal(encoded.input_ids.length, encoded.tokensCount);
    assert.equal(encoded.attention_mask.length, encoded.tokensCount);
    assert.equal(encoded.input_ids[0], BigInt(vocab["[CLS]"]));
    assert.equal(encoded.attention_mask[0], 1n);
  });
});

describe("Manuscript Text Chunker", () => {
  it("splits text into paragraphs and sentences with character offsets", () => {
    const text = `In this rapidly evolving digital landscape, it is of paramount importance to delve into the rich tapestry of innovations.

Ethics Statement:
This study was approved by the Oxford University Hospitals Institutional Review Board.`;

    const chunks = chunkManuscriptText(text);
    assert.equal(chunks.length, 2);
    assert.ok(chunks[0].sentences.length >= 1);
    assert.ok(chunks[1].sentences.length >= 1);

    const firstSentence = chunks[0].sentences[0];
    assert.equal(typeof firstSentence.startOffset, "number");
    assert.equal(typeof firstSentence.endOffset, "number");
    assert.ok(firstSentence.endOffset > firstSentence.startOffset);
  });
});

describe("Laya Decision Engine & IPC", () => {
  it("evaluates Noul question on AI filler text vs empirical text", async () => {
    const aiText = "In this rapidly evolving digital landscape, it is of paramount importance to delve into the rich tapestry of deep learning.";
    const aiPayload = {
      state: aiText,
      questions: {
        is_ai_filler: {
          type: "noul" as const,
          instructions: "Does this text rely heavily on AI-generated filler words?",
        },
      },
    };

    const resAi = await invokeDecision(aiPayload);
    const noulAi = resAi.is_ai_filler;
    assert.ok(isNoulResult(noulAi));
    assert.ok(noulAi.probability >= 0.50, `Expected AI probability >= 0.50, got ${noulAi.probability}`);

    const empiricalText = "We analyzed 1,420 clinical trials (95% CI: [1.12, 1.48], p < 0.001) using a randomized double-blind protocol.";
    const empPayload = {
      state: empiricalText,
      questions: {
        is_ai_filler: {
          type: "noul" as const,
          instructions: "Does this text rely heavily on AI-generated filler words?",
        },
      },
    };

    const resEmp = await invokeDecision(empPayload);
    const noulEmp = resEmp.is_ai_filler;
    assert.ok(isNoulResult(noulEmp));
    assert.ok(noulEmp.probability < 0.35, `Expected empirical probability < 0.35, got ${noulEmp.probability}`);
  });

  it("evaluates Choice question on administrative disclosures", async () => {
    const ethicsText = "Ethics Statement: This clinical study was approved by the Oxford University Hospitals Institutional Review Board (IRB-2023-8891).";
    const choicePayload = {
      state: ethicsText,
      questions: {
        section_type: {
          type: "choice" as const,
          instructions: "Identify administrative purpose.",
          criteria: {
            Conflict_Of_Interest: "Conflict declarations.",
            Data_Availability: "Where data is found.",
            Funding_Statement: "Grant support.",
            Ethics_Statement: "IRB approval.",
            None: "General text.",
          },
        },
      },
    };

    const res = await invokeDecision(choicePayload);
    const choiceRes = res.section_type;
    assert.ok(isChoiceResult(choiceRes));
    assert.equal(choiceRes.selection, "Ethics_Statement");
    assert.ok(choiceRes.confidence >= 0.60);
  });
});

describe("AI Detection & Disclosures Full Service", () => {
  it("generates a comprehensive report with highlights and disclosures", async () => {
    const text = `In this rapidly evolving digital landscape, it is of paramount importance to delve into the rich tapestry of innovations.

We analyzed 1,420 clinical trials (95% CI: [1.12, 1.48], p < 0.001) across 4 medical centers.

Ethics Statement:
This study was approved by the Institutional Review Board (Protocol #IRB-2023-8891).

Data Availability:
Datasets and analysis scripts are publicly accessible on Zenodo under DOI: 10.5281/zenodo.8492019.

Funding:
This work was supported by Grant #HL149201 from the National Institutes of Health.

Conflict of Interest:
The authors declare no competing financial interests.`;

    const report = await scanManuscriptForAiAndDisclosures(text);

    assert.ok(report, "Report should be generated");
    assert.ok(report.totalSentencesScanned > 0);
    assert.ok(report.highlights.length > 0, "Should highlight AI filler phrasing");
    assert.equal(report.disclosures.Ethics_Statement.status, "verified");
    assert.equal(report.disclosures.Data_Availability.status, "verified");
    assert.equal(report.disclosures.Funding_Statement.status, "verified");
    assert.equal(report.disclosures.Conflict_Of_Interest.status, "verified");
  });
});
