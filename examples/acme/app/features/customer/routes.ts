import { allow, index, route, routes } from "@boring/core";
import type { User } from "@/shared/auth";
import { updateCustomer } from "./actions/update-customer";
import { CustomerLayout } from "./layouts/customer-layout";
import { CustomerPolicy } from "./policies/customer";
import { Customer } from "./resource";
import { CustomerList } from "./views/customer-list";
import { CustomerOverview } from "./views/customer-overview";
import { CustomerSettings } from "./views/customer-settings";

/** Mounted by app/routes.ts. Nothing here knows the prefix. */
export const customerRoutes = routes({
  policy: allow.signedIn,

  children: [
    index({
      view: CustomerList,
      title: "Customers · Acme",
      load: ({ search, user }) => {
        const filters = { q: search.get("q") ?? "", plan: search.get("plan") ?? "" };
        return { filters, customers: Customer.list({ orgId: (user as User).orgId, ...filters }) };
      },
    }),

    // One customer: loaded once, guarded once, shared by the layout and every view below.
    route("/:id", {
      layout: CustomerLayout,
      policy: CustomerPolicy.view,
      load: ({ params }) => Customer.find(params.id),

      children: [
        index({ view: CustomerOverview, title: ({ data }) => `${data.name} · Acme` }),
        route("/settings", {
          view: CustomerSettings,
          action: updateCustomer,
          title: ({ data }) => `${data.name} settings · Acme`,
        }),
      ],
    }),
  ],
});
