import { money } from "@/shared/utils/format";
import { CustomerSyncStatus } from "../components/customer-sync-status";
import { Customer } from "../resource";

export function CustomerOverview() {
  const customer = Customer.current();

  return (
    <section>
      <dl className="facts">
        <div>
          <dt>Monthly revenue</dt>
          <dd>{money(customer.mrr)}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{customer.plan}</dd>
        </div>
        <div>
          <dt>Organisation</dt>
          <dd>{customer.orgId}</dd>
        </div>
      </dl>
      <CustomerSyncStatus syncedAt={customer.syncedAt} />
    </section>
  );
}
