## 0.0.3 (2026-09-01)

### 🚀 Features

- Apps get shell tab-completion from their command declarations: the new `app:completionFunction()` builds a completer for `shell.setCompletionFunction` that completes command names for the first argument and the command's `--flags` (plus `--help`) for dashed later ones. ([18e0d7f](https://github.com/ChungIndustries/chung-industries/commit/18e0d7f))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.2 (2026-08-31)

### 🚀 Features

- The generated `cpm.json` manifest now carries the package description from `package.json`, so the registry and its website can show what the package does. ([#123](https://github.com/ChungIndustries/chung-industries/issues/123), [#122](https://github.com/ChungIndustries/chung-industries/issues/122))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.1 (2026-08-31)

### 🚀 Features

- Initial release of `cli`, a library for building command-line interfaces on CC:Tweaked. You define your commands as tables and the library handles argument parsing, validation, and help text. ([#86](https://github.com/ChungIndustries/chung-industries/issues/86))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5