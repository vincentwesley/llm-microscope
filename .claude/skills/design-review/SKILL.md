---
name: design-review
description: Iterative visual design review. Screenshot, critique against the project's tokens.css and design principles, list blockers/highs/nits, fix, re-shoot, max 3 rounds. Use after UI changes or when the user asks for a design pass.
---

Inspired by the design-review workflow in [OneRedOak/claude-code-workflows](https://github.com/OneRedOak/claude-code-workflows) (MIT). Written independently; no text copied.

Headless only; never open a visible browser.

## Loop (max 3 rounds)
1. **Shoot:** run the `visual-check` recipe (375/768/1280, dark and light) and read the PNGs.
2. **Critique** against, in order: the project's `tokens.css` (colours, spacing, type scale, radii must come from tokens, not ad-hoc values), `docs/design-principles.md` if present, the root CLAUDE.md house style if present (dark default, square corners, pixel-frame cards, reduced motion). Also check hierarchy, alignment, spacing rhythm, contrast, touch targets, empty/loading/error states, and mobile overflow.
3. **List** findings as `blocker` (broken, inaccessible, off-brand at a glance), `high` (clearly wrong), `nit` (polish). One line each with file/selector and the screenshot name.
   Optional lenses (read only what the change needs; the project's `tokens.css`/house style always wins over all of them), all under `references/`:
   - `web-design-guidelines/REFERENCE.md` (+`rules.md`): rule-by-rule code check, local only.
   - `redesign-existing-projects/REFERENCE.md`: checklist of generic-AI-look tells.
   - `ui-ux-pro-max/README.md`: UX/accessibility lookups via local python search (`scripts/search.py`).
4. **Fix** blockers and highs (nits only if cheap) with minimal diffs. Do not change behaviour.
5. **Re-shoot** and compare. Stop when no blockers/highs remain or after round 3; list what is left.
6. Report: rounds used, what was fixed, what remains. Optionally turn approved shots into Playwright `toHaveScreenshot` baselines if the user wants them.
