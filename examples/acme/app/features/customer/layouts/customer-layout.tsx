import { Outlet } from "@boring/react";
import { PageHeader } from "@/shared/ui/page-header";
import { CustomerPlanBadge } from "../components/customer-plan-badge";
import { Customer } from "../resource";

export function CustomerLayout() {
  const customer = Customer.current();
  const base = `/customers/${customer.id}`;

  return (
    <>
      <a className="back" href="/customers">
        ← Customers
      </a>
      <PageHeader eyebrow={customer.id} title={customer.name}>
        <CustomerPlanBadge plan={customer.plan} /> {customer.billingEmail}
      </PageHeader>
      <nav className="tabs" aria-label="Customer">
        <a href={base}>Overview</a>
        <a href={`${base}/settings`}>Settings</a>
      </nav>
      <Outlet />
    </>
  );
}
