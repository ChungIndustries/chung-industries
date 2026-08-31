-- cli: a library for building command-line interfaces on CC:Tweaked.
--
-- You define your commands as tables and the library handles argument parsing,
-- validation, and help text.
--
--   local cli = require("cli")
--   local app = cli.new({ name = "greet", description = "Greeting utilities" })
--   app:command("wave", {
--     description = "Wave at people",
--     arguments = { { name = "names", hint = "<name>", required = true, repeated = true } },
--     options = { { name = "caps", description = "Shout instead" } },
--     handler = function(args)
--       for _, name in ipairs(args.names) do
--         print((args.caps and string.upper or tostring)("hello " .. name))
--       end
--     end,
--   })
--   app:run(...)
--
-- The whole library is deliberately one file: consumers load it with a single require,
-- so a package manager can replace the installed tree while a program using it is
-- still running from it.

local App = {}
App.__index = App

local cli = {}

-- Declaration mistakes are programmer errors: fail loudly at registration time with a
-- message naming the command, not with confusing behavior at first use.
local function declare(ok, message, ...)
  if not ok then
    error("cli: " .. string.format(message, ...), 0)
  end
end

local function argumentToken(argument)
  local token = argument.hint or ("<" .. argument.name .. ">")
  if argument.repeated then
    token = token .. " ..."
  end
  if not argument.required then
    token = "[" .. token .. "]"
  end
  return token
end

local function optionToken(option)
  local token = "--" .. option.name
  if option.value then
    token = token .. " " .. (option.hint or ("<" .. option.name .. ">"))
  end
  return token
end

local function usageLine(app, command)
  local parts = { app.name, command.name }
  for _, option in ipairs(command.options) do
    parts[#parts + 1] = "[" .. optionToken(option) .. "]"
  end
  for _, argument in ipairs(command.arguments) do
    parts[#parts + 1] = argumentToken(argument)
  end
  return table.concat(parts, " ")
end

-- Split tokens into named options and positional values against a command's
-- declarations. Returns the handler's args table, or nil and a message.
local function parseArguments(command, tokens)
  local args = {}
  local values = {}
  local index = 1
  while index <= #tokens do
    local token = tokens[index]
    local name = token:match("^%-%-(.+)$")
    if name then
      local option = command.optionsByName[name]
      if not option then
        return nil, "Unknown option: " .. token
      end
      if option.value then
        index = index + 1
        if tokens[index] == nil then
          return nil, "Option " .. token .. " needs a value"
        end
        args[option.name] = tokens[index]
      else
        args[option.name] = true
      end
    else
      values[#values + 1] = token
    end
    index = index + 1
  end

  local declarations = command.arguments
  local required = 0
  for _, declaration in ipairs(declarations) do
    if declaration.required then
      required = required + 1
    end
  end
  if #values < required then
    -- Required arguments always precede optional ones, so the first unfilled
    -- declaration is the one that is missing.
    local missing = declarations[#values + 1]
    return nil, "Missing argument: " .. (missing.hint or ("<" .. missing.name .. ">"))
  end

  local last = declarations[#declarations]
  local repeated = last ~= nil and last.repeated
  local singles = repeated and #declarations - 1 or #declarations
  if not repeated and #values > #declarations then
    return nil, "Unexpected argument: " .. values[#declarations + 1]
  end

  local nextValue = 1
  for i = 1, singles do
    if nextValue <= #values then
      args[declarations[i].name] = values[nextValue]
      nextValue = nextValue + 1
    end
  end
  if repeated then
    local rest = {}
    for i = nextValue, #values do
      rest[#rest + 1] = values[i]
    end
    args[last.name] = rest
  end
  return args
end

local function wantsHelp(tokens)
  for _, token in ipairs(tokens) do
    if token == "--help" or token == "-h" then
      return true
    end
  end
  return false
end

--- Register a command. The spec is a table:
---
--- - `description`: shown by `help <command>`
--- - `arguments`: the positional arguments, in order, each `{ name, hint?, required?,
---   repeated? }`. The parsed value is stored in the handler's `args` table under `name`.
---   `repeated` is only allowed on the last argument and collects the remaining values
---   into a list, and a `hint` changes how the argument is written in usage text.
--- - `options`: the `--flags`, each `{ name, hint?, description?, value? }`. A flag with
---   `value = true` takes the next word as its value, any other flag becomes `true`.
--- - `handler(args)`: receives all parsed values in one table, keyed by name.
function App:command(name, spec)
  declare(type(name) == "string" and name ~= "", "command name must be a non-empty string")
  declare(self.commands[name] == nil, "duplicate command: %s", name)
  declare(type(spec) == "table", "%s: spec must be a table", name)
  declare(type(spec.handler) == "function", "%s: handler must be a function", name)

  local command = {
    name = name,
    description = spec.description,
    arguments = {},
    options = {},
    optionsByName = {},
    handler = spec.handler,
  }

  local seen = {}
  local arguments = spec.arguments or {}
  local sawOptional = false
  for index, argument in ipairs(arguments) do
    local valid = type(argument) == "table" and type(argument.name) == "string"
    declare(valid and argument.name ~= "", "%s: argument #%d needs a name", name, index)
    declare(not seen[argument.name], "%s: duplicate name: %s", name, argument.name)
    declare(
      not argument.repeated or index == #arguments,
      "%s: only the last argument can be repeated",
      name
    )
    declare(
      not (argument.required and sawOptional),
      "%s: required argument %s cannot follow an optional one",
      name,
      argument.name
    )
    sawOptional = sawOptional or not argument.required
    seen[argument.name] = true
    command.arguments[index] = argument
  end

  for index, option in ipairs(spec.options or {}) do
    local valid = type(option) == "table" and type(option.name) == "string"
    declare(
      valid and option.name:match("^[^-]") ~= nil,
      "%s: option #%d needs a name without leading dashes",
      name,
      index
    )
    declare(not seen[option.name], "%s: duplicate name: %s", name, option.name)
    seen[option.name] = true
    command.options[#command.options + 1] = option
    command.optionsByName[option.name] = option
  end

  self.commands[name] = command
  self.order[#self.order + 1] = name
  return self
end

--- Print the tool's help: description, one usage line per command in registration
--- order, and the footer (a string, or a function returning one, evaluated per print).
function App:printHelp()
  if self.description then
    print(self.description)
    print("")
  end
  print("Usage:")
  for _, name in ipairs(self.order) do
    print("  " .. usageLine(self, self.commands[name]))
  end
  local footer = self.footer
  if type(footer) == "function" then
    footer = footer()
  end
  if footer ~= nil and footer ~= "" then
    print("")
    print(footer)
  end
end

--- Print one command's help: its usage line, description, and options.
function App:printCommandHelp(command)
  print("Usage: " .. usageLine(self, command))
  if command.description then
    print("")
    print(command.description)
  end
  if #command.options > 0 then
    print("")
    print("Options:")
    local tokens = {}
    local width = 0
    for index, option in ipairs(command.options) do
      tokens[index] = optionToken(option)
      width = math.max(width, #tokens[index])
    end
    for index, option in ipairs(command.options) do
      local line = "  " .. tokens[index]
      if option.description then
        line = line .. string.rep(" ", width - #tokens[index]) .. "  " .. option.description
      end
      print(line)
    end
  end
end

--- Pick the command from the program's arguments and run it: call as `app:run(...)`.
--- No command, `--help`, or `-h` prints the help, and `--help`/`-h` after a command
--- prints that command's help. Unknown commands, wrong arguments, and errors thrown
--- by handlers are printed with printError. Returns true when the command ran
--- without errors.
function App:run(...)
  local tokens = { ... }
  local name = table.remove(tokens, 1)

  -- The help command is generated from the declarations themselves, registered on
  -- first run so it lists after the tool's own commands (which may also override it).
  if not self.commands.help then
    self:command("help", {
      description = "Show usage for the tool or for one command",
      arguments = { { name = "command", hint = "<command>" } },
      handler = function(args)
        if args.command == nil then
          self:printHelp()
          return
        end
        local command = self.commands[args.command]
        if not command then
          error("Unknown command: " .. args.command, 0)
        end
        self:printCommandHelp(command)
      end,
    })
  end

  if name == nil or name == "--help" or name == "-h" then
    self:printHelp()
    return true
  end

  local command = self.commands[name]
  if not command then
    printError("Unknown command: " .. name)
    self:printHelp()
    return false
  end

  if wantsHelp(tokens) then
    self:printCommandHelp(command)
    return true
  end

  local args, message = parseArguments(command, tokens)
  if not args then
    printError(message)
    print("Usage: " .. usageLine(self, command))
    return false
  end

  local ok, err = pcall(command.handler, args)
  if not ok then
    printError(tostring(err))
    return false
  end
  return true
end

--- Create an app: `spec.name` is the program name used in usage lines,
--- `spec.description` opens the help output, and `spec.footer` closes it.
function cli.new(spec)
  declare(
    type(spec) == "table" and type(spec.name) == "string" and spec.name ~= "",
    "new needs a spec with a non-empty name"
  )
  return setmetatable({
    name = spec.name,
    description = spec.description,
    footer = spec.footer,
    commands = {},
    order = {},
  }, App)
end

return cli
