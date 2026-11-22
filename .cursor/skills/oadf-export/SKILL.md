---
name: oadf-export
description: Add an OADF v1 exporter to an archery application. Use when the user asks to export training data as Open Archery Data Format, an OADF package, or an oadf.zip, or to map sessions, scores, equipment, or sensor series into that package.
---

# OADF export in another application

You are adding an Open Archery Data Format version 1 **writer** to a host application. The contract is [OADF.md](https://github.com/inlinkz/oadf/blob/main/OADF.md). The oracle is the [example package](https://github.com/inlinkz/oadf/tree/main/example). In a checkout of this repository those files are `OADF.md` and `example/` at the root. Do not edit the spec unless asked. Import is out of scope.

## Before code

Read Package, Shared types, and Conformance in `OADF.md`, then walk `example/` from `example/oadf.yaml`. Match that shape. Do not invent a second encoding.

A package is a directory whose root holds `oadf.yaml`. A zip is transport only: unpacking restores the same tree. CSV samples and photos are sidecar files. Never inline sample matrices or image bytes in YAML.

Omit documents the host does not have. A solo package may omit the club file.

## Map host records

| Host | File |
| --- | --- |
| Archer | `people/<id>.person.yaml` |
| Club, optional | `<title>.club.yaml` |
| One dated practice | `archers/<id>/<YYYY-MM-DD>.session.yaml` |
| Distance or pass with per-arrow scores | `*.scorecard.yaml` |
| Counts without per-arrow scores | `*.bulk.yaml` |
| One gear item | `*.equipment.yaml`, plus an `id` / `rev` / `at` snapshot on the session |
| Dense samples | CSV sidecar plus a series descriptor |
| Photos | `media/` sidecar plus a media entry |

Paths are relative to the package root, use `/`, and do not escape the package. Private host fields go under `extensions.<toolId>`. Do not add them as new root keys.

## Writer rules

- Every YAML document starts with `oadf: 1` and `type`.
- Ids are lowercase letters, digits, and hyphens, start with a letter or digit, length 1–64.
- Times are UTC ISO-8601 with a `Z` suffix. Dates are `YYYY-MM-DD`.
- Face plots: origin at centre, +x right, +y up, radius 10 at the outer edge. If the host uses y-down, flip y. Emit at most one decimal place.
- Scores: `"X"` for an inner ten, integers `10`…`1`, `"M"` or `0` for a shot miss, omit a score that was not entered. Do not turn a blank into a miss.
- Series and shot attachment keys are 1-based `card.end.arrow` (example: `1.1.1`).
- CSV is UTF-8, comma-separated, `\n`, header on the first row, no comments. `kind: aim` columns are `yaw,pitch` in degrees. Other series use a `time` column or `hz` plus `origin` on the descriptor.
- Keep unknown keys you do not own and write them back unchanged.
- New devices, block types, and equipment types do not bump `oadf`. A breaking change does.

## Check

The package opens from `oadf.yaml`. Every path resolves from the package root. A small session — one person, one scorecard, one miss, one arrow with no score, one plotted point — matches the example's document shape.
