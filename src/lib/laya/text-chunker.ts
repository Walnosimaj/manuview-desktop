/**
 * Text Chunking Utility for Manuscript Evaluation
 * Preserves exact character offsets and structural context for real-time highlighting
 */

export interface SentenceChunk {
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface ManuscriptChunk {
  id: string;
  paragraphIndex: number;
  text: string;
  startOffset: number;
  endOffset: number;
  sectionContext: string;
  sectionHeader?: string;
  sentences: SentenceChunk[];
}

const SECTION_HEADER_PATTERNS: Array<{ section: string; regex: RegExp }> = [
  { section: "Abstract", regex: /^(?:abstract|summary)\b/i },
  { section: "Introduction", regex: /^(?:1\.?\s*)?(?:introduction|background)\b/i },
  { section: "Methods", regex: /^(?:2\.?\s*)?(?:materials?\s+and\s+methods?|methodology|methods?|experimental\s+procedures?)\b/i },
  { section: "Results", regex: /^(?:3\.?\s*)?(?:results?|findings?)\b/i },
  { section: "Discussion", regex: /^(?:4\.?\s*)?(?:discussion|conclusions?)\b/i },
  { section: "Conflict of Interest", regex: /^(?:competing\s+interests?|conflicts?\s+of\s+interest|declaration\s+of\s+competing\s+interests?)\b/i },
  { section: "Data Availability", regex: /^(?:data\s+availability(?:\s+statement)?|availability\s+of\s+data\s+and\s+materials?)\b/i },
  { section: "Funding", regex: /^(?:funding(?:\s+information)?|financial\s+support|grant\s+support|acknowledgements?)\b/i },
  { section: "Ethics", regex: /^(?:ethical\s+approval|ethics\s+statement|institutional\s+review\s+board|irb\s+approval)\b/i },
  { section: "References", regex: /^(?:references|bibliography|works\s+cited)\b/i },
];

/**
 * Splits text into individual sentences while preserving exact character offsets within the text.
 */
export function splitSentencesWithOffsets(text: string, baseOffset = 0): SentenceChunk[] {
  const sentences: SentenceChunk[] = [];
  const sentenceRegex = /([^\.!\?\n]+[\.!\?]+(?:\s+|$)|[^\.!\?\n]+(?:\n+|$))/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const rawSentence = match[0];
    const trimmed = rawSentence.trim();
    if (!trimmed) continue;

    const leadingSpace = rawSentence.indexOf(trimmed);
    const start = baseOffset + match.index + leadingSpace;
    const end = start + trimmed.length;

    sentences.push({
      index: idx++,
      text: trimmed,
      startOffset: start,
      endOffset: end,
    });
  }

  if (sentences.length === 0 && text.trim().length > 0) {
    const trimmed = text.trim();
    const leadingSpace = text.indexOf(trimmed);
    sentences.push({
      index: 0,
      text: trimmed,
      startOffset: baseOffset + leadingSpace,
      endOffset: baseOffset + leadingSpace + trimmed.length,
    });
  }

  return sentences;
}

/**
 * Chunks a full manuscript text into paragraph-level blocks with exact offsets and inferred section headers.
 */
export function chunkManuscriptText(fullText: string): ManuscriptChunk[] {
  if (!fullText || fullText.trim().length === 0) {
    return [];
  }

  const chunks: ManuscriptChunk[] = [];
  const rawParagraphs = fullText.split(/\n\s*\n+/);

  let currentOffset = 0;
  let currentSection = "General";
  let paragraphIndex = 0;

  for (let i = 0; i < rawParagraphs.length; i++) {
    const rawP = rawParagraphs[i];
    const trimmed = rawP.trim();

    if (!trimmed) {
      currentOffset = fullText.indexOf(rawP, currentOffset) + rawP.length;
      continue;
    }

    const actualStart = fullText.indexOf(rawP, currentOffset);
    const leadingSpaces = rawP.indexOf(trimmed);
    const pStart = actualStart + leadingSpaces;
    const pEnd = pStart + trimmed.length;

    // Check if this paragraph acts as a section header
    const firstLine = trimmed.split("\n")[0].trim();
    const cleanHeader = firstLine.replace(/^#+\s*/, "").replace(/^\d+\.?\s*/, "").trim();
    if (firstLine.length < 90) {
      for (const pattern of SECTION_HEADER_PATTERNS) {
        if (pattern.regex.test(firstLine) || pattern.regex.test(cleanHeader)) {
          currentSection = pattern.section;
          break;
        }
      }
    }

    const sentences = splitSentencesWithOffsets(trimmed, pStart);

    chunks.push({
      id: `chunk_${paragraphIndex}`,
      paragraphIndex,
      text: trimmed,
      startOffset: pStart,
      endOffset: pEnd,
      sectionContext: currentSection,
      sectionHeader: currentSection,
      sentences,
    });

    paragraphIndex++;
    currentOffset = actualStart + rawP.length;
  }

  return chunks;
}

export const chunkManuscriptIntoSemanticUnits = chunkManuscriptText;
export const chunkIntoSentences = splitSentencesWithOffsets;
