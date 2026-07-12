/**
 * OPENSPEC_OPS_AUTO_IMPL_REVIEW: on|off. Default: on.
 */
export type AutoImplReviewPolicy = "on" | "off";

export function parseAutoImplReviewPolicy(
  raw: string | undefined = process.env.OPENSPEC_OPS_AUTO_IMPL_REVIEW,
): AutoImplReviewPolicy {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "off") return "off";
  // default on (including unset and unknown)
  return "on";
}
