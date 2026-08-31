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

## Declarations

- **Arguments** are the positional parameters of a command, declared in order as `{ name, hint?, required?, repeated? }`. The parsed value is passed to the handler as `args[name]`. A `hint` replaces the generated `<name>` in usage text, for example `<name>[@<version|range|tag>]`. Only the last argument can be repeated, which collects the remaining values into a list, and a required argument cannot come after an optional one. A mistake in a declaration raises an error at registration time.
- **Options** are named flags, declared as `{ name, hint?, description?, value? }` and written `--name` on the command line, in any position. An option with `value = true` takes the next token as its value, any other option parses to `true`, and an option that was not given is `nil`.
- **`run(...)`** dispatches the program's arguments. Running with no command, `--help`, or `-h` prints the tool help, and `--help` or `-h` after a command prints that command's help. Unknown commands, malformed arguments, and handler errors are reported with `printError` and a usage hint. It returns `true` when the invocation succeeded. A `help [<command>]` command is registered automatically, and a tool can override it with its own.

The library is deliberately a single file, `src/init.lua`. Consumers load it with one `require`, so cpm can swap the installed tree while a program that uses it is still running.

## Tooling

| Task                           | Command                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Build `dist/cli-<version>.tgz` | `nx build cli`                                                                                            |
| Publish to the registry        | `nx publish:registry cli` (`CPM_REGISTRY_URL` is the target and required)                                 |
| Test                           | `nx test:lua cli` (plain Lua, no CC:Tweaked runtime needed)                                               |
| Lint                           | `nx lint:lua cli` (needs [luacheck](https://github.com/lunarmodules/luacheck))                            |
| Format                         | `nx format:lua cli` / `nx format:lua:check cli` (needs [StyLua](https://github.com/JohnnyMorganz/StyLua)) |

Luacheck, StyLua, and the tests are not part of the Node toolchain, so they run in the dedicated Lua workflow (`.github/workflows/lua.yml`) rather than the monorepo-wide `nx affected -t lint` lane.
