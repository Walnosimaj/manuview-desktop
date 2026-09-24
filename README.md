# ManuView Desktop 🔬📄

<p align="center">
  <img src="public/icon.svg" width="96" height="96" alt="ManuView Logo" />
</p>

<h3 align="center">AI Pre-Submission Peer Review & Manuscript Diagnostic Suite</h3>

<p align="center">
  A native, privacy-first desktop application designed for researchers, clinicians, and academic authors to audit manuscripts, simulate 5-persona peer reviews, benchmark target journal fit, detect already published literature, and verify citation integrity before formal submission.
</p>

<p align="center">
  <strong>100% Local & Private Processing</strong> &bull; <strong>Zero Unpublished Data Retention</strong> &bull; <strong>Multi-Engine: Laya On-Device, WebGPU SLM & Cloud AI</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tests-128%20Passing-emerald" alt="128 Passing Tests" />
  <img src="https://img.shields.io/badge/Architecture-Tauri%20v2%20%2B%20React%2018-blue" alt="Tauri v2 + React 18" />
  <img src="https://img.shields.io/badge/Decision%20Model-Laya%20ONNX%2FWASM-purple" alt="Laya On-Device" />
  <img src="https://img.shields.io/badge/Privacy-Zero%20Telemetry-success" alt="Privacy First" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" alt="MIT License" />
</p>

---

> [!NOTE]
> ### 🧪 Pre-compiled Installers are in Testing!
> Ready-to-use executable installers for **macOS (`.dmg` / `.app`)** and **Windows (`.exe` / `.msi`)** are currently in our testing phase and will be published directly under [GitHub Releases](https://github.com/khatiwada-bishal/manuview-desktop/releases).
> 
> You can easily run ManuView right now on your computer in just **2 minutes** using the simple instructions below!

---

## Table of Contents
1. [The 3 Scan Engines](#-the-3-scan-engines)
2. [Core Capabilities & Latest Features](#-core-capabilities--latest-features)
   - [Universal Categorization & Eligibility Gate](#1-universal-academic-categorization-gate)
   - [Scholarly Publication Detection & Routing](#2-scholarly-publication-detection--routing)
   - [Calibrated Venue Selectivity & Acceptance Forecasting](#3-calibrated-venue-selectivity--acceptance-forecasting)
   - [5-Persona Simulated Peer Review Panel](#4-5-persona-simulated-peer-review-panel)
   - [6-Pillar Editorial Triage Matrix](#5-6-pillar-editorial-triage-matrix)
   - [Statistical Rigor & GRIM Auditor](#6-statistical-rigor--grim-auditor)
   - [Display Items, Figures & Visual Pre-Flight Auditor](#7-display-items-figures--visual-pre-flight-auditor)
   - [Grounded Citation & Retraction Verification](#8-grounded-citation--retraction-verification)
   - [Modular Domain Reporting Guidelines](#9-modular-domain-reporting-guidelines)
3. [User Interface & Interactive Analytics](#-user-interface--interactive-analytics)
4. [AI Providers & Model Setup](#-ai-providers--model-setup)
   - [Local & Offline Models (Laya, WebGPU, Ollama)](#local--offline-providers)
   - [Cloud AI Models (BYOK: Gemini, Groq, OpenRouter, Mistral, OpenAI, Claude)](#cloud-ai-providers-byok)
5. [Report Export & Academic Tools](#-report-export--academic-tools)
6. [System Architecture](#-system-architecture)
7. [How to Run Locally (Step-by-Step)](#-how-to-run-locally-step-by-step)
   - [Method 1: Web Preview (Fastest — No Rust Needed)](#method-1-web-preview-fastest--no-rust-needed)
   - [Method 2: Full Native Desktop App (macOS & Windows)](#method-2-full-native-desktop-app-macos--windows)
8. [Testing & Scientific Benchmark Suite](#-testing--scientific-benchmark-suite)
9. [Scholarly Disclaimer & Responsible Use](#-scholarly-disclaimer--responsible-use)
10. [Privacy & Security Guarantee](#-privacy--security-guarantee)
11. [License](#-license)

---

## ⚡ The 3 Scan Engines

ManuView provides three distinct, parity-calibrated scanning modalities to fit any workflow, privacy requirement, or hardware setup:

| Feature | ⚡ Fast Scan (Laya On-Device) | 💻 Local SLM (WebGPU / Ollama) | ☁️ Cloud AI Diagnostic (BYOK) |
|---|---|---|---|
| **Execution** | 100% On-Device (ONNX WebAssembly) | 100% On-Device (WebGPU / Local Server) | Direct HTTPS to Provider API |
| **API Key / Internet** | **None** (Zero setup, fully offline) | **None** (Offline after model download) | Bring-Your-Own-Key (BYOK) |
| **Token Cost** | **$0.00** (Zero tokens) | **$0.00** (Zero tokens) | Standard provider rates (Free tiers available) |
| **Speed** | **Sub-second** (~150ms) | 5–15 seconds (depends on GPU) | 3–8 seconds |
| **Decision Model** | 27-question atomic diagnostic battery | Small Language Model inference (1B–3B) | Full 5-Persona deep review (Gemini, Claude, GPT-4o) |
| **Scope & Venue Fit** | Calibrated Venue Selectivity tiering | Target journal scope parsing | Dynamic journal catalog fit + editorial triage |
| **Best For** | Instant local pre-flight checks, confidential files | Private workstation or lab computers | Thorough pre-submission referee simulation |

---

## 🚀 Core Capabilities & Latest Features

### 1. Universal Academic Categorization Gate
- **Pre-execution Document Classifier**: Evaluates every document before calling any LLM or inference engine using an authoritative dual-metric heuristic (`academicScore >= 5` with strict IMRaD section pair enforcement).
- **Prevents Misclassification of Random Files**: Non-manuscript files (resumes/CVs, project requirements documents, invoices, shopping lists, source code, and exported diagnostic reports) are immediately flagged with a clean, informative ineligibility banner:
  > *"Document Ineligible for Peer-Review Evaluation: Classified as [Document Type]"*
- **Eliminates Token & Quota Waste**: Ineligible documents bypass deep scan pipelines immediately across all three engines, preventing confusing peer reviews of non-academic files.

### 2. Scholarly Publication Detection & Routing
- **Extended Header & Footer Analysis**: Scans up to 8,000 characters across title, header, and page 1/2 footer regions for formal digital object identifiers (`doi.org/...`), volume/issue numbers, and major scholarly publishers (ACM, IEEE, Elsevier, Springer, Nature, Wiley, RSC, ACS, etc.).
- **Live Crossref Resolution**: Verifies whether an identified DOI matches active scholarly literature.
- **Dedicated Published Article View**: Published papers are automatically routed to a dedicated emerald **"Already Published Article Detected"** view displaying a 4-box publication metadata grid:
  - **Published Journal**
  - **Publication Date**
  - **Publisher**
  - **Official Article DOI** (with direct external hyperlink)
- **Suppresses Redundant Peer Reviews**: Unnecessary pre-submission referee personas, readiness scores, and revision punchlists are suppressed for published articles.
- **Strict Preprint Discrimination**: Papers deposited on preprint servers (arXiv, bioRxiv, medRxiv, ChemRxiv, Research Square, SSRN) and unsubmitted drafts are recognized as pre-submission manuscripts and remain fully eligible for simulated peer review.

### 3. Calibrated Venue Selectivity & Acceptance Forecasting
- **Empirical Venue Selectivity Calibration**: Benchmarks manuscripts against genuine rejection and acceptance profiles for target journals (e.g., *The Lancet*, *Nature*, *IEEE Transactions*, *PNAS*).
- **Eliminates Ungrounded 100/100 Scores**: Applies strict deterministic ceiling caps so high scores require verifiable empirical grounding, preventing misleadingly optimistic feedback.
- **Calibrated Qualitative Readiness Bands**: Categorizes papers into honest, actionable bands:
  - 🟢 **High Acceptance Probability** (Ready for submission / minor polish)
  - 🟠 **Revision Prioritized** (Sound baseline, critical revisions required)
  - 🔴 **Editorial Desk Reject Hazard** (Major scope mismatch or structural deficiencies)

### 4. 5-Persona Simulated Peer Review Panel
- Simulates five distinct, adversarial referee archetypes:
  - 🔬 **Methodologist**: Scrutinizes experimental design, controls, power analysis, confounding variables, and protocol reproducibility.
  - 📊 **Statistician**: Verifies degrees of freedom, effect sizes, statistical test selection, and p-value consistency.
  - 🎯 **Domain Specialist**: Evaluates conceptual novelty, grounding in recent state-of-the-art literature, and overall disciplinary impact.
  - 🩺 **Clinical / Applied Reviewer**: Assesses translational feasibility, clinical relevance, sample representativeness, and ethical rigor.
  - 🏛️ **Journal Handling Editor**: Evaluates journal scope fit, title/abstract alignment, framing, and desk-rejection hazards.
- **Copyable Author Rebuttals**: Every reviewer critique includes pre-formatted rebuttal guidance with one-click clipboard copying.

### 5. 6-Pillar Editorial Triage Matrix
- Quantifies editorial hazard across the 6 primary causes of journal desk rejection:
  1. **Scope & Disciplinary Alignment**: Flags cross-field mismatches with clear visual indicators (Red for Out-of-Scope, Orange for Review-Needed).
  2. **Methodological Rigor & Internal Validity**
  3. **Statistical Integrity & Analytical Reproducibility**
  4. **Literature Grounding & Citation Hygiene**
  5. **Ethical Compliance & Data Availability**
  6. **Structural Clarity & IMRaD Conventions**

### 6. Statistical Rigor & GRIM Auditor
- **GRIM (Granularity-Related Inconsistency of Means) Test**: Mathematically audits reported means and sample sizes to detect impossible values in integer-based survey and experimental data.
- **Statcheck Integration**: Extracts test statistics ($t$, $F$, $\chi^2$, $Z$, $r$) alongside degrees of freedom and recalculated $p$-values to detect gross reporting errors.

### 7. Display Items, Figures & Visual Pre-Flight Auditor
- **Caption & Callout Auditing**: Detects figure and table captions across major academic formats and verifies narrative callouts within text.
- **Orphan & Phantom Item Detection**: Automatically flags display items referenced in text but missing captions, and captions never cited in the manuscript body.
- **Error Bar & Statistical Legend Check**: Verifies that figures featuring error bars explicitly define their statistical meaning (SD, SEM, 95% CI).

### 8. Grounded Citation & Retraction Verification
- **Built-in Retraction Watch Database**: Offline embedded dataset detects retracted papers instantly without external internet calls.
- **Live Crossref Open API Verification**: Resolves reference DOIs, author lists, and publication years in real-time.
- **Smart DOI De-Wrapping**: Reassembles split DOIs across line breaks and hyphens without corrupting adjacent citation entries.
- **Recency & Self-Citation Density**: Computes the proportion of references older than 10 years and quantifies author self-citation skew.

### 9. Modular Domain Reporting Guidelines
- Audits manuscripts against canonical clinical and scientific reporting frameworks:
  - 🏥 **CONSORT 2010**: Randomized Controlled Trials
  - 📑 **PRISMA 2020**: Systematic Reviews and Meta-Analyses
  - 🐁 **ARRIVE 2.0**: In vivo preclinical animal research
  - 🤖 **ML Reproducibility Checklist**: Machine learning and algorithmic research

---

## 📊 User Interface & Interactive Analytics

ManuView features a modern macOS-inspired interface built for focused academic writing:

- **Dynamic Radar Chart**: Multi-axis visualization of readiness scores across all evaluation dimensions with direct SVG export.
- **Segmented Readiness Gauge**: Qualitative readiness gauge providing clear visual feedback without artificial percentage noise.
- **Decision Distribution Bar**: Anticipated editorial outcomes (Accept / Minor Revision / Major Revision / Reject) summing strictly to 100%.
- **Journal Fit Recommendation Cards**: Tiered recommendations (Reach, Realistic, Fallback) matched against an embedded 48,000+ scholarly journal catalog.
- **Collapsible Article Navigation Sidebar**: Grouped into human-friendly time buckets (*Today*, *Yesterday*, *Previous 7 Days*, *Previous 30 Days*, *Older*) with hover-revealed sub-navigation, provider badges, and status pills.
- **Self-Healing Notification Toasts**: Real-time export progress, copy alerts, and auto-dismissing connection status bars.

---

## 🔑 AI Providers & Model Setup

ManuView organizes providers into two clear, intuitive categories:

```
┌────────────────────────────────────────────────────────┐
│                   PROVIDER SETTINGS                    │
├────────────────────────────┬───────────────────────────┤
│   LOCAL & OFFLINE          │   CLOUD AI (BYOK)         │
│   • Laya (Fast Scan)       │   • Google Gemini         │
│   • Local SLM (WebGPU)     │   • GroqCloud             │
│   • Ollama (Local Server)  │   • OpenRouter            │
│                            │   • Mistral AI            │
│                            │   • OpenAI / Anthropic    │
└────────────────────────────┴───────────────────────────┘
```

### Local & Offline Providers

1. **Laya On-Device Fast Scan** *(Built-in, Zero Setup)*:
   - Uses on-device ONNX WebAssembly decision models.
   - Requires no API keys, no internet connection, and zero download steps.
   - Selected by default on fresh installations.
2. **Local SLM via WebGPU** *(100% In-Browser/Desktop GPU)*:
   - Powered by WebLLM running directly on your computer's GPU.
   - Gated selection: only models that have been downloaded and cached locally (e.g., `Qwen2.5-0.5B-Instruct`, `Llama-3.2-1B`) can be activated.
   - Weight downloads include interactive progress bars and cache purge controls.
3. **Ollama (Local Self-Hosted Server)**:
   - For clinical labs and high-security institutions running their own inference server.
   - Connects to `http://localhost:11434` with auto-detected local models (`llama3.3`, `mistral`, `deepseek-r1`, etc.).

### Cloud AI Providers (BYOK)

ManuView operates on a strict **Bring-Your-Own-Key** model. Keys are stored locally on your device using OS-native secure storage:

- **Google Gemini** *(Recommended Cloud)*: Free tier available at [Google AI Studio](https://aistudio.google.com/). Supports `gemini-2.5-flash` and `gemini-1.5-pro` with automatic model healing.
- **GroqCloud**: Ultra-high-speed inference via [console.groq.com](https://console.groq.com/) using `llama-3.3-70b-versatile`.
- **OpenRouter**: Unified access to 100+ models via [openrouter.ai](https://openrouter.ai/) with curated free-tier model suggestions.
- **Mistral AI**: European privacy-focused models via [console.mistral.ai](https://console.mistral.ai/) (`mistral-small-latest`, `codestral-latest`).
- **OpenAI & Anthropic**: Support for `gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet`, and `claude-3-5-haiku`.

> [!TIP]
> **Auto-Dismissing Warnings**: If a connection warning appears for an unconfigured provider, selecting a working model or entering valid credentials automatically clears the warning banner instantly.

---

## 📑 Report Export & Academic Tools

Export comprehensive diagnostic reports in multiple publication-ready formats:

| Format | Output | Best Used For |
|---|---|---|
| **Interactive HTML** | Standalone `.html` report with embedded charts & styling | Offline viewing, departmental sharing, browser presentation |
| **Microsoft Word** | Clean `.doc` / `.docx` with styled callouts & tables | Collaborative revision and track-changes with co-authors |
| **Print / PDF** | Formatted PDF with custom page-breaks & print CSS | Formal archival, grant progress reports, co-author distribution |
| **LaTeX Rebuttal** | Pre-populated point-by-point `.tex` rebuttal matrix | Formal journal resubmissions and editorial response letters |
| **BibTeX Library** | Valid `.bib` file containing all verified reference DOIs | Direct import into Overleaf, Zotero, Mendeley, or Paperpile |

### Built-in Academic Utility Suite
- **PRISMA 2020 Flow Diagram Generator**: Interactive interactive flowchart generator for systematic reviews with SVG and PDF download.
- **Cover Letter Drafter**: Formats professional submission letters highlighting novelty, ethical clearances, and editorial fit.
- **Review Response Rebuttal Builder**: Generates structured author responses to peer reviewer critiques.
- **Batch Manuscript Management**: Multi-select, batch deletion, and local computer project persistence.

---

## 🔬 System Architecture

ManuView is engineered as a lightweight, privacy-first desktop client powered by **Tauri v2**, **React 18**, and **Vite**:

```
src/
├── components/
│   ├── dashboard/          # Modularized dashboard cards (Triage, Personas, Citations, etc.)
│   ├── scan/               # Input dropzone, model picker, and full report viewers
│   ├── sidebar/            # Collapsible macOS-style sidebar, paper lists, time buckets
│   ├── charts/             # Radar charts, gauges, donuts, pipeline steppers
│   └── services/           # Laya Scan, PRISMA flowcharts, Cover Letters, Rebuttal builders
├── lib/
│   ├── engine/             # Diagnostic orchestrator, Stage 0 integrity, scoring dimensions
│   ├── laya/               # Laya on-device ONNX/WASM decision model battery & service
│   ├── webllm/             # WebGPU on-device SLM execution engine (Qwen2.5-0.5B, etc.)
│   ├── publication-detector.ts # Extended DOI, publisher metadata, and preprint classifier
│   ├── parser.ts           # Dual-metric academic manuscript vs. non-academic classifier
│   ├── data/               # Retraction Watch compact DB, 48,000+ journal catalog
│   ├── statcheck.ts        # Automated statistical consistency and GRIM test checks
│   ├── citation-recency.ts # Reference recency and self-citation density metrics
│   └── export-generator.ts # PDF, Word, LaTeX rebuttal, and BibTeX generators
└── src-tauri/              # Rust native application shell, OS dialogs, and window management
```

---

## 💻 How to Run Locally (Step-by-Step)

### Prerequisites

1. **Install Node.js** (Version 18 or newer):
   - Download the official installer from [nodejs.org](https://nodejs.org/) (choose **LTS**).
   - Verify installation in your terminal:
     ```bash
     node -v
     npm -v
     ```

---

### Method 1: Web Preview (Fastest — No Rust Needed)

If you only have Node.js installed and want to run ManuView immediately in your web browser:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/khatiwada-bishal/manuview-desktop.git
   cd manuview-desktop
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Open in Browser**:
   Navigate to [http://localhost:1420](http://localhost:1420). All features—including file upload, citation verification, Laya fast scans, AI reviews, and export tools—will run directly in your browser.

---

### Method 2: Full Native Desktop App (macOS & Windows)

To run ManuView inside a native operating system window with OS file dialogs and window dragging:

1. **Install Rust** (Required for Tauri):
   - **macOS / Linux**:
     ```bash
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
     ```
     Restart your terminal after installation.
   - **Windows**: Download and run `rustup-init.exe` from [rustup.rs](https://rustup.rs/).

2. **Launch the Standalone Desktop App**:
   ```bash
   npm run desktop:dev
   ```
   Tauri will compile the native Rust backend and launch the standalone desktop app.

3. **Build an Executable / Installer**:
   ```bash
   npm run desktop:build
   ```
   *(For macOS specifically, you can also run `./scripts/build-mac.sh` to package `.dmg` and `.app` bundles).*

---

## 🧪 Testing & Scientific Benchmark Suite

ManuView includes an end-to-end automated test and scientific benchmarking suite with **128 passing tests** across 9 specialized suites:

```bash
# Run all 128 automated unit and integration tests
npm test

# Run tests in continuous watch mode
npm run test:watch

# Verify TypeScript build and production bundle
npm run build
```

### Test Suite Coverage:
- **`laya-decision-model.test.ts`**: Verifies 27-question evaluation battery, deterministic repeatability, non-academic document discrimination, and signal detail formatting.
- **`publication-detection.test.ts`**: Validates DOI extraction up to 8,000 characters, publisher identification, Crossref resolution, preprint discrimination, and Stage 0 bypass.
- **`algorithm-parity-scoring.test.ts`**: Verifies venue selectivity calibration, score caps, and parity across scan engines.
- **`display-item-auditor.test.ts`**: Checks figure/table caption matching, callout detection, orphan item alerts, and error bar definitions.
- **`reporting-guidelines.test.ts`**: Validates compliance engines for CONSORT 2010, PRISMA 2020, ARRIVE 2.0, and ML Reproducibility Checklists.
- **`citation-audit.test.ts`**: Tests Retraction Watch matching, DOI de-wrapping, deduplication, and Crossref caching.
- **`export-generator.test.ts`**: Tests generation of valid HTML, Word documents, PDFs, LaTeX rebuttal tables, and BibTeX libraries.
- **`journal-matching.test.ts`**: Verifies catalog lookups, discipline matching, and recommendation consistency across 48,000+ journals.
- **`parser-integrity.test.ts`**: Tests IMRaD section extraction, language detection, PDF extraction quality, and non-English rejection.

---

## ⚠️ Scholarly Disclaimer & Responsible Use

- **Simulated Synthetic Personas**: All reviewer personas, editorial office notes, and adversarial critiques displayed in ManuView are synthetic, AI-simulated role models designed exclusively for pre-submission stress-testing and manuscript triage. They do **not** represent real living individuals, actual journal editorial boards, or binding peer-review decisions.
- **Decision-Support Only**: ManuView is designed solely to assist authors in pre-submission preparation and diagnostic triage. It does not replace domain expertise, formal peer review, institutional ethics boards, or editorial oversight.
- **Ethics Alignment**: Designed to assist compliance with international guidelines from the **Committee on Publication Ethics (COPE)** and the **International Committee of Medical Journal Editors (ICMJE)**.

---

## 🛡️ Privacy & Security Guarantee

1. **Zero Cloud Telemetry**: ManuView does not operate a central server that ingests, logs, or trains on manuscript text.
2. **Local Storage**: All project cards, generated reviewer reports, cover letters, and diagnostic scores are saved strictly inside your computer's local application storage.
3. **Encrypted Direct Communication**: When calling cloud AI providers, communication is transmitted over HTTPS directly between your computer and the AI provider's official endpoint using your private key.
4. **Air-Gapped Operation**: With the **Laya On-Device Fast Scan** or local **WebGPU / Ollama** models selected, ManuView operates completely offline with zero external network traffic.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
