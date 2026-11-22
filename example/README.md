# OADF example package

Worked package for Open Archery Data Format **version 1**.

Start at `oadf.yaml`. Paths inside documents are relative to this directory.

```text
oadf.yaml
Trilofos Archery.club.yaml
people/*.person.yaml
programmes/form-block.programme.yaml
templates/wa18.session-template.yaml
archers/maria/
  2026-10-20.session.yaml
  bulk/
  scorecards/
  series/*.csv
  media/*.jpg
  equipment/*.equipment.yaml
```

Local clock in the story is UTC+2; all machine timestamps are UTC with a `Z` suffix.

Photo files are 1×1 placeholder JPEGs so paths resolve. Replace them with real images as needed.

The contract is `../OADF.md`.
