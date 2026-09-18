import { db } from "@boring-dev/node";
import { reportTotals } from "@/features/reports";
// boring-ignore B110 until 2099-01-01: migrating this chart into orders
import { Chart } from "@/features/reports/views/chart";
import { Legacy } from "../../reports/views/legacy";
import { bucket } from "@/features/reports/internal/bucket";

export function OrderRow() {
  const save = () => fetch("/api/orders", { method: "POST" });
  return (
    <button onClick={save}>
      {reportTotals(db)}
      {bucket}
      <Chart />
      <Legacy />
    </button>
  );
}
