# Contributing to Sentra Assist

Thank you for your interest in contributing to Sentra Assist! This document outlines the workflow, standards, and expectations for all contributors.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Development Workflow](#development-workflow)
3. [Pull Request Process](#pull-request-process)
4. [Coding Standards](#coding-standards)
5. [Commit Message Guidelines](#commit-message-guidelines)
6. [Getting Help](#getting-help)

---

## Code of Conduct

- Be respectful and constructive in all interactions.
- Prioritize patient safety and data privacy in every change.
- Never commit PII/PHI, credentials, or API keys.
- Assume positive intent and provide actionable feedback.

---

## Development Workflow

### 1. Set Up Your Environment

```powershell
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Verify quality gates pass on a clean checkout
pnpm --filter @the-abyss/sentra-assist quality
```

### 2. Pick or Create an Issue

- Check existing issues before starting new work.
- For large changes, open a discussion issue first.
- Assign yourself to the issue to avoid duplicate work.

### 3. Create a Branch

Use descriptive branch names:

```powershell
git checkout -b feat/diagnosis-confidence-meter
git checkout -b fix/rme-extractor-bpjs-label
git checkout -b docs/api-endpoint-examples
```

Prefix conventions:

- `feat/` — new feature
- `fix/` — bug fix
- `docs/` — documentation only
- `refactor/` — code restructuring
- `test/` — test additions or fixes
- `chore/` — maintenance tasks

### 4. Make Your Changes

- Follow the [JET Workflow Protocol](AGENTS.md#3-jet-workflow-protocol) for all non-trivial tasks.
- Keep changes focused and minimal.
- Prefer editing existing files over creating new ones.
- Add tests for any new logic or bug fixes.

### 5. Run Quality Gates

Before pushing, ensure all quality gates pass:

```powershell
pnpm --filter @the-abyss/sentra-assist test
pnpm --filter @the-abyss/sentra-assist test:contract
pnpm --filter @the-abyss/sentra-assist lint
pnpm --filter @the-abyss/sentra-assist typecheck
pnpm --filter @the-abyss/sentra-assist format
```

### 6. Update Documentation

- Update `.agent/PROGRESS.md` with your changes.
- Append a session log to `.agent/sessions/YYYY-MM-DD.md`.
- Update relevant ADRs or architecture docs for structural changes.

---

## Pull Request Process

### Before Opening a PR

- [ ] All tests pass (`test`, `test:contract`).
- [ ] Linting and type-checking pass.
- [ ] No secrets or PII in the diff.
- [ ] Documentation is updated.
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

### Opening a PR

1. Push your branch to the remote.
2. Open a Pull Request using the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
3. Link related issues in the PR description.
4. Request review from at least one team member.

### PR Review Expectations

Reviewers will verify:

- Functionality and correctness
- Type safety and strict TypeScript compliance
- Error handling and edge cases
- Security and privacy implications
- Test coverage and quality
- Performance impact
- Accessibility compliance
- Documentation completeness

Address all review comments before merging.

### Merging

- Only merge after at least one approval.
- Use **Squash and Merge** for clean history if the branch has many small commits.
- Ensure the commit trailer is present: `Agent: [Name] · Phase: Execution · Handoff: [session-id]`.

---

## Coding Standards

All contributions must follow the standards defined in:

- [`CODING_STANDARD.md`](CODING_STANDARD.md) — TypeScript, React, Tailwind, security, and testing standards
- [`AGENTS.md`](AGENTS.md) — Operational protocols, code review checklist, and JET workflow

Key highlights:

- TypeScript `strict: true`
- Explicit return types on exported functions
- No silent catch blocks
- Never log PII/PHI
- 80%+ unit test coverage
- Co-located test files (`*.test.ts`, `*.test.tsx`)

---

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[(optional scope)]: <description>

[optional body]

[optional footer(s)]
```

Types:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `style:` — formatting, missing semicolons, etc.
- `refactor:` — code restructuring without behavior change
- `test:` — test additions or fixes
- `chore:` — build process, dependency updates, etc.

Example:

```
feat(diagnosis): add confidence meter to differential cards

- Introduces a visual confidence indicator for each suggested diagnosis
- Uses color-coded badges based on threshold rules
- Adds unit tests for confidence scoring utility

Agent: Claude · Phase: Execution · Handoff: 2026-04-16-a1
```

---

## Getting Help

- **Technical questions:** Open a discussion or ask in the team channel.
- **Code review:** Request review from a senior team member via PR.
- **Urgent issues:** Follow the [Emergency Procedures](AGENTS.md#10-emergency-procedures).
- **Primary contact:** Chief / Claudesy

---

_Last updated: 2026-04-16 | Owner: Chief_
