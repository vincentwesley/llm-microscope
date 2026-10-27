
# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

Modified from upstream: the rules are vendored locally (`rules.md`, pinned, see `SOURCES.md` at the repo root); this skill never fetches anything.

## How It Works

1. Read `rules.md` in this skill's directory (the full rule set and output format).
2. Read the specified files (or ask the user for a file/pattern).
3. Check against all rules in `rules.md`.
4. Output findings in the terse `file:line` format that `rules.md` specifies.

If no files are specified, ask the user which files to review.
