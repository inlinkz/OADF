# Open Archery Data Format

**Version 1**

OADF is a file package for archery training data: clubs, people, programmes, sessions, scores, equipment, sensor series, and photos.

It is designed so the same package can be:

- read by an LLM (plain YAML and CSV, explicit fields, stable ids),
- validated and pretty-printed by a formatter,
- loaded into statistics tools (tables, joins on ids and timestamps).

## Design goals

| Goal | How |
| --- | --- |
| Extensible | Unknown keys and unknown `type` / device ids are kept. New series devices need no schema bump. |
| LLM-friendly | One fact, one place. Descriptive field names. Short documents. Units next to values. |
| Formatter-friendly | Strict YAML documents with a required `oadf` + `type`. Deterministic key order is recommended, not required. |
| Stats-friendly | Scores are structured rows. Dense samples are CSV with a header. Times are UTC ISO-8601. Paths are relative to the package root. |

## Package

An OADF package is a directory (or a zip of that directory). The root contains `oadf.yaml`. All paths in documents are relative to that root, using `/` separators.

```text
oadf.yaml
Athens Archery.club.yaml
people/maria.person.yaml
programmes/form-block.programme.yaml
archers/maria/2026-10-20.session.yaml
archers/maria/scorecards/2026-10-20-1820.scorecard.yaml
archers/maria/bulk/2026-10-20-1802.bulk.yaml
archers/maria/series/heart-2026-10-20.csv
archers/maria/media/end-1-1.jpg
archers/maria/equipment/indoor-recurve.equipment.yaml
targets/wa-full.target.yaml
```

A zip is only transport. Unpacking restores the same tree. The archive is not a document type.

Solo use is a package with one person and no club file. Club and coaching are optional.

## Documents

| Type | File name pattern | Role |
| --- | --- | --- |
| `manifest` | `oadf.yaml` | Package version and optional index |
| `club` | `*.club.yaml` | Members and coach→archer links |
| `person` | `*.person.yaml` | One archer and/or coach |
| `programme` | `*.programme.yaml` | Multi-session plan, no scores |
| `session_template` | `*.session-template.yaml` | One practice plan, no date |
| `session` | `*.session.yaml` | One dated practice |
| `scorecard` | `*.scorecard.yaml` | Scored arrows |
| `bulk` | `*.bulk.yaml` | Arrow counts without per-arrow scores |
| `equipment` | `*.equipment.yaml` | One gear item and its revisions |
| `target` | `*.target.yaml` | One face, known or custom |
| series | `*.csv` | Dense samples (sidecar) |
| media | `*.jpg` / `*.png` / `*.webp` / `*.heic` | Photos (sidecar) |

YAML documents are UTF-8. Writers use `\n`. Readers accept `\r\n`. JSON with the same object shape is an allowed alternate encoding for any YAML document kind; the file then ends in `.json` instead of `.yaml` (for example `*.session.json`).

Every YAML document starts with:

```yaml
oadf: 1
type: scorecard
```

| Key | Required | Meaning |
| --- | --- | --- |
| `oadf` | yes | Schema major version. This document is `1` |
| `type` | yes | Document kind from the table above (`manifest` uses `type: manifest`) |

Unknown top-level keys are ignored by readers that do not understand them and must be written back unchanged when a tool rewrites the file. The same rule applies inside objects.

### Manifest

```yaml
oadf: 1
type: manifest
title: Athens Archery — Maria package
club: Athens Archery.club.yaml
people:
  - people/maria.person.yaml
  - people/elena.person.yaml
  - people/nikos.person.yaml
extensions: {}
```

| Key | Required | Meaning |
| --- | --- | --- |
| `title` | no | Package label |
| `club` | no | Path to the club document |
| `people` | no | Paths to person documents |
| `extensions` | no | Map for tool-specific package metadata |

The manifest does not list every session. Tools discover files by extension and `type`.

## Shared types

**Id.** Lowercase letters, digits, and hyphens. Starts with a letter or digit. Length 1–64. Examples: `maria`, `mantis`, `indoor-recurve`.

**Path.** Relative to the package root. No leading `/`. No `..` segments that escape the package.

**Calendar date.** `YYYY-MM-DD`. Must be a real date.

**UTC time.** ISO-8601 with `Z`, optional fractional seconds. Example: `2026-10-20T13:46:12.340Z`.

**Face point.** Origin at target centre. +x right, +y up. Face radius is 10 (outer edge of a full face). Writers emit at most one decimal place for scores plots; readers accept more.

**Score.** One of:

| Value | Points | Meaning |
| --- | --- | --- |
| `"X"` | 10 | Inner ten when the face has one |
| `10` … `1` | that value | Ring score (YAML integer) |
| `"M"` or `0` | 0 | Miss; the arrow was shot |
| `null` / omitted | none | Not entered |

`X` counts as a ten in totals. Whether a plotted `10` sits in an inner ten is an app face rule; the file stores what was entered.

**Quantity.** Object with `value` (number) and `unit` (string). Example: `{ value: 18, unit: m }`.

**Indoor.** `indoor: true` is a hall. `indoor: false` is outdoor. Omit the key when it was not recorded.

**Weather.** Conditions that can move an arrow. Omit `weather` when nothing was recorded, and omit any key inside it that was not observed. Do not write zeros for an unknown wind.

```yaml
weather:
  sky: cloudy
  temperature: { value: 12, unit: C }
  humidity: 70
  pressure: { value: 1013, unit: hPa }
  wind:
    speed: { value: 4, unit: m/s }
    from: 270
    source: left
```

| Key | Required | Meaning |
| --- | --- | --- |
| `sky` | no | Open token: `clear`, `partly-cloudy`, `cloudy`, `drizzle`, `rain`, `snow`, `fog`. Others are kept |
| `temperature` | no | Quantity. Unit `C` or `F` |
| `humidity` | no | Relative humidity, percent, 0–100 |
| `pressure` | no | Quantity. Unit `hPa` |
| `wind.speed` | no | Quantity. Prefer `m/s`. `Bft` is allowed for a Beaufort estimate |
| `wind.from` | no | Degrees, 0–360. The direction the wind comes from. 0 is north, clockwise |
| `wind.source` | no | Where the wind comes from as the archer faces the target: `head`, `tail`, `left`, `right`, `head-left`, `head-right`, `tail-left`, `tail-right` |

Record `weather` on the session. Repeat it on a scorecard or bulk document when that pass differed, or when the file is kept without the session. Indoor air may still have temperature and humidity. Omit wind when there was none to record.

**Extension map.** Any object under `extensions` is namespaced by tool id:

```yaml
extensions:
  rcherry:
    liveCode: AB12
  other-app:
    note: kept even if unknown here
```

## Club

```yaml
oadf: 1
type: club
id: trilofos-archery
title: Athens Archery
description: Indoor hall club.
members:
  - { person: maria, roles: [archer] }
  - { person: elena, roles: [coach] }
  - { person: nikos, roles: [coach, archer] }
coaching:
  - { coach: elena, archers: [maria, nikos] }
  - { coach: nikos, archers: [maria] }
```

| Key | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable club id |
| `title` | yes | Display name |
| `description` | no | Free text |
| `members` | yes | Membership list |
| `members[].person` | yes | Person id |
| `members[].roles` | yes | Non-empty. Known: `archer`, `coach`. Others kept |
| `coaching` | no | Coach→archer assignments |
| `coaching[].coach` | yes | Person id |
| `coaching[].archers` | yes | Person ids (one coach, many archers) |

An archer may appear under more than one coach. Roles on membership are not the same as coaching links.

## Person

```yaml
oadf: 1
type: person
id: maria
title: Maria P.
club: trilofos-archery
```

| Key | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable person id |
| `title` | yes | Display name |
| `club` | no | Club id |
| `description` | no | Free text |

## Programme

A programme is publishable and self-contained. It holds no scores and no file paths to recorded sessions.

```yaml
oadf: 1
type: programme
id: form-block
title: Form block
description: Two practices. Volume, then a scored card.
units:
  - index: 1
    title: Volume
    blocks:
      - type: text
        body: Blank bale only. Stop at 120 arrows.
      - type: bulk
        label: Blank bale
        targetArrows: 120
  - index: 2
    title: Score
    blocks:
      - type: text
        body: One WA 18 card. Record the sight if it is connected.
      - type: scorecard
        label: WA 18
        devices: [mantis, heart-rate, wii-balance]
        config:
          endsPerCard: 2
          arrowsPerEnd: 3
          cards: 1
          round: WA 18 (40cm)
          distance: { value: 18, unit: m }
          face: { value: 40, unit: cm }
          indoor: true
```

`units[].index` is 1-based and unique. Block `type` values in version 1: `text`, `scorecard`, `bulk`. Unknown block types are kept.

## Session template

Same block list as a programme unit, without a date and without recorded paths.

```yaml
oadf: 1
type: session_template
title: WA 18
blocks:
  - type: text
    body: Twenty arrows on the blank bale, then one scored card.
  - type: bulk
    label: Blank bale
  - type: scorecard
    label: WA 18
```

## Session

One practice on one calendar date. Recorded arrows live in linked scorecard and bulk files.

```yaml
oadf: 1
type: session
date: 2026-10-20
archer: maria
programme: form-block
unit: 2
programmePath: programmes/form-block.programme.yaml
location: Club hall
indoor: true
weather:
  temperature: { value: 19, unit: C }
  humidity: 45
equipment:
  - { id: indoor-recurve, type: bow, title: Indoor recurve, rev: 1, at: 2026-09-01T08:00:00Z }
blocks:
  - type: text
    body: Twenty arrows on the blank bale, then one scored WA 18 card.
  - type: bulk
    label: Blank bale
    path: archers/maria/bulk/2026-10-20-1802.bulk.yaml
  - type: scorecard
    label: WA 18
    path: archers/maria/scorecards/2026-10-20-1820.scorecard.yaml
series:
  - device: heart-rate
    attach: file
    path: archers/maria/series/heart-2026-10-20.csv
media:
  - kind: photo
    attach: file
    path: archers/maria/media/session-hall.jpg
```

| Key | Required | Meaning |
| --- | --- | --- |
| `date` | yes | Calendar date |
| `archer` | no | Person id |
| `programme` | no | Programme id |
| `unit` | no | 1-based unit index |
| `programmePath` | no | Path to the programme file |
| `location` | no | Free text |
| `indoor` | no | `true` hall, `false` outdoor. Omit when not recorded |
| `weather` | no | Conditions for the practice (see Weather) |
| `equipment` | no | Gear used that day (see Equipment references) |
| `blocks` | yes | Ordered steps |
| `series` | no | Series attachments for the whole practice |
| `media` | no | Media attachments for the whole practice |

Empty `path` on a scorecard/bulk block means the step exists but has not been started.

## Scorecard

```yaml
oadf: 1
type: scorecard
archer: maria
session: archers/maria/2026-10-20.session.yaml
round: WA 18 (40cm)
distance: { value: 18, unit: m }
face: { value: 40, unit: cm }
target: wa-full
indoor: true
location: Club hall
grid:
  endsPerCard: 2
  arrowsPerEnd: 3
  cards: 1
notes:
  training: Quiet hall, first scoring end.
  cards: [Watch the left hand.]
equipment:
  - { id: indoor-recurve, type: bow, title: Indoor recurve, rev: 1, at: 2026-09-01T08:00:00Z }
cards:
  - ends:
      - note: Held long on the second arrow.
        arrows:
          - { score: X, x: 0.1, y: 0.2, at: 2026-10-20T13:46:12.340Z }
          - { score: 9, x: 1.0, y: -0.5, at: 2026-10-20T13:46:18.100Z }
          - { score: 8, x: -0.4, y: 0.6, at: 2026-10-20T13:46:30.000Z }
      - note: Called the first arrow out.
        arrows:
          - { score: M, x: 8, y: 3, at: 2026-10-20T13:50:00.000Z }
          - { score: 10, at: 2026-10-20T13:50:12.000Z }
          - { at: 2026-10-20T13:50:20.000Z }
series:
  - device: mantis
    kind: aim
    attach: shot
    key: 1.1.1
    path: archers/maria/series/aim-1-1-1.csv
    hz: 400
    origin: release
    breakIndex: 1
    unit: deg
media:
  - kind: photo
    attach: end
    key: "1.1"
    path: archers/maria/media/end-1-1.jpg
  - kind: photo
    attach: shot
    key: "1.1.2"
    path: archers/maria/media/shot-1-1-2.jpg
```

### Grid and cards

| Key | Required | Meaning |
| --- | --- | --- |
| `grid.endsPerCard` | yes | Planned rows per card (1–60) |
| `grid.arrowsPerEnd` | yes | Planned arrows per end (1–24) |
| `grid.cards` | yes | Planned card count (1–10) |
| `cards` | yes | Recorded cards in order |

Each card has `ends` (array). Each end has:

| Key | Required | Meaning |
| --- | --- | --- |
| `arrows` | yes | Length may be shorter than `arrowsPerEnd`; missing slots are not entered |
| `note` | no | Free text for that end |

Each arrow object:

| Key | Required | Meaning |
| --- | --- | --- |
| `score` | no | Score value as above |
| `x`, `y` | no | Face point |
| `at` | no | UTC release / entry time |
| `target` | no | Target id when this arrow used a different face from the card |

Empty arrow `{}` is allowed. A timed but unscored shot is `{ at: ... }` only. Omit `target` when the arrow used the card face.

Card index, end index, and arrow index are **1-based** when used as keys (`1.1.2` = card 1, end 1, arrow 2).

### Totals

Writers may omit cached totals. Readers and stats tools recompute:

- points: `X`→10, `M`/`0`→0, integers as written,
- only arrows with a score count,
- blank / timed-only arrows do not count as misses.

### Attachment keys

| `attach` | `key` |
| --- | --- |
| `shot` | `card.end.arrow` (example `1.1.2`) |
| `end` | `card.end` (example `1.1`) |
| `round` | bulk round number as string or integer |
| `file` | omit `key` |

### Face

| Key | Required | Meaning |
| --- | --- | --- |
| `target` | no | Target id. The face for every arrow on this card |
| `face` | no | Diameter shot that day |

## Target

One face, one file. The scorecard names it with `target`. The diameter of that pass stays on the scorecard as `face`.

```yaml
oadf: 1
type: target
id: wa-full
title: WA Full
kind: wa-full
```

| Key | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable id |
| `title` | yes | Display name |
| `kind` | no | Open token for a known face: `wa-full`, `wa-6-ring`, `vegas-3-spot`, … Unknown kinds are kept |
| `zones` | no | Drawn regions. Present when the face is custom |
| `spots` | no | Extra spot centres. Omit for one face centred on the origin |

A reader that knows `kind` draws that face without `zones`. A custom face omits `kind` and lists `zones`. When both are present, `zones` are the picture in this package.

Coordinates match face points: origin at centre, +x right, +y up, radius 10 at the outer edge of the full face.

Zone order is hit priority. The first zone that contains a point wins. `score` on a zone is its label. The arrow keeps the score that was entered.

| Key | Required | Meaning |
| --- | --- | --- |
| `score` | yes | Points label for that region |
| `shape` | yes | `circle`, `polygon`, or `bezier` |
| `fill` | no | Hex colour, such as `#F6EB0F` |
| `r`, `cx`, `cy` | circle | Radius, and an optional centre. The default centre is the origin |
| `points` | polygon | `[x, y]` vertices, at least 3 |
| `nodes` | bezier | Closed chain. Each node is `x`, `y`, `inX`, `inY`, `outX`, `outY` |

Without `spots`, zones sit on the full face. With `spots`, each spot is `{ x, y, r }` in full-face space, and zones are local to a spot, where radius 10 is that spot's edge. Arrow `x` and `y` stay in full-face space either way.

```yaml
oadf: 1
type: target
id: blank-spot
title: Blank spot
zones:
  - { score: 5, fill: "#F6EB0F", shape: circle, r: 2 }
  - { score: 0, fill: "#B7B7B7", shape: circle, r: 10 }
```

## Bulk

```yaml
oadf: 1
type: bulk
archer: maria
location: Club hall
indoor: true
distance: { value: 5, unit: m }
rounds:
  - { arrows: 20, at: 2026-10-20T16:02:14.742Z }
  - { arrows: 10, at: 2026-10-20T16:03:25.589Z }
series:
  - device: wii-balance
    attach: round
    key: 1
    path: archers/maria/series/balance-round-1.csv
```

| Key | Required | Meaning |
| --- | --- | --- |
| `rounds` | yes | In commit order |
| `rounds[].arrows` | yes | Integer ≥ 1 |
| `rounds[].at` | yes | UTC time |

## Series (CSV sidecars)

Dense samples never live inside YAML. YAML holds a descriptor; CSV holds rows.

### Descriptor fields (on session, scorecard, or bulk)

| Key | Required | Meaning |
| --- | --- | --- |
| `device` | yes | Device id (`mantis`, `heart-rate`, `wii-balance`, or any new id) |
| `attach` | yes | `shot` / `end` / `round` / `file` |
| `key` | when not `file` | Attachment key |
| `path` | yes | Package path to the CSV |
| `kind` | no | Registered meaning. Version 1 registers `aim` |
| `channels` | no | Column schema when not implied by `kind` |
| `hz` | no | Sample rate when time is implicit |
| `origin` | no | `release` or `start` |
| `breakIndex` | no | Sample index of release when `origin: release` |
| `unit` | no | Shared unit when all channels share one |
| `time` | no | `iso` when the CSV first column is UTC time |

Identity of a payload: `device` + `attach` + `key` (+ owning file). If duplicated, readers use the first and still preserve the rest on rewrite.

### CSV rules

- UTF-8, `,` separator, `\n` lines.
- First row is a header.
- Numbers are finite decimals. Empty cells are missing values.
- Writers do not put comments in CSV.

**Aim (**`kind: aim`**).** Columns: `yaw,pitch` in degrees. +yaw right, +pitch up. Sample `i` is at `(i - breakIndex) / hz` seconds from release when `origin: release`. No time column.

```csv
yaw,pitch
0.012,-0.004
0,0
-0.020,0.008
```

**Generic series.** Either:

1. `time` column (ISO UTC) plus one column per channel, or
2. no time column, with `hz` + `origin` on the descriptor (row index → time).

Heart rate example descriptor: `device: heart-rate`, `attach: file`, `time: iso`. CSV:

```csv
time,bpm
2026-10-20T13:46:10.000Z,74
2026-10-20T13:46:12.340Z,78
```

Balance around release: channels `tr,br,tl,bl` in kg; `hz` + `origin: release` + `breakIndex`.

Channel names are unique within one CSV. Units belong on the descriptor (`channels: [{ name: bpm, unit: bpm }]`) so stats tools and LLMs do not guess.

### Limits (version 1)

| Field | Range |
| --- | --- |
| Scorecard cards | 1–10 |
| Ends per card | 1–60 |
| Arrows per end | 1–24 |
| Bulk arrows in one round | integer ≥ 1 |
| Series sample rate | 1–4000 Hz |
| Aim window before/after release | 1–15 s when given |
| Aim samples in one trace | 2–13000 |

## Media

Binary files only. YAML descriptors list them; bytes are never inlined.

```yaml
media:
  - kind: photo
    attach: end
    key: "1.1"
    path: archers/maria/media/end-1-1.jpg
```

| Key | Required | Meaning |
| --- | --- | --- |
| `kind` | yes | `photo` in version 1; other kinds kept |
| `attach` | yes | Same as series |
| `key` | when not `file` | Same as series |
| `path` | yes | Path to the binary |

## Equipment

One physical item, one file, full revision history. `props` on each revision is the full state after the change, not a patch.

```yaml
oadf: 1
type: equipment
id: indoor-recurve
equipmentType: bow
title: Indoor recurve
brand: hoyt
owner: maria
description: Hall bow.
revisions:
  - rev: 1
    at: 2026-09-01T08:00:00Z
    props:
      bowType: recurve
      size: { value: 68, unit: in }
      drawWeight: { value: 34, unit: lb }
      parts: [shibuya-ultima, longrod-30, string-8190]
  - rev: 2
    at: 2026-11-02T18:00:00Z
    props:
      bowType: recurve
      size: { value: 68, unit: in }
      drawWeight: { value: 34, unit: lb }
      limbs: Wiawis NS
      parts: [axcel-achieve, longrod-30, string-8190]
media:
  - kind: photo
    attach: file
    path: archers/maria/media/indoor-recurve.jpg
```

| Key | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable id |
| `equipmentType` | yes | Open token: `bow`, `arrow`, `sight`, `stabilizer`, `weight`, `string`, `brand`, … |
| `title` | yes | Display name |
| `brand` | no | Brand equipment id |
| `owner` | no | Person id |
| `revisions` | yes | Ordered; `rev` ≥ 1 unique; `at` UTC |

The state at time T is the revision with the greatest `at` ≤ T.

Field name is `equipmentType` so it does not clash with document `type`.

### Reference from a session or scorecard

```yaml
equipment:
  - id: indoor-recurve
    type: bow
    title: Indoor recurve
    rev: 1
    at: 2026-09-01T08:00:00Z
```

`id` is required. `type`, `title`, `rev`, and `at` snapshot the day so the practice still reads if the equipment file is missing.

### Known property keys by `equipmentType`

| `equipmentType` | Property keys |
| --- | --- |
| `bow` | `bowType`, `size`, `drawWeight`, `braceHeight`, `tiller`, `limbs`, `string`, `nockingPoint`, `parts` |
| `arrow` | `spine`, `length`, `diameter`, `pointWeight`, `vanes`, `nock`, `count` |
| `stabilizer` | `role`, `length`, `weights` |
| `weight` | `mass`, `mount` |
| `sight` | `extension`, `magnification`, `marks` |
| `string` | `mountedOn`, `strands` |
| `brand` | none required |

Measured values use `{ value, unit }`. `marks` is `[{ distance, unit, mark }]`. Unknown property keys are kept.

## Extensibility

1. **New device.** Add a series descriptor with a new `device` id, `channels` with units, and a CSV. No schema version bump.
2. **Registered kind.** When several apps share meaning (as with `aim`), document a `kind` and its columns in a newer OADF major version. Until then, `channels` on the descriptor is enough.
3. **New session block.** New `blocks[].type` string + fields. Older tools keep the object.
4. **New document kind.** New `type` + file name pattern. Do not overload `scorecard` / `bulk`.
5. **New equipment type.** New `equipmentType` token + property keys.
6. **New media kind.** New `media[].kind`; keep `attach` / `path`.
7. **Tool private data.** Use `extensions.<toolId>` maps. Foreign tools round-trip them.
8. **New target kind.** New `kind` on a target document. No schema version bump.

Breaking changes bump `oadf` to a new major version. Additive open-token growth does not.

## Conformance

A reader:

- Requires `oadf: 1` and `type` on YAML documents.
- Resolves paths from the package root.
- Recomputes score totals from arrows.
- Leaves missing scores missing (does not invent misses).
- Loads series only from CSV sidecars named by descriptors.
- Keeps unknown keys, unknown block types, unknown devices, unknown equipment types, and unknown target kinds.
- Accepts JSON documents with the same shape.

A writer:

- Emits UTC times as ISO-8601 `Z`.
- Emits face coordinates with +y up, radius 10.
- Names `target` on a scorecard when the face is known. Zone geometry uses the same coordinates.
- Emits series and photos as sidecars, never inlined bytes or sample matrices in YAML.
- Uses 1-based `card.end.arrow` keys.
- Round-trips unknown fields it does not own.
- May omit club/person files in a solo package.

## Worked package

See the `example/` directory in this repository. Bluetooth radio layouts stay in `bluetooth.md` and feed aim CSV columns; they are not part of the YAML encoding.
