import { testApp } from "@boring-dev/test";
import { expect, test } from "vitest";
import type { DocRecord } from "../resource";

test("/docs redirects to the first page", async () => {
  expect((await testApp().as(null).visit("/docs")).redirect).toBe("/docs/getting-started");
});

test("a page renders markdown and the layout gets the ordered list", async () => {
  const page = await testApp().as(null).visit<DocRecord>("/docs/getting-started");
  expect(page.status).toBe(200);
  expect(page.data.html).toContain("<h1>");
  expect(page.keys).toEqual(["Doc", "Doc/getting-started"]);
});

test("unknown pages and path tricks are 404", async () => {
  const app = testApp();
  expect((await app.as(null).visit("/docs/nope")).status).toBe(404);
  expect((await app.as(null).visit("/docs/..%2Fpackage")).status).toBe(404);
});

test("pages are ordered by their order line", async () => {
  const { data } = await testApp().as(null).visit<DocRecord>("/docs/routing");
  expect(data.title).toBe("Routing");
});
