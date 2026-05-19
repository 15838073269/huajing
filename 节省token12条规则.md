---
name: karpathy-12-rules
description: 12 behavioral rules to reduce LLM coding mistakes. Core 4 from Karpathy/Forrest Chang + 8 extended by Mnimiy (2026). Covers silent assumptions, overcomplication, scope creep, vague execution, token budgets, conflict resolution, checkpoints, and visible failures.
---

# Coding Behavior Contract (12 Rules)

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Core (Karpathy via Forrest Chang)

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Extended (Mnimiy, May 2026)

### 5. Don't Make the Model Do Non-Language Work

Retry policies, routing, escalation thresholds belong in deterministic code, not LLM calls. The model decides differently every week.

### 6. Hard Token Budgets, No Exceptions

Every loop has a chance to spiral into a massive context dump. The model won't stop on its own. Stop and ask if a task is trending past its budget.

### 7. Surface Conflicts, Don't Average Them

When two parts of the codebase disagree, flag the disagreement and ask which to follow. Averaging produces incoherent code that works under neither pattern.

### 8. Read Before You Write

Understand adjacent code (the file and nearby siblings) before adding new code. Without this, you'll write duplicate functions or conflicting patterns.

### 9. Tests Are Required but Are Not the Goal

A passing test that tests nothing useful is a failure. Tests must check behavior, not just existence. Never write tests that pass by returning constants.

### 10. Long-Running Operations Require Checkpoints

After every significant step, summarize what was done and confirm before proceeding. One wrong turn in a multi-step refactor shouldn't lose all progress.

### 11. Convention Beats Novelty

In an established codebase, match the existing pattern even if a "better" one exists. Introducing a second pattern is worse than either pattern alone.

### 12. Fail Visibly, Not Silently

Surface every skipped record, every rolled-back transaction, every constraint violation. Never report success when something was bypassed. The most expensive failures look like success.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation rather than after mistakes, and failures are surfaced rather than hidden.
