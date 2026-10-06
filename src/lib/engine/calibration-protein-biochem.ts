/**
 * Field calibration for protein biochemistry / structural biology (Phase 2).
 *
 * Encodes what a protein-biochemistry reviewer actually demands, as
 * structured data the domain-expert persona (Reviewer 2) can draw on when
 * the manuscript classifies into this field. This is the first field
 * calibration; others (e.g. cell biology, enzymology-adjacent methods)
 * follow the same shape.
 *
 * Gating: `isProteinBiochemistryDiscipline()` matches the free-form
 * `detectedDiscipline` string from scope triage (same substring approach
 * as `resolveDisciplineProfile`).
 */

export interface CalibrationDemand {
  /** Stable id, e.g. "purification-homogeneity". */
  id: string;
  /** One-line statement of what the reviewer demands to see. */
  demand: string;
  /** Concrete checks the reviewer performs against the manuscript. */
  checks: string[];
  /** Patterns that trigger a major critique. */
  redFlags: string[];
}

export interface OverclaimPattern {
  /** The overclaim phrasing, e.g. '"novel fold"'. */
  pattern: string;
  /** Why a reviewer rejects it as stated. */
  whyItFails: string;
  /** What the reviewer asks for instead. */
  whatToAsk: string;
}

export interface FieldCalibration {
  field: string;
  /** Discipline-string keywords that trigger this calibration. */
  disciplineKeywords: string[];
  demands: CalibrationDemand[];
  overclaimPatterns: OverclaimPattern[];
}

export const PROTEIN_BIOCHEM_CALIBRATION: FieldCalibration = {
  field: "Protein biochemistry / structural biology",
  disciplineKeywords: [
    "biochem",
    "protein",
    "structural biolog",
    "molecular biolog",
    "enzym",
    "biophys",
  ],
  demands: [
    {
      id: "purification-homogeneity",
      demand:
        "Homogeneity of the protein preparation must be demonstrated, not asserted.",
      checks: [
        "SDS-PAGE shown with molecular-weight markers; single dominant band at the expected mass (including tags).",
        "SEC elution profile shown; symmetric monodisperse peak, not just a stated purity percentage.",
        "Purity percentage, if claimed, is tied to a stated method (densitometry, SEC integration).",
      ],
      redFlags: [
        '"Purified to homogeneity" with no gel or chromatogram shown.',
        "Purity claimed from a Bradford/BCA assay alone (measures total protein, not homogeneity).",
        "Expected mass not reconciled with the construct sequence (tags, cleavage sites).",
      ],
    },
    {
      id: "oligomeric-state",
      demand:
        "Oligomeric-state claims require a shape-independent measurement.",
      checks: [
        "SEC-MALS, analytical ultracentrifugation, or native MS used for oligomeric assignment.",
        "If SEC alone is used, calibration standards and their masses are reported and the shape-dependence caveat is stated.",
      ],
      redFlags: [
        "Dimer/tetramer assigned from SEC elution volume alone with no standards.",
        "Oligomeric state from a crystal asymmetric unit presented as the solution state.",
      ],
    },
    {
      id: "activity-assay-controls",
      demand:
        "Activity claims require proper negative controls run side by side.",
      checks: [
        "Wild-type / empty-vector control included where a variant or mutant is characterized.",
        "Tag-only (or cleaved-tag) control where a tagged construct is assayed.",
        "Substrate-minus / buffer-only background measured, not assumed zero.",
        "Activity shown over a concentration or time course, not a single endpoint.",
      ],
      redFlags: [
        "Mutant activity reported with no wild-type comparator in the same experiment.",
        '"Tag does not affect activity" asserted without a tag-free or tag-only control.',
        "Single-concentration endpoint presented as quantitative comparison.",
      ],
    },
    {
      id: "tag-removal-validation",
      demand:
        "When a cleavable tag is used, cleavage must be demonstrated and the tag-free protein characterized.",
      checks: [
        "Cleavage efficiency shown (e.g. SDS-PAGE pre/post cleavage).",
        "Key biophysical or activity measurements repeated on, or explicitly attributed to, the tag-free protein.",
        "Residual tag / protease removal (e.g. reverse IMAC) described.",
      ],
      redFlags: [
        "Cleavable tag left on for all measurements with no cleavage data.",
        "Metal-binding or oligomerization assay run on a His-tagged protein with no tag-free control.",
      ],
    },
    {
      id: "buffer-condition-matching",
      demand:
        "Biophysical measurements compared against each other must be run under comparable conditions.",
      checks: [
        "Buffer composition, pH, ionic strength, and temperature stated for DSF, ITC, SPR, CD, and activity assays.",
        "Cross-method comparisons (e.g. Tm vs activity optimum) use matched conditions or the mismatch is discussed.",
      ],
      redFlags: [
        "Tm from DSF at pH 8.0 compared directly to activity measured at pH 6.5.",
        "ITC in phosphate buffer vs SPR in HEPES treated as directly comparable without comment.",
        "Temperature of the assay omitted entirely.",
      ],
    },
    {
      id: "concentration-determination",
      demand:
        "Protein concentration method must be stated; kinetic parameters depend on it.",
      checks: [
        "A280 with a stated extinction coefficient (sequence-based, tag-corrected) preferred.",
        "If Bradford/BCA: standard protein named (BSA vs IgG changes the answer).",
        "kcat / specific activity traceable to a stated [E] determination method.",
      ],
      redFlags: [
        "kcat reported with no stated enzyme-concentration method.",
        "Bradford vs BSA standard used for a His-tagged, Trp-poor protein with no caveat.",
      ],
    },
  ],
  overclaimPatterns: [
    {
      pattern: '"Novel fold" / "unprecedented structure"',
      whyItFails:
        "Fold novelty is a database-search result, not an impression from looking at the structure.",
      whatToAsk:
        "Require a DALI or PDBeFold search with Z-scores / RMSD against the closest homologs reported.",
    },
    {
      pattern: "Affinity (Kd) from a single method",
      whyItFails:
        "One method's Kd embeds that method's artifacts (labeling, immobilization, avidity).",
      whatToAsk:
        "Require an orthogonal method (e.g. SPR + ITC, or fluorescence + MST) with agreement within error.",
    },
    {
      pattern: '"Physiological relevance" from in vitro data',
      whyItFails:
        "In vitro concentrations, crowding, and binding partners rarely match the cell.",
      whatToAsk:
        "Ask for the concentration regime to be compared to estimated cellular concentrations, or hedge the claim.",
    },
    {
      pattern: "Specific activity compared across papers",
      whyItFails:
        "Assay conditions (pH, temperature, substrate, [E] method) differ between labs.",
      whatToAsk:
        "Require side-by-side measurement under identical conditions, or a table normalizing the conditions.",
    },
    {
      pattern: '"First demonstration / first report"',
      whyItFails:
        "Priority claims require a literature search, not an absence of memory.",
      whatToAsk:
        "Ask what databases and terms were searched; treat as unverified until shown.",
    },
  ],
};

/**
 * Gate: does the detected discipline string fall under protein
 * biochemistry / structural biology? Substring match, case-insensitive,
 * mirroring `resolveDisciplineProfile`'s approach to free-form input.
 */
export function isProteinBiochemistryDiscipline(
  discipline: string | undefined | null
): boolean {
  if (!discipline) return false;
  const lower = discipline.toLowerCase();
  return PROTEIN_BIOCHEM_CALIBRATION.disciplineKeywords.some((kw) =>
    lower.includes(kw)
  );
}

/**
 * Render the calibration as a prompt block addressed to Reviewer 2
 * (Target Domain Specialist). Persona voice/role unchanged; this only
 * adds the field-specific demands the reviewer is expected to enforce.
 */
export function renderProteinBiochemCalibrationBlock(): string {
  const cal = PROTEIN_BIOCHEM_CALIBRATION;
  const demands = cal.demands
    .map(
      (d) =>
        `- ${d.demand}\n` +
        `  Check: ${d.checks.join(" ")}\n` +
        `  Red flags: ${d.redFlags.join(" ")}`
    )
    .join("\n");
  const overclaims = cal.overclaimPatterns
    .map(
      (o) => `- ${o.pattern}: ${o.whyItFails} Ask: ${o.whatToAsk}`
    )
    .join("\n");
  return (
    `FIELD CALIBRATION -- ${cal.field}. The following applies to Reviewer 2 ` +
    `"Target Domain Specialist" (persona: "domain_expert") only; other personas ` +
    `keep their rubrics unchanged. Enforce these demands as major critiques ` +
    `where the manuscript falls short; do not invent missing data, demand it.\n\n` +
    `DEMANDS:\n${demands}\n\n` +
    `OVERCLAIM PATTERNS (challenge on sight):\n${overclaims}`
  );
}
