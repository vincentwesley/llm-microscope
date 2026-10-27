---
name: ship-batch
description: Wrap up a batch of work. Run checks, apply the public-readiness gate, update handoff notes, and offer a launch video. Never publishes anything by itself.
---

Never push, change repo visibility or publish without the user's explicit OK.

1. **Checks:** typecheck, unit tests, build, e2e, axe (use `visual-check` for screenshots and Lighthouse). Fix what you broke; report anything pre-existing.
2. **Public gate** (always for a public repo or before any visibility change; cheap sanity otherwise):
   - `LICENSE` is MIT with `Copyright (c) 2026 Vincent Wesley`; `SECURITY.md` exists; `package.json` has `license`, `author`, `repository`.
   - No secrets, tokens or keys; `.env*` ignored (only `.env.example` with names); no `.claude/settings.json` hooks tracked.
   - No personal data in tracked files: real emails (only the noreply is allowed), phone numbers, absolute local user-profile paths. Quick scan: `git grep -nIiE 'C:(\\|/)+Us[e]rs|/home/[a-z]+/|@(gmail|hotmail|outlook|yahoo|icloud)\.'`.
   - No `preinstall`/`install`/`postinstall`/`prepare` scripts; lockfile committed; CI uses `npm ci --ignore-scripts`, least-privilege `permissions:`, SHA-pinned actions.
   - Third-party assets licence-checked and listed in `THIRD_PARTY_NOTICES.md`; personal art/content marked all-rights-reserved in `NOTICE.md`.
   - Commit authors are all `vincentwesley` noreply: `git log --all --format='%an <%ae>' | sort -u`.
   - Before any push touching network, auth, secrets or user input, run the `security-and-hardening` skill first, then `security-review`.
   - Run `security-review` if auth, secrets, tokens, user input, network calls or CSP/headers changed.
3. **Handoff:** update `docs/next-session.md` (Before anything / How to work here / Current state / Known gaps) and the project's memory line. Current state only, not a log.
4. **Commit locally** as the vincentwesley identity if the user asked for commits.
5. **Offer** `/brag-slim` for a launch video if the project is user-facing. Offer only; do not run it unprompted.
6. Report in a few lines: checks, gate result, anything blocking publication.

Before any push touching network, auth, CSP/headers or secrets, read `references/security.md` (links `hardening-patterns.md`, `security-checklist.md`).
