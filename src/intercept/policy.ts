export type InterceptNewChangePolicy = "on" | "off";

/**
 * OPENSPEC_OPS_INTERCEPT_NEW_CHANGE: on|off only. Default on.
 */
export function parseInterceptNewChangePolicy(
  raw: string | undefined = process.env.OPENSPEC_OPS_INTERCEPT_NEW_CHANGE,
): InterceptNewChangePolicy {
  if (raw == null || raw.trim() === "") return "on";
  const v = raw.trim().toLowerCase();
  return v === "off" ? "off" : "on";
}
