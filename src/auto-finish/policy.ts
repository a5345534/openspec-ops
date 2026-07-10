export type AutoFinishPolicy = "ask" | "on" | "off";

/**
 * Parse OPENSPEC_OPS_AUTO_FINISH. Default: ask.
 */
export function parseAutoFinishPolicy(
  raw: string | undefined = process.env.OPENSPEC_OPS_AUTO_FINISH,
): AutoFinishPolicy {
  if (raw == null || raw.trim() === "") return "ask";
  const v = raw.trim().toLowerCase();
  if (v === "ask" || v === "on" || v === "off") return v;
  return "ask";
}
