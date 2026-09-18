import { job } from "@boring-dev/core";
import { z } from "zod";
import { Customer } from "../resource";

/** Stands in for a slow call to the billing provider. */
export const SyncCustomerJob = job({
  name: "sync-customer",
  payload: z.object({ id: z.string() }),
  run: async ({ payload }) => {
    await new Promise((done) => setTimeout(done, 800));
    Customer.markSynced(payload.id);
  },
});
