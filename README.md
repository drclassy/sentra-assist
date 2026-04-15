<table>
<tr>
<td width="180" valign="middle">
<img src="https://github.com/Claudesy/sentra-assist/blob/master/public/assist.png?raw=true" width="160" alt="Sentra Assist" />
</td>
<td valign="middle">

# Sentra Assist

AI-Powered Clinical Decision Support for Indonesian Primary Healthcare.

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](package.json)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/the-abyss/sentra-assist/ci.yml?label=CI&logo=github)](https://github.com/the-abyss/sentra-assist/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-purple)](https://wxt.dev/)
[![Platform](https://img.shields.io/badge/Platform-AADI%20%7C%20Sentra%20AI-FE4900)](https://sentra-dfi.com)

</td>
</tr>
</table>

---

## Overview

`@the-abyss/sentra-assist` is a browser extension embedding the AADI (Advanced Augmentative Diagnostic Intelligence) engine directly into the ePuskesmas EMR workflow as an intelligent sidepanel companion. It delivers real-time clinical decision support — vital sign mismatch detection, drug interaction checking, and documentation automation — without requiring infrastructure changes at the clinic level. Clinical data is surfaced from the active session via **DAS (Data Ascension System)**, an adaptive extraction layer that auto-discovers and self-heals field mappings regardless of ePuskesmas UI changes.

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

| ID | Feature | Status | Priority |
|----|---------|--------|----------|
| F-01 | **Clinical Mismatch Detection** — Real-time TTV vs. diagnosis consistency analysis via DAS extraction | Active | P0 |
| F-02 | **Smart Medication Guidance** — DDI checking and National Formulary (Fornas) alignment | Active | P0 |
| F-03 | **Dashboard Integration** — Secure sync with Sentra Healthcare Dashboard | Active | P1 |
| F-04 | **Sidepanel UI** — Non-intrusive dark-themed CDS interface | Active | P0 |
| F-05 | **Auth-Backed Security** — Session verification via Dashboard-backed JWT authentication | Active | P0 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension Framework | WXT (Browser Extension Framework) |
| Frontend | React 18, Tailwind CSS, Framer Motion |
| Icons | Lucide Icons |
| AI Engine | Google Vertex AI (`@google-cloud/vertexai`) |
| State Management | Zustand |
| Testing | Vitest, Testing Library, Playwright |
| Runtime | Node.js 22+, pnpm 9+, TypeScript Strict Mode |

---

## Quickstart

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 22.x | Required for WXT toolchain |
| pnpm | >= 9.x | Workspace package manager |
| Google Cloud Project | — | Vertex AI API access required |
| Sentra Dashboard Account | — | Required for auth and clinical data sync |

### Installation

```bash
pnpm install
cp .env.example .env.local
```

### Environment Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SENTRA_API_URL` | Dashboard API base URL | `https://api.sentra.local` |
| `VITE_SENTRA_API_KEY` | API authentication key | `sk_dev_...` |
| `VITE_FACILITY_ID` | Facility identifier | `PUSKESMAS_BALOWERTI` |
| `VITE_USE_MOCK` | Enable mock responses | `true` / `false` |
| `VITE_FEATURE_DIAGNOSIS_AI` | Enable AI diagnosis suggestions | `true` / `false` |
| `VITE_FEATURE_DDI_CHECK` | Enable real-time DDI checking | `true` / `false` |
| `VITE_FEATURE_PEDIATRIC_DOSE` | Enable pediatric dosing calculator | `true` / `false` |

> Never commit `.env.local` or any file containing credentials, API keys, or patient data.

### Development

```bash
# Chrome (hot reload)
pnpm --filter @the-abyss/sentra-assist dev

# Firefox
pnpm --filter @the-abyss/sentra-assist dev:firefox
```

Load unpacked:
- **Chrome:** `chrome://extensions` > Enable Developer Mode > Load Unpacked > `.output/chrome-mv3-dev/`
- **Firefox:** `about:debugging` > Load Temporary Add-on > `.output/firefox-mv2-dev/manifest.json`

### Production Build

```bash
pnpm --filter @the-abyss/sentra-assist build          # Chrome MV3
pnpm --filter @the-abyss/sentra-assist zip            # Chrome Web Store ZIP
pnpm --filter @the-abyss/sentra-assist build:firefox  # Firefox MV2
pnpm --filter @the-abyss/sentra-assist zip:firefox
```

---

## Architecture

### Layered Model

```
Sidepanel UI (React + Tailwind)
        |
Background Script (WXT MV3 — Orchestration)
        |
   _____|______________________________
  |           |            |           |
Dashboard   Vertex AI   DAS Layer    Fornas
API         (Clinical    Data         Cache
(Auth +     Analysis)   Ascension)
 Sync)
```

### DAS — Data Ascension System

DAS is the data extraction layer responsible for surfacing clinical data from the active ePuskesmas session into Sentra Assist's intelligence pipeline. Rather than relying on brittle hardcoded selectors, DAS employs adaptive fingerprinting — each clinical field is identified by a multi-signal profile (label text, input attributes, surrounding context, tab order) and matched at session start with a confidence score. If a mapping falls below the confidence threshold mid-session, DAS triggers an automatic re-scan and self-heals without user interruption.

| DAS Layer | Mechanism | Role |
|-----------|-----------|------|
| **Auto-Discovery** | Scan all input fields on session init | Build field-to-clinical-schema mapping |
| **Fingerprint Matching** | Multi-signal confidence scoring | Identify TTV, diagnosis, and prescription fields |
| **Self-Healing** | Re-scan on mapping invalidation | Recover from ePuskesmas UI changes automatically |
| **Data Normalization** | Parse, validate, sanitize extracted values | Deliver clean structured payload to clinical engine |

```
ePuskesmas Session Loads
        |
DAS Auto-Discovery scans all fields
        |
Fingerprint match against clinical schema
        |
Confidence >= 0.85 --> Mapping confirmed
Confidence <  0.85 --> Gemini Vision fallback --> Mapping confirmed
        |
Field values extracted on change events
        |
Normalized payload delivered to mismatch-engine.ts
```

### Key Workflows

| Workflow | Flow |
|----------|------|
| **Diagnosis Analysis** | Sidepanel > Background > Dashboard API > Vertex AI > Sidepanel |
| **TTV Extraction** | Background > Content Script > DAS (Data Ascension) > Background > Sidepanel |
| **Doctor Referral** | Sidepanel > Background > Dashboard API `/doctors/online` > `/consult` |

### Project Structure

```
sentra-assist/
├── .agent/                    # Cognitorium operational memory
├── entrypoints/
│   ├── sidepanel/             # Main Assist UI (React)
│   ├── login/                 # Auth entrypoint
│   └── background.ts          # Messaging and bridge orchestration
├── components/
│   ├── clinical/              # AlertCard, DrugCard, TtvBar
│   └── sidepanel/             # Shell, NavBar, Tabs, StatusFooter
├── lib/
│   ├── api/                   # auth.ts, bridge.ts, sync.ts
│   ├── das/                   # Data Ascension System
│   │   ├── auto-mapper.ts     # Auto-discovery and fingerprint engine
│   │   ├── self-healer.ts     # Re-scan and mapping recovery
│   │   └── normalizer.ts      # Data parse, validate, sanitize
│   └── clinical/              # mismatch-engine.ts, medication-engine.ts, rules/
├── tests/                     # Vitest and Playwright test suites
├── scripts/                   # Build and utility automation
└── wxt.config.ts              # Extension configuration
```

---

## Testing and Quality Gates

### Running Tests

```bash
pnpm --filter @the-abyss/sentra-assist test             # Unit and integration
pnpm --filter @the-abyss/sentra-assist test:contract    # Bridge API contracts
pnpm --filter @the-abyss/sentra-assist test:e2e         # Playwright E2E
pnpm --filter @the-abyss/sentra-assist quality          # All quality gates
```

### Quality Gates (All Required Before Merge)

```bash
pnpm run typecheck       # tsc --noEmit strict
pnpm run lint            # ESLint + Prettier
pnpm run test            # Unit + integration
pnpm run test:contract   # Bridge contracts
```

### Standards

- Co-locate test files next to source: `*.test.ts` or `*.test.tsx`
- Naming pattern: `should[ExpectedBehavior]When[StateUnderTest]`
- Minimum 80% coverage for new code
- All API bridge interactions require contract tests in `lib/api/bridge-client.test.ts`

---

## Deployment

### Chrome Web Store

1. `pnpm --filter @the-abyss/sentra-assist build`
2. `pnpm --filter @the-abyss/sentra-assist zip`
3. Upload ZIP to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
4. Complete store listing and submit for review

### Firefox Add-ons

1. `pnpm --filter @the-abyss/sentra-assist build:firefox`
2. `pnpm --filter @the-abyss/sentra-assist zip:firefox`
3. Upload ZIP to [Firefox Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/)

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Extension not loading | Enable Developer Mode at `chrome://extensions/`, load unpacked from `.output/chrome-mv3-dev/` |
| `pnpm install` fails | Verify Node.js >= 22 and pnpm >= 9 via `node -v` and `pnpm -v` |
| Vertex AI auth errors | Confirm Google account has project access and Vertex AI API is enabled |
| Sidepanel shows "Login required" | Check `VITE_SENTRA_API_URL` points to a running Dashboard API instance |
| TypeScript build errors | Run `pnpm typecheck` for detailed output; verify all dependencies are installed |
| Changes not reflecting | Reload extension via refresh icon at `chrome://extensions/` |

---

## Standards and Compliance

This project adheres to **Sentra Engineering Corps — Coding Standards v2.0**.

- No PHI/PII or secrets in logs or commits
- All Vertex AI interactions must route through the `lib/` abstraction layer
- Follow [AGENTS.md](AGENTS.md) and [.agent/](.agent/) for all operational protocols

---

## Documentation

| Resource | Location |
|----------|---------|
| Architecture Docs | [docs/architecture/](docs/architecture/) |
| API Reference | [API.md](API.md) |
| User Guide | [docs/user/USER_GUIDE.md](docs/user/USER_GUIDE.md) |
| Security Policy | [SECURITY.md](SECURITY.md) |

---

## License and Ownership

Maintained by **Chief / Sentra Artificial Intelligence**
License: **ISC** — See [LICENSE](LICENSE) for full text.
Design and Masterplan: Claudesy
Constitutional Framework: [Mother of Sentra 2025 v2](docs/MOTHER_OF_SENTRA_2025_R2.1.md)
