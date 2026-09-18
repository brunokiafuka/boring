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
        <h1>Software should be boring.</h1>
        <p className="lede">
          Predictable, explicit, composable, and hard to make incoherent by accident. BoringJS is a small
          application model on top of Vite. Vite owns the machinery. Boring owns the shape.
        </p>
        <pre className="install">
          <code>pnpm create @boring-dev my-app</code>
        </pre>
      </section>

      <section>
        <h2>One command explains the whole application.</h2>
        <p>
          What features exist, what each exposes, every URL, and how layouts compose. You should not need to
          search the repository, and this is the test of that.
        </p>
        <pre className="terminal">
          <code>{explain}</code>
        </pre>
      </section>

      <section>
        <h2>The feature is the unit of understanding.</h2>
        <p>
          Organize around capabilities, not framework concepts. Everything needed to understand a feature sits
          in its folder, and <code>index.ts</code> is the only door in. Cross-feature deep imports, cycles,
          and leaking <code>internal/</code> are errors, not conventions.
        </p>
        <pre>
          <code>{tree}</code>
        </pre>
      </section>

      <section>
        <h2>Routing is explicit.</h2>
        <p>
          No file-based routing, so moving a file never changes a URL. The vocabulary is five functions and
          the tree is plain data. A branch loads and guards its data once; the layout and every view under it
          read it.
        </p>
        <pre>
          <code>{routesCode}</code>
        </pre>
      </section>

      <section>
        <h2>Small vocabulary, platform first.</h2>
        <p>
          Views are plain React functions. A form is a form: without JavaScript it posts natively, with it one
          document listener submits in place. Links are links. Progress is a data attribute and CSS. The
          entire UI-side API is <code>Outlet</code>, <code>useUser</code> and three signal hooks.
        </p>
        <pre>
          <code>{formCode}</code>
        </pre>
      </section>

      <section>
        <h2>Tests go through the real request path.</h2>
        <p>
          One style. Policies, loaders, validation, transactions and jobs all run, as a chosen user, without
          rendering anything.
        </p>
        <pre>
          <code>{`const app = testApp();
const page = await app.as(vik).visit("/customers/c_102");
const save = await app.as(vik).submit(path, updateCustomer, values);
await app.jobs.drain();`}</code>
        </pre>
      </section>

      <section>
        <h2>The shape is checked, not hoped for.</h2>
        <p>
          <code>boring check</code> reads the same compiled route tree as the server and reports drift with a
          rule number and the line. Suppressions need a reason and an expiry date.
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
          Requires Node 22.5. Then read the <a href="/docs">docs</a>, or open the{" "}
          <a href="https://github.com/brunokiafuka/boring/tree/main/examples/acme">reference app</a>.
        </p>
      </section>
    </main>
  );
}
