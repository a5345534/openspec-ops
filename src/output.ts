import {
  SCHEMA_VERSION,
  type CliError,
  type CommandName,
  type ErrorEnvelope,
  type SuccessEnvelope,
} from "./types.js";

export function printSuccess<T>(
  command: CommandName,
  result: T,
  options: { json: boolean; humanLines?: string[] },
): void {
  if (options.json) {
    const envelope: SuccessEnvelope<T> = {
      schemaVersion: SCHEMA_VERSION,
      ok: true,
      command,
      result,
    };
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
    return;
  }

  for (const line of options.humanLines ?? []) {
    process.stdout.write(`${line}\n`);
  }
  if (
    result &&
    typeof result === "object" &&
    "path" in result &&
    typeof (result as { path?: unknown }).path === "string" &&
    (result as { path: string }).path.length > 0
  ) {
    process.stdout.write(`${(result as { path: string }).path}\n`);
  }
}

export function printError(
  command: CommandName | "unknown",
  error: CliError,
  json: boolean,
): void {
  if (json) {
    const envelope: ErrorEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      ok: false,
      command,
      error: error.toBody(),
    };
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
    return;
  }
  process.stderr.write(`${error.code}: ${error.message}\n`);
}
