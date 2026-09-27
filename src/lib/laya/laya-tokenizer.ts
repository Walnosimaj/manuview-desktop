/**
 * Laya Neural Tokenizer
 * Implements WordPiece tokenization using the model's vocabulary
 */

let cachedVocab: Record<string, number> | null = null;
let isLoadingVocab = false;

export async function loadTokenizerVocab(): Promise<Record<string, number>> {
  if (cachedVocab) return cachedVocab;

  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/models/laya/tokenizer.json");
      if (res.ok) {
        const data = await res.json();
        if (data.model?.vocab) {
          cachedVocab = data.model.vocab;
          return cachedVocab!;
        }
      }
    } catch (e) {
      console.warn("Could not fetch /models/laya/tokenizer.json via web:", e);
    }
  }

  // Node.js / Server / Test environment fallback
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const possiblePaths = [
        path.join(process.cwd(), "public", "models", "laya", "tokenizer.json"),
        path.join(process.cwd(), "dist", "models", "laya", "tokenizer.json"),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const data = JSON.parse(fs.readFileSync(p, "utf8"));
          if (data.model?.vocab) {
            cachedVocab = data.model.vocab;
            return cachedVocab!;
          }
        }
      }
    } catch {}
  }

  // Minimal fallback vocab if file is inaccessible
  return {
    "[PAD]": 0,
    "[UNK]": 100,
    "[CLS]": 101,
    "[SEP]": 102,
    "[MASK]": 103,
  };
}

export interface TokenizedInputs {
  input_ids: BigInt64Array;
  attention_mask: BigInt64Array;
  tokensCount: number;
}

/**
 * Tokenizes text into input_ids and attention_mask for ModernBERT/BERT ONNX models.
 */
export function encodeTextWithVocab(
  text: string,
  vocab: Record<string, number>,
  maxSeqLength = 256
): TokenizedInputs {
  const clean = (text || "").toLowerCase().trim();
  const words = clean.match(/[a-z0-9]+|[^\s\w]/g) || [];

  const tokens: bigint[] = [101n]; // [CLS]

  const unkId = BigInt(vocab["[UNK]"] ?? 100);

  for (const w of words) {
    if (vocab[w] !== undefined) {
      tokens.push(BigInt(vocab[w]));
    } else {
      let isBad = false;
      let start = 0;
      const subTokens: bigint[] = [];

      while (start < w.length) {
        let end = w.length;
        let curSub: bigint | null = null;
        while (start < end) {
          const sub = (start === 0 ? "" : "##") + w.substring(start, end);
          if (vocab[sub] !== undefined) {
            curSub = BigInt(vocab[sub]);
            break;
          }
          end--;
        }
        if (curSub === null) {
          isBad = true;
          break;
        }
        subTokens.push(curSub);
        start = end;
      }

      if (!isBad && subTokens.length > 0) {
        tokens.push(...subTokens);
      } else {
        tokens.push(unkId);
      }
    }

    if (tokens.length >= maxSeqLength - 1) {
      break;
    }
  }

  tokens.push(102n); // [SEP]

  const count = tokens.length;
  const input_ids = new BigInt64Array(count);
  const attention_mask = new BigInt64Array(count);

  for (let i = 0; i < count; i++) {
    input_ids[i] = tokens[i];
    attention_mask[i] = 1n;
  }

  return { input_ids, attention_mask, tokensCount: count };
}
