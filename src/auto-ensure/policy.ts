export type AutoStartPolicy = "on" | "ask" | "off";

/**
 * Parse OPENSPEC_OPS_AUTO_START. Default: on.
 */
export function parseAutoStartPolicy(
  raw: string | undefined = process.env.OPENSPEC_OPS_AUTO_START,
): AutoStartPolicy {
  if (raw == null || raw.trim() === "") return "on";
  const v = raw.trim().toLowerCase();
  if (v === "on" || v === "ask" || v === "off") return v;
  return "on";
}
