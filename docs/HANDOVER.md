# Handover

## ⚠️ Your one-time steps
1. **Switch GitHub Actions off** (the session couldn't: `gh api … /actions/permissions` is blocked from the cloud sandbox with HTTP 403). Go to Settings › Actions › General › "Disable actions". Until then nothing has been pushed, because `ci.yml` and `automerge.yml` would run and use minutes. All work is in local commits on `claude/relaxed-bohr-e8q7ik`.
2. Then tell a session to push and open/merge the PR (it merges via `gh api -X PUT repos/vincentwesley/llm-microscope/pulls/<n>/merge -f merge_method=squash`).
3. **Cloudflare Pages**: Workers & Pages › Create › Pages › Connect to Git › `vincentwesley/llm-microscope`, production branch `main`, build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=24`. No secrets needed.
4. Optional: a custom domain in the Pages project.

## Template notes
- `.github/workflows/ci.yml` calls the reusable workflow in `vincentwesley/house` (private), which a public repo can't use. It is left unused (starters PR #6 is meant to fix this). Don't re-enable Actions without fixing it.

## State
See `docs/next-session.md` for what's done and what's next.
