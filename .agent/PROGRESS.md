# PROGRESS.md — sentra-assist
<!-- Agent MUST update at every session end or completed JET phase. -->

## Current Status

**Last updated:** 2026-04-16  
**Last session:** Fix GitHub Actions security workflow failures (pnpm audit endpoint retired + CodeQL permission error)  
**Active phase:** Complete ✅

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

- [ ] Finalize deletion policy for remaining legacy tracked files in `git status`
- [ ] Normalize `.agent/` to be the only operational memory system

---

## ⏳ Next Candidates

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
