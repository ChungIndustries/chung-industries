# cli

A library for building command-line interfaces on CC:Tweaked, published to the [cpm registry](../../../apps/cpm-registry) as the `cli` package. You define your commands as tables and the library handles argument parsing, validation, and help text. cpm ([apps/cpm-cli](../../../apps/cpm-cli)) is built with it.

## Usage

```lua
local cli = require("cli")

local app = cli.new({
  name = "greet",
  description = "Greeting utilities",
  footer = "Docs: https://example.com", -- string, or a function returning one
})

app:command("wave", {
  description = "Wave at people",
  arguments = { { name = "names", hint = "<name>", required = true, repeated = true } },
  options = { { name = "caps", description = "Shout instead" } },
  handler = function(args)
    for _, name in ipairs(args.names) do
      print((args.caps and string.upper or tostring)("hello " .. name))
    end
  end,
})

app:run(...)
```

## Commands

Each command is a table:

- `description` is shown by `help <command>`.
- `arguments` are the positional arguments, in order. Each one needs a `name`, which is the key its parsed value gets in `args`. Add `required = true` to make it mandatory, and `repeated = true` on the last one to collect all remaining values into a list. A `hint` changes how the argument is written in usage text, for example `<name>[@<version|range|tag>]` instead of `<name>`.
- `options` are the `--flags`, allowed anywhere on the command line. A flag with `value = true` takes the next word as its value (`--dir apps`), any other flag just becomes `true`. Flags that were not typed are `nil`.
- `handler(args)` receives all parsed values in one table, keyed by name.

A broken table (a repeated argument that is not last, a required argument after an optional one, duplicate names) throws as soon as you register the command.

## Running

`app:run(...)` picks the command from the program's arguments and runs it:

- No command, `--help`, or `-h` prints the help. After a command name, `--help` or `-h` prints that command's help.
- A `help [<command>]` command is added for you. Register your own to override it.
- Unknown commands, wrong arguments, and errors thrown by handlers are printed with `printError` plus a usage line.
- It returns `true` when the command ran without errors.

The whole library is one file, `src/init.lua`, loaded with a single `require`, so cpm can swap the installed tree while a program using it is still running.

## Tab-completion

`app:completionFunction()` builds a completer for CC:Tweaked's `shell.setCompletionFunction`, driven by the same declarations: the first argument completes command names (including the generated `help`), and later arguments starting with `-` complete the command's `--flags` plus `--help`. The shell only consults completers that are already registered when the user types, so registration belongs in a startup file, keyed by the program's resolved path (absolute, without the leading slash):

```lua
shell.setCompletionFunction("tool/bin/tool.lua", app:completionFunction())
```

## Tooling

| Task                           | Command                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Build `dist/cli-<version>.tgz` | `nx build cli`                                                                                            |
| Publish to the registry        | `nx publish:registry cli` (`CPM_REGISTRY_URL` is the target and required)                                 |
| Test                           | `nx test:lua cli` (plain Lua, no CC:Tweaked runtime needed)                                               |
| Lint                           | `nx lint:lua cli` (needs [luacheck](https://github.com/lunarmodules/luacheck))                            |
| Format                         | `nx format:lua cli` / `nx format:lua:check cli` (needs [StyLua](https://github.com/JohnnyMorganz/StyLua)) |

Luacheck, StyLua, and the tests are not part of the Node toolchain, so they run in the dedicated Lua workflow (`.github/workflows/lua.yml`) rather than the monorepo-wide `nx affected -t lint` lane.
