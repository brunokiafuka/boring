/** Plain values shared by the server schema and the browser form. */
export const PLANS = ["starter", "team", "scale"] as const;
export type Plan = (typeof PLANS)[number];
