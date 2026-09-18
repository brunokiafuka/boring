---
title: Actions and forms
order: 4
description: Forms, actions, resources and policies: how a mutation gets to the server and back.
---

Small vocabulary, platform first. A form is a form.

```tsx
export function CustomerSettings() {
  const customer = Customer.current();
  const save = updateCustomer.state(); // pending, succeeded, errors, values

  return (
    <form action={updateCustomer}>
      <input name="name" defaultValue={customer.name} />
      <button type="submit" disabled={save.pending}>
        Save changes
      </button>
    </form>
  );
}
```

- Views, layouts and components are ordinary exported React functions. No custom syntax, no build-time rewrites.
- `<form action={someAction}>` renders a real `method="post"` form. Without JavaScript it posts natively; with it,
  one document listener submits in place. A form with no action is a GET form, and submitting it writes the URL.
- Links are `<a href>`. Progress is `<html data-boring="loading | submitting">` and CSS.
- The whole UI-side API: `Outlet`, `useUser`, `useSignal`, `useComputed`, `useSignalValue`.

## Declaring an action

An action declares its input schema and its policy, and runs inside a transaction. It ends with
`success(value, { invalidate, redirect })` or `invalid(fieldErrors)`.

```ts
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
```

Schema errors and business rules both come back as field errors, and nothing is written. Jobs enqueue only after
the transaction commits.

## Resources and policies

A resource groups server reads and writes under a name. Reads are tracked, so the client router knows which keys a
page depends on and reloads them after an action invalidates them.

```ts
export const Customer = resource("Customer", {
  reads: {
    find: (id: string) => db().get<CustomerRecord>("SELECT … WHERE id = ?", id) ?? null,
    list: (orgId: string) => db().all<CustomerRecord>("SELECT … WHERE org_id = ?", orgId),
  },
  update(id, input, { tx }) { … },
});
```

Policies are plain functions of `{ user, record, params }`.

```ts
export const CustomerPolicy = policy({
  view: ({ user, record }) => user?.orgId === record.orgId,
  update: ({ user, record }) => user?.orgId === record.orgId && user.role !== "viewer",
});
```
