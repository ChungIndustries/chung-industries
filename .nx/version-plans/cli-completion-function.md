---
cli: minor
---

Apps get shell tab-completion from their command declarations: the new `app:completionFunction()` builds a completer for `shell.setCompletionFunction` that completes command names for the first argument and the command's `--flags` (plus `--help`) for dashed later ones.
