import { saveOrder } from "@/features/orders";

export function OrderLink() {
  return <a href="/orders">{String(saveOrder)}</a>;
}
