import retractionDb from "./data/retraction_watch_compact.json";

/**
 * Retraction Watch Database & Crossref Verification Gate (P0 §2.2 / Claims Integrity)
 *
 * Dataset Provenance:
 * - Source: Official Crossref / Retraction Watch Database
 * - Version: 2026-09-16
 * - Scope: 61,000+ verified retractions, 3,300+ expressions of concern, 61,000+ notice DOIs.
 * - Refresh Cadence: Rebuilt from Crossref GitLab open dataset repository.
 *
 * Provides deterministic on-device local detection for all published retractions.
 */
export interface RetractionCheckResult {
  isRetracted: boolean;
  isExpressionOfConcern: boolean;
  isRetractionNotice?: boolean;
  reason?: string;
  source?: "retraction_watch" | "title_marker" | "curated";
}

// Curated benchmark retracted papers catalog (verified primary sources with formal notices)
export const KNOWN_RETRACTED_DOIS: Record<string, string> = {
  // Wakefield MMR autism paper (The Lancet, 1998) - Retracted Feb 2010
  "10.1016/s0140-6736(97)11096-0": "Retracted: Completely falsified data regarding MMR vaccine and autism.",
  // Surgisphere COVID-19 Hydroxychloroquine paper (The Lancet, 2020) - Retracted June 2020
  "10.1016/s0140-6736(20)31180-6": "Retracted: Authors unable to conduct independent audit of Surgisphere database.",
  // Surgisphere COVID-19 cardiovascular paper (NEJM, 2020) - Retracted June 2020
  "10.1056/nejmoa2007621": "Retracted: Database veracity could not be validated.",
  // STAP cell pluripotency (Obokata et al., Nature, 2014) - Retracted July 2014
  "10.1038/nature12968": "Retracted: Critical errors and fabricated image data in STAP cell pluripotency study.",
  // Room-temperature superconductivity CSH claim (Snider, Dias et al., Nature, 2020) - Retracted Sep 2022
  "10.1038/s41586-020-2801-z": "Retracted: Irregularities in background subtraction methods.",
  // Disputed microplastics in fish larvae (Lönnstedt & Eklöv, Science, 2016) - Retracted May 2017
  "10.1126/science.aad8828": "Retracted: Suspected data fabrication and missing raw files.",
  // Substance dependence association (Gelernter et al., PNAS, 2009) - Retracted Nov 2013
  "10.1073/pnas.0908521106": "Retracted: Irreproducible genotyping in PKNOX2 substance dependence association study.",
  // Hwang Woo-suk patient-specific embryonic stem cells (Science, 2004) - Retracted Jan 2006
  "10.1126/science.1094515": "Retracted: Fabricated stem cell colonies and somatic cell nuclear transfer claims.",
  // Hwang Woo-suk patient-specific stem cell lines (Science, 2005) - Retracted Jan 2006
  "10.1126/science.1112286": "Retracted: Fabricated data and fraudulent DNA fingerprinting records.",
  // Macchiarini engineered synthetic trachea (The Lancet, 2011) - Retracted July 2018
  "10.1016/s0140-6736(11)60715-4": "Retracted: Falsified clinical outcomes in tissue-engineered trachea transplant.",
  "10.1016/s0140-6736(11)61715-7": "Retracted: Falsified clinical outcomes in tissue-engineered trachea transplant.",
  // Schön condensed-matter field-effect superconductivity (Science, 2000) - Retracted Nov 2002
  "10.1126/science.288.5475.2338": "Retracted: Fabricated measurements and identical noise traces across distinct experiments.",
  // Smeesters color and consumer choice (Science, 2011) - Retracted Sep 2012
  "10.1126/science.1202867": "Retracted: Statistically impossible data distributions consistent with fabrication.",
  // Sanna social priming and cleanliness (JESP, 2011) - Retracted June 2012
  "10.1016/j.jesp.2011.02.008": "Retracted: Irreproducible and manipulated experimental data.",
};

// High-performance in-memory sets initialized once at module load
const RETRACTED_DOIS_SET = new Set<string>((retractionDb.retractedDois || []).map((d: string) => d.toLowerCase()));
const EOC_DOIS_SET = new Set<string>((retractionDb.eocDois || []).map((d: string) => d.toLowerCase()));
const NOTICE_DOIS_SET = new Set<string>((retractionDb.noticeDois || []).map((d: string) => d.toLowerCase()));
const REASON_CATALOG: string[] = retractionDb.reasonCatalog || [];
const DOI_REASONS: Record<string, number> = (retractionDb.doiReasons as Record<string, number>) || {};

// Retraction Shield Index for on-device, offline retraction detection
let retractionShieldIndex: Record<string, { title?: string; reason?: string }> | null = null;
let isShieldLoading = false;

/**
 * Loads the bundled on-device Retraction Shield index (18MB dictionary)
 */
export async function loadRetractionShieldIndex(): Promise<Record<string, { title?: string; reason?: string }> | null> {
  if (retractionShieldIndex) return retractionShieldIndex;
  if (isShieldLoading) return null;
  isShieldLoading = true;
  try {
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const p = path.join(process.cwd(), "public", "models", "laya", "retraction_shield_index.json");
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, "utf-8");
          retractionShieldIndex = JSON.parse(raw);
          return retractionShieldIndex;
        }
      } catch {}
    }
    if (typeof fetch !== "undefined") {
      const res = await fetch("/models/laya/retraction_shield_index.json");
      if (res.ok) {
        retractionShieldIndex = await res.json();
        return retractionShieldIndex;
      }
    }
  } catch (err) {
    console.debug("Failed to load Laya Retraction Shield index:", err);
  } finally {
    isShieldLoading = false;
  }
  return retractionShieldIndex;
}

export function isRetractionShieldLoaded(): boolean {
  return retractionShieldIndex !== null;
}

export function getRetractionShieldEntry(doi: string): { title?: string; reason?: string } | null {
  if (!doi) return null;
  const cleanDoi = doi.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/[.,;)\]]+$/, "");
  return retractionShieldIndex?.[cleanDoi] || null;
}

export function checkRetractionStatus(doi?: string, textOrTitle?: string): RetractionCheckResult {
  if (doi) {
    const cleanDoi = doi
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .replace(/[.,;)\]]+$/, "");

    // 1. Check curated primary sources
    if (KNOWN_RETRACTED_DOIS[cleanDoi]) {
      return {
        isRetracted: true,
        isExpressionOfConcern: false,
        reason: KNOWN_RETRACTED_DOIS[cleanDoi],
        source: "curated",
      };
    }

    // 2. Check full Retraction Watch database for retracted paper DOIs
    if (RETRACTED_DOIS_SET.has(cleanDoi)) {
      const reasonIdx = DOI_REASONS[cleanDoi];
      const specificReason = typeof reasonIdx === "number" && REASON_CATALOG[reasonIdx]
        ? `Retracted: ${REASON_CATALOG[reasonIdx]}`
        : "Retracted: Formally retracted according to the Retraction Watch Database.";

      return {
        isRetracted: true,
        isExpressionOfConcern: false,
        reason: specificReason,
        source: "retraction_watch",
      };
    }

    // 2b. Check on-device Laya Retraction Shield Index
    if (retractionShieldIndex && retractionShieldIndex[cleanDoi]) {
      const entry = retractionShieldIndex[cleanDoi];
      const specificReason = entry.reason
        ? `Retracted: ${entry.reason.replace(/;$/, "").replace(/;/g, "; ")}`
        : "Retracted: Formally flagged in Laya Retraction Shield Database.";

      return {
        isRetracted: true,
        isExpressionOfConcern: false,
        reason: specificReason,
        source: "retraction_watch",
      };
    }

    // 3. Check for Expression of Concern
    if (EOC_DOIS_SET.has(cleanDoi)) {
      const reasonIdx = DOI_REASONS[cleanDoi];
      const specificReason = typeof reasonIdx === "number" && REASON_CATALOG[reasonIdx]
        ? `Expression of Concern: ${REASON_CATALOG[reasonIdx]}`
        : "Subject to an editorial Expression of Concern.";

      return {
        isRetracted: false,
        isExpressionOfConcern: true,
        reason: specificReason,
        source: "retraction_watch",
      };
    }

    // 4. Check if the cited DOI is itself a Retraction Notice (G2)
    if (NOTICE_DOIS_SET.has(cleanDoi)) {
      return {
        isRetracted: false,
        isExpressionOfConcern: false,
        isRetractionNotice: true,
        reason: "Reference is a formal retraction notice, not a retracted research paper.",
        source: "retraction_watch",
      };
    }
  }

  if (textOrTitle) {
    // Scope textual-marker scan strictly to the title portion of reference string (REQ-CIT-03)
    let titleToScan = textOrTitle;
    const quoteMatch = textOrTitle.match(/["“]([^"”]+)["”]/);
    if (quoteMatch) {
      titleToScan = quoteMatch[1];
    } else {
      const parts = textOrTitle.split(/\.\s+/);
      if (parts.length >= 2) {
        // Author. Title. Journal / Year
        titleToScan = parts[1];
      }
    }

    const lower = titleToScan.toLowerCase();
    if (
      lower.includes("[retracted]") ||
      lower.includes("(retracted)") ||
      /^retracted\b/i.test(lower) ||
      lower.includes("retraction notice:") ||
      lower.includes("retraction of:")
    ) {
      return {
        isRetracted: true,
        isExpressionOfConcern: false,
        reason: "Reference title explicitly contains retraction notice or marker.",
        source: "title_marker",
      };
    }

    // Only flag Expression of Concern if present in the article title, not in a journal name/note
    if (
      lower.includes("expression of concern") &&
      !lower.includes("journal of") &&
      !lower.includes("annual review")
    ) {
      return {
        isRetracted: false,
        isExpressionOfConcern: true,
        reason: "Subject to an editorial Expression of Concern.",
        source: "title_marker",
      };
    }
  }

  return {
    isRetracted: false,
    isExpressionOfConcern: false,
  };
}
