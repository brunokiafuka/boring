import { useUser } from "@boring/react";
import type { User } from "@/shared/auth";
import { TextField } from "@/shared/ui/text-field";
import { updateCustomer } from "../actions/update-customer";
import { CustomerSyncStatus } from "../components/customer-sync-status";
import { PLANS } from "../internal/plans";
import { Customer } from "../resource";

export function CustomerSettings() {
  const customer = Customer.current();
  const user = useUser<User>();
  const save = updateCustomer.state();
  const value = (name: "name" | "billingEmail" | "plan") => save.values[name] ?? customer[name];

  return (
    <>
      {user?.role === "viewer" && (
        <p className="notice">
          You are signed in as a viewer. The form still submits, and <code>customer:update</code> refuses it
          on the server.
        </p>
      )}

      <form action={updateCustomer} className="stack">
        <TextField
          label="Company name"
          name="name"
          defaultValue={value("name")}
          error={save.errors.name}
          required
        />
        <TextField
          label="Billing email"
          name="billingEmail"
          type="email"
          defaultValue={value("billingEmail")}
          error={save.errors.billingEmail}
          required
        />
        <TextField label="Plan" name="plan" defaultValue={value("plan")} error={save.errors.plan}>
          {PLANS.map((plan) => (
            <option key={plan}>{plan}</option>
          ))}
        </TextField>
        <div className="row">
          <button type="submit" disabled={save.pending}>
            Save changes
          </button>
          {save.succeeded && (
            <p className="form-message" role="status">
              Saved. Sync queued.
            </p>
          )}
        </div>
      </form>
      <CustomerSyncStatus syncedAt={customer.syncedAt} />
    </>
  );
}
