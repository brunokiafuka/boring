import { useComputed, useSignal } from "@boring/react";
import { money } from "@/shared/utils/format";
import { PageHeader } from "@/shared/ui/page-header";
import { TextField } from "@/shared/ui/text-field";
import { CustomerPlanBadge } from "../components/customer-plan-badge";
import { PLANS } from "../internal/plans";
import { Customer, type CustomerRecord } from "../resource";

type Loaded = { filters: { q: string; plan: string }; customers: CustomerRecord[] };

export function CustomerList() {
  const { filters, customers } = Customer.current<Loaded>();

  // Signals hold what is only true in this tab: a draft selection and its total.
  const selected = useSignal<string[]>([]);
  const total = useComputed(() =>
    customers.filter((c) => selected.value.includes(c.id)).reduce((sum, c) => sum + c.mrr, 0),
  );
  const toggle = (id: string) => {
    const picked = selected.value;
    selected.value = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
  };

  return (
    <>
      <PageHeader eyebrow="Accounts" title="Customers">
        The filters live in the URL, so this exact view can be shared, bookmarked and reloaded.
      </PageHeader>

      {/* A GET form: submitting it writes the URL, and the URL is the state. */}
      <form className="filters" key={`${filters.q}|${filters.plan}`}>
        <TextField
          label="Search"
          name="q"
          type="search"
          placeholder="Company name"
          defaultValue={filters.q}
        />
        <TextField label="Plan" name="plan" defaultValue={filters.plan}>
          <option value="">Any plan</option>
          {PLANS.map((plan) => (
            <option key={plan}>{plan}</option>
          ))}
        </TextField>
        <button type="submit">Apply</button>
        {(filters.q || filters.plan) && (
          <a className="quiet" href="/customers">
            Clear
          </a>
        )}
      </form>

      {customers.length === 0 ? (
        <p className="empty">No customers match those filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th aria-label="Select" />
              <th>Company</th>
              <th>Plan</th>
              <th className="num">MRR</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${customer.name}`}
                    checked={selected.value.includes(customer.id)}
                    onChange={() => toggle(customer.id)}
                  />
                </td>
                <td>
                  <strong>{customer.name}</strong>
                  <span className="sub">{customer.billingEmail}</span>
                </td>
                <td>
                  <CustomerPlanBadge plan={customer.plan} />
                </td>
                <td className="num">{money(customer.mrr)}</td>
                <td className="num">
                  <a href={`/customers/${customer.id}`}>Open</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="selection" aria-live="polite">
        {selected.value.length === 0
          ? "Select rows to total their revenue."
          : `${selected.value.length} selected · ${money(total.value)} MRR`}
      </p>
    </>
  );
}
