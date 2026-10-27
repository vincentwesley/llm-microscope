---
name: release-extension
description: Chrome Web Store release checklist for an MV3 extension: permissions justification, privacy policy, zip, store screenshots. Use when preparing to publish or update an extension.
---

Preparation only. The user uploads and submits in the Chrome Web Store dashboard.

1. **Manifest:** MV3, correct `version` (bump), `name`/`description` within store limits, 16/48/128 icons, minimum `permissions` and `host_permissions`. Remove anything unused; prefer `activeTab` and optional permissions over broad hosts.
2. **Permissions justification:** for each permission and host pattern, write one plain sentence: what feature needs it and why a narrower one will not do. Also the single-purpose statement and, if any remote code is absent, say "no remote code".
3. **Privacy policy:** short page stating what data is collected (ideally none), where it is stored (e.g. `chrome.storage` local only), no sale/sharing, no analytics unless disclosed, contact route. Host it (e.g. GitHub Pages) and add the URL. Must match the dashboard's data-use disclosures.
4. **Build and zip:** clean production build, no sourcemaps with secrets, no `node_modules`, no dev files. Zip the contents of the build folder (manifest.json at zip root). Check size and that the zip loads unpacked in a fresh profile (headless smoke test if possible; never a visible browser).
5. **Store assets:** at least one 1280x800 (or 640x400) screenshot, optional small promo tile 440x280; real screenshots of the real UI, no mock data presented as real. Short and detailed descriptions without keyword stuffing.
6. **Repo hygiene:** LICENSE, SECURITY.md, THIRD_PARTY_NOTICES for bundled libs, release tag and notes. Run `ship-batch` first.
7. Output a checklist with each item done / todo, plus the permission justification and policy text ready to paste.
