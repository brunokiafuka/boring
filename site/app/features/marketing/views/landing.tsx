const explain = `$ pnpm explain

Features
  customer exposes Customer, updateCustomer, customerRoutes
  session exposes sessionRoutes

Routes
  /customers               AppShell › CustomerList                        customer · allow:signedIn
  /customers/:id           AppShell › CustomerLayout › CustomerOverview   customer · allow:signedIn + customer:view
  /customers/:id/settings  AppShell › CustomerLayout › CustomerSettings   customer · … · 1 action
  /session                 AppShell › SessionPage                         session · allow:everyone · 1 action
  /                        → /customers`;

const tree = `app/
├── routes.ts            every URL, in one place
├── layout.tsx           the application shell
├── features/
│   └── customer/
│       ├── index.ts     public API: the only door in
│       ├── routes.ts    the URLs this feature owns
│       ├── resource.ts  server reads and writes
│       ├── actions/     mutations
│       ├── policies/    who may do what
│       ├── jobs/        work that outlives the request
│       ├── views/       route-level UI
│       ├── components/  reusable UI
│       ├── internal/    private helpers
│       └── tests/
└── shared/              auth, ui, utils: depends on no feature`;

const routesCode = `export const customerRoutes = routes({
  policy: allow.signedIn,
  children: [
    index({ view: CustomerList, load: ({ user }) => Customer.list(user.orgId) }),

    route("/:id", {
      layout: CustomerLayout,
      policy: CustomerPolicy.view,
      load: ({ params }) => Customer.find(params.id),
      children: [
        index(CustomerOverview),
        route("/settings", { view: CustomerSettings, action: updateCustomer }),
      ],
    }),
  ],
});`;

const formCode = `export function CustomerSettings() {
  const customer = Customer.current();
  const save = updateCustomer.state();

  return (
    <form action={updateCustomer}>
      <input name="name" defaultValue={customer.name} />
      <button type="submit" disabled={save.pending}>
        Save changes
      </button>
    </form>
  );
}`;

const checkOutput = `✓ route tree is valid: 4 routes, no duplicates or conflicts
✓ features only meet through their public APIs
✓ no feature dependency cycles
✓ app/shared depends on no feature
✓ UI, business rules and server code point the right way
✓ actions declare input schemas and policies
✓ no parallel state or mutation systems
✓ features with actions have tests`;

export function Landing() {
  return (
    <main className="landing">
      <section className="hero">
        <h1>
          Software should be boring. <span className="hero-invite">Let's start with your frontend.</span>
        </h1>
        <p className="lede">
          A small application model on top of Vite. Vite owns the machinery. Boring owns the shape.
        </p>
        <pre className="install">
          <code>pnpm create @boring-dev my-app</code>
        </pre>
      </section>

      <section>
        <h2>One command explains the whole app.</h2>
        <p>Every feature, every URL, every layout. You never search the repository.</p>
        <pre className="terminal">
          <code>{explain}</code>
        </pre>
      </section>

      <section>
        <h2>A feature is a folder.</h2>
        <p>
          Everything about a capability lives together, and <code>index.ts</code> is the only door in.
        </p>
        <pre>
          <code>{tree}</code>
        </pre>
      </section>

      <section>
        <h2>Routes are data.</h2>
        <p>
          Five functions, no file-based routing. A branch loads and guards once; everything under it reads it.
        </p>
        <pre>
          <code>{routesCode}</code>
        </pre>
      </section>

      <section>
        <h2>A form is a form.</h2>
        <p>Plain React, plain HTML. It posts without JavaScript and submits in place with it.</p>
        <pre>
          <code>{formCode}</code>
        </pre>
      </section>

      <section>
        <h2>Tests take the real path.</h2>
        <p>Policies, loaders, validation, transactions and jobs run as a chosen user. Nothing renders.</p>
        <pre>
          <code>{`const app = testApp();
const page = await app.as(vik).visit("/customers/c_102");
const save = await app.as(vik).submit(path, updateCustomer, values);
await app.jobs.drain();`}</code>
        </pre>
      </section>

      <section>
        <h2>The shape is checked.</h2>
        <p>
          <code>boring check</code> reads the same route tree as the server and names the line that drifted.
        </p>
        <pre className="terminal">
          <code>{checkOutput}</code>
        </pre>
      </section>

      <section className="closing">
        <h2>Start boring.</h2>
        <pre className="install">
          <code>pnpm create @boring-dev my-app</code>
        </pre>
        <p>
          Node 22.5 or newer. Then the <a href="/docs">docs</a>, or the{" "}
          <a href="https://github.com/brunokiafuka/boring/tree/main/examples/acme">reference app</a>.
        </p>
      </section>
    </main>
  );
}
