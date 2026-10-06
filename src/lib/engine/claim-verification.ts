/**
 * Claim verification via the Conductor sidecar (Phase 1 integration).
 *
 * ManuView's reviewer personas argue from parametric memory: their
 * evidence anchors quote the manuscript itself. This stage closes that
 * gap by routing manuscript prose through Conductor's evidence-grounded
 * pipeline -- atomic claim extraction, per-claim literature retrieval
 * (Semantic Scholar + OpenAlex), verifier verdicts with reasons, and a
 * deterministically rendered evidence brief -- and mapping the verdicts
 * onto ManuView PriorityIssues.
 *
 * Execution: the Conductor Python CLI runs as a sidecar. In the Tauri
 * production build this uses @tauri-apps/plugin-shell with a bundled
 * `conductor` sidecar binary (see tauri.conf.json `bundle.externalBin`).
 * In dev/test (Node), it falls back to child_process with a configurable
 * command. Either way the contract is:
 *
 *   conductor verify-manuscript <manuscript.md> --out <brief.json>
 *
 * and the brief JSON schema below.
 */

import type { PriorityIssue } from "../types";

// ---------------------------------------------------------------------------
// Conductor brief JSON schema (mirrors Orchestrator.verify_manuscript)
// ---------------------------------------------------------------------------

export type ConductorVerdict =
  | "confirmed"
  | "corrected"
  | "unverified"
  | "refuted"
  | "unknown"
  | "";

export interface ConductorClaimVerdict {
  number: number;
  text: string;
  verdict: ConductorVerdict;
  verdict_detail: string;
  tier: string;
}

export interface ConductorKillEntry {
  number: number;
  text: string;
  detail: string;
}

export interface ConductorBrief {
  title: string;
  question: string;
  /** Deterministically rendered evidence brief (code, not LLM). */
  brief: string;
  verdict_counts: {
    confirmed: number;
    corrected: number;
    unverified: number;
    refuted: number;
  };
  claims: ConductorClaimVerdict[];
  /** Binding refutations: claims contradicted by retrieved literature. */
  kill_list: ConductorKillEntry[];
  evidence_packs: unknown[];
  verifier_reprompted: boolean;
  verifier_degenerate: boolean;
}

export interface ClaimVerificationOptions {
  /** Sidecar command, e.g. ["python3", "/path/to/conductor/cli.py"]. */
  conductorCommand?: string[];
  title?: string;
  timeoutMs?: number;
  verifierBatchSize?: number;
  extractorBackend?: string;
  verifierBackend?: string;
}

export interface ClaimVerificationResult {
  brief: ConductorBrief | null;
  priorityIssues: PriorityIssue[];
  /** Set when the sidecar could not run or produced no usable brief. */
  error?: string;
}

/** Compact summary attached to the FullReviewReport. */
export interface ClaimVerificationReport {
  briefAvailable: boolean;
  verdictCounts: ConductorBrief["verdict_counts"];
  killList: ConductorKillEntry[];
  issuesRaised: number;
  verifierReprompted: boolean;
  verifierDegenerate: boolean;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Sidecar invocation
// ---------------------------------------------------------------------------

function buildArgs(
  manuscriptPath: string,
  briefPath: string,
  opts: ClaimVerificationOptions
): string[] {
  const args = ["verify-manuscript", manuscriptPath, "--out", briefPath];
  if (opts.title) args.push("--title", opts.title);
  if (opts.verifierBatchSize) {
    args.push("--verifier-batch-size", String(opts.verifierBatchSize));
  }
  if (opts.extractorBackend) args.push("--extractor", opts.extractorBackend);
  if (opts.verifierBackend) args.push("--verifier", opts.verifierBackend);
  args.push("--delay", "2");
  return args;
}

async function runViaTauriShell(
  command: string[],
  manuscriptPath: string,
  briefPath: string,
  opts: ClaimVerificationOptions
): Promise<void> {
  const { Command } = await import("@tauri-apps/plugin-shell");
  const [bin, ...baseArgs] = command;
  const child = Command.create(bin, [
    ...baseArgs,
    ...buildArgs(manuscriptPath, briefPath, opts),
  ]);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const output = await Promise.race([
    child.execute(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("conductor sidecar timed out")), timeoutMs)
    ),
  ]);
  if (output.code !== 0) {
    throw new Error(
      `conductor sidecar exited with code ${output.code}: ${output.stderr.slice(0, 500)}`
    );
  }
}

async function runViaNodeChildProcess(
  command: string[],
  manuscriptPath: string,
  briefPath: string,
  opts: ClaimVerificationOptions
): Promise<void> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const [bin, ...baseArgs] = command;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    await execFileAsync(bin, [...baseArgs, ...buildArgs(manuscriptPath, briefPath, opts)], {
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e: unknown) {
    const err = e as { message?: string; stderr?: string };
    throw new Error(
      `conductor sidecar failed: ${(err.stderr || err.message || "unknown error").slice(0, 500)}`
    );
  }
}

/** Default sidecar command: `python3 -m conductor.cli` on PATH. */
export function defaultConductorCommand(): string[] {
  return ["python3", "-m", "conductor.cli"];
}

// ---------------------------------------------------------------------------
// Verdict -> PriorityIssue mapping
// ---------------------------------------------------------------------------

function issueForClaim(
  claim: ConductorClaimVerdict,
  index: number
): PriorityIssue | null {
  const base = {
    id: `iss-claim-verify-${claim.number}`,
    location: `Claim ${claim.number}`,
    source: "llm" as const,
  };
  const detail = claim.verdict_detail || "no reason recorded";
  switch (claim.verdict) {
    case "refuted":
      return {
        ...base,
        priority: "A",
        title: `Refuted claim: "${claim.text.slice(0, 80)}${claim.text.length > 80 ? "..." : ""}"`,
        category: "Causal Claims",
        description:
          `Independent literature verification contradicts this manuscript claim. ` +
          `Verdict detail: ${detail}`,
        evidenceAnchor: `claim-verifier: [V${claim.number}] REFUTED`,
        reviewerQuote:
          `Reviewer: "This claim is contradicted by the published literature (${detail}). ` +
          `It must be corrected or removed before the manuscript can proceed."`,
        actionableFix:
          `Address the refutation directly: either correct the claim to match the evidence ` +
          `(${detail}), provide counter-evidence the verifier missed, or delete the claim ` +
          `and any conclusions that depend on it.`,
        expectedEffort: "Moderate (1-2 days)",
      };
    case "corrected":
      return {
        ...base,
        priority: "A",
        title: `Inaccurate claim (correction available): "${claim.text.slice(0, 80)}${claim.text.length > 80 ? "..." : ""}"`,
        category: "Causal Claims",
        description:
          `Literature verification found this claim partially wrong. ` +
          `Verifier's correction: ${detail}`,
        evidenceAnchor: `claim-verifier: [V${claim.number}] CORRECTED`,
        reviewerQuote:
          `Reviewer: "The claim as stated is inaccurate. The literature supports a narrower ` +
          `version: ${detail}."`,
        actionableFix:
          `Replace the claim with the verifier's corrected wording, preserving any true ` +
          `part, and check downstream conclusions that cite it.`,
        expectedEffort: "Immediate (1-2 hours)",
      };
    case "unverified":
    case "unknown":
    case "":
      return {
        ...base,
        priority: "B",
        title: `Unverified claim: "${claim.text.slice(0, 80)}${claim.text.length > 80 ? "..." : ""}"`,
        category: "Citations",
        description:
          `No retrieved literature addresses this claim (${detail}). ` +
          `A reviewer will ask for a citation or a hedge.`,
        evidenceAnchor: `claim-verifier: [V${claim.number}] UNVERIFIED`,
        reviewerQuote:
          `Reviewer: "Please provide a citation for this claim, or hedge it appropriately ` +
          `if it is original to this work."`,
        actionableFix:
          `Add a supporting citation, qualify the claim as a hypothesis/finding-of-this-study, ` +
          `or supply the missing evidence.`,
        expectedEffort: "Immediate (1-2 hours)",
      };
    case "confirmed":
    default:
      return null;
  }
}

export function mapBriefToPriorityIssues(brief: ConductorBrief): PriorityIssue[] {
  const issues: PriorityIssue[] = [];
  brief.claims.forEach((claim, i) => {
    const issue = issueForClaim(claim, i);
    if (issue) issues.push(issue);
  });
  // Refutations first: they are binding.
  issues.sort((a, b) => a.priority.localeCompare(b.priority));
  return issues;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Run the Conductor claim-verification sidecar on manuscript text.
 *
 * Writes the manuscript to a temp file, invokes the sidecar, reads the
 * brief JSON, and maps non-confirmed verdicts to PriorityIssues. Never
 * throws: failures are reported in `result.error` with an empty issue
 * list so the diagnostic can proceed without this stage.
 */
export async function runClaimVerification(
  manuscriptText: string,
  opts: ClaimVerificationOptions = {}
): Promise<ClaimVerificationResult> {
  const empty: ClaimVerificationResult = { brief: null, priorityIssues: [] };
  let manuscriptPath = "";
  let briefPath = "";
  // node:fs/promises is available in dev/test; the Tauri webview path
  // relies on the shell sidecar and never reaches the fs fallback.
  let fsPromises: typeof import("node:fs/promises") | null = null;
  try {
    fsPromises = await import("node:fs/promises");
  } catch {
    return { ...empty, error: "no filesystem access for sidecar staging" };
  }
  try {
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const stamp = Date.now().toString(36);
    manuscriptPath = join(tmpdir(), `manuview-ms-${stamp}.md`);
    briefPath = join(tmpdir(), `manuview-brief-${stamp}.json`);
    await fsPromises.writeFile(manuscriptPath, manuscriptText, "utf-8");

    const command = opts.conductorCommand ?? defaultConductorCommand();
    // Prefer the Tauri shell sidecar in the desktop build; fall back to
    // Node child_process in dev/test.
    try {
      await runViaTauriShell(command, manuscriptPath, briefPath, opts);
    } catch (tauriErr) {
      await runViaNodeChildProcess(command, manuscriptPath, briefPath, opts).catch(
        (nodeErr) => {
          throw new Error(
            `tauri shell: ${(tauriErr as Error).message}; node fallback: ${(nodeErr as Error).message}`
          );
        }
      );
    }

    const raw = await fsPromises.readFile(briefPath, "utf-8");
    const brief = JSON.parse(raw) as ConductorBrief;
    if (!brief || !Array.isArray(brief.claims)) {
      throw new Error("sidecar produced an unparseable brief");
    }
    return {
      brief,
      priorityIssues: mapBriefToPriorityIssues(brief),
    };
  } catch (e) {
    return { ...empty, error: (e as Error).message ?? String(e) };
  } finally {
    // Best-effort temp cleanup; never fail the diagnostic over it.
    if (fsPromises) {
      if (manuscriptPath) await fsPromises.unlink(manuscriptPath).catch(() => {});
      if (briefPath) await fsPromises.unlink(briefPath).catch(() => {});
    }
  }
}

/**
 * Render the deterministic evidence-brief block shared by all grounding
 * entry points. The block quotes verdict counts and the binding kill
 * list verbatim from the sidecar JSON -- never paraphrased by an LLM.
 */
function renderBriefBlock(brief: ConductorBrief): string {
  const killList =
    brief.kill_list.length > 0
      ? brief.kill_list.map((k) => `- [V${k.number}] ${k.text} (${k.detail})`).join("\n")
      : "(none)";
  const counts = brief.verdict_counts;
  return (
    `EVIDENCE BRIEF (deterministically rendered from literature verification -- ` +
    `treat as ground truth about claim status):\n` +
    `Verdict counts: ${counts.confirmed} CONFIRMED / ${counts.corrected} CORRECTED / ` +
    `${counts.unverified} UNVERIFIED / ${counts.refuted} REFUTED.\n` +
    `Binding refutations (do not present these claims as valid):\n${killList}\n\n` +
    `CONTRACT: check every factual assertion you make about the manuscript's claims ` +
    `against this brief. Never assume a claim's status -- if the brief does not ` +
    `establish it, say so. Cite verdicts as [Vn].`
  );
}

/**
 * Phase 2 hook: ground reviewer persona prompts with the evidence brief.
 *
 * Appends the deterministic brief (verdict counts + kill list) to a persona
 * system prompt under a check-don't-assume contract: the persona keeps its
 * voice, but any factual assertion about the manuscript's claims must be
 * checked against the brief, never assumed.
 */
export function groundPersonaPromptWithBrief(
  systemPrompt: string,
  brief: ConductorBrief
): string {
  return `${systemPrompt}\n\n${renderBriefBlock(brief)}`;
}

/**
 * Phase 2 panel grounding: apply the evidence brief to ManuView's unified
 * 5-persona review prompt, targeted at the two personas whose judgments
 * rest on factual claim status --
 *   - Reviewer 2 "Target Domain Specialist" (persona: domain_expert)
 *   - Reviewer 5 "Adversarial Translation Referee" (persona: devils_advocate)
 *
 * The other three personas keep their rubrics unchanged. Persona voices
 * and roles are not modified; only the brief and the binding directives
 * below are appended.
 */
export function groundPanelPromptWithBrief(
  systemPrompt: string,
  brief: ConductorBrief
): string {
  const directives =
    `PERSONA-TARGETED DIRECTIVES (apply to the two personas named below; the ` +
    `other three personas keep their rubrics unchanged):\n` +
    `- Reviewer 2 "Target Domain Specialist" (persona: "domain_expert"): when ` +
    `assessing domain novelty and theoretical contribution, check every factual ` +
    `claim you endorse against the EVIDENCE BRIEF. Do NOT present a claim as ` +
    `an established finding when the brief marks it CORRECTED, UNVERIFIED, or ` +
    `REFUTED -- downgrade or challenge it instead, citing the verdict [Vn].\n` +
    `- Reviewer 5 "Adversarial Translation Referee" (persona: "devils_advocate"): ` +
    `the binding refutations are your primary ammunition. Each kill-list entry ` +
    `MUST appear as a major critique with its [Vn] citation and the verifier's ` +
    `reason. UNVERIFIED claims MUST appear as missing-citation / missing-evidence ` +
    `demands. Do not soften a refutation into a minor comment.\n\n`;
  return `${systemPrompt}\n\n${directives}${renderBriefBlock(brief)}`;
}
