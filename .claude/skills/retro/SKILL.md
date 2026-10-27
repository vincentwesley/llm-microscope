---
name: retro
description: Append a short retrospective of the current session or batch to docs/RETRO.md. Use at the end of a work session or phase, or when the user asks for a retro.
---

1. Gather facts: `git log --oneline` since the last retro entry (or last ~10 commits), `docs/next-session.md`, and what happened in this session.
2. Create `docs/RETRO.md` with `# Retro` if absent. **Append** (never rewrite earlier entries) a section:

```
## YYYY-MM-DD - <batch/phase name>
- Shipped: ...
- Went well: ...
- Went badly / surprises: ...
- Do differently next time: ...
```

3. Keep it to 3-6 short bullets total. Facts, not narration; no secrets, personal data or absolute local paths.
4. Do not commit unless asked.
