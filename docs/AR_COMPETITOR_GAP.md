# AR Competitor Gap: Snooker Coach 147 vs Snooker Lab

Last updated: 2026-04-04

## Snapshot

- Benchmark app: `Snooker Coach 147` (public App Store listing + vendor site messaging).
- Key AR claim: real-time projection of routine layouts onto the physical table.
- Main differentiator: support for custom routines + AR projection of custom setups.

## Feature Gap Matrix

| Capability | Snooker Coach 147 | Snooker Lab (current) | Gap |
| --- | --- | --- | --- |
| AR entry from routine flow | Yes | Yes | Closed |
| Table overlay frame | Yes | Yes | Closed |
| Spot markers (black/pink/blue/etc.) | Yes | Yes | Closed |
| Routine-specific overlays | Yes | Partial (preset by routine/category) | Medium |
| Calibration controls | Yes (plane/AR viewer behavior) | Partial (manual nudge/scale lock) | Medium |
| Custom routine editor -> AR projection | Yes | No | High |
| Setup verification flow | Implied | Yes (checklist + marker verification + score) | Closed |
| Setup history and trend tracking | Unclear | No | Medium |
| Robust AR fallback messaging | Yes (compatibility noted publicly) | Partial | Low |

## What We Improved In This Iteration

- Added routine-aware overlays (line-up, T routine, safety, long-pot, cue-ball-control, fallback).
- Added practical calibration controls (move overlay, zoom overlay, reset, lock calibration).
- Added overlay mode switching (`combined`, `spots`, `routine`) for clearer setup flow.
- Added clearer progress model (spots verified, routine targets verified, calibration state).
- Updated confidence score to reward calibration and routine-target verification.

## Highest-Impact Next Moves

1. Add per-routine saved calibration profile so users do not recalibrate every session.
2. Add setup session persistence (date, routine, confidence, missed markers) and trend view.
3. Add custom routine table editor and map editor targets directly into AR overlays.
4. Add optional guided sequence mode (one target at a time with pass/fail notes).
5. Add device capability checks and explicit fallback copy for unsupported AR devices.

## Practical Product Positioning

- Keep calling current version "AR Setup Assist (Beta)" while calibration and overlays mature.
- Position as "fast setup consistency" rather than "fully automatic AR detection".
- Once setup history and custom editor are live, position as "practice system" rather than just camera overlay.
