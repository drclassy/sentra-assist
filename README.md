# Sentra Assist

[![Project Status: Active](https://img.shields.io/badge/Project%20Status-Active-brightgreen.svg)](https://github.com/the-abyss/sentra-assist)
[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](package.json)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

**Sentra Assist** (`@the-abyss/sentra-assist`) is a premium clinical decision support (CDS) browser extension designed for Indonesian healthcare professionals using **ePuskesmas**. It acts as an AI-driven sidekick that helps identify potential diagnosis mismatches, missing clinical data, and provides smarter medication guidance to ensure patient safety.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| **Core** | [WXT](https://wxt.dev/) (Browser Extension Framework) |
| **Frontend** | React 18, Tailwind CSS, Framer Motion |
| **Icons** | Lucide Icons |
| **AI Engine** | Google Vertex AI (`@google-cloud/vertexai`) |
| **State Management** | Zustand |
| **Testing** | Vitest, Testing Library, Playwright (E2E) |
| **Runtime** | Node.js 22+, pnpm 9+, TypeScript (Strict Mode) |

---

## ✨ Key Features

- **Clinical Mismatch Detection**: Real-time analysis of TTV (Vital Signs) and diagnosis consistency.
- **Smart Medication Guidance**: AI-powered insights for safer drug prescriptions.
- **Dashboard Integration**: Secure synchronization with the Sentra Healthcare Dashboard.
- **Sidepanel UI**: A non-intrusive, premium dark-themed interface for clinical decision support.
- **Auth-Backed Security**: Session verification via dedicated Dashboard-backed authentication.

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: ≥ 22.x
- **pnpm**: ≥ 9.x
- **Google Cloud Project**: Required for Vertex AI access.

### Installation

```powershell
# Install dependencies
pnpm install
```

### Development

```powershell
# Start WXT dev server (Chrome)
pnpm --filter @the-abyss/sentra-assist dev

# Start WXT dev server (Firefox)
pnpm --filter @the-abyss/sentra-assist dev:firefox
```

### Production Build

```powershell
# Build the extension for Chrome
pnpm --filter @the-abyss/sentra-assist build

# Build and package as ZIP
pnpm --filter @the-abyss/sentra-assist zip
```

---

## 📂 Project Structure

```text
sentra-assist/
├── .agent/                    # Operational memory (Context, Progress, Handoff)
├── entrypoints/
│   ├── sidepanel/             # Main Assist UI
│   ├── login/                 # Dashboard-backed auth UI
│   └── background.ts          # Messaging and bridge orchestration
├── components/
│   ├── clinical/              # Clinical UI (TTV, diagnosis, alerts)
│   └── sidepanel/             # Shared shell and navigation components
├── lib/
│   ├── api/                   # Auth, bridge, and fetching logic
│   └── clinical/              # AI inference and clinical rules
├── tests/                     # Vitest and Playwright test suites
├── scripts/                   # Build and utility automation scripts
└── wxt.config.ts              # Extension configuration
```

---

## 🧪 Quality Gates

All contributions must pass the following quality gates:

```powershell
pnpm run test            # Run unit and integration tests
pnpm run test:contract   # Verify bridge client contracts
pnpm run lint            # Enforce coding standards
pnpm run typecheck       # Validate TypeScript safety
```

---

## 📜 Standards & Compliance

This project adheres to the **Sentra Engineering Corps — Coding Standards v2.0**.
- **Security**: No PHI/PII or secrets in logs/commits.
- **Logic**: All Vertex AI interactions must flow through the `lib/` abstraction layer.
- **Rules**: Follow [AGENTS.md](AGENTS.md) and [.agent/](.agent/) for all operational protocols.

---

## 📄 License & Ownership

Maintained by **Chief / Sentra Artificial Intelligence**.
License: **ISC**.
Design & Masterplan by **Claudesy**.
