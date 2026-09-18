import type { Plan } from "../internal/plans";

export function CustomerPlanBadge({ plan }: { plan: Plan }) {
  return <span className={`plan plan-${plan}`}>{plan}</span>;
}
