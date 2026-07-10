export type AutoReviewPolicy = "on" | "off";

/**
 * Parse OPENSPEC_OPS_AUTO_REVIEW. Default: on.
 */
export function parseAutoReviewPolicy(
  raw: string | undefined = process.env.OPENSPEC_OPS_AUTO_REVIEW,
): AutoReviewPolicy {
  if (raw == null || raw.trim() === "") return "on";
  const v = raw.trim().toLowerCase();
  return v === "off" ? "off" : "on";
}
