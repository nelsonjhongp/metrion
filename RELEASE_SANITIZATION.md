# Release Sanitization Checklist

## Current safeguards in the repo
- App data is stored under the Electron `userData` directory, not under the repository working directory.
- First run starts with an empty database: no default organizations, units, or automatic recovery from local reference files.
- Local-only files are excluded from version control through `.gitignore`:
  - `AGENTS.md`
  - `.agents/`
  - `.codex/`
  - local SQLite files and build artifacts
- Fiscal tests use synthetic fixture data stored in `src/shared/test-data/monthly-test-cases.json`.

## Pre-release verification
- Run `npm run clean:local-state`.
- Run `npm install`.
- Run `npm run build`.
- Run `npx tsx src/shared/monthly-calculations.test.ts`.
- Run `npx tsx src/shared/monthly-calculations.fixture.test.ts`.
- Run `npm run dist`.
- Launch `release/win-unpacked/Metrion.exe` and confirm the first run is empty.

## Published-history sanitization
- Install `git-filter-repo` before attempting the rewrite.
- Start from a clean working tree and a fresh backup clone.
- Remove historical private paths:
  - `AGENTS.md`
  - `.agents/`
  - `.codex/`
- Replace historical sensitive organization and unit identifiers with neutral placeholders.
- Force-push rewritten branches and tags.
- Tell collaborators to discard old clones and re-clone from the rewritten remote.

## After the history rewrite
- Re-run repo-wide searches for the retired identifiers you are removing from history.
- Re-run `git log --all -S "<retired-identifier>"`.
- Rebuild from a fresh clone and repeat the pre-release verification.
