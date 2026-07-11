import { isDirty } from "../git.js";
import {
  assertChangeName,
  defaultBranch,
  defaultPath,
  findChangeDir,
  resolveRepoContext,
} from "../resolve.js";
import { probeTopLevelSubmodules } from "../submodules/probe.js";
import { printSuccess } from "../output.js";
import { CliError, type ChangeOptions, type WhereResult } from "../types.js";

export function locateWorkspace(options: ChangeOptions): WhereResult {
  const change = assertChangeName(options.change);
  const ctx = resolveRepoContext(options.repo);
  const branch = defaultBranch(change, options.branch);
  const expectedPath = defaultPath(ctx.primaryPath, change, options.path);

  const byPath = ctx.worktrees.find((w) => w.path === expectedPath);
  if (byPath) {
    const changeDir = findChangeDir(change, byPath.path, ctx.primaryPath);
    return {
      found: true,
      change,
      path: byPath.path,
      branch: byPath.branch ?? branch,
      head: byPath.head,
      dirty: isDirty(byPath.path),
      primaryPath: ctx.primaryPath,
      changeDirExists: changeDir.exists,
      changeDirPath: changeDir.path,
      matchedBy: "path",
      submodules: probeTopLevelSubmodules(byPath.path),
    };
  }

  const byBranch = ctx.worktrees.filter((w) => w.branch === branch);
  if (byBranch.length > 1) {
    throw new CliError("ambiguous", `Multiple worktrees found for branch '${branch}'`, {
      branch,
      paths: byBranch.map((w) => w.path),
    });
  }
  if (byBranch.length === 1) {
    const hit = byBranch[0]!;
    const changeDir = findChangeDir(change, hit.path, ctx.primaryPath);
    return {
      found: true,
      change,
      path: hit.path,
      branch: hit.branch ?? branch,
      head: hit.head,
      dirty: isDirty(hit.path),
      primaryPath: ctx.primaryPath,
      changeDirExists: changeDir.exists,
      changeDirPath: changeDir.path,
      matchedBy: "branch",
      submodules: probeTopLevelSubmodules(hit.path),
    };
  }

  throw new CliError("not_found", `No worktree found for change '${change}'`, {
    change,
    lookedUpPath: expectedPath,
    lookedUpBranch: branch,
  });
}

export function runWhere(options: ChangeOptions): WhereResult {
  const result = locateWorkspace(options);
  const subs = result.submodules;
  const detached = subs.filter((s) => s.detached).length;
  const dirtySubs = subs.filter((s) => s.dirty).length;
  const subSummary =
    subs.length === 0
      ? "submodules: 0"
      : `submodules: ${subs.length} (${detached} detached, ${dirtySubs} dirty)`;
  printSuccess("where", result, {
    json: options.json,
    humanLines: [
      `change:  ${result.change}`,
      `branch:  ${result.branch}`,
      `status:  ${result.dirty ? "dirty" : "clean"}`,
      `match:   ${result.matchedBy}`,
      subSummary,
    ],
  });
  return result;
}
