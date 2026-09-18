import { testApp } from "@boring-dev/test";
import { expect, test } from "vitest";
import type { User } from "@/shared/auth";
import { updateCustomer } from "../actions/update-customer";
import { CustomerPolicy } from "../policies/customer";
import type { CustomerRecord } from "../resource";

const ada: User = { id: "ada", name: "Ada Okafor", role: "admin", orgId: "acme" };
const vik: User = { id: "vik", name: "Vik Rao", role: "viewer", orgId: "acme" };
const oz: User = { id: "oz", name: "Oz Lindqvist", role: "admin", orgId: "globex" };

const settings = "/customers/c_102/settings";
const valid = { name: "Halcyon Laboratories", billingEmail: "accounts@halcyon.example", plan: "scale" };

test("policies are plain functions", () => {
  const record = { orgId: "acme" } as CustomerRecord;
  expect(CustomerPolicy.update({ user: ada, record, params: {} })).toBe(true);
  expect(CustomerPolicy.update({ user: vik, record, params: {} })).toBe(false);
  expect(CustomerPolicy.view({ user: null, record, params: {} })).toBe(false);
});

test("the list is scoped to the user's organisation and filtered by the URL", async () => {
  const app = testApp();
  const all = await app.as(ada).visit("/customers");
  expect(all.data.customers).toHaveLength(6);

  const scale = await app.as(ada).visit("/customers?plan=scale");
  expect(scale.data.customers.map((c: CustomerRecord) => c.name)).toEqual([
    "Northwind Traders",
    "Tidewater Freight",
  ]);
  expect(scale.keys).toEqual(["Customer"]);

  const other = await app.as(oz).visit("/customers");
  expect(other.data.customers).toHaveLength(2);
});

test("signed-out visitors and other organisations are refused", async () => {
  const app = testApp();
  expect((await app.as(null).visit("/customers")).status).toBe(401);
  expect((await app.as(oz).visit(settings)).status).toBe(403);
  expect((await app.as(ada).visit("/customers/nope/settings")).status).toBe(404);
});

test("the app redirects / to the mounted feature", async () => {
  expect((await testApp().as(ada).visit("/")).redirect).toBe("/customers");
});

test("the customer branch loads once for the layout and every view under it", async () => {
  const app = testApp();
  const overview = await app.as(ada).visit("/customers/c_102");
  const nested = await app.as(ada).visit(settings);
  expect(overview.data.name).toBe("Halcyon Labs");
  expect(nested.data).toEqual(overview.data);
  expect(nested.keys).toEqual(["Customer/c_102"]);
});

test("an admin saves, the page reloads fresh, and the sync job runs after commit", async () => {
  const app = testApp();
  const saved = await app.as(ada).submit(settings, updateCustomer, valid);
  expect(saved.result).toMatchObject({ type: "success", invalidate: ["Customer/c_102"] });
  expect(saved.data).toMatchObject({ name: "Halcyon Laboratories", plan: "scale", syncedAt: null });

  await app.jobs.drain();
  const after = await app.as(ada).visit(settings);
  expect(after.data.syncedAt).not.toBeNull();
});

test("a viewer can look but not save", async () => {
  const app = testApp();
  expect((await app.as(vik).visit(settings)).status).toBe(200);
  const refused = await app.as(vik).submit(settings, updateCustomer, valid);
  expect(refused.status).toBe(403);
  expect((await app.as(ada).visit(settings)).data.name).toBe("Halcyon Labs");
});

test("schema and business rules both come back as field errors, and nothing is written", async () => {
  const app = testApp();
  const bad = await app
    .as(ada)
    .submit(settings, updateCustomer, { name: "x", billingEmail: "nope", plan: "gold" });
  expect(bad.status).toBe(422);
  expect(Object.keys(bad.errors)).toEqual(["name", "billingEmail", "plan"]);

  const taken = await app
    .as(ada)
    .submit(settings, updateCustomer, { ...valid, billingEmail: "ap@tidewater.example" });
  expect(taken.errors.billingEmail).toMatch(/already bills/);
  expect(taken.data.name).toBe("Halcyon Labs");
});
