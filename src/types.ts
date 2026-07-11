export const SCHEMA_VERSION = 1 as const;

export type CommandName = "start" | "where" | "finish" | "doctor";

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
  | "internal";

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
      return 3;
    case "worktree_dirty":
      return 4;
    case "not_found":
      return 5;
    case "git_failed":
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
}

export interface FinishOptions extends ChangeOptions {
  force: boolean;
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
}

export interface FinishResult {
  action: "removed";
  change: string;
  path: string;
  branch: string;
  branchDeleted: false;
  forced: boolean;
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
    | "openspec_not_intercept"
    | "openspec_real_bin_unset"
    | "propose_skill_alignment_markers_missing";
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
