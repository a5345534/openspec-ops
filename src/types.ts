export const SCHEMA_VERSION = 1 as const;

export type CommandName = "start" | "where" | "finish" | "doctor" | "ship" | "prune" | "merge";

export type ErrorCode =
  | "usage"
  | "invalid_change_name"
  | "not_a_git_repo"
  | "base_unresolved"
  | "primary_unresolved"
  | "path_occupied"
  | "path_not_worktree"
  | "branch_busy"
  | "branch_mismatch"
  | "ambiguous"
  | "worktree_dirty"
  | "not_found"
  | "git_failed"
  | "internal"
  | "nothing_to_ship"
  | "pr_backend_unavailable"
  | "pr_failed"
  | "submodule_detached_dirty"
  | "worktree_exists"
  | "branch_not_merged"
  | "checks_failed"
  | "pr_not_found"
  | "submodule_teardown_failed"
  | "primary_dirty"
  | "primary_diverged"
  | "sync_primary_failed"
  | "sync_submodules_failed";

export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 10;

export interface CliErrorBody {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
}

export class CliError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;
  readonly exitCode: ExitCode;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.details = details;
    this.exitCode = exitCodeForError(code);
  }

  toBody(): CliErrorBody {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function exitCodeForError(code: ErrorCode): ExitCode {
  switch (code) {
    case "usage":
    case "invalid_change_name":
      return 1;
    case "not_a_git_repo":
    case "base_unresolved":
    case "primary_unresolved":
      return 2;
    case "path_occupied":
    case "path_not_worktree":
    case "branch_busy":
    case "branch_mismatch":
    case "ambiguous":
    case "submodule_detached_dirty":
    case "nothing_to_ship":
    case "worktree_exists":
    case "branch_not_merged":
    case "checks_failed":
    case "pr_not_found":
    case "submodule_teardown_failed":
    case "primary_dirty":
    case "primary_diverged":
    case "sync_primary_failed":
    case "sync_submodules_failed":
      return 3;
    case "worktree_dirty":
      return 4;
    case "not_found":
      return 5;
    case "git_failed":
    case "pr_backend_unavailable":
    case "pr_failed":
    case "internal":
    default:
      return 10;
  }
}

export interface SuccessEnvelope<T> {
  schemaVersion: typeof SCHEMA_VERSION;
  ok: true;
  command: CommandName;
  result: T;
}

export interface ErrorEnvelope {
  schemaVersion: typeof SCHEMA_VERSION;
  ok: false;
  command: CommandName | "unknown";
  error: CliErrorBody;
}

export interface GlobalOptions {
  json: boolean;
  repo?: string;
}

export interface ChangeOptions extends GlobalOptions {
  change: string;
  path?: string;
  branch?: string;
}

export interface StartOptions extends ChangeOptions {
  base?: string;
  /** Opt-in: create/switch named branch in detached top-level submodules */
  initSubmoduleBranches?: boolean;
}

export interface FinishOptions extends ChangeOptions {
  force: boolean;
  /** Skip merged-branch local/remote deletion */
  keepBranch?: boolean;
  /** Remote for branch delete when PR merged (default origin) */
  remote?: string;
  /** Opt-in: ff-only pull primary to origin/<base> when clean */
  syncPrimary?: boolean;
  /** Opt-in: git submodule update --init --recursive on primary */
  syncSubmodules?: boolean;
  /** Opt-in: attach primary submodules to main when non-destructive */
  attachSubmoduleMain?: boolean;
}

export interface ShipOptions extends ChangeOptions {
  message?: string;
  title?: string;
  body?: string;
  draft: boolean;
  remote: string;
  /** PR base branch name (e.g. main); default resolved from repo */
  base?: string;
  backend: string;
}

export interface PruneOptions extends ChangeOptions {
  remote: string;
}

export type MergeMethod = "squash" | "merge" | "rebase";

export interface MergeOptions extends ChangeOptions {
  method: MergeMethod;
}

export interface MergeResult {
  action: "merged" | "already_merged";
  change: string;
  branch: string;
  method: MergeMethod;
  pr: { number: number; url: string };
}

export interface PruneResult {
  action: "pruned" | "already_clean";
  change: string;
  branch: string;
  remote: string;
  mergedPr: { number: number; url: string; baseRefName?: string };
  local: { deleted: boolean; alreadyAbsent: boolean };
  remoteBranch: { deleted: boolean; alreadyAbsent: boolean };
}

export interface ShipResult {
  action: "shipped" | "pushed" | "pr_only" | "pr_exists";
  change: string;
  path: string;
  branch: string;
  remote: string;
  base: string;
  commit: { created: boolean; sha: string | null; message: string | null } | null;
  push: { ok: boolean; skipped: boolean };
  pr: {
    url: string;
    number: number;
    backend: string;
    draft: boolean;
    alreadyExisted?: boolean;
  } | null;
  warnings: Array<{ code: string; message: string }>;
}

export interface StartResult {
  action: "created" | "reused";
  change: string;
  branch: string;
  path: string;
  head: string;
  base: string | null;
  primaryPath: string;
  changeDirExists: boolean;
  warnings: Array<{ code: string; message: string }>;
  /** Present when --init-submodule-branches used; empty if none/off */
  submoduleBranches: Array<{
    path: string;
    branch: string;
    action: "created" | "switched" | "skipped" | "failed";
    message?: string;
  }>;
}

/** Top-level submodule state under a change worktree (read-only probe). */
export interface SubmoduleStatus {
  path: string;
  detached: boolean;
  dirty: boolean;
  branch: string | null;
  head: string | null;
}

export interface WhereResult {
  found: true;
  change: string;
  path: string;
  branch: string;
  head: string;
  dirty: boolean;
  primaryPath: string;
  changeDirExists: boolean;
  changeDirPath: string | null;
  matchedBy: "path" | "branch";
  /** Always present on success; empty when no top-level submodules. */
  submodules: SubmoduleStatus[];
}

export interface FinishCloseoutHints {
  primaryBehindOrigin: boolean;
  originBaseRef: string | null;
  baseBranch: string | null;
  messages: string[];
}

export interface FinishSyncResult {
  syncPrimary: "skipped" | "ok" | "failed";
  syncSubmodules: "skipped" | "ok" | "failed";
  attachSubmoduleMain: "skipped" | "ok" | "partial" | "failed";
  attached: string[];
  diverged: string[];
}

export interface FinishResult {
  action: "removed" | "removed_and_pruned" | "pruned_only" | "already_clean";
  change: string;
  path: string | null;
  branch: string;
  /** True when local branch was deleted this run */
  branchDeleted: boolean;
  forced: boolean;
  worktreeRemoved: boolean;
  keepBranch: boolean;
  remote: string;
  branchCleanup: {
    attempted: boolean;
    localDeleted: boolean;
    localAlreadyAbsent: boolean;
    remoteDeleted: boolean;
    remoteAlreadyAbsent: boolean;
    keptReason: "not_merged" | "keep_flag" | null;
    mergedPr: { number: number; url: string } | null;
  };
  /** Always present for agent parse stability */
  closeoutHints: FinishCloseoutHints;
  sync: FinishSyncResult;
}

export interface DoctorWorktree {
  path: string;
  branch: string | null;
  head: string;
  dirty: boolean;
  inferredChange: string | null;
}

export interface DoctorIssue {
  id:
    | "stale_worktree_dir"
    | "missing_worktree_path"
    | "worktree_without_change_dir"
    | "ops_bin_missing"
    | "ops_bin_override_invalid"
    | "ops_package_bin_invalid"
    | "openspec_not_intercept"
    | "openspec_real_bin_unset"
    | "propose_skill_alignment_markers_missing"
    | "leftover_dirty_worktree"
    | "artifacts_on_primary_only"
    | "change_location_mismatch"
    | "submodule_detached"
    | "submodule_detached_dirty"
    | "primary_behind_origin"
    | "primary_submodule_detached"
    | "primary_submodule_detached_dirty";
  severity: "error" | "warning" | "info";
  path: string;
  message: string;
  hint?: string;
}

export interface DoctorResult {
  primaryPath: string;
  worktreeRoot: string;
  worktrees: DoctorWorktree[];
  issues: DoctorIssue[];
  summary: {
    error: number;
    warning: number;
    info: number;
  };
}

export interface WorktreeEntry {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
}
