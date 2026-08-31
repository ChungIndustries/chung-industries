---
cli: minor
cpm-cli: minor
---

Shell tab-completion, generated from the command declarations: the cli library's new `app:completionFunction()` builds a completer for `shell.setCompletionFunction` (command names for the first argument, `--flags` for dashed later ones), and cpm registers it at boot through a new `startup` hook, so `cpm ins<tab>` completes. The bootstrap installer now also writes declared startup hooks, and runs the fresh ones so completion works in the install session without a reboot.
