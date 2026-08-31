---
cpm-cli: minor
---

`cpm` now tab-completes: a new `startup` hook registers a completer for the command at boot, generated from the same command declarations the program runs, so `cpm ins<tab>` completes command names and `--<tab>` completes flags. The bootstrap installer now also writes declared startup hooks, and runs the fresh ones so completion works in the install session without a reboot.
