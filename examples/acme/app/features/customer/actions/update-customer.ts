import { action, invalid, success } from "@boring/core";
import { SyncCustomerJob } from "../jobs/sync-customer";
import { CustomerPolicy } from "../policies/customer";
import { Customer } from "../resource";

export const updateCustomer = action({
  input: Customer.UpdateInput,
  policy: CustomerPolicy.update,
  run: async ({ input, params, tx }) => {
    if (Customer.emailTaken({ email: input.billingEmail, exceptId: params.id })) {
      return invalid({ billingEmail: "Another customer already bills to this address" });
    }
    const customer = Customer.update(params.id, input, { tx });
    await SyncCustomerJob.enqueue({ id: customer.id });
    return success(customer, { invalidate: Customer.key(customer.id) });
  },
});
