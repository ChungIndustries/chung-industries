---
cli: minor
---

Initial release of `cli`, a declarative command-line library for CC:Tweaked programs. Tools register commands with positional arguments (required, optional, repeated) and named `--options`; usage text, the `help` command, unknown-command handling, and argument validation are all generated from the declarations, so help can never drift from the actual interface.
