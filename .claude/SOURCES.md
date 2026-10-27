# Third-party material

Copied from third-party repos at the pinned commit; lives under `references/` of the skill that uses it (not loaded as skills; zero cost until the skill reads it). Nothing runs on install; scripts run only when the owning skill invokes them.

| Repo | SHA | Licence | Used in |
| --- | --- | --- | --- |
| Leonxlnx/taste-skill | f624f37a8c650b9cc550253104925efe4c8de246 | MIT | `design-review/references/redesign-existing-projects` |
| nextlevelbuilder/ui-ux-pro-max-skill | 56ea9cf174ed86786187daa9de0e6247cb0747e4 | MIT | `design-review/references/ui-ux-pro-max` |
| vercel-labs/agent-skills | 063bee94c3f4df8453406c830b0a7df0f2860278 | no licence file in repo (1 KB wrapper; rewritten) | `design-review/references/web-design-guidelines/REFERENCE.md` |
| vercel-labs/web-interface-guidelines | 434b7f91364665f2f733b310ec54809bf8f37937 | MIT | `design-review/references/web-design-guidelines/rules.md` |
| addyosmani/agent-skills | aeac41d4d005999432bb7312f7ff06383a91d59d | MIT | `ship-batch/references/` (`security.md`, `hardening-patterns.md`, `security-checklist.md`) |

## Changes from upstream
- `web-design-guidelines`: rewritten to read local `rules.md` instead of fetching from raw.githubusercontent.com.
- `ui-ux-pro-max`: script paths point at `${CLAUDE_PLUGIN_ROOT}/skills/design-review/references/ui-ux-pro-max/`; removed `scripts/tests/` and `scripts/validate_data.py`. Local python search only; `--persist` writes `design-system/` only into the user-given `--output-dir`.
- All: SKILL.md renamed (REFERENCE.md / README.md / security.md) and frontmatter stripped so they are not skills; addy links repointed to sibling files.
- Not taken: image-generation skills, hooks, installers, CLI, platform templates.
