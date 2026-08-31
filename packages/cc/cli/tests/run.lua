-- Plain-Lua tests for the cli library, no CC:Tweaked runtime involved.
-- Run from the package root: `lua tests/run.lua` (the Lua CI workflow does).

local cli = dofile("src/init.lua")

-- The library talks to the terminal only through print and printError, so the
-- tests capture both to assert on what a user would see.
local output = {}
_G.print = function(line)
  output[#output + 1] = tostring(line)
end
_G.printError = function(line)
  output[#output + 1] = "E: " .. tostring(line)
end

local failures = 0
local function check(condition, label)
  if condition then
    io.write("ok " .. label .. "\n")
  else
    failures = failures + 1
    io.write("FAIL " .. label .. "\n")
  end
end

local function reset()
  output = {}
end

local function contains(line)
  for _, printed in ipairs(output) do
    if printed == line then
      return true
    end
  end
  return false
end

-- A miniature cpm-shaped app exercising every declaration feature.
local received
local function newApp()
  local app = cli.new({
    name = "tool",
    description = "A test tool",
    footer = function()
      return "Footer line"
    end,
  })
  app:command("add", {
    description = "Add items",
    arguments = {
      { name = "items", hint = "<item>[@<tag>]", required = true, repeated = true },
    },
    options = {
      { name = "dir", hint = "<folder>", description = "Target folder", value = true },
      { name = "force", description = "Overwrite" },
    },
    handler = function(args)
      received = args
    end,
  })
  app:command("bump", {
    description = "Bump items, or everything when no names are given",
    arguments = { { name = "items", hint = "<item>", repeated = true } },
    handler = function(args)
      received = args
    end,
  })
  app:command("find", {
    description = "Find items",
    arguments = { { name = "query" } },
    handler = function(args)
      received = args
    end,
  })
  app:command("boom", {
    description = "Always fails",
    handler = function()
      error("kaboom", 0)
    end,
  })
  return app
end

-- Positional parsing.
local app = newApp()
reset()
check(app:run("add", "a", "b@1.0.0") == true, "required repeated succeeds")
check(#received.items == 2 and received.items[1] == "a", "repeated collects values in order")
check(received.items[2] == "b@1.0.0", "repeated keeps raw tokens")

check(app:run("bump") == true, "optional repeated accepts no values")
check(#received.items == 0, "optional repeated defaults to an empty list")
check(app:run("bump", "x") == true and received.items[1] == "x", "optional repeated collects")

check(app:run("find") == true and received.query == nil, "optional single defaults to nil")
check(app:run("find", "needle") == true and received.query == "needle", "optional single parses")

reset()
check(app:run("find", "a", "b") == false, "extra positional fails")
check(contains("E: Unexpected argument: b"), "extra positional names the argument")
check(contains("Usage: tool find [<query>]"), "extra positional prints the usage line")

reset()
check(app:run("add") == false, "missing required fails")
check(contains("E: Missing argument: <item>[@<tag>]"), "missing required uses the hint")
check(
  contains("Usage: tool add [--dir <folder>] [--force] <item>[@<tag>] ..."),
  "usage lists options"
)

-- Options.
check(app:run("add", "--force", "a") == true, "flag option parses")
check(received.force == true and received.dir == nil, "flag is true, absent option is nil")
check(app:run("add", "a", "--dir", "apps") == true, "value option parses after positionals")
check(received.dir == "apps" and received.items[1] == "a", "value option consumes its value")

reset()
check(app:run("add", "a", "--nope") == false, "unknown option fails")
check(contains("E: Unknown option: --nope"), "unknown option is named")
reset()
check(app:run("add", "a", "--dir") == false, "value option without value fails")
check(contains("E: Option --dir needs a value"), "missing option value is reported")

-- Dispatch.
reset()
check(app:run() == true, "no arguments prints help")
check(contains("A test tool"), "help opens with the description")
check(contains("  tool add [--dir <folder>] [--force] <item>[@<tag>] ..."), "help lists commands")
check(contains("  tool help [<command>]"), "help lists the generated help command")
check(output[#output - 2] == "  tool help [<command>]", "generated help command lists last")
check(contains("Footer line"), "help evaluates the footer function")

reset()
check(app:run("nope") == false, "unknown command fails")
check(contains("E: Unknown command: nope"), "unknown command is named")
check(contains("Usage:"), "unknown command prints the tool help")

reset()
check(app:run("boom") == false, "handler errors fail the run")
check(contains("E: kaboom"), "handler errors are printed")

-- Generated help.
reset()
check(app:run("help") == true, "help command prints tool help")
check(contains("Usage:"), "help command output has the usage list")
reset()
check(app:run("help", "add") == true, "help command takes a command name")
check(
  contains("Usage: tool add [--dir <folder>] [--force] <item>[@<tag>] ..."),
  "command help usage"
)
check(contains("Add items"), "command help includes the description")
check(contains("Options:"), "command help lists options")
check(contains("  --dir <folder>  Target folder"), "options align with descriptions")
check(contains("  --force         Overwrite"), "flag options pad to the widest token")
reset()
check(app:run("help", "nope") == false, "help for an unknown command fails")
check(contains("E: Unknown command: nope"), "help names the unknown command")
reset()
check(app:run("add", "-h") == true, "-h after a command prints its help")
check(contains("Usage: tool add [--dir <folder>] [--force] <item>[@<tag>] ..."), "-h shows usage")
reset()
check(app:run("--help") == true, "--help prints the tool help")
check(contains("Usage:"), "--help output has the usage list")

-- Tab-completion. The completer is called the way shell.complete calls it: the
-- shell API first (unused here), the argument index, the text being completed,
-- and the previous words with the program name at [1].
local complete = newApp():completionFunction()
local function completions(index, text, previous)
  local results = complete(nil, index, text, previous)
  return results and table.concat(results, "|")
end

check(
  completions(1, "", { "tool" }) == "add |bump |find |boom |help ",
  "empty first argument completes every command, help last"
)
check(completions(1, "b", { "tool" }) == "ump |oom ", "commands complete by prefix, in order")
check(completions(1, "add", { "tool" }) == " ", "an exact command match completes to a space")
check(completions(1, "nope", { "tool" }) == "", "an unmatched command completes to nothing")
check(
  completions(2, "--", { "tool", "add" }) == "dir |force |help ",
  "dashed arguments complete the command's options plus --help"
)
check(
  completions(3, "-", { "tool", "add", "a" }) == "-dir |-force |-help ",
  "options complete at any later index, from a single dash"
)
check(completions(2, "--force", { "tool", "add" }) == " ", "an exact option match completes")
check(
  completions(2, "--", { "tool", "bump" }) == "help ",
  "a command without options offers --help"
)
check(completions(2, "", { "tool", "add" }) == nil, "positional values are not completed")
check(completions(2, "--", { "tool", "nope" }) == nil, "an unknown command completes nothing")

-- Declaration validation.
local function fails(message, register)
  local ok, err = pcall(register)
  return not ok and err == "cli: " .. message
end
local strict = cli.new({ name = "strict" })
local noop = function() end
check(
  fails("dup: handler must be a function", function()
    strict:command("dup", {})
  end),
  "missing handler is rejected"
)
strict:command("dup", { handler = noop })
check(
  fails("duplicate command: dup", function()
    strict:command("dup", { handler = noop })
  end),
  "duplicate command is rejected"
)
check(
  fails("bad: only the last argument can be repeated", function()
    strict:command("bad", {
      arguments = { { name = "a", repeated = true }, { name = "b" } },
      handler = noop,
    })
  end),
  "non-final repeated argument is rejected"
)
check(
  fails("bad: required argument b cannot follow an optional one", function()
    strict:command("bad", {
      arguments = { { name = "a" }, { name = "b", required = true } },
      handler = noop,
    })
  end),
  "required after optional is rejected"
)
check(
  fails("bad: duplicate name: a", function()
    strict:command("bad", {
      arguments = { { name = "a" } },
      options = { { name = "a" } },
      handler = noop,
    })
  end),
  "argument and option name collision is rejected"
)
check(
  fails("bad: option #1 needs a name without leading dashes", function()
    strict:command("bad", { options = { { name = "--dashed" } }, handler = noop })
  end),
  "option declared with dashes is rejected"
)
check(
  fails("new needs a spec with a non-empty name", function()
    cli.new({})
  end),
  "app without a name is rejected"
)

io.write(failures == 0 and "all tests passed\n" or (failures .. " test(s) failed\n"))
os.exit(failures == 0 and 0 or 1)
