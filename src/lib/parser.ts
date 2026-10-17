import JSZip from "jszip";
import * as mammoth from "mammoth";
import { ParsedManuscript, DocumentClassification, DocumentCategory, SectionProvenance } from "./types";
import { extractReferencesFromText } from "./utils";
import { extractRepositoryLinks } from "./artifact-auditor";

/**
 * Robust DOCX text extraction: uses mammoth first, then JSZip DOMParser / XML fallback.
 */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  // 1. Try mammoth (specialized DOCX parser)
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    if (result && result.value && result.value.trim().length > 20) {
      return result.value.trim();
    }
  } catch (e) {
    console.warn("mammoth extraction failed, falling back to JSZip:", e);
  }

  // 2. Try JSZip to read word/document.xml directly
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docFile = zip.file("word/document.xml");
    if (docFile) {
      const xml = await docFile.async("text");

      // Parse XML using DOMParser if available in browser/Tauri
      if (typeof DOMParser !== "undefined") {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        const paragraphs = xmlDoc.getElementsByTagName("w:p");
        const lines: string[] = [];
        for (let i = 0; i < paragraphs.length; i++) {
          const p = paragraphs[i];
          const tTags = p.getElementsByTagName("w:t");
          let line = "";
          for (let j = 0; j < tTags.length; j++) {
            line += tTags[j].textContent || "";
          }
          if (line.trim()) {
            lines.push(line.trim());
          }
        }
        if (lines.length > 0) {
          return lines.join("\n\n");
        }
      }

      // Regex fallback for XML tags
      const pMatches = xml.match(/<w:p(?:\s+[^>]*?)?>([\s\S]*?)<\/w:p>/g);
      if (pMatches && pMatches.length > 0) {
        const lines = pMatches
          .map((p) => {
            const tMatches = p.match(/<w:t(?:\s+[^>]*?)?>([\s\S]*?)<\/w:t>/g);
            if (!tMatches) return "";
            return tMatches.map((t) => t.replace(/<[^>]+>/g, "")).join("");
          })
          .filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          return lines.join("\n\n");
        }
      }
    }
  } catch (e) {
    console.warn("JSZip docx extraction failed:", e);
  }

  throw new Error(
    "Unable to extract text from DOCX file. Please ensure the document is a valid Microsoft Word .docx file."
  );
}

/**
 * Robust PDF text extraction using unpdf and stream fallbacks.
 */
async function extractPdfTextFromBuffer(buffer: ArrayBuffer): Promise<string> {
  // 1. Try unpdf via dynamic import (code-splits 1.6MB pdfjs into on-demand chunk)
  try {
    const { extractText } = await import("unpdf");
    const { text } = await extractText(new Uint8Array(buffer));
    const fullText = Array.isArray(text) ? text.join("\n\n") : text;
    if (fullText && fullText.trim().length > 20) {
      return fullText.trim();
    }
  } catch (e) {
    console.warn("unpdf text extraction failed, trying stream fallback:", e);
  }

  // 2. Stream tokens fallback
  try {
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(buffer);
    const tjMatches = raw.match(/\(([^)]{2,})\)\s*(?:Tj|'|")/g);
    if (tjMatches && tjMatches.length > 5) {
      const chunks = tjMatches.map((m) =>
        m.replace(/^\(/, "").replace(/\)\s*(?:Tj|'|")$/, "")
      );
      return chunks.join(" ").replace(/\s{2,}/g, " ").trim();
    }
  } catch (e) {
    console.warn("PDF stream fallback failed:", e);
  }

  throw new Error(
    "Unable to extract text from PDF. The PDF may be image-only (scanned) or password-protected."
  );
}

/**
 * Extracts printable text from a File (.txt, .md, .docx, .pdf) in browser/Tauri.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  // 1. Plain text / Markdown
  if (
    ext === "txt" ||
    ext === "md" ||
    ext === "markdown" ||
    ext === "csv" ||
    ext === "json"
  ) {
    return await file.text();
  }

  const buffer = await file.arrayBuffer();

  // 2. DOCX Extraction
  if (ext === "docx") {
    return await extractDocxText(buffer);
  }

  // 3. PDF Extraction
  if (ext === "pdf") {
    return await extractPdfTextFromBuffer(buffer);
  }

  // 4. Fallback: inspect raw bytes for magic signatures
  const rawBytes = new Uint8Array(buffer.slice(0, 8));
  // ZIP / DOCX magic signature: PK\x03\x04
  if (rawBytes[0] === 0x50 && rawBytes[1] === 0x4b && rawBytes[2] === 0x03 && rawBytes[3] === 0x04) {
    return await extractDocxText(buffer);
  }
  // PDF magic signature: %PDF
  if (rawBytes[0] === 0x25 && rawBytes[1] === 0x50 && rawBytes[2] === 0x44 && rawBytes[3] === 0x46) {
    return await extractPdfTextFromBuffer(buffer);
  }

  return await file.text();
}


export function classifyDocument(rawText: string, filename?: string): DocumentClassification {
  const clean = (rawText || "").trim();
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  const lower = clean.toLowerCase();
  const ext = filename ? filename.split('.').pop()?.toLowerCase() : '';

  // =========================================================================
  // 1. Source Code / Software Script Detection
  // Evaluated first so code with short lines is not confused with unstructured lists
  // =========================================================================
  const codeExtensions = ['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'sh', 'bash', 'sql'];
  const isCodeFileExt = codeExtensions.includes(ext || '');

  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const codeLines = lines.filter(l => 
    /^(?:import\s+[\w\.\,\s\{\}\*]+|from\s+\w+\s+import|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|def\s+\w+\(|function\s+\w*\(|public\s+class\s+\w+|class\s+\w+[\s\w\(\)]*[:\{]|#include\s+<|package\s+[\w\.]+;|console\.log\(|return\b|if\s*[\(\w]|}\s*else|\/\*|\*\/|\/\/|#\s+|self\.\w+\s*=)/.test(l)
  );
  const codeRatio = lines.length > 0 ? codeLines.length / lines.length : 0;
  const isCode = isCodeFileExt || (codeRatio > 0.35 && lines.length > 5);

  if (isCode) {
    return {
      category: 'source_code',
      categoryLabel: 'Source Code / Software Script',
      isAcademicManuscript: false,
      confidence: 0.95,
      detectedFeatures: [
        'Programming language syntax and structure detected',
        'Functions, classes, or package declarations identified',
        'Absence of empirical scholarly IMRaD sections'
      ],
      salutation: 'Hello Developer / Software Engineer',
      advisoryMessage: 'We detected that this file is source code or a software script rather than an academic research manuscript. While computational code is critical for reproducibility, ManuView is calibrated for scientific peer review of empirical and theoretical manuscripts (research hypotheses, experimental design, causal inferences, and reference integrity).',
      customGuidance: 'If you are preparing a computational methods paper or software article for a journal (e.g., Nature Methods, Bioinformatics, JOSS), please provide the full manuscript draft including Abstract, Methodology, Benchmarking, and Literature Citations alongside your code.'
    };
  }

  // =========================================================================
  // 2. Resume / Curriculum Vitae
  // Evaluated BEFORE academic papers so academic CVs (which list publications and universities)
  // are never misclassified as journal manuscripts!
  // =========================================================================
  // =========================================================================
  // 2. Resume / Curriculum Vitae (Strict Priority Gate)
  // Evaluated BEFORE academic papers so academic CVs (which list publications and universities)
  // are NEVER misclassified as journal manuscripts, even if they contain references!
  // =========================================================================
  const hasCvTitle = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:curriculum\s+vitae|curriculum\s+vitæ|(?:my\s+)?resume)\s*(?:$|[:\n\r|])/i.test(clean.slice(0, 1000));
  const hasCvContactBlock = /(?:phone\s*:|\bcell\s*:|\bmobile\s*:|linkedin\.com\/in\/|\bgpa\s*:\s*\d)/i.test(clean.slice(0, 1500));
  
  const cvSectionPatterns = [
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:work\s+experience|professional\s+experience|employment\s+history|career\s+history)\b/i,
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:education\s*(?::|\n)|academic\s+background|academic\s+qualifications|degrees?\s+held)\b/i,
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:technical\s+skills|skills\s*&?\s*expertise|core\s+competencies|skills\s+summary|proficiencies)\b/i,
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:teaching\s+experience|courses\s+taught)\b/i,
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:honors\s*(?:&|and)\s*awards|fellowships\s*(?:&|and)\s*grants)\s*[:\n\r]/i,
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:certifications|licenses\s*(?:&|and)\s*certifications)\b/i,
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:references\s+available\s+upon\s+request|references\s*(?::|\n|\r)\s*(?:available|upon|on\s+request))\b/i,
  ];
  const cvSectionMatches = cvSectionPatterns.filter(p => p.test(clean)).length;
  const isExplicitResumeFilename = Boolean(filename && /(?:^|[_\-.])(?:resume|curriculum[_\s\-]*vitae)(?:$|[_\-.])/i.test(filename));
  // In AI and imaging papers, "CV" in filename frequently denotes Computer Vision (e.g. EWaste_CV_Benchmark)
  const isCvAcronymInFilename = Boolean(filename && /(?:^|[_\-.])cv(?:$|[_\-.])/i.test(filename));
  const isComputerVisionContext = /computer\s+vision|object\s+detection|benchmark|rt-detr|yolo|faster\s+r-cnn|deep\s+learning/i.test(clean);

  // Preliminary scholarly architecture detection to avoid falsely classifying academic papers as CVs
  const prelimHasAbstract = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:Abstract|Summary)\s*[:\n\r]/i.test(clean) || /^\s*(?:#{1,3}\s*)?Abstract\b/im.test(clean);
  const prelimHasMethods = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Methods|Materials and Methods|Methodology|Proposed (?:Method|Approach|Framework)|Experimental (?:Setup|Design))\b/i.test(clean);
  const prelimHasResults = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Results|Findings|Evaluation|Numerical Analysis)\b/i.test(clean);
  const hasScholarlyIMRaD = (prelimHasAbstract && (prelimHasMethods || prelimHasResults)) || (prelimHasMethods && prelimHasResults);

  const isResume =
    (hasCvTitle && (cvSectionMatches >= 1 || hasCvContactBlock || isExplicitResumeFilename)) ||
    (isExplicitResumeFilename && (cvSectionMatches >= 1 || hasCvContactBlock)) ||
    (!hasScholarlyIMRaD && (
      (cvSectionMatches >= 3) ||
      (cvSectionMatches >= 2 && hasCvContactBlock) ||
      (isCvAcronymInFilename && !isComputerVisionContext && (cvSectionMatches >= 1 || hasCvContactBlock))
    ));

  if (isResume) {
    return {
      category: 'resume_cv',
      categoryLabel: 'Curriculum Vitae / Resume',
      isAcademicManuscript: false,
      confidence: 0.96,
      detectedFeatures: [
        'Curriculum Vitae or Resume section headings identified',
        'Professional experience, education, or skill listings detected',
        'Contact details or biographical profile structure'
      ],
      salutation: 'Hello Candidate / Academic Professional',
      advisoryMessage: 'We detected that this document is a Curriculum Vitae or professional resume. Standard journal peer-review metrics (such as experimental controls, sample size justification, and desk-rejection hazards) do not apply to professional qualification records.',
      customGuidance: 'To evaluate scientific research readiness, please submit an empirical manuscript, preprint draft, or grant research narrative.'
    };
  }

  // =========================================================================
  // 3. Grant / Research Project Proposal
  // =========================================================================
  const grantProposalRegex = /(?:specific\s+aims|broader\s+impacts|intellectual\s+merit|project\s+narrative|budget\s+justification|principal\s+investigator|co-pi\b|nih\s+grant|nsf\s+proposal|funding\s+opportunity)/i;
  if (grantProposalRegex.test(clean) && !lower.includes('journal') && !lower.includes('peer review')) {
    return {
      category: 'grant_proposal',
      categoryLabel: 'Grant / Project Proposal',
      isAcademicManuscript: false,
      confidence: 0.88,
      detectedFeatures: [
        'Grant funding proposal markers detected (e.g. Specific Aims / Project Narrative)',
        'Investigator role or funding agency terminology present'
      ],
      salutation: 'Hello Principal Investigator / Project Lead',
      advisoryMessage: 'We detected that this document is structured as a grant funding application or research project proposal rather than a completed journal manuscript. Grant evaluations emphasize project feasibility and institutional resources rather than journal publication scope.',
      customGuidance: 'Focus your review on whether Specific Aims are clearly independent, feasibility is supported by preliminary data, and potential pitfalls are accompanied by robust mitigation strategies.'
    };
  }

  // =========================================================================
  // 4. Technical Documentation / Whitepaper / Product Requirements
  // =========================================================================
  const techDocRegex = /(?:api\s+reference|endpoints?\s*:|installation\s+guide|getting\s+started|sdk\s+reference|architecture\s+overview|prerequisites\s*:|quickstart|product\s+requirements|\bprd\b|feature\s+spec|system\s+design|acceptance\s+criteria|user\s+stories|sprint\s+backlog)/i;
  const isTechDocByFilename = Boolean(filename && /(?:^|[_\-.])(?:prd|spec|specs|requirements|roadmap|architecture)(?:$|[_\-.])/i.test(filename));
  const hasRealScholarlyReferences = /(?:references|bibliography)\s*[:\n\r][\s\S]{0,120}(?:doi:\s*10\.|\b(?:19|20)\d{2}\b|\[\d+\])/i.test(clean);

  if ((techDocRegex.test(clean) || isTechDocByFilename) && !hasRealScholarlyReferences) {
    return {
      category: 'technical_doc',
      categoryLabel: 'Technical Documentation / Whitepaper',
      isAcademicManuscript: false,
      confidence: 0.88,
      detectedFeatures: [
        'Technical documentation or software specification headings found',
        'Instructional or API reference structure'
      ],
      salutation: 'Hello Technical Author / Documentation Lead',
      advisoryMessage: 'We detected technical documentation or product specifications. While technically rigorous, documentation differs from peer-reviewed scientific literature where hypotheses, statistical power, and academic literature citations are systematically audited.',
      customGuidance: 'If this technical work introduces a novel algorithm or system architecture for academic submission, structure it with empirical baselines, related work citations, and ablation studies for venues like IEEE, ACM, or NeurIPS.'
    };
  }

  // =========================================================================
  // 5. Evaluation / Peer-Review Diagnostic Report
  // Catches exported evaluation reports, referee comments, or diagnostic suites
  // (which quote from papers and thus have academic terms, but are NOT manuscripts)
  // =========================================================================
  const evalReportRegex = /(?:manuview\s+diagnostic\s+suite|peer-review\s+calibrated\s+pre-submission\s+evaluation|overall\s+acceptance\s+potential\s+score|simulated\s+peer-review\s+panel|editorial\s+synthesis\s+&\s+triage\s+assessment|diagnostic\s+scoring\s+dimensions|priority\s+action\s+items|manuview\s+academic\s+diagnostic\s+report|(?:^|\n)\s*(?:referee\s+report|peer\s+review\s+report|evaluator\s+comments)\b)/i;
  if (evalReportRegex.test(clean)) {
    return {
      category: 'business_or_admin',
      categoryLabel: 'Peer-Review Evaluation / Diagnostic Report',
      isAcademicManuscript: false,
      confidence: 0.98,
      detectedFeatures: [
        'Peer-review diagnostic evaluation structure detected (e.g. simulated referees, editorial triage, readiness scores)',
        'Evaluative feedback format rather than original research manuscript architecture',
        'Meta-assessment containing critiques and action items'
      ],
      salutation: 'Notice to Submitter (Peer-Review Evaluation / Diagnostic Report)',
      advisoryMessage: 'We detected that this file is an evaluation or peer-review diagnostic report (such as an exported ManuView report, referee comments, or editorial triage assessment) rather than an original academic manuscript draft. ManuView is designed to evaluate original manuscripts, preprints, and research drafts.',
      customGuidance: 'Please upload your original manuscript file (.pdf, .docx, .tex) containing Title, Abstract, Introduction, Methods, and Results instead of an evaluation or review report.'
    };
  }

  // =========================================================================
  // 6. Business or Administrative Document
  // =========================================================================
  const businessAdminRegex = /(?:invoice\s*#|bill\s+to\s*:|total\s+due\s*:|statement\s+of\s+work|\bnda\b|non-disclosure\s+agreement|purchase\s+order|meeting\s+minutes|payment\s+terms|balance\s+sheet)/i;
  if (businessAdminRegex.test(clean) && !hasRealScholarlyReferences) {
    return {
      category: 'business_or_admin',
      categoryLabel: 'Administrative / Business Document',
      isAcademicManuscript: false,
      confidence: 0.92,
      detectedFeatures: [
        'Administrative, commercial, or legal formatting detected',
        'Absence of scholarly hypotheses and empirical data'
      ],
      salutation: 'Notice to Submitter (Administrative / Business Document)',
      advisoryMessage: 'We detected that this document is an administrative, commercial, or operational document (such as an invoice, contract, or internal memo). ManuView is designed specifically to analyze scientific preprints and journal research papers.',
      customGuidance: 'Please upload an academic research draft (empirical paper, review article, or clinical study) to use our peer-review diagnostic features.'
    };
  }

  // =========================================================================
  // 6. Very short, fragmented, or list-dominated text (Shopping lists, To-Do, Notes)
  // MUST strictly only apply to short/fragmented inputs (wordCount < 150)
  // and MUST NEVER trigger on documents with academic sections.
  // =========================================================================
  const rawLines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const isShortOrFragment = wordCount < 60;
  
  const shoppingListKeywords = [
    'buy', 'milk', 'eggs', 'bread', 'apples', 'groceries', 'supermarket',
    'todo', 'to-do', 'shopping', 'ingredient', 'ingredients', 'recipe',
    'chicken', 'potatoes', 'cheese', 'bananas', 'screws'
  ];
  const matchedShopping = shoppingListKeywords.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(clean)).length;

  const isBulletOrNumbered = (line: string) => /^[-*•–—\d+\.)\]]/.test(line);
  const bulletLines = rawLines.filter(isBulletOrNumbered);
  const shortLines = rawLines.filter(l => l.split(/\s+/).length <= 7);
  const isListDominated = rawLines.length >= 4 && (
    bulletLines.length / rawLines.length > 0.55 || 
    shortLines.length / rawLines.length > 0.70
  );

  const hasExplicitDoi = /(?:doi:\s*10\.\d{4,9}\/|https?:\/\/doi\.org\/10\.\d{4,9}\/)/i.test(clean);
  const hasAcademicStructureBasic = /(?:^|\n)\s*(?:abstract|materials\s+and\s+methods|methodology|introduction|results|references)\b/i.test(clean);

  // An unstructured or shopping list classification ONLY applies if:
  // 1. The document is truly short/fragmented (wordCount < 150)
  // 2. AND it lacks basic academic sections (no Abstract, Introduction, Methods, Results, or References)
  // 3. AND it matches shopping patterns, list domination, or extreme shortness without empirical data.
  if (wordCount < 150 && !hasAcademicStructureBasic && !hasExplicitDoi) {
    if (matchedShopping >= 2 || isListDominated || (isShortOrFragment && !/(?:p\s*[<=]\s*0\.\d+|doi:)/i.test(clean))) {
      return {
        category: 'random_unstructured',
        categoryLabel: 'Unstructured / Random Text',
        isAcademicManuscript: false,
        confidence: 0.96,
        detectedFeatures: [
          isListDominated ? 'Bulleted / itemized list structure detected' : `Word count is very low (${wordCount} words)`,
          'No scholarly structure (Title, Abstract, Methods, Results, or References)',
          'Informal or fragmented phrasing'
        ],
        salutation: 'Attention: Unstructured or Non-Academic Text Detected',
        advisoryMessage: 'The submitted content consists of unstructured text, shopping/to-do lists, casual notes, or brief fragments rather than a scholarly manuscript. Academic peer review requires a coherent research narrative: a title, research context (abstract/introduction), formal methodology, empirical findings, and references.',
        customGuidance: "To see how ManuView evaluates a genuine research paper, click 'Load Sample Preprint' above or upload a complete .docx or .pdf manuscript with Title, Abstract, Methods, and References."
      };
    }
  }

  // =========================================================================
  // 7. ACADEMIC MANUSCRIPT DETECTION (Primary Scholarly Check)
  // Evaluates whether this document possesses authentic scholarly architecture:
  // - Empirical & Clinical Science
  // - Theoretical & Mathematical / Operations Research Formulations
  // - Computational & Machine Learning Articles
  // - Systematic Reviews & Meta-Analyses
  // =========================================================================

  const hasIntro = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Introduction|Background|Literature Review)\b/i.test(clean);
  const hasMethodsOrModel = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Methods|Materials and Methods|Methodology|Model Development|Mathematical Formulation|Theoretical Framework|System Model|Problem Formulation|Assumptions|Solution Procedure|Algorithm \d+|Proposed (?:Method|Approach|Framework|System|Architecture|Model)|Experimental (?:Setup|Design)|Experiments)\b/i.test(clean);
  const hasResultsOrNumerical = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Results|Findings|Numerical Example|Numerical Analysis|Numerical Results|Simulation Results|Computational Experiments|Sensitivity Analysis|Case Study|Evaluation|Performance Evaluation|Experimental Results|Empirical Results)\b/i.test(clean);
  const hasDiscussionOrImplications = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Discussion|Practical Implications|Managerial Insights)\b/i.test(clean);
  const hasConclusion = /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Conclusion|Conclusions|Concluding Remarks|Summary and Outlook)\b/i.test(clean);
  
  const hasRealReferences = 
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:References|Bibliography|Works Cited|Literature Cited)\s*[:\n\r]/i.test(clean) &&
    (/(?:\[\d+\]|\d+\.\s+[A-Z]|doi:\s*10\.|\b(?:19|20)\d{2}\b)/i.test(clean));

  const hasDoiInText = /DOI:\s*10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i.test(clean);
  const hasFormalCitations = /(?:\n\s*(?:\[\d+\]|\d+\.)\s+[A-Z][a-z]+,\s*[A-Z])/i.test(clean) ||
                            /(?:\([A-Z][a-z]+(?:\s+et\s+al\.)?,\s*(?:19|20)\d{2}\))/i.test(clean);

  const hasCitationStructure = hasRealReferences || hasDoiInText || hasFormalCitations;

  const hasAbstract =
    /(?:^|\n)\s*(?:#{1,3}\s*)?Abstract\s*[:\n\r]/i.test(clean) ||
    /^\s*(?:#{1,3}\s*)?Abstract\b/im.test(clean) ||
    (/(?:^|\n)\s*(?:#{1,3}\s*)?(?:Summary|Executive Summary)\s*[:\n\r]/i.test(clean) && (hasCitationStructure || hasMethodsOrModel || hasResultsOrNumerical));

  // Scholarly metadata (publishers, peer review status, university affiliation, editorial tracking)
  const hasScholarlyMeta = /(?:Department of\s+|Faculty of\s+|University\b|Institute of\s+|doi:\s*10\.\d+|Received:\s*\d|Accepted:\s*\d|©\s*The Author|Keywords\s*[:\s]|Index Terms|Corresponding author|Springer|Elsevier|IEEE|Nature|Wiley)/i.test(clean);

  // Domain scientific & quantitative vocabulary across disciplines
  const hasAcademicTerms = /(?:statistically\s+significant|p\s*[<=]\s*0\.\d+|confidence\s+interval|optimization|equilibrium|formulation|theorem|lemma|proposition|sensitivity analysis|simulation|algorithm|objective function|decision variable|supply chain|carbon tax|cap-and-trade|hypothesis|empirical|regression|in\s+vivo|in\s+vitro|assay|cohort|organoid)/i.test(clean);

  let academicScore = 0;
  if (hasAbstract) academicScore += 3;
  if (hasCitationStructure) academicScore += 3;
  if (hasIntro) academicScore += 2;
  if (hasMethodsOrModel) academicScore += 2;
  if (hasResultsOrNumerical) academicScore += 2;
  if (hasDiscussionOrImplications) academicScore += 1;
  if (hasConclusion) academicScore += 1;
  if (hasScholarlyMeta) academicScore += 2;
  if (hasAcademicTerms) academicScore += 1;

  // Real academic paper requires substantive body length and verified scholarly architecture (restored from main)
  const hasSubstantiveBody = wordCount >= 35;
  const isAcademic = hasSubstantiveBody && (
    (academicScore >= 5) || 
    (hasAbstract && (hasCitationStructure || hasIntro || hasMethodsOrModel || hasResultsOrNumerical)) ||
    (hasCitationStructure && (hasIntro || hasMethodsOrModel || hasResultsOrNumerical)) ||
    (hasExplicitDoi && (hasScholarlyMeta || hasCitationStructure || academicScore >= 3))
  );

  if (isAcademic) {
    const detected: string[] = [];
    if (hasAbstract) detected.push('Abstract / Summary section identified');
    if (hasMethodsOrModel) detected.push('Methodology / Theoretical Model formulation identified');
    if (hasResultsOrNumerical) detected.push('Results / Numerical experiments identified');
    if (hasCitationStructure) detected.push('Scholarly Bibliography / Reference citations detected');
    if (hasScholarlyMeta) detected.push('Academic metadata & institutional affiliation detected');
    if (hasAcademicTerms) detected.push('Domain scientific & quantitative terminology verified');

    let subType = 'Empirical / Theoretical Research Article';
    // 1. Computer Vision, Deep Learning, & Benchmark Studies (prioritized before domain keywords like e-waste)
    // Guard: require a genuinely CV-specific signal, or at least two independent
    // computational signals — a single loose term such as "deep learning" in a
    // cited reference title must not hijack the discipline.
    const cvSpecific = /rt-detr|yolov\d+|faster\s+r-cnn|object\s+detection|bounding\s+box|mean\s+average\s+precision|\bmap@|segmentation\s+model|vision\s+transformer|convolutional\s+neural/i.test(clean);
    const cvSignalCount = [
      /rt-detr|yolov\d+|faster\s+r-cnn/i,
      /object\s+detection|bounding\s+box|mean\s+average\s+precision|\bmap@/i,
      /segmentation\s+model|vision\s+transformer|convolutional\s+neural/i,
      /transformer\s+architecture|representation\s+learning/i,
      /deep\s+learning|benchmark\s+dataset/i,
    ].filter((re) => re.test(clean)).length;
    const isComputerVisionOrDL = cvSpecific || cvSignalCount >= 2;
    
    if (isComputerVisionOrDL) {
      subType = 'Computational & Algorithmic Research (Computer Vision & Machine Learning)';
    } else if (/systematic review|meta-analysis|prisma\b|scoping review/i.test(clean)) {
      subType = 'Review / Synthesis Article';
    } else if (/protein\s+(purification|expression|crystallization|engineering)|affinity\s+tag|affinity\s+chromatography|mass\s+spectrometry|cryo-?em|recombinant\s+protein|site-?directed\s+mutagenesis|his6?-?(?:sumo|tag)|ulp1|\be\.?\s*coli\b|protein\s+structure/i.test(clean)) {
      subType = 'Protein Biochemistry / Structural Biology';
    } else if (/in vivo|in vitro|clinical trial|patient|cohort|assay|crispr|tumor|pathology|oncology/i.test(clean)) {
      subType = 'Empirical Laboratory / Clinical Study';
    } else if (/nonlinear optimization|inventory model|decision variable|kkt\b|convex optimization|karush-kuhn-tucker|eoq\b/i.test(clean)) {
      subType = 'Theoretical & Operations Research Formulation';
    } else if (/e-waste|weee|waste electrical|trade statistics|customs microdata|material flow|circular economy|carbon tax/i.test(clean)) {
      subType = 'Empirical Study in Environmental & Resource Economics';
    } else if (/neural network|deep learning|transformer|algorithm|representation learning/i.test(clean)) {
      subType = 'Computational & Algorithmic Research';
    } else if (/econometric|panel data|time series|gdp|growth intensity|macroeconomic/i.test(clean)) {
      subType = 'Empirical Economic & Statistical Investigation';
    }

    const langCheck = detectLanguageIntegrity(clean);
    if (!langCheck.isEnglish && langCheck.warning) {
      detected.unshift("Non-English text detected (reduced confidence for English-calibrated rubrics)");
    }

    const featuresSummary = detected.length > 0 ? detected.slice(0, 3).join(', ') : 'standard scholarly architecture';
    const langPrefix = (!langCheck.isEnglish && langCheck.warning) ? `NOTE: ${langCheck.warning}\n\n` : '';

    return {
      category: 'academic_manuscript',
      categoryLabel: `Academic Manuscript (${subType})`,
      isAcademicManuscript: true,
      confidence: !langCheck.isEnglish ? 0.70 : Math.min(0.85 + (academicScore * 0.02), 0.99),
      detectedFeatures: detected,
      salutation: 'Dear Author / Contributing Researcher',
      advisoryMessage: `${langPrefix}Your submission has been verified as an authentic ${subType}. Structural analysis confirmed ${featuresSummary}. ManuView has evaluated your work against calibrated peer-review rubrics across 6 core dimensions, screening for causal overclaims, empirical/statistical rigor, reference integrity, and journal desk-rejection hazards.`,
      customGuidance: 'Review the prioritized action items (Priority A desk-reject hazards and Priority B reviewer pushback) and consult the 5 simulated peer-reviewer personas before submitting to your target journal.'
    };
  }

  // =========================================================================
  // 8. General essay or creative writing fallback
  // =========================================================================
  return {
    category: 'general_or_creative',
    categoryLabel: 'General Essay / Non-Academic Prose',
    isAcademicManuscript: false,
    confidence: 0.75,
    detectedFeatures: [
      'Prose text in paragraph format',
      'Absence of formal empirical methods or scientific data tables',
      'Absence of peer-reviewed references or DOI citations'
    ],
    salutation: 'Hello Author / Writer',
    advisoryMessage: 'We detected a general essay, opinion piece, or informational text without empirical scientific methodology or peer-reviewed literature citations. ManuView is calibrated for scientific preprints and journal submissions.',
    customGuidance: 'If this is intended as an academic perspective or review article, ensure formal literature citations, scholarly framing, and structured theoretical or empirical analysis are incorporated.'
  };
}

const ENGLISH_STOPWORDS = new Set([
  "the", "of", "and", "in", "to", "with", "for", "as", "by", "on",
  "that", "is", "was", "are", "from", "at", "it", "this", "be", "an",
  "which", "we", "our", "were", "or", "have", "has", "not", "their",
  "can", "between", "these", "such", "using", "study", "used", "results",
  "data", "model", "analysis", "method", "methods", "paper", "based"
]);

/**
 * Detects English language dominance in text (§5.3).
 * Flags non-English manuscripts so authors are transparently notified that
 * deterministic audits (Statcheck, GRIM, IMRaD, hedging) require English.
 */
export function detectLanguageIntegrity(text: string): {
  isEnglish: boolean;
  stopwordRatio: number;
  nonLatinCharRatio: number;
  warning?: string;
} {
  const clean = (text || "").trim();
  // Non-Latin scripts (CJK, Cyrillic, Arabic, Devanagari, etc.)
  const nonLatinMatches = clean.match(/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0600-\u06FF\u0900-\u097F]/g);
  const nonLatinCharRatio = nonLatinMatches ? nonLatinMatches.length / Math.max(1, clean.length) : 0;

  if (nonLatinCharRatio >= 0.20 && clean.length >= 20) {
    return {
      isEnglish: false,
      stopwordRatio: 0,
      nonLatinCharRatio: Math.round(nonLatinCharRatio * 100) / 100,
      warning: "Non-English Text Detected: ManuView's deterministic rule engines (Statcheck, GRIM, IMRaD section detection, and hedging lexicons) are calibrated for English-language scholarly manuscripts. Diagnostic confidence is reduced for non-English submissions.",
    };
  }

  const tokens = clean.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 15) {
    return { isEnglish: true, stopwordRatio: 1.0, nonLatinCharRatio: 0 };
  }

  let englishStopwordCount = 0;
  for (const token of tokens) {
    const stripped = token.replace(/[^a-z]/g, "");
    if (ENGLISH_STOPWORDS.has(stripped)) {
      englishStopwordCount++;
    }
  }

  const stopwordRatio = englishStopwordCount / tokens.length;
  const isEnglish = stopwordRatio >= 0.07;
  const warning = !isEnglish
    ? "Non-English Text Detected: ManuView's deterministic rule engines (Statcheck, GRIM, IMRaD section detection, and hedging lexicons) are calibrated for English-language scholarly manuscripts. Diagnostic confidence is reduced for non-English submissions."
    : undefined;

  return {
    isEnglish,
    stopwordRatio: Math.round(stopwordRatio * 100) / 100,
    nonLatinCharRatio: Math.round(nonLatinCharRatio * 100) / 100,
    warning,
  };
}

/**
 * Detects PDF text extraction anomalies or degraded stream tokens (§5.2).
 */
export function detectPdfExtractionQuality(rawText: string): {
  isHighQuality: boolean;
  warning?: string;
} {
  const clean = (rawText || "").trim();
  const replacementCharCount = (clean.match(/[\uFFFD\u0000]/g) || []).length;
  if (replacementCharCount > 10) {
    return {
      isHighQuality: false,
      warning: "Low extraction confidence: document text contains fragmented glyphs or replacement characters. Ensure the PDF contains a selectable text layer rather than scanned raster images.",
    };
  }

  if (clean.length < 50) return { isHighQuality: true };

  const streamArtifacts = (clean.match(/\b(?:BT|ET|Tj|TJ|Do|rg|RG)\b/g) || []).length;
  const words = clean.split(/\s+/).filter(Boolean);
  const avgWordLength = words.length > 0 ? clean.length / words.length : 0;
  const artifactRatio = words.length > 0 ? streamArtifacts / words.length : 0;

  if (streamArtifacts > 25 || artifactRatio > 0.15 || avgWordLength > 40 || avgWordLength < 2) {
    return {
      isHighQuality: false,
      warning: "Low extraction confidence: document text contains fragmented glyphs, excessive replacement characters, or PDF stream artifacts. Ensure the PDF contains a selectable text layer rather than scanned raster images.",
    };
  }

  return { isHighQuality: true };
}

/**
 * Prompt-Injection & Hidden-Text Sanitization (P0-2)
 * Strips zero-width characters, invisible/hidden tags, and overt prompt injection directives
 * (e.g. white-on-white text instructions, system prompt overrides, ignore instructions).
 */
export function sanitizePromptInjectionAndHiddenContent(rawText: string): {
  sanitizedText: string;
  suspicionFlags: string[];
} {
  const suspicionFlags: string[] = [];

  // 1. Detect and strip zero-width characters & non-printable formatting artifacts
  let text = rawText.replace(/[\u200B\u200C\u200D\uFEFF\u202A-\u202E]/g, () => {
    if (!suspicionFlags.includes("Zero-width hidden unicode characters detected")) {
      suspicionFlags.push("Zero-width hidden unicode characters detected");
    }
    return "";
  });

  // 2. Detect hidden HTML/CSS attributes (e.g. color: #fff, font-size: 0, display: none)
  const hiddenStyleRegex = /<(?:span|p|div|font)[^>]*?(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|color\s*:\s*(?:#ffffff|#fff|white|rgba\([^)]*0\)))[^>]*>([\s\S]*?)<\/(?:span|p|div|font)>/gi;
  text = text.replace(hiddenStyleRegex, (_match, hiddenContent) => {
    suspicionFlags.push(`Hidden CSS text layer stripped: "${hiddenContent.trim().slice(0, 50)}..."`);
    return "";
  });

  // 2b. Detect and strip hidden HTML comment injection attempts
  const commentRegex = /<!--([\s\S]*?)-->/g;
  text = text.replace(commentRegex, (_match, commentContent) => {
    suspicionFlags.push(`Hidden HTML comment stripped: "${commentContent.trim().slice(0, 50)}..."`);
    return "";
  });

  // 3. Known prompt injection phrases in scholarly drafts
  const injectionPatterns: { pattern: RegExp; description: string }[] = [
    {
      pattern: /(?:give|assign|provide)\s+(?:a\s+)?positive\s+review\s+(?:only|unconditionally)/gi,
      description: "Directive to force positive review ('give positive review only')",
    },
    {
      pattern: /ignore\s+(?:all\s+)?previous\s+instructions/gi,
      description: "Instruction override directive ('ignore previous instructions')",
    },
    {
      pattern: /system\s+prompt\s+override|disregard\s+(?:the\s+)?(?:system|editorial)\s+(?:prompt|guidelines)/gi,
      description: "System prompt override attempt",
    },
    {
      pattern: /you\s+must\s+accept\s+this\s+paper|always\s+accept\s+this\s+submission/gi,
      description: "Forced acceptance instruction",
    },
    {
      pattern: /score\s+(?:this\s+paper|it)\s+(?:100|10\/10|5\/5|maximum)/gi,
      description: "Forced maximum score directive",
    },
    {
      pattern: /do\s+not\s+(?:find|report|criticize)\s+(?:any\s+)?flaws/gi,
      description: "Critique suppression directive",
    },
  ];

  for (const { pattern, description } of injectionPatterns) {
    if (pattern.test(text)) {
      suspicionFlags.push(description);
      text = text.replace(pattern, "[SANITIZED_INJECTION_DIRECTIVE]");
    }
  }

  return {
    sanitizedText: text,
    suspicionFlags,
  };
}

/**
 * Extracts presence of mandatory academic publishing declarations (P0-1, P0-8)
 */
export function extractMandatoryDeclarations(rawText: string): ParsedManuscript["mandatoryDeclarations"] {
  const ethicsRegex = /(?:ethics\s+approval|ethics\s+statement|institutional\s+review\s+board|\birb\b|declaration\s+of\s+helsinki|informed\s+consent|animal\s+welfare|iacuc\b|human\s+subjects\s+approval)[^\n]{5,200}/i;
  const ethicsMatch = rawText.match(ethicsRegex);

  const dataRegex = /(?:data\s+availability|code\s+availability|data\s+deposition|available\s+on\s+request|dryad|zenodo|figshare|github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)[^\n]{5,200}/i;
  const dataMatch = rawText.match(dataRegex);

  const coiRegex = /(?:competing\s+interests|conflict(?:s)?\s+of\s+interest|no\s+competing\s+interests|authors\s+declare\s+no\s+(?:competing|financial))[^\n]{5,200}/i;
  const coiMatch = rawText.match(coiRegex);

  const contribRegex = /(?:author(?:s['’]?)?\s+contributions?|credit\s+taxonomy|conceptualization|formal\s+analysis|investigation|writing\s*[-–]\s*original\s+draft)[^\n]{5,200}/i;
  const contribMatch = rawText.match(contribRegex);

  return {
    ethicsStatement: {
      present: Boolean(ethicsMatch),
      excerpt: ethicsMatch ? ethicsMatch[0].trim() : undefined,
    },
    dataAvailability: {
      present: Boolean(dataMatch),
      excerpt: dataMatch ? dataMatch[0].trim() : undefined,
    },
    competingInterests: {
      present: Boolean(coiMatch),
      excerpt: coiMatch ? coiMatch[0].trim() : undefined,
    },
    authorContributions: {
      present: Boolean(contribMatch),
      excerpt: contribMatch ? contribMatch[0].trim() : undefined,
    },
  };
}

export function parseManuscriptText(inputRawText: string, filename?: string): ParsedManuscript {
  // P0-2: Sanitize raw input against invisible text and prompt injection
  const { sanitizedText: rawText, suspicionFlags: injectionSuspicionFlags } =
    sanitizePromptInjectionAndHiddenContent(inputRawText);

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  // 1. Classify document type
  const classification = classifyDocument(rawText, filename);

  // 2. Detect Title (filters out journal banners, category tags, DOIs, and preprint watermarks)
  let title = "Untitled Document";
  const skipHeaderRegex = /^(?:biorxiv|medrxiv|arxiv|springer|nature|elsevier|ieee|cell|wiley|plos|frontiers|mdpi|iop|acm|sage|taylor|oxford|cambridge|opsearch|journal\b|international\s+journal|annals\b|proceedings\b|theoretical\s+article|original\s+(?:research|article)|research\s+article|review\s+article|regular\s+article|brief\s+report|case\s+report|short\s+communication|perspective|commentary|editorial|letter\s+to|check\s+for\s+updates|extended\s+author|published\s+online|received\s*:|accepted\s*:|revised\s*:|https?:|doi\s*:|page\s+\d+|vol\.\s*\d+|no\.\s*\d+|open\s+access|peer-reviewed|copyright|the\s+author\(s\)|all\s+rights\s+reserved|©)/i;

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const candidate = lines[i];
    if (skipHeaderRegex.test(candidate)) continue;
    if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(candidate) || /^\d+$/.test(candidate)) continue;
    if (candidate.length > 12) {
      // Check if line wraps onto the next line (common in two-line article titles)
      if (
        i + 1 < lines.length &&
        !skipHeaderRegex.test(lines[i + 1]) &&
        !/^(?:by\b|abstract\b|[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s*,\s*|\s*·|\s+and\s+)|\d+\b|keywords)/i.test(lines[i + 1]) &&
        lines[i + 1].length > 5 &&
        lines[i + 1].length < 85
      ) {
        title = `${candidate} ${lines[i + 1]}`;
      } else {
        title = candidate;
      }
      break;
    }
  }
  if (title === "Untitled Document" && lines.length > 0) {
    title = lines[0];
  }

  // 3. Detect Abstract
  let abstract = "";
  const abstractMatch = rawText.match(
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:Abstract|Summary|Structured Abstract)\s*[:\n\r]+([\s\S]*?)(?=(?:\n\s*(?:#{1,3}\s*)?(?:Keywords|Key\s*words|1[\.\s]|I[\.\s]|Introduction|Background)))/i
  );
  if (abstractMatch && abstractMatch[1] && abstractMatch[1].trim().length > 30) {
    abstract = abstractMatch[1].trim();
  } else {
    // Fallback: search for first 2-4 paragraphs after title
    const potentialAbstractLines = lines.slice(1, 8).filter(
      (l) => l.length > 40 && !skipHeaderRegex.test(l)
    );
    abstract = potentialAbstractLines.slice(0, 3).join("\n\n");
  }

  // 4. Robust Academic Section Extraction
  const sections: ParsedManuscript["sections"] = {};
  const sectionProvenance: SectionProvenance = {
    methodsInferred: false,
    resultsInferred: false,
    methodsMissing: false,
    resultsMissing: false,
    introductionInferred: false,
    discussionInferred: false,
  };

  const langCheck = detectLanguageIntegrity(rawText);
  if (!langCheck.isEnglish && langCheck.warning) {
    sectionProvenance.nonEnglishWarning = langCheck.warning;
  }
  const pdfQuality = detectPdfExtractionQuality(rawText);
  if (!pdfQuality.isHighQuality && pdfQuality.warning) {
    sectionProvenance.pdfExtractionWarning = pdfQuality.warning;
  }

  // Normalize text for segmenting
  const introRegex =
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Introduction|Background|Motivation|Literature Review)\s*[:\n\r]+([\s\S]*?)(?=(?:\n\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Methods|Materials and Methods|Methodology|Model|Theoretical Framework|System Model|Problem Formulation|Experimental Setup|2[\.\s]|II[\.\s])))/i;
  const methodsRegex =
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Methods|Materials and Methods|Methodology|Model Development|Mathematical Formulation|Theoretical Framework|System Model|System Architecture|Assumptions|Problem Formulation|Proposed Approach|Algorithm|Study Design|Empirical Strategy)\s*[:\n\r]+([\s\S]*?)(?=(?:\n\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Results|Findings|Numerical Example|Numerical Analysis|Numerical Results|Simulation Results|Computational Experiments|Sensitivity Analysis|Experimental Evaluation|Evaluation|Case Study|Discussion|Conclusion|3[\.\s]|III[\.\s]|7[\.\s]|8[\.\s])))/i;
  const resultsRegex =
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Results|Findings|Numerical Example|Numerical Analysis|Numerical Results|Simulation Results|Computational Experiments|Experimental Results|Performance Evaluation|Sensitivity Analysis|Case Study|Empirical Analysis)\s*[:\n\r]+([\s\S]*?)(?=(?:\n\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Discussion|Managerial Insights|Practical Implications|Limitations|Conclusion|Conclusions|4[\.\s]|IV[\.\s]|10[\.\s]|11[\.\s]|References)))/i;
  const discussionRegex =
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Discussion|Managerial Insights|Practical Implications|Limitations|Discussion and Conclusion)\s*[:\n\r]+([\s\S]*?)(?=(?:\n\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Conclusion|Conclusions|References|Bibliography|5[\.\s]|V[\.\s]|11[\.\s])|$))/i;
  const conclusionRegex =
    /(?:^|\n)\s*(?:#{1,3}\s*)?(?:\d+[\.\s]+|[IVX]+[\.\s]+)?(?:Conclusion|Conclusions|Concluding Remarks|Summary and Conclusions|Future Work)\s*[:\n\r]+([\s\S]*?)(?=(?:\n\s*(?:#{1,3}\s*)?(?:References|Bibliography|Acknowledgments|Appendix)|$))/i;

  const introMatch = rawText.match(introRegex);
  if (introMatch && introMatch[1]) {
    sections.introduction = introMatch[1].trim().slice(0, 15000);
  }

  const methodsMatch = rawText.match(methodsRegex);
  if (methodsMatch && methodsMatch[1]) {
    sections.methods = methodsMatch[1].trim().slice(0, 25000);
  }

  const resultsMatch = rawText.match(resultsRegex);
  if (resultsMatch && resultsMatch[1]) {
    sections.results = resultsMatch[1].trim().slice(0, 25000);
  }

  const discussionMatch = rawText.match(discussionRegex);
  if (discussionMatch && discussionMatch[1]) {
    sections.discussion = discussionMatch[1].trim().slice(0, 15000);
  }

  const conclusionMatch = rawText.match(conclusionRegex);
  if (conclusionMatch && conclusionMatch[1]) {
    sections.conclusion = conclusionMatch[1].trim().slice(0, 8000);
  }

  // Fallback intelligent structural segmenter if explicit headings are absent or missing
  // This guarantees that the LLM is NEVER starved of core methodology or results, but explicitly tags provenance!
  // ONLY run for confirmed academic manuscripts to avoid carving CVs/resumes/code into fake methods.
  if (classification.isAcademicManuscript && (!sections.methods || !sections.results)) {
    // Remove references block to isolate actual manuscript body
    const bodyText = rawText.replace(/(?:References|Bibliography)[\s\S]*$/i, "").trim();
    const bodyLen = bodyText.length;

    if (bodyLen > 1000) {
      if (!sections.introduction) {
        sections.introduction = bodyText.slice(0, Math.floor(bodyLen * 0.22)).slice(0, 15000);
        sectionProvenance.introductionInferred = true;
      }
      if (!sections.methods) {
        sections.methods = bodyText
          .slice(Math.floor(bodyLen * 0.20), Math.floor(bodyLen * 0.55))
          .slice(0, 25000);
        sectionProvenance.methodsInferred = true;
      }
      if (!sections.results) {
        sections.results = bodyText
          .slice(Math.floor(bodyLen * 0.50), Math.floor(bodyLen * 0.82))
          .slice(0, 25000);
        sectionProvenance.resultsInferred = true;
      }
      if (!sections.discussion) {
        sections.discussion = bodyText
          .slice(Math.floor(bodyLen * 0.80))
          .slice(0, 15000);
        sectionProvenance.discussionInferred = true;
      }
      sectionProvenance.structureNotDetected = true;
    }
  }

  if (!sections.methods) {
    sectionProvenance.methodsMissing = true;
  }
  if (!sections.results) {
    sectionProvenance.resultsMissing = true;
  }

  // 5. Extract Empirical Cues from Document
  const sampleSizeMatches = Array.from(
    rawText.matchAll(
      /(?:\b[nN]\s*=\s*\d+(?:,\d+)?|\bsample\s+size\s+(?:of\s+)?\d+|\bcohort\s+of\s+\d+|\b\d+\s+(?:patients|participants|subjects|respondents|samples|observations|firms|items))\b/gi
    )
  )
    .map((m) => m[0].trim())
    .slice(0, 8);

  const statMatches = Array.from(
    rawText.matchAll(
      /(?:p\s*[<>=]\s*0?\.\d+|\bt\s*=\s*-?\d+\.?\d*|\bF(?:\(\d+,\s*\d+\))?\s*=\s*\d+\.?\d*|95%\s*CI\s*[\[\(][^\]\)]+[\]\)]|\bR[²2]\s*=\s*0?\.\d+|AUC\s*=\s*0?\.\d+)/gi
    )
  )
    .map((m) => m[0].trim())
    .slice(0, 10);

  const eqMatches = Array.from(
    rawText.matchAll(
      /(?:\b(?:equation|eq\.)\s*\(?\d+\)?|[∑∫∂√αβγδεθλμστωΩ]|\bargmax\b|\bargmin\b|E\[[A-Z]\])/gi
    )
  )
    .map((m) => m[0].trim())
    .slice(0, 10);

  const repoMatches = Array.from(
    rawText.matchAll(
      /(?:github\.com\/[a-zA-Z0-9_\-\.\/]+|zenodo\.[0-9]+|huggingface\.co\/[a-zA-Z0-9_\-\.\/]+|kaggle\.com\/[a-zA-Z0-9_\-\.\/]+)/gi
    )
  )
    .map((m) => m[0].trim())
    .slice(0, 5);

  // Causal assertion cues
  const causalMatches = Array.from(
    rawText.matchAll(
      /(?:\b(?:proves?|proven|demonstrates? causality|directly causes?|is the driver of|dictates?|induces?|leads to direct)\b[^\.\n;]{5,80})/gi
    )
  )
    .map((m) => m[0].trim().replace(/\s+/g, " "))
    .slice(0, 6);

  // Reporting guideline cues
  const guidelineCues: string[] = [];
  if (/randomized|placebo|double-blind|clinical trial|control arm/i.test(rawText)) {
    guidelineCues.push("CONSORT (Randomized Trials)");
  }
  if (/cohort|cross-sectional|case-control|observational|customs|microdata|panel data/i.test(rawText)) {
    guidelineCues.push("STROBE (Observational / Cohort Studies)");
  }
  if (/systematic review|meta-analysis|search strategy|prisma/i.test(rawText)) {
    guidelineCues.push("PRISMA (Systematic Reviews & Meta-Analyses)");
  }
  if (/mice|murine|rats|in vivo|animal care|iacuc/i.test(rawText)) {
    guidelineCues.push("ARRIVE (Animal In Vivo Research)");
  }
  if (/optimization|replenishment|inventory model|karush-kuhn-tucker|kkt|convexity/i.test(rawText)) {
    guidelineCues.push("INFORMS / ORSI (Operations Research Standards)");
  }
  if (/arima|holt-winters|stationarity|cointegration|box-jenkins|heteroskedasticity/i.test(rawText)) {
    guidelineCues.push("Econometric Time-Series & Microdata Standards");
  }

  // Declared limitations cues
  const limitationMatches = Array.from(
    rawText.matchAll(
      /(?:(?:limitation of this (?:study|work|model)|a key caveat|subject to the limitation|data-scarce|unmeasured confounding)[^\.\n]{5,120})/gi
    )
  )
    .map((m) => m[0].trim().replace(/\s+/g, " "))
    .slice(0, 5);

  const empiricalCues = {
    sampleSizes: Array.from(new Set(sampleSizeMatches)),
    statisticalMetrics: Array.from(new Set(statMatches)),
    equations: Array.from(new Set(eqMatches)),
    dataRepositories: Array.from(new Set(repoMatches)),
    causalAssertions: Array.from(new Set(causalMatches)),
    detectedGuidelines: guidelineCues,
    declaredLimitations: Array.from(new Set(limitationMatches)),
  };

  // 6. Extract Authors if detectable
  const authors: string[] = [];
  if (lines.length > 1) {
    const authorLineCandidate = lines[1];
    if (
      authorLineCandidate.length > 3 &&
      authorLineCandidate.length < 160 &&
      !skipHeaderRegex.test(authorLineCandidate) &&
      !/(?:abstract|introduction|doi|keywords|http|university|institute|department)/i.test(authorLineCandidate)
    ) {
      const rawTokens = authorLineCandidate
        .replace(/\band\b/gi, ",")
        .replace(/&/g, ",")
        .split(/[,;]/);

      for (const token of rawTokens) {
        const cleaned = token
          .replace(/[0-9*†‡§]+/g, "")
          .replace(/\b(?:ph\.?d|m\.?d|dr|prof)\b/gi, "")
          .trim();
        if (cleaned.length >= 2 && cleaned.split(/\s+/).length <= 4) {
          authors.push(cleaned);
        }
      }
      if (authors.length === 0 && authorLineCandidate.length < 80) {
        authors.push(authorLineCandidate.trim());
      }
    }
  }

  // 7. Extract References
  const references = extractReferencesFromText(rawText);

  // 8. Word count
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  // 9. Mandatory Declarations (Ethics, Data, COI, Author Contributions)
  const mandatoryDeclarations = extractMandatoryDeclarations(rawText);

  // 10. Extracted Artifact Links (GitHub, Zenodo, OSF, Figshare, HuggingFace)
  const extractedArtifactLinks = extractRepositoryLinks(rawText);

  return {
    title,
    abstract,
    authors,
    wordCount,
    sections,
    sectionProvenance,
    rawText,
    references,
    classification,
    extractedArtifactLinks,
    empiricalCues,
    injectionSuspicionFlags,
    mandatoryDeclarations,
  };
}

