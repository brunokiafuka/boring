import { testApp } from "@boring-dev/test";
import { expect, test } from "vitest";
import type { DocRecord, DocSummary } from "../resource";

type Loaded = { page: DocRecord; pages: DocSummary[] };

test("/docs redirects to the first page", async () => {
  expect((await testApp().as(null).visit("/docs")).redirect).toBe("/docs/getting-started");
});

test("a page renders markdown with anchored headings, and knows its neighbours", async () => {
  const { status, data, keys } = await testApp().as(null).visit<Loaded>("/docs/getting-started");
  expect(status).toBe(200);
  expect(data.page.html).toContain('<h2 id="what-you-get">');
  expect(data.page.sections.map((s) => s.id)).toEqual(["what-you-get", "packages"]);
  expect(data.pages[0].slug).toBe("getting-started");
  expect(keys).toEqual(["Doc/getting-started", "Doc"]);
});

test("pages are ordered by their order line", async () => {
  const { data } = await testApp().as(null).visit<Loaded>("/docs/routing");
  expect(data.page.title).toBe("Routing");
  expect(data.pages.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6]);
});

test("unknown pages and path tricks are 404", async () => {
  const app = testApp();
  expect((await app.as(null).visit("/docs/nope")).status).toBe(404);
  expect((await app.as(null).visit("/docs/..%2Fpackage")).status).toBe(404);
});
