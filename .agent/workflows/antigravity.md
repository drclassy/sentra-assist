---
description: Unified Operational Protocol (JET System J1-J9 / FR1-FR9)
---

# Antigravity Operational Protocol

This workflow enforces the high-precision 9-phase operational cycle for all task execution within the Sentra / Abyss Monorepo.

## Guardrails
- **ZERO EXECUTION** before Phase J5 (WAIT FOR GO).
- All tracking moves to `.agent/status.md`.
- Max 1 new file per session unless justified.
- English for all technical output; Bahasa Indonesia for Chief communication.

## Phases (FR-1 to FR-9)

### J1: Context (FR-1)
Scan `.agent/`, root `AGENTS.md`, and environment. Detect the current stack.
*Output:* "✅ AGENTS.md read. Reading .agent/ now."

### J2: Validate (FR-2)
Check against `.cursor/rules/` and constraints. Report any discrepancies.
*Stop:* If critical conflicts are found.

### J3: Diagnose (FR-3)
Identify root issues or needs.
*Output:* Brief Notes (concise problem statement).

### J4: Plan (FR-4)
Write a step-by-step execution plan in `HANDOFF.md`. Include a rollback strategy.
*Output:* Synthesis (Brief Notes + Execution Plan).

### J5: WAIT FOR GO (FR-5)
**HARD GATE.** State: "JET GO?" and wait for explicit "GO" from Chief.

### J6: Execute (FR-6)
Implement code changes. Follow conventional commits.

### J7: Verify (FR-7)
Run tests, linting, and typechecks. 100% pass required.

### J8: Docs (FR-8)
Update `.agent/` memory bank and relevant `/docs/`.

### J9: Commit (FR-9)
Git commit with trailer: `Agent: Claude · Phase: Execution · Handoff: Review diffs`

## Principles
- **Justified:** Every action must have a clear rationale based on research.
- **Traceable:** Every step must be logged in `.agent/status.md`.
- **Safe:** Patient safety is paramount. All healthcare code must pass security scans.
