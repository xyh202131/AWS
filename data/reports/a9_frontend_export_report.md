# A9 First Round Report - Frontend And Export

Scope: local-only first round. No source file edits.

## Current Status

The frontend supports the basic demo chain:

```text
Import JSON -> Generate Board -> Manual Override -> Export Submission -> Export Brief
```

It is not yet strict enough for the full multi-agent data pipeline.

## P0 Gaps

1. Runtime import validation is too weak.
2. Export should block clearly invalid board states.
3. Submission JSON needs more provenance and validation fields.
4. README should document that `数据/` is raw input and `data/final/final_import_bundle.json` is the frontend import target.

## P1 Gaps

1. Show lightweight data quality status in the page.
2. Export milestone `type` and future `dependsOnFields`.
3. Add data quality, source coverage, manual overrides, and warnings to the brief.

## P2 Enhancements

1. Support A6 weight presets.
2. Support A7 scenario/disputed pick display.
3. Extend `ImportBundle` metadata only after Supervisor approval.

## Important Rule

The frontend should not import raw CSV/XLSX/PPT/video files from `数据/` directly. A1-A3 should first produce:

```text
data/final/final_import_bundle.json
```
