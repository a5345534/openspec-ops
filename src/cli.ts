import { runDoctor } from "./commands/doctor.js";
import { runFinish } from "./commands/finish.js";
import { runPrune } from "./commands/prune.js";
import { runShip } from "./commands/ship.js";
import { runStart } from "./commands/start.js";
import { runWhere } from "./commands/where.js";
import { printError } from "./output.js";
import { CliError, type CommandName } from "./types.js";

const VERSION = "0.1.0";

function printHelp(): void {
  process.stdout.write(`openspec-ops ${VERSION}

Harness-neutral git worktree lifecycle for OpenSpec changes.

Usage:
  openspec-ops start  <change> [--path P] [--branch B] [--base REF] [--json] [--repo PATH]
  openspec-ops where  <change> [--path P] [--branch B] [--json] [--repo PATH]
  openspec-ops finish <change> [--path P] [--branch B] [--force] [--json] [--repo PATH]
  openspec-ops ship   <change> [ship flags] [--json] [--repo PATH]
  openspec-ops prune  <change> [--remote R] [--branch B] [--json] [--repo PATH]
  openspec-ops doctor [--json] [--repo PATH]

Ship flags:
  -m, --message <msg>   Commit message (default: ship(<change>): worktree)
  --title <title>       PR title (default: commit message)
  --body <body>         PR body
  --draft               Open PR as draft
  --remote <name>       Git remote (default: origin)
  --base <branch>       PR base branch (default: origin/HEAD or main/master)
  --backend <id>        PR backend (default: gh)

Global flags:
  --json          Machine-readable JSON envelope (schemaVersion 1)
  --repo <path>   Git repo path (default: discover from cwd)
  --help          Show help
  --version       Show version

Defaults:
  branch = <change>
  path   = <primary>/.worktrees/<change>

Ship commits the entire worktree (git add -A), pushes without --force, opens a PR via gh.
Ship does not merge, archive, or finish the worktree.

Prune deletes local+remote change branches only when a merged PR exists for that head
and no worktree is registered (run finish first). Never force-deletes unmerged branches.
`);
}

interface ParsedArgs {
  command?: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
      continue;
    }
    if (arg === "--version" || arg === "-V") {
      flags.version = true;
      continue;
    }
    if (arg === "--json") {
      flags.json = true;
      continue;
    }
    if (arg === "--force") {
      flags.force = true;
      continue;
    }
    if (arg === "--draft") {
      flags.draft = true;
      continue;
    }
    if (arg === "-m") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new CliError("usage", "-m requires a message argument", {});
      }
      flags.message = next;
      i++;
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function flagString(flags: Record<string, string | boolean>, name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}

function requireChange(positional: string[]): string {
  const change = positional[0];
  if (!change) {
    throw new CliError("usage", "Missing <change> argument", {});
  }
  if (positional.length > 1) {
    throw new CliError("usage", `Unexpected arguments: ${positional.slice(1).join(" ")}`, {
      extra: positional.slice(1),
    });
  }
  return change;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let commandName: CommandName | "unknown" = "unknown";
  let json = false;

  try {
    const parsed = parseArgs(argv);
    json = Boolean(parsed.flags.json);

    if (parsed.flags.help || (!parsed.command && !parsed.flags.version)) {
      printHelp();
      return 0;
    }
    if (parsed.flags.version) {
      process.stdout.write(`${VERSION}\n`);
      return 0;
    }

    const command = parsed.command;
    if (!command) {
      throw new CliError("usage", "Missing command", {});
    }

    const repo = flagString(parsed.flags, "repo");
    const path = flagString(parsed.flags, "path");
    const branch = flagString(parsed.flags, "branch");
    const base = flagString(parsed.flags, "base");
    const force = Boolean(parsed.flags.force);

    switch (command) {
      case "start": {
        commandName = "start";
        runStart({
          change: requireChange(parsed.positional),
          json,
          repo,
          path,
          branch,
          base,
        });
        return 0;
      }
      case "where": {
        commandName = "where";
        runWhere({
          change: requireChange(parsed.positional),
          json,
          repo,
          path,
          branch,
        });
        return 0;
      }
      case "finish": {
        commandName = "finish";
        runFinish({
          change: requireChange(parsed.positional),
          json,
          repo,
          path,
          branch,
          force,
        });
        return 0;
      }
      case "doctor": {
        commandName = "doctor";
        if (parsed.positional.length > 0) {
          throw new CliError("usage", `Unexpected arguments: ${parsed.positional.join(" ")}`, {});
        }
        runDoctor({ json, repo });
        return 0;
      }
      case "ship": {
        commandName = "ship";
        runShip({
          change: requireChange(parsed.positional),
          json,
          repo,
          path,
          branch,
          message: flagString(parsed.flags, "message"),
          title: flagString(parsed.flags, "title"),
          body: flagString(parsed.flags, "body"),
          draft: Boolean(parsed.flags.draft),
          remote: flagString(parsed.flags, "remote") ?? "origin",
          base: flagString(parsed.flags, "base"),
          backend: flagString(parsed.flags, "backend") ?? "gh",
        });
        return 0;
      }
      case "prune": {
        commandName = "prune";
        runPrune({
          change: requireChange(parsed.positional),
          json,
          repo,
          path,
          branch,
          remote: flagString(parsed.flags, "remote") ?? "origin",
        });
        return 0;
      }
      default:
        throw new CliError("usage", `Unknown command '${command}'`, { command });
    }
  } catch (err) {
    if (err instanceof CliError) {
      printError(commandName, err, json);
      return err.exitCode;
    }
    const internal = new CliError(
      "internal",
      err instanceof Error ? err.message : String(err),
      {},
    );
    printError(commandName, internal, json);
    return 10;
  }
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("/cli.ts") ||
    process.argv[1].endsWith("/cli.js") ||
    process.argv[1].endsWith("/openspec-ops"));

if (isDirect) {
  main().then((code) => {
    process.exit(code);
  });
}
