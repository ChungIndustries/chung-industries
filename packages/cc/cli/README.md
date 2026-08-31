# cli

A declarative command-line library for CC:Tweaked programs, published to the [cpm registry](../../../apps/cpm-registry) as the `cli` package. A tool declares its commands, positional arguments, and named options once; usage text, the `help` command, and argument validation are all generated from those declarations, so help text can never drift from the actual interface. cpm itself ([apps/cpm-cli](../../../apps/cpm-cli)) is the first consumer.

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

## Declarations

- **Arguments** are ordered positional declarations `{ name, hint?, required?, repeated? }`. The parsed value lands in the handler's `args` table under `name`; `hint` replaces the generated `<name>` in usage text (for example `<name>[@<version|range|tag>]`). Only the last argument may be repeated (its value is a list, possibly empty when optional), and a required argument cannot follow an optional one. Declaration mistakes error at registration time.
- **Options** are named declarations `{ name, hint?, description?, value? }`, written `--name` on the command line anywhere among the positionals. With `value = true` the option consumes the next token as its value; otherwise it parses to `true`. Absent options are `nil`.
- **`run(...)`** dispatches: no command, `--help`, or `-h` prints the tool help; `--help`/`-h` after a command prints that command's help; unknown commands, malformed arguments, and handler errors are reported with `printError` plus a usage hint. It returns `true` when the invocation succeeded. A `help [<command>]` command is generated automatically (a tool can override it by registering its own).

The whole library is a single file (`src/init.lua`) on purpose: consumers load it with one `require`, so cpm can replace the installed tree while a program using it is still running from it.

## Tooling

| Task                           | Command                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Build `dist/cli-<version>.tgz` | `nx build cli`                                                                                            |
| Publish to the registry        | `nx publish:registry cli` (`CPM_REGISTRY_URL` is the target and required)                                 |
| Test                           | `nx test:lua cli` (plain Lua, no CC:Tweaked runtime needed)                                               |
| Lint                           | `nx lint:lua cli` (needs [luacheck](https://github.com/lunarmodules/luacheck))                            |
| Format                         | `nx format:lua cli` / `nx format:lua:check cli` (needs [StyLua](https://github.com/JohnnyMorganz/StyLua)) |

Luacheck, StyLua, and the tests are not part of the Node toolchain, so they run in the dedicated Lua workflow (`.github/workflows/lua.yml`) rather than the monorepo-wide `nx affected -t lint` lane.
