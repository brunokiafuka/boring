import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, publicApis } from "../src/index.js";

const drift = fileURLToPath(new URL("../fixtures/drift", import.meta.url));
const example = fileURLToPath(new URL("../../../examples/acme", import.meta.url));

const at = (report, rule) =>
  report.findings.filter((f) => f.rule === rule).map((f) => f.file.replace("app/", ""));

test("feature boundaries: deep imports, internal/, shared → feature, cycles, leaks", async () => {
  const report = await check(drift);
  assert.deepEqual(at(report, "B110"), ["features/orders/views/order-row.tsx"]); // legacy; the chart is suppressed
  assert.deepEqual(at(report, "B111"), ["features/orders/views/order-row.tsx"]);
  assert.deepEqual(at(report, "B112"), ["shared/ui/order-link.tsx"]);
  assert.deepEqual(at(report, "B114"), ["features/orders/index.ts"]);
  assert.equal(at(report, "B113").length, 1);
  assert.match(report.findings.find((f) => f.rule === "B113").advice, /orders → reports → orders/);
  assert.equal(report.suppressed, 1);
});

test("layering and canonical paths", async () => {
  const rules = new Set((await check(drift)).findings.map((f) => f.rule));
  for (const rule of ["B104", "B120", "B121", "B201", "B202", "B217", "B301", "B401"])
    assert.ok(rules.has(rule), rule);
});

test("suppressions expire", async () => {
  const report = await check(drift, { today: new Date("2100-01-01") });
  assert.equal(report.suppressed, 0);
  assert.equal(at(report, "B110").length, 2);
});

test("public APIs are read from index.ts", async () => {
  assert.deepEqual(await publicApis(example), {
    customer: ["Customer", "updateCustomer", "customerRoutes"],
    session: ["sessionRoutes"],
  });
});

test("the example app is clean", async () => {
  assert.deepEqual((await check(example)).findings, []);
});
