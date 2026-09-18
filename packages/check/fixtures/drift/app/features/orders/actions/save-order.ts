import { action, success } from "@boring/core";
import { OrderRow } from "../views/order-row";

export const saveOrder = action({
  run: async () => success(OrderRow),
});
