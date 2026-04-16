# PROGRESS.md — sentra-assist

## 2026-04-17 — Remote Migration to Avvicenna

**Event:** Repo pushed to primary GitHub account.

- **New remote:** `origin` → `https://github.com/Avvicenna/sentra-assist.git` (PRIVATE)
- **Old remote:** preserved as `origin-claudesy` → `https://github.com/Claudesy/sentra-assist.git`
- **Branch pushed:** `master` (tracking `origin/master`)
- **Migration commits:**
  - `2849963` — `chore: sync working state before remote migration to Avvicenna` (8 files: .agent logs + sidepanel UI refinement + .mcp.json)
  - `794ebd0` — `style: apply prettier formatting` (4 files, fix pre-push hook block)
- **Pre-push hook:** Prettier initially failed → re-run `npx prettier --write .` → second commit → push passed (Prettier + ESLint + TypeScript all green).
- **Rollback:** `git remote rename origin-claudesy origin` restores prior state.

---


<!-- Agent MUST update at every session end or completed JET phase. -->

## Current Status

**Last updated:** 2026-04-16
**Last session:** Cursor global `~/.cursor/mcp.json`: GitHub MCP switched from deprecated `@modelcontextprotocol/server-github` to official remote `api.githubcopilot.com/mcp/` (Chief must set PAT)
**Active phase:** VS Inference / TTV shipped as local commit (push deferred to Chief)

---

## ✅ Done

- [x] `Vitest` setup restored
- [x] `typecheck` restored to green
- [x] Manifest-driven version display enabled in settings
- [x] `.gitignore` added for local AI tooling and local build artifacts
- [x] Deprecated Medlink surface removed from active tree
- [x] `docs/superpowers/plans/` removed
- [x] `docs/superpowers/specs/` removed
- [x] `archieved/` removed
- [x] **NEW:** All 25 AGENTS.md files standardized to 9-section format across entire monorepo
- [x] Fix CI: upgrade pnpm 9 → 10 in `security.yml` to resolve retired npm audit endpoint (410 Gone)
- [x] Fix CI: move `continue-on-error: true` to job-level on SAST/CodeQL job to prevent hard failure when code scanning is disabled

---

## 🔄 In Progress

- [ ] Push `master` (or PR branch) after Chief approval — local commit includes VS Inference / TTV / thresholds / sidepanel styles
- [ ] Finalize deletion policy for remaining legacy tracked files in `git status`
- [ ] Normalize `.agent/` to be the only operational memory system

---

## ⏳ Next Candidates

- [ ] Refactor: extract `useTTVInference` + presentational subcomponents from [`components/clinical/TTVInferenceUI.tsx`](./components/clinical/TTVInferenceUI.tsx) (incremental PRs; preserve behavior)
- [ ] Audit historical references in `docs/codex-progress.md`
- [ ] Separate safe-to-commit deletes from items needing manual review

---

## 🚫 Blockers

- None

---

## Next Steps

1. Prepare a clean shortlist of final deletes vs files needing review before commit
2. Decide whether remaining historical references in `.agent/LESSONS.md` and `.agent/DECISIONS.md` should be left as history or superseded again
3. Review untracked files that are likely real additions versus local clutter

---

<!-- 2026-04-15 timestamp update — Claude Code -->

**Session 2026-04-15:** Timestamp updated as part of monorepo-wide PROGRESS.md batch sync. No code changes this session for this app. Awaiting next task assignment.
