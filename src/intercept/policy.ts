/**
 * @deprecated Ensure-on-intercept removed (guided-lifecycle-no-auto).
 * Kept for tests/docs that may still import the name; always "off".
 */
export type InterceptNewChangePolicy = "on" | "off";

/**
 * Always off: intercept never auto-ensures worktrees.
 * Env OPENSPEC_OPS_INTERCEPT_NEW_CHANGE is ignored for ensure behavior.
 */
export function parseInterceptNewChangePolicy(
  _raw?: string | undefined,
): InterceptNewChangePolicy {
  return "off";
}
