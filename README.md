# Open Archery Data Format

OADF version 1 is a directory, or a zip of that directory, of YAML and CSV for archery training: clubs, people, programmes, sessions, scores, equipment, sensor series, and photos. The same package is meant to be read by a person, a statistics tool, or a language model.

The contract is [OADF.md](OADF.md). A worked package is [example/](example/).

## For coding agents

To add an exporter in another application, follow [AGENTS.md](AGENTS.md). Paste this into that application's agent:

> Implement OADF v1 export in this application. Follow https://github.com/inlinkz/oadf/blob/main/AGENTS.md and https://github.com/inlinkz/oadf/blob/main/OADF.md. Use the example package as the oracle. Do not invent fields.

Bluetooth radio layouts are in [bluetooth.md](bluetooth.md). They feed aim CSV columns and are not part of the YAML encoding.
