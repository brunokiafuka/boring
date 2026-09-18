import { saveOrder } from "@/features/orders";

export const reportTotals = (x: unknown) => String(x ?? saveOrder);
