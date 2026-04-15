<table>
<tr>
<td width="180" valign="middle">
<img src="https://github.com/Claudesy/sentra-assist/blob/master/public/assist.png?raw=true" width="160" alt="Sentra Assist" />
</td>
<td valign="middle">

# Sentra Assist

The intelligent connector between ePuskesmas and AI-powered clinical decision support.

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](package.json)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Claudesy/sentra-assist/ci.yml?label=CI&logo=github)](https://github.com/Claudesy/sentra-assist/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-purple)](https://wxt.dev/)
[![Platform](https://img.shields.io/badge/Platform-AADI%20%7C%20Sentra%20AI-FE4900)](https://sentra-dfi.com)

</td>
</tr>
</table>

---

## Overview

`@the-abyss/sentra-assist` is a browser extension that connects ePuskesmas patient data to the **AADI (Advanced Augmentative Diagnostic Intelligence)** engine — embedding real-time clinical decision support directly into the EMR workflow as an intelligent sidepanel companion.

Patient data is surfaced from the active ePuskesmas session via **DAS (Data Ascension System)**, an adaptive extraction layer that auto-discovers and self-heals field mappings regardless of ePuskesmas UI changes. The extension requires no infrastructure changes at the clinic level and authenticates against the Sentra Assist Dashboard backend.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Quickstart](#quickstart)
4. [Architecture](#architecture)
5. [Testing and Quality Gates](#testing-and-quality-gates)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

---

## Features

### Emergency Detection — 4-Gate Protocol

| Gate | Feature | Description |
|------|---------|-------------|
| G1 | **TTV Inference** | Auto-infers unmeasured vital signs (pulse, RR, temperature) from patient complaints using evidence-based patterns — fills the form automatically before the doctor sees it |
| G2 | **Hypertension Crisis Triage** | Classifies 8 HTN types (Primary, Secondary, Isolated Systolic, White-coat, Masked, Resistant, Urgency, Emergency) per FKTP 2024 — detects HMOD red flags and guides Captopril SL protocol |
| G3 | **Glucose Crisis Management** | Screens GDS/GDP/2JTTGO/HbA1c against PERKENI 2024 thresholds — identifies DKA/HHS red flags and activates the 15-15 interactive timer for hypoglycemia management |
| G4 | **Occult Shock Detector** | Screens for relative hypotension in hypertensive patients via perfusion assessment and acute symptom checklist — catches early shock presentations before vitals deteriorate |

### Iskandar Diagnosis Engine — 8-Step AI Pipeline

The core decision support engine processes every patient encounter through a structured pipeline:

| Step | Module | Function |
|------|--------|---------|
| 1 | **Anonymizer** | Strips PII from clinical input before any AI processing |
| 2 | **Red Flag Checker** | Deterministic rules for sepsis (qSOFA), ACS, stroke, hypoglycemia crisis, preeclampsia, anaphylaxis — runs before AI, cannot be overridden |
| 3 | **Symptom Matcher** | IDF-weighted + Coverage + Jaccard scoring against 159-disease knowledge base; pure function under 100ms |
| 4 | **Epidemiology Weights** | Bayesian priors from 45,030 real Indonesian cases — adjusts prevalence by region and season |
| 5 | **LLM Reasoner** | DeepSeek R1 + Vertex AI Gemini for differential enrichment — falls back to KB-only if offline |
| 6 | **Traffic Light Gate** | 8 deterministic escalation rules (GREEN/YELLOW/RED) — referral decision support, non-overridable |
| 7 | **Validation** | ICD-10 code verification and confidence score adjustment |
| 8 | **Audit Logger** | Appends to tamper-evident blockchain-lite SHA-256 chain — 10-year retention |

### Clinical Trajectory Analysis

- **Visit History Tracking** — captures up to 5 previous encounters per patient session
- **Trend Analysis** — tracks vital sign trends, global deterioration state, and urgency tier across visits
- **Mortality Proxy Scoring** — early warning composite score from trend deltas
- **Prognosis Mapping** — converts trajectory data to referral communication format

### Drug Safety

| Feature | Detail |
|---------|--------|
| **DDI Checker** | 173,071+ clinical drug-drug interactions from DDInter 2.0 with severity classification (major / moderate / minor) |
| **Pharmacotherapy Reasoner** | Syndrome-based medication selection with intent rules and local stock prioritization |
| **Dosage Calculator** | Weight-based pediatric and geriatric dosing per IDAI / PAPDI / PIONAS guidelines with age-group correction |
| **Prescription Form Auto-fill** | Multi-medication entry with aturan pakai, dosage, duration, and priority management |

### Form Automation & DAS

**DAS (Data Ascension System)** is the AI-powered adaptive extraction layer:

| DAS Layer | Mechanism |
|-----------|-----------|
| **DOM Scanner** | Analyzes ePuskesmas page structure, extracts form element signatures |
| **Semantic Mapper** | Gemini Vision-based field semantic understanding |
| **Field Classifier** | Categorizes fields by clinical role |
| **Safety Validator** | Prevents filling wrong fields, validates types before injection |
| **Learning Store** | Persists learned field mappings per facility across sessions |
| **Cache Promoter** | Promotes session mappings to long-term learning store |
| **Feedback Capture** | Records user corrections for continuous improvement |
| **Self-Healing** | Re-scans automatically when mappings are invalidated by UI changes |

Supported auto-fill targets:

| Page | Fields Filled |
|------|--------------|
| **Anamnesa** | Keluhan utama, keluhan tambahan, duration, vital signs, physical exam checkboxes, skala nyeri slider |
| **Diagnosa** | ICD-10 primary + secondary codes, jenis kasus, kunjungan type |
| **Resep** | Medication names, dosage, aturan pakai, duration, signa — with autocomplete support |

### ICD-10 RAG Search

- In-memory ICD-10 database loaded async at session start
- Semantic search + fuzzy matching across the full ICD-10 code set
- Builds retrieval-augmented context for diagnosis engine enrichment

### Dashboard Integration

| Feature | Description |
|---------|-------------|
| **Bridge Client** | Real-time polling of Sentra Dashboard for transfer requests and outbound consults |
| **RME Transfer Orchestrator** | Multi-step referral transfer (anamnesa → diagnosa → resep) with retry and deduplication logic |
| **Patient Sync** | Syncs extracted patient demographics and vitals to Dashboard on session init |
| **Auth Session** | Session verification via `/api/auth/session` — single backend, shared users with Dashboard |

### Chronic Disease Classification

Auto-recognizes 11 chronic disease categories with severity badges:

Hypertension · Diabetes Mellitus · Heart Failure · Coronary Heart Disease · Stroke · Chronic Kidney Disease · Cancer · Asthma · COPD · GERD · Thyroid Disorder

### Security & Compliance

| Feature | Implementation |
|---------|---------------|
| **PII Anonymization** | Names, ages, IDs redacted before every AI call — validated with `containsPII()` check |
| **Audit Trail** | Blockchain-lite SHA-256 chain — entry N includes hash of N-1, tamper-evident, 10-year retention |
| **Auth** | Dashboard-backed JWT — no credentials stored in extension storage |
| **No PHI in logs** | ESLint rules enforced — `no-console` (allow warn/error only), no raw patient data in any log |

### UI / UX

- **Carbon Neumorphism** design system — dark-first, clinical-grade visual hierarchy
- **ARIA tablist navigation** — keyboard accessible (ArrowLeft/Right, Home, End) across all engine tabs
- **Multi-step Wizard** framework for guided clinical workflows
- **Confidence Meter** — visual HIGH/MEDIUM/LOW indicator per diagnosis suggestion
- **Theme Toggle** — dark / light mode, persisted per user
- **Text Effect** — animated gradient for status display

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension Framework | WXT 0.20+ (Chrome MV3 + Firefox MV2) |
| Frontend | React 18, Tailwind CSS, Framer Motion |
| Icons | Lucide Icons |
| AI — Vision & Text | Google Vertex AI / Gemini (`@google-cloud/vertexai`) |
| AI — Reasoning | DeepSeek R1 (constrained clinical reasoning) |
| State Management | Zustand |
| Testing | Vitest, Testing Library, Playwright (E2E) |
| Runtime | Node.js ≥22, pnpm ≥9, TypeScript Strict Mode |

---

## Quickstart

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 22.x |
| pnpm | ≥ 9.x |
| Google Cloud Project | Vertex AI API enabled |
| Sentra Dashboard Account | Required for auth and patient sync |

### Installation

```bash
pnpm install
cp .env.example .env.local
```

### Environment Configuration

| Variable | Description |
|----------|-------------|
| `VITE_SENTRA_API_URL` | Dashboard API base URL |
| `VITE_SENTRA_API_KEY` | API authentication key |
| `VITE_FACILITY_ID` | Facility identifier |
| `VITE_USE_MOCK` | Enable mock responses (`true` / `false`) |

> Never commit `.env.local` or any file containing credentials, API keys, or patient data.

### Development

```bash
# Chrome (hot reload)
pnpm --filter @the-abyss/sentra-assist dev

# Firefox
pnpm --filter @the-abyss/sentra-assist dev:firefox
```

Load unpacked:
- **Chrome:** `chrome://extensions` → Enable Developer Mode → Load Unpacked → `.output/chrome-mv3-dev/`
- **Firefox:** `about:debugging` → Load Temporary Add-on → `.output/firefox-mv2-dev/manifest.json`

### Production Build

```bash
pnpm --filter @the-abyss/sentra-assist build          # Chrome MV3
pnpm --filter @the-abyss/sentra-assist zip            # Chrome Web Store ZIP
pnpm --filter @the-abyss/sentra-assist build:firefox  # Firefox MV2
pnpm --filter @the-abyss/sentra-assist zip:firefox
```

---

## Architecture

### Extension Layers

```
┌─────────────────────────────────────────────────────┐
│              Sidepanel UI (React + Tailwind)         │
│   Emergency Gates · Diagnosis Engine · Drug Safety  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           Background Script (WXT MV3)                │
│       Bridge Polling · Auth Refresh · Messaging      │
└───────┬──────────────┬──────────────┬───────────────┘
        │              │              │
┌───────▼────┐  ┌──────▼──────┐  ┌───▼────────────────┐
│ Dashboard  │  │  Vertex AI  │  │  Content Script    │
│ API        │  │  DeepSeek   │  │  DAS Extraction    │
│ Auth+Sync  │  │  Reasoning  │  │  Form Auto-fill    │
└────────────┘  └─────────────┘  └────────────────────┘
```

### DAS — Data Ascension System

DAS surfaces clinical data from the active ePuskesmas session into the intelligence pipeline. Instead of brittle hardcoded selectors, DAS uses adaptive fingerprinting with multi-signal confidence scoring.

```
ePuskesmas Page Loads
        │
        ▼
DAS DOM Scanner — enumerate all inputs
        │
        ▼
Field Classifier + Semantic Mapper (Gemini Vision fallback)
        │
Confidence ≥ 0.85 ──► Mapping confirmed
Confidence < 0.85 ──► Gemini Vision re-scan ──► Mapping confirmed
        │
        ▼
Field values extracted on change events
        │
        ▼
Normalized payload → Iskandar Engine + Form Auto-fill
```

### Project Structure

```
sentra-assist/
├── entrypoints/
│   ├── sidepanel/             ← Main Assist UI (React)
│   ├── login/                 ← Auth entrypoint
│   └── background.ts          ← Messaging, bridge orchestration
├── components/
│   ├── clinical/              ← TTV, HTN, Glucose, Shock, Dosage, Differential, Resep
│   ├── cdss/                  ← CDSS widget, confidence meter, diagnosis cards, red flags
│   ├── sidepanel/             ← Shell, header, footer, login, credits
│   ├── providers/             ← ThemeProvider
│   └── ui/                    ← ThemeToggle, TextEffect
├── lib/
│   ├── api/                   ← Auth, bridge, polling, Vertex AI, DeepSeek, audit
│   ├── clinical/              ← Vital autocomplete, dosage DB, triage builder, AAssist v2
│   ├── iskandar-diagnosis-engine/ ← 8-step pipeline (31 files)
│   ├── emergency-detector/    ← 4 gates: TTV, HTN, Glucose, Shock
│   ├── scraper/               ← Static DOM extractors
│   │   └── adaptive/          ← DAS: AI-powered adaptive field detection (11 modules)
│   ├── rag/                   ← ICD-10 RAG search
│   ├── handlers/              ← Page-specific fill handlers (anamnesa, diagnosa, resep)
│   ├── rme/                   ← RME transfer orchestrator, payload + prognosis mapper
│   └── filler/                ← Form filling core (content script bridge)
├── utils/                     ← Audio, logger, messaging, name-masking, storage, sound
├── types/                     ← API and global type definitions
├── data/                      ← DDI database, field mappings
├── public/                    ← Extension assets (icons, fonts, sounds, clinical data)
├── scripts/
│   ├── build/                 ← Database optimization
│   ├── data/                  ← Data conversion
│   └── dev/                   ← Dev automation, smoke tests
└── tests/                     ← Vitest setup
```

---

## Testing and Quality Gates

### Running Tests

```bash
pnpm --filter @the-abyss/sentra-assist test             # Unit and integration (264 tests)
pnpm --filter @the-abyss/sentra-assist test:contract    # Bridge API contracts
pnpm --filter @the-abyss/sentra-assist typecheck        # tsc --noEmit strict
pnpm --filter @the-abyss/sentra-assist lint             # ESLint + Prettier
```

### Required Before Merge

```bash
pnpm test          # 264/264 must pass
pnpm test:contract # Bridge contracts must pass
pnpm typecheck     # Zero errors
pnpm lint          # Zero warnings
```

### Standards

- Test files co-located as `*.test.ts` / `*.test.tsx` next to source
- Contract guard: `lib/api/bridge-client.test.ts` must pass for all bridge changes
- E2E: Playwright in `tests/e2e/`

---

## Deployment

### Chrome Web Store

```bash
pnpm --filter @the-abyss/sentra-assist build
pnpm --filter @the-abyss/sentra-assist zip
# Upload ZIP to Chrome Web Store Developer Dashboard
```

### Firefox Add-ons

```bash
pnpm --filter @the-abyss/sentra-assist build:firefox
pnpm --filter @the-abyss/sentra-assist zip:firefox
# Upload to Firefox Add-on Developer Hub
```

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Extension not loading | Enable Developer Mode at `chrome://extensions/`, load unpacked from `.output/chrome-mv3-dev/` |
| `pnpm install` fails | Verify Node.js ≥22 and pnpm ≥9 via `node -v` and `pnpm -v` |
| Vertex AI auth errors | Confirm Google Cloud project access and Vertex AI API is enabled |
| Sidepanel shows "Login required" | Check Dashboard base URL in Settings — must point to a running Sentra Dashboard instance |
| Form not auto-filling | DAS may need a re-scan — click Inisialisasi in the header status bar |
| Word limit error on submit | ePuskesmas field limit is 225 words — Sentra caps keluhan at 220 words automatically |
| TypeScript build errors | Run `pnpm typecheck` for full output; verify all dependencies installed |

---

## Documentation

| Resource | Location |
|----------|---------|
| Architecture Docs | [docs/architecture/](docs/architecture/) |
| ADR (Architecture Decision Records) | [docs/adr/](docs/adr/) |
| API Reference | [API.md](API.md) |
| User Guide | [docs/user/USER_GUIDE.md](docs/user/USER_GUIDE.md) |
| Contributing Guide | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Security Policy | [SECURITY.md](SECURITY.md) |
| Deployment Guide | [DEPLOYMENT.md](DEPLOYMENT.md) |

---

## License and Ownership

Designed and constructed by **Claudesy** (dr. Ferdi Iskandar).
Maintained by **Sentra Artificial Intelligence**.
License: **ISC** — see [LICENSE](LICENSE) for full text.
